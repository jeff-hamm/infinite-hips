# Jump Hip - GitHub Pages Deployment Script

# This script helps you set up and deploy your surgery documentation to GitHub Pages

Write-Host "🦘 Jump Hip - GitHub Pages Setup" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Check if git is installed
try {
    git --version | Out-Null
    Write-Host "✅ Git is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Git is not installed. Please install Git first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Pre-deployment checklist:" -ForegroundColor Yellow
Write-Host "1. Create a new repository called 'jumphip' on GitHub at https://github.com/jeff-hamm"
Write-Host "2. Make sure you're in the correct directory with your files"
Write-Host "3. Ensure you have a GitHub account set up"
Write-Host ""

$continue = Read-Host "Do you want to continue with the setup? (y/n)"
if ($continue -ne 'y') {
    Write-Host "Setup cancelled." -ForegroundColor Yellow
    exit 0
}

# Initialize git repository if not already done
if (-not (Test-Path ".git")) {
    Write-Host "🔧 Initializing git repository..." -ForegroundColor Blue
    git init
}

# Add all files
Write-Host "📁 Adding files to git..." -ForegroundColor Blue
git add .

# Commit files
Write-Host "💾 Committing files..." -ForegroundColor Blue
git commit -m "Initial commit: Hip surgery documentation site"

# Add remote origin
Write-Host "🔗 Adding remote repository..." -ForegroundColor Blue
Write-Host "If you get an error about 'remote origin already exists', that's normal."
git remote add origin https://github.com/jeff-hamm/jumphip.git 2>$null

# Create and switch to main branch
Write-Host "🌿 Setting up main branch..." -ForegroundColor Blue
git branch -M main

# Push to GitHub
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Blue
Write-Host "You may be prompted for GitHub credentials."
git push -u origin main

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your site should be available at:" -ForegroundColor Cyan
Write-Host "   https://jeff-hamm.github.io/jumphip" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏱️  Note: It may take a few minutes for GitHub Pages to build and deploy your site." -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 To enable GitHub Pages:" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com/jeff-hamm/jumphip/settings/pages"
Write-Host "2. Under 'Source', select 'Deploy from a branch'"
Write-Host "3. Select 'main' branch and '/ (root)' folder"
Write-Host "4. Click 'Save'"
Write-Host ""
Write-Host "📱 Your surgery documentation is now live!" -ForegroundColor Green
