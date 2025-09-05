/**
 * Configuration for Infinite Hips Surgery Checklist
 * 
 * You can modify these values to customize your checklist:
 * - sheetId: Your Google Sheets document ID
 * - gid: The specific sheet tab ID (found in URL after #gid=)
 * - appsScriptUrl: Your deployed Google Apps Script web app URL
 * - refreshInterval: How often to check for updates (milliseconds)
 * - maxRetries: Maximum retry attempts for failed requests
 */

window.CHECKLIST_CONFIG = {
    // Google Sheets configuration
    sheetId: '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag',
    gid: '1860137714',
    
    // Apps Script URL for bidirectional sync (optional)
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbycobzIubmEzjq0_PhqA34reM4eVnZiFxSpiz9CnLSma48azXvZb5ICpa4N2id2Uyg/exec',
    
    // Auto-refresh interval (30 seconds = 30000 milliseconds)
    refreshInterval: 60000,
    
    // Maximum retry attempts for failed requests
    maxRetries: 3
};

    // <!-- Option 2: Inline config (uncomment to override config.js) -->
    // <script>
    //     window.CHECKLIST_CONFIG = {
    //         // Google Sheets configuration
    //         sheetId: '1ziPiBhIYXTgVvs2HVokZQrFPjYdF9w-wcO9ivPwpgag',
    //         gid: '1860137714',
            
    //         // Apps Script URL for bidirectional sync
    //         appsScriptUrl: 'https://script.google.com/macros/s/AKfycbycobzIubmEzjq0_PhqA34reM4eVnZiFxSpiz9CnLSma48azXvZb5ICpa4N2id2Uyg/exec',
            
    //         // Auto-refresh interval (milliseconds)
    //         refreshInterval: 30000,
            
    //         // Maximum retry attempts
    //         maxRetries: 3
    //     };
    // </script>
