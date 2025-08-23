# GitHub Pages Deployment Instructions

## Step 1: Create GitHub Repository
1. Go to https://github.com
2. Click "New repository" or go to https://github.com/new
3. Repository name: `jumphip`
4. Description: "Hip replacement surgery documentation and support coordination site"
5. Make it **Public** (required for GitHub Pages)
6. Do NOT initialize with README (we already have files)
7. Click "Create repository"

## Step 2: Push Code to GitHub
Once the repository is created, run these commands:

```powershell
# Update the remote URL (in case of any issues)
git remote set-url origin https://github.com/jeff-hamm/jumphip.git

# Push to GitHub
git push -u origin master
```

## Step 3: Enable GitHub Pages
1. Go to your repository on GitHub: https://github.com/jeff-hamm/jumphip
2. Click on "Settings" tab
3. Scroll down to "Pages" in the left sidebar
4. Under "Source", select "Deploy from a branch"
5. Choose "master" branch
6. Choose "/ (root)" folder
7. Click "Save"

## Step 4: Set Up Custom Domain with Cloudflare

### Option A: GitHub Pages Default URL
Your site is available at: **https://jeff-hamm.github.io/jumphip**

### Option B: Custom Domain via Cloudflare (Recommended)
For custom domain: **https://infinitehips.infinitebutts.com**

#### Cloudflare DNS Setup:
1. Log into your Cloudflare dashboard
2. Select your `infinitebutts.com` domain
3. Go to **DNS** → **Records**
4. Add a **CNAME** record:
   - **Name**: `infinitehips`
   - **Target**: `jeff-hamm.github.io`
   - **Proxy status**: ✅ Proxied (orange cloud)
   - **TTL**: Auto

#### GitHub Pages Custom Domain Setup:
1. Go to your GitHub repo: https://github.com/jeff-hamm/jumphip
2. Settings → Pages
3. Under "Custom domain", enter: `infinitehips.infinitebutts.com`
4. Click "Save"
5. ✅ Check "Enforce HTTPS" (after DNS propagation)

#### Verification:
- DNS propagation: 5-10 minutes
- SSL certificate: 10-15 minutes
- Full site availability: 15-30 minutes

## Files Ready for Deployment
✅ index.html - Main landing page with dark theme
✅ assets/dark-theme.css - Shared stylesheet
✅ docs/ - All HTML documentation pages
✅ images/ - All medical document images
✅ README.md - Repository documentation
✅ _config.yml - Jekyll configuration for GitHub Pages

## Site Features
- 📱 Mobile-responsive design
- 🌙 Dark theme with pink accents (#ff69b4)
- ✅ Interactive checklists and schedules
- 📊 Progress tracking
- 💾 Auto-save functionality
- 📤 Export capabilities
- 🔗 Cross-referenced documentation

Your surgery support site is ready to deploy!
