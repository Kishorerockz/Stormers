import os
import json

try:
    from google import genai
    from google.genai import types
    HAS_GEMINI_SDK = True
except ImportError:
    HAS_GEMINI_SDK = False

def analyze_changes_with_ai(url: str, visual_score: float, text_diff: str, structural_diff: str) -> dict:
    """
    Evaluates changes on the website using Gemini Flash.
    Falls back to local heuristic scoring if the API key is not present or if the call fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not HAS_GEMINI_SDK or not api_key:
        print("GEMINI_API_KEY env variable not set or google-genai not installed. Falling back to heuristic scoring.")
        return heuristic_scoring(url, visual_score, text_diff, structural_diff)
        
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""You are a cybersecurity expert monitoring for website defacement and security vulnerabilities.
        
We detected a modification on a monitored website. Analyze the diff signals below:

URL: {url}
Visual Diff Score: {visual_score}% pixels changed
Content/Text Diff Details:
{text_diff[:1500]}

Structural HTML Tags Diff Details:
{structural_diff[:1500]}

Determine the risk of website defacement, malicious hijack, content manipulation, or security compromise.
Respond in strict JSON format matching this schema:
{{
  "severity": "low" | "medium" | "high",
  "attack_category": "defacement" | "injected malware" | "phishing content" | "benign change",
  "explanation": "A concise explanation of why this risk was determined and what changed.",
  "recommended_action": "Remediation action for the website administrator (e.g. check logs, update CMS, revert changes)."
}}
Ensure the response is a single valid JSON string without markdown code block decoration (no ```json)."""

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        text = response.text.strip()
        data = json.loads(text)
        
        # Ensure schema compliance
        if "severity" in data and "attack_category" in data and "explanation" in data and "recommended_action" in data:
            if data["severity"] not in ["low", "medium", "high"]:
                data["severity"] = "medium"
            if data["attack_category"] not in ["defacement", "injected malware", "phishing content", "benign change"]:
                data["attack_category"] = "benign change"
            return data
            
        raise ValueError("Invalid response schema from Gemini API")
        
    except Exception as e:
        print(f"Gemini API call failed: {e}. Falling back to heuristic scoring.")
        return heuristic_scoring(url, visual_score, text_diff, structural_diff)

def heuristic_scoring(url: str, visual_score: float, text_diff: str, structural_diff: str) -> dict:
    """
    Local rule-based risk evaluation fallback analyzing visual, content, and structural HTML signals.
    """
    severity = "low"
    attack_category = "benign change"
    explanation = "No major visual, text, or structural changes detected."
    recommended_action = "Monitor future checks."
    
    text_lower = text_diff.lower()
    struct_lower = structural_diff.lower()
    
    # 1. Check for malicious tag injections (Structural Diff analysis)
    injected_scripts = "+script" in struct_lower or "+iframe" in struct_lower
    injected_forms = "+form" in struct_lower or "+input" in struct_lower
    
    suspicious_terms = ["hacked", "pwned", "defaced", "hacker", "bitcoin", "crypto", "casino", "viagra", "compromised", "leak", "ownz", "system siege"]
    found_terms = [term for term in suspicious_terms if term in text_lower]
    
    if found_terms:
        severity = "high"
        attack_category = "defacement"
        explanation = f"Critical alert: Suspicious keywords associated with hacking or unauthorized site content detected: {', '.join(found_terms)}."
        recommended_action = "Rotate CMS credentials, restore clean source files, check active web server sessions, and audit access logs."
    elif injected_scripts:
        severity = "high"
        attack_category = "injected malware"
        explanation = "Critical alert: Detected injection of script tags or iframes in the HTML structure, indicating potential XSS or malware infection."
        recommended_action = "Inspect source files for malicious scripts, verify CMS core integrity, and audit database inputs."
    elif visual_score > 35.0:
        severity = "high"
        attack_category = "defacement"
        explanation = f"High alert: Significant visual change ({visual_score}%) detected, suggesting a complete homepage layout redesign or defacement page insertion."
        recommended_action = "Check recent deployments, audit file integrity on the web server, and check public DNS records."
    elif injected_forms:
        severity = "medium"
        attack_category = "phishing content"
        explanation = "Medium alert: Detected insertion of forms or input elements in the HTML structure, suggesting potential phishing portals."
        recommended_action = "Check page layout and forms for credential stealing scripts or unauthorized endpoints."
    elif visual_score > 8.0:
        severity = "medium"
        attack_category = "benign change"
        explanation = f"Medium alert: Moderate visual change ({visual_score}%) or structural changes detected. This may indicate a layout modification or content update."
        recommended_action = "Confirm if this visual redesign or update was planned by the dev team."
    elif len(text_diff.strip()) > 100:
        severity = "medium"
        attack_category = "benign change"
        explanation = "Medium alert: Noticeable textual content modifications detected without significant visual layout restructuring."
        recommended_action = "Verify if these textual updates are authorized (e.g. blog post, product updates)."
    
    return {
        "severity": severity,
        "attack_category": attack_category,
        "explanation": explanation,
        "recommended_action": recommended_action
    }
