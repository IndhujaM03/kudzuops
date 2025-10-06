import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verify',
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
          <h1 class="login-title">{{ title }}</h1>
          <p class="login-subtitle">{{ subtitle }} {{ email }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
          <div class="form-group">
            <label class="form-label">Verification Code</label>
            <input maxlength="6" formControlName="code" class="form-input" 
                   placeholder="123456" style="text-align: center; letter-spacing: 0.5em; font-size: 1.25rem;"
                   [class.error]="submitted && form.invalid">
            <div class="error-message" *ngIf="submitted && form.invalid">
              <span class="error-icon">⚠</span>
              Enter a valid 6‑digit code
            </div>
          </div>

          <button type="submit" class="login-button" [disabled]="loading">
            <span *ngIf="!loading">Verify</span>
            <span *ngIf="loading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Verifying...
            </span>
          </button>

          <button type="button" class="google-button" (click)="resend()" [disabled]="cooldown>0">
            <span *ngIf="cooldown === 0">Resend code</span>
            <span *ngIf="cooldown > 0">Resend code ({{cooldown}}s)</span>
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
export class VerifyComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  api = 'http://localhost:8000/auth';

  email = '';
  cooldown = 0;
  timer?: any;
  loading = false;
  submitted = false;
  error = '';
  success = '';

  form = this.fb.group({ code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });
  title = 'Verify your email';
  subtitle = 'Enter the 6-digit code sent to your email';

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get('email') || '';
    const source = this.route.snapshot.queryParamMap.get('source');
    if (source === 'google') {
      // Update UI for Google OAuth verification
      this.title = 'Complete Google Signup';
      this.subtitle = 'Enter the 6-digit code sent to your email to complete registration';
    }
  }

  submit() {
    this.submitted = true;
    if (this.form.invalid) return;
    this.loading = true; this.error = ''; this.success = '';
    
    const source = this.route.snapshot.queryParamMap.get('source');
    const endpoint = source === 'google' ? '/verify-google' : '/verify';
    
    this.auth.verify(this.email, this.form.value.code!, source === 'google').subscribe({
      next: _ => { this.loading = false; this.success = 'Verified! Redirecting...'; this.router.navigate(['/dashboard']); },
      error: (e: HttpErrorResponse) => { this.error = e.error?.detail || 'Verification failed'; this.loading = false; }
    });
  }

  resend() {
    if (this.cooldown) return;
    this.auth.resendVerification(this.email).subscribe({
      next: _ => this.startCooldown(),
      error: _ => this.startCooldown()
    });
  }
  startCooldown() {
    this.cooldown = 60;
    this.timer = setInterval(() => { this.cooldown--; if (this.cooldown <= 0) clearInterval(this.timer); }, 1000);
  }
}

