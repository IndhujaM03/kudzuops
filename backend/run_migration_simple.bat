@echo off
REM Simple batch file to run migrations on Windows
echo Running database migrations...
echo Current directory: %CD%
echo.

REM Try .venv in current directory (backend)
if exist ".venv\Scripts\python.exe" (
    echo Using .venv Python from current directory...
    .venv\Scripts\python.exe scripts\apply_migrations.py
    goto :end
)

REM Try .venv in parent directory
if exist "..\.venv\Scripts\python.exe" (
    echo Using .venv Python from parent directory...
    ..\.venv\Scripts\python.exe scripts\apply_migrations.py
    goto :end
)

REM Try venv in current directory
if exist "venv\Scripts\python.exe" (
    echo Using venv Python from current directory...
    venv\Scripts\python.exe scripts\apply_migrations.py
    goto :end
)

REM Try venv in parent directory
if exist "..\venv\Scripts\python.exe" (
    echo Using venv Python from parent directory...
    ..\venv\Scripts\python.exe scripts\apply_migrations.py
    goto :end
)

REM Try system Python
where python >nul 2>&1
if %errorlevel% == 0 (
    echo Using system Python...
    python scripts\apply_migrations.py
    goto :end
)

where py >nul 2>&1
if %errorlevel% == 0 (
    echo Using Python Launcher (py)...
    py scripts\apply_migrations.py
    goto :end
)

echo.
echo ERROR: Python not found!
echo.
echo Please use one of these alternatives:
echo.
echo Option 1: Install Python from python.org
echo Option 2: Use psql directly:
echo    psql -U postgres -d kudzu_operations -f migrations\102_sync_current_schema.sql
echo.
echo Option 3: Use a database GUI tool (pgAdmin, DBeaver, etc.)
echo    Open migrations\102_sync_current_schema.sql and execute it
echo.
pause
:end

