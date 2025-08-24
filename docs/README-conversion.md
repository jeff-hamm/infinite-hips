# Infinite Hips - Markdown to HTML Conversion Guide

This directory contains structured markdown files that can be easily converted to HTML and back. Each markdown file follows a consistent format with YAML frontmatter for metadata.

## File Structure

### Markdown Files (`.md`)
- `preop-skin-wash.md` - Hibiclens washing instructions
- `mrsa-screening.md` - MRSA/MSSA screening information
- `surgery-schedule.md` - Surgery appointments and timeline
- `preop-instructions.md` - General pre-operative instructions
- `opioid-education.md` - Opioid safety education
- `postop-medications.md` - Post-operative medication instructions
- `postop-care.md` - Incision care and activity guidelines
- `physical-therapy.md` - Physical therapy instructions
- `constipation-care.md` - Constipation management
- `game-ready.md` - Game Ready cold therapy equipment

### HTML Files (`.html`)
Corresponding HTML files with the same base names exist for each markdown file.

## Markdown Format Structure

Each markdown file includes:

### YAML Frontmatter
```yaml
---
title: "Document Title"
emoji: "🔥"
source_image: "../scans_md/source_image.jpg"
category: "preoperative|postoperative|education|equipment"
order: 1
---
```

### Content Structure
1. **Header** - Title with emoji
2. **Source Link** - Reference to original scanned document
3. **Content Sections** - Organized with consistent heading hierarchy
4. **Special Elements:**
   - `> Blockquotes` for important warnings/highlights
   - `**Bold text**` for emphasis
   - `- Bullet lists` for instructions
   - `| Tables |` for structured data
   - `### Subheadings` for organization

## Conversion Guidelines

### From Markdown to HTML
When converting markdown to HTML, preserve:
- YAML frontmatter data for HTML `<title>` and metadata
- Emoji in the main heading
- Source image links in a dedicated section
- Blockquotes as highlight/warning boxes with appropriate CSS classes
- Consistent navigation structure

### HTML Template Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[title] - Infinite Hips</title>
    <link rel="stylesheet" href="../assets/dark-theme.css">
</head>
<body>
    <div class="nav">
        <a href="../index.html">← Back to Main Index</a>
    </div>

    <div class="header">
        <h1>[emoji] [title]</h1>
    </div>

    <div class="content">
        <div class="source-link">
            <a href="[source_image]" target="_blank">📸 View Original Document Image</a>
        </div>
        
        <!-- Content converted from markdown -->
    </div>
</body>
</html>
```

### CSS Classes to Apply
- `.highlight` - For important blockquotes
- `.warning` - For warning blockquotes  
- `.danger` - For critical safety information
- `.instructions` - For step-by-step instructions
- `.medication` - For medication information
- `.contact-box` - For contact information
- `.appointment-table` - For appointment schedules

## Special Markdown Elements

### Blockquotes
- `> **Important:**` → `.highlight` class
- `> **⚠️ Warning:**` → `.warning` class  
- `> Taking opioids...death:` → `.danger` class

### Tables
Surgery schedule and appointment tables should be converted to HTML tables with proper styling.

### Lists
- Numbered lists for sequential instructions
- Bullet lists for non-sequential items
- Nested lists for sub-items

## File Relationships

### Source Document Mapping
- `scan1_page1.jpg` → `preop-skin-wash.md`
- `scan2_page1_20250822.jpg` → `mrsa-screening.md`
- `scan3_page1.jpg` → `surgery-schedule.md` & `preop-instructions.md`
- `scan4_page1.jpg` → `game-ready.md`
- `scan4_page1_20250822.jpg` → `opioid-education.md`
- `scan5_page1.jpg` → `physical-therapy.md`
- `scan5_page1_20250822.jpg` → `postop-medications.md`
- `scan6_page1.jpg` → `constipation-care.md`
- `scan6_page1_20250822.jpg` → `postop-care.md`

### Categories
- **preoperative**: Documents needed before surgery
- **postoperative**: Documents for after surgery
- **education**: Educational materials about medications/risks
- **equipment**: Optional equipment information

## Conversion Scripts

To automate conversion, create scripts that:
1. Parse YAML frontmatter for metadata
2. Convert markdown content to HTML
3. Apply appropriate CSS classes based on content patterns
4. Generate proper navigation and source links
5. Maintain consistent styling with the "Infinite Hips" theme

## Theme Consistency

All HTML output should maintain:
- Dark theme (#0d1117 background)
- Pink accent colors (#ff69b4, #ffb3da)
- Mobile-responsive design
- Consistent navigation patterns
- Semantic HTML structure for accessibility
