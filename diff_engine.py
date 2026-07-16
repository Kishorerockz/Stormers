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


import requests
import json

def evaluate_risk(visual_diff_score: float, text_summary: dict, api_key: str = None) -> dict:
    """
    Evaluates the risk of changes on a page using AI (Gemini or Groq).
    """
    THRESHOLD = 5.0
    if visual_diff_score < THRESHOLD and text_summary.get("total_changes", 0) < 10:
        return {
            "severity": "low",
            "explanation": "Minimal changes detected, likely dynamic content.",
            "recommended_action": "None"
        }
        
    print("[*] Threshold crossed. Asking AI for risk analysis...")
    
    prompt = f"""You are an AI security analyst for a Website Defacement Detection platform.
Analyze the following change detection report:
- Visual Diff Score: {visual_diff_score}% of pixels changed.
- DOM text changes count: {text_summary.get('total_changes', 0)}
- Sample additions: {text_summary.get('added_sample', [])}
- Sample deletions: {text_summary.get('removed_sample', [])}

Determine if this website has been defaced, compromised, or contains unauthorized structural modifications.
Provide your evaluation in JSON format with exactly three fields:
1. "severity": "low", "medium", or "high"
2. "explanation": A concise explanation of the changes and why they are flagged.
3. "recommended_action": Actionable remediation steps (e.g. "Rotate CMS admin credentials immediately and check recent login IPs").

JSON output structure:
{{
  "severity": "high",
  "explanation": "Brief description",
  "recommended_action": "Remediation step"
}}"""

    # Fetch API Keys from Env
    gemini_key = os.getenv("GEMINI_API_KEY") or api_key
    groq_key = os.getenv("GROQ_API_KEY")
    
    # Clean placeholders
    if gemini_key and "your_gemini_api_key" in gemini_key:
        gemini_key = None
    if groq_key and "your_groq_api_key" in groq_key:
        groq_key = None

    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            res = requests.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(text_out)
            else:
                print(f"[!] Gemini API call failed with status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[!] Gemini API call exception: {e}")

    if groq_key:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {groq_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }
            res = requests.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                text_out = data["choices"][0]["message"]["content"]
                return json.loads(text_out)
            else:
                print(f"[!] Groq API call failed with status {res.status_code}: {res.text}")
        except Exception as e:
            print(f"[!] Groq API call exception: {e}")

    # Fallback to mock response
    print("[!] No active AI keys or API calls failed. Using mock security analysis.")
    
    # Check for keywords in text diff for smarter mocking
    all_additions = " ".join(text_summary.get('added_sample', [])).lower()
    if "hacked" in all_additions or "anonymous" in all_additions or "deface" in all_additions:
        return {
            "severity": "high",
            "explanation": "Critical security incident. Defacement keywords 'hacked' or 'anonymous' detected in text changes.",
            "recommended_action": "Isolate the web server, check access logs, restore from clean backup, and rotate CMS keys."
        }
    
    return {
        "severity": "medium",
        "explanation": "Significant visual and structural changes detected, but no obvious defacement signature found.",
        "recommended_action": "Manually inspect the screenshot and DOM changes to verify legitimacy of update."
    }

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

