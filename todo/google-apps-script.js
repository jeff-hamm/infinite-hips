/**
 * Google Apps Script for Infinite Hips Surgery Checklist
 * Provides bidirectional sync between web UI and Google Sheets
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create new project
 * 3. Replace Code.gs with this content
 * 4. Update SHEET_ID constant below
 * 5. Deploy as web app with "Anyone" access
 * 6. Copy the web app URL to your frontend
 */

// Configuration
const SHEET_ID = '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag'; // Your sheet ID
const SHEET_NAME = 'Sheet1'; // Change if your sheet has a different name
const GID = '1860137714'; // Sheet tab ID (gid from URL)

/**
 * Main entry point for HTTP requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    switch (action) {
      case 'getTasks':
        return createResponse(getTasks());
      
      case 'updateTask':
        return createResponse(updateTask(data.taskId, data.completed, data.updatedBy));
      
      case 'addTask':
        return createResponse(addTask(data.task));
      
      case 'deleteTask':
        return createResponse(deleteTask(data.taskId));
      
      case 'updateTaskDetails':
        return createResponse(updateTaskDetails(data.taskId, data.updates));
      
      case 'getLastModified':
        return createResponse({ lastModified: getLastModified() });
      
      default:
        throw new Error('Unknown action: ' + action);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  const action = e.parameter.action || 'getTasks';
  
  try {
    switch (action) {
      case 'getTasks':
        return createResponse(getTasks());
      
      case 'updateTask':
        const taskId = e.parameter.taskId;
        const completed = e.parameter.completed === 'true';
        const updatedBy = e.parameter.updatedBy || 'Web UI';
        return createResponse(updateTask(taskId, completed, updatedBy));
      
      case 'updateTaskDetails':
        const detailTaskId = e.parameter.taskId;
        const updates = JSON.parse(e.parameter.updates);
        return createResponse(updateTaskDetails(detailTaskId, updates));
      
      case 'addTask':
        // Handle addTask via GET parameters
        const newTask = {
          text: e.parameter.text || '',
          timeline: e.parameter.timeline || '',
          priority: e.parameter.priority || '',
          category: e.parameter.category || '',
          how: e.parameter.how || '',
          notes: e.parameter.notes || '',
          whoCanHelp: e.parameter.whoCanHelp || '',
          date: e.parameter.date || '',
          completed: e.parameter.completed === 'TRUE'
        };
        return createResponse(addTask(newTask));
      
      case 'test':
        return createResponse({ 
          message: 'Apps Script is working!', 
          timestamp: new Date().toISOString(),
          sheetId: SHEET_ID
        });
      
      default:
        return createResponse(getTasks());
    }
  } catch (error) {
    console.error('Error processing GET request:', error);
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Helper function to get sheet by GID or name
 */
function getSheetByGidOrName(spreadsheet, gid, sheetName) {
  try {
    // First try to get by GID
    if (gid) {
      const sheets = spreadsheet.getSheets();
      for (let sheet of sheets) {
        if (sheet.getSheetId().toString() === gid.toString()) {
          return sheet;
        }
      }
    }
    
    // Fallback to sheet name
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet) {
      return sheet;
    }
    
    // Last resort: use first sheet
    const sheets = spreadsheet.getSheets();
    if (sheets.length > 0) {
      console.warn(`Neither GID '${gid}' nor sheet name '${sheetName}' found. Using first sheet: '${sheets[0].getName()}'`);
      return sheets[0];
    }
    
    throw new Error('No sheets found in spreadsheet');
  } catch (error) {
    throw new Error(`Failed to get sheet: ${error.message}`);
  }
}

/**
 * Get all tasks from the sheet
 */
function getTasks() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    if (!spreadsheet) {
      throw new Error(`Cannot open spreadsheet with ID: ${SHEET_ID}`);
    }
    
    const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
    return getTasksFromSheet(sheet);
    
  } catch (error) {
    console.error('Error in getTasks:', error);
    throw new Error(`Failed to get tasks: ${error.message}`);
  }
}

