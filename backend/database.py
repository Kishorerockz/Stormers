import sqlite3
import os
import hashlib

DB_PATH = os.environ.get("DATABASE_PATH", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "platform.db"))

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    salt = "platform_default_salt" # Simple robust salt representation
    pwd_bytes = password.encode('utf-8')
    db_hash = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt.encode('utf-8'), 100000).hex()
    return f"{salt}${db_hash}"

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'viewer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        label TEXT NOT NULL,
        owner_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'clean' CHECK(status IN ('clean', 'flagged', 'checking')),
        FOREIGN KEY (owner_id) REFERENCES users(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        screenshot_path TEXT NOT NULL,
        dom_hash TEXT NOT NULL,
        dom_text TEXT NOT NULL,
        dom_html TEXT,
        captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        snapshot_id_before INTEGER,
        snapshot_id_after INTEGER,
        diff_score REAL NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
        attack_category TEXT,
        ai_explanation TEXT,
        recommended_action TEXT,
        status TEXT DEFAULT 'open' CHECK(status IN ('open', 'reviewed', 'dismissed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id),
        FOREIGN KEY (snapshot_id_before) REFERENCES snapshots(id),
        FOREIGN KEY (snapshot_id_after) REFERENCES snapshots(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    """)

    conn.commit()

    # Dynamic migrations to add columns to existing database tables if they exist
    try:
        cursor.execute("ALTER TABLE snapshots ADD COLUMN dom_html TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass # Column already exists
        
    try:
        cursor.execute("ALTER TABLE alerts ADD COLUMN attack_category TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass # Column already exists

    # Seed default users if they do not exist
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        admin_pass = hash_password("admin123")
        viewer_pass = hash_password("viewer123")
        cursor.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)", 
                       ("admin@platform.local", admin_pass, "admin"))
        cursor.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)", 
                       ("viewer@platform.local", viewer_pass, "viewer"))
        conn.commit()
        print("Database seeded with default users.")

    conn.close()

def log_audit(user_id: int, action: str, target_type: str = None, target_id: int = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO audit_logs (user_id, action, target_type, target_id) VALUES (?, ?, ?, ?)",
        (user_id, action, target_type, target_id)
    )
    conn.commit()
    conn.close()
