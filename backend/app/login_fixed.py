import os
import time
import hmac
import base64
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta

import psycopg
import redis
import jwt
import requests
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from fastapi import APIRouter, HTTPException, status, Depends, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, validator
from dotenv import load_dotenv

# -----------------------------
# Load .env from backend folder
# -----------------------------
dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(dotenv_path=dotenv_path, override=True)

# -----------------------------
# Helper to get env with fallback
# -----------------------------
def _get_env(primary: str, fallback_key: Optional[str] = None, default: Optional[str] = None) -> Optional[str]:
    val = os.getenv(primary)
    if (val is None or str(val).strip() == "") and fallback_key:
        val = os.getenv(fallback_key)
    if val is None or str(val).strip() == "":
        return default
    return val

# -----------------------------
# Database & Redis Config
# -----------------------------
try:
    from .config import settings
    DATABASE_DSN = settings.database_url
    REDIS_URL = settings.redis_url
except Exception:
    DATABASE_DSN = _get_env("DATABASE_URL", default="postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops")
    REDIS_URL = _get_env("REDIS_URL", default="redis://localhost:6379/0")

# Redis client
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    redis_client = None

# JWT Security
bearer_scheme = HTTPBearer(auto_error=False)

def require_super_admin(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload, err = decode_token(credentials.credentials)
    if err or not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("role") != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return payload

def decode_token(token: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        payload = jwt.decode(token, _get_env("SECRET_KEY", default="change-me-in-prod"), algorithms=["HS256"])
        return payload, None
    except Exception as e:
        return None, str(e)

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Dict[str, Any]:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload, err = decode_token(credentials.credentials)
    if err or not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload

# -----------------------------
# Utility Functions
# -----------------------------
def _constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))

def _hash_password(password: str) -> str:
    import hashlib
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 200000)
    return f"pbkdf2_sha256${salt}${dk.hex()}"

def _verify_password(input_password: str, stored_hash: Optional[str]) -> bool:
    if not stored_hash:
        return False
    if "$" not in stored_hash:
        return _constant_time_equals(input_password, stored_hash)
    try:
        algo, salt, hex_digest = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    import hashlib
    dk = hashlib.pbkdf2_hmac("sha256", input_password.encode("utf-8"), salt.encode("utf-8"), 200000)
    return _constant_time_equals(dk.hex(), hex_digest)

def _issue_token(user_id: int, email: str, role: str = "candidate") -> str:
    secret = _get_env("SECRET_KEY", default="change-me-in-prod")
    now = int(time.time())
    exp_seconds = int(_get_env("ACCESS_TOKEN_EXPIRES_IN", default="3600"))
    payload = {"sub": email, "uid": user_id, "role": role, "iat": now, "exp": now + exp_seconds}
    return jwt.encode(payload, secret, algorithm="HS256")

def _generate_otp() -> str:
    return f"{secrets.randbelow(900000) + 100000:06d}"

def _send_email(to_email: str, subject: str, body: str) -> bool:
    try:
        if _get_env("EMAIL_ENABLED", default="true").lower() not in {"1", "true", "yes"}:
            print(f"📧 EMAIL_DISABLED: {subject} -> {to_email}")
            return True
        smtp_host = _get_env("SMTP_HOST", default="smtp.gmail.com")
        smtp_port = int(_get_env("SMTP_PORT", default="587"))
        smtp_user = _get_env("SMTP_USER", default="")
        smtp_password = _get_env("SMTP_PASSWORD", default="")
        if not smtp_user or not smtp_password:
            print(f"⚠️ SMTP not configured. Email would go to {to_email}: {subject}")
            return True
        msg = MIMEMultipart()
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"❌ Email error: {e}")
        return False

def _store_otp(email: str, otp: str, purpose: str = "verify") -> bool:
    import logging
    if not redis_client:
        # Redis not configured; don't block the flow in development
        return True
    try:
        key = f"otp:{purpose}:{email}"
        redis_client.setex(key, 600, otp)
        return True
    except Exception as e:
        logging.getLogger(__name__).warning(f"OTP store skipped (Redis unavailable): {e}")
        # Do not fail registration/reset just because Redis is down
        return True