/**
 * Helper function to extract tasks from a specific sheet
 */
function getTasksFromSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { tasks: [], lastModified: new Date().toISOString() };
  }
  
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const tasks = [];
  
  // Find column indices
  const doneIndex = findColumnIndex(headers, ['done','done?', 'completed', 'status']);
  const taskIndex = findColumnIndex(headers, ['task', 'description', 'title']);
  const timelineIndex = findColumnIndex(headers, ['timeline', 'phase', 'period']);
  const priorityIndex = findColumnIndex(headers, ['priority', 'urgency']);
  const categoryIndex = findColumnIndex(headers, ['category', 'type']);
  const howIndex = findColumnIndex(headers, ['how', 'method', 'instructions']);
  const notesIndex = findColumnIndex(headers, ['notes', 'comments', 'details']);
  const whoCanHelpIndex = findColumnIndex(headers, ['whocanhelp', 'who can help', 'help', 'contact']);
  const dateIndex = findColumnIndex(headers, ['date', 'due date', 'deadline', 'target date']);
  const lastModifiedIndex = findColumnIndex(headers, ['lastmodified', 'updated', 'modified']);
  
  // Process each row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // Skip empty rows
    if (!row[taskIndex] || row[taskIndex].toString().trim() === '') {
      continue;
    }
    
    const task = {
      id: `row-${i + 1}`, // Row-based ID
      rowIndex: i + 1,
      text: row[taskIndex]?.toString().trim() || '',
      completed: parseBoolean(row[doneIndex]),
      timeline: row[timelineIndex]?.toString().trim() || '',
      priority: row[priorityIndex]?.toString().toLowerCase().trim() || '',
      category: row[categoryIndex]?.toString().trim() || '',
      how: row[howIndex]?.toString().trim() || '',
      notes: row[notesIndex]?.toString().trim() || '',
      whoCanHelp: row[whoCanHelpIndex]?.toString().trim() || '',
      date: row[dateIndex] ? formatDateForSheet(row[dateIndex]) : '',
      lastModified: row[lastModifiedIndex] ? new Date(row[lastModifiedIndex]).toISOString() : new Date().toISOString()
    };
    
    tasks.push(task);
  }
  
  return {
    tasks: tasks,
    lastModified: getLastModified(),
    headers: headers
  };
}

/**
 * Update a task's completion status
 */
function updateTask(taskId, completed, updatedBy = 'Web UI') {
  try {
    const rowIndex = parseInt(taskId.replace('row-', ''));
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    if (!spreadsheet) {
      throw new Error(`Cannot open spreadsheet with ID: ${SHEET_ID}`);
    }
    
    const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
  
  // Get headers to find the Done column
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let doneColumnIndex = findColumnIndex(headers, ['done', 'completed', 'status', 'complete', 'finished', 'done?']) + 1;
  const lastModifiedIndex = findColumnIndex(headers, ['lastmodified', 'updated', 'modified', 'timestamp']) + 1;
  
  // Default to first column if Done column not found
  if (doneColumnIndex === 0) {
    console.warn(`Could not find Done/Completed column. Available columns: ${headers.map(h => h.toString()).join(', ')}. Defaulting to first column.`);
    doneColumnIndex = 1;
  }
  
  // Update the completion status
  sheet.getRange(rowIndex, doneColumnIndex).setValue(completed ? 'TRUE' : 'FALSE');
  
  // Update last modified timestamp if column exists
  if (lastModifiedIndex > 0) {
    sheet.getRange(rowIndex, lastModifiedIndex).setValue(new Date());
  }
  
  // Add a comment to track the change
  const cell = sheet.getRange(rowIndex, doneColumnIndex);
  const timestamp = new Date().toLocaleString();
  cell.setNote(`Updated by ${updatedBy} at ${timestamp}`);
  
  return { 
    success: true, 
    taskId: taskId, 
    completed: completed,
    timestamp: new Date().toISOString()
  };
  } catch (error) {
    console.error('Error in updateTask:', error);
    throw new Error(`Failed to update task: ${error.message}`);
  }
}

