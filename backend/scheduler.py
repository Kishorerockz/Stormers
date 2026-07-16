import asyncio
from backend.database import get_db_connection, log_audit
from backend.snapshot import capture_snapshot
from backend.diff_engine import compare_screenshots, compare_dom_texts
from backend.ai_scorer import analyze_changes_with_ai

async def run_snapshot_for_asset(asset_id: int, trigger_user_id: int = None) -> dict:
    """
    Executes snapshotting, runs the diff engine, calls AI risk assessment,
    creates alerts if changes are detected, and updates the asset state.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT url, label FROM assets WHERE id = ?", (asset_id,))
    asset = cursor.fetchone()
    if not asset:
        conn.close()
        return {"error": "Asset not found"}
        
    url = asset["url"]
    label = asset["label"]
    
    # Mark asset status as checking
    cursor.execute("UPDATE assets SET status = 'checking' WHERE id = ?", (asset_id,))
    conn.commit()
    
    try:
        # 1. Capture snapshot
        snap_res = capture_snapshot(url)
        
        # 2. Store snapshot in DB
        cursor.execute(
            "INSERT INTO snapshots (asset_id, screenshot_path, dom_hash, dom_text) VALUES (?, ?, ?, ?)",
            (asset_id, snap_res["screenshot_path"], snap_res["dom_hash"], snap_res["dom_text"])
        )
        new_snap_id = cursor.lastrowid
        conn.commit()
        
        # 3. Retrieve previous snapshot
        cursor.execute(
            "SELECT id, screenshot_path, dom_hash, dom_text FROM snapshots WHERE asset_id = ? AND id < ? ORDER BY id DESC LIMIT 1",
            (asset_id, new_snap_id)
        )
        prev_snap = cursor.fetchone()
        
        if prev_snap:
            # We have a baseline! Let's check for differences
            dom_changed = prev_snap["dom_hash"] != snap_res["dom_hash"]
            
            # Generate path for visual diff image
            diff_img_path = snap_res["screenshot_path"].replace(".png", "_diff.png")
            visual_diff_score = compare_screenshots(
                prev_snap["screenshot_path"], 
                snap_res["screenshot_path"], 
                diff_img_path
            )
            
            # Create alert if visual change > 2% or text changes detected
            if visual_diff_score > 2.0 or dom_changed:
                text_diff = compare_dom_texts(prev_snap["dom_text"], snap_res["dom_text"])
                
                # Analyze changes with Gemini/fallback heuristics
                ai_res = analyze_changes_with_ai(url, visual_diff_score, text_diff)
                
                # Insert alert row
                cursor.execute(
                    """INSERT INTO alerts (asset_id, snapshot_id_before, snapshot_id_after, diff_score, severity, ai_explanation, recommended_action, status)
                       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')""",
                    (asset_id, prev_snap["id"], new_snap_id, visual_diff_score, ai_res["severity"], ai_res["explanation"], ai_res["recommended_action"])
                )
                alert_id = cursor.lastrowid
                
                # Flag the asset if severity is medium or high
                new_status = 'flagged' if ai_res["severity"] in ['high', 'medium'] else 'clean'
                cursor.execute("UPDATE assets SET status = ? WHERE id = ?", (new_status, asset_id))
                conn.commit()
                
                log_audit(
                    user_id=trigger_user_id or 1,
                    action=f"System generated alert {alert_id} for asset '{label}' ({url}). Visual diff: {visual_diff_score}%, Severity: {ai_res['severity']}.",
                    target_type="alert",
                    target_id=alert_id
                )
            else:
                # No significant changes detected
                cursor.execute("UPDATE assets SET status = 'clean' WHERE id = ?", (asset_id,))
                conn.commit()
        else:
            # Baseline snapshot captured
            cursor.execute("UPDATE assets SET status = 'clean' WHERE id = ?", (asset_id,))
            conn.commit()
            
        conn.close()
        return {"success": True, "snapshot_id": new_snap_id}
        
    except Exception as e:
        # Revert status to clean in case of error
        cursor.execute("UPDATE assets SET status = 'clean' WHERE id = ?", (asset_id,))
        conn.commit()
        conn.close()
        print(f"Error checking asset {asset_id} ({url}): {e}")
        return {"error": str(e)}

async def scheduler_loop():
    """
    Infinite background task that scans monitored websites every 30 seconds.
    """
    print("Defacement monitor background scheduler started.")
    while True:
        try:
            await asyncio.sleep(30)
            
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM assets")
            assets = cursor.fetchall()
            conn.close()
            
            for asset in assets:
                # Poll sequentially in background
                await run_snapshot_for_asset(asset["id"])
                
        except asyncio.CancelledError:
            print("Scheduler loop stopped.")
            break
        except Exception as e:
            print(f"Error in scheduler loop: {e}")
