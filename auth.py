import os
import hashlib
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False

SECRET_KEY = os.getenv("JWT_SECRET", "your_super_secret_jwt_key_here")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))

security = HTTPBearer()

def hash_password(password: str) -> str:
    """
    Hashes a password. Uses bcrypt if available, otherwise falls back
    to a pure-Python PBKDF2 scheme with salt.
    """
    if HAS_BCRYPT:
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    else:
        salt = secrets.token_hex(16)
        pw_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return f"pbkdf2_sha256$100000${salt}${pw_hash}"

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies a password against its hash.
    Supports both bcrypt hashes and pure-Python PBKDF2 hashes.
    """
    if hashed_password.startswith('$2b$') or hashed_password.startswith('$2a$'):
        if HAS_BCRYPT:
            try:
                return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
            except Exception:
                return False
        else:
            return False
    else:
        try:
            parts = hashed_password.split('$')
            if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
                return False
            iterations = int(parts[1])
            salt = parts[2]
            pw_hash = parts[3]
            test_hash = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode('utf-8'),
                salt.encode('utf-8'),
                iterations
            ).hex()
            return secrets.compare_digest(pw_hash, test_hash)
        except Exception:
            return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates a JWT access token containing claims.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodes and validates a JWT token.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to get the currently authenticated user from JWT payload.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload  # {"email": email, "role": role, "id": user_id}

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency to restrict endpoint access to admin role.
    """
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user

async def require_viewer(user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency to restrict access to viewers and admins.
    """
    if user.get("role") not in ["admin", "viewer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return user
