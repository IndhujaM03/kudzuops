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
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;padding:20px;">
      <div style="width:100%;max-width:380px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.06);padding:28px;">
        <div style="text-align:center;margin-bottom:18px;">
          <img src="assets/kudzulogo.png" alt="Kudzu Logo" style="width:56px;height:56px;border-radius:8px;" />
          <h1 style="margin:10px 0 4px;font-size:22px;font-weight:700;color:#111827;">Create your account</h1>
          <p style="margin:0;color:#6b7280;font-size:14px;">Sign up to get started</p>
        </div>

        <div *ngIf="error" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:14px;">
          {{ error }}
        </div>
        <div *ngIf="success" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:14px;">
          {{ success }}
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Email</label>
            <input type="email" formControlName="email" placeholder="you@example.com"
                   [class.error]="submitted && form.controls['email'].invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
            <div *ngIf="submitted && form.controls['email'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
              Valid email required
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Password</label>
            <input type="password" formControlName="password" placeholder="••••••••"
                   [class.error]="submitted && form.controls['password'].invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
            <div *ngIf="submitted && form.controls['password'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
              Min 8 chars, 1 uppercase, 1 number
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Confirm Password</label>
            <input type="password" formControlName="confirm" placeholder="••••••••"
                   [class.error]="submitted && form.errors?.['mismatch']"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
            <div *ngIf="submitted && form.errors?.['mismatch']" style="color:#b91c1c;font-size:12px;margin-top:6px;">
              Passwords do not match
            </div>
          </div>

          <button type="submit" class="login-button" [disabled]="loading">
            <span *ngIf="!loading">Create account</span>
            <span *ngIf="loading">Creating…</span>
          </button>

          <div style="display:flex;justify-content:center;margin:14px 0 0;">
            <a routerLink="/signin" style="font-size:13px;color:#2563eb;text-decoration:none;">Already have an account? Sign in</a>
          </div>
        </form>

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