/**
 * Add a new task
 */
function addTask(taskData) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    if (!spreadsheet) {
      throw new Error(`Cannot open spreadsheet with ID: ${SHEET_ID}`);
    }
    
    const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = headers.map(h => h.toString().toLowerCase().trim());
  
  // Find column indices
  const doneIndex = findColumnIndex(headerMap, ['done', 'completed', 'status']);
  const taskIndex = findColumnIndex(headerMap, ['task', 'description', 'title']);
  const timelineIndex = findColumnIndex(headerMap, ['timeline', 'phase', 'period']);
  const priorityIndex = findColumnIndex(headerMap, ['priority', 'urgency']);
  const categoryIndex = findColumnIndex(headerMap, ['category', 'type']);
  const howIndex = findColumnIndex(headerMap, ['how', 'method', 'instructions']);
  const notesIndex = findColumnIndex(headerMap, ['notes', 'comments', 'details']);
  const whoCanHelpIndex = findColumnIndex(headerMap, ['whocanhelp', 'who can help', 'help', 'contact']);
  const dateIndex = findColumnIndex(headerMap, ['date', 'due date', 'target date', 'deadline']);
  const lastModifiedIndex = findColumnIndex(headerMap, ['lastmodified', 'updated', 'modified']);
  
  // Prepare new row data
  const newRow = new Array(headers.length).fill('');
  
  if (doneIndex >= 0) newRow[doneIndex] = taskData.completed ? 'TRUE' : 'FALSE';
  if (taskIndex >= 0) newRow[taskIndex] = taskData.text || '';
  if (timelineIndex >= 0) newRow[timelineIndex] = taskData.timeline || '';
  if (priorityIndex >= 0) newRow[priorityIndex] = taskData.priority || '';
  if (categoryIndex >= 0) newRow[categoryIndex] = taskData.category || '';
  if (howIndex >= 0) newRow[howIndex] = taskData.how || '';
  if (notesIndex >= 0) newRow[notesIndex] = taskData.notes || '';
  if (whoCanHelpIndex >= 0) newRow[whoCanHelpIndex] = taskData.whoCanHelp || '';
  if (dateIndex >= 0) newRow[dateIndex] = taskData.date || '';
  if (lastModifiedIndex >= 0) newRow[lastModifiedIndex] = new Date();
  
  // Add the new row
  const newRowIndex = sheet.getLastRow() + 1;
  sheet.getRange(newRowIndex, 1, 1, newRow.length).setValues([newRow]);
  
  return {
    success: true,
    taskId: `row-${newRowIndex}`,
    rowIndex: newRowIndex
  };
  } catch (error) {
    console.error('Error in addTask:', error);
    throw new Error(`Failed to add task: ${error.message}`);
  }
}

/**
 * Update task details (not just completion status)
 */
