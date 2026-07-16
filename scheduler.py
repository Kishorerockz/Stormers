import asyncio
import os
from datetime import datetime
import database
import snapshot_engine
import diff_engine

async def run_asset_check(asset: dict, is_manual: bool = False, trigger_user_id: int = None):
    """
    Executes a check on a single asset.
    Captures a snapshot, compares with previous snapshot,
    performs visual/text diffing, calls AI risk scoring,
    and logs/alerts accordingly.
    """
    asset_id = asset["id"]
    url = asset["url"]
    
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    # 1. Update asset status to checking
    cursor.execute("UPDATE assets SET status = 'checking' WHERE id = ?", (asset_id,))
    conn.commit()
    
    # Write audit log for scan initiation
    action_by = f"User (ID: {trigger_user_id})" if trigger_user_id else "System Scheduler"
    database.log_action(
        user_id=trigger_user_id,
        action=f"{action_by} initiated scan for asset '{asset['label']}' ({url})",
        target_type="asset",
        target_id=asset_id
    )
    
    # 2. Fetch latest snapshot (before this check)
    cursor.execute("""
        SELECT * FROM snapshots 
        WHERE asset_id = ? 
        ORDER BY id DESC LIMIT 1
    """, (asset_id,))
    prev_row = cursor.fetchone()
    prev_snapshot = dict(prev_row) if prev_row else None
    
    # 3. Capture new snapshot
    try:
        new_snap_data = await snapshot_engine.capture_snapshot(str(asset_id), url)
    except Exception as e:
        clean_err = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"[!] Exception during capture_snapshot for asset {asset_id}: {clean_err}")
        new_snap_data = None
        
    if not new_snap_data:
        # Scan failed (e.g. connection error, DNS resolution error)
        cursor.execute("UPDATE assets SET status = 'flagged' WHERE id = ?", (asset_id,))
        conn.commit()
        conn.close()
        
        # Log failure in audit log
        database.log_action(
            user_id=trigger_user_id,
            action=f"Scan failed for asset '{asset['label']}': Page could not be loaded",
            target_type="asset",
            target_id=asset_id
        )
        return None
        
    # 4. Save new snapshot to DB
    cursor.execute("""
        INSERT INTO snapshots (asset_id, screenshot_path, dom_hash, dom_text)
        VALUES (?, ?, ?, ?)
    """, (
        asset_id,
        new_snap_data["screenshot_path"],
        new_snap_data["dom_hash"],
        new_snap_data["dom_text"]
    ))
    new_snapshot_id = cursor.lastrowid
    conn.commit()
    
    new_status = 'clean'
    
    # 5. Compare with previous snapshot if it exists
    if prev_snapshot:
        prev_snap_id = prev_snapshot["id"]
        
        # Check text diff
        if prev_snapshot["dom_hash"] == new_snap_data["dom_hash"]:
            text_summary = {
                "added_lines": 0,
                "removed_lines": 0,
                "total_changes": 0,
                "added_sample": [],
                "removed_sample": []
            }
        else:
            text_summary = diff_engine.compute_text_diff(
                prev_snapshot["dom_text"],
                new_snap_data["dom_text"]
            )
            
        # Check visual diff
        diff_filename = f"diff_{asset_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        diff_path = os.path.join(snapshot_engine.STORAGE_DIR, diff_filename)
        
        visual_diff_score = diff_engine.compute_visual_diff(
            prev_snapshot["screenshot_path"],
            new_snap_data["screenshot_path"],
            diff_path
        )
        
        # Threshold: visual change >= 5% OR text changes >= 10 lines
        THRESHOLD_VISUAL = 5.0
        THRESHOLD_TEXT = 10
        
        cross_threshold = (visual_diff_score >= THRESHOLD_VISUAL) or (text_summary["total_changes"] >= THRESHOLD_TEXT)
        
        if cross_threshold:
            # Call AI to evaluate risk
            ai_eval = diff_engine.evaluate_risk(visual_diff_score, text_summary)
            
            # Create Alert row
            cursor.execute("""
                INSERT INTO alerts (
                    asset_id, snapshot_id_before, snapshot_id_after,
                    diff_score, severity, ai_explanation, recommended_action, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open')
            """, (
                asset_id,
                prev_snap_id,
                new_snapshot_id,
                visual_diff_score,
                ai_eval.get("severity", "medium"),
                ai_eval.get("explanation", "Potential defacement detected."),
                ai_eval.get("recommended_action", "Inspect changes immediately."),
            ))
            alert_id = cursor.lastrowid
            conn.commit()
            
            # Update asset status based on severity
            severity = ai_eval.get("severity", "medium").lower()
            if severity in ["medium", "high"]:
                new_status = 'flagged'
                
            database.log_action(
                user_id=trigger_user_id,
                action=f"System generated alert {alert_id} (severity: {severity}) for asset '{asset['label']}'",
                target_type="alert",
                target_id=alert_id
            )
    else:
        # First scan ever, it is deemed clean
        pass
        
    cursor.execute("UPDATE assets SET status = ? WHERE id = ?", (new_status, asset_id))
    conn.commit()
    conn.close()
    
    return new_snapshot_id

scheduler_running = False

async def start_scheduler_loop():
    """
    Background job that polls the assets table every 15 seconds
    and triggers a snapshot scan for each asset.
    """
    global scheduler_running
    if scheduler_running:
        return
    scheduler_running = True
    print("[*] Background scheduler loop started.")
    
    while scheduler_running:
        try:
            await asyncio.sleep(15)
            if not scheduler_running:
                break
                
            conn = database.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM assets")
            assets = [dict(row) for row in cursor.fetchall()]
            conn.close()
            
            for asset in assets:
                # Do not run overlapping checks for the same asset if it's already checking
                if asset.get("status") == "checking":
                    continue
                asyncio.create_task(run_asset_check(asset))
        except Exception as e:
            print(f"[!] Error in scheduler loop: {e}")

def stop_scheduler_loop():
    """
    Stops the background scheduler loop.
    """
    global scheduler_running
    scheduler_running = False
    print("[*] Background scheduler loop stopped.")
