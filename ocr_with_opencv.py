
import cv2
import pytesseract
from pathlib import Path

scans_dir = Path('scans_md')
image_files = [f for f in scans_dir.iterdir() if f.suffix.lower() == '.jpg' and not f.name.startswith('.')]

for img_path in image_files:
    try:
        img = cv2.imread(str(img_path))
        if img is None:
            print(f'Skipping {img_path.name}: not a valid image')
            continue
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Lighter preprocessing: just grayscale
        custom_config = r'--oem 3 --psm 4'
        text = pytesseract.image_to_string(gray, config=custom_config)
        md_file = img_path.parent / (img_path.stem + '_mac.md')
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(f'# OCR of {img_path.name}\n\n')
            f.write(text)
        print(f'OCR complete for {img_path.name}. Markdown file created: {md_file.name}')
    except Exception as e:
        print(f'Skipping {img_path.name}: {e}')
