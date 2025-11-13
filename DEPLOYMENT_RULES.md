# Kudzu Operations - Deployment Rules & Checklist

## 🔴 CRITICAL RULES - MUST FOLLOW

### 1. Connection
```bash
ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14
```
**Always use this exact SSH command to connect.**

---

### 2. Single Source of Truth

#### ✅ THE ONLY DIRECTORY TO USE:
```
/opt/kudzuops/
```

#### Directory Breakdown:
- `/opt/kudzuops/backend/` → Backend code
- `/opt/kudzuops/src/` → Frontend source
- `/opt/kudzuops/dist/` → Built frontend

#### ❌ FORBIDDEN - Do NOT Use:
- `/home/nexa360marketing/kudzu_operation/` (DELETED)
- Any other location
- Creating new kudzuops folders anywhere

---

### 3. NO Hardcoding Rule

#### ❌ DO NOT hardcode:
- `localhost`
- `127.0.0.1`
- Specific IP addresses
- Any environment-specific URLs

#### ✅ DO use:
- Environment variables (`.env` files)
- Configuration files
- Environment-specific settings

#### Files to ALWAYS Check for Hardcoding:
1. `/opt/kudzuops/backend/.env`
2. `/opt/kudzuops/backend/app/main.py`
3. `/opt/kudzuops/src/environments/environment.ts`
4. `/opt/kudzuops/src/environments/environment.prod.ts`

---

### 4. Pre-Deployment Checklist

Before making ANY changes:

- [ ] Connected to remote server via SSH
- [ ] Verified you're in `/opt/kudzuops/`
- [ ] Backed up current configuration files
- [ ] Checked for hardcoded `localhost` in all files
- [ ] Updated environment variables in `.env`
- [ ] Verified no duplicate kudzuops directories exist
- [ ] Confirmed where code is being deployed

---

### 5. Deployment Workflow

#### Step-by-Step Process:

1. **Connect**
   ```bash
   ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14
   ```

2. **Navigate to Directory**
   ```bash
   cd /opt/kudzuops/
   ```

3. **Check Current State**
   ```bash
   ls -la
   ls -la backend/
   ls -la src/
   ```

4. **Verify No Hardcoding**
   ```bash
   grep -r "localhost" backend/app/
   grep -r "localhost" src/
   ```

5. **Make Changes** (sync code, update files)

6. **Restart Services** (if needed)

7. **Verify Deployment**
   ```bash
   # Check backend
   ls -la backend/app/
   # Check frontend
   ls -la dist/
   ```

---

### 6. Sync Commands Reference

#### Sync Backend from Local to Remote:
```bash
scp -i ~/.ssh/nexocrm_key -r backend/app/YourFile.py nexa360marketing@34.171.111.14:/opt/kudzuops/backend/app/
```

#### Sync Frontend from Local to Remote:
```bash
scp -i ~/.ssh/nexocrm_key -r src/YourComponent nexa360marketing@34.171.111.14:/opt/kudzuops/src/
```

#### Sync Configuration:
```bash
scp -i ~/.ssh/nexocrm_key backend/.env nexa360marketing@34.171.111.14:/opt/kudzuops/backend/
```

---

### 7. Verification Commands

#### Check Current Location:
```bash
pwd
# Should show: /opt/kudzuops
```

#### Find All Kudzu Directories (should only be one):
```bash
find / -name "*kudzu*" -type d 2>/dev/null | grep -v "Permission denied"
# Should ONLY show: /opt/kudzuops
```

#### Search for Hardcoded Localhost:
```bash
# Backend check
grep -n "localhost" /opt/kudzuops/backend/app/*.py

# Frontend check
grep -r "localhost" /opt/kudzuops/src/

# Configuration check
grep "localhost" /opt/kudzuops/backend/.env
```

---

### 8. Common Mistakes to Avoid

1. ❌ **Using wrong SSH command** → Always use nexocrm_key
2. ❌ **Working in wrong directory** → Always use `/opt/kudzuops/`
3. ❌ **Creating duplicate folders** → Only one location exists
4. ❌ **Hardcoding localhost** → Use environment variables
5. ❌ **Not checking before deploying** → Always verify first

---

### 9. Emergency Commands

#### If you made a mistake and need to reset:
```bash
# Check what's where
ls -la /opt/kudzuops/
ls -la /home/nexa360marketing/

# Find all kudzu directories
find / -name "*kudzu*" -type d 2>/dev/null
```

#### Check server status:
```bash
# Backend processes
ps aux | grep python | grep kudzu

# Frontend processes
ps aux | grep node

# Check disk space
df -h
```

---

### 10. Quick Decision Tree

**Before you start ANY work on the remote server:**

```
Are you connected via SSH? 
├─ NO → Connect: ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14
└─ YES → Are you in /opt/kudzuops/?
         ├─ NO → cd /opt/kudzuops/
         └─ YES → Have you checked for hardcoding?
                   ├─ NO → grep -r "localhost" .
                   └─ YES → Proceed with deployment
```

---

## 📋 Quick Command Cheat Sheet

| Task | Command |
|------|---------|
| Connect to server | `ssh -i ~/.ssh/nexocrm_key nexa360marketing@34.171.111.14` |
| Navigate to kudzuops | `cd /opt/kudzuops/` |
| Check for hardcoding | `grep -r "localhost" .` |
| Find all kudzu dirs | `find / -name "*kudzu*" -type d 2>/dev/null` |
| Check backend | `ls -la backend/app/` |
| Check frontend | `ls -la src/` |
| Check .env | `cat backend/.env` |

---

**Remember**: 
- Only `/opt/kudzuops/` exists
- No hardcoding of localhost
- Always verify before deploying
- Use SSH key nexocrm_key

