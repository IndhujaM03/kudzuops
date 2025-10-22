import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
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
    <div class="center-fullpage">
      <div class="auth-card">
        <div class="auth-header">
          <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="auth-logo" />
          <h1 class="auth-title">Sign in</h1>
          <p class="auth-subtitle">Access your dashboard</p>
        </div>

        <div *ngIf="alertMessage" class="alert alert-error">
          {{ alertMessage }}
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" formControlName="email" placeholder="you@example.com"
                   [class.error]="submitted && form.get('email')?.invalid"
                   class="form-input" />
            <div *ngIf="submitted && form.get('email')?.invalid" class="form-error">
              <span *ngIf="form.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="form.get('email')?.errors?.['email']">Enter a valid email</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <input [type]="showPassword() ? 'text' : 'password'" formControlName="password" placeholder="••••••••"
                   [class.error]="submitted && form.get('password')?.invalid"
                   class="form-input" />
            <div *ngIf="submitted && form.get('password')?.invalid" class="form-error">
              <span *ngIf="form.get('password')?.errors?.['required']">Password is required</span>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" [disabled]="loading() || form.invalid">
            <span *ngIf="!loading()">Sign In</span>
            <span *ngIf="loading()">Signing in…</span>
          </button>
        </form>

        <div class="auth-links">
          <a [routerLink]="['/reset-password']" class="auth-link">Forgot password?</a>
          <a [routerLink]="['/signup']" class="auth-link">Create account</a>
        </div>

        <div class="auth-divider">
          <div class="divider-line"></div>
          <div class="divider-text">or</div>
          <div class="divider-line"></div>
        </div>

        <button type="button" (click)="onGoogleSignIn()" [disabled]="loading()" class="btn btn-outline btn-full">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>

        <!-- Pending Approval Modal -->
        <div *ngIf="showApprovalModal" class="modal-overlay">
          <div class="modal">
            <div class="modal-header">
              <div class="modal-icon">!</div>
              <h3 class="modal-title">Awaiting approval</h3>
            </div>
            <div class="modal-body">
              <p class="modal-text">Your email is verified. A super admin must approve your account before you can sign in.</p>
              <ul class="modal-list">
                <li>We'll notify you by email once approved</li>
                <li>You can close this window and try later</li>
              </ul>
            </div>
            <div class="modal-footer">
              <button (click)="showApprovalModal=false" class="btn btn-secondary">Close</button>
              <button (click)="onGoogleSignIn()" class="btn btn-primary">Contact Admin</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .form-group {
      margin-bottom: 14px;
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

    .btn-secondary {
      background: #fff;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
      background: #f9fafb;
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
      justify-content: space-between;
      align-items: center;
      margin: 14px 0 12px;
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
      margin: 10px 0 12px;
      gap: 10px;
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

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
    }

    .modal {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 460px;
      padding: 22px;
    }

    .modal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .modal-icon {
      width: 36px;
      height: 36px;
      border-radius: 9999px;
      background: #FEF3C7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #D97706;
      font-weight: 700;
    }

    .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .modal-body {
      margin-bottom: 16px;
    }

    .modal-text {
      margin: 0 0 12px;
      color: var(--text-secondary);
    }

    .modal-list {
      margin: 0 0 16px 16px;
      color: var(--text-secondary);
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private notify = new NotificationService();

  apiBase = 'http://localhost:8000';
  loading = signal(false);
  submitted = false;
  alertMessage = '';
  showPassword = signal(false);
  showApprovalModal = false;

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]]
  });

  constructor() {
    // Show a notice after successful email verification
    const verified = this.route.snapshot.queryParamMap.get('verified');
    const email = this.route.snapshot.queryParamMap.get('email') || '';
    if (verified === '1' && email) {
      this.alertMessage = `Email verified for ${email}. You can sign in now.`;
    }
  }

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
        
        // Use redirect_url from backend if available, otherwise parse token
        if (r?.redirect_url) {
          this.router.navigate([r.redirect_url]).then((success) => {
            // Force a location reload to ensure URL updates properly
            if (this.router.url === '/signin' && r.redirect_url) {
              window.location.href = r.redirect_url;
            }
          }).catch((err) => {
            console.error('Navigation failed:', err);
            // Fallback to role-based navigation
            setTimeout(() => {
              this.handleRoleBasedNavigation(r);
            }, 100);
          });
        } else {
          // Wait a moment for token to be stored, then navigate
          setTimeout(() => {
            this.handleRoleBasedNavigation(r);
          }, 100);
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403 && (err.error?.detail || '').toLowerCase().includes('awaiting approval')) {
          this.showApprovalModal = true;
        } else {
          const msg = err.error?.detail || 'Invalid credentials';
          this.alertMessage = msg;
        }
        this.loading.set(false);
      }
    });
  }

  private handleRoleBasedNavigation(response: any) {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      this.router.navigate(['/dashboard']).catch((err) => console.error('Navigation error:', err));
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userRole = payload.role?.toLowerCase();
      
      // Navigate based on role
      if (userRole === 'super_admin') {
        this.router.navigate(['/superadmin/dashboard']).catch((err) => {
          console.error('Navigation to superadmin failed:', err);
        });
      } else if (userRole === 'team_leader' || userRole === 'teamleader' || userRole === 'team_leadr') {
        this.router.navigate(['/teamleader/demand-sheet']).catch((err) => {
          console.error('Navigation to teamleader failed:', err);
        });
      } else if (userRole === 'recruiter') {
        this.router.navigate(['/recruiter/dashboard']).catch((err) => {
          console.error('Navigation to recruiter failed:', err);
        });
      } else {
        this.router.navigate(['/dashboard']).catch((err) => {
          console.error('Navigation to dashboard failed:', err);
        });
      }
    } catch (error) {
      console.error('Token parsing error:', error);
      this.router.navigate(['/dashboard']).catch((err) => console.error('Navigation error:', err));
    }
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
          this.handleRoleBasedNavigation({});
        }
      }
    }, 1000);
  }
}