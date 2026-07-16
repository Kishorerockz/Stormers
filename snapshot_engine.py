import asyncio
import hashlib
import json
import os
from datetime import datetime
from playwright.async_api import async_playwright

# In a real app, these would come from your DB/Config
STORAGE_DIR = "./snapshots"

async def capture_snapshot(asset_id: str, url: str):
    """
    Kishore's Deliverable:
    Given a URL, capture a full-page screenshot & serialize DOM text.
    Computes a SHA-256 hash of the text to cheaply detect changes later.
    """
    os.makedirs(STORAGE_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_filename = f"{asset_id}_{timestamp}.png"
    screenshot_path = os.path.join(STORAGE_DIR, screenshot_filename)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print(f"[*] Navigating to {url}...")
        try:
            # Wait until there are no network connections for at least 500 ms.
            await page.goto(url, wait_until="networkidle")
        except Exception as e:
            print(f"[!] Failed to load {url}: {e}")
            await browser.close()
            return None
            
        # 1. Capture Full Page Screenshot
        print(f"[*] Capturing screenshot...")
        await page.screenshot(path=screenshot_path, full_page=True)
        
        # 2. Extract DOM Text content (ignoring scripts & styles)
        print(f"[*] Extracting DOM text...")
        dom_text = await page.evaluate("""
            () => {
                // Return text content of the body, falling back to documentElement
                return document.body ? document.body.innerText : document.documentElement.innerText;
            }
        """)
        
        # Normalize text (remove extra whitespaces) to prevent flaky hashes
        normalized_text = " ".join(dom_text.split()) if dom_text else ""
        
        # 3. Compute Content Hash (SHA-256)
        dom_hash = hashlib.sha256(normalized_text.encode('utf-8')).hexdigest()
        
        await browser.close()
        
        # Return the data that Vasanth's backend will need to insert into the DB
        result = {
            "asset_id": asset_id,
            "url": url,
            "screenshot_path": screenshot_path,
            "dom_hash": dom_hash,
            "dom_text": normalized_text,
            "captured_at": timestamp
        }
        
        print(f"[+] Snapshot complete for {asset_id}!")
        # Print a clean, truncated preview for logging
        print_preview = result.copy()
        print_preview["dom_text"] = normalized_text[:200] + "..." if len(normalized_text) > 200 else normalized_text
        print(json.dumps(print_preview, indent=2))
        
        return result

# Simple tester for local run
if __name__ == "__main__":
    asyncio.run(capture_snapshot("asset_001", "https://example.com"))
