# PowerShell script to run database migrations on Windows
# This script activates the virtual environment and runs the migration

Write-Host "Activating virtual environment..." -ForegroundColor Cyan

# Activate virtual environment
if (Test-Path "venv\Scripts\Activate.ps1") {
    & "venv\Scripts\Activate.ps1"
    Write-Host "Virtual environment activated!" -ForegroundColor Green
} else {
    Write-Host "Warning: Virtual environment not found. Trying without activation..." -ForegroundColor Yellow
}

Write-Host "`nRunning migrations..." -ForegroundColor Cyan

# Try python from venv first, then system python
if (Test-Path "venv\Scripts\python.exe") {
    & "venv\Scripts\python.exe" scripts\apply_migrations.py
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    python3 scripts\apply_migrations.py
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    py scripts\apply_migrations.py
} else {
    Write-Host "Error: Python not found. Please install Python or activate your virtual environment manually." -ForegroundColor Red
    Write-Host "`nAlternative: Use psql to run the migration file directly:" -ForegroundColor Yellow
    Write-Host "  psql -U postgres -d kudzu_operations -f migrations\102_sync_current_schema.sql" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nMigration completed!" -ForegroundColor Green

