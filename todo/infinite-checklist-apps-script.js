/**
 * Google Apps Script for Infinite Hips Surgery Checklist
 * Provides bidirectional sync between web UI and Google Sheets
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Apps Script (script.google.com)
 * 2. Create new project
 * 3. Replace Code.gs with this content
 * 4. Optionally update default configuration below
 * 5. Deploy as web app with "Anyone" access
 * 6. Copy the web app URL to your frontend
 * 
 * CONFIGURATION:
 * You can override defaults by passing config in the request body:
 * { action: 'getTasks', config: { sheetId: 'your-id', gid: '123456' } }
 */

// Default configuration - modify these if needed
const DEFAULT_CONFIG = {
  sheetId: '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag', // Your default sheet ID
  gid: '1860137714', // Default sheet GID (0 = first sheet)
  sheetName: null // Will be determined from GID if not specified
};

/**
 * Get configuration from request or use defaults
 */
function getConfig(requestData = {}) {
  const config = { ...DEFAULT_CONFIG };
  
  // Override with any config passed in the request
  if (requestData.config) {
    Object.assign(config, requestData.config);
  }
  
  // If no sheet name provided, derive from GID
  if (!config.sheetName) {
    config.sheetName = getSheetNameFromGid(config.sheetId, config.gid);
  }
  
  return config;
}

/**
 * Get sheet name from GID
 */
function getSheetNameFromGid(sheetId, gid) {
  try {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheets = spreadsheet.getSheets();
    
    // If GID is 0 or not found, use first sheet
    if (gid === '0' || gid === 0) {
      return sheets[0].getName();
    }
    
    // Find sheet by GID
    for (let sheet of sheets) {
      if (sheet.getSheetId().toString() === gid.toString()) {
        return sheet.getName();
      }
    }
    
    // Fallback to first sheet if GID not found
    console.warn(`Sheet with GID ${gid} not found, using first sheet`);
    return sheets[0].getName();
  } catch (error) {
    console.error('Error getting sheet name from GID:', error);
    throw new Error(`Could not access sheet ${sheetId} with GID ${gid}`);
  }
}

/**
 * Main entry point for HTTP requests
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const config = getConfig(data);
    const action = data.action;
    
    switch (action) {
      case 'getTasks':
        return createResponse(getTasks(config));
      
      case 'updateTask':
        return createResponse(updateTask(data.taskId, data.completed, data.updatedBy, config));
      
      case 'addTask':
        return createResponse(addTask(data.task, config));
      
      case 'deleteTask':
        return createResponse(deleteTask(data.taskId, config));
      
      case 'updateTaskDetails':
        return createResponse(updateTaskDetails(data.taskId, data.updates, config));
      
      case 'getLastModified':
        return createResponse({ lastModified: getLastModified(config) });
      
      case 'getConfig':
        return createResponse({ config: config });
      
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
  
  // Build config from URL parameters
  const requestConfig = {};
  if (e.parameter.sheetId) requestConfig.sheetId = e.parameter.sheetId;
  if (e.parameter.gid) requestConfig.gid = e.parameter.gid;
  if (e.parameter.sheetName) requestConfig.sheetName = e.parameter.sheetName;
  
  const config = getConfig({ config: requestConfig });
  
  try {
    switch (action) {
      case 'getTasks':
        return createResponse(getTasks(config));
      
      case 'test':
        return createResponse({ 
          message: 'Apps Script is working!', 
          timestamp: new Date().toISOString(),
          config: config
        });
      
      case 'config':
        return createResponse({ config: config });
      
      default:
        return createResponse(getTasks(config));
    }
  } catch (error) {
    console.error('Error processing GET request:', error);
    return createResponse({ error: error.toString() }, 500);
  }
}

/**
 * Get all tasks from the sheet
 */
function getTasks(config) {
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return { 
      tasks: [], 
      lastModified: new Date().toISOString(),
      config: config
    };
  }
  
  const headers = data[0].map(h => h.toString().toLowerCase().trim());
  const tasks = [];
  
  // Find column indices
  const doneIndex = findColumnIndex(headers, ['done', 'completed', 'status']);
  const taskIndex = findColumnIndex(headers, ['task', 'description', 'title']);
  const timelineIndex = findColumnIndex(headers, ['timeline', 'phase', 'period']);
  const priorityIndex = findColumnIndex(headers, ['priority', 'urgency']);
  const categoryIndex = findColumnIndex(headers, ['category', 'type']);
  const howIndex = findColumnIndex(headers, ['how', 'method', 'instructions']);
  const notesIndex = findColumnIndex(headers, ['notes', 'comments', 'details']);
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
      lastModified: row[lastModifiedIndex] ? new Date(row[lastModifiedIndex]).toISOString() : new Date().toISOString()
    };
    
    tasks.push(task);
  }
  
  return {
    tasks: tasks,
    lastModified: getLastModified(config),
    headers: headers,
    config: config
  };
}

