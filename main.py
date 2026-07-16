import os
import asyncio
from fastapi import FastAPI, Depends, HTTPException, status, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
import database
import auth
import scheduler

app = FastAPI(
    title="Website Defacement Detection & Vulnerability Assessment API",
    description="Backend API for asset monitoring, visual/text diffing, audit logging, and RBAC security.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---
class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AssetCreate(BaseModel):
    url: str
    label: str

# --- Startup and Shutdown Hooks ---
@app.on_event("startup")
async def startup_event():
    # 1. Initialize SQLite Database Tables
    database.init_db()
    
    # 2. Seed Default Admin and Viewer if no users exist
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    if count == 0:
        # Seed admin
        admin_pw = auth.hash_password("admin123")
        cursor.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
            ("admin@stormers.com", admin_pw, "admin")
        )
        
        # Seed viewer
        viewer_pw = auth.hash_password("viewer123")
        cursor.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
            ("viewer@stormers.com", viewer_pw, "viewer")
        )
        conn.commit()
        print("[*] Seeded default users:\n  - Admin: admin@stormers.com / admin123\n  - Viewer: viewer@stormers.com / viewer123")
    conn.close()
    
    # 3. Start background monitoring scheduler
    asyncio.create_task(scheduler.start_scheduler_loop())

@app.on_event("shutdown")
def shutdown_event():
    scheduler.stop_scheduler_loop()

# --- Auth Endpoints ---
@app.post("/auth/register", status_code=201)
def register(req: RegisterRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Secure password hashing (pure-python or bcrypt)
    hashed_pw = auth.hash_password(req.password)
    
    # Make first user admin, others viewer
    cursor.execute("SELECT COUNT(*) FROM users")
    users_count = cursor.fetchone()[0]
    role = "admin" if users_count == 0 else "viewer"
    
    cursor.execute(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
        (req.email, hashed_pw, role)
    )
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Log Action
    database.log_action(user_id=user_id, action="User self-registered as role: " + role)
    
    return {"id": user_id, "email": req.email, "role": role}

@app.post("/auth/login")
def login(req: LoginRequest):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (req.email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    user = dict(row)
    if not auth.verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    # Generate Token
    token = auth.create_access_token({
        "id": user["id"],
        "email": user["email"],
        "role": user["role"]
    })
    
    # Log Action
    database.log_action(user_id=user["id"], action="User logged in successfully")
    
    return {"token": token, "role": user["role"]}

# --- Asset Management Endpoints ---
@app.post("/assets", status_code=201)
def add_asset(asset: AssetCreate, current_user: dict = Depends(auth.require_admin)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # URL Uniqueness Check
    cursor.execute("SELECT id FROM assets WHERE url = ?", (asset.url,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset with this URL already exists"
        )
        
    cursor.execute(
        "INSERT INTO assets (url, label, owner_id) VALUES (?, ?, ?)",
        (asset.url, asset.label, current_user["id"])
    )
    asset_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    row = cursor.fetchone()
    conn.close()
    
    # Log action
    database.log_action(
        user_id=current_user["id"],
        action=f"Asset added: '{asset.label}' ({asset.url})",
        target_type="asset",
        target_id=asset_id
    )
    
    return dict(row)

@app.get("/assets")
def get_assets(current_user: dict = Depends(auth.require_viewer)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.delete("/assets/{asset_id}", status_code=204)
def delete_asset(asset_id: int, current_user: dict = Depends(auth.require_admin)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Verify exists
    cursor.execute("SELECT label FROM assets WHERE id = ?", (asset_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Asset not found")
        
    asset_label = row["label"]
    
    # Delete asset (sqlite constraints will cascade delete screenshots/alerts if set up,
    # but we can explicitly clean up snapshots and alerts just in case)
    cursor.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
    conn.commit()
    conn.close()
    
    # Log action
    database.log_action(
        user_id=current_user["id"],
        action=f"Asset deleted: '{asset_label}' (ID: {asset_id})",
        target_type="asset",
        target_id=asset_id
    )
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# --- Snapshot Endpoints ---
@app.post("/assets/{asset_id}/snapshot")
async def trigger_snapshot(asset_id: int, current_user: dict = Depends(auth.require_viewer)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Asset not found")
        
    asset = dict(row)
    conn.close()
    
    # Trigger scan immediately
    new_snapshot_id = await scheduler.run_asset_check(
        asset=asset,
        is_manual=True,
        trigger_user_id=current_user["id"]
    )
    
    if not new_snapshot_id:
        raise HTTPException(
            status_code=500,
            detail="Snapshot execution failed. Verify URL is reachable and browser is installed."
        )
        
    # Retrieve and return the newly created snapshot
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM snapshots WHERE id = ?", (new_snapshot_id,))
    snap = cursor.fetchone()
    conn.close()
    
    return dict(snap)

@app.get("/assets/{asset_id}/snapshots")
def get_asset_snapshots(asset_id: int, current_user: dict = Depends(auth.require_viewer)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # Verify asset exists
    cursor.execute("SELECT id FROM assets WHERE id = ?", (asset_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Asset not found")
        
    cursor.execute(
        "SELECT id, asset_id, screenshot_path, dom_hash, captured_at FROM snapshots WHERE asset_id = ? ORDER BY id DESC",
        (asset_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# --- Alert Endpoints ---
@app.get("/alerts")
def get_alerts(status: Optional[str] = Query(None), current_user: dict = Depends(auth.require_viewer)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT alerts.*, assets.label as asset_label, assets.url as asset_url 
        FROM alerts
        JOIN assets ON alerts.asset_id = assets.id
    """
    params = []
    if status:
        query += " WHERE alerts.status = ?"
        params.append(status)
        
    query += " ORDER BY CASE alerts.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, alerts.created_at DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, current_user: dict = Depends(auth.require_admin)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT asset_id FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
        
    asset_id = row["asset_id"]
    
    cursor.execute(
        "UPDATE alerts SET status = 'dismissed' WHERE id = ?",
        (alert_id,)
    )
    conn.commit()
    
    # If no other open alerts remain for this asset, restore its status to clean
    cursor.execute(
        "SELECT COUNT(*) FROM alerts WHERE asset_id = ? AND status = 'open'",
        (asset_id,)
    )
    open_count = cursor.fetchone()[0]
    if open_count == 0:
        cursor.execute(
            "UPDATE assets SET status = 'clean' WHERE id = ?",
            (asset_id,)
        )
        conn.commit()
        
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    conn.close()
    
    # Log action
    database.log_action(
        user_id=current_user["id"],
        action=f"Alert {alert_id} dismissed",
        target_type="alert",
        target_id=alert_id
    )
    
    return dict(alert)

@app.post("/alerts/{alert_id}/review")
def review_alert(alert_id: int, current_user: dict = Depends(auth.require_admin)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM alerts WHERE id = ?", (alert_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
        
    cursor.execute(
        "UPDATE alerts SET status = 'reviewed' WHERE id = ?",
        (alert_id,)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    conn.close()
    
    # Log action
    database.log_action(
        user_id=current_user["id"],
        action=f"Alert {alert_id} marked as reviewed",
        target_type="alert",
        target_id=alert_id
    )
    
    return dict(alert)

# --- Audit Logs Endpoints ---
@app.get("/audit-logs")
def get_audit_logs(current_user: dict = Depends(auth.require_admin)):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT audit_logs.*, users.email as user_email
        FROM audit_logs
        LEFT JOIN users ON audit_logs.user_id = users.id
        ORDER BY audit_logs.timestamp DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
