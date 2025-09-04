// Header component for Infinite Hips website
function createSiteHeader() {
    const headerHTML = `
        <div class="header" style="margin-bottom: 1rem;">
            <h1>🦘🪞 Infinite Hips Surgery Information</h1>
            <p> Hip Replacement Surgery with Dr. Jeffrey Wilde</p>
            <p> Scripps Clinic | September 12, 2025 at 7:30am</p>
            <p id="countdown-timer" style="display: none;"></p>
        </div>
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
    }
    
    // Start countdown timer
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

// Initialize header when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeHeader);
