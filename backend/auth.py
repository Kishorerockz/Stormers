import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
from backend.database import get_db_connection

SECRET_KEY = "cyber_security_defacement_detection_platform_secret_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 hours

security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, db_hash = hashed_password.split('$')
        pwd_bytes = plain_password.encode('utf-8')
        check_hash = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt.encode('utf-8'), 100000).hex()
        return check_hash == db_hash
    except Exception:
        return False

def hash_password(password: str) -> str:
    salt = "platform_default_salt"
    pwd_bytes = password.encode('utf-8')
    db_hash = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt.encode('utf-8'), 100000).hex()
    return f"{salt}${db_hash}"

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("id")
        role: str = payload.get("role")
        if email is None or user_id is None or role is None:
            raise credentials_exception
        return {"id": user_id, "email": email, "role": role}
    except jwt.PyJWTError:
        raise credentials_exception

def check_admin_role(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation not permitted. Admin role required."
        )
    return current_user
