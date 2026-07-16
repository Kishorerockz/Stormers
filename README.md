# SIEGESHIELD: Website Defacement Detection & Vulnerability Assessment Platform

SiegeShield is an automated, real-time website defacement detection pipeline and vulnerability assessment dashboard. It periodically captures screenshot baselines, serializes HTML DOM text contents, runs visual and textual diff engines, and leverages Google Gemini Flash to score defacement risks and outline mitigation tasks.

- **Event:** System Siege
- **Problem Statement:** PS-005 Website Defacement Detection & Vulnerability Assessment Platform
- **Domain:** Cyber Security & Web Mining
- **Team Size:** 4

---

## 🚀 Setup & Execution Instructions

### Prerequisites
- Python 3.12+ (Tested on Python 3.12.3)
- Internet connection (for installing dependencies and Playwright Chromium binaries)

### 1. Installation
Navigate to the project root and install the dependencies directly:
```bash
# Install pip libraries (FastAPI, Uvicorn, Playwright, Pillow, Google GenAI, PyJWT)
python3 -m pip install --user --break-system-packages fastapi uvicorn playwright pillow google-genai pyjwt

# Download the headless Chromium browser runner for Playwright
python3 -m playwright install chromium
```

### 2. Configure Environment Variable (Optional)
This platform implements **Bring Your Own Key (BYOK)**. If you provide a Gemini API Key, it will use AI for threat analysis; otherwise, it automatically falls back to a highly accurate rule-based heuristic scoring engine.
```bash
export GEMINI_API_KEY="your_actual_gemini_api_key_here"
```

### 3. Run the Server
Launch the FastAPI server using Uvicorn:
```bash
python3 -m uvicorn backend.main:app --port 8000 --reload
```

### 4. Access the Dashboard
Open your browser and navigate to:
- Deployed URL (Local Development): **[http://localhost:8000](http://localhost:8000)**

---

## 🛡️ AI Disclosure & Technology Spec

- **AI Provider**: Google
- **AI Model**: `gemini-2.5-flash` (via the official `google-genai` SDK)
- **Role-Based Access Control (RBAC)**: Supported with `admin` and `viewer` roles, enforced at the API route layer with JWT tokens.
- **Audit Logging**: All state-modifying endpoints (login, adding assets, dismissing alerts, deleting assets) write a timestamped log to the SQLite audit trail.

---

## ⚙️ Known Limitations

1. **Dynamic Content Sensitivity (False Positives)**: High-activity websites with rotating advertisements, live ticker tape widgets, or timestamp clocks may trigger visual differences that cross the 2% threshold. *Future mitigation: Implement region exclusion masks.*
2. **Resource Constraints on Heavy Polling**: Polling is set to 30 seconds for demo purposes. On large-scale production sites (hundreds of targets), serial page loads will block, requiring a parallel task broker like Celery.
3. **No Geo-Distribution**: Snapshots are taken from the server's local IP. If a hacker targets specific geographical IP ranges (geo-based defacement), the system will not see it.
