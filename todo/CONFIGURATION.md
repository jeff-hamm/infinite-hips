# 🔧 Configuration Guide

Your surgery checklist now has flexible configuration options. You can easily modify the settings without digging through code!

## 📍 **Where to Configure:**

### **Option 1: config.js file (Recommended)**
- **File**: `todo/config.js`
- **Best for**: Clean separation, easier Git management, reusable across projects
- **Usage**: Just edit the values in `config.js`

### **Option 2: Inline in HTML**
- **File**: `todo/index.html` (uncomment the inline config section)
- **Best for**: Quick one-off changes, self-contained single file
- **Usage**: Uncomment the `<script>` section in the HTML head

## ⚙️ **Configuration Options:**

### **sheetId** 
```javascript
sheetId: '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag'
```
- **What**: Your Google Sheets document ID
- **Find it**: In your sheet URL between `/d/` and `/edit`
- **Example**: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit`

### **gid**
```javascript
gid: '1860137714'
```
- **What**: Specific sheet tab ID 
- **Find it**: In your sheet URL after `#gid=`
- **Example**: `https://docs.google.com/spreadsheets/d/abc123/edit#gid=1860137714`

### **appsScriptUrl**
```javascript
appsScriptUrl: 'https://script.google.com/macros/s/AKfycby.../exec'
```
- **What**: Your deployed Google Apps Script web app URL
- **Get it**: Deploy `infinite-checklist-apps-script.js` following the setup guide
- **Optional**: Leave as default if you only need read-only access

### **refreshInterval**
```javascript
refreshInterval: 30000
```
- **What**: How often to check for sheet updates (milliseconds)
- **Default**: 30000 (30 seconds)
- **Examples**: 60000 (1 minute), 10000 (10 seconds)

### **maxRetries**
```javascript
maxRetries: 3
```
- **What**: Maximum retry attempts for failed requests
- **Default**: 3
- **Range**: 1-10 reasonable values

## 🎯 **Current Setup:**

Your checklist is currently configured with:
- ✅ **Sheet ID**: `1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag`
- ✅ **GID**: `1860137714` 
- ✅ **Apps Script**: Deployed and ready for bidirectional sync
- ✅ **Refresh**: Every 30 seconds
- ✅ **Retries**: Up to 3 attempts on failure

## 🚀 **Quick Changes:**

### **Use a different sheet tab:**
```javascript
gid: '0' // First sheet tab
```

### **Faster updates:**
```javascript
refreshInterval: 10000 // Check every 10 seconds
```

### **Disable Apps Script (read-only mode):**
```javascript
appsScriptUrl: 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE'
```

The configuration is very flexible - you can even override settings programmatically:

```javascript
// Create checklist with custom config
const customChecklist = new GoogleSheetsChecklist({
    gid: '987654321',
    refreshInterval: 60000
});
```

Perfect for your September 12th surgery! 🏥
