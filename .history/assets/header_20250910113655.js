// Header component for Infinite Hips website
function getBasePath() {
    // Check if a <base> tag exists and use it
    const baseElement = document.querySelector('base[href]');
    if (baseElement) {
        const baseHref = baseElement.getAttribute('href');
        // If base href is already set, use it as-is
        return baseHref.endsWith('/') ? baseHref : baseHref + '/';
    }
    
    // Fallback: Determine the base path based on current location
    const path = window.location.pathname;
    if (path.includes('/docs/') || path.includes('/todo/') || path.includes('/pt-search/')) {
        return '../';
    }
    return '';
}

function createSiteHeader() {
    const basePath = getBasePath();
    const currentPath = window.location.pathname;
    
    // Check if we're at the main homepage (base path or base path + index.html)
    const isHomePage = currentPath === '/' || 
                      currentPath === '/index.html' || 
                      currentPath === basePath || 
                      currentPath === basePath + 'index.html';
    
    // Define all quick links
    const allLinks = [
        { href: `${basePath}todo/index.html`, text: '📋 Help Out!', pathCheck: '/todo/' },
        { href: `${basePath}docs/surgery-timeline-overview.html`, text: '📅 Recovery Timeline', pathCheck: 'surgery-timeline-overview' },
        { href: `${basePath}docs/updates.html`, text: '📬 Recent Updates', pathCheck: 'updates' },
        { href: `${basePath}pt-search/index.html`, text: '🔍 Physical Therapy Search', pathCheck: '/pt-search/' }
    ];
    
    // Filter out the current page
    const visibleLinks = allLinks.filter(link => !currentPath.includes(link.pathCheck));
    
    // Only show the Quick Access section if there are links to display
    const quickAccessSection = visibleLinks.length > 0 ? `
        <div class="section">
            <h2>📋 Quick Access</h2>
            <div class="quick-links">
                ${visibleLinks.map(link => `<a href="${link.href}">${link.text}</a>`).join('')}
            </div>
        </div>
    ` : '';
    
    // Show navigation with collapsible quick access when not on homepage
    const navigationSection = visibleLinks.length > 0 ? `
        <div class="nav">
            ${!isHomePage ? `<a href="${basePath}index.html">← Back to Main Index</a>` : ''}
            ${!isHomePage ? `
                <button id="quick-access-toggle" class="quick-access-toggle">📋 Quick Access ▼</button>
                <div id="quick-access-dropdown" class="quick-access-dropdown" style="display: none;">
                    ${visibleLinks.map(link => `<a href="${link.href}">${link.text}</a>`).join('')}
                </div>
            ` : ''}
        </div>
    ` : '';
    
    const headerHTML = `
        <div class="header" style="margin-bottom: 1rem;">
            <h1>🦘🪞 Infinite Hips Surgery Information</h1>
            <p> Hip Replacement Surgery with Dr. Jeffrey Wilde</p>
            <p> Scripps Clinic | September 12, 2025 at 7:30am</p>
            <p id="countdown-timer" style="display: none;"></p>
        </div>
        ${!isHomePage ? navigationSection : quickAccessSection}
    `;
    return headerHTML;
}

function updateCountdown() {
    // Surgery date: September 12, 2025 at 7:30am PST
    const surgeryDate = new Date('2025-09-12T07:30:00-07:00'); // PST is UTC-7 (or UTC-8 in winter)
    const now = new Date();
    
    // If surgery has already happened, hide the countdown
    if (now >= surgeryDate) {
        const countdownElement = document.getElementById('countdown-timer');
        if (countdownElement) {
            countdownElement.style.display = 'none';
        }
        return;
    }
    
    // Show the countdown timer
    const countdownElement = document.getElementById('countdown-timer');
    if (countdownElement) {
        countdownElement.style.display = 'block';
        
        const timeDiff = surgeryDate - now;
        
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        let countdownText = '';
        if (days > 0) {
            countdownText = `${days} days, ${hours}h ${minutes}m ${seconds}s`;
        } else if (hours > 0) {
            countdownText = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            countdownText = `${minutes}m ${seconds}s`;
        } else {
            countdownText = `${seconds}s`;
        }
        
        countdownElement.textContent = countdownText;
    }
}

function initializeHeader() {
    // Insert site header HTML into the page
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        headerContainer.innerHTML = createSiteHeader();
        
        // Add quick access toggle functionality
        const quickAccessToggle = document.getElementById('quick-access-toggle');
        const quickAccessDropdown = document.getElementById('quick-access-dropdown');
        
        if (quickAccessToggle && quickAccessDropdown) {
            quickAccessToggle.addEventListener('click', () => {
                const isVisible = quickAccessDropdown.style.display !== 'none';
                quickAccessDropdown.style.display = isVisible ? 'none' : 'block';
                quickAccessToggle.textContent = isVisible ? '📋 Quick Access ▼' : '📋 Quick Access ▲';
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!quickAccessToggle.contains(e.target) && !quickAccessDropdown.contains(e.target)) {
                    quickAccessDropdown.style.display = 'none';
                    quickAccessToggle.textContent = '📋 Quick Access ▼';
                }
            });
        }
    }
    
    // Start countdown timer
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Initialize header when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeHeader);
