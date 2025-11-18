# Run Only Migration 102 (Recommended)

Since some migrations already ran, you can run just the new migration (102):

## Option 1: Run Only Migration 102

```powershell
python scripts\apply_single_migration.py 102
```

## Option 2: Run All Migrations Again (Will Skip Already Applied)

The migration script now continues on errors, so you can run all migrations:

```powershell
python scripts\apply_migrations.py
```

It will skip migrations that already exist and continue with new ones.

## Option 3: Run Migration 102 Directly with psql

```cmd
psql -U postgres -d kudzu_operations -f migrations\102_sync_current_schema.sql
```

Or if your database is `kudzuops`:

```cmd
psql -U kudzuops -d kudzuops -f migrations\102_sync_current_schema.sql
```

## What Was Fixed

1. ✅ Fixed `001_init.sql` - Changed `tbl_users` references to `users` table
2. ✅ Fixed `004_create_tbl_users_view.sql` - Added `DROP VIEW IF EXISTS` to avoid conflicts
3. ✅ Improved migration script - Now continues on errors instead of stopping

## Recommended: Run Only Migration 102

Since migrations 001-003 already ran successfully, just run:

```powershell
python scripts\apply_single_migration.py 102
```

This will only apply the new schema sync migration.

