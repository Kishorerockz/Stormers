import os
import sys
import shutil
import unittest
from PIL import Image

# Ensure the project root is in the path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.database import init_db, get_db_connection, DB_PATH
from backend.auth import hash_password, verify_password, create_access_token, jwt, SECRET_KEY, ALGORITHM
from backend.diff_engine import compare_screenshots, compare_dom_texts
from backend.ai_scorer import heuristic_scoring

class TestDefacementDetectionPlatform(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # Initialize the database
        init_db()
        
    def test_database_initialization(self):
        """Verify database exists and has seed users."""
        self.assertTrue(os.path.exists(DB_PATH))
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT email, role FROM users")
        users = {row["email"]: row["role"] for row in cursor.fetchall()}
        conn.close()
        
        self.assertIn("admin@platform.local", users)
        self.assertEqual(users["admin@platform.local"], "admin")
        self.assertIn("viewer@platform.local", users)
        self.assertEqual(users["viewer@platform.local"], "viewer")

    def test_auth_password_hashing(self):
        """Test PBKDF2 hashing and verification."""
        password = "supersecretpassword123"
        hashed = hash_password(password)
        self.assertTrue(verify_password(password, hashed))
        self.assertFalse(verify_password("wrongpassword", hashed))

    def test_auth_jwt_token_handling(self):
        """Test generation and parsing of access tokens."""
        payload = {"sub": "test@example.com", "id": 42, "role": "viewer"}
        token = create_access_token(payload)
        
        # Decode and assert
        decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        self.assertEqual(decoded["sub"], "test@example.com")
        self.assertEqual(decoded["id"], 42)
        self.assertEqual(decoded["role"], "viewer")

    def test_visual_diff_engine(self):
        """Create mock screenshots, run visual diff, verify scores & output overlay image."""
        os.makedirs("test_data", exist_ok=True)
        img1_path = "test_data/screen1.png"
        img2_path = "test_data/screen2.png"
        diff_path = "test_data/diff.png"
        
        # Image 1 (pure white)
        img1 = Image.new('RGB', (100, 100), color=(255, 255, 255))
        img1.save(img1_path)
        
        # Image 2 (white with a 20x20 black block in center, covering 4% of pixels)
        img2 = Image.new('RGB', (100, 100), color=(255, 255, 255))
        for x in range(40, 60):
            for y in range(40, 60):
                img2.putpixel((x, y), (0, 0, 0))
        img2.save(img2_path)
        
        # Calculate visual diff
        diff_score = compare_screenshots(img1_path, img2_path, diff_path)
        
        self.assertTrue(os.path.exists(diff_path))
        # Visual diff score should be around 4.0%
        self.assertGreater(diff_score, 3.5)
        self.assertLess(diff_score, 4.5)
        
        # Clean up test files
        if os.path.exists("test_data"):
            shutil.rmtree("test_data")

    def test_heuristic_scoring_logic(self):
        """Verify the fallback rule-based AI engine categorizes correctly."""
        # 1. Clean changes (small text edits)
        res1 = heuristic_scoring("https://company.com", 1.2, "Updated company description in header.", "")
        self.assertEqual(res1["severity"], "low")
        self.assertEqual(res1["attack_category"], "benign change")
        
        # 2. Medium visual change
        res2 = heuristic_scoring("https://company.com", 15.0, "No text changes.", "")
        self.assertEqual(res2["severity"], "medium")
        
        # 3. High alert visual change
        res3 = heuristic_scoring("https://company.com", 45.0, "No text changes.", "")
        self.assertEqual(res3["severity"], "high")
        self.assertEqual(res3["attack_category"], "defacement")
        
        # 4. Critical defacement keyword compromise
        res4 = heuristic_scoring("https://company.com", 5.0, "We are hacker group X. Your portal is HACKED and PWNED! Pay bitcoin.", "")
        self.assertEqual(res4["severity"], "high")
        self.assertEqual(res4["attack_category"], "defacement")
        self.assertIn("HACKED", res4["explanation"].upper())

        # 5. Malicious script injection (Structural Diff)
        res5 = heuristic_scoring("https://company.com", 0.0, "No text changes.", "-body\n+script\n+body")
        self.assertEqual(res5["severity"], "high")
        self.assertEqual(res5["attack_category"], "injected malware")

if __name__ == '__main__':
    unittest.main()