function updateTaskDetails(taskId, updates) {
  try {
    console.log(`updateTaskDetails called with taskId: ${taskId}, updates:`, updates);

    const rowIndex = parseInt(taskId.replace('row-', ''));
    console.log(`Parsed row index: ${rowIndex}`);

    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = headers.map(h => h.toString().toLowerCase().trim());

    console.log(`Available headers: ${headerMap.join(', ')}`);

    // Update each field that was provided
    Object.keys(updates).forEach(field => {
      let columnIndex = -1;
      console.log(`Processing field: "${field}" with value: "${updates[field]}"`);

      switch (field.toLowerCase()) {
        case 'text':
        case 'task':
          columnIndex = findColumnIndex(headerMap, ['task', 'description', 'title']);
          break;
        case 'timeline':
          columnIndex = findColumnIndex(headerMap, ['timeline', 'phase', 'period']);
          break;
        case 'priority':
          columnIndex = findColumnIndex(headerMap, ['priority', 'urgency']);
          break;
        case 'category':
          columnIndex = findColumnIndex(headerMap, ['category', 'type']);
          break;
        case 'how':
          columnIndex = findColumnIndex(headerMap, ['how', 'method', 'instructions']);
          break;
        case 'notes':
          columnIndex = findColumnIndex(headerMap, ['notes', 'comments', 'details']);
          break;
        case 'whocanhelp':
        case 'whoCanHelp':
        case 'who can help':
          columnIndex = findColumnIndex(headerMap, ['whocanhelp', 'who can help', 'help', 'contact']);
          break;
        case 'date':
        case 'due date':
        case 'target date':
        case 'deadline':
          columnIndex = findColumnIndex(headerMap, ['date', 'due date', 'target date', 'deadline']);
          console.log(`Date field - searching for columns: ['date', 'due date', 'target date', 'deadline']`);
          console.log(`Found date column at index: ${columnIndex}`);
          break;
      }

      console.log(`Field "${field}" mapped to column index: ${columnIndex}`);
      if (columnIndex >= 0) {
        let valueToSet = updates[field];

        // Special handling for date field
        if (field.toLowerCase() === 'date') {
          console.log(`Processing date field with original value: "${valueToSet}" (type: ${typeof valueToSet})`);
          if (valueToSet === '' || valueToSet === null || valueToSet === undefined) {
            // For empty values, use empty string directly - do NOT call formatDateForSheet
            valueToSet = '';
            console.log(`Date field is empty, setting to empty string without formatting`);
          } else {
            // Only format non-empty date values
            console.log(`Date field has value, formatting...`);
            valueToSet = formatDateForSheet(valueToSet);
            console.log(`Date field formatted to: "${valueToSet}"`);
          }
        }

        console.log(`Updating cell at row ${rowIndex}, column ${columnIndex + 1} with value: "${valueToSet}"`);

        // Get the current value for comparison
        const currentValue = sheet.getRange(rowIndex, columnIndex + 1).getValue();
        console.log(`Current cell value: "${currentValue}"`);

        // Update the cell
        sheet.getRange(rowIndex, columnIndex + 1).setValue(valueToSet);

        // Verify the update
        const newValue = sheet.getRange(rowIndex, columnIndex + 1).getValue();
        console.log(`Cell updated. New value: "${newValue}"`);

      } else {
        console.warn(`Column not found for field: "${field}". Available headers: ${headerMap.join(', ')}`);
      }
    });

    // Update last modified timestamp
    const lastModifiedIndex = findColumnIndex(headerMap, ['lastmodified', 'updated', 'modified']);
    if (lastModifiedIndex >= 0) {
      console.log(`Updating last modified timestamp at column ${lastModifiedIndex + 1}`);
      sheet.getRange(rowIndex, lastModifiedIndex + 1).setValue(new Date());
    }

    console.log(`updateTaskDetails completed successfully`);
    return { success: true, taskId: taskId, updates: updates };

  } catch (error) {
    console.error('Error in updateTaskDetails:', error);
    throw new Error(`Failed to update task details: ${error.message}`);
  }
}

/**
 * Delete a task (mark as deleted or actually remove row)
 */
function deleteTask(taskId) {
  const rowIndex = parseInt(taskId.replace('row-', ''));
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
  
  // Option 1: Actually delete the row
  sheet.deleteRow(rowIndex);
  
  // Option 2: Mark as deleted (comment out the line above and use this instead)
  // const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // const headerMap = headers.map(h => h.toString().toLowerCase().trim());
  // const deletedIndex = findColumnIndex(headerMap, ['deleted', 'archived']);
  // if (deletedIndex >= 0) {
  //   sheet.getRange(rowIndex, deletedIndex + 1).setValue('TRUE');
  // }
  
  return { success: true, taskId: taskId };
}

