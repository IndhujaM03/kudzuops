# Kudzu Operations - Authentication Module

A complete authentication system for the Kudzu recruitment platform, built with FastAPI backend and Angular frontend.

## 🚀 Features

### Authentication Flow
- **User Registration** with email verification via OTP
- **Email/Password Login** with JWT token authentication
- **Password Reset** with secure OTP verification
- **Google OAuth** integration (ready for configuration)
- **Account Verification** with 6-digit OTP codes

### Security Features
- PBKDF2 password hashing with salt
- JWT-like tokens with HMAC signatures
- OTP codes with 10-minute expiration
- Redis-based session management
- Email verification required for login
- Rate limiting and account lockout protection

### UI/UX
- Modern Kudzu-style design with blue gradient backgrounds
- Responsive design with Tailwind CSS
- Loading states and error handling
- Amazon-inspired yellow buttons for actions
- Mobile-friendly interface

## 📋 Prerequisites

- Python 3.13+
- Node.js 22+
- PostgreSQL 12+
- Redis (optional, for OTP storage)
- SMTP server (Gmail, SendGrid, etc.)

## 🛠️ Installation

### Backend Setup

1. **Create virtual environment:**
```bash
py -3.13 -m venv .venv
.\.venv\Scripts\activate
```

2. **Install dependencies:**
```bash
.\.venv\Scripts\pip install -r backend/requirements.txt
```

3. **Configure environment variables:**
Create `backend/.env` with the following variables:
```env
# Application
APP_ENV=development
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
ALLOWED_ORIGINS=http://localhost:4200,http://127.0.0.1:4200

# Database
DATABASE_URL=postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-super-secret-key-here

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

4. **Set up database:**
```bash
# Create database and user (if not already done)
.\.venv\Scripts\python backend\scripts\create_db.py

# Run migrations
.\.venv\Scripts\python backend\scripts\run_sql.py kudzuops backend\migrations\001_init.sql
.\.venv\Scripts\python backend\scripts\run_sql.py kudzuops backend\migrations\002_seed_roles.sql
.\.venv\Scripts\python backend\scripts\run_sql.py kudzuops backend\migrations\003_clients_activity.sql
```

5. **Start the backend server:**
```bash
.\.venv\Scripts\python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Install Tailwind CSS:**
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

3. **Configure Tailwind CSS:**
Update `tailwind.config.js`:
```javascript
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

4. **Add Tailwind to your CSS:**
Update `src/global_styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

5. **Set up routing:**
Update `src/main.ts`:
```typescript
import { provideRouter, Routes } from '@angular/router';
import { LoginComponent, SignupComponent, ResetPasswordComponent, VerifyComponent, VerifyResetComponent, DashboardComponent } from './components/login/login.component';

const routes: Routes = [
  { path: 'signin', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify', component: VerifyComponent },
  { path: 'verify-reset', component: VerifyResetComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: '', redirectTo: 'signin', pathMatch: 'full' },
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
  ],
});
```

6. **Start the frontend server:**
```bash
npm run start
```

## 🔧 Configuration

### Database Setup

The system uses PostgreSQL with the following tables:
- `users` - User accounts with authentication data
- `tbl_roles` - User roles and permissions
- `tbl_role_permissions` - Granular permissions per role
- `tbl_clients` - Client companies
- `tbl_client_spocs` - Client points of contact
- `tbl_recruiter_activity` - Recruiter performance tracking
- `tbl_demand_sheet` - Job requirements
- `tbl_submissions` - Candidate submissions

### Email Configuration

For Gmail SMTP:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `SMTP_PASSWORD`

For SendGrid:
1. Create a SendGrid account
2. Generate an API key
3. Use SendGrid's SMTP settings

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:8000/auth/google/callback`
   - `http://localhost:4200` (for development)

## 📚 API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user and send OTP |
| POST | `/auth/login` | Authenticate user and return JWT |
| POST | `/auth/verify` | Verify OTP and activate account |
| POST | `/auth/request-reset` | Send password reset OTP |
| POST | `/auth/reset-password` | Reset password with OTP |
| GET | `/auth/google/login` | Initiate Google OAuth |
| GET | `/auth/google/callback` | Handle Google OAuth callback |

### Request/Response Examples

**Register User:**
```json
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "confirm_password": "SecurePass123"
}

Response:
{
  "message": "Verification code sent to your email"
}
```

**Login:**
```json
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "message": "Login successful"
}
```

## 🎨 UI Components

### Available Components

All authentication components are located in `src/components/login/`:

- **LoginComponent** (`login.component.ts`) - Sign in form with email/password and Google OAuth
- **SignupComponent** (`signup.component.ts`) - Registration form with password validation
- **ResetPasswordComponent** (`reset-password.component.ts`) - Password reset request form
- **VerifyComponent** (`verify.component.ts`) - Email verification with OTP input
- **VerifyResetComponent** (`verify-reset.component.ts`) - Password reset with new password
- **DashboardComponent** (`dashboard.component.ts`) - Protected dashboard with logout

All components are standalone and can be imported individually or from the index file.

### Styling

The UI uses a hybrid design combining:
- **Kudzu branding:** Blue gradient backgrounds, green logo, dark cards
- **Amazon elements:** Yellow action buttons, blue links, clean forms
- **Modern UX:** Loading states, error handling, responsive design

## 🔒 Security Considerations

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Token Security
- HMAC-SHA256 signed tokens
- Configurable expiration time
- Secure secret key required

### OTP Security
- 6-digit random codes
- 10-minute expiration
- Single-use codes
- Rate limiting on resend

## 🚨 Troubleshooting

### Common Issues

**Backend won't start:**
- Check if PostgreSQL is running
- Verify database credentials in `.env`
- Ensure all dependencies are installed

**Email not sending:**
- Verify SMTP credentials
- Check firewall settings
- Test with a simple SMTP client

**Frontend routing issues:**
- Ensure all components are imported
- Check route configuration
- Verify Angular version compatibility

**Database connection errors:**
- Check PostgreSQL service status
- Verify connection string format
- Ensure database exists and user has permissions

### Debug Mode

Enable debug logging by setting:
```env
APP_ENV=development
```

## 📝 Development

### Adding New Features

1. **Backend:** Add new endpoints to `backend/app/login.py`
2. **Frontend:** Create new components in `src/components/`
3. **Database:** Add migrations in `backend/migrations/`

### Testing

Run backend tests:
```bash
.\.venv\Scripts\python -m pytest backend/tests/
```

Run frontend tests:
```bash
npm test
```

## 📄 License

This project is part of the Kudzu Operations platform. All rights reserved.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section above

---

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Maintainer:** Kudzu Operations Team
