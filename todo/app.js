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
            appsScriptUrl: 'https://script.google.com/macros/s/AKfycbycobzIubmEzjq0_PhqA34reM4eVnZiFxSpiz9CnLSma48azXvZb5ICpa4N2id2Uyg/exec',
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
        this.currentFilter = 'all'; // Always default to 'all' on page refresh
        this.init();
    }

    getSavedFilter() {
        try {
            return localStorage.getItem('checklist-current-filter');
        } catch (error) {
            console.error('Error loading saved filter:', error);
            return null;
        }
    }

    // Helper functions for multi-value 'who can help' field
    parseWhoCanHelp(whoCanHelpStr) {
        if (!whoCanHelpStr || !whoCanHelpStr.trim()) return [];
        // Split by comma or multiple whitespace, filter out empty strings, and trim each value
        return whoCanHelpStr.split(/[,\s]+/).filter(value => value.trim() !== '').map(value => value.trim());
    }

    formatWhoCanHelp(valuesArray) {
        if (!valuesArray || valuesArray.length === 0) return '';
        return valuesArray.filter(value => value && value.trim() !== '').join(', ');
    }

    saveCurrentFilter() {
        try {
            localStorage.setItem('checklist-current-filter', this.currentFilter);
        } catch (error) {
            console.error('Error saving current filter:', error);
        }
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
        document.getElementById('add-item-btn').addEventListener('click', () => this.toggleAddTaskForm());
        document.getElementById('cancel-add-btn').addEventListener('click', () => this.hideAddTaskForm());
        document.getElementById('new-task-form').addEventListener('submit', (e) => this.handleAddTask(e));
        
        // Handle "Other" option dropdowns
        document.getElementById('task-timeline').addEventListener('change', (e) => this.handleOtherOption(e, 'task-timeline-other'));
        document.getElementById('task-category').addEventListener('change', (e) => this.handleOtherOption(e, 'task-category-other'));
        document.getElementById('task-who-can-help').addEventListener('change', (e) => this.handleOtherOption(e, 'task-who-can-help-other'));
        document.getElementById('task-how').addEventListener('change', (e) => this.handleOtherOption(e, 'task-how-other'));

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
                        // Both are "X days before" - sort by number (descending: 14 days, 7 days, 1 day)
                        return parseInt(bMatch[1]) - parseInt(aMatch[1]);
                    } else if (aMatch && !bMatch) {
                        // A is "X days before", B is not - B (alpha) comes first
                        return 1;
                    } else if (!aMatch && bMatch) {
                        // B is "X days before", A is not - A (alpha) comes first
                        return -1;
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
                           data-how="${this.escapeHtml(task.how || '')}"
                           data-completed="${task.completed ? 'true' : 'false'}"
                           data-category="${this.escapeHtml(task.category || '')}">`;
                
                // Add simple category value in top right corner (no label)
                let topRightItems = [];
                
                // Category value with icon
                if (task.category) {
                    topRightItems.push(`<span class="editable-text top-right-value" data-task-id="${task.id}" data-field="category" onclick="sheetsChecklist.startEditingDropdown(this)">📂 ${this.escapeHtml(task.category)}<span class="edit-icon">✏️</span></span>`);
                }
                
                if (topRightItems.length > 0) {
                    html += `<div class="priority-corner-section">${topRightItems.join('<br>')}</div>`;
                }
                
                // Create the main content area with new structure
                html += `<div class="todo-main-content">`;
                
                // Todo text row spans full width and contains left + right columns
                html += `<div class="todo-text-row">`;
                
                // Left column with checkbox (inside todo-text-row)
                html += `<div class="todo-left-column">`;
                html += `<input type="checkbox" class="todo-checkbox" ${task.completed ? 'checked' : ''} 
                           onchange="sheetsChecklist.updateTaskInSheet('${task.id}', this.checked)"
                           title="Click to edit this task in Google Sheets">`;
                html += `</div>`;
                
                // Right column for todo text + priority (inside todo-text-row)
                html += `<div class="todo-right-column">`;
                
                // Task text - clickable to edit
                let taskText = this.escapeHtml(task.text);
                html += `<div class="todo-text ${task.completed ? 'todo-completed' : ''}">
                    <h3 class="editable-text" data-task-id="${task.id}" data-field="text" onclick="sheetsChecklist.startEditingText(this)">${taskText}<span class="edit-icon">✏️</span></h3>
                </div>`;
                
                // Priority icon/text on the right side of the text
                const priorityIcon = cleanPriority ? {
                    'critical': '❗',
                    'high': '🔥',
                    'medium': '📌', 
                    'low': '📝'
                }[cleanPriority] || '⚪' : '⚪';
                
                html += `<div class="priority-right-section" data-task-id="${task.id}" data-field="priority" onclick="sheetsChecklist.startEditingDropdown(this)" title="Click to change priority">`;
                html += `<div class="priority-top-icon">${priorityIcon}</div>`;
                
                // Add priority text label under the icon
                if (cleanPriority) {
                    html += `<div class="priority-text-label">${cleanPriority}</div>`;
                } else {
                    // Show placeholder for empty priority
                    html += `<div class="priority-text-label empty-field">set</div>`;
                }
                html += `</div>`; // Close priority-right-section
                
                html += `</div>`; // Close todo-right-column
                html += `</div>`; // Close todo-text-row
                
                // Add details section with same layout structure
                html += `<div class="task-details">`;
                html += `<div class="todo-left-column-spacer"></div>`; // Empty spacer to maintain alignment
                html += `<div class="task-details-content">`;
                    
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
                    
                    if (task.how) {
                        html += `<div class="detail-item">
                            <span class="detail-icon">🔧</span>
                            <span class="detail-label">How:</span> 
                            <span class="editable-text" data-task-id="${task.id}" data-field="how" onclick="sheetsChecklist.startEditingDropdown(this)">${this.escapeHtml(task.how)}<span class="edit-icon">✏️</span></span>
                        </div>`;
                    } else {
                        // Show empty how field that can be clicked to add how
                        html += `<div class="detail-item">
                            <span class="detail-icon">🔧</span>
                            <span class="detail-label">How:</span> 
                            <span class="editable-text empty-field" data-task-id="${task.id}" data-field="how" onclick="sheetsChecklist.startEditingDropdown(this)">Click to set how...<span class="edit-icon">✏️</span></span>
                        </div>`;
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
                    
                                        // Always show Helper field last (editable with multiple values)
                    const whoCanHelpValue = task.whoCanHelp || '';
                    const helpers = this.parseWhoCanHelp(whoCanHelpValue);
                    
                    html += `<div class="detail-item">
                        <span class="detail-icon">🤝</span>
                        <span class="detail-label">Helper/Dom:</span> 
                        <div class="helper-dropdowns-container" data-task-id="${task.id}">`;
                    
                    // Add dropdown for each existing helper
                    helpers.forEach((helper, index) => {
                        html += `
                            <select class="editable-dropdown helper-dropdown" data-task-id="${task.id}" data-helper-index="${index}" onchange="sheetsChecklist.handleHelperDropdownChange(this)">
                                <option value=""></option>
                                <option value="${this.escapeHtml(helper)}" selected>${this.escapeHtml(helper)}</option>
                                <option value="Other">Other</option>
                            </select>`;
                    });
                    
                    // Always add one blank dropdown for new entries
                    html += `
                        <select class="editable-dropdown helper-dropdown blank-helper-dropdown" data-task-id="${task.id}" data-helper-index="${helpers.length}" onchange="sheetsChecklist.handleHelperDropdownChange(this)">
                            <option value="" selected></option>
                            <option value="Other">Other</option>
                        </select>`;
                    
                    html += `
                            <input type="text" class="editable-other-input" style="display: none; margin-top: 8px;" placeholder="Enter helper/dom name..." onblur="sheetsChecklist.updateHelperField(this)" data-task-id="${task.id}">
                        </div>
                    </div>`;
                    
                    html += `</div>`; // Close task-details
                
                html += `</div>`; // Close todo-right-column
                html += `</div>`; // Close todo-main-content
                html += `</div>`; // Close todo-item
            });

            html += `</div>`; // Close timeline-group
        });

        todoList.innerHTML = html;
        
        // Apply the current filter to hide/show appropriate tasks
        this.applyFilter(this.currentFilter);
        
        // Preserve form data if Add Task form is visible, update form dropdowns, then restore form data
        const addTaskForm = document.getElementById('add-task-form');
        const formIsVisible = addTaskForm && addTaskForm.style.display !== 'none';
        let preservedFormData = null;
        
        if (formIsVisible) {
            preservedFormData = this.preserveFormData();
        }
        
        // Update form dropdowns with current data
        this.populateFormDropdowns();
        
        if (formIsVisible && preservedFormData) {
            this.restoreFormData(preservedFormData);
        }
        
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

    handleHelperDropdownChange(dropdown) {
        const container = dropdown.closest('.helper-dropdowns-container');
        const otherInput = container.querySelector('.editable-other-input');
        const taskId = dropdown.dataset.taskId;
        const helperIndex = parseInt(dropdown.dataset.helperIndex);
        
        if (dropdown.value === 'Other') {
            // Show the "Other" input field
            otherInput.style.display = 'block';
            otherInput.dataset.helperIndex = helperIndex;
            otherInput.focus();
        } else {
            // Hide the "Other" input field
            otherInput.style.display = 'none';
            otherInput.value = '';
            
            // Update the helpers array
            this.updateHelpersArray(taskId, helperIndex, dropdown.value);
        }
    }

    async updateHelperField(input) {
        const taskId = input.dataset.taskId;
        const helperIndex = parseInt(input.dataset.helperIndex);
        const newValue = input.value.trim();
        
        if (newValue) {
            await this.updateHelpersArray(taskId, helperIndex, newValue);
        }
        
        // Hide the input field
        input.style.display = 'none';
        input.value = '';
    }

    async updateHelpersArray(taskId, helperIndex, newValue) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        // Get current helpers array
        const helpers = this.parseWhoCanHelp(task.whoCanHelp || '');
        
        if (newValue && newValue.trim() !== '') {
            // Set the value at the specified index
            helpers[helperIndex] = newValue.trim();
        } else {
            // Remove the helper at this index if value is empty
            if (helperIndex < helpers.length) {
                helpers.splice(helperIndex, 1);
            }
        }
        
        // Format back to string and update
        const formattedValue = this.formatWhoCanHelp(helpers);
        await this.updateTaskDetails(taskId, { whoCanHelp: formattedValue });
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
        
        // Add a unique ID to the element for better tracking
        const elementId = `edit-${taskId}-${field}-${Date.now()}`;
        element.dataset.elementId = elementId;
        
        // Create dropdown select
        const select = document.createElement('select');
        select.className = 'editing-dropdown';
        select.dataset.taskId = taskId;
        select.dataset.field = field;
        select.dataset.originalValue = currentValue;
        select.dataset.originalElementId = elementId;
        
        // Style the select
        const baseStyle = {
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            border: '2px solid var(--color-accent)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: 'inherit',
            fontFamily: 'inherit'
        };
        
        // Set width based on field type
        if (field === 'priority') {
            baseStyle.minWidth = '100px';
            baseStyle.width = 'auto';
        } else {
            baseStyle.minWidth = '200px';
        }
        
        Object.assign(select.style, baseStyle);

        // Populate dropdown with available options
        this.populateEditingDropdown(select, field, currentValue);
        
        // Replace the element with select
        element.style.display = 'none';
        element.parentNode.insertBefore(select, element.nextSibling);
        
        // Focus the select
        select.focus();
        
        // Handle save/cancel with proper event management
        let isFinishing = false;
        
        const finishEdit = () => {
            if (!isFinishing) {
                isFinishing = true;
                this.finishEditingDropdown(select);
            }
        };
        
        const cancelEdit = () => {
            if (!isFinishing) {
                isFinishing = true;
                this.cancelEditingDropdown(select);
            }
        };
        
        select.addEventListener('blur', finishEdit);
        select.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
        select.addEventListener('change', finishEdit);
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
        } else if (field === 'how') {
            return task.how || '';
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
        } else if (field === 'how') {
            // Get unique how values from tasks (excluding empty values)
            values = [...new Set(
                this.tasks
                    .map(task => task.How || task.how)
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
        // Prevent duplicate processing
        if (select.dataset.processing === 'true') {
            return;
        }
        select.dataset.processing = 'true';
        
        const taskId = select.dataset.taskId;
        const field = select.dataset.field;
        const newValue = select.value;
        const originalValue = select.dataset.originalValue;
        
        // Find the original element more robustly
        const originalElement = select.dataset.originalElementId ? 
            document.querySelector(`[data-element-id="${select.dataset.originalElementId}"]`) :
            select.previousSibling;
        
        // Safely remove the select only if it's still in the DOM
        if (select.parentNode) {
            try {
                select.remove();
            } catch (error) {
                console.warn('Error removing select element:', error);
            }
        }
        
        // Show the original element
        if (originalElement) {
            originalElement.style.display = '';
        }
        
        // Only update if value changed
        if (newValue !== originalValue) {
            // OPTIMISTIC UPDATE: Update the UI immediately
            if (originalElement) {
                this.updateElementDisplay(originalElement, newValue, field);
            }
            
            // Also update the local task data immediately
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task[field] = newValue;
            }
            
            // Then send the server request in the background
            try {
                const updateData = {};
                updateData[field] = newValue;
                await this.updateTaskDetails(taskId, updateData);
                // If successful, the UI is already updated so nothing to do
                console.log(`Successfully updated ${field} to "${newValue}" for task ${taskId}`);
            } catch (error) {
                console.error('Error updating task:', error);
                // ROLLBACK: Restore original value on error
                this.updateElementDisplay(originalElement, originalValue, field);
                
                // Also rollback the local task data
                if (task) {
                    task[field] = originalValue;
                }
                
                // Show error message to user
                this.showError(`Failed to update ${field}: ${error.message}`);
            }
        }
    }

    cancelEditingDropdown(select) {
        // Prevent duplicate processing
        if (select.dataset.processing === 'true') {
            return;
        }
        select.dataset.processing = 'true';
        
        // Find the original element more robustly
        const originalElement = select.dataset.originalElementId ? 
            document.querySelector(`[data-element-id="${select.dataset.originalElementId}"]`) :
            select.previousSibling;
        
        // Safely remove the select only if it's still in the DOM
        if (select.parentNode) {
            try {
                select.remove();
            } catch (error) {
                console.warn('Error removing select element:', error);
            }
        }
        
        // Show the original element
        if (originalElement) {
            originalElement.style.display = '';
        }
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
            // For priority, we need to update both the text and the icon
            const cleanPriority = value ? value.toLowerCase().replace(/^\d+\s*-?\s*/, '').trim() : '';
            
            if (cleanPriority) {
                // Update the priority text
                const priorityTextLabel = element.querySelector('.priority-text-label');
                if (priorityTextLabel) {
                    priorityTextLabel.textContent = cleanPriority;
                    priorityTextLabel.classList.remove('empty-field');
                }
                
                // Update the priority icon
                const priorityIcon = {
                    'critical': '❗',
                    'high': '🔥',
                    'medium': '📌', 
                    'low': '📝'
                }[cleanPriority] || '⚪';
                
                const priorityTopIcon = element.querySelector('.priority-top-icon');
                if (priorityTopIcon) {
                    priorityTopIcon.textContent = priorityIcon;
                }
                
                element.classList.remove('empty-field');
            } else {
                // Reset to empty state
                const priorityTextLabel = element.querySelector('.priority-text-label');
                if (priorityTextLabel) {
                    priorityTextLabel.textContent = 'set';
                    priorityTextLabel.classList.add('empty-field');
                }
                
                const priorityTopIcon = element.querySelector('.priority-top-icon');
                if (priorityTopIcon) {
                    priorityTopIcon.textContent = '⚪';
                }
                
                element.classList.add('empty-field');
            }
        } else if (field === 'category') {
            if (value && value.trim()) {
                element.innerHTML = `${this.escapeHtml(value)}<span class="edit-icon">✏️</span>`;
                element.classList.remove('empty-field');
            } else {
                element.innerHTML = `Click to set category...<span class="edit-icon">✏️</span>`;
                element.classList.add('empty-field');
            }
        } else if (field === 'how') {
            if (value && value.trim()) {
                element.innerHTML = `${this.escapeHtml(value)}<span class="edit-icon">✏️</span>`;
                element.classList.remove('empty-field');
            } else {
                element.innerHTML = `Click to set how...<span class="edit-icon">✏️</span>`;
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
            // OPTIMISTIC UPDATE: Update the UI immediately
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
            
            // Also update the local task data immediately
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task[field] = newValue;
            }
            
            // Clean up the input first so user sees the change immediately
            this.cleanupTextEdit(input, originalElement);
            
            // Then send the server request in the background
            try {
                const updateData = {};
                updateData[field] = newValue;
                await this.updateTaskDetails(taskId, updateData);
                // If successful, the UI is already updated so nothing to do
                console.log(`Successfully updated ${field} to "${newValue}" for task ${taskId}`);
            } catch (error) {
                console.error('Error updating text:', error);
                
                // ROLLBACK: Restore original value on error
                if (field === 'text') {
                    originalElement.innerHTML = this.escapeHtml(originalText) + '<span class="edit-icon">✏️</span>';
                } else if (field === 'notes') {
                    if (originalText) {
                        originalElement.innerHTML = this.linkifyUrls(originalText) + '<span class="edit-icon">✏️</span>';
                        originalElement.classList.remove('empty-field');
                    } else {
                        originalElement.innerHTML = 'Click to add notes...<span class="edit-icon">✏️</span>';
                        originalElement.classList.add('empty-field');
                    }
                }
                
                // Also rollback the local task data
                if (task) {
                    task[field] = originalText;
                }
                
                // Show error message to user
                this.showError(`Failed to update ${field}: ${error.message}`);
            }
        } else {
            // No change, just clean up
            this.cleanupTextEdit(input, originalElement);
        }
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
    toggleAddTaskForm() {
        const addTaskForm = document.getElementById('add-task-form');
        
        // Check if form is currently visible
        if (addTaskForm.style.display === 'block') {
            // Form is open, close it
            this.hideAddTaskForm();
        } else {
            // Form is closed, open it
            this.populateFormDropdowns();
            addTaskForm.style.display = 'block';
            
            // Set default priority
            document.getElementById('task-priority').value = '3 - Medium';
            
            // Pre-populate timeline if a timeline filter is currently selected
            this.prePopulateTimelineFromFilter();
            
            // Pre-populate How field if a specific filter is selected
            this.prePopulateHowFromFilter();
            
            document.getElementById('task-text').focus();
        }
    }

    prePopulateTimelineFromFilter() {
        const timelineSelect = document.getElementById('task-timeline');
        if (!timelineSelect || !this.currentFilter) return;
        
        // Special filters shouldn't pre-populate the timeline
        if (this.currentFilter === 'all' || this.currentFilter === 'support-needed' || this.currentFilter === 'dom-needed' || this.currentFilter === 'team-needed' || this.currentFilter === 'help-offered') {
            return;
        }
        
        // Find the corresponding timeline value for the current filter
        // We need to find a task that matches the current filter to get the raw timeline value
        const matchingTask = this.tasks.find(task => {
            const displayTimeline = this.getDisplayTimeline(task.timeline);
            const safeTimeline = displayTimeline.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            return safeTimeline === this.currentFilter;
        });
        
        if (matchingTask && matchingTask.timeline) {
            // Check if this timeline value is available in the dropdown
            const matchingOption = Array.from(timelineSelect.options).find(option => 
                option.value === matchingTask.timeline
            );
            
            if (matchingOption) {
                timelineSelect.value = matchingTask.timeline;
            }
        }
    }

    prePopulateHowFromFilter() {
        const howSelect = document.getElementById('task-how');
        if (!howSelect || !this.currentFilter) return;
        
        // Pre-populate How field based on specific filters
        if (this.currentFilter === 'support-needed') {
            // Set How field to 'Help Needed'
            howSelect.value = 'Help Needed';
        } else if (this.currentFilter === 'team-needed') {
            // Set How field to 'Team Needed'
            howSelect.value = 'Team Needed';
        }
    }

    populateDetailDropdowns() {
        // Get all editable dropdowns in the detail view
        const helperDropdowns = document.querySelectorAll('.helper-dropdown');
        const timelineDropdowns = document.querySelectorAll('.editable-dropdown[data-field="timeline"]');
        
        // Get unique who-can-help values from all tasks, split by comma/whitespace
        const allHelperValues = [];
        this.tasks.forEach(task => {
            const helpers = this.parseWhoCanHelp(task.whoCanHelp || '');
            allHelperValues.push(...helpers);
        });
        const whoCanHelpValues = [...new Set(allHelperValues)].sort(); // Alphabetical sorting

        // Get unique timeline values from tasks (excluding empty values)
        const timelineValues = [...new Set(
            this.tasks
                .map(task => task.Timeline || task.timeline)
                .filter(value => value && value.trim() !== '')
                .map(value => value.trim())
        )].sort(); // Alphabetical sorting
        
        // Populate helper dropdowns
        helperDropdowns.forEach(dropdown => {
            const currentValue = dropdown.value;
            const isBlankDropdown = dropdown.classList.contains('blank-helper-dropdown') || dropdown.querySelector('option[value=""]')?.hasAttribute('selected');
            
            // Clear all options and rebuild
            dropdown.innerHTML = '';
            
            // Add appropriate blank option
            const blankOption = document.createElement('option');
            blankOption.value = '';
            if (isBlankDropdown) {
                blankOption.textContent = '';
                blankOption.selected = true;
            } else {
                blankOption.textContent = '';
            }
            dropdown.appendChild(blankOption);
            
            // Add current value if it exists and isn't in the values list
            if (currentValue && currentValue !== '' && currentValue !== 'Other' && !whoCanHelpValues.includes(currentValue)) {
                const currentOption = document.createElement('option');
                currentOption.value = currentValue;
                currentOption.textContent = currentValue;
                if (!isBlankDropdown) {
                    currentOption.selected = true;
                }
                dropdown.appendChild(currentOption);
            }
            
            // Add all other values
            whoCanHelpValues.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                if (!isBlankDropdown && value === currentValue) {
                    option.selected = true;
                }
                dropdown.appendChild(option);
            });
            
            // Always add "Other" option at the end
            const otherOption = document.createElement('option');
            otherOption.value = 'Other';
            otherOption.textContent = 'Other';
            if (!isBlankDropdown && currentValue === 'Other') {
                otherOption.selected = true;
            }
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

    preserveFormData() {
        // Preserve current form values before repopulating dropdowns
        const formData = {};
        
        const taskText = document.getElementById('task-text');
        const taskTimeline = document.getElementById('task-timeline');
        const taskTimelineOther = document.getElementById('task-timeline-other');
        const taskPriority = document.getElementById('task-priority');
        const taskCategory = document.getElementById('task-category');
        const taskCategoryOther = document.getElementById('task-category-other');
        const taskWhoCanHelp = document.getElementById('task-who-can-help');
        const taskWhoCanHelpOther = document.getElementById('task-who-can-help-other');
        const taskHow = document.getElementById('task-how');
        const taskHowOther = document.getElementById('task-how-other');
        const taskNotes = document.getElementById('task-notes');
        
        if (taskText) formData.taskText = taskText.value;
        if (taskTimeline) formData.taskTimeline = taskTimeline.value;
        if (taskTimelineOther) {
            formData.taskTimelineOther = taskTimelineOther.value;
            formData.taskTimelineOtherVisible = taskTimelineOther.style.display !== 'none';
        }
        if (taskPriority) formData.taskPriority = taskPriority.value;
        if (taskCategory) formData.taskCategory = taskCategory.value;
        if (taskCategoryOther) {
            formData.taskCategoryOther = taskCategoryOther.value;
            formData.taskCategoryOtherVisible = taskCategoryOther.style.display !== 'none';
        }
        if (taskWhoCanHelp) formData.taskWhoCanHelp = taskWhoCanHelp.value;
        if (taskWhoCanHelpOther) {
            formData.taskWhoCanHelpOther = taskWhoCanHelpOther.value;
            formData.taskWhoCanHelpOtherVisible = taskWhoCanHelpOther.style.display !== 'none';
        }
        if (taskHow) formData.taskHow = taskHow.value;
        if (taskHowOther) {
            formData.taskHowOther = taskHowOther.value;
            formData.taskHowOtherVisible = taskHowOther.style.display !== 'none';
        }
        if (taskNotes) formData.taskNotes = taskNotes.value;
        
        return formData;
    }

    restoreFormData(formData) {
        // Restore preserved form values after repopulating dropdowns
        if (!formData) return;
        
        const taskText = document.getElementById('task-text');
        const taskTimeline = document.getElementById('task-timeline');
        const taskTimelineOther = document.getElementById('task-timeline-other');
        const taskPriority = document.getElementById('task-priority');
        const taskCategory = document.getElementById('task-category');
        const taskCategoryOther = document.getElementById('task-category-other');
        const taskWhoCanHelp = document.getElementById('task-who-can-help');
        const taskWhoCanHelpOther = document.getElementById('task-who-can-help-other');
        const taskHow = document.getElementById('task-how');
        const taskHowOther = document.getElementById('task-how-other');
        const taskNotes = document.getElementById('task-notes');
        
        if (taskText && formData.taskText !== undefined) taskText.value = formData.taskText;
        if (taskTimeline && formData.taskTimeline !== undefined) taskTimeline.value = formData.taskTimeline;
        if (taskTimelineOther && formData.taskTimelineOther !== undefined) {
            taskTimelineOther.value = formData.taskTimelineOther;
            if (formData.taskTimelineOtherVisible !== undefined) {
                taskTimelineOther.style.display = formData.taskTimelineOtherVisible ? 'block' : 'none';
            }
        }
        if (taskPriority && formData.taskPriority !== undefined) taskPriority.value = formData.taskPriority;
        if (taskCategory && formData.taskCategory !== undefined) taskCategory.value = formData.taskCategory;
        if (taskCategoryOther && formData.taskCategoryOther !== undefined) {
            taskCategoryOther.value = formData.taskCategoryOther;
            if (formData.taskCategoryOtherVisible !== undefined) {
                taskCategoryOther.style.display = formData.taskCategoryOtherVisible ? 'block' : 'none';
            }
        }
        if (taskWhoCanHelp && formData.taskWhoCanHelp !== undefined) taskWhoCanHelp.value = formData.taskWhoCanHelp;
        if (taskWhoCanHelpOther && formData.taskWhoCanHelpOther !== undefined) {
            taskWhoCanHelpOther.value = formData.taskWhoCanHelpOther;
            if (formData.taskWhoCanHelpOtherVisible !== undefined) {
                taskWhoCanHelpOther.style.display = formData.taskWhoCanHelpOtherVisible ? 'block' : 'none';
            }
        }
        if (taskHow && formData.taskHow !== undefined) taskHow.value = formData.taskHow;
        if (taskHowOther && formData.taskHowOther !== undefined) {
            taskHowOther.value = formData.taskHowOther;
            if (formData.taskHowOtherVisible !== undefined) {
                taskHowOther.style.display = formData.taskHowOtherVisible ? 'block' : 'none';
            }
        }
        if (taskNotes && formData.taskNotes !== undefined) taskNotes.value = formData.taskNotes;
    }

    populateFormDropdowns() {
        this.populateTimelineDropdown();
        this.populateCategoryDropdown();
        this.populateWhoCanHelpDropdown();
        this.populateHowDropdown();
    }

    populateTimelineDropdown() {
        const timelineSelect = document.getElementById('task-timeline');
        if (!timelineSelect) {
            console.error('task-timeline element not found');
            return;
        }
        
        // Get unique timeline values, excluding "X days before" patterns from the dropdown
        const uniqueTimelines = [...new Set(
            this.tasks
                .map(task => task.timeline)
                .filter(timeline => timeline && timeline.trim())
                .filter(timeline => !this.isBeforeSurgeryTimeline(timeline)) // Exclude "X days before" patterns
        )];
        
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
                .map(task => task.whoCanHelp)
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

    populateHowDropdown() {
        const howSelect = document.getElementById('task-how');
        if (!howSelect) return;

        // Get unique how values from tasks
        const howValues = [...new Set(
            this.tasks
                .map(task => task.how)
                .filter(value => value && value.trim() !== '')
                .map(value => value.trim())
        )].sort(); // Alphabetical sorting

        // Remove existing dynamic options (keep default and "Other")
        const existingOptions = Array.from(howSelect.options);
        existingOptions.forEach(option => {
            if (option.value !== '' && option.value !== 'Other') {
                option.remove();
            }
        });

        // Add dynamic options before "Other"
        const otherOption = howSelect.querySelector('option[value="Other"]');
        howValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            howSelect.insertBefore(option, otherOption);
        });
    }

    hideAddTaskForm() {
        document.getElementById('add-task-form').style.display = 'none';
        document.getElementById('new-task-form').reset();
        
        // Reset priority to default value after form reset
        document.getElementById('task-priority').value = '3 - Medium';
        
        // Hide any "other" fields
        document.getElementById('task-timeline-other').style.display = 'none';
        document.getElementById('task-category-other').style.display = 'none';
        document.getElementById('task-who-can-help-other').style.display = 'none';
    }

    handleOtherOption(event, otherFieldId) {
        const otherField = document.getElementById(otherFieldId);
        const otherContainer = document.getElementById(otherFieldId + '-container');
        
        if (event.target.value === 'Other') {
            if (otherContainer) {
                otherContainer.style.display = 'block';
            } else {
                otherField.style.display = 'block';
            }
            otherField.focus();
        } else {
            if (otherContainer) {
                otherContainer.style.display = 'none';
            } else {
                otherField.style.display = 'none';
            }
            otherField.value = '';
        }
    }

    async handleAddTask(event) {
        event.preventDefault();
        
        // Show loading spinner
        this.showAddTaskLoading(true);
        
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
        
        let how = formData.get('how') || '';
        if (how === 'Other') {
            how = formData.get('how-other')?.trim() || '';
        }
        
        const taskData = {
            text: formData.get('taskText').trim(),
            timeline: timeline,
            priority: formData.get('priority') || '3 - Medium', // Default to Medium if empty
            category: category,
            how: how,
            notes: formData.get('notes') || '',
            whoCanHelp: whoCanHelp,
            completed: false
        };

        if (!taskData.text) {
            this.showAddTaskLoading(false);
            alert('Please enter a task description.');
            return;
        }

        console.log('Adding task:', taskData);
        console.log('useAppsScript:', this.useAppsScript);

        try {
            if (this.useAppsScript) {
                // Try to add via Apps Script
                await this.addTask(taskData);
                await this.loadFromSheet();
                this.updateSyncStatus('✅ Task Added');
                this.showAddTaskLoading(false);
                this.hideAddTaskForm();
            } else {
                // Since Apps Script isn't configured, add the task locally and show success
                // Generate a temporary ID for the task
                const tempId = 'temp_' + Date.now();
                taskData.id = tempId;
                
                // Add to local tasks array
                this.tasks.push(taskData);
                
                // Re-render the tasks to show the new one immediately
                this.renderTasks();
                
                // Show success message
                this.updateSyncStatus('✅ Task Added Locally (Please add to Google Sheet manually)');
                this.showAddTaskLoading(false);
                this.hideAddTaskForm();
                
                // Show instructions to add manually to Google Sheet
                const sheetUrl = `https://docs.google.com/spreadsheets/d/${this.sheetId}/edit#gid=${this.gid}`;
                setTimeout(() => {
                    if (confirm(`Task added locally! To persist this task, please add it to your Google Sheet.\n\nTask: ${taskData.text}\nTimeline: ${taskData.timeline}\nPriority: ${taskData.priority}\n\nOpen Google Sheet now?`)) {
                        window.open(sheetUrl, '_blank');
                    }
                }, 500);
            }
        } catch (error) {
            console.error('Error adding task:', error);
            this.showAddTaskLoading(false);
            this.showError(`Failed to add task: ${error.message}`);
        }
    }

    showLoading(show) {
        // Only show loading indicator during initial load
        if (this.isInitialLoad) {
            document.getElementById('loading').style.display = show ? 'block' : 'none';
        }
    }

    showAddTaskLoading(show) {
        const loadingOverlay = document.getElementById('add-task-loading');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
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
            // Use GET request with URL parameters to avoid CORS issues
            const params = new URLSearchParams({
                action: 'addTask',
                text: taskData.text || '',
                timeline: taskData.timeline || '',
                priority: taskData.priority || '',
                category: taskData.category || '',
                how: taskData.how || '',
                notes: taskData.notes || '',
                whoCanHelp: taskData.whoCanHelp || '',
                completed: taskData.completed ? 'TRUE' : 'FALSE'
            });

            const url = `${this.appsScriptUrl}?${params.toString()}`;
            console.log('Sending add task request to:', url);
            console.log('Task data:', taskData);
            
            try {
                // First try a regular GET request to see if we can read the response
                const response = await fetch(url, {
                    method: 'GET'
                });

                console.log('Response status:', response.status);
                console.log('Response ok:', response.ok);

                if (response.ok) {
                    const responseText = await response.text();
                    console.log('Raw response text:', responseText);
                    
                    try {
                        const result = JSON.parse(responseText);
                        console.log('Parsed response:', result);
                        
                        if (result.success) {
                            console.log('Task added successfully via Apps Script');
                            return result;
                        } else {
                            console.error('Apps Script returned success=false:', result);
                            throw new Error(result.error || result.data?.error || 'Apps Script reported failure');
                        }
                    } catch (parseError) {
                        console.error('Failed to parse JSON response:', parseError);
                        console.log('Response was:', responseText);
                        throw new Error('Invalid JSON response from Apps Script');
                    }
                } else {
                    const errorText = await response.text();
                    console.error('HTTP error response:', errorText);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (corsError) {
                console.log('CORS prevented response reading, trying no-cors mode:', corsError.message);
                
                // Fallback to no-cors mode - request goes through but we can't read response
                await fetch(url, {
                    method: 'GET',
                    mode: 'no-cors'
                });

                console.log('Add task request sent (no-cors mode)');
                
                // Since we can't read the response, just assume it worked and reload after a delay
                return { success: true, message: 'Request sent (response not readable due to CORS)' };
            }

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
        
        // Add category-based filters
        buttonsHtml += '<button class="filter-btn" data-filter="support-needed">Help Needed</button>';
        buttonsHtml += '<button class="filter-btn" data-filter="dom-needed">Dom Needed</button>';
        buttonsHtml += '<button class="filter-btn" data-filter="team-needed">Team Needed</button>';
        buttonsHtml += '<button class="filter-btn" data-filter="help-offered">Help Offered</button>';
        
        // Add line break before timeline buttons
        buttonsHtml += '<div style="flex-basis: 100%; height: 0;"></div>';
        
        sortedTimelines.forEach(timeline => {
            const safeTimeline = timeline.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            buttonsHtml += `<button class="filter-btn" data-filter="${safeTimeline}">${timeline}</button>`;
        });

        // Add completed items checkbox at the bottom
        buttonsHtml += '<div style="flex-basis: 100%; height: 0;"></div>';
        buttonsHtml += '<div style="margin-top: 10px;"><label style="color: var(--color-text); font-size: 14px; cursor: pointer;"><input type="checkbox" id="show-completed-checkbox" style="margin-right: 8px;"> Show Completed Items</label></div>';

        filterContainer.innerHTML = buttonsHtml;
        filterContainer.style.display = 'flex';

        // On initial load, always default to 'all'. During data syncs, restore saved filter or current filter
        let activeButton = null;
        
        if (this.isInitialLoad) {
            // On page refresh/initial load, always start with 'all'
            activeButton = filterContainer.querySelector('[data-filter="all"]');
        } else {
            // During data syncs, try to restore the current filter first, then saved filter
            const filterToRestore = this.currentFilter || this.getSavedFilter();
            if (filterToRestore) {
                activeButton = filterContainer.querySelector(`[data-filter="${filterToRestore}"]`);
            }
        }
        
        // If no active button found, default to 'all'
        if (!activeButton) {
            activeButton = filterContainer.querySelector('[data-filter="all"]');
        }
        
        if (activeButton) {
            activeButton.classList.add('active');
            this.currentFilter = activeButton.dataset.filter;
        }

        // Add event listeners to filter buttons
        filterContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                this.handleFilterClick(e.target);
            }
        });

        // Add event listener for the completed items checkbox
        const showCompletedCheckbox = filterContainer.querySelector('#show-completed-checkbox');
        if (showCompletedCheckbox) {
            // Initialize the checkbox state (default unchecked)
            this.showCompleted = this.showCompleted || false;
            showCompletedCheckbox.checked = this.showCompleted;
            
            showCompletedCheckbox.addEventListener('change', (e) => {
                this.showCompleted = e.target.checked;
                this.applyFilter(this.currentFilter);
            });
        }
    }

    handleFilterClick(button) {
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update current filter state
        this.currentFilter = button.dataset.filter;
        
        // Save the current filter so it persists across syncs
        this.saveCurrentFilter();

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

        // Apply specific filters
        todoItems.forEach(item => {
            let show = false;
            const rawTimeline = item.dataset.timeline || 'Other';
            const timeline = this.getDisplayTimeline(rawTimeline);
            const safeTimeline = timeline.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            const whoCanHelp = item.dataset.whoCanHelp || '';
            const how = item.dataset.how || '';
            const completed = item.dataset.completed === 'true';

            // Apply the main filter logic
            if (filterType === 'all') {
                // For 'All Tasks' filter, show all tasks
                show = true;
            } else {
                // Apply the specific filter logic
                switch (filterType) {
                    case 'support-needed':
                        // Filter for tasks where 'how' field equals 'Help Needed' AND 'whoCanHelp' is empty
                        show = how.trim().toLowerCase() === 'help needed' && whoCanHelp.trim() === '';
                        break;
                    case 'dom-needed':
                        // Filter for tasks where 'how' contains 'dom', 'to do', 'jumper' (with word boundaries) 
                        // OR 'how' is empty, AND 'whocanhelp' is empty
                        const domRegex = /(^|\s)(dom|jumper|to do)(\s|$)/i;
                        show = (domRegex.test(how) || how.trim() === '') && whoCanHelp.length == 0;
                        break;
                    case 'team-needed':
                        // Filter for tasks where 'how' field equals 'Team Needed'
                        show = how.trim().toLowerCase() === 'team needed';
                        break;
                    case 'help-offered':
                        // Filter for tasks where 'whoCanHelp' is not empty
                        show = whoCanHelp && whoCanHelp.trim() !== '';
                        break;
                    default:
                        // Timeline-based filter
                        show = safeTimeline === filterType;
                        break;
                }
            }

            // Apply completed items visibility based on checkbox state
            if (show && completed && !this.showCompleted) {
                // Hide completed items if checkbox is unchecked
                show = false;
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
