import os
import json

try:
    from google import genai
    from google.genai import types
    HAS_GEMINI_SDK = True
except ImportError:
    HAS_GEMINI_SDK = False

def analyze_changes_with_ai(url: str, visual_score: float, text_diff: str) -> dict:
    """
    Evaluates changes on the website using Gemini Flash.
    Falls back to local heuristic scoring if the API key is not present or if the call fails.
    """
    from backend.database import get_setting
    api_key = get_setting("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
    
    if not HAS_GEMINI_SDK or not api_key:
        return {
            "severity": "high",
            "explanation": "SYSTEM ERROR: AI Analysis bypassed. GEMINI_API_KEY is not configured in settings. You MUST configure a valid BYOK key in the dashboard to receive scoring.",
            "recommended_action": "Configure a valid Google Gemini API Key via the Admin Dashboard."
        }
        
    try:
        client = genai.Client(api_key=api_key)
        prompt = f"""You are a cybersecurity expert monitoring for website defacement and security vulnerabilities.
        
We detected a modification on a monitored website. Analyze the diff details below:

URL: {url}
Visual Diff Score: {visual_score}% pixels changed
DOM/Text Diff Details:
{text_diff[:3000]}  # Truncate to stay within context and limit request size

Determine the risk of website defacement, malicious hijack, content manipulation, or security compromise.
Respond in strict JSON format matching this schema:
{{
  "severity": "low" | "medium" | "high",
  "explanation": "A concise explanation of why this risk was determined and what changed.",
  "recommended_action": "Remediation action for the website administrator (e.g. check logs, update CMS, revert changes, check admin sessions)."
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
        if "severity" in data and "explanation" in data and "recommended_action" in data:
            if data["severity"] not in ["low", "medium", "high"]:
                data["severity"] = "medium"
            return data
            
        raise ValueError("Invalid response schema from Gemini API")
        
    except Exception as e:
        return {
            "severity": "high",
            "explanation": f"AI Scoring Failed during sequence execution: {str(e)}",
            "recommended_action": "Check the exact spelling of your Gemini API BYOK token, or review application quota limits in your Google profile."
        }
