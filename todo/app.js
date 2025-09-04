/**
 * Google Sheets Checklist for Infinite Hips Surgery
 * Handles bidirectional sync between web UI and Google Sheets
 */

class GoogleSheetsChecklist {
    constructor(config = {}) {
        // Get configuration from window.CHECKLIST_CONFIG or use defaults
        const defaultConfig = {
            sheetId: '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag',
            gid: '1860137714',
            appsScriptUrl: 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
            refreshInterval: 30000,
            maxRetries: 3
        };
        
        // Merge configurations: window config > passed config > defaults
        const finalConfig = {
            ...defaultConfig,
            ...(window.CHECKLIST_CONFIG || {}),
            ...config
        };
        
        // Apply configuration
        this.sheetId = finalConfig.sheetId;
        this.gid = finalConfig.gid;
        this.appsScriptUrl = finalConfig.appsScriptUrl;
        this.refreshInterval = finalConfig.refreshInterval;
        this.maxRetries = finalConfig.maxRetries;
        
        // Initialize other properties
        this.tasks = [];
        this.lastSync = null;
        this.lastModified = null;
        this.isOnline = navigator.onLine;
        this.useAppsScript = this.appsScriptUrl && this.appsScriptUrl !== 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
        this.retryCount = 0;
        this.isInitialLoad = true;
        this.init();
    }

    init() {
        // Event listeners
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadFromSheet());
        
        // Add task form event listeners
        document.getElementById('add-item-btn').addEventListener('click', () => this.showAddTaskForm());
        document.getElementById('cancel-add-btn').addEventListener('click', () => this.hideAddTaskForm());
        document.getElementById('new-task-form').addEventListener('submit', (e) => this.handleAddTask(e));
        
        // Handle "Other" option dropdowns
        document.getElementById('task-timeline').addEventListener('change', (e) => this.handleOtherOption(e, 'task-timeline-other'));
        document.getElementById('task-category').addEventListener('change', (e) => this.handleOtherOption(e, 'task-category-other'));
        document.getElementById('task-who-can-help').addEventListener('change', (e) => this.handleOtherOption(e, 'task-who-can-help-other'));

        // Auto-refresh using configured interval
        setInterval(() => this.loadFromSheet(), this.refreshInterval);

