import os
import difflib
from PIL import Image, ImageChops, ImageDraw

def compare_screenshots(path1: str, path2: str, diff_output_path: str) -> float:
    """
    Compares two screenshots pixel-by-pixel.
    Generates a high-contrast diff image highlighting changes in neon pink.
    Returns the percentage of pixels changed (0.0 to 100.0).
    """
    if not os.path.exists(path1) or not os.path.exists(path2):
        return 0.0
        
    img1 = Image.open(path1).convert('RGB')
    img2 = Image.open(path2).convert('RGB')
    
    # Standardize dimensions to img1 size
    if img1.size != img2.size:
        img2 = img2.resize(img1.size)
        
    width, height = img1.size
    
    # Calculate difference
    diff = ImageChops.difference(img1, img2)
    
    diff_pixels = diff.getdata()
    img1_pixels = img1.getdata()
    
    overlay = Image.new('RGBA', (width, height))
    
    changed_pixels = 0
    total_pixels = width * height
    threshold = 30 # absolute difference threshold for R+G+B
    
    new_data = []
    for i, diff_pixel in enumerate(diff_pixels):
        r_diff, g_diff, b_diff = diff_pixel
        if (r_diff + g_diff + b_diff) > threshold:
            changed_pixels += 1
            new_data.append((255, 0, 128, 255)) # Bright Neon Pink highlight
        else:
            r, g, b = img1_pixels[i]
            # Faded background to make the red highlights stand out
            new_data.append((r, g, b, 70))
            
    overlay.putdata(new_data)
    os.makedirs(os.path.dirname(diff_output_path), exist_ok=True)
    overlay.save(diff_output_path, "PNG")
    
    diff_score = (changed_pixels / total_pixels) * 100.0
    return round(diff_score, 2)

def compare_dom_texts(text1: str, text2: str) -> str:
    """
    Compares two DOM text streams and returns a unified diff.
    """
    lines1 = text1.splitlines()
    lines2 = text2.splitlines()
    
    diff = difflib.unified_diff(
        lines1, 
        lines2, 
        fromfile="Before", 
        tofile="After", 
        lineterm=""
    )
    return "\n".join(list(diff))
