# Complete Authentication Flow Testing Guide

## 🚀 Testing Checklist

### 1. Backend Setup ✅
- [x] OTP generation working (6-digit codes)
- [x] Email sending functionality working
- [x] SMTP configuration ready
- [x] Database connection configured

### 2. Frontend Setup ✅
- [x] Angular components updated for 6-digit OTP
- [x] API endpoints corrected
- [x] Form validation updated

### 3. Environment Configuration

**Create/Update `backend/.env` file:**
```env
# Database Configuration
DATABASE_URL=postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops
REDIS_URL=redis://localhost:6379/0

# JWT Configuration
SECRET_KEY=your-secret-key-change-in-production
ACCESS_TOKEN_EXPIRES_IN=3600

# SMTP Configuration for Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Google OAuth Configuration
OAUTH_CLIENT_ID=your-google-client-id
OAUTH_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Environment
APP_ENV=development
```

### 4. Gmail Setup for Email Testing

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in `SMTP_PASSWORD`

### 5. Testing Steps

#### A. Regular Signup Flow
1. **Start Backend**: `uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000`
2. **Start Frontend**: `npm start`
3. **Navigate to**: `http://localhost:4200/signup`
4. **Fill form**:
   - Email: `test@example.com`
   - Password: `TestPass123`
   - Confirm Password: `TestPass123`
5. **Submit** → Should redirect to `/verify?email=test@example.com`
6. **Check email** for 6-digit OTP
7. **Enter OTP** on verify page
8. **Should redirect** to dashboard

#### B. Password Reset Flow
1. **Navigate to**: `http://localhost:4200/reset-password`
2. **Enter email**: `test@example.com`
3. **Submit** → Should redirect to `/verify-reset?email=test@example.com`
4. **Check email** for 6-digit OTP
5. **Enter OTP + new password**
6. **Should redirect** to signin page

#### C. Google SSO Flow (Enhanced)
1. **Navigate to**: `http://localhost:4200/signup`
2. **Click "Sign up with Google"**
3. **Complete Google OAuth**
4. **Should redirect** to verify page with OTP email sent
5. **Enter OTP** to complete registration

### 6. Expected Email Content

**Signup Email:**
```
Subject: Verify your Kudzu account
Body: Your verification code is: 123456
```

**Reset Email:**
```
Subject: Reset your Kudzu password
Body: Your password reset code is: 123456
```

### 7. Troubleshooting

#### Email Not Sending
- Check SMTP credentials in `.env`
- Verify Gmail App Password
- Check console logs for SMTP errors

#### OTP Not Working
- Check Redis connection
- Verify OTP is 6 digits
- Check expiration (10 minutes)

#### Frontend Issues
- Check browser console for errors
- Verify API endpoints are correct
- Check CORS settings

### 8. API Endpoints to Test

```bash
# Test registration
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPass123", "confirm_password": "TestPass123"}'

# Test verification
curl -X POST "http://localhost:8000/auth/verify" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'

# Test password reset request
curl -X POST "http://localhost:8000/auth/request-reset" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test password reset
curl -X POST "http://localhost:8000/auth/verify-reset" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456", "new_password": "NewPass123", "confirm_password": "NewPass123"}'
```

### 9. Success Criteria

- [ ] OTP emails are received in inbox
- [ ] 6-digit OTP codes work correctly
- [ ] Signup flow completes successfully
- [ ] Password reset flow works
- [ ] Google SSO sends OTP email
- [ ] All redirects work correctly
- [ ] JWT tokens are stored properly

### 10. Next Steps After Testing

1. **Configure real SMTP credentials** in `.env`
2. **Set up Google OAuth** credentials
3. **Test with real email addresses**
4. **Deploy to production** with secure credentials
