import cv2
import pytesseract
from pathlib import Path
import sys
import os

def process_image_ocr(img_path):
    """Process a single image with OCR using OpenCV preprocessing optimized for medical documents"""
    try:
        print(f"Processing: {img_path}")
        
        # Read image
        img = cv2.imread(str(img_path))
        if img is None:
            print(f"Error: Could not read image {img_path}")
            return None
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply gentle Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Use OTSU thresholding instead of adaptive - better for medical documents
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Optional: slight morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        # OCR with Tesseract - use different PSM for better text recognition
        custom_config = r'--oem 3 --psm 4'  # PSM 4 is better for single column text
        text = pytesseract.image_to_string(cleaned, config=custom_config)
        
        # Create markdown-formatted OCR file
        base_name = img_path.stem
        output_path = img_path.parent / f"{base_name}-ocr.jpg.md"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'# OCR of {base_name}.jpg\n\n')
            f.write(text)
        
        print(f"✅ OCR complete: {output_path}")
        return output_path
        
    except Exception as e:
        print(f"❌ Error processing {img_path}: {e}")
        return None

def main():
    # Images we processed in this session
    images_to_process = [
        "scans_md/postop-antibiotics.jpg",
        "scans_md/postop-problems-and-precautions.jpg", 
        "scans_md/instructions-state-disability.jpg"
    ]
    
    print("🔄 Re-processing medical documents with OpenCV OCR")
    print("=" * 60)
    
    processed_count = 0
    for img_file in images_to_process:
        img_path = Path(img_file)
        if img_path.exists():
            result = process_image_ocr(img_path)
            if result:
                processed_count += 1
        else:
            print(f"⚠️  File not found: {img_file}")
    
    print("=" * 60)
    print(f"🎉 Processed {processed_count}/{len(images_to_process)} images successfully")

if __name__ == "__main__":
    main()
