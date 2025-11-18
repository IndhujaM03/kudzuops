# Quick Migration Guide - Windows

## 🚀 Fastest Way (No Python Required)

### Method 1: Using psql (Recommended)

1. **Open Command Prompt or PowerShell**
2. **Navigate to backend folder:**
   ```cmd
   cd "d:\kudzuops\kudzu_operations - 10302025\backend"
   ```

3. **Run the batch file:**
   ```cmd
   run_migration_psql.bat
   ```

   Or run directly:
   ```cmd
   psql -U postgres -d kudzu_operations -f migrations\102_sync_current_schema.sql
   ```

### Method 2: Using Database GUI Tool

1. **Open pgAdmin, DBeaver, or any PostgreSQL client**
2. **Connect to your database** (`kudzu_operations`)
3. **Open SQL Editor**
4. **Open the file:** `backend\migrations\102_sync_current_schema.sql`
5. **Copy all contents and paste into SQL editor**
6. **Execute the SQL**

### Method 3: Using Python (If Available)

1. **Navigate to backend:**
   ```cmd
   cd "d:\kudzuops\kudzu_operations - 10302025\backend"
   ```

2. **Try one of these:**
   ```cmd
   REM Option A: Use batch file
   run_migration_simple.bat
   
   REM Option B: Direct Python (if installed)
   py scripts\apply_migrations.py
   
   REM Option C: If you have Python in PATH
   python scripts\apply_migrations.py
   ```

## ✅ Verification

After running the migration, verify it worked:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tbl_candidate_onboarding', 'tbl_interview_schedule', 'tbl_interviews');

-- Check columns in onboarding table
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'tbl_candidate_onboarding'
ORDER BY ordinal_position;
```

## 🔧 Troubleshooting

**"psql: command not found"**
- Install PostgreSQL or add it to PATH
- Or use a database GUI tool instead

**"Python not found"**
- Use Method 1 (psql) or Method 2 (GUI tool)
- No Python installation needed!

**"Permission denied"**
- Make sure you're using the correct database user
- You may need to run as administrator

## 📝 What the Migration Does

The migration file `102_sync_current_schema.sql` will:
- ✅ Create `tbl_candidate_onboarding` table (if not exists)
- ✅ Add missing columns: `generated_link`, `status`, `documents`
- ✅ Create `tbl_interview_schedule` table (if not exists)
- ✅ Create `tbl_interviews` table (if not exists)
- ✅ Create indexes for better performance
- ✅ Safe to run multiple times (uses IF NOT EXISTS)

