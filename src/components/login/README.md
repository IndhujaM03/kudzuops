# Kudzu Login Module

A professional, modern login system for the Kudzu application with comprehensive authentication features.

## Features

### 🔐 Authentication Components
- **Login Component** (`login.component.ts`) - User sign-in with email/password and Google OAuth
- **Signup Component** (`signup.component.ts`) - User registration with email verification
- **Reset Password** (`reset-password.component.ts`) - Password reset request
- **Verify Reset** (`verify-reset.component.ts`) - Password reset with verification code
- **Email Verification** (`verify.component.ts`) - Email verification after signup

### 🎨 Professional Design
- Modern glassmorphism design with backdrop blur effects
- Responsive layout that works on all devices
- Smooth animations and hover effects
- Professional color scheme with CSS variables
- Consistent typography using Inter font family

### 🔧 Technical Features
- **Reactive Forms** with comprehensive validation
- **TypeScript** with strict type checking
- **Standalone Components** for better tree-shaking
- **Google OAuth** integration with popup authentication
- **Form Validation** with real-time error messages
- **Loading States** with animated spinners
- **Success/Error Notifications** with toast messages

## Component Structure

```
src/components/login/
├── login.component.ts           # Main login form
├── signup.component.ts          # User registration
├── reset-password.component.ts # Password reset request
├── verify-reset.component.ts   # Password reset with code
├── verify.component.ts          # Email verification
└── README.md                   # This file
```

## Styling

The login module uses a comprehensive CSS system located in `src/styles.css`:

### CSS Variables
```css
:root {
  --sky-blue: #87CEEB;
  --primary-blue: #4A90E2;
  --navy-blue: #1B365D;
  --accent-blue: #3B82F6;
  --card-bg: rgba(255, 255, 255, 0.98);
  --text-primary: #1a202c;
  --text-secondary: #4a5568;
  --success-color: #10b981;
  --error-color: #ef4444;
}
```

### Key CSS Classes
- `.login-container` - Main container with gradient background
- `.login-card` - Glassmorphism card with backdrop blur
- `.form-input` - Professional input styling with focus effects
- `.login-button` - Gradient button with hover animations
- `.google-button` - Google OAuth button styling
- `.error-message` - Error message styling with icons
- `.success-message` - Success message styling

## API Integration

All components integrate with the backend API at `http://localhost:8000/auth`:

### Endpoints Used
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration
- `POST /auth/request-reset` - Password reset request
- `POST /auth/reset-password` - Password reset with code
- `POST /auth/verify` - Email verification
- `GET /auth/google/login` - Google OAuth

## Form Validation

### Email Validation
- Required field validation
- Email format validation
- Real-time error messages

### Password Validation
- Minimum 8 characters
- Must contain uppercase letter
- Must contain number
- Password confirmation matching

### Code Validation
- 6-digit numeric code
- Required field validation
- Pattern matching

## Google OAuth

The Google authentication uses popup windows for better UX:

```typescript
onGoogleSignIn() {
  const popup = window.open(
    `${this.apiBase}/auth/google/login`,
    'googleAuth',
    'width=500,height=600,scrollbars=yes,resizable=yes'
  );
  
  // Listen for popup close and check authentication
  const checkClosed = setInterval(() => {
    if (popup?.closed) {
      clearInterval(checkClosed);
      const token = localStorage.getItem('access_token');
      if (token) {
        this.router.navigate(['/dashboard']);
      }
    }
  }, 1000);
}
```

## Routing

The login module is integrated with Angular Router:

```typescript
const routes: Routes = [
  { path: 'signin', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'verify', component: VerifyComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-reset', component: VerifyResetComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
];
```

## Security Features

- **JWT Token Storage** in localStorage
- **Route Guards** for protected routes
- **Form Validation** on both client and server
- **CSRF Protection** through Angular's built-in mechanisms
- **Secure Password Requirements** with strength validation

## Responsive Design

The login module is fully responsive with breakpoints:
- Desktop: Full glassmorphism design
- Tablet: Adjusted spacing and sizing
- Mobile: Optimized layout with touch-friendly inputs

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Development

To run the login module:

```bash
# Install dependencies
npm install

# Start development server
ng serve

# Build for production
ng build --configuration production
```

## Customization

### Colors
Update CSS variables in `src/styles.css` to change the color scheme.

### Styling
Modify the CSS classes to customize the appearance.

### Validation
Update the form validators in each component to change validation rules.

### API Endpoints
Update the `api` property in each component to point to your backend.

## Troubleshooting

### Common Issues

1. **Build Errors**: Ensure all TypeScript errors are fixed
2. **Styling Issues**: Check that `src/styles.css` is included in `angular.json`
3. **API Errors**: Verify backend is running on `http://localhost:8000`
4. **Google OAuth**: Ensure popup blockers are disabled

### Debug Mode

Enable debug mode by setting `console.log` statements in the authentication methods.

## License

This login module is part of the Kudzu application and follows the same licensing terms.

