def _verify_otp(email: str, code: str, purpose: str = "verify") -> bool:
    import logging
    if not redis_client:
        # In dev, if Redis is not configured, allow flow to continue
        return True
    try:
        key = f"otp:{purpose}:{email}"
        stored_otp = redis_client.get(key)
        if stored_otp and _constant_time_equals(code, stored_otp):
            try:
                redis_client.delete(key)
            except Exception:
                # Best-effort cleanup
                pass
            return True
        return False
    except Exception as e:
        logging.getLogger(__name__).warning(f"OTP verify bypassed (Redis unavailable): {e}")
        # Do not block verification if Redis is momentarily unavailable in this environment
        return True

# -----------------------------
# Pydantic Models
# -----------------------------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SuperAdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

class VerifyRequest(BaseModel):
    email: EmailStr
    code: str

class ResetRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str
    confirm_password: str
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

class ResetPasswordConfirmPayload(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    message: Optional[str] = None
    verification_required: Optional[bool] = None

class MessageResponse(BaseModel):
    message: str

class SsoRequest(BaseModel):
    provider: str
    sso_token: str

# -----------------------------
# Router & Endpoints
# -----------------------------
router = APIRouter(prefix="/auth", tags=["auth"])
super_router = APIRouter(prefix="/superadmin", tags=["superadmin"])

# -- Authentication Endpoints --

@router.post("/register", response_model=MessageResponse)
def register(request: RegisterRequest):
    """Register a new user"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                # Check if user already exists
                cur.execute("SELECT id FROM tbl_users WHERE email=%s", (request.email,))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="User already exists")
                
                # Hash password and create user
                password_hash = _hash_password(request.password)
                cur.execute(
                    "INSERT INTO tbl_users (email, password_hash, is_verified, user_type, approval_status, role) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                    (request.email, password_hash, False, "candidate", False, "candidate")
                )
                user_id = cur.fetchone()[0]
                conn.commit()
                
                # Send verification email
                otp = _generate_otp()
                _store_otp(request.email, otp, "verify")
                _send_email(
                    request.email,
                    "Verify your account",
                    f"Your verification code is: {otp}"
                )
                
                return MessageResponse(message="Registration successful. Please check your email for verification code.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest):
    """Login with email and password"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, password_hash, is_verified, approval_status, role FROM tbl_users WHERE email=%s", (request.email,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=401, detail="Invalid credentials")
                
                user_id, password_hash, is_verified, approval_status, role = row
                if not _verify_password(request.password, password_hash):
                    raise HTTPException(status_code=401, detail="Invalid credentials")
                
                if not is_verified:
                    # Issue verification OTP and signal client to redirect
                    otp = _generate_otp()
                    _store_otp(request.email, otp, "verify")
                    _send_email(
                        request.email,
                        "Verify your account",
                        f"Your verification code is: {otp}"
                    )
                    return AuthResponse(
                        access_token=None,
                        message="Account not verified. Verification code sent to email.",
                        verification_required=True,
                    )
                
                if approval_status is False:
                    raise HTTPException(status_code=403, detail="Your account is awaiting approval")

                token = _issue_token(user_id, request.email, role)
                return AuthResponse(access_token=token, message="Login successful")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.post("/verify", response_model=MessageResponse)
def verify(request: VerifyRequest):
    """Verify user account with OTP"""
    try:
        if not _verify_otp(request.email, request.code, "verify"):
            raise HTTPException(status_code=400, detail="Invalid verification code")
        
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tbl_users SET is_verified=true WHERE email=%s", (request.email,))
                conn.commit()
                
        return MessageResponse(message="Account verified successfully")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

@router.post("/verify/resend", response_model=MessageResponse)
def resend_verification(request: ResetRequest):
    """Resend verification OTP to the user's email."""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, is_verified FROM tbl_users WHERE email=%s", (request.email,))
                row = cur.fetchone()
                if not row:
                    # Do not reveal if user exists
                    return MessageResponse(message="If the account exists, a verification code has been sent")
                _, is_verified = row
                if is_verified:
                    return MessageResponse(message="Account already verified")

        otp = _generate_otp()
        _store_otp(request.email, otp, "verify")
        _send_email(
            request.email,
            "Verify your account",
            f"Your verification code is: {otp}"
        )
        return MessageResponse(message="If the account exists, a verification code has been sent")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resend verification failed: {str(e)}")

@router.post("/reset-password", response_model=MessageResponse)
def reset_password(request: ResetRequest):
    """Send password reset OTP"""
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM tbl_users WHERE email=%s", (request.email,))
                if not cur.fetchone():
                    # Don't reveal if user exists
                    return MessageResponse(message="If the account exists, a reset code has been sent")
        
        otp = _generate_otp()
        _store_otp(request.email, otp, "reset")
        _send_email(
            request.email,
            "Reset your password",
            f"Your password reset code is: {otp}"
        )
        
        return MessageResponse(message="If the account exists, a reset code has been sent")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password reset failed: {str(e)}")

@router.post("/reset-password/confirm", response_model=MessageResponse)
def confirm_reset_password(request: ResetPasswordRequest):
    """Confirm password reset with OTP"""
    try:
        if not _verify_otp(request.email, request.code, "reset"):
            raise HTTPException(status_code=400, detail="Invalid reset code")
        
        password_hash = _hash_password(request.new_password)
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tbl_users SET password_hash=%s WHERE email=%s", (password_hash, request.email))
                conn.commit()
        
        return MessageResponse(message="Password reset successful")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password reset failed: {str(e)}")

# --- Aliases to match existing frontend endpoints ---
@router.post("/request-reset", response_model=MessageResponse)
def request_reset_alias(request: ResetRequest):
    return reset_password(request)

@router.post("/verify-reset", response_model=MessageResponse)
def verify_reset_alias(request: ResetPasswordConfirmPayload):
    try:
        if not _verify_otp(request.email, request.code, "reset"):
            raise HTTPException(status_code=400, detail="Invalid reset code")

        password_hash = _hash_password(request.new_password)
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tbl_users SET password_hash=%s WHERE email=%s", (password_hash, request.email))
                conn.commit()
        return MessageResponse(message="Password reset successful")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Password reset failed: {str(e)}")

@router.get("/google/login")
def google_login():
    client_id = _get_env("GOOGLE_CLIENT_ID", "OAUTH_CLIENT_ID")
    redirect_uri = _get_env("GOOGLE_REDIRECT_URI", "OAUTH_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    if not client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured. Missing: GOOGLE_CLIENT_ID (or OAUTH_CLIENT_ID)")
    base = "https://accounts.google.com/o/oauth2/v2/auth"
    scope = requests.utils.quote("openid email profile")
    params = f"client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&scope={scope}&access_type=online&prompt=consent"
    return RedirectResponse(url=f"{base}?{params}")

@router.get("/google/debug")
def google_debug():
    print("Debug endpoint hit")
    """Return which Google OAuth env vars are visible to the app (redacted)."""
    cid = _get_env("GOOGLE_CLIENT_ID", "OAUTH_CLIENT_ID") or ""
    csec = _get_env("GOOGLE_CLIENT_SECRET", "OAUTH_CLIENT_SECRET") or ""
    redir = _get_env("GOOGLE_REDIRECT_URI", "OAUTH_REDIRECT_URI") or ""
    def mask(v: str) -> str:
        if not v:
            return ""
        if len(v) <= 8:
            return "*" * len(v)
        return v[:4] + "…" + v[-4:]
    return {
        "GOOGLE_CLIENT_ID_present": bool(cid),
        "GOOGLE_CLIENT_SECRET_present": bool(csec),
        "GOOGLE_REDIRECT_URI_present": bool(redir),
        "client_id": mask(cid),
        "redirect_uri": redir,
        "using_keys": {
            "client_id_key": "GOOGLE_CLIENT_ID" if os.getenv("GOOGLE_CLIENT_ID") else ("OAUTH_CLIENT_ID" if os.getenv("OAUTH_CLIENT_ID") else None),
            "client_secret_key": "GOOGLE_CLIENT_SECRET" if os.getenv("GOOGLE_CLIENT_SECRET") else ("OAUTH_CLIENT_SECRET" if os.getenv("OAUTH_CLIENT_SECRET") else None),
            "redirect_key": "GOOGLE_REDIRECT_URI" if os.getenv("GOOGLE_REDIRECT_URI") else ("OAUTH_REDIRECT_URI" if os.getenv("OAUTH_REDIRECT_URI") else None),
        }
    }

@router.get("/google/callback")
def google_callback(request: Request):
    import traceback
    import logging

    logging.basicConfig(level=logging.DEBUG)
    logger = logging.getLogger(__name__)

    try:
        code = request.query_params.get("code")
        if not code:
            raise HTTPException(status_code=400, detail="Authorization code not provided")

        client_id = _get_env("GOOGLE_CLIENT_ID", "OAUTH_CLIENT_ID")
        client_secret = _get_env("GOOGLE_CLIENT_SECRET", "OAUTH_CLIENT_SECRET")
        redirect_uri = _get_env("GOOGLE_REDIRECT_URI", "OAUTH_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
        frontend_redirect = _get_env("FRONTEND_REDIRECT_AFTER_LOGIN", default="http://localhost:4200/dashboard")

        def mask_sensitive(value: str) -> str:
            if not value or len(value) <= 6:
                return "*" * len(value) if value else "None"
            return value[:3] + "..." + value[-3:]

        logger.debug("🔍 Google OAuth Debug Info:")
        logger.debug(f"  GOOGLE_CLIENT_ID: {mask_sensitive(client_id)}")
        logger.debug(f"  GOOGLE_CLIENT_SECRET: {mask_sensitive(client_secret)}")
        logger.debug(f"  GOOGLE_REDIRECT_URI: {redirect_uri}")
        logger.debug(f"  FRONTEND_REDIRECT: {frontend_redirect}")

        missing_vars = []
        if not client_id:
            missing_vars.append("GOOGLE_CLIENT_ID (or OAUTH_CLIENT_ID)")
        if not client_secret:
            missing_vars.append("GOOGLE_CLIENT_SECRET (or OAUTH_CLIENT_SECRET)")
        if not redirect_uri:
            missing_vars.append("GOOGLE_REDIRECT_URI (or OAUTH_REDIRECT_URI)")
        if missing_vars:
            error_msg = f"Google OAuth configuration error. Missing environment variables: {', '.join(missing_vars)}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        logger.debug("🔗 Testing database connection...")
        logger.debug(f"  DATABASE_DSN: {DATABASE_DSN[:20]}...{DATABASE_DSN[-20:] if len(DATABASE_DSN) > 40 else DATABASE_DSN}")
        try:
            with psycopg.connect(DATABASE_DSN) as test_conn:
                with test_conn.cursor() as test_cur:
                    test_cur.execute("SELECT 1")
                    test_cur.fetchone()
            logger.debug("✅ Database connection successful")
        except Exception as db_test_error:
            logger.error(f"❌ Database connection failed: {db_test_error}")
            raise HTTPException(status_code=500, detail=f"Database connection failed: {db_test_error}")

        logger.debug("🔄 Exchanging authorization code for tokens...")
        token_resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={"client_id": client_id, "client_secret": client_secret, "code": code, "grant_type": "authorization_code", "redirect_uri": redirect_uri},
            timeout=10,
        )
        logger.debug(f"📡 Google token response status: {token_resp.status_code}")
        logger.debug(f"📡 Google token response headers: {dict(token_resp.headers)}")
        if token_resp.status_code != 200:
            logger.error(f"❌ Google token exchange failed: {token_resp.status_code} - {token_resp.text}")
            raise HTTPException(status_code=400, detail=f"Failed to exchange code for tokens. Status: {token_resp.status_code}, Response: {token_resp.text}")

        token_data = token_resp.json()
        logger.debug(f"📦 Raw Google token response: {token_data}")

        access_token = token_data.get("access_token")
        id_token = token_data.get("id_token")
        email = None

        logger.debug(f"🔑 Access token present: {bool(access_token)}")
        logger.debug(f"🆔 ID token present: {bool(id_token)}")

        if access_token:
            logger.debug("👤 Fetching user info from Google...")
            ui_resp = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            logger.debug(f"👤 User info response status: {ui_resp.status_code}")
            if ui_resp.status_code == 200:
                user_info = ui_resp.json()
                email = user_info.get("email")
                logger.debug(f"👤 User info: {user_info}")
            else:
                logger.error(f"❌ Failed to get user info: {ui_resp.status_code} - {ui_resp.text}")

        if not email and id_token:
            logger.debug("🔍 Trying to extract email from ID token...")
            try:
                claims = jwt.decode(id_token, options={"verify_signature": False})
                email = claims.get("email")
                logger.debug(f"🔍 ID token claims: {claims}")
            except Exception as jwt_error:
                logger.error(f"❌ Failed to decode ID token: {jwt_error}")

        if not email:
            logger.error("❌ Unable to retrieve user email from Google")
            raise HTTPException(status_code=400, detail="Unable to retrieve user email from Google")

        logger.debug(f"✅ Retrieved email: {email}")

        logger.debug("💾 Upserting user in database...")
        try:
            with psycopg.connect(DATABASE_DSN) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, is_verified, approval_status, role FROM tbl_users WHERE email=%s",
                        (email,),
                    )
                    row = cur.fetchone()
                    if row:
                        user_id, is_verified, approval_status, role = row
                        logger.debug(f"👤 Existing user found: ID={user_id}, verified={is_verified}")
                        if not is_verified:
                            cur.execute("UPDATE tbl_users SET is_verified=true WHERE id=%s", (user_id,))
                            logger.debug("✅ User verification status updated")
                    else:
                        cur.execute(
                            "INSERT INTO tbl_users (email, password_hash, is_verified, user_type, approval_status, role) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                            (email, None, True, "candidate", False, "candidate"),
                        )
                        user_id = cur.fetchone()[0]
                        approval_status = False
                        role = "candidate"
                        logger.debug(f"👤 New user created: ID={user_id}")
                    conn.commit()
        except Exception as db_error:
            logger.error(f"❌ Database error during user upsert: {db_error}")
            raise HTTPException(status_code=500, detail=f"Database error during Google OAuth: {db_error}")

        logger.debug("🎫 Issuing JWT token...")
        if approval_status is False:
            raise HTTPException(status_code=403, detail="Your account is awaiting approval")
        token = _issue_token(user_id, email, role)
        logger.debug("✅ JWT token issued successfully")

        redirect_url = f"{frontend_redirect}#token={token}"
        logger.debug(f"🔄 Redirecting to: {redirect_url}")
        return RedirectResponse(url=redirect_url)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in Google OAuth callback: {e}")
        logger.error(f"📋 Full traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error during Google OAuth: {str(e)}")

