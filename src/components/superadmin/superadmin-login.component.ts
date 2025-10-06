import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SuperAdminService } from '../../services/superadmin.service';

@Component({
  selector: 'app-superadmin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="superadmin-login-container">
      <div class="superadmin-login-card">
        <div class="superadmin-login-header">
          <div class="superadmin-login-logo">
            <img class="logo-image" src="assets/kudzulogo.png" alt="Kudzu Logo">
          </div>
          <h1 class="superadmin-login-title">Super Admin Login</h1>
          <p class="superadmin-login-subtitle">Access the admin dashboard</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="superadmin-login-form">
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Email address</label>
            <input
              type="email"
              formControlName="email"
              class="superadmin-form-input"
              placeholder="admin@kudzu.com"
              [class.error]="submitted && form.get('email')?.invalid"
            />
            <div class="superadmin-error-message" *ngIf="submitted && form.get('email')?.invalid">
              <span class="superadmin-error-icon">⚠</span>
              <span *ngIf="form.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="form.get('email')?.errors?.['email']">Enter a valid email</span>
            </div>
          </div>

          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Password</label>
            <input
              type="password"
              formControlName="password"
              class="superadmin-form-input"
              placeholder="••••••••"
              [class.error]="submitted && form.get('password')?.invalid"
            />
            <div class="superadmin-error-message" *ngIf="submitted && form.get('password')?.invalid">
              <span class="superadmin-error-icon">⚠</span>
              <span *ngIf="form.get('password')?.errors?.['required']">Password is required</span>
            </div>
          </div>

          <button
            type="submit"
            class="superadmin-login-button"
            [disabled]="loading() || form.invalid"
          >
            <span *ngIf="!loading()">Sign in</span>
            <span *ngIf="loading()" class="superadmin-loading-spinner-inline">
              <div class="superadmin-loading-spinner"></div>
              Signing in...
            </span>
          </button>

          <div *ngIf="error" class="superadmin-error-message">
            <span class="superadmin-error-icon">⚠</span>
            {{ error }}
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    /* Super Admin Login Styles */
    .superadmin-login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .superadmin-login-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      padding: 40px;
      width: 100%;
      max-width: 400px;
      position: relative;
      overflow: hidden;
    }

    .superadmin-login-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .superadmin-login-header {
      text-align: center;
      margin-bottom: 30px;
    }

    .superadmin-login-logo {
      margin-bottom: 20px;
    }

    .logo-image {
      width: 60px;
      height: 60px;
      border-radius: 8px;
    }

    .superadmin-login-title {
      font-size: 28px;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 8px;
    }

    .superadmin-login-subtitle {
      color: #718096;
      font-size: 16px;
    }

    .superadmin-login-form {
      padding: 0;
    }

    .superadmin-form-group {
      margin-bottom: 20px;
    }

    .superadmin-form-label {
      display: block;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .superadmin-form-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 16px;
      transition: all 0.2s ease;
      background: #f7fafc;
      box-sizing: border-box;
    }

    .superadmin-form-input:focus {
      outline: none;
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .superadmin-form-input.error {
      border-color: #e53e3e;
      background: #fed7d7;
    }

    .superadmin-error-message {
      display: flex;
      align-items: center;
      margin-top: 8px;
      color: #e53e3e;
      font-size: 14px;
    }

    .superadmin-error-icon {
      margin-right: 6px;
      font-size: 16px;
    }

    .superadmin-login-button {
      width: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 20px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .superadmin-login-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .superadmin-login-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .superadmin-loading-spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 1s ease-in-out infinite;
      margin-right: 8px;
    }

    .superadmin-loading-spinner-inline {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class SuperAdminLoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private superAdminService = inject(SuperAdminService);

  loading = signal(false);
  error = '';
  submitted = false;

  form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error = '';

    const { email, password } = this.form.value;

    this.superAdminService.login(email, password).subscribe({
      next: (response) => {
        this.superAdminService.storeAuth(response);
        this.router.navigate(['/superadmin/dashboard']);
      },
      error: (err) => {
        this.error = err.error?.detail || 'Login failed';
        this.loading.set(false);
      }
    });
  }
}
