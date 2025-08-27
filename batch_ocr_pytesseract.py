import pytesseract
from pathlib import Path
from PIL import Image

def process_image_ocr(img_path):
    """Process a single image with OCR using pytesseract"""
    try:
        print(f"Processing: {img_path}")
        
        # Open and process the image
        with Image.open(img_path) as img:
            # OCR the image
            text = pytesseract.image_to_string(img)
        
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
    
    print("🔄 Re-processing medical documents with pytesseract OCR")
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
