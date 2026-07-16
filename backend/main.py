import asyncio
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import sqlite3

from backend.database import init_db, get_db_connection, log_audit
from backend.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, check_admin_role
)
from backend.scheduler import run_snapshot_for_asset, scheduler_loop

# Ensure directories exist at module import time
os.makedirs("/home/ranjan/.gemini/antigravity/scratch/defacement-detection-platform/data/screenshots", exist_ok=True)
os.makedirs("/home/ranjan/.gemini/antigravity/scratch/defacement-detection-platform/static", exist_ok=True)

app = FastAPI(title="Defacement Detection Platform API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class UserAuth(BaseModel):
    email: str
    password: str

class AssetCreate(BaseModel):
    url: str
    label: str

# Startup tasks
scheduler_task = None

@app.on_event("startup")
async def startup_event():
    global scheduler_task
    # Ensure database is set up
    init_db()
    # Ensure screenshot directory exists
    os.makedirs("/home/ranjan/.gemini/antigravity/scratch/defacement-detection-platform/data/screenshots", exist_ok=True)
    # Start background scheduler loop
    scheduler_task = asyncio.create_task(scheduler_loop())

@app.on_event("shutdown")
async def shutdown_event():
    global scheduler_task
    if scheduler_task:
        scheduler_task.cancel()

# --- Auth Routes ---

@app.post("/auth/register")
def register(user: UserAuth):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Default role for self-registration is 'viewer' to protect administrative access
        pwd_hash = hash_password(user.password)
        cursor.execute(
            "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
            (user.email, pwd_hash, "viewer")
        )
        conn.commit()
        user_id = cursor.lastrowid
        log_audit(user_id, f"Registered new user account: {user.email}", "user", user_id)
        return {"id": user_id, "email": user.email, "role": "viewer"}
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="User with this email already registered"
        )
    finally:
        conn.close()

@app.post("/auth/login")
def login(user: UserAuth):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, role FROM users WHERE email = ?", (user.email,))
    db_user = cursor.fetchone()
    conn.close()
    
    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = create_access_token({
        "sub": db_user["email"],
        "id": db_user["id"],
        "role": db_user["role"]
    })
    
    log_audit(db_user["id"], f"User logged in successfully: {db_user['email']}", "user", db_user["id"])
    return {"token": token, "role": db_user["role"], "email": db_user["email"]}

# --- Asset Routes ---

@app.post("/assets")
def create_asset(asset: AssetCreate, background_tasks: BackgroundTasks, current_user: dict = Depends(check_admin_role)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO assets (url, label, owner_id) VALUES (?, ?, ?)",
        (asset.url, asset.label, current_user["id"])
    )
    conn.commit()
    asset_id = cursor.lastrowid
    
    cursor.execute("SELECT * FROM assets WHERE id = ?", (asset_id,))
    new_asset = dict(cursor.fetchone())
    conn.close()
    
    log_audit(current_user["id"], f"Admin added monitored asset '{asset.label}' ({asset.url})", "asset", asset_id)
    
    # Trigger initial snapshot check in background immediately
    background_tasks.add_task(run_snapshot_for_asset, asset_id, current_user["id"])
    
    return new_asset

