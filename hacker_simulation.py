import threading
import time
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler

# Simulating a website that gets hacked
CLEAN_HTML = b"<html><body><h1>Acme Corp Homepage</h1><p>Our business systems are running smoothly.</p></body></html>"
HACKED_HTML = b"<html><body style='color:red'><h1>PWNED BY THE SYSTEM SIEGE</h1><p>Send 5 bitcoin immediately or face consequences.</p></body></html>"
is_hacked = False

class VictimHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(HACKED_HTML if is_hacked else CLEAN_HTML)

def run_victim_server():
    server = HTTPServer(("localhost", 8085), VictimHandler)
    server.serve_forever()

if __name__ == "__main__":
    print("🛡️ Booting up local Victim Server on port 8085...")
    t = threading.Thread(target=run_victim_server, daemon=True)
    t.start()
    
    # 1. Login to the Dashboard API
    print("🔑 Authenticating with Aegis Server...")
    login = requests.post("http://localhost:8000/auth/login", json={"email":"admin@platform.local", "password":"admin123"})
    if login.status_code != 200:
        print("Login failed! Is uvicorn running on 8000?")
        exit()
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Add Victim Server to Monitor List
    print("🌐 Registering target URL: http://localhost:8085")
    asset = requests.post("http://localhost:8000/assets", json={"url":"http://localhost:8085", "label":"Local Bank"}, headers=headers).json()
    asset_id = asset["id"]
    
    # 3. Take Baseline Snapshot
    print("📸 Taking clean baseline snapshot...")
    r1 = requests.post(f"http://localhost:8000/assets/{asset_id}/snapshot", headers=headers)
    print("RES1:", r1.status_code, r1.text)
    time.sleep(1)
    
    # 4. TRIGER THE ATTACK!
    print("🚨 INITIATING CYBER ATTACK: Defacing the victim server!")
    is_hacked = True
    
    # 5. Take Second Snapshot to trigger detection
    print("📸 Security Scheduler running second scan...")
    r2 = requests.post(f"http://localhost:8000/assets/{asset_id}/snapshot", headers=headers)
    print("RES2:", r2.status_code, r2.text)
    
    # 6. Retrieve Alerts
    print("📊 Evaluating generated Security Alerts...")
    alerts = requests.get("http://localhost:8000/alerts", headers=headers).json()
    
    if len(alerts) > 0:
        latest = alerts[0]
        print(f"\n===== THREAT DETECTED =====")
        print(f"Visual Pixel Shift: {latest['diff_score']}%")
        print(f"AI Severity Score:  {latest['severity'].upper()}")
        print(f"AI Diagnostics:     {latest['ai_explanation']}")
        print(f"Action Playbook:    {latest['recommended_action']}")
        print(f"===========================\n")
    else:
        print("No alerts generated.")
