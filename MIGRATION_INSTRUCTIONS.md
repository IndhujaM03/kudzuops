# Database Migration Instructions

## Quick Start - Run Migrations

### ⚡ Fastest Method (No Python Required) - Recommended for Windows

**Using psql directly:**
```cmd
cd backend
run_migration_psql.bat
```

Or manually:
```cmd
cd backend
psql -U postgres -d kudzu_operations -f migrations\102_sync_current_schema.sql
```

### Option 1: Using the Migration Script (Requires Python)

**Windows - Easiest Method (Double-click or run in CMD):**
```cmd
cd backend
run_migration_simple.bat
```

**Windows (PowerShell):**
```powershell
cd backend
.\run_migration.ps1
```

**Windows (PowerShell) - Direct venv Python:**
```powershell
cd backend
.\venv\Scripts\python.exe scripts\apply_migrations.py
```

**Windows (CMD) - Direct venv Python:**
```cmd
cd backend
venv\Scripts\python.exe scripts\apply_migrations.py
```

**Linux/Mac:**
```bash
cd backend
source venv/bin/activate
python3 scripts/apply_migrations.py
```

This script will:
- Find all `.sql` files in the `backend/migrations/` directory
- Sort them numerically by filename
- Apply them in order to your database
- Show progress and any errors

**Note:** The script applies ALL migration files. If you only want to run the new migration (102), use Option 2 or 3.

### Option 2: Manual Migration (Using psql)

If you prefer to run migrations manually:

1. **Connect to your PostgreSQL database:**
   ```bash
   psql -U postgres -d kudzu_operations
   ```
   (Replace `postgres` and `kudzu_operations` with your actual username and database name)

2. **Run the migration file:**
   ```sql
   \i backend/migrations/102_sync_current_schema.sql
   ```

   Or copy and paste the contents of the migration file directly into psql.

### Option 3: Using Python Script Directly

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Run Python with the migration file:**
   ```python
   python -c "
   import psycopg
   import os
   from dotenv import load_dotenv
   
   load_dotenv()
   dsn = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/kudzu_operations')
   
   with psycopg.connect(dsn) as conn:
       with conn.cursor() as cur:
           with open('migrations/102_sync_current_schema.sql', 'r') as f:
               cur.execute(f.read())
           conn.commit()
   print('Migration completed successfully!')
   "
   ```

### Option 4: Using Database GUI Tool

If you use a database management tool like pgAdmin, DBeaver, or TablePlus:

1. Open your database connection
2. Open the SQL editor
3. Copy the contents of `backend/migrations/102_sync_current_schema.sql`
4. Paste and execute the SQL

## Verification

After running the migration, verify the tables exist:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tbl_candidate_onboarding', 'tbl_interview_schedule', 'tbl_interviews');

-- Check columns in tbl_candidate_onboarding
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tbl_candidate_onboarding'
ORDER BY ordinal_position;
```

## Troubleshooting

### Error: "relation already exists"
- This is normal if tables already exist. The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

### Error: "column already exists"
- The migration uses `ADD COLUMN IF NOT EXISTS`, so it's safe to run multiple times.

### Error: "permission denied"
- Make sure your database user has CREATE and ALTER permissions.
- You may need to run as a superuser or grant permissions:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE kudzu_operations TO your_username;
  ```

### Error: "could not connect to server"
- Check your `DATABASE_URL` environment variable
- Verify PostgreSQL is running
- Check connection credentials in `.env` file

## Migration Files Order

Migrations are applied in numerical order:
- `001_init.sql`
- `002_seed_roles.sql`
- ...
- `100_complete_schema_sync.sql`
- `102_sync_current_schema.sql` ← **Run this one**

## Environment Variables

Make sure your `.env` file (in the `backend/` directory) contains:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/kudzu_operations
```

Or use individual variables:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kudzu_operations
DB_USER=postgres
DB_PASS=your_password
```

## Notes

- Migrations are idempotent (safe to run multiple times)
- Always backup your database before running migrations in production
- The migration script tracks which migrations have been applied (if you implement a migration tracking table)