        // Network status monitoring
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.hideOfflineNotice();
            this.loadFromSheet();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showOfflineNotice();
        });

        // Initial load
        this.loadFromSheet();
    }

    async loadFromSheet() {
        if (!this.isOnline) {
            this.showOfflineNotice();
            return;
        }

        try {
            this.showLoading(true);
            this.hideOfflineNotice();

            // Use Apps Script if available, otherwise fall back to CSV
            if (this.useAppsScript) {
                await this.loadFromAppsScript();
            } else {
                await this.loadFromCSV();
            }

            this.lastSync = new Date();
            this.updateLastSyncDisplay();
            this.renderTasks();
            this.updateProgress();
            this.updateSyncStatus('✅ Synced');

        } catch (error) {
            console.error('Error loading from Google Sheets:', error);
            this.showError(`Failed to sync with Google Sheets: ${error.message}`);
            this.showOfflineNotice();
            
            // Try to load cached data, or use sample data if no cache
            if (!this.loadCachedData()) {
                this.loadSampleData();
            }
        } finally {
            this.showLoading(false);
            // Mark initial load as complete
            this.isInitialLoad = false;
        }
    }

    async loadFromAppsScript() {
        // Use GET request to avoid CORS issues
        const url = `${this.appsScriptUrl}?action=getTasks&t=${Date.now()}`;
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`Apps Script error: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.data?.error || 'Apps Script returned error');
        }

        this.tasks = result.data.tasks || [];
        this.lastModified = result.data.lastModified;
        
        // Cache the data
        this.saveToCache();
    }

    async loadFromCSV() {
        // Use Google Sheets CSV export URL for public access with headers
        const csvUrl = `https://docs.google.com/spreadsheets/d/${this.sheetId}/gviz/tq?tqx=out:csv&gid=${this.gid}&headers=1`;
        const response = await fetch(csvUrl, {
            mode: 'cors',
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Sheet may not be public`);
        }

        const csvText = await response.text();
        
        // Check if we got an HTML error page instead of CSV
        if (csvText.includes('<HTML>') || csvText.includes('<!DOCTYPE')) {
            throw new Error('Sheet is not publicly accessible. Please make it viewable to anyone with the link.');
        }
        
        this.parseCsvData(csvText);
        
        // Cache the data
        this.saveToCache();
    }

    parseCsvData(csvText) {
        const lines = csvText.trim().split('\n');
        const tasks = [];

        if (lines.length < 2) return; // Need at least header + 1 data row

        // Parse header row to get column indices
        const headers = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
        const columnMap = {
            done: headers.indexOf('done?') !== -1 ? headers.indexOf('done?') : 0,
            task: headers.indexOf('task') !== -1 ? headers.indexOf('task') : 1,
            timeline: headers.indexOf('timeline') !== -1 ? headers.indexOf('timeline') : -1,
            priority: headers.indexOf('priority') !== -1 ? headers.indexOf('priority') : -1,
            category: headers.indexOf('category') !== -1 ? headers.indexOf('category') : -1,
            how: headers.indexOf('how') !== -1 ? headers.indexOf('how') : -1,
            notes: headers.indexOf('notes') !== -1 ? headers.indexOf('notes') : -1,
            whoCanHelp: headers.indexOf('who can help') !== -1 ? headers.indexOf('who can help') : 
                        headers.indexOf('whocanhelp') !== -1 ? headers.indexOf('whocanhelp') : -1
        };

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = this.parseCSVLine(line);
            
            if (columns.length > columnMap.task && columns[columnMap.task]?.trim()) {
                const completed = columns[columnMap.done]?.toLowerCase().trim();
                const taskText = columns[columnMap.task]?.trim();
                
                if (taskText) {
                    tasks.push({
                        id: `sheet-${i}`,
                        text: taskText,
                        completed: completed === 'true' || completed === '✓' || completed === 'yes' || completed === '1',
                        timeline: columnMap.timeline >= 0 ? columns[columnMap.timeline]?.trim() || 'General' : 'General',
                        priority: columnMap.priority >= 0 ? columns[columnMap.priority]?.toLowerCase().trim() || 'medium' : 'medium',
                        category: columnMap.category >= 0 ? columns[columnMap.category]?.trim() || '' : '',
                        how: columnMap.how >= 0 ? columns[columnMap.how]?.trim() || '' : '',
                        notes: columnMap.notes >= 0 ? columns[columnMap.notes]?.trim() || '' : '',
                        whoCanHelp: columnMap.whoCanHelp >= 0 ? columns[columnMap.whoCanHelp]?.trim() || '' : '',
                        source: 'google-sheets',
                        rowIndex: i + 1
                    });
                }
            }
        }

        this.tasks = tasks;
        
        // Cache the data
        localStorage.setItem('sheets-checklist-cache', JSON.stringify({
            tasks: this.tasks,
            lastSync: this.lastSync,
            timestamp: Date.now()
        }));
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.replace(/^"|"$/g, ''));
        return result;
    }

    loadCachedData() {
        try {
            const cached = localStorage.getItem('sheets-checklist-cache');
            if (cached) {
                const data = JSON.parse(cached);
                this.tasks = data.tasks || [];
                this.lastSync = data.lastSync ? new Date(data.lastSync) : null;
                this.updateLastSyncDisplay();
                this.renderTasks();
                this.updateProgress();
                
                // Show age of cached data
                const age = Date.now() - (data.timestamp || 0);
                const ageMinutes = Math.floor(age / 60000);
                this.updateSyncStatus(`💾 Cached (${ageMinutes}m old)`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error loading cached data:', error);
            return false;
        }
    }

    loadSampleData() {
        // Sample data for demonstration while sheet access is being set up
        this.tasks = [
            {
                id: 'sample-1',
                text: '🧴 Start Hibiclens skin washing daily',
                completed: false,
                timeline: 'Pre-Surgery (Sept 5-11)',
                priority: 'high',
                category: 'Medical Prep',
                how: 'Daily shower with Hibiclens soap',
                notes: 'Start 7 days before surgery',
                whoCanHelp: 'Nurse coordinator',
                source: 'sample',
                rowIndex: 2
            },
            {
                id: 'sample-2',
                text: '🏥 Confirm surgery check-in time',
                completed: true,
                timeline: 'Pre-Surgery (Sept 5-11)',
                priority: 'high',
                category: 'Logistics',
                how: 'Call Scripps Mission Valley',
                notes: '7:30am check-in confirmed',
                whoCanHelp: 'Surgery scheduler',
                source: 'sample',
                rowIndex: 3
            },
            {
                id: 'sample-3',
                text: '🚗 Arrange transportation',
                completed: false,
                timeline: 'Surgery Day (Sept 12)',
                priority: 'high',
                category: 'Logistics',
                how: 'Family member or rideshare',
                notes: 'Cannot drive home after surgery',
                whoCanHelp: 'Family, friends',
                source: 'sample',
                rowIndex: 4
            },
            {
                id: 'sample-4',
                text: '🏠 Set up recovery area',
                completed: false,
                timeline: 'Pre-Surgery (Sept 5-11)',
                priority: 'medium',
                category: 'Home Prep',
                how: 'Install raised toilet seat, shower chair',
                notes: 'Make sure walker can fit through doorways',
                whoCanHelp: 'Handyman, family',
                source: 'sample',
                rowIndex: 5
            },
            {
                id: 'sample-5',
                text: '💊 Pick up prescribed medications',
                completed: false,
                timeline: 'Pre-Surgery (Sept 5-11)',
                priority: 'high',
                category: 'Medical Prep',
                how: 'Pharmacy pickup',
                notes: 'Pain management and antibiotics',
                whoCanHelp: 'Pharmacist',
                source: 'sample',
                rowIndex: 6
            }
        ];
        
        this.renderTasks();
        this.updateProgress();
        this.updateSyncStatus('📋 Sample Data');
        
        // Show sample data notice
        document.getElementById('sample-notice').style.display = 'block';
    }

    async updateTaskInSheet(taskId, completed) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }

        // If Apps Script is available, use it for direct updates
        if (this.useAppsScript) {
            try {
                this.showLoading(true);
                
                // Update the task locally first for immediate feedback
                task.completed = completed;
                this.renderTasks();
                this.updateProgress();
                
                // Send update to Apps Script using GET to avoid CORS
                const params = new URLSearchParams({
                    action: 'updateTask',
                    taskId: taskId,
                    completed: completed.toString(),
                    updatedBy: 'Web UI',
                    t: Date.now()
                });
                const response = await fetch(`${this.appsScriptUrl}?${params}`, {
                    method: 'GET',
                    mode: 'cors'
                });

                if (!response.ok) {
                    throw new Error(`Apps Script error: ${response.status}`);
                }

                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.data?.error || 'Failed to update task');
                }

                // Update was successful
                this.updateSyncStatus('✅ Task Updated');
                
                // Refresh data to ensure consistency
                setTimeout(() => this.loadFromSheet(), 1000);
                
            } catch (error) {
                console.error('Error updating task:', error);
                
                // Revert the local change
                task.completed = !completed;
                this.renderTasks();
                this.updateProgress();
                
                this.showError(`Failed to update task: ${error.message}`);
            } finally {
                this.showLoading(false);
            }
        } else {
            // Fallback: Open Google Sheets for manual editing
            const sheetUrl = `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit#gid=${this.gid}&range=A${task.rowIndex}`;
            
            if (confirm(`This will open the Google Sheet to edit row ${task.rowIndex}.\n\nTo enable direct editing, set up the Google Apps Script (see instructions in google-apps-script.js file).\n\nContinue to open sheet?`)) {
                window.open(sheetUrl, '_blank');
            }
        }
    }

    renderTasks() {
        const todoList = document.getElementById('todo-list');
        
        if (this.tasks.length === 0) {
            todoList.innerHTML = '<p style="text-align: center; color: #ff69b4; padding: 40px;">No tasks found in the Google Sheet.<br><a href="https://docs.google.com/spreadsheets/d/1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag/edit?usp=sharing" target="_blank" style="color: #ff69b4;">Add some tasks to the sheet</a></p>';
            return;
        }

        // Group tasks by timeline
        const timelineGroups = {};
        this.tasks.forEach(task => {
            const timeline = task.timeline || 'Other';
            if (!timelineGroups[timeline]) {
                timelineGroups[timeline] = [];
            }
            timelineGroups[timeline].push(task);
        });

        // Sort groups by timeline order: 'asap' first, then numbers descending, then others ascending
        const sortedTimelines = Object.keys(timelineGroups).sort((a, b) => {
            // 'asap' always comes first
            if (a.toLowerCase() === 'asap') return -1;
            if (b.toLowerCase() === 'asap') return 1;
            
            // Check if strings start with numbers
            const aStartsWithNumber = /^\d/.test(a);
            const bStartsWithNumber = /^\d/.test(b);
            
            // If both start with numbers, sort descending by the number
            if (aStartsWithNumber && bStartsWithNumber) {
                const aNum = parseInt(a.match(/^\d+/)[0]);
                const bNum = parseInt(b.match(/^\d+/)[0]);
                return bNum - aNum; // descending
            }
            
            // If one starts with number and other doesn't, number comes first
            if (aStartsWithNumber && !bStartsWithNumber) return -1;
            if (!aStartsWithNumber && bStartsWithNumber) return 1;
            
            // If neither starts with number, sort alphabetically ascending
            return a.localeCompare(b);
        });

        let html = '';

        sortedTimelines.forEach(timeline => {
            const tasks = timelineGroups[timeline];
            
            // Sort tasks within timeline by priority (critical -> high -> medium -> low), then by completion status
            const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3, '': 4 };
            tasks.sort((a, b) => {
                // First sort by completion (incomplete first)
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                // Then by priority
                const aPriority = priorityOrder[a.priority?.toLowerCase().trim()] ?? 4;
                const bPriority = priorityOrder[b.priority?.toLowerCase().trim()] ?? 4;
                return aPriority - bPriority;
            });

            // Add timeline group header
            html += `<div class="timeline-group">`;
            html += `<div class="timeline-title">${timeline}</div>`;

            tasks.forEach(task => {
                // Extract clean priority value from formats like "1- Critical" or "3 - Medium"
                const cleanPriority = task.priority ? 
                    task.priority.toLowerCase().replace(/^\d+\s*-\s*/, '').trim() : '';
                const priorityClass = '';
                // cleanPriority ? `priority-${cleanPriority.replace(/\s+/g, '-')}` : '';
                
                html += `<div class="todo-item ${priorityClass}">`;
                
                // Add priority icon in upper right corner
                let priorityIcon = '';
                if (cleanPriority) {
                    priorityIcon = {
                        'critical': '❗',
                        'high': '🔥',
                        'medium': '📌', 
                        'low': '📝'
                    }[cleanPriority] || '';
                    html += `<div class="priority-corner-icon">${priorityIcon}</div>`;
                }
                
                html += `<input type="checkbox" class="todo-checkbox" ${task.completed ? 'checked' : ''} 
                           onchange="sheetsChecklist.updateTaskInSheet('${task.id}', this.checked)"
                           title="Click to edit this task in Google Sheets">`;
                html += `<div style="flex: 1;">`;
                // Task text without priority icon
                let taskText = this.escapeHtml(task.text);
                
                html += `<div class="todo-text ${task.completed ? 'todo-completed' : ''}"><h3>${taskText}</h3></div>`;
                
                // Add details section for priority, category, how, notes, and whoCanHelp
                if (task.priority || task.category || task.how || task.notes || task.whoCanHelp) {
                    html += `<div class="task-details">`;
                    
                    if (task.priority) {
                        const detailPriorityIcon = cleanPriority ? {
                            'critical': '❗',
                            'high': '🔥',
                            'medium': '📌', 
                            'low': '📝'
                        }[cleanPriority] || '⚪' : '⚪';
                        html += `<div class="detail-item"><span class="detail-icon">${detailPriorityIcon}</span><span class="detail-label">Priority:</span> ${this.escapeHtml(task.priority)}</div>`;
                    }
                    
                    if (task.category) {
                        html += `<div class="detail-item"><span class="detail-icon">📂</span><span class="detail-label">Category:</span> ${this.escapeHtml(task.category)}</div>`;
                    }
                    
                    if (task.how) {
                        html += `<div class="detail-item"><span class="detail-icon">🔧</span><span class="detail-label">How:</span> ${this.escapeHtml(task.how)}</div>`;
                    }
                    
                    if (task.notes) {
                        const notesContent = this.linkifyUrls(task.notes);
                        html += `<div class="detail-item"><span class="detail-icon">📝</span><span class="detail-label">Notes:</span> ${notesContent}</div>`;
                    }
                    
                    // Always show Helper field last (editable)
                    const whoCanHelpValue = task.whoCanHelp || '';
                    const displayValue = whoCanHelpValue || '';
                    html += `<div class="detail-item">
                        <span class="detail-icon">🤝</span>
                        <span class="detail-label">Helper:</span> 
                        <div class="editable-field-container">
                            <select class="editable-dropdown" data-task-id="${task.id}" data-field="whoCanHelp" onchange="sheetsChecklist.handleWhoCanHelpChange(this)">
                                <option value="${this.escapeHtml(whoCanHelpValue)}">${this.escapeHtml(displayValue)}</option>
                                <option value="Other">Other</option>
                            </select>
                            <input type="text" class="editable-other-input" style="display: none; margin-top: 8px;" placeholder="Enter helper name..." onblur="sheetsChecklist.updateWhoCanHelpField(this)" data-task-id="${task.id}">
                        </div>
                    </div>`;
                    
                    html += `</div>`;
                }
                
                html += `</div>`;
                html += `</div>`;
            });

            html += `</div>`; // Close timeline-group
        });

        todoList.innerHTML = html;
        
        // Update form dropdowns with current data
        this.populateFormDropdowns();
        
        // Populate detail view dropdowns
        this.populateDetailDropdowns();
    }

    handleWhoCanHelpChange(dropdown) {
        const container = dropdown.parentElement;
        const otherInput = container.querySelector('.editable-other-input');
        const taskId = dropdown.dataset.taskId;
        
        if (dropdown.value === 'Other') {
            // Show the "Other" input field
            otherInput.style.display = 'block';
            otherInput.focus();
        } else {
            // Hide the "Other" input field and update immediately
            otherInput.style.display = 'none';
            otherInput.value = '';
            
            // Update the task with the selected value (including empty value)
            this.updateTaskDetails(taskId, { whoCanHelp: dropdown.value });
        }
    }

    async updateWhoCanHelpField(input) {
        const taskId = input.dataset.taskId;
        const newValue = input.value.trim();
        
        if (newValue) {
            await this.updateTaskDetails(taskId, { whoCanHelp: newValue });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    linkifyUrls(text) {
        // First escape the HTML to prevent XSS
        const escapedText = this.escapeHtml(text);
        
        // URL regex pattern
        const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
        
        // Replace URLs with anchor tags
        return escapedText.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--color-pink); text-decoration: underline;">$1</a>');
    }

    updateProgress() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const percentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${completedTasks} of ${totalTasks} tasks completed (${Math.round(percentage)}%)`;
        }
    }

    updateLastSyncDisplay() {
        const lastSyncEl = document.getElementById('last-sync');
        if (lastSyncEl && this.lastSync) {
            const timeAgo = this.getTimeAgo(this.lastSync);
            lastSyncEl.textContent = `Last synced: ${timeAgo}`;
        }
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    // Add Task Form Methods
    showAddTaskForm() {
        this.populateFormDropdowns();
        document.getElementById('add-task-form').style.display = 'block';
        document.getElementById('task-text').focus();
    }

    populateDetailDropdowns() {
        // Get all editable dropdowns in the detail view
        const editableDropdowns = document.querySelectorAll('.editable-dropdown[data-field="whoCanHelp"]');
        
        // Get unique who-can-help values from tasks (excluding empty values)
        const whoCanHelpValues = [...new Set(
            this.tasks
                .map(task => task['Who Can Help'] || task.whoCanHelp)
                .filter(value => value && value.trim() !== '')
                .map(value => value.trim())
        )].sort(); // Alphabetical sorting
        
        editableDropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            const isEmptyValue = !currentValue || currentValue === 'Click to set...';
            
            // Clear existing options except current value and "Other"
            const existingOptions = Array.from(dropdown.options);
            existingOptions.forEach(option => {
                if (option.value !== currentValue && option.value !== 'Other') {
                    option.remove();
                }
            });
            
            // For empty values, replace the placeholder option
            if (isEmptyValue) {
                dropdown.innerHTML = '<option value="">Click to set...</option><option value="Other">Other</option>';
            }
            
            // Add dynamic options before "Other"
            const otherOption = dropdown.querySelector('option[value="Other"]');
            whoCanHelpValues.forEach(value => {
                if (value !== currentValue) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    dropdown.insertBefore(option, otherOption);
                }
            });
        });
    }

    populateFormDropdowns() {
        this.populateTimelineDropdown();
        this.populateCategoryDropdown();
        this.populateWhoCanHelpDropdown();
    }

    populateTimelineDropdown() {
        const timelineSelect = document.getElementById('task-timeline');
        const uniqueTimelines = [...new Set(this.tasks.map(task => task.timeline).filter(timeline => timeline && timeline.trim()))];
        
        // Sort timelines with custom logic (asap first, numbers descending, others ascending)
        const sortedTimelines = uniqueTimelines.sort((a, b) => {
            if (a.toLowerCase() === 'asap') return -1;
            if (b.toLowerCase() === 'asap') return 1;
            
            const aStartsWithNumber = /^\d/.test(a);
            const bStartsWithNumber = /^\d/.test(b);
            
            if (aStartsWithNumber && bStartsWithNumber) {
                const aNum = parseInt(a.match(/^\d+/)[0]);
                const bNum = parseInt(b.match(/^\d+/)[0]);
                return bNum - aNum;
            }
            
            if (aStartsWithNumber && !bStartsWithNumber) return -1;
            if (!aStartsWithNumber && bStartsWithNumber) return 1;
            
            return a.localeCompare(b);
        });

        // Clear existing options except the first one and "Other"
        const firstOption = timelineSelect.options[0];
        const otherOption = Array.from(timelineSelect.options).find(opt => opt.value === 'Other');
        timelineSelect.innerHTML = '';
        
        // Add back the default option
        timelineSelect.appendChild(firstOption);
        
        // Add dynamic options
        sortedTimelines.forEach(timeline => {
            if (timeline !== 'Other') {
                const option = document.createElement('option');
                option.value = timeline;
                option.textContent = timeline;
                timelineSelect.appendChild(option);
            }
        });
        
        // Add "Other" option at the end
        if (otherOption) {
            timelineSelect.appendChild(otherOption);
        } else {
            const otherOpt = document.createElement('option');
            otherOpt.value = 'Other';
            otherOpt.textContent = 'Other (specify below)';
            timelineSelect.appendChild(otherOpt);
        }
    }

    populateWhoCanHelpDropdown() {
        const whoCanHelpSelect = document.getElementById('task-who-can-help');
        if (!whoCanHelpSelect) return;

        // Get unique who-can-help values from tasks
        const whoCanHelpValues = [...new Set(
            this.tasks
                .map(task => task['Who Can Help'])
                .filter(value => value && value.trim() !== '')
                .map(value => value.trim())
        )].sort(); // Alphabetical sorting

        // Remove existing dynamic options (keep default and "Other")
        const existingOptions = Array.from(whoCanHelpSelect.options);
        existingOptions.forEach(option => {
            if (option.value !== '' && option.value !== 'Other') {
                option.remove();
            }
        });

        // Add dynamic options before "Other"
        const otherOption = whoCanHelpSelect.querySelector('option[value="Other"]');
        whoCanHelpValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            whoCanHelpSelect.insertBefore(option, otherOption);
        });
    }

    populateCategoryDropdown() {
        const categorySelect = document.getElementById('task-category');
        const uniqueCategories = [...new Set(this.tasks.map(task => task.category).filter(category => category && category.trim()))];
        
        // Sort categories alphabetically
        const sortedCategories = uniqueCategories.sort((a, b) => a.localeCompare(b));

        // Clear existing options except the first one and "Other"
        const firstOption = categorySelect.options[0];
        const otherOption = Array.from(categorySelect.options).find(opt => opt.value === 'Other');
        categorySelect.innerHTML = '';
        
        // Add back the default option
        categorySelect.appendChild(firstOption);
        
        // Add dynamic options
        sortedCategories.forEach(category => {
            if (category !== 'Other') {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                categorySelect.appendChild(option);
            }
        });
        
        // Add "Other" option at the end
        if (otherOption) {
            categorySelect.appendChild(otherOption);
        } else {
            const otherOpt = document.createElement('option');
            otherOpt.value = 'Other';
            otherOpt.textContent = 'Other (specify below)';
            categorySelect.appendChild(otherOpt);
        }
    }

    hideAddTaskForm() {
        document.getElementById('add-task-form').style.display = 'none';
        document.getElementById('new-task-form').reset();
        // Hide any "other" fields
        document.getElementById('task-timeline-other').style.display = 'none';
        document.getElementById('task-category-other').style.display = 'none';
    }

    handleOtherOption(event, otherFieldId) {
        const otherField = document.getElementById(otherFieldId);
        if (event.target.value === 'Other') {
            otherField.style.display = 'block';
            otherField.focus();
        } else {
            otherField.style.display = 'none';
            otherField.value = '';
        }
    }

    async handleAddTask(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        // Handle "Other" options
        let timeline = formData.get('timeline') || 'General';
        if (timeline === 'Other') {
            timeline = formData.get('timelineOther')?.trim() || 'General';
        }
        
        let category = formData.get('category') || '';
        if (category === 'Other') {
            category = formData.get('categoryOther')?.trim() || '';
        }
        
        let whoCanHelp = formData.get('whoCanHelp') || '';
        if (whoCanHelp === 'Other') {
            whoCanHelp = formData.get('whoCanHelpOther')?.trim() || '';
        }
        
        const taskData = {
            text: formData.get('taskText').trim(),
            timeline: timeline,
            priority: formData.get('priority') || '',
            category: category,
            how: formData.get('how') || '',
            notes: formData.get('notes') || '',
            whoCanHelp: whoCanHelp,
            completed: false
        };

        if (!taskData.text) {
            alert('Please enter a task description.');
            return;
        }

        try {
            if (this.useAppsScript) {
                // Try to add via Apps Script
                await this.addTask(taskData);
                this.updateSyncStatus('✅ Task Added');
                this.hideAddTaskForm();
                // Refresh to show the new task
                setTimeout(() => this.loadFromSheet(), 1000);
            } else {
                // Fallback: Show instructions to add manually
                const sheetUrl = `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit#gid=${this.gid}`;
                const message = `To add this task, please:\n\n1. Open the Google Sheet\n2. Add a new row with:\n   - Task: ${taskData.text}\n   - Timeline: ${taskData.timeline}\n   - Priority: ${taskData.priority}\n   - Category: ${taskData.category}\n   - How: ${taskData.how}\n   - Notes: ${taskData.notes}\n   - Who Can Help: ${taskData.whoCanHelp}\n\nOpen Google Sheet now?`;
                
                if (confirm(message)) {
                    window.open(sheetUrl, '_blank');
                }
                this.hideAddTaskForm();
            }
        } catch (error) {
            console.error('Error adding task:', error);
            this.showError(`Failed to add task: ${error.message}`);
        }
    }

    showLoading(show) {
        // Only show loading indicator during initial load
        if (this.isInitialLoad) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 8000);
    }

    showOfflineNotice() {
        document.getElementById('offline-notice').style.display = 'block';
    }

    hideOfflineNotice() {
        document.getElementById('offline-notice').style.display = 'none';
    }

    updateSyncStatus(status) {
        const syncStatus = document.getElementById('sync-status');
        syncStatus.textContent = status;
        
        setTimeout(() => {
            syncStatus.textContent = '📊 Google Sheets';
        }, 3000);
    }

    // Additional Apps Script methods for enhanced functionality

    async addTask(taskData) {
        if (!this.useAppsScript) {
            console.warn('Apps Script not configured, cannot add tasks');
            return;
        }

        try {
            // For now, disable complex operations to avoid CORS issues
            // Focus on core read/update functionality
            console.warn('AddTask temporarily disabled due to CORS limitations. Use Google Sheets directly to add tasks.');
            return;
            
            /* CORS-limited implementation - uncomment when needed
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'addTask',
                    task: taskData
                })
            });

            if (!response.ok) {
                throw new Error(`Apps Script error: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.data?.error || 'Failed to add task');
            }

            // Reload tasks to reflect the addition
            await this.loadFromSheet();
            */
        } catch (error) {
            console.error('Error adding task:', error);
            throw error;
        }
    }

    async updateTaskDetails(taskId, updates) {
        if (!this.useAppsScript) {
            alert('Editing task details requires Google Apps Script setup. See google-apps-script.js for instructions.');
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'updateTaskDetails',
                    taskId: taskId,
                    updates: updates
                })
            });

            if (!response.ok) {
                throw new Error(`Apps Script error: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.data?.error || 'Failed to update task');
            }

            // Refresh the data to show the updates
            await this.loadFromSheet();
            this.updateSyncStatus('✅ Task Updated');
            
        } catch (error) {
            console.error('Error updating task details:', error);
            this.showError(`Failed to update task: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async deleteTask(taskId) {
        if (!this.useAppsScript) {
            alert('Deleting tasks requires Google Apps Script setup. See google-apps-script.js for instructions.');
            return;
        }

        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (!confirm(`Are you sure you want to delete: "${task.text}"?`)) {
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await fetch(this.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'deleteTask',
                    taskId: taskId
                })
            });

            if (!response.ok) {
                throw new Error(`Apps Script error: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.data?.error || 'Failed to delete task');
            }

            // Refresh the data to show the deletion
            await this.loadFromSheet();
            this.updateSyncStatus('✅ Task Deleted');
            
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showError(`Failed to delete task: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    saveToCache() {
        try {
            const cacheData = {
                tasks: this.tasks,
                lastModified: this.lastModified,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('sheetsCache', JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    loadCachedData() {
        try {
            const cached = localStorage.getItem('sheetsCache');
            if (!cached) return false;

            const cacheData = JSON.parse(cached);
            const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
            
            // Use cache if less than 5 minutes old
            if (cacheAge < 5 * 60 * 1000) {
                this.tasks = cacheData.tasks || [];
                this.lastModified = cacheData.lastModified;
                this.renderTasks();
                this.updateProgress();
                this.updateSyncStatus('📱 Cached Data');
                return true;
            }
        } catch (error) {
            console.warn('Failed to load cached data:', error);
        }
        return false;
    }
}

// Initialize the Google Sheets checklist when DOM is loaded
if (typeof window !== 'undefined') {
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.sheetsChecklist = new GoogleSheetsChecklist();
        });
    } else {
        window.sheetsChecklist = new GoogleSheetsChecklist();
    }
}