/**
 * Get the last modified timestamp of the sheet
 */
function getLastModified() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
  const file = DriveApp.getFileById(SHEET_ID);
  return file.getLastUpdated().toISOString();
}

/**
 * Helper function to find column index by multiple possible names
 */
function findColumnIndex(headers, possibleNames) {
  // Normalize headers for comparison
  const normalizedHeaders = headers.map(h => h.toString().toLowerCase().trim().replace(/[^a-z0-9?]/g, ''));
  
  for (let name of possibleNames) {
    const normalizedName = name.toLowerCase().trim().replace(/[^a-z0-9?]/g, '');
    
    // Exact match first
    let index = normalizedHeaders.indexOf(normalizedName);
    if (index !== -1) return index;
    
    // Match with optional question mark
    const nameWithQuestion = normalizedName + '?';
    const nameWithoutQuestion = normalizedName.replace('?', '');
    
    index = normalizedHeaders.indexOf(nameWithQuestion);
    if (index !== -1) return index;
    
    index = normalizedHeaders.indexOf(nameWithoutQuestion);
    if (index !== -1) return index;
    
    // Partial match - check if header contains the name
    index = normalizedHeaders.findIndex(header => header.includes(normalizedName));
    if (index !== -1) return index;
    
    // Reverse partial match - check if name contains the header
    index = normalizedHeaders.findIndex(header => normalizedName.includes(header) && header.length > 2);
    if (index !== -1) return index;
  }
  return -1;
}


/**
 * Helper function to format date values for display
 */
function formatDateForSheet(dateValue) {
  // IMPORTANT: Return empty string immediately for empty/null/undefined values
  if (!dateValue || dateValue === '' || dateValue === null || dateValue === undefined) {
    console.log('formatDateForSheet: Empty value detected, returning empty string');
    return '';
  }
  
  try {
    // If it's already a date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    
    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      // Extra check for empty string after trim
      const trimmed = dateValue.trim();
      if (trimmed === '') {
        console.log('formatDateForSheet: Empty string after trim, returning empty string');
        return '';
      }

      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
    }
    
    return dateValue.toString();
  } catch (error) {
    console.error('Error formatting date:', error, 'Value:', dateValue);
    return dateValue.toString();
  }
}

/**
 * Helper function to parse boolean values from various formats
 */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'x' || lower === '✓';
  }
  return false;
}

/**
 * Create standardized response object
 */
