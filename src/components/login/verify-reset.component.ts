import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-verify-reset',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;padding:20px;">
      <div style="width:100%;max-width:380px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.06);padding:28px;">
        <div style="text-align:center;margin-bottom:18px;">
          <img src="assets/kudzulogo.png" alt="Kudzu Logo" style="width:56px;height:56px;border-radius:8px;" />
          <h1 style="margin:10px 0 4px;font-size:22px;font-weight:700;color:#111827;">Enter reset code</h1>
          <p style="margin:0;color:#6b7280;font-size:14px;">We sent a 6‑digit code to {{ email }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Verification Code</label>
            <input maxlength="6" formControlName="code" placeholder="123456"
                   [class.error]="submitted && form.controls['code'].invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:18px;letter-spacing:0.5em;text-align:center;" />
            <div *ngIf="submitted && form.controls['code'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
              Enter a valid 6‑digit code
            </div>
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">New Password</label>
            <input type="password" formControlName="newPassword" placeholder="••••••••"
                   [class.error]="submitted && form.controls['newPassword'].invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
            <div *ngIf="submitted && form.controls['newPassword'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
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
            <span *ngIf="!loading">Reset password</span>
            <span *ngIf="loading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Resetting...
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
export class VerifyResetComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  api = '';

  email = '';
  loading = false;
  submitted = false;
  error = '';
  success = '';

  form: FormGroup;

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
  }

  constructor() {
    this.form = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(8), this.strength]],
      confirm: ['', [Validators.required]],
    }, { validators: this.match });
  }

  strength(c: AbstractControl) {
    const v = c.value || '';
    return /[A-Z]/.test(v) && /\d/.test(v) && v.length >= 8 ? null : { strength: true };
  }
  match(c: AbstractControl) {
    const a = c.get('newPassword')?.value, b = c.get('confirm')?.value;
    return a && b && a === b ? null : { mismatch: true };
  }

  submit() {
    this.submitted = true;
    if (this.form.invalid) return;
    this.loading = true; this.error = ''; this.success = '';
    const { code, newPassword } = this.form.value;
    this.auth.verifyReset(this.email, code, newPassword)
      .subscribe({
        next: r => { this.success = r.message; this.loading = false; this.router.navigate(['/signin']); },
        error: (e: HttpErrorResponse) => { this.error = e.error?.detail || 'Reset failed'; this.loading = false; }
      });
  }
}
