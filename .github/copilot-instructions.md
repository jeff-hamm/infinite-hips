# Copilot Instructions for Infinite Hips Project

## 🚨 CRITICAL REMINDER: Be Incredibly Careful When Editing This File

**This file contains essential project context that keeps the Infinite Hips project working correctly.**

- Only make changes when the user explicitly asks
- Never remove information unless specifically instructed
- Always preserve existing content unless user wants it changed
- When unsure about editing this file, ask the user first
- Remember: Small changes here can break the entire project understanding

---

## Project Summary

**Infinite Hips** is a comprehensive hip replacement surgery documentation website for patient Jeff Hamm. The project evolved from simple document organization into a full digital health companion with interactive tools for surgery preparation and recovery coordination.

- **Surgery**: September 12, 2025, Dr. Jeffrey Wilde, Scripps Mission Valley
- **Domain**: infinitehips.infinitebutts.com (GitHub Pages + Cloudflare)
- **Tech Stack**: Vanilla HTML/CSS/JS, dark theme with pink accents

## Critical File Organization (August 2025)

### Directory Structure
```
/docs/              # Clean markdown + generated HTML (primary content)
/scans_md/          # Source images + OCR files
/old/               # Archived original files
/notes/             # Personal notes, todo lists, test results, messages
/assets/            # Shared CSS
```

### File Naming Patterns
- **Images**: `<content-name>.jpg` (e.g., `preop-skin-wash.jpg`)
- **OCR Files**: `<content-name>-ocr.jpg.md` (raw text extraction)
- **Clean Markdown**: `<content-name>.md` (in `/docs`, with YAML frontmatter)
- **HTML Pages**: `<content-name>.html` (in `/docs`, generated from markdown)

### Content Mapping System
Each medical document exists in 4 formats:
1. **Scan** → `scans_md/preop-skin-wash.jpg`
2. **OCR** → `scans_md/preop-skin-wash-ocr.jpg.md`
3. **Structured MD** → `docs/preop-skin-wash.md`
4. **Published HTML** → `docs/preop-skin-wash.html`

## Design Requirements

### Color Scheme (Strictly Enforced)
- **Background**: `#0d1117` (dark)
- **Text**: `#f0f6fc` (light)
- **Primary Accent**: `#ff69b4` (lighter pink - NOT bright pink)
- **Secondary Accent**: `#ffb3da` (light pink)
- **Headers**: Gray gradient background with pink text
- **NO GREEN COLORS** - User specifically requested removal

### Design Reference
- **User's Other Site**: https://jumpcloud.infinitebutts.com/ (design inspiration)
- Dark theme with colorful accents is their preferred aesthetic

### CSS Patterns
- Single stylesheet: `assets/dark-theme.css`
- Mobile-first responsive design
- Print-friendly layouts
- Consistent navigation

## Development Preferences

### Terminal Commands
- **Batch operations preferred** - Use `&&` to chain commands
- **Reduce confirmations** - Combine multiple operations
- **Always use absolute paths**
- **Clean up metadata files** - Remove `._*` files after operations

### Code Editing
- **Preserve medical accuracy** - Never alter medical information
- **Maintain personalization** - Content includes "Jeff", specific dates
- **Update cross-references** - When renaming files, update HTML links
- **Include context** - Use 3-5 lines before/after when editing

## Key Interactive Features

1. **Surgery Support Schedule** - 79+ tasks with filtering, checkboxes, progress tracking
2. **Pre-Surgery Checklist** - Day-by-day countdown with progress bar
3. **Friends Support Coordination** - Auto-save forms for task assignment
4. **Medical Documentation** - All 12 documents with consistent navigation

## Content Guidelines

### Medical Documents (12 total as of August 27, 2025)

**Pre-Operative (4 documents):**
- `preop-skin-wash` - Hibiclens washing protocol
- `mrsa-screening` - MRSA/MSSA testing information
- `surgery-schedule` - Timeline and logistics
- `preop-instructions` - General pre-operative preparation

