# 🚀 Google Apps Script Setup for Bidirectional Sync

This guide will help you set up the Google Apps Script to enable **direct editing** of your surgery checklist without requiring login.

## 📋 **What You'll Get:**
- ✅ **Direct checkbox editing** from your web interface
- ✅ **Real-time bidirectional sync** between web UI and Google Sheets
- ✅ **Add, edit, delete tasks** directly from the web
- ✅ **No authentication required** for users
- ✅ **Conflict resolution** and change tracking
- ✅ **Offline caching** with automatic sync when back online
- ✅ **Multi-sheet support** with GID-based configuration
- ✅ **Dynamic configuration** - override settings per request

---

## 🛠️ **Setup Steps (10 minutes):**

### **Step 1: Open Google Apps Script**
1. Go to [script.google.com](https://script.google.com)
2. Click **"New Project"**
3. You'll see a blank `Code.gs` file

### **Step 2: Replace the Code**
1. Delete all content in `Code.gs`
2. Copy the entire contents of `infinite-checklist-apps-script.js` from this folder
3. Paste it into the `Code.gs` file
4. **Optional**: Update the default configuration (lines 16-20):
   ```javascript
   const DEFAULT_CONFIG = {
     sheetId: '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag', // Your default sheet ID
     gid: '0', // Default sheet GID (0 = first sheet)
     sheetName: null // Will be determined from GID
   };
   ```

### **Step 3: Find Your Sheet GID (Optional)**

1. **To use a specific sheet tab**, find its GID:
   - Open your Google Sheet
   - Look at the URL: `...spreadsheets/d/SHEET_ID/edit#gid=123456789`
   - The number after `#gid=` is your GID
   - Or run `listSheetsInfo()` in Apps Script to see all available sheets

2. **Update the default GID** if needed (line 18):
   ```javascript
   gid: '123456789', // Your specific sheet tab GID
   ```

### **Step 4: Save and Test**

1. Click **"Save"** (Ctrl+S)
2. Name your project: `"Infinite Hips Surgery Checklist"`
3. Click **"Run"** button → Select `testScript` function
4. **First time**: You'll need to authorize the script:
   - Click **"Review permissions"**
   - Choose your Google account
   - Click **"Advanced"** → **"Go to Infinite Hips Surgery Checklist (unsafe)"**
   - Click **"Allow"**
5. Check the **Execution transcript** - should show "Successfully retrieved tasks" and config info

### **Step 5: Deploy as Web App**

1. Click **"Deploy"** → **"New deployment"**
2. Click **"Type"** gear icon → Select **"Web app"**
3. **Settings**:
   - **Description**: `"Surgery Checklist API v1"`
   - **Execute as**: `"Me"`
   - **Who has access**: `"Anyone"` ← **Critical!**
4. Click **"Deploy"**
5. **Copy the Web App URL** - it looks like:
   ```
   https://script.google.com/macros/s/ABC123.../exec
   ```

### **Step 6: Update Your Web Interface**

1. Open `todo/app.js` in your editor
2. Find line ~11 (in the constructor):
   ```javascript
   this.appsScriptUrl = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace with your Web App URL:
   ```javascript
   this.appsScriptUrl = 'https://script.google.com/macros/s/ABC123.../exec';
   ```
4. Save the file

### **Step 7: Test the Integration**

1. Open your surgery checklist: `http://localhost:8000/todo/index.html`
2. Try clicking a checkbox - it should update directly in Google Sheets!
3. Open your Google Sheet in another tab and make changes - they should sync automatically

---

## 🎯 **Features Now Available:**

### **Direct Checkbox Editing**
- Click any checkbox → Updates Google Sheets immediately
- No popup windows or manual editing required
- Real-time visual feedback

### **Multi-Sheet Support**
- **Dynamic configuration** - specify different sheets per request
- **GID-based selection** - more reliable than sheet names
- **Runtime configuration** - override settings without redeploying

### **Advanced Task Management** (if you want to add buttons)
```javascript
// Add a new task
sheetsChecklist.addTask({
    text: '🏥 Call doctor for follow-up',
    timeline: 'Recovery Week 1',
    priority: 'high',
    category: 'Medical',
    how: 'Phone call',
    notes: 'Ask about pain levels'
});

// Update task details
sheetsChecklist.updateTaskDetails('row-5', {
    priority: 'medium',
    notes: 'Updated notes here'
});

// Delete a task
sheetsChecklist.deleteTask('row-8');

// Use different sheet by GID
sheetsChecklist.config = { gid: '123456789' };
await sheetsChecklist.loadTasks();
```

### **Bidirectional Sync**
- Changes in Google Sheets → Automatically appear in web UI (30 second refresh)
- Changes in web UI → Immediately update Google Sheets
- Multiple people can edit simultaneously with conflict resolution

### **Enhanced Testing & Configuration**
- **Test with different sheets**: Add `?gid=123456` to your Apps Script URL
- **View current config**: Use `?action=config` to see active settings
- **List all sheets**: Run `listSheetsInfo()` function in Apps Script

### **Offline Support**
- Works offline with cached data
- Automatically syncs when connection returns
- Shows connection status

---

## 🔧 **Troubleshooting:**

### **"Apps Script error: 403"**
- Check that deployment has **"Who has access: Anyone"**
- Re-deploy if needed

### **"Sheet is not publicly accessible"**
- Ensure your Google Sheet is set to **"Anyone with the link can view"**
- Check the sheet sharing settings

### **Checkboxes don't update**
1. Check browser console (F12) for errors
2. Verify the Apps Script URL is correct
3. Test the Apps Script directly: add `?action=test` to the URL

### **"Function not found" errors**
- Make sure you copied the ENTIRE `google-apps-script.js` content
- Check that function names match exactly

---

## 🚨 **Security Notes:**

- **No personal data exposure**: The script only accesses your specific sheet
- **No login required**: Users don't need Google accounts
- **Your control**: You own and control the Apps Script
- **Audit trail**: All changes include timestamps and source tracking

---

## 🎉 **Success Indicators:**

✅ **Working correctly when:**
- Checkboxes update Google Sheets instantly
- Changes in Google Sheets appear in web UI within 30 seconds  
- Status shows "✅ Synced" or "✅ Task Updated"
- No error messages in browser console

⚠️ **Needs attention when:**
- Status shows "📱 Cached Data" (offline mode)
- Popup asking to "open Google Sheets" (Apps Script not configured)
- Error messages about authentication or permissions

---

Ready to transform your surgery checklist into a fully interactive, real-time collaborative tool! 🚀
