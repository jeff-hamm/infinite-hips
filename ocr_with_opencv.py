import cv2
import pytesseract
from pathlib import Path

# Path to the image
img_path = Path('scans_md/scan1_page1.jpg')

# Read image
img = cv2.imread(str(img_path))

# Preprocessing: convert to grayscale, increase contrast, denoise
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
# Apply adaptive thresholding
thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                               cv2.THRESH_BINARY, 31, 2)
# Optionally, denoise
denoised = cv2.fastNlMeansDenoising(thresh, None, 30, 7, 21)

# OCR with Tesseract
custom_config = r'--oem 3 --psm 6'
text = pytesseract.image_to_string(denoised, config=custom_config)

# Save OCR result
output_path = img_path.with_suffix('.ocr.txt')
with open(output_path, 'w') as f:
    f.write(text)

print(f'OCR complete. Output saved to {output_path}')