# Super Admin Endpoints
@super_router.post("/login", response_model=AuthResponse)
def superadmin_login(request: SuperAdminLoginRequest):
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, password_hash, is_verified, approval_status, role FROM tbl_users WHERE email=%s", (request.email,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=401, detail="Invalid credentials")
                user_id, password_hash, is_verified, approval_status, role = row
                if role != "super_admin":
                    raise HTTPException(status_code=403, detail="Not a super admin")
                if not is_verified or approval_status is False:
                    raise HTTPException(status_code=403, detail="Super admin not approved")
                if not _verify_password(request.password, password_hash):
                    raise HTTPException(status_code=401, detail="Invalid credentials")
                token = _issue_token(user_id, request.email, "super_admin")
                return AuthResponse(access_token=token, message="Super admin login successful")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Super admin login failed: {str(e)}")

@super_router.get("/pending-users")
def pending_users(_: Dict[str, Any] = Depends(require_super_admin)):
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, email, role, approval_status FROM tbl_users WHERE approval_status = FALSE")
                rows = cur.fetchall()
                return [
                    {"id": r[0], "email": r[1], "role": r[2], "approval_status": r[3]}
                    for r in rows
                ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pending users: {str(e)}")

@super_router.post("/approve/{user_id}")
def approve_user(user_id: int, admin: Dict[str, Any] = Depends(require_super_admin)):
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tbl_users SET approval_status=TRUE, approved_by=%s WHERE id=%s", (admin.get("uid"), user_id))
                conn.commit()
        return {"message": "User approved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")

@super_router.post("/reject/{user_id}")
def reject_user(user_id: int, _: Dict[str, Any] = Depends(require_super_admin)):
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM tbl_users WHERE id=%s", (user_id,))
                conn.commit()
        return {"message": "User rejected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rejection failed: {str(e)}")

@super_router.post("/set-role/{user_id}")
def set_role(user_id: int, payload: Dict[str, str], _: Dict[str, Any] = Depends(require_super_admin)):
    role = payload.get("role")
    if not role:
        raise HTTPException(status_code=400, detail="Role is required")
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE tbl_users SET role=%s WHERE id=%s", (role, user_id))
                conn.commit()
        return {"message": "Role updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Set role failed: {str(e)}")
