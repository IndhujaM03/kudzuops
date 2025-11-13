# Kudzu Operations - Remote Server Deployment Guide

## Server Information
- **Server IP**: `34.171.111.14`
- **Username**: `nexa360marketing`
- **SSH Key Location**: `~/.ssh/nexocrm_key`
- **Production Directory**: `/opt/kudzuops/`

---

## 1. Connecting to Remote Server

### SSH Connection
```bash
ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14
```

### Verification
After connecting, verify the kudzuops directory:
```bash
ls -la /opt/kudzuops/
```

---

## 2. Working Directory Structure

### ⚠️ CRITICAL: Single Source of Truth
**ALWAYS use `/opt/kudzuops/` for ALL operations**

The production server has only ONE directory for Kudzu Operations:
- **Primary Directory**: `/opt/kudzuops/`
  - Backend: `/opt/kudzuops/backend/`
  - Frontend Source: `/opt/kudzuops/src/`
  - Built Frontend: `/opt/kudzuops/dist/`

### Directory Structure:
```
/opt/kudzuops/
├── backend/
│   ├── app/              # Backend application files
│   ├── .env              # Environment configuration
│   ├── requirements.txt   # Python dependencies
│   └── venv/             # Virtual environment
├── src/                  # Angular frontend source
│   ├── app/
│   ├── components/
│   ├── services/
│   └── assets/
├── dist/                 # Built frontend for production
└── README.md             # Documentation
```

---

## 3. Deployment Rules

### ✅ DO:
- ✅ ALWAYS work with `/opt/kudzuops/`
- ✅ Sync code TO `/opt/kudzuops/backend/` and `/opt/kudzuops/src/`
- ✅ Update backend code in `/opt/kudzuops/backend/app/`
- ✅ Update frontend code in `/opt/kudzuops/src/`
- ✅ Build frontend and output to `/opt/kudzuops/dist/`

### ❌ DON'T:
- ❌ Create new folders for kudzuops anywhere else on the server
- ❌ Use `/home/nexa360marketing/kudzu_operation/` (old location, deleted)
- ❌ Create duplicate kudzuops directories
- ❌ Hardcode `localhost` in any configuration or code files

---

## 4. No Hardcoding Localhost

### ⚠️ Critical Configuration Requirement

**NEVER hardcode `localhost` in any files. Use configuration variables instead.**

### Backend Configuration (`.env`)
Always use environment variables in `/opt/kudzuops/backend/.env`:

```env
# CORRECT - Use environment variables
HOST=0.0.0.0
PORT=8000
DATABASE_HOST=localhost
DATABASE_PORT=5432

# WRONG - Don't hardcode specific IPs or localhost in application code
```

### Configuration Files to Check:
1. **`/opt/kudzuops/backend/.env`** - Environment variables
2. **`/opt/kudzuops/backend/app/main.py`** - FastAPI application
3. **`/opt/kudzuops/src/environments/`** - Angular environment files
4. **`nginx_config_clean.txt`** - If using nginx configuration

### Common Mistakes to Avoid:
```python
# ❌ WRONG - Hardcoded localhost
DATABASE_URL = "postgresql://user:pass@localhost:5432/db"

# ✅ CORRECT - Use environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")
```

```typescript
// ❌ WRONG - Hardcoded API URL
const API_URL = 'http://localhost:8000/api';

// ✅ CORRECT - Use environment configuration
const API_URL = environment.apiUrl;
```

---

## 5. Deployment Workflow

### Step 1: Connect to Server
```bash
ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14
```

### Step 2: Navigate to Directory
```bash
cd /opt/kudzuops/
```

### Step 3: Update Backend
```bash
cd /opt/kudzuops/backend
# Activate virtual environment
source venv/bin/activate
# Install dependencies if needed
pip install -r requirements.txt
# Restart services
```

### Step 4: Update Frontend
```bash
cd /opt/kudzuops/src
# Build frontend
npm run build
# Copy to dist
```

### Step 5: Verify Changes
```bash
# Check backend files
ls -la /opt/kudzuops/backend/app/
# Check frontend files
ls -la /opt/kudzuops/dist/
```

---

## 6. File Sync Commands

### From Local to Remote Server

#### Sync Backend:
```bash
# From local machine
scp -i ~/.ssh/nexocrm_key -r backend/app/* nexa360marketing@34.171.111.14:/opt/kudzuops/backend/app/
```

#### Sync Frontend Source:
```bash
scp -i ~/.ssh/nexocrm_key -r src/* nexa360marketing@34.171.111.14:/opt/kudzuops/src/
```

#### Sync Configuration:
```bash
scp -i ~/.ssh/nexocrm_key backend/.env nexa360marketing@34.171.111.14:/opt/kudzuops/backend/
```

---

## 7. Quick Reference

| Command | Purpose |
|---------|---------|
| `ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14` | Connect to server |
| `ls -la /opt/kudzuops/` | List kudzuops directory |
| `cd /opt/kudzuops/backend` | Navigate to backend |
| `cd /opt/kudzuops/src` | Navigate to frontend source |
| `grep -r "localhost" /opt/kudzuops/` | Search for hardcoded localhost |

---

## 8. Important Notes

1. **Single Production Directory**: Only use `/opt/kudzuops/`
2. **No Duplicate Folders**: Do not create kudzuops folders elsewhere
3. **Configuration Management**: Always use environment variables, never hardcode URLs
4. **Environment Variables**: Check `.env` files before deploying
5. **Backup Before Changes**: Always backup before major updates

---

## 9. Troubleshooting

### Check for Hardcoded Localhost
```bash
# Search for hardcoded localhost in backend
grep -r "localhost" /opt/kudzuops/backend/app/

# Search in frontend
grep -r "localhost" /opt/kudzuops/src/
```

### Verify Directory Structure
```bash
# Should only show /opt/kudzuops/
find /home -name "*kudzu*" -type d
find /opt -name "*kudzu*" -type d
```

### Check Running Services
```bash
# Check if services are running
ps aux | grep python
ps aux | grep node
```

---

## 10. Contact & Support

For issues with remote server deployment, refer to:
- This document for connection and deployment procedures
- Check `/opt/kudzuops/README.md` for application-specific documentation
- Review logs in `/opt/kudzuops/backend/` for debugging

---

**Last Updated**: October 27, 2024
**Server**: 34.171.111.14
**Environment**: Production
**Location**: `/opt/kudzuops/`

