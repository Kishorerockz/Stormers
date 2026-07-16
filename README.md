# Website Defacement Detection & Vulnerability Assessment Platform

**Domain:** Cyber Security & Web Mining
**Event:** System Siege (PS-005)

## Overview
A scalable platform to autonomously monitor target websites for structural and visual changes, highlighting potential defacement attacks or unauthorized access. It correlates pixel-level visual differences and DOM-level text changes, using AI to evaluate risks and recommend immediate remediation actions.

## Setup Instructions
1. Clone the repository.
2. Ensure you have Python 3.10+ installed.
3. Install frontend dependencies with `npm install` inside the frontend folder.
4. Setup a Python virtual environment and install backend requirements (`pip install -r requirements.txt`).
5. Run `playwright install chromium` to fetch the standalone browser.
6. Copy `.env.example` to `.env` and fill in API keys and database parameters.

## AI Disclosure
> **Mandatory Disclosure**: This project heavily relies on the **Groq API** utilizing the **llama-3.3-70b-versatile** model (or specify Google Gemini Flash if used) to evaluate DOM textual differences and generate risk severity + recommended remediation plans.

## Known Limitations
- The system currently flags rapidly changing dynamic content (e.g. ad banners, clocks) as visual shifts. We recommend masking known dynamic zones for long-term deployments.
- Polling is done sequentially on a cron job, which limits the real-time alerting granularity to the batch size window (e.g., 5-15 mins).
- Backend Authentication implements basic RBAC; explicit session invalidation and IP rate-limiting are slated for future iterations.