function createResponse(data, status = 200) {
  const response = {
    success: status === 200,
    data: data,
    timestamp: new Date().toISOString()
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function - call this to verify setup
 */
function testScript() {
  console.log('Testing Apps Script...');
  
  try {
    // Test spreadsheet access
    console.log('Testing spreadsheet access...');
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    console.log('Spreadsheet opened successfully');
    
    // Test sheet access
    const sheets = spreadsheet.getSheets();
    console.log(`Found ${sheets.length} sheets:`);
    sheets.forEach((sheet, index) => {
      console.log(`  ${index + 1}. ${sheet.getName()}`);
    });
    
    // Try to access the sheet by GID first, then by name
    let sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
    
    console.log(`Using sheet: ${sheet.getName()} (GID: ${sheet.getSheetId()})`);
    
    // Test data access
    const dataRange = sheet.getDataRange();
    console.log(`Data range: ${dataRange.getA1Notation()}`);
    
    const tasks = getTasks();
    console.log('Successfully retrieved tasks:', tasks.tasks.length);
    
    const lastModified = getLastModified();
    console.log('Last modified:', lastModified);
    
    return { 
      success: true, 
      sheetId: SHEET_ID,
      gid: GID,
      sheetName: SHEET_NAME,
      actualSheetName: sheet.getName(),
      actualGid: sheet.getSheetId().toString(),
      sheetsFound: sheets.map(s => `${s.getName()} (GID: ${s.getSheetId()})`),
      taskCount: tasks.tasks.length, 
      lastModified: lastModified 
    };
  } catch (error) {
    console.error('Test failed:', error);
    return { 
      success: false, 
      error: error.toString(),
      sheetId: SHEET_ID,
      sheetName: SHEET_NAME
    };
  }
}

/**
 * Test function specifically for date field updates
 */
function testDateUpdate() {
  console.log('Testing date field update...');

  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = headers.map(h => h.toString().toLowerCase().trim());

    console.log('Available headers:', headerMap);

    // Find date column
    const dateColumnIndex = findColumnIndex(headerMap, ['date', 'due date', 'target date', 'deadline']);
    console.log('Date column index:', dateColumnIndex);

    if (dateColumnIndex >= 0) {
      console.log(`Date column found at index ${dateColumnIndex} (column ${dateColumnIndex + 1})`);
      console.log(`Header name: "${headers[dateColumnIndex]}"`);

      // Get a sample of date values
      const dataRange = sheet.getDataRange();
      const numRows = Math.min(5, dataRange.getNumRows());
      for (let i = 2; i <= numRows; i++) {
        const cellValue = sheet.getRange(i, dateColumnIndex + 1).getValue();
        console.log(`Row ${i} date value: "${cellValue}" (type: ${typeof cellValue})`);
      }
    } else {
      console.log('Date column NOT found');
      console.log('Trying specific header searches:');
      ['date', 'due date', 'target date', 'deadline'].forEach(searchTerm => {
        const index = headerMap.findIndex(h => h.includes(searchTerm));
        console.log(`  Search for "${searchTerm}": ${index >= 0 ? `found at ${index}` : 'not found'}`);
      });
    }

    return {
      success: true,
      headers: headers,
      headerMap: headerMap,
      dateColumnIndex: dateColumnIndex,
      dateColumnHeader: dateColumnIndex >= 0 ? headers[dateColumnIndex] : null
    };

  } catch (error) {
    console.error('Date update test failed:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test function to verify writing to date column
 */
function testDateWrite() {
  console.log('Testing date column write functionality...');

  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getSheetByGidOrName(spreadsheet, GID, SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headerMap = headers.map(h => h.toString().toLowerCase().trim());

    // Find date column
    const dateColumnIndex = findColumnIndex(headerMap, ['date', 'due date', 'target date', 'deadline']);

    if (dateColumnIndex >= 0) {
      // Find a row with data to test (row 3 based on the previous test)
      const testRow = 3;
      const dateColumn = dateColumnIndex + 1;

      console.log(`Testing write to row ${testRow}, column ${dateColumn}`);

      // Get current value
      const currentValue = sheet.getRange(testRow, dateColumn).getValue();
      console.log(`Current value: "${currentValue}" (type: ${typeof currentValue})`);

      // Test clearing the date (set to empty string)
      console.log('Setting date to empty string...');
      sheet.getRange(testRow, dateColumn).setValue('');

      // Verify the change
      const newValue = sheet.getRange(testRow, dateColumn).getValue();
      console.log(`New value after clearing: "${newValue}" (type: ${typeof newValue})`);

      // Restore original value if it was a date
      if (currentValue instanceof Date) {
        console.log('Restoring original date value...');
        sheet.getRange(testRow, dateColumn).setValue(currentValue);
        const restoredValue = sheet.getRange(testRow, dateColumn).getValue();
        console.log(`Restored value: "${restoredValue}" (type: ${typeof restoredValue})`);
      }

      return {
        success: true,
        testRow: testRow,
        dateColumn: dateColumn,
        currentValue: currentValue,
        clearedSuccessfully: newValue === '' || newValue === null
      };

    } else {
      throw new Error('Date column not found');
    }

  } catch (error) {
    console.error('Date write test failed:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}