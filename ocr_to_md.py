import os
from PIL import Image
import pytesseract

# Directory containing the images
dir_path = os.path.dirname(os.path.abspath(__file__))

# List all jpg files in the directory
image_files = [f for f in os.listdir(dir_path) if f.lower().endswith('.jpg')]

for img_file in image_files:
    img_path = os.path.join(dir_path, img_file)
    # Open image
    with Image.open(img_path) as img:
        # OCR the image
        text = pytesseract.image_to_string(img)
    # Prepare markdown filename
    md_file = os.path.splitext(img_file)[0] + '.md'
    md_path = os.path.join(dir_path, md_file)
    # Write OCR text to markdown file
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(f'# OCR of {img_file}\n\n')
        f.write(text)
print('OCR complete. Markdown files created.')
