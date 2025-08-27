from PIL import Image
import pytesseract
import os

# Process the preop-instructions.jpg file
image_path = 'scans_md/preop-instructions.jpg'
output_path = 'scans_md/preop-instructions-ocr.jpg.md'

# Open and OCR the image
with Image.open(image_path) as img:
    text = pytesseract.image_to_string(img)

# Write OCR text to markdown file
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(f'# OCR of preop-instructions.jpg\n\n')
    f.write(text)

print(f'OCR completed for preop-instructions.jpg')
print(f'Output saved to: {output_path}')
