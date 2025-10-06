import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;padding:20px;">
      <div style="width:100%;max-width:380px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.06);padding:28px;">
        <div style="text-align:center;margin-bottom:18px;">
          <img src="assets/kudzulogo.png" alt="Kudzu Logo" style="width:56px;height:56px;border-radius:8px;" />
          <h1 style="margin:10px 0 4px;font-size:22px;font-weight:700;color:#111827;">Reset Password</h1>
          <p style="margin:0;color:#6b7280;font-size:14px;">Enter your email to receive a reset code</p>
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

          <button type="submit" class="login-button" [disabled]="loading">
            <span *ngIf="!loading">Send reset code</span>
            <span *ngIf="loading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Sending...
            </span>
          </button>

          <div *ngIf="error" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-top:8px;font-size:14px;">
            {{ error }}
          </div>
          <div *ngIf="success" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-top:8px;font-size:14px;">
            {{ success }}
          </div>

          <div style="display:flex;justify-content:center;margin:14px 0 0;">
            <a routerLink="/signin" style="font-size:13px;color:#2563eb;text-decoration:none;">Back to sign in</a>
          </div>
        </form>
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  api = '';

  loading = false;
  submitted = false;
  error = '';
  success = '';

  form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });

  submit() {
    this.submitted = true;
    if (this.form.invalid) return;
    this.loading = true; this.error = ''; this.success = '';
    const email = this.form.value.email!;
    this.auth.requestPasswordReset(email).subscribe({
      next: r => { this.success = r.message; this.loading = false; this.router.navigate(['/verify-reset'], { queryParams: { email } }); },
      error: (e: HttpErrorResponse) => { this.error = e.error?.detail || 'Request failed'; this.loading = false; }
    });
  }
}

