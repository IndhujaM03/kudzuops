# 🗄️ Kudzu Operations Database Setup Instructions

## 📁 Database Dump File Available

**File:** `backend/kudzu_database_complete_dump.sql`  
**Size:** 75 KB  
**Created:** October 23, 2025  
**Contains:** Complete database schema + all data (15 tables)

## 🚀 Quick Setup for New System

### Option 1: Using PostgreSQL Command Line

1. **Create the database:**
   ```bash
   createdb -U postgres kudzuops
   ```

2. **Restore the database:**
   ```bash
   psql -U postgres -d kudzuops -f backend/kudzu_database_complete_dump.sql
   ```

### Option 2: Using pgAdmin (GUI)

1. **Create database:**
   - Open pgAdmin
   - Right-click "Databases" → "Create" → "Database"
   - Name: `kudzuops`
   - Click "Save"

2. **Restore database:**
   - Right-click on `kudzuops` database
   - Select "Restore..."
   - Choose file: `backend/kudzu_database_complete_dump.sql`
   - Click "Restore"

### Option 3: Using Python Script

```python
import psycopg

# Connect to PostgreSQL
conn = psycopg.connect("postgresql://postgres:your_password@localhost:5432/kudzuops")

# Read and execute the dump file
with open('backend/kudzu_database_complete_dump.sql', 'r') as f:
    sql_content = f.read()
    
# Execute the SQL
with conn.cursor() as cur:
    cur.execute(sql_content)
    conn.commit()

print("✅ Database restored successfully!")
```

## 📊 What's Included in the Dump

### 🏗️ Database Schema (15 Tables)

1. **`tbl_users`** - User accounts and authentication
2. **`tbl_roles`** - User roles (superadmin, teamleader, recruiter)
3. **`tbl_role_permissions`** - Role-based permissions
4. **`tbl_clients`** - Client companies
5. **`tbl_client_spocs`** - Client SPOCs (Single Point of Contact)
6. **`tbl_demand_sheet`** - Job demands/requirements
7. **`tbl_recruiter_activity`** - Recruiter activities and submissions
8. **`tbl_cv_uploads`** - CV file uploads
9. **`tbl_cv_downloads`** - CV download tracking
10. **`tbl_submissions`** - Candidate submissions
11. **`tbl_candidate_submissions`** - Candidate application data
12. **`tbl_recruiter_submissions`** - Recruiter submission tracking
13. **`tbl_recruiter_settings`** - Recruiter preferences
14. **`tbl_otps`** - One-time passwords for verification
15. **`tbl_audit_trail`** - System audit logs

### 📈 Sample Data Included

- **Users:** Super admin, team leaders, recruiters
- **Clients:** Sample client companies
- **SPOCs:** Client contact persons
- **Demands:** Job requirements and positions
- **Activities:** Recruiter activities and submissions
- **CVs:** Sample CV uploads and downloads

## 🔧 Environment Configuration

### Backend (.env file)
```bash
# Database
DATABASE_URL=postgresql://postgres:your_password@127.0.0.1:5432/kudzuops
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=your_password
DB_NAME=kudzuops

# API Configuration
API_BASE_URL=http://localhost:8000
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# Frontend
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200
FRONTEND_HOST=127.0.0.1
FRONTEND_PORT=4200
```

### Frontend (environment.ts)
```typescript
export const environment = {
  production: false,
  apiBase: 'http://localhost:8000',
  authBase: 'http://localhost:8000/auth',
  superAdminBase: 'http://localhost:8000/superadmin'
};
```

## 🚀 Complete Setup Steps

### 1. Database Setup
```bash
# Install PostgreSQL (if not already installed)
# Create database
createdb -U postgres kudzuops

# Restore data
psql -U postgres -d kudzuops -f backend/kudzu_database_complete_dump.sql
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup
```bash
npm install
ng serve --host 0.0.0.0 --port 4200
```

## 🔍 Verification

### Check Database Connection
```python
import psycopg

try:
    conn = psycopg.connect("postgresql://postgres:your_password@localhost:5432/kudzuops")
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM tbl_users")
        user_count = cur.fetchone()[0]
        print(f"✅ Database connected! Users: {user_count}")
except Exception as e:
    print(f"❌ Database connection failed: {e}")
```

### Check API Endpoints
```bash
# Test backend API
curl http://localhost:8000/health

# Test authentication
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@kudzu.com", "password": "admin123"}'
```

## 📋 Default Login Credentials

After restoring the database, you can use these default accounts:

- **Super Admin:** `admin@kudzu.com` / `admin123`
- **Team Leader:** `teamleader@kudzu.com` / `teamleader123`
- **Recruiter:** `recruiter@kudzu.com` / `recruiter123`

## 🛠️ Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify credentials in .env file
   - Ensure database exists

2. **Permission Denied**
   - Check PostgreSQL user permissions
   - Verify database ownership

3. **Port Already in Use**
   - Change ports in .env file
   - Kill existing processes

### Support Files

- **Dump File:** `backend/kudzu_database_complete_dump.sql`
- **Setup Script:** `backend/create_database_dump.py`
- **Environment:** `backend/.env`

## ✅ Success Indicators

- ✅ Database restored without errors
- ✅ Backend API responds on port 8000
- ✅ Frontend loads on port 4200
- ✅ Login functionality works
- ✅ All screens accessible

---

**📞 Need Help?** Check the database dump file for detailed table structures and sample data.