@app.get("/assets")
def get_assets(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets ORDER BY created_at DESC")
    assets = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return assets

@app.delete("/assets/{asset_id}", status_code=204)
def delete_asset(asset_id: int, current_user: dict = Depends(check_admin_role)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify asset exists
    cursor.execute("SELECT label, url FROM assets WHERE id = ?", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        conn.close()
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Delete related snapshots, alerts and asset
    cursor.execute("DELETE FROM alerts WHERE asset_id = ?", (asset_id,))
    cursor.execute("DELETE FROM snapshots WHERE asset_id = ?", (asset_id,))
    cursor.execute("DELETE FROM assets WHERE id = ?", (asset_id,))
    conn.commit()
    conn.close()
    
    log_audit(current_user["id"], f"Admin deleted monitored asset '{asset['label']}' ({asset['url']})", "asset", asset_id)
    return

# --- Snapshot Routes ---

@app.post("/assets/{asset_id}/snapshot")
async def trigger_snapshot(asset_id: int, current_user: dict = Depends(check_admin_role)):
    """
    Manually forces a snapshot and comparison run for a website.
    """
    result = await run_snapshot_for_asset(asset_id, current_user["id"])
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM snapshots WHERE id = ?", (result["snapshot_id"],))
    snapshot = dict(cursor.fetchone())
    conn.close()
    
    return snapshot

@app.get("/assets/{asset_id}/snapshots")
def get_snapshots(asset_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM snapshots WHERE asset_id = ? ORDER BY captured_at DESC", (asset_id,))
    snapshots = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return snapshots

# --- Alert Routes ---

@app.get("/alerts")
def get_alerts(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
    SELECT 
        a.*, 
        asst.label as asset_label, 
        asst.url as asset_url,
        s_before.screenshot_path as screenshot_path_before,
        s_after.screenshot_path as screenshot_path_after
    FROM alerts a
    JOIN assets asst ON a.asset_id = asst.id
    LEFT JOIN snapshots s_before ON a.snapshot_id_before = s_before.id
    LEFT JOIN snapshots s_after ON a.snapshot_id_after = s_after.id
    """
    params = []
    
    if status:
        query += " WHERE a.status = ?"
        params.append(status)
        
    query += """
    ORDER BY 
        CASE a.severity
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
        END ASC,
        a.created_at DESC
    """
    
    cursor.execute(query, params)
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts

@app.post("/alerts/{alert_id}/dismiss")
def dismiss_alert(alert_id: int, current_user: dict = Depends(check_admin_role)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT asset_id FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    if not alert:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
        
    cursor.execute("UPDATE alerts SET status = 'dismissed' WHERE id = ?", (alert_id,))
    
    # Check if there are any remaining open high/medium alerts for the same asset
    cursor.execute(
        "SELECT COUNT(*) FROM alerts WHERE asset_id = ? AND status = 'open' AND severity IN ('high', 'medium')",
        (alert["asset_id"],)
    )
    open_alerts_count = cursor.fetchone()[0]
    
    # If no open high/medium alerts left, reset asset status to clean
    if open_alerts_count == 0:
        cursor.execute("UPDATE assets SET status = 'clean' WHERE id = ?", (alert["asset_id"],))
        
    conn.commit()
    conn.close()
    
    log_audit(current_user["id"], f"Admin dismissed alert {alert_id}", "alert", alert_id)
    return {"id": alert_id, "status": "dismissed"}

@app.post("/alerts/{alert_id}/review")
def review_alert(alert_id: int, current_user: dict = Depends(check_admin_role)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT asset_id FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    if not alert:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
        
    cursor.execute("UPDATE alerts SET status = 'reviewed' WHERE id = ?", (alert_id,))
    conn.commit()
    conn.close()
    
    log_audit(current_user["id"], f"Admin marked alert {alert_id} as reviewed", "alert", alert_id)
    return {"id": alert_id, "status": "reviewed"}

# --- Audit Log Route ---

@app.get("/audit-logs")
def get_audit_logs(current_user: dict = Depends(check_admin_role)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT l.*, u.email as user_email 
        FROM audit_logs l 
        LEFT JOIN users u ON l.user_id = u.id 
        ORDER BY l.timestamp DESC
    """)
    logs = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return logs

@app.get("/snapshots/{snapshot_id}")
def get_snapshot(snapshot_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM snapshots WHERE id = ?", (snapshot_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return dict(row)

@app.get("/alerts/{alert_id}/diff")
def get_alert_diff(alert_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT snapshot_id_before, snapshot_id_after FROM alerts WHERE id = ?", (alert_id,))
    alert = cursor.fetchone()
    if not alert:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found")
        
    if not alert["snapshot_id_before"]:
        conn.close()
        return {"diff": ""}
        
    cursor.execute("SELECT dom_text FROM snapshots WHERE id = ?", (alert["snapshot_id_before"],))
    before = cursor.fetchone()
    cursor.execute("SELECT dom_text FROM snapshots WHERE id = ?", (alert["snapshot_id_after"],))
    after = cursor.fetchone()
    conn.close()
    
    if not before or not after:
        raise HTTPException(status_code=404, detail="Snapshot data missing")
        
    from backend.diff_engine import compare_dom_texts
    diff_text = compare_dom_texts(before["dom_text"], after["dom_text"])
    return {"diff": diff_text}

# --- Serving Frontend & Screenshots Static Files ---

# Mount screenshot uploads directory
app.mount(
    "/screenshots", 
    StaticFiles(directory="/home/ranjan/.gemini/antigravity/scratch/defacement-detection-platform/data/screenshots"), 
    name="screenshots"
)

# Mount SPA frontend
frontend_dir = "/home/ranjan/.gemini/antigravity/scratch/defacement-detection-platform/static"
os.makedirs(frontend_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
