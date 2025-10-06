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
    <div class="login-container">
      <div class="login-background"></div>
      
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="logo-image">
          </div>
          <h1 class="login-title">Reset Password</h1>
          <p class="login-subtitle">Enter your email to receive a reset code</p>
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

          <button type="submit" class="login-button" [disabled]="loading">
            <span *ngIf="!loading">Send reset code</span>
            <span *ngIf="loading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Sending...
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

