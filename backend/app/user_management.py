from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr
import psycopg
import os
from dotenv import load_dotenv
from app.login import _hash_password, _verify_password, get_current_user

# Load environment variables
load_dotenv()

# Create router with /api prefix
router = APIRouter(prefix="/api", tags=['user-management'])

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg.connect(
            host=os.getenv('PGHOST', 'localhost'),
            port=os.getenv('PGPORT', '5432'),
            user=os.getenv('PGUSER', 'postgres'),
            password=os.getenv('PGPASSWORD', ''),
            dbname=os.getenv('DB_NAME', 'kudzuops')
        )
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Database connection failed: {str(e)}')

# Request Models
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr

# Define /users/me BEFORE /users to ensure proper route matching
@router.get('/users/me')
async def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current logged-in user's profile"""
    conn = None
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail='User ID not found in token')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT id, email, first_name, last_name, role FROM tbl_users WHERE id = %s',
            (user_id,)
        )
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail='User not found')
        
        return {
            'id': result[0],
            'email': result[1],
            'first_name': result[2] or '',
            'last_name': result[3] or '',
            'role': result[4]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            try:
                cursor.close()
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=f'Failed to fetch user profile: {str(e)}')

@router.get('/users')
async def get_users(role: Optional[str] = None):
    """Get all users or users by role"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if role:
            query = 'SELECT id, email, first_name, last_name, role, reporting_to FROM tbl_users WHERE role = %s AND approval_status = true'
            cursor.execute(query, (role,))
        else:
            query = 'SELECT id, email, first_name, last_name, role, reporting_to FROM tbl_users WHERE approval_status = true'
            cursor.execute(query)
        
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return [
            {
                'id': user[0],
                'email': user[1],
                'first_name': user[2],
                'last_name': user[3],
                'role': user[4],
                'reporting_to': user[5] if len(user) > 5 else None,
                'name': f'{user[2] or ""} {user[3] or ""}'.strip() or user[1]
            }
            for user in users
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to fetch users: {str(e)}')

@router.get('/teamleaders')
async def get_team_leaders():
    """Get all team leaders"""
    return await get_users(role='team_leader')

@router.get('/recruiters')
async def get_recruiters():
    """Get all recruiters"""
    return await get_users(role='recruiter')

@router.get('/super-admins')
async def get_super_admins():
    """Get all super admins"""
    return await get_users(role='super_admin')

@router.get('/business-heads')
async def get_business_heads():
    """Get all business heads"""
    return await get_users(role='business_head')

@router.get('/cluster-managers')
async def get_cluster_managers():
    """Get all cluster managers"""
    return await get_users(role='cluster_manager')

@router.get('/managers')
async def get_managers():
    """Get all managers"""
    return await get_users(role='manager')

@router.put('/users/update-profile')
async def update_user_profile(
    request: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update current logged-in user's profile"""
    conn = None
    try:
        user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail='User ID not found in token')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if email is already taken by another user
        cursor.execute(
            'SELECT id FROM tbl_users WHERE email = %s AND id != %s',
            (request.email, user_id)
        )
        if cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Email is already taken by another user')
        
        # Update user profile
        cursor.execute(
            'UPDATE tbl_users SET first_name = %s, last_name = %s, email = %s WHERE id = %s',
            (request.first_name, request.last_name, request.email, user_id)
        )
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return {'message': 'Profile updated successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                cursor.close()
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=f'Failed to update profile: {str(e)}')

@router.put('/users/change-password/{user_id}')
async def change_password(
    user_id: int, 
    request: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Change user password - requires current password verification"""
    conn = None
    try:
        # Verify user can only change their own password
        current_user_id = current_user.get('uid') or current_user.get('user_id') or current_user.get('id')
        if not current_user_id or int(current_user_id) != user_id:
            raise HTTPException(status_code=403, detail='You can only change your own password')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get current user's password hash
        cursor.execute(
            'SELECT password_hash FROM tbl_users WHERE id = %s',
            (user_id,)
        )
        result = cursor.fetchone()
        
        if not result:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail='User not found')
        
        stored_password_hash = result[0]
        
        # Verify current password
        if not _verify_password(request.current_password, stored_password_hash):
            cursor.close()
            conn.close()
            raise HTTPException(status_code=401, detail='Current password is incorrect')
        
        # Hash new password
        new_password_hash = _hash_password(request.new_password)
        
        # Update password in database
        cursor.execute(
            'UPDATE tbl_users SET password_hash = %s WHERE id = %s',
            (new_password_hash, user_id)
        )
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return {'message': 'Password updated successfully'}
        
    except HTTPException:
        raise
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                cursor.close()
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=f'Failed to change password: {str(e)}')
