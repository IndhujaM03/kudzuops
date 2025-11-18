@echo off
REM Run migration using psql directly (no Python required)
echo Running database migration using psql...
echo.

REM You may need to adjust these values
set DB_USER=postgres
set DB_NAME=kudzu_operations
set MIGRATION_FILE=migrations\102_sync_current_schema.sql

echo Connecting to database: %DB_NAME%
echo Migration file: %MIGRATION_FILE%
echo.

REM Try to run psql
psql -U %DB_USER% -d %DB_NAME% -f %MIGRATION_FILE%

if %errorlevel% == 0 (
    echo.
    echo Migration completed successfully!
) else (
    echo.
    echo ERROR: Migration failed!
    echo.
    echo Please check:
    echo 1. PostgreSQL is installed and in your PATH
    echo 2. Database credentials are correct
    echo 3. You have permission to modify the database
    echo.
    echo Alternative: Use a database GUI tool (pgAdmin, DBeaver, etc.)
    echo    Open %MIGRATION_FILE% and execute it manually
)

pause

