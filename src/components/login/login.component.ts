import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
}

class NotificationService {
  showSuccess(message: string): void {
    const el = document.createElement('div');
    el.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded shadow';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
  showError(message: string): void {
    const el = document.createElement('div');
    el.className = 'fixed top-4 right-4 z-50 bg-red-600 text-white px-4 py-2 rounded shadow';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="login-container">
      <div class="login-background"></div>
      
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="logo-image">
          </div>
          <h1 class="login-title">Welcome to Kudzu</h1>
          <p class="login-subtitle">Sign in to access your analytics dashboard</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" formControlName="email" class="form-input" 
                   placeholder="you@example.com"
                   [class.error]="submitted && form.get('email')?.invalid">
            <div class="error-message" *ngIf="submitted && form.get('email')?.invalid">
              <span class="error-icon">⚠</span>
              <span *ngIf="form.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="form.get('email')?.errors?.['email']">Enter a valid email</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <div style="position: relative;">
              <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" 
                     class="form-input" placeholder="••••••••"
                     [class.error]="submitted && form.get('password')?.invalid">
              <button type="button" (click)="togglePassword()" 
                      style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-muted);">
                <svg *ngIf="!showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                <svg *ngIf="showPassword()" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                </svg>
              </button>
            </div>
            <div class="error-message" *ngIf="submitted && form.get('password')?.invalid">
              <span class="error-icon">⚠</span>
              <span *ngIf="form.get('password')?.errors?.['required']">Password is required</span>
              <span *ngIf="form.get('password')?.errors?.['minlength']">Minimum 8 characters</span>
              <span *ngIf="form.get('password')?.errors?.['strength']">Must contain uppercase and number</span>
            </div>
          </div>

          <button type="submit" class="login-button" [disabled]="loading() || form.invalid">
            <span *ngIf="!loading()">Sign In</span>
            <span *ngIf="loading()" class="loading-spinner-inline">
              <div class="spinner"></div>
              Signing in...
            </span>
          </button>

          <button type="button" class="google-button" (click)="onGoogleSignIn()" [disabled]="loading()">
            <svg class="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">
            <a class="auth-link" [routerLink]="['/reset-password']">Forgot password?</a>
            <a class="auth-link" [routerLink]="['/signup']">Create account</a>
          </div>
        </form>

        <div class="login-footer">
          <p class="footer-text">
            <a href="#" class="auth-link">Conditions of Use</a> • 
            <a href="#" class="auth-link">Privacy Notice</a> • 
            <a href="#" class="auth-link">Help</a>
          </p>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private notify = new NotificationService();

  apiBase = 'http://localhost:8000';
  loading = signal(false);
  submitted = false;
  showPassword = signal(false);

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]]
  });

  passwordStrengthValidator(control: AbstractControl) {
    const value = String(control.value || '');
    if (!value) return null;
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    return hasUpper && hasNumber ? null : { strength: true };
  }

  ngOnInit() {
    // Check if user is already authenticated
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard']).catch(() => {});
    }
  }

  togglePassword() { this.showPassword.update(v => !v); }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    const { email, password } = this.form.value;

    this.auth.login(email, password).subscribe({
      next: (response) => {
        this.loading.set(false);
        
        // Handle verification required case
        if (response?.verification_required) {
          this.notify.showSuccess('Verification required. Code sent to your email.');
          this.router.navigate(['/verify'], { queryParams: { email } }).catch(() => {});
          return;
        }
        
        // Check if login was successful (has access token)
        if (response?.access_token) {
          this.notify.showSuccess('Login successful');
          // Small delay to ensure token is stored before navigation
          setTimeout(() => {
            this.router.navigate(['/dashboard']).catch(() => {});
          }, 100);
        } else {
          this.notify.showError('Login failed. Please try again.');
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        let msg = err.error?.detail || 'Invalid email or password';
        
        // Handle specific error cases
        if (err.status === 403 && msg.includes('awaiting approval')) {
          msg = 'Your account is awaiting approval from an administrator. Please contact support.';
        } else if (err.status === 401) {
          msg = 'Invalid email or password. Please check your credentials.';
        }
        
        this.notify.showError(msg);
      }
    });
  }

  onGoogleSignIn() {
    if (this.loading()) return;
    this.loading.set(true);
    
    // Open Google OAuth in a popup window for better UX
    const popup = window.open(`${this.apiBase}/auth/google`, 'googleAuth', 'width=500,height=600,scrollbars=yes,resizable=yes');
    
    // Listen for the popup to close and check for success
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        this.loading.set(false);
        
        // Check if user is now authenticated
        const token = localStorage.getItem('access_token');
        if (token) {
          this.notify.showSuccess('Google sign-in successful');
          // Small delay to ensure token is properly stored
          setTimeout(() => {
            this.router.navigate(['/dashboard']).catch(() => {});
          }, 100);
        } else {
          this.notify.showError('Google sign-in failed. Please try again.');
        }
      }
    }, 1000);
  }
}