from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import psycopg
import os
from dotenv import load_dotenv

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

@router.get('/users')
async def get_users(role: Optional[str] = None):
    """Get all users or users by role"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if role:
            query = 'SELECT id, email, first_name, last_name, role FROM tbl_users WHERE role = %s AND is_verified = true'
            cursor.execute(query, (role,))
        else:
            query = 'SELECT id, email, first_name, last_name, role FROM tbl_users WHERE is_verified = true'
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
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import psycopg
import os
from dotenv import load_dotenv

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
