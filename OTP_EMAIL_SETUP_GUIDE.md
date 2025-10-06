# 🔐 Complete OTP Email Verification Setup Guide

## ✅ What's Been Implemented

### 1. Backend OTP Email System
- **6-digit OTP generation** ✅
- **Email sending with SMTP** ✅
- **OTP storage in Redis** ✅
- **Signup with OTP verification** ✅
- **Password reset with OTP** ✅
- **Google SSO with OTP verification** ✅

### 2. Frontend Integration
- **6-digit OTP input validation** ✅
- **Dynamic UI for Google OAuth** ✅
- **Proper API endpoint calls** ✅
- **Form validation and error handling** ✅

### 3. Email Templates
- **Professional HTML email templates** ✅
- **6-digit OTP display** ✅
- **Expiration warnings** ✅
- **Branded styling** ✅

## 🚀 Quick Setup

### 1. Configure Email Settings

**Edit `backend/.env` file:**
```env
# SMTP Configuration for Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

**Gmail Setup:**
1. Enable 2-Factor Authentication on your Gmail
2. Generate App Password: Google Account → Security → App passwords
3. Use the App Password (not your regular password)

### 2. Start Services

**Backend (Terminal 1):**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (Terminal 2):**
```bash
cd ..
npm start
```

### 3. Test Authentication Flows

#### A. Regular Signup Flow
1. Go to `http://localhost:4200/signup`
2. Fill form with your email
3. Submit → Check email for 6-digit OTP
4. Enter OTP on verify page
5. Should redirect to dashboard

#### B. Password Reset Flow
1. Go to `http://localhost:4200/reset-password`
2. Enter your email
3. Submit → Check email for 6-digit OTP
4. Enter OTP + new password
5. Should redirect to signin

#### C. Google SSO Flow
1. Go to `http://localhost:4200/signup`
2. Click "Sign up with Google"
3. Complete Google OAuth
4. Check email for 6-digit OTP
5. Enter OTP to complete registration

## 📧 Expected Email Content

### Signup Email
```
Subject: Verify your Kudzu account
Body: Your verification code is: 123456
```

### Password Reset Email
```
Subject: Reset your Kudzu password
Body: Your password reset code is: 123456
```

### Google SSO Email
```
Subject: Complete your Google signup - Kudzu
Body: Your verification code is: 123456
```

## 🔧 API Endpoints

### Authentication Endpoints
- `POST /auth/register` - Signup with OTP email
- `POST /auth/verify` - Verify signup OTP
- `POST /auth/request-reset` - Request password reset OTP
- `POST /auth/verify-reset` - Verify reset OTP + set new password
- `POST /auth/verify-google` - Verify Google OAuth OTP
- `GET /auth/google/login` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback with OTP

### Test Endpoints
```bash
# Test signup
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "TestPass123", "confirm_password": "TestPass123"}'

# Test password reset
curl -X POST "http://localhost:8000/auth/request-reset" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test Google OAuth callback
curl "http://localhost:8000/auth/google/callback?code=test_code"
```

## 🧪 Testing Scripts

### Run Complete Test
```bash
python test_complete_auth.py
```

### Test OTP Generation
```bash
python test_otp_email.py
```

## 🐛 Troubleshooting

### Email Not Sending
- Check SMTP credentials in `.env`
- Verify Gmail App Password
- Check console logs for SMTP errors
- Test with `python test_otp_email.py`

### OTP Not Working
- Verify OTP is 6 digits
- Check Redis connection
- Verify OTP expiration (10 minutes)
- Check database connection

### Frontend Issues
- Check browser console for errors
- Verify API endpoints match backend
- Check CORS settings
- Ensure forms validate 6-digit OTP

### Database Issues
- Check PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Check database exists and is accessible

## 📋 Success Checklist

- [ ] Backend starts without errors
- [ ] Frontend loads correctly
- [ ] Registration sends email with 6-digit OTP
- [ ] OTP verification works
- [ ] Password reset sends email
- [ ] Password reset with OTP works
- [ ] Google OAuth sends OTP email
- [ ] Google OAuth OTP verification works
- [ ] All redirects work correctly
- [ ] JWT tokens are stored properly

## 🎯 Key Features Implemented

### 1. Signup Flow
- User enters email + password
- Backend generates 6-digit OTP
- Email sent with OTP
- User enters OTP to verify
- Account activated and logged in

### 2. Password Reset Flow
- User enters email
- Backend generates 6-digit OTP
- Email sent with OTP
- User enters OTP + new password
- Password updated successfully

### 3. Google SSO Flow
- User clicks "Sign up with Google"
- Google OAuth completes
- Backend generates 6-digit OTP
- Email sent with OTP
- User enters OTP to complete registration
- Account verified and logged in

## 🔒 Security Features

- **6-digit OTP codes** (1,000,000 possible combinations)
- **10-minute expiration** for OTPs
- **Redis storage** for OTP management
- **Secure password hashing** (PBKDF2)
- **JWT token authentication**
- **Email verification required** for all flows

## 📞 Support

If you encounter issues:
1. Check console logs for specific errors
2. Verify all environment variables are set
3. Test individual components (OTP, email, database)
4. Use the provided test scripts
5. Check the troubleshooting section above

The complete OTP email verification system is now ready for testing!
