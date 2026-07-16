import os
from PIL import Image, ImageChops
import difflib

# In real app, AI integration would happen here
# import groq or google.generativeai as genai

def compute_visual_diff(img1_path: str, img2_path: str, diff_output_path: str = None) -> float:
    """
    Ranjan's Deliverable: Visual Diff
    Compares two screenshots and returns the percentage of pixels changed.
    """
    try:
        with Image.open(img1_path) as img1, Image.open(img2_path) as img2:
            # Ensure same size for exact comparison (or handle size mismatch)
            if img1.size != img2.size:
                # Naive handling: resize img2 to match img1
                img2 = img2.resize(img1.size)
            
            # Compute difference
            diff = ImageChops.difference(img1, img2)
            
            # Optional: save the diff image for the dashboard
            if diff_output_path:
                diff.save(diff_output_path)
            
            # Calculate score: percentage of non-zero pixels
            # A simple bounding box check or true pixel count
            # Here we count non-black pixels in the diff
            bbox = diff.getbbox()
            if not bbox:
                return 0.0 # No difference
            
            pixels_changed = sum(1 for pixel in diff.getdata() if pixel != (0, 0, 0, 0) and pixel != (0, 0, 0))
            total_pixels = img1.size[0] * img1.size[1]
            diff_score_percent = (pixels_changed / total_pixels) * 100.0
            
            return diff_score_percent
    except Exception as e:
        print(f"[!] Error in visual diff: {e}")
        return 0.0


def compute_text_diff(text1: str, text2: str) -> dict:
    """
    Ranjan's Deliverable: Text/DOM Diff
    Produces a summary of added/removed text blocks.
    """
    # use difflib to find changes
    d = difflib.SequenceMatcher(None, text1.splitlines(), text2.splitlines())
    added = []
    removed = []
    
    for tag, i1, i2, j1, j2 in d.get_opcodes():
        if tag == 'replace' or tag == 'delete':
            removed.extend(text1.splitlines()[i1:i2])
        if tag == 'replace' or tag == 'insert':
            added.extend(text2.splitlines()[j1:j2])
            
    summary = {
        "added_lines": len(added),
        "removed_lines": len(removed),
        "total_changes": len(added) + len(removed),
        "added_sample": added[:5], # Send top 5 to AI
        "removed_sample": removed[:5] # Send top 5 to AI
    }
    return summary


def evaluate_risk(visual_diff_score: float, text_summary: dict, api_key: str = None) -> dict:
    """
    Ranjan's Deliverable: AI Risk Scoring (Mocked currently)
    If diff crosses threshold, pass to AI to assess.
    """
    # Threshold check
    THRESHOLD = 5.0
    if visual_diff_score < THRESHOLD and text_summary["total_changes"] < 10:
        return {"severity": "low", "explanation": "Minimal changes detected, likely dynamic content.", "recommended_action": "None"}
        
    print("[*] Threshold crossed. Asking AI for risk analysis...")
    
    # MOCK AI RESPONSE - You would use Groq (Llama-3) or Gemini here
    ai_response = {
        "severity": "high",
        "explanation": "Significant structural changes and text additions detected. The words 'hacked by' appear in the additions.",
        "recommended_action": "Isolate the server. Rotate CMS admin credentials immediately and check recent login IPs."
    }
    
    return ai_response

# Simple local tester
if __name__ == "__main__":
    t1 = "Welcome to our site.\nContact us at foo.\n"
    t2 = "Hacked by Anonymous.\nContact us at foo.\n"
    
    print("[*] Testing Text Diff")
    res = compute_text_diff(t1, t2)
    print(res)
    
    print("[*] Testing AI Risk Evaluation")
    risk = evaluate_risk(10.5, res)
    print(risk)
