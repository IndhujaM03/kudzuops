import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, FormGroup } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="signup-container">
      <div class="signup-card">
        <div class="signup-header">
          <div class="signup-logo">
            <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="logo-image" />
          </div>
          <h1 class="signup-title">Create your account</h1>
          <p class="signup-subtitle">Sign up to get started</p>
        </div>

        <div *ngIf="error" class="error-message">
          <span class="error-icon">⚠</span>
          {{ error }}
        </div>
        <div *ngIf="success" class="success-message">
          <span class="error-icon">✓</span>
          {{ success }}
        </div>

        <div class="signup-form">
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-group">
              <label class="form-label">First Name</label>
            <input type="text" formControlName="first_name" placeholder="Enter your first name"
                   [class.error]="submitted && form.controls['first_name'].invalid"
                     class="form-input" />
              <div *ngIf="submitted && form.controls['first_name'].invalid" class="form-error">
                <span *ngIf="form.controls['first_name'].errors?.['required']">First name is required</span>
                <span *ngIf="form.controls['first_name'].errors?.['minlength']">First name must be at least 1 character</span>
              </div>
          </div>

            <div class="form-group">
              <label class="form-label">Last Name</label>
            <input type="text" formControlName="last_name" placeholder="Enter your last name"
                   [class.error]="submitted && form.controls['last_name'].invalid"
                     class="form-input" />
              <div *ngIf="submitted && form.controls['last_name'].invalid" class="form-error">
                <span *ngIf="form.controls['last_name'].errors?.['required']">Last name is required</span>
                <span *ngIf="form.controls['last_name'].errors?.['minlength']">Last name must be at least 1 character</span>
              </div>
          </div>

            <div class="form-group">
              <label class="form-label">Email</label>
            <input type="email" formControlName="email" placeholder="you@example.com"
                   [class.error]="submitted && form.controls['email'].invalid"
                     class="form-input" autocomplete="username" />
              <div *ngIf="submitted && form.controls['email'].invalid" class="form-error">
              Valid email required
            </div>
          </div>

            <div class="form-group">
              <label class="form-label">Password</label>
            <input type="password" formControlName="password" placeholder="••••••••"
                   [class.error]="submitted && form.controls['password'].invalid"
                     class="form-input" autocomplete="new-password" />
              <div *ngIf="submitted && form.controls['password'].invalid" class="form-error">
              Min 8 chars, 1 uppercase, 1 number
            </div>
          </div>

            <div class="form-group">
              <label class="form-label">Confirm Password</label>
            <input type="password" formControlName="confirm" placeholder="••••••••"
                   [class.error]="submitted && form.errors?.['mismatch']"
                     class="form-input" autocomplete="new-password" />
              <div *ngIf="submitted && form.errors?.['mismatch']" class="form-error">
              Passwords do not match
            </div>
          </div>

            <button type="submit" class="btn btn-primary btn-full" [disabled]="loading">
              <span *ngIf="!loading">Create account</span>
              <span *ngIf="loading">Creating…</span>
            </button>
          </form>

          <div class="auth-links">
            <a routerLink="/signin" class="auth-link">Already have an account? Sign in</a>
          </div>

          <div class="auth-divider">
            <div class="divider-line"></div>
            <div class="divider-text">or</div>
            <div class="divider-line"></div>
          </div>

          <button type="button" (click)="google()" [disabled]="loading" class="btn btn-outline btn-full">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .signup-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 20px;
    }

    .signup-card {
      width: 100%;
      max-width: 480px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 0;
      overflow: hidden;
    }

    .signup-header {
      padding: 1.5rem 2rem 1rem 2rem;
      text-align: center;
      border-bottom: 1px solid #e2e8f0;
    }

    .signup-logo {
      margin-bottom: 0.75rem;
    }

    .logo-image {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .signup-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a202c;
      margin: 0 0 0.25rem 0;
      letter-spacing: -0.025em;
    }

    .signup-subtitle {
      font-size: 0.875rem;
      color: #718096;
      margin: 0;
      font-weight: 400;
    }

    .signup-form {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 12px;
    }

    .form-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 600;
      color: var(--text-primary);
      font-size: 13px;
    }

    .form-input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: #fff;
      font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--kudzu-primary);
      box-shadow: 0 0 0 3px var(--kudzu-primary-light);
    }

    .form-input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .form-error {
      color: #ef4444;
      font-size: 12px;
      margin-top: 6px;
    }

    .error-message {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fecaca;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .success-message {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 14px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      text-decoration: none;
    }

    .btn-primary {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--kudzu-primary-dark);
    }

    .btn-outline {
      background: #fff;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .btn-outline:hover {
      background: #f9fafb;
    }

    .btn-full {
      width: 100%;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .auth-links {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 12px 0 8px;
    }

    .auth-link {
      font-size: 13px;
      color: var(--kudzu-primary);
      text-decoration: none;
    }

    .auth-link:hover {
      text-decoration: underline;
    }

    .auth-divider {
      display: flex;
      align-items: center;
      margin: 8px 0 8px;
      gap: 8px;
    }

    .divider-line {
      height: 1px;
      background: var(--border-color);
      flex: 1;
    }

    .divider-text {
      color: var(--text-secondary);
      font-size: 12px;
    }
  `]
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
  api = environment.authBase || `${environment.apiBase}/auth`;

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(1)]],
      last_name: ['', [Validators.required, Validators.minLength(1)]],
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
    const { first_name, last_name, email, password, confirm } = this.form.value;
    this.auth.signup(first_name, last_name, email, password, confirm)
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