**Post-Operative (6 documents):**
- `postop-medications` - Complete medication schedule and instructions
- `postop-antibiotics` - **NEW** - 2-year dental procedure antibiotic protocol
- `postop-problems-and-precautions` - **NEW** - Warning signs, travel restrictions
- `postop-care` - General recovery instructions
- `physical-therapy` - Post-op PT guidelines
- `constipation-care` - Post-surgical constipation prevention

**Educational (1 document):**
- `opioid-education` - Pain management education

**Administrative (1 document):**
- `instructions-state-disability` - **NEW** - California SDI filing instructions

**Equipment/Optional:**
- `game-ready` - Cold therapy device instructions

### Recent Critical Information Added
- **Antibiotic Prophylaxis**: 2-year dental procedure requirements, 3-month restriction after surgery
- **Travel Restrictions**: No domestic flights 6 weeks, no international flights 3 months
- **Work Return Timeline**: 1-3 months depending on job type and recovery
- **Administrative Deadlines**: SDI filing must be done day after surgery (Sept 13, 2025)
- **DMV Forms**: Handicapped placard application for recovery period parking

### Personal Notes & Documentation
- `/notes/` directory contains personal project management files:
  - `mssa-test-results.md` - Medical test results and communications
  - `todo.txt` - Personal pre-surgery checklist and tasks
  - Additional notes, messages, and tracking information
- These files provide context for personal tasks beyond the formal medical documentation
- May contain sensitive personal information - handle with appropriate privacy considerations

### YAML Frontmatter Required
```yaml
---
title: "Document Title"
emoji: "📋"
source_image: "../scans_md/filename.jpg"
category: "pre-operative" | "post-operative" | "education"
order: 1
---
```

## Common Tasks & Patterns

### When Adding New Content
1. Place scan in `scans_md/descriptive-name.jpg`
2. Create OCR file as `scans_md/descriptive-name-ocr.jpg.md`
3. Create clean markdown in `docs/descriptive-name.md`
4. Generate HTML in `docs/descriptive-name.html`
5. Update navigation if needed
6. Keep `PROJECT_CONTEXT.md` up to date.
7. Keep `.vscode/copilot-instructions.md` up to date.

### When Working with Personal Notes
1. Personal files in `/notes/` provide additional context
2. Respect privacy - these may contain sensitive personal information
3. Use for understanding project scope and personal tasks
4. May reference external communications, test results, or personal reminders
5. Can inform updates to main documentation when relevant

### When Reorganizing Files
1. Plan all operations as batch commands
2. Update HTML source image links
3. Verify content mappings remain intact
4. Clean up temporary/metadata files
5. Test responsive design and links

### When Updating Content
1. Edit markdown source in `/docs` directory
2. Regenerate corresponding HTML with consistent styling
3. Preserve patient personalization (Jeff, specific dates)
4. Maintain medical accuracy
5. Test mobile responsiveness
6. Keep `PROJECT_CONTEXT.md` up to date.
7. Keep `.vscode/copilot-instructions.md` up to date.
## Quality Standards

- **Medical Accuracy**: All medical information must remain precise
- **Accessibility**: High contrast, large touch targets, semantic HTML
- **Mobile Optimization**: Primary access during recovery is mobile
- **Print Support**: Many pages need clean print layouts
- **Local Storage**: Interactive features persist user data
- **Cross-References**: All document links must work correctly

## Emergency Information in Content
- **Dr. Jeffrey Wilde**: (858) 554-7993
- **Game Ready (Amy Weiner)**: (619) 823-2691, amy@therapedix.com
- **Luna PT**: (619) 966-3822
- **Surgery**: September 12, 2025, 7:30am check-in
- **Scripps Mission Valley**: 7425 Mission Valley Rd, Suite 202, San Diego, CA 92108
- **After Hours**: Scripps operator (858) 554-9100, request on-call Orthopedist

