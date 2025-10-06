import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, FormGroup } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="login-container">
      <div class="login-background"></div>
      
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="logo-image">
          </div>
          <h1 class="login-title">Create your account</h1>
          <p class="login-subtitle">Enter the 4‑digit code sent to your email to verify</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" formControlName="email" class="form-input" 
                   placeholder="you@example.com"
                   [class.error]="submitted && form.controls['email'].invalid">
            <div class="error-message" *ngIf="submitted && form.controls['email'].invalid">
              <span class="error-icon">⚠</span>
              Valid email required
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" formControlName="password" class="form-input" 
                   placeholder="••••••••"
                   [class.error]="submitted && form.controls['password'].invalid">
            <div class="error-message" *ngIf="submitted && form.controls['password'].invalid">
              <span class="error-icon">⚠</span>
              Min 8 chars, 1 uppercase, 1 number
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input type="password" formControlName="confirm" class="form-input" 
                   placeholder="••••••••"
                   [class.error]="submitted && form.errors?.['mismatch']">
            <div class="error-message" *ngIf="submitted && form.errors?.['mismatch']">
              <span class="error-icon">⚠</span>
              Passwords do not match
            </div>
          </div>

          <button type="submit" class="login-button" [disabled]="loading">
            <span *ngIf="!loading">Create account</span>
            <span *ngIf="loading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Creating...
            </span>
          </button>

          <button type="button" class="google-button" (click)="google()" [disabled]="loading">
            <svg class="google-icon" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>

          <div class="text-center mt-4">
            <a routerLink="/signin" class="auth-link">Already have an account? Sign in</a>
          </div>

          <div class="error-message" *ngIf="error">
            <span class="error-icon">⚠</span>
            {{ error }}
          </div>
          <div class="success-message" *ngIf="success">
            <span class="error-icon">✓</span>
            {{ success }}
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
export class SignupComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  loading = false;
  submitted = false;
  error = '';
  success = '';
  api = 'http://localhost:8000/auth';

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), this.strength]],
      confirm: ['', [Validators.required]],
    }, { validators: this.match });
  }

  strength(c: AbstractControl) {
    const v = c.value || '';
    return /[A-Z]/.test(v) && /\d/.test(v) && v.length >= 8 ? null : { strength: true };
  }
  match(c: AbstractControl) {
    const a = c.get('password')?.value, b = c.get('confirm')?.value;
    return a && b && a === b ? null : { mismatch: true };
  }

  submit() {
    this.submitted = true;
    if (this.form.invalid) return;
    this.loading = true; this.error = ''; this.success = '';
    const { email, password, confirm } = this.form.value;
    this.auth.signup(email, password, confirm)
      .subscribe({
        next: r => { this.success = r.message; this.loading = false; this.router.navigate(['/verify'], { queryParams: { email } }); },
        error: (e: HttpErrorResponse) => { this.error = e.error?.detail || 'Registration failed'; this.loading = false; }
      });
  }
  google() { 
    // Open Google OAuth in a popup window for better UX
    const popup = window.open(
      `${this.api}/google/login`,
      'googleAuth',
      'width=500,height=600,scrollbars=yes,resizable=yes'
    );
    
    // Listen for the popup to close and check for success
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        // Check if user is now authenticated
        const token = localStorage.getItem('access_token');
        if (token) {
          this.success = 'Google sign-up successful';
          this.router.navigate(['/dashboard']).catch(() => {});
        }
      }
    }, 1000);
  }
}
