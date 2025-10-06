import { Component, signal, inject } from '@angular/core';
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
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;padding:20px;">
      <div style="width:100%;max-width:380px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.06);padding:28px;">
        <div style="text-align:center;margin-bottom:18px;">
          <img src="assets/kudzulogo.png" alt="Kudzu Logo" style="width:56px;height:56px;border-radius:8px;" />
          <h1 style="margin:10px 0 4px;font-size:22px;font-weight:700;color:#111827;">Sign in</h1>
          <p style="margin:0;color:#6b7280;font-size:14px;">Access your dashboard</p>
        </div>

        <div *ngIf="alertMessage" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:14px;">
          {{ alertMessage }}
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Email</label>
            <input type="email" formControlName="email" placeholder="you@example.com"
                   [class.error]="submitted && form.get('email')?.invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
            <div *ngIf="submitted && form.get('email')?.invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
              <span *ngIf="form.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="form.get('email')?.errors?.['email']">Enter a valid email</span>
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Password</label>
            <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="••••••••"
                   [class.error]="submitted && form.get('password')?.invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
            <div *ngIf="submitted && form.get('password')?.invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
              <span *ngIf="form.get('password')?.errors?.['required']">Password is required</span>
            </div>
          </div>

          <button type="submit" class="login-button" [disabled]="loading() || form.invalid">
            <span *ngIf="!loading()">Sign In</span>
            <span *ngIf="loading()">Signing in…</span>
          </button>
        </form>

        <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 12px;">
          <a [routerLink]="['/reset-password']" style="font-size:13px;color:#2563eb;text-decoration:none;">Forgot password?</a>
          <a [routerLink]="['/signup']" style="font-size:13px;color:#2563eb;text-decoration:none;">Create account</a>
        </div>

        <div style="display:flex;align-items:center;margin:10px 0 12px;gap:10px;">
          <div style="height:1px;background:#e5e7eb;flex:1;"></div>
          <div style="color:#6b7280;font-size:12px;">or</div>
          <div style="height:1px;background:#e5e7eb;flex:1;"></div>
        </div>

        <button type="button" (click)="onGoogleSignIn()" [disabled]="loading()"
                style="width:100%;background:#ffffff;border:1px solid #e5e7eb;color:#111827;padding:10px 14px;border-radius:8px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  private notify = new NotificationService();

  apiBase = 'http://localhost:8000';
  loading = signal(false);
  submitted = false;
  alertMessage = '';
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

  togglePassword() { this.showPassword.update(v => !v); }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    const { email, password } = this.form.value;

    this.auth.login(email, password).subscribe({
      next: (r) => {
        this.loading.set(false);
        if (r?.verification_required) {
          this.alertMessage = 'Verification required. Code sent to your email.';
          this.router.navigate(['/verify'], { queryParams: { email } }).catch(() => {});
          return;
        }
        const path = r?.redirect_url || '/dashboard';
        this.router.navigate([path]).catch(() => {});
      },
      error: (err: HttpErrorResponse) => {
        const msg = err.error?.detail || 'Invalid credentials';
        this.alertMessage = msg;
        this.loading.set(false);
      }
    });
  }

  onGoogleSignIn() {
    if (this.loading()) return;
    // Open Google OAuth in a popup window for better UX
    const popup = window.open(`${this.apiBase}/auth/google/login`, 'googleAuth', 'width=500,height=600,scrollbars=yes,resizable=yes');
    
    // Listen for the popup to close and check for success
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        // Check if user is now authenticated
        const token = localStorage.getItem('access_token');
        if (token) {
          this.notify.showSuccess('Google sign-in successful');
          this.router.navigate(['/dashboard']).catch(() => {});
        }
      }
    }, 1000);
  }
}