## Critical Dates & Deadlines
- **September 5, 2025**: Start pre-op medications and skin washing (7 days before)
- **September 12, 2025**: Surgery day, 7:30am check-in
- **September 13, 2025**: File California State Disability claim (earliest date)
- **October 24, 2025**: Domestic flight restrictions end (6 weeks post-op)
- **December 12, 2025**: Hip movement restrictions end, dental visits can resume, international flights allowed (3 months post-op)

## Deployment
- **Repository**: GitHub (jeff-hamm organization)
- **Hosting**: GitHub Pages
- **Domain**: infinitehips.infinitebutts.com via Cloudflare
- **Process**: Standard git workflow auto-deploys

## User Experience Priorities
1. **Ease during recovery** - Large buttons, clear text, minimal cognitive load
2. **Family coordination** - Shareable links, collaborative features
3. **Visual comfort** - Dark theme for extended screen time
4. **Medical compliance** - Accurate, accessible information

## Technical Constraints
- Modern browsers only (ES6+ JavaScript)
- Local storage only (no cloud sync)
- Static site limitations
- No framework dependencies (vanilla web technologies)

## OCR Processing Guidelines

### Always Use OpenCV-Enhanced OCR
- **Script**: `batch_ocr_opencv.py` for medical document processing
- **Method**: OpenCV preprocessing (grayscale, Gaussian blur, OTSU thresholding) + pytesseract
- **Installation**: `pip install opencv-python` if needed
- **Workflow**: Place images in `scans_md/`, run script, creates `<name>-ocr.jpg.md` files

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

## Testing Checklist
- [ ] All pages load correctly
- [ ] Color scheme consistent (lighter pink, gray headers)
- [ ] Mobile responsive design works
- [ ] Interactive features save/load properly
- [ ] Cross-references between pages work
- [ ] Print layouts are clean

## Quick Reference Commands

### Git Operations (Be Very Helpful - User is Not Git Expert)

#### Basic Workflow
```bash
git add . && git commit -m "Description" && git push origin main
```

#### Common Git Tasks for Non-Git Users
```bash
# Check what files have changed
git status

# See what changes you made
git diff

# Save your work with a message
git add .
git commit -m "Brief description of what you changed"

# Upload your changes to GitHub
git push origin main

# Get the latest changes from GitHub
git pull origin main

# If you made a mistake, see recent commits
git log --oneline -10

# If you need to undo the last commit (but keep your changes)
git reset --soft HEAD~1
```

#### When Things Go Wrong
```bash
# If git push fails, try this first
git pull origin main

# If you have conflicts, you'll need to resolve them manually
# Look for files with <<<<<<< markers and edit them

# After fixing conflicts
git add .
git commit -m "Fixed merge conflicts"
git push origin main
```

### Local Development
```bash
python -m http.server 8000  # Then open http://localhost:8000
```

## Red Flags to Avoid
- ❌ Using green colors anywhere
- ❌ Bright pink (#ff007a) instead of lighter pink (#ff69b4)
- ❌ Pink gradient headers (should be gray gradient with pink text)
- ❌ Altering medical information accuracy
- ❌ Breaking mobile responsiveness
- ❌ Individual terminal commands when batching is possible
- ❌ Generic file names (scan1, scan2, etc.)

## Success Patterns
- ✅ Descriptive, content-based file names
- ✅ Batched terminal operations with `&&`
- ✅ Consistent color scheme (#ff69b4 pink, #0d1117 dark)
- ✅ 4-format content mapping preservation
- ✅ Mobile-first responsive design
- ✅ Clean, accessible medical documentation
- ✅ Patient-personalized content (Jeff, specific dates)

This project successfully transformed from basic document organization into a comprehensive digital health companion. Always prioritize medical accuracy, user experience during recovery, and the established design patterns.
