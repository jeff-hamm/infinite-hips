# Agent Instructions for Infinite Hips Project

## Project Overview

This is a **hip replacement surgery documentation website** called "Infinite Hips". The site helps coordinate pre/post-operative care, family support, and medical documentation access.

## Key Context for Future Agents

### User Profile

- **User**: Jeff Hamm (jeff@jeff-hamm.com)
- **Surgery**: Hip replacement, September 12, 2025, Dr. Jeffrey Wilde, Scripps Mission Valley
- **Technical Preference**: Dark themes with pink accents, similar to https://jumpcloud.infinitebutts.com/
- **Domain Goal**: infinitehips.infinitebutts.com (Cloudflare managed)

### Design System Requirements

- **Color Palette**: Dark background (#0d1117) with lighter pink accents (#ff69b4, #ffb3da)
- **Headers**: Gray gradient backgrounds with pink text (NOT pink gradients)
- **No Green**: User specifically requested removal of all green accent colors
- **Mobile-First**: Responsive design for phone/tablet usage during recovery
- **Print-Friendly**: Many pages need to work well when printed

### Critical Files & Their Purpose

#### Core Website Files

- `index.html` - Main landing page with navigation to all resources
- `assets/dark-theme.css` - Shared stylesheet with approved color scheme
- `CNAME` - Contains: infinitehips.infinitebutts.com

#### Interactive Tools (Most Important)

- `docs/surgery-support-schedule.html` - 79+ tasks with filtering and checkboxes
- `docs/pre-surgery-checklist.html` - Day-by-day prep with countdown timer
- `docs/friends-support-list.html` - Support coordination with auto-save

#### Medical Documentation (Updated August 23, 2025)

- `docs/*.html` - All medical documents converted from markdown with consistent styling
- `docs/*.md` - Clean, structured markdown files with YAML frontmatter
- `scans_md/*.jpg` - Renamed medical document images with descriptive names
- `scans_md/*-ocr.jpg.md` - OCR results from original scans with descriptive names
- `old/*.md.old` - Archived original OCR files with generic scan names

#### Legacy Data Files

- `*.csv` - Original data files, now converted to interactive HTML

### Development Guidelines (Updated August 23, 2025)

#### File Organization Patterns

**Naming Conventions:**
- Images: `<descriptive-name>.jpg` (e.g., `preop-skin-wash.jpg`)
- OCR files: `<descriptive-name>-ocr.jpg.md` (e.g., `preop-skin-wash-ocr.jpg.md`)
- Clean markdown: `<descriptive-name>.md` in `/docs` directory
- HTML pages: `<descriptive-name>.html` in `/docs` directory

**Directory Structure:**
```
/scans_md/          # Images and OCR files with descriptive names
/docs/              # Clean markdown and generated HTML
/old/               # Archived original files
```

**Content Mapping:**
Each medical document exists in 4 formats:
1. Original scan → `scans_md/<name>.jpg`
2. OCR extraction → `scans_md/<name>-ocr.jpg.md`
3. Structured markdown → `docs/<name>.md` (with YAML frontmatter)
4. Published HTML → `docs/<name>.html` (with navigation and styling)

#### Terminal Command Preferences

- **Batch operations preferred** - Use `&&` to chain related commands to reduce confirmations
- **Working directory awareness** - Always use absolute paths for file operations
- **Cleanup after operations** - Remove macOS `._*` metadata files automatically

#### When Making Changes

1. **Always maintain the approved color scheme** - lighter pink (#ff69b4), no green
2. **Test mobile responsiveness** - user will access during recovery on phone
3. **Preserve data integrity** - medical information must remain accurate
4. **Check cross-references** - many pages link to each other and source images

#### Code Patterns Used

- **Vanilla HTML/CSS/JS** - no frameworks for simplicity
- **Progressive enhancement** - works without JS, better with JS
- **Local storage** - for saving user progress and assignments
- **CSS Grid/Flexbox** - for responsive layouts

### Common User Requests & Solutions

#### "The pink is too bright"

- Use #ff69b4 (lighter pink) instead of #ff007a or #ff1a8c
- Secondary pink: #ffb3da for subtle accents

#### "Headers should be gray with pink text"

- Use `background: linear-gradient(145deg, #4a4a4a 0%, #6c6c6c 100%)`
- Text color: #ff69b4

#### "Remove the green"

- Replace any #28a745, #20c997, or green variants with pink equivalents
- Success states should use pink, not green

#### "Make it work like [their other site]"

- Reference: https://jumpcloud.infinitebutts.com/ for design inspiration
- Dark theme with colorful accents is their preferred aesthetic

### Deployment Information

#### GitHub Repository

- **Current**: jeff-hamm/jumphip (may be renamed)
- **Target Domain**: infinitehips.infinitebutts.com
- **Hosting**: GitHub Pages with Cloudflare DNS

#### Deployment Process

1. `git add .`
2. `git commit -m "Description"`
3. `git push origin master`
4. GitHub Pages auto-deploys to infinitehips.infinitebutts.com

### Testing Checklist

- [ ] All pages load correctly
- [ ] Color scheme consistent (lighter pink, gray headers)
- [ ] Mobile responsive design works
- [ ] Interactive features save/load properly
- [ ] Cross-references between pages work
- [ ] Print layouts are clean

### Emergency Contacts in Code

These are referenced throughout the medical documentation:

- **Dr. Jeffrey Wilde**: (858) 554-7993
- **Game Ready (Amy Weiner)**: (619) 823-2691
- **Luna PT**: (619) 966-3822
- **Surgery Date**: September 12, 2025, 7:30am check-in

### User Experience Priorities

1. **Ease of use during recovery** - large buttons, clear text
2. **Family coordination** - shareable links, print-friendly
3. **Medical accuracy** - preserve all medical information exactly
4. **Visual comfort** - dark theme for screen time during recovery

## Quick Reference Commands

### Local Development

```bash
# Start local server
python -m http.server 8000
# Then open http://localhost:8000

# Or use VS Code Live Server extension
```

### Git Operations

```bash
# Standard workflow
git add .
git commit -m "Description of changes"
git push origin master
```

### Find and Replace Operations

Always use the replace_string_in_file tool with sufficient context (3-5 lines before/after) to avoid ambiguous matches.

## Final Notes

This project evolved from a simple CSV request into a comprehensive digital health companion. The user values functionality, visual appeal, and medical accuracy equally. Always test changes thoroughly and maintain the established design patterns.
