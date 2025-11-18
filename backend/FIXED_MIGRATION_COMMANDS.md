# Fixed Migration Commands

## ✅ Correct Commands (You're in backend directory)

Since you're already in the `backend` directory, use these commands:

### If .venv is activated (you see `.venv` in your prompt):

```powershell
# Correct - no "backend/" prefix needed
python scripts\apply_migrations.py
```

### If that doesn't work, use full path to Python:

```powershell
# If .venv is in backend directory
.\.venv\Scripts\python.exe scripts\apply_migrations.py

# OR if .venv is in parent directory
..\.venv\Scripts\python.exe scripts\apply_migrations.py
```

### Easiest - Use the batch file:

```cmd
# Just double-click or run:
run_migration_simple.bat
```

### No Python? Use psql:

```cmd
psql -U postgres -d kudzu_operations -f migrations\102_sync_current_schema.sql
```

## ❌ Wrong Command (What you tried):

```powershell
python backend/scripts/apply_migrations.py  # ❌ WRONG - adds extra "backend/"
```

## ✅ Correct Command:

```powershell
python scripts\apply_migrations.py  # ✅ CORRECT
```

## Quick Test

To verify you're in the right place, run:
```powershell
ls scripts\apply_migrations.py
```

If you see the file, you're in the correct directory!