/**
 * Update a task's completion status
 */
function updateTask(taskId, completed, updatedBy = 'Web UI', config) {
  const rowIndex = parseInt(taskId.replace('row-', ''));
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  
  // Get headers to find the Done column
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const doneColumnIndex = findColumnIndex(headers.map(h => h.toString().toLowerCase().trim()), ['done', 'completed', 'status']) + 1;
  const lastModifiedIndex = findColumnIndex(headers.map(h => h.toString().toLowerCase().trim()), ['lastmodified', 'updated', 'modified']) + 1;
  
  if (doneColumnIndex === 0) {
    throw new Error('Could not find Done/Completed column');
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
    timestamp: new Date().toISOString(),
    config: config
  };
}

/**
 * Add a new task
 */
function addTask(taskData, config) {
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
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
  if (lastModifiedIndex >= 0) newRow[lastModifiedIndex] = new Date();
  
  // Add the new row
  const newRowIndex = sheet.getLastRow() + 1;
  sheet.getRange(newRowIndex, 1, 1, newRow.length).setValues([newRow]);
  
  return {
    success: true,
    taskId: `row-${newRowIndex}`,
    rowIndex: newRowIndex,
    config: config
  };
}

/**
 * Update task details (not just completion status)
 */
function updateTaskDetails(taskId, updates, config) {
  const rowIndex = parseInt(taskId.replace('row-', ''));
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const headerMap = headers.map(h => h.toString().toLowerCase().trim());
  
  // Update each field that was provided
  Object.keys(updates).forEach(field => {
    let columnIndex = -1;
    
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
    }
    
    if (columnIndex >= 0) {
      sheet.getRange(rowIndex, columnIndex + 1).setValue(updates[field]);
    }
  });
  
  // Update last modified timestamp
  const lastModifiedIndex = findColumnIndex(headerMap, ['lastmodified', 'updated', 'modified']);
  if (lastModifiedIndex >= 0) {
    sheet.getRange(rowIndex, lastModifiedIndex + 1).setValue(new Date());
  }
  
  return { 
    success: true, 
    taskId: taskId, 
    updates: updates,
    config: config
  };
}

/**
 * Delete a task (mark as deleted or actually remove row)
 */
function deleteTask(taskId, config) {
  const rowIndex = parseInt(taskId.replace('row-', ''));
  const sheet = SpreadsheetApp.openById(config.sheetId).getSheetByName(config.sheetName);
  
  // Option 1: Actually delete the row
  sheet.deleteRow(rowIndex);
  
  // Option 2: Mark as deleted (comment out the line above and use this instead)
  // const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // const headerMap = headers.map(h => h.toString().toLowerCase().trim());
  // const deletedIndex = findColumnIndex(headerMap, ['deleted', 'archived']);
  // if (deletedIndex >= 0) {
  //   sheet.getRange(rowIndex, deletedIndex + 1).setValue('TRUE');
  // }
  
  return { 
    success: true, 
    taskId: taskId,
    config: config
  };
}

/**
 * Get the last modified timestamp of the sheet
 */
function getLastModified(config) {
  const file = DriveApp.getFileById(config.sheetId);
  return file.getLastUpdated().toISOString();
}

/**
 * Helper function to find column index by multiple possible names
 */
function findColumnIndex(headers, possibleNames) {
  for (let name of possibleNames) {
    const index = headers.indexOf(name.toLowerCase());
    if (index !== -1) return index;
  }
  return -1;
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
    const config = getConfig();
    console.log('Using config:', config);
    
    const tasks = getTasks(config);
    console.log('Successfully retrieved tasks:', tasks.tasks.length);
    
    const lastModified = getLastModified(config);
    console.log('Last modified:', lastModified);
    
    return { 
      success: true, 
      taskCount: tasks.tasks.length, 
      lastModified: lastModified,
      config: config
    };
  } catch (error) {
    console.error('Test failed:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Helper function to list all sheets and their GIDs for reference
 */
function listSheetsInfo() {
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.sheetId);
  const sheets = spreadsheet.getSheets();
  
  const sheetInfo = sheets.map(sheet => ({
    name: sheet.getName(),
    gid: sheet.getSheetId(),
    index: sheet.getIndex()
  }));
  
  console.log('Available sheets:', sheetInfo);
  return sheetInfo;
}
