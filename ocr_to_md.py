import os
from PIL import Image
import pytesseract

# Directory containing the images
dir_path = os.path.dirname(os.path.abspath(__file__))

# List all jpg files in the directory
image_files = [f for f in os.listdir(dir_path) if f.lower().endswith('.jpg') and not f.startswith('.')]

for img_file in image_files:
    img_path = os.path.join(dir_path, img_file)
    try:
        with Image.open(img_path) as img:
            text = pytesseract.image_to_string(img)
        # Prepare markdown filename (do not overwrite existing .md files)
        md_file = os.path.splitext(img_file)[0] + '_mac.md'
        md_path = os.path.join(dir_path, md_file)
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(f'# OCR of {img_file}\n\n')
            f.write(text)
        print(f'OCR complete for {img_file}. Markdown file created: {md_file}')
    except Exception as e:
        print(f'Skipping {img_file}: {e}')
print('OCR complete. Markdown files created.')
