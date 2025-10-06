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
    <div class="login-container">
      <div class="login-background"></div>
      
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="logo-image">
          </div>
          <h1 class="login-title">Enter reset code</h1>
          <p class="login-subtitle">We sent a 6‑digit code to {{ email }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
          <div class="form-group">
            <label class="form-label">Verification Code</label>
            <input maxlength="6" formControlName="code" class="form-input" 
                   placeholder="123456" style="text-align: center; letter-spacing: 0.5em; font-size: 1.25rem;"
                   [class.error]="submitted && form.controls['code'].invalid">
            <div class="error-message" *ngIf="submitted && form.controls['code'].invalid">
              <span class="error-icon">⚠</span>
              Enter a valid 6-digit code
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">New Password</label>
            <input type="password" formControlName="newPassword" class="form-input" 
                   placeholder="••••••••"
                   [class.error]="submitted && form.controls['newPassword'].invalid">
            <div class="error-message" *ngIf="submitted && form.controls['newPassword'].invalid">
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
            <span *ngIf="!loading">Reset password</span>
            <span *ngIf="loading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Resetting...
            </span>
          </button>

          <div class="error-message" *ngIf="error">
            <span class="error-icon">⚠</span>
            {{ error }}
          </div>
          <div class="success-message" *ngIf="success">
            <span class="error-icon">✓</span>
            {{ success }}
          </div>

          <div class="text-center mt-4">
            <a routerLink="/signin" class="auth-link">Back to sign in</a>
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
