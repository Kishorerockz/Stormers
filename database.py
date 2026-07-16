import sqlite3
import os
from datetime import datetime

DB_PATH = "test.db"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # 2. Create Assets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        owner_id INTEGER,
        status TEXT NOT NULL DEFAULT 'clean',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)
    
    # 3. Create Snapshots Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        screenshot_path TEXT NOT NULL,
        dom_hash TEXT NOT NULL,
        dom_text TEXT NOT NULL,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
    );
    """)
    
    # 4. Create Alerts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        snapshot_id_before INTEGER,
        snapshot_id_after INTEGER NOT NULL,
        diff_score REAL NOT NULL,
        severity TEXT NOT NULL,
        ai_explanation TEXT,
        recommended_action TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY(snapshot_id_before) REFERENCES snapshots(id) ON DELETE SET NULL,
        FOREIGN KEY(snapshot_id_after) REFERENCES snapshots(id) ON DELETE CASCADE
    );
    """)
    
    # 5. Create Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    """)
    
    conn.commit()
    conn.close()
    print("[*] SQLite Database initialized successfully.")

# Helper function to write audit log
def log_action(user_id: int, action: str, target_type: str = None, target_id: int = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO audit_logs (user_id, action, target_type, target_id)
        VALUES (?, ?, ?, ?)
    """, (user_id, action, target_type, target_id))
    conn.commit()
    conn.close()
