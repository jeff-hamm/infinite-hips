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
            refreshInterval: 60000, // 1 minute instead of 2 minutes
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
        this.currentFilter = 'incomplete'; // Default to showing incomplete tasks only
        this.init();
    }

    // Helper function to check if timeline matches "X days before" pattern
    isBeforeSurgeryTimeline(timeline) {
        if (!timeline) return false;
        // Match patterns like "7 days before", "1 day before", "14 days before", etc. (case insensitive)
        return /^\d+\s+days?\s+before/i.test(timeline.trim());
    }

    // Helper function to get the display timeline (maps "X days before" to "Before Surgery")
    getDisplayTimeline(timeline) {
        if (!timeline) return 'Other';
        if (this.isBeforeSurgeryTimeline(timeline)) {
            return 'Before Surgery';
        }
        return timeline;
    }

    // Helper function to get the filter timeline for filtering logic
    getFilterTimeline(timeline) {
        return this.getDisplayTimeline(timeline);
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
                        priority: columnMap.priority >= 0 ? 
                            (columns[columnMap.priority]?.toLowerCase().replace(/^\d+\s*-\s*/, '').trim() || 'medium') : 'medium',
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
            this.hideFilterButtons();
            return;
        }

        // Generate filter buttons based on timeline data
        this.generateFilterButtons();

        // Group tasks by timeline using display timeline
        const timelineGroups = {};
        this.tasks.forEach(task => {
            const displayTimeline = this.getDisplayTimeline(task.timeline);
            if (!timelineGroups[displayTimeline]) {
                timelineGroups[displayTimeline] = [];
            }
            timelineGroups[displayTimeline].push(task);
        });

        // Sort groups by timeline order: 'asap' first, 'Before Surgery' second, then numbers descending, then others ascending
        const sortedTimelines = Object.keys(timelineGroups).sort((a, b) => {
            // 'asap' always comes first
            if (a.toLowerCase() === 'asap') return -1;
            if (b.toLowerCase() === 'asap') return 1;
            
            // 'Before Surgery' comes second
            if (a === 'Before Surgery') return -1;
            if (b === 'Before Surgery') return 1;
            
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
            
            // Sort tasks within timeline by: 1) raw timeline, 2) priority, 3) todo text
            const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3, '': 4 };
            tasks.sort((a, b) => {
                // First sort by completion (incomplete first)
                if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                }
                
                // Then by raw timeline field (for "Before Surgery" group, this handles "7 days before", "1 day before", etc.)
                const aTimeline = a.timeline || '';
                const bTimeline = b.timeline || '';
                if (aTimeline !== bTimeline) {
                    // For timeline comparison, try to extract numbers for "X days before" patterns
                    const aMatch = aTimeline.match(/^(\d+)\s+days?\s+before/i);
                    const bMatch = bTimeline.match(/^(\d+)\s+days?\s+before/i);
                    
                    if (aMatch && bMatch) {
                        // Both are "X days before" - sort by number (ascending: 1 day, 7 days, 14 days)
                        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
                    } else if (aMatch && !bMatch) {
                        // A is "X days before", B is not - A comes first
                        return -1;
                    } else if (!aMatch && bMatch) {
                        // B is "X days before", A is not - B comes first
                        return 1;
                    } else {
                        // Neither is "X days before" - sort alphabetically
                        return aTimeline.localeCompare(bTimeline);
                    }
                }
                
                // Then by priority - clean the priority values to handle formats like "1- Critical"
                const cleanAPriority = a.priority ? 
                    a.priority.toLowerCase().replace(/^\d+\s*-\s*/, '').trim() : '';
                const cleanBPriority = b.priority ? 
                    b.priority.toLowerCase().replace(/^\d+\s*-\s*/, '').trim() : '';
                
                const aPriority = priorityOrder[cleanAPriority] ?? 4;
                const bPriority = priorityOrder[cleanBPriority] ?? 4;
                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }
                
                // Finally by todo text (alphabetically)
                const aText = a.text || '';
                const bText = b.text || '';
                return aText.localeCompare(bText);
            });

            // Add timeline group header
            html += `<div class="section timeline-group-old">`;
            html += `<h2 class="timeline-title-old">${timeline}</h2>`;

            tasks.forEach(task => {
                // Extract clean priority value from formats like "1- Critical" or "3 - Medium"
                const cleanPriority = task.priority ? 
                    task.priority.toLowerCase().replace(/^\d+\s*-\s*/, '').trim() : '';
                const priorityClass = '';
                // cleanPriority ? `priority-${cleanPriority.replace(/\s+/g, '-')}` : '';
                
                html += `<div class="todo-item ${priorityClass}" 
                           data-timeline="${this.escapeHtml(this.getDisplayTimeline(task.timeline))}"
                           data-who-can-help="${this.escapeHtml(task.whoCanHelp || '')}"
                           data-completed="${task.completed ? 'true' : 'false'}"
                           data-category="${this.escapeHtml(task.category || '')}">`;
                
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
                // Task text - clickable to edit
                let taskText = this.escapeHtml(task.text);
                
                html += `<div class="todo-text ${task.completed ? 'todo-completed' : ''}">
                    <h3 class="editable-text" data-task-id="${task.id}" data-field="text" onclick="sheetsChecklist.startEditingText(this)">${taskText}<span class="edit-icon">✏️</span></h3>
                </div>`;
                
                // Add details section for priority, timeline, category, how, notes, and whoCanHelp
                html += `<div class="task-details">`;
                    
                    // Priority detail item
                    if (task.priority) {
                        const detailPriorityIcon = cleanPriority ? {
                            'critical': '❗',
                            'high': '🔥',
                            'medium': '📌', 
                            'low': '📝'
                        }[cleanPriority] || '⚪' : '⚪';
                        html += `<div class="detail-item">
                            <span class="detail-icon">${detailPriorityIcon}</span>
                            <span class="detail-label">Priority:</span> 
                            <span class="editable-text" data-task-id="${task.id}" data-field="priority" onclick="sheetsChecklist.startEditingDropdown(this)">${this.escapeHtml(task.priority)}<span class="edit-icon">✏️</span></span>
                        </div>`;
                    } else {
                        // Show empty priority field that can be clicked to add priority
                        html += `<div class="detail-item">
                            <span class="detail-icon">⚪</span>
                            <span class="detail-label">Priority:</span> 
                            <span class="editable-text empty-field" data-task-id="${task.id}" data-field="priority" onclick="sheetsChecklist.startEditingDropdown(this)">Click to set priority...<span class="edit-icon">✏️</span></span>
                        </div>`;
                    }
                    
                    // Timeline detail item
                    if (task.timeline) {
                        html += `<div class="detail-item">
                            <span class="detail-icon">📅</span>
                            <span class="detail-label">Timeline:</span> 
                            <span class="editable-text" data-task-id="${task.id}" data-field="timeline" onclick="sheetsChecklist.startEditingDropdown(this)">${this.escapeHtml(task.timeline)}<span class="edit-icon">✏️</span></span>
                        </div>`;
                    } else {
                        // Show empty timeline field that can be clicked to add timeline
                        html += `<div class="detail-item">
                            <span class="detail-icon">📅</span>
                            <span class="detail-label">Timeline:</span> 
                            <span class="editable-text empty-field" data-task-id="${task.id}" data-field="timeline" onclick="sheetsChecklist.startEditingDropdown(this)">Click to set timeline...<span class="edit-icon">✏️</span></span>
                        </div>`;
                    }
                    
                    // Category detail item
                    if (task.category) {
                        html += `<div class="detail-item">
                            <span class="detail-icon">📂</span>
                            <span class="detail-label">Category:</span> 
                            <span class="editable-text" data-task-id="${task.id}" data-field="category" onclick="sheetsChecklist.startEditingDropdown(this)">${this.escapeHtml(task.category)}<span class="edit-icon">✏️</span></span>
                        </div>`;
                    } else {
                        // Show empty category field that can be clicked to add category
                        html += `<div class="detail-item">
                            <span class="detail-icon">📂</span>
                            <span class="detail-label">Category:</span> 
                            <span class="editable-text empty-field" data-task-id="${task.id}" data-field="category" onclick="sheetsChecklist.startEditingDropdown(this)">Click to set category...<span class="edit-icon">✏️</span></span>
                        </div>`;
                    }
                    
                    if (task.how) {
                        html += `<div class="detail-item"><span class="detail-icon">🔧</span><span class="detail-label">How:</span> <span class="detail-text-non-editable">${this.escapeHtml(task.how)}</span></div>`;
                    }
                    
                    if (task.notes) {
                        const notesContent = this.linkifyUrls(task.notes);
                        html += `<div class="detail-item">
                            <span class="detail-icon">📝</span>
                            <span class="detail-label">Notes:</span> 
                            <span class="editable-text" data-task-id="${task.id}" data-field="notes" onclick="sheetsChecklist.startEditingText(this)">${notesContent}<span class="edit-icon">✏️</span></span>
                        </div>`;
                    } else {
                        // Show empty notes field that can be clicked to add notes
                        html += `<div class="detail-item">
                            <span class="detail-icon">📝</span>
                            <span class="detail-label">Notes:</span> 
                            <span class="editable-text empty-field" data-task-id="${task.id}" data-field="notes" onclick="sheetsChecklist.startEditingText(this)">Click to add notes...<span class="edit-icon">✏️</span></span>
                        </div>`;
                    }
                    
                                        // Always show Helper field last (editable)
                    const whoCanHelpValue = task.whoCanHelp || '';
                    const displayValue = whoCanHelpValue || '';
                    html += `<div class="detail-item">
                        <span class="detail-icon">🤝</span>
                        <span class="detail-label">Helper/Dom:</span> 
                        <div class="editable-field-container">
                            <select class="editable-dropdown" data-task-id="${task.id}" data-field="whoCanHelp" onchange="sheetsChecklist.handleWhoCanHelpChange(this)">
                                <option value=""></option>
                                ${whoCanHelpValue ? `<option value="${this.escapeHtml(whoCanHelpValue)}" selected>${this.escapeHtml(whoCanHelpValue)}</option>` : ''}
                                <option value="Other">Other</option>
                            </select>
                            <input type="text" class="editable-other-input" style="display: none; margin-top: 8px;" placeholder="Enter helper/dom name..." onblur="sheetsChecklist.updateWhoCanHelpField(this)" data-task-id="${task.id}">
                        </div>
                    </div>`;
                    
                    html += `</div>`;
                
                html += `</div>`;
                html += `</div>`;
            });

            html += `</div>`; // Close timeline-group
        });

        todoList.innerHTML = html;
        
        // Apply the current filter to hide/show appropriate tasks
        this.applyFilter(this.currentFilter);
        
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

    handleTimelineChange(dropdown) {
        const taskId = dropdown.dataset.taskId;
        
        // Update the task with the selected timeline value (including empty value)
        this.updateTaskDetails(taskId, { timeline: dropdown.value });
    }

    async updateWhoCanHelpField(input) {
        const taskId = input.dataset.taskId;
        const newValue = input.value.trim();
        
        if (newValue) {
            await this.updateTaskDetails(taskId, { whoCanHelp: newValue });
        }
    }

    startEditingText(element) {
        // Prevent multiple edits at once
        if (document.querySelector('.editing-text')) {
            return;
        }

        const taskId = element.dataset.taskId;
        const field = element.dataset.field;
        const currentText = this.getOriginalText(element);
        
        // Create text input
        const input = document.createElement(field === 'notes' ? 'textarea' : 'input');
        if (field !== 'notes') {
            input.type = 'text';
        }
        input.value = currentText;
        input.className = 'editing-text';
        input.dataset.taskId = taskId;
        input.dataset.field = field;
        input.dataset.originalText = currentText;
        
        if (field === 'notes') {
            input.rows = 3;
            input.style.resize = 'vertical';
        }
        
        // Style the input
        Object.assign(input.style, {
            background: 'var(--color-bg)',
            border: '1px solid var(--color-pink)',
            borderRadius: '4px',
            padding: '8px',
            color: 'var(--color-text)',
            fontSize: field === 'text' ? '18px' : '14px',
            fontWeight: field === 'text' ? 'bold' : 'normal',
            width: '100%',
            fontFamily: 'inherit'
        });
        
        // Replace the element with input
        element.style.display = 'none';
        element.parentNode.insertBefore(input, element.nextSibling);
        
        // Focus and select all text
        input.focus();
        input.select();
        
        // Handle save/cancel
        input.addEventListener('blur', () => this.finishEditingText(input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.finishEditingText(input);
            } else if (e.key === 'Escape') {
                this.cancelEditingText(input);
            }
        });
    }

    getOriginalText(element) {
        const field = element.dataset.field;
        const taskId = element.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        
        if (!task) return '';
        
        if (field === 'text') {
            return task.text || '';
        } else if (field === 'notes') {
            // For notes, always return the raw text from the task data, not the HTML content
            return task.notes || '';
        }
        return '';
    }

    startEditingDropdown(element) {
        // Prevent multiple edits at once
        if (document.querySelector('.editing-dropdown')) {
            return;
        }

        const taskId = element.dataset.taskId;
        const field = element.dataset.field;
        const currentValue = this.getOriginalDropdownValue(element);
        
        // Create dropdown select
        const select = document.createElement('select');
        select.className = 'editing-dropdown';
        select.dataset.taskId = taskId;
        select.dataset.field = field;
        select.dataset.originalValue = currentValue;
        
        // Style the select
        Object.assign(select.style, {
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            border: '2px solid var(--color-accent)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            minWidth: '200px'
        });

        // Populate dropdown with available options
        this.populateEditingDropdown(select, field, currentValue);
        
        // Replace the element with select
        element.style.display = 'none';
        element.parentNode.insertBefore(select, element.nextSibling);
        
        // Focus the select
        select.focus();
        
        // Handle save/cancel
        select.addEventListener('blur', () => this.finishEditingDropdown(select));
        select.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.finishEditingDropdown(select);
            } else if (e.key === 'Escape') {
                this.cancelEditingDropdown(select);
            }
        });
        select.addEventListener('change', () => this.finishEditingDropdown(select));
    }

    getOriginalDropdownValue(element) {
        const field = element.dataset.field;
        const taskId = element.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        
        if (!task) return '';
        
        if (field === 'timeline') {
            return task.timeline || '';
        } else if (field === 'priority') {
            return task.priority || '';
        } else if (field === 'category') {
            return task.category || '';
        }
        return '';
    }

    populateEditingDropdown(select, field, currentValue) {
        let values = [];
        
        if (field === 'timeline') {
            // Get unique timeline values from tasks (excluding empty values and "X days before" patterns)
            values = [...new Set(
                this.tasks
                    .map(task => task.Timeline || task.timeline)
                    .filter(value => value && value.trim() !== '')
                    .map(value => value.trim())
                    .filter(value => !this.isBeforeSurgeryTimeline(value)) // Exclude "X days before" patterns
            )].sort(); // Alphabetical sorting
        } else if (field === 'priority') {
            // Get unique priority values from tasks (excluding empty values)
            values = [...new Set(
                this.tasks
                    .map(task => task.Priority || task.priority)
                    .filter(value => value && value.trim() !== '')
                    .map(value => value.trim())
            )].sort(); // Alphabetical sorting
        } else if (field === 'category') {
            // Get unique category values from tasks (excluding empty values)
            values = [...new Set(
                this.tasks
                    .map(task => task.Category || task.category)
                    .filter(value => value && value.trim() !== '')
                    .map(value => value.trim())
            )].sort(); // Alphabetical sorting
        }

        // Clear and rebuild options
        select.innerHTML = '';
        
        // Always add blank option first
        const blankOption = document.createElement('option');
        blankOption.value = '';
        blankOption.textContent = '';
        select.appendChild(blankOption);
        
        // Add current value if it exists and isn't in the values list
        if (currentValue && currentValue !== '' && !values.includes(currentValue)) {
            const currentOption = document.createElement('option');
            currentOption.value = currentValue;
            currentOption.textContent = currentValue;
            currentOption.selected = true;
            select.appendChild(currentOption);
        }
        
        // Add all other values
        values.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            if (value === currentValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    async finishEditingDropdown(select) {
        const taskId = select.dataset.taskId;
        const field = select.dataset.field;
        const newValue = select.value;
        const originalValue = select.dataset.originalValue;
        
        // Remove the select and show the original element
        const originalElement = select.previousSibling;
        select.remove();
        originalElement.style.display = '';
        
        // Only update if value changed
        if (newValue !== originalValue) {
            try {
                // Update the task data
                const updateData = {};
                updateData[field] = newValue;
                await this.updateTaskDetails(taskId, updateData);
                
                // Update the display
                this.updateElementDisplay(originalElement, newValue, field);
            } catch (error) {
                console.error('Error updating task:', error);
                // Restore original display on error
                this.updateElementDisplay(originalElement, originalValue, field);
            }
        }
    }

    cancelEditingDropdown(select) {
        // Remove the select and show the original element
        const originalElement = select.previousSibling;
        select.remove();
        originalElement.style.display = '';
    }

    updateElementDisplay(element, value, field) {
        if (field === 'timeline') {
            if (value && value.trim()) {
                element.innerHTML = `${this.escapeHtml(value)}<span class="edit-icon">✏️</span>`;
                element.classList.remove('empty-field');
            } else {
                element.innerHTML = `Click to set timeline...<span class="edit-icon">✏️</span>`;
                element.classList.add('empty-field');
            }
        } else if (field === 'priority') {
            if (value && value.trim()) {
                element.innerHTML = `${this.escapeHtml(value)}<span class="edit-icon">✏️</span>`;
                element.classList.remove('empty-field');
                // Update the icon in the parent detail-item
                const detailItem = element.closest('.detail-item');
                const iconSpan = detailItem.querySelector('.detail-icon');
                if (iconSpan) {
                    const cleanPriority = value.toLowerCase().replace(/^\d+\s*-?\s*/, '').trim();
                    const priorityIcon = {
                        'critical': '❗',
                        'high': '🔥',
                        'medium': '📌', 
                        'low': '📝'
                    }[cleanPriority] || '⚪';
                    iconSpan.textContent = priorityIcon;
                }
            } else {
                element.innerHTML = `Click to set priority...<span class="edit-icon">✏️</span>`;
                element.classList.add('empty-field');
                // Reset icon to default
                const detailItem = element.closest('.detail-item');
                const iconSpan = detailItem.querySelector('.detail-icon');
                if (iconSpan) {
                    iconSpan.textContent = '⚪';
                }
            }
        } else if (field === 'category') {
            if (value && value.trim()) {
                element.innerHTML = `${this.escapeHtml(value)}<span class="edit-icon">✏️</span>`;
                element.classList.remove('empty-field');
            } else {
                element.innerHTML = `Click to set category...<span class="edit-icon">✏️</span>`;
                element.classList.add('empty-field');
            }
        }
    }

    async finishEditingText(input) {
        const taskId = input.dataset.taskId;
        const field = input.dataset.field;
        const newValue = input.value.trim();
        const originalText = input.dataset.originalText;
        
        // Get the original element
        const originalElement = input.previousElementSibling;
        
        if (newValue !== originalText) {
            try {
                // Update the task
                const updateData = {};
                updateData[field] = newValue;
                await this.updateTaskDetails(taskId, updateData);
                
                // Update the display immediately for better UX
                if (field === 'text') {
                    // For text field, preserve the edit icon
                    originalElement.innerHTML = this.escapeHtml(newValue) + '<span class="edit-icon">✏️</span>';
                } else if (field === 'notes') {
                    if (newValue) {
                        originalElement.innerHTML = this.linkifyUrls(newValue) + '<span class="edit-icon">✏️</span>';
                        originalElement.classList.remove('empty-field');
                    } else {
                        originalElement.innerHTML = 'Click to add notes...<span class="edit-icon">✏️</span>';
                        originalElement.classList.add('empty-field');
                    }
                }
                
            } catch (error) {
                console.error('Error updating text:', error);
                this.showError(`Failed to update ${field}: ${error.message}`);
            }
        }
        
        // Clean up
        this.cleanupTextEdit(input, originalElement);
    }

    cancelEditingText(input) {
        const originalElement = input.previousElementSibling;
        this.cleanupTextEdit(input, originalElement);
    }

    cleanupTextEdit(input, originalElement) {
        originalElement.style.display = '';
        input.remove();
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
        
        // Replace URLs with anchor tags showing only hostname
        return escapedText.replace(urlRegex, (match, url) => {
            try {
                const hostname = new URL(url).hostname.replace(/^www\./, '');
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-pink); text-decoration: underline;">${hostname}</a>`;
            } catch (e) {
                // Fallback to full URL if URL parsing fails
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--color-pink); text-decoration: underline;">${url}</a>`;
            }
        });
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
        const whoCanHelpDropdowns = document.querySelectorAll('.editable-dropdown[data-field="whoCanHelp"]');
        const timelineDropdowns = document.querySelectorAll('.editable-dropdown[data-field="timeline"]');
        
        // Get unique who-can-help values from tasks (excluding empty values)
        const whoCanHelpValues = [...new Set(
            this.tasks
                .map(task => task['Who Can Help'] || task.whoCanHelp)
                .filter(value => value && value.trim() !== '')
                .map(value => value.trim())
        )].sort(); // Alphabetical sorting

        // Get unique timeline values from tasks (excluding empty values)
        const timelineValues = [...new Set(
            this.tasks
                .map(task => task.Timeline || task.timeline)
                .filter(value => value && value.trim() !== '')
                .map(value => value.trim())
        )].sort(); // Alphabetical sorting
        
        // Populate whoCanHelp dropdowns
        whoCanHelpDropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            
            // Clear all options and rebuild
            dropdown.innerHTML = '';
            
            // Always add blank option first
            const blankOption = document.createElement('option');
            blankOption.value = '';
            blankOption.textContent = '';
            dropdown.appendChild(blankOption);
            
            // Add current value if it exists and isn't in the values list
            if (currentValue && currentValue !== '' && currentValue !== 'Other' && !whoCanHelpValues.includes(currentValue)) {
                const currentOption = document.createElement('option');
                currentOption.value = currentValue;
                currentOption.textContent = currentValue;
                currentOption.selected = true;
                dropdown.appendChild(currentOption);
            }
            
            // Add all other values
            whoCanHelpValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                if (value === currentValue) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });
            
            // Always add "Other" option at the end
            const otherOption = document.createElement('option');
            otherOption.value = 'Other';
            otherOption.textContent = 'Other';
            dropdown.appendChild(otherOption);
        });

        // Populate timeline dropdowns (no "Other" option as requested)
        timelineDropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            
            // Clear all options and rebuild
            dropdown.innerHTML = '';
            
            // Always add blank option first
            const blankOption = document.createElement('option');
            blankOption.value = '';
            blankOption.textContent = '';
            dropdown.appendChild(blankOption);
            
            // Add current value if it exists and isn't in the values list
            if (currentValue && currentValue !== '' && !timelineValues.includes(currentValue)) {
                const currentOption = document.createElement('option');
                currentOption.value = currentValue;
                currentOption.textContent = currentValue;
                currentOption.selected = true;
                dropdown.appendChild(currentOption);
            }
            
            // Add all other values
            timelineValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                if (value === currentValue) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
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
                // Refresh to show the new task (reduced frequency)
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
            
            // Use GET request to avoid CORS preflight issues
            const params = new URLSearchParams({
                action: 'updateTaskDetails',
                taskId: taskId,
                updates: JSON.stringify(updates)
            });
            
            const response = await fetch(`${this.appsScriptUrl}?${params.toString()}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Apps Script error: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.data?.error || 'Failed to update task');
            }

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

    // Filter functionality
    generateFilterButtons() {
        const filterContainer = document.getElementById('filter-buttons');
        if (!filterContainer) return;

        // Get unique timeline values from tasks, using display timeline instead of raw timeline
        const timelineValues = [...new Set(this.tasks.map(task => this.getDisplayTimeline(task.timeline)))];
        
        // Sort timeline values similar to how they're displayed
        const sortedTimelines = timelineValues.sort((a, b) => {
            // 'asap' always comes first
            if (a.toLowerCase() === 'asap') return -1;
            if (b.toLowerCase() === 'asap') return 1;
            
            // 'Before Surgery' comes next
            if (a === 'Before Surgery') return -1;
            if (b === 'Before Surgery') return 1;
            
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

        // Generate filter buttons HTML
        let buttonsHtml = '<button class="filter-btn" data-filter="all">All Tasks</button>';
        
        sortedTimelines.forEach(timeline => {
            const safeTimeline = timeline.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            buttonsHtml += `<button class="filter-btn" data-filter="${safeTimeline}">${timeline}</button>`;
        });

        // Add category-based filters
        buttonsHtml += '<button class="filter-btn" data-filter="support-needed">Support Needed</button>';
        buttonsHtml += '<button class="filter-btn" data-filter="completed">Completed</button>';
        buttonsHtml += '<button class="filter-btn active" data-filter="incomplete">Incomplete</button>';

        filterContainer.innerHTML = buttonsHtml;
        filterContainer.style.display = 'flex';

        // Add event listeners to filter buttons
        filterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                this.handleFilterClick(e.target);
            }
        });
    }

    handleFilterClick(button) {
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update current filter state
        this.currentFilter = button.dataset.filter;

        // Apply filter
        this.applyFilter(this.currentFilter);
    }

    applyFilter(filterType) {
        const todoItems = document.querySelectorAll('.todo-item');
        const timelineGroups = document.querySelectorAll('.timeline-group-old');

        // Show all items initially
        todoItems.forEach(item => {
            item.style.display = '';
        });

        timelineGroups.forEach(group => {
            group.style.display = '';
        });

        if (filterType === 'all') {
            return; // Show all items
        }

        // Apply specific filters
        todoItems.forEach(item => {
            let show = false;
            const rawTimeline = item.dataset.timeline || 'Other';
            const timeline = this.getDisplayTimeline(rawTimeline);
            const safeTimeline = timeline.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const whoCanHelp = item.dataset.whoCanHelp || '';
            const completed = item.dataset.completed === 'true';

            switch (filterType) {
                case 'support-needed':
                    show = whoCanHelp.length == 0;
                    break;
                case 'completed':
                    show = completed;
                    break;
                case 'incomplete':
                    show = !completed;
                    break;
                default:
                    // Timeline-based filter
                    show = safeTimeline === filterType;
                    break;
            }

            if (!show) {
                item.style.display = 'none';
            }
        });

        // Hide empty timeline groups
        timelineGroups.forEach(group => {
            const visibleItems = group.querySelectorAll('.todo-item:not([style*="display: none"])');
            if (visibleItems.length === 0) {
                group.style.display = 'none';
            }
        });
    }

    hideFilterButtons() {
        const filterContainer = document.getElementById('filter-buttons');
        if (filterContainer) {
            filterContainer.style.display = 'none';
        }
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
