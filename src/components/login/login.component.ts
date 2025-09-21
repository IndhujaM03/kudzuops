import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <!-- Background Pattern -->
      <div class="login-background"></div>
      
      <!-- Login Card -->
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">
            <img src="assets/kudzulogo.png" alt="Kudzu Logo" class="logo-image">
          </div>
          <h1 class="login-title">Welcome to Kudzu</h1>
          <p class="login-subtitle">Sign in to access your analytics dashboard</p>
        </div>

        <form class="login-form" (ngSubmit)="onLogin()" #loginForm="ngForm">
          <div class="form-group">
            <label for="username" class="form-label">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              class="form-input"
              [(ngModel)]="username"
              required
              placeholder="Enter your username"
              [class.error]="showError"
            >
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              [(ngModel)]="password"
              required
              placeholder="Enter your password"
              [class.error]="showError"
            >
          </div>

          <div *ngIf="showError" class="error-message">
            <span class="error-icon">⚠️</span>
            Invalid username or password
          </div>

          <button
            type="submit"
            class="login-button"
            [disabled]="!username || !password || isLoading"
          >
            <span *ngIf="!isLoading">Sign In</span>
            <span *ngIf="isLoading" class="loading-spinner-inline">
              <div class="spinner"></div>
              Signing in...
            </span>
          </button>
        </form>

        <div class="login-footer">
          <p class="footer-text">
            © 2025 Kudzu Analytics - Secure Dashboard Access
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--sky-blue) 0%, var(--primary-blue) 50%, var(--navy-blue) 100%);
      position: relative;
      padding: 2rem;
    }

    .login-background {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
      opacity: 0.3;
    }

    .login-card {
      background: var(--card-bg);
      border-radius: 20px;
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--border-color);
      width: 100%;
      max-width: 420px;
      position: relative;
      z-index: 2;
      overflow: hidden;
    }

    .login-header {
      padding: 3rem 2rem 2rem 2rem;
      text-align: center;
      background: linear-gradient(135deg, rgba(74, 144, 226, 0.05) 0%, rgba(27, 54, 93, 0.05) 100%);
      border-bottom: 1px solid var(--border-color);
    }

    .login-logo {
      margin-bottom: 1.5rem;
    }

    .logo-image {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      box-shadow: var(--shadow);
    }

    .login-title {
      font-size: 1.875rem;
      font-weight: 800;
      color: var(--text-primary);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.025em;
    }

    .login-subtitle {
      font-size: 1rem;
      color: var(--text-secondary);
      margin: 0;
      font-weight: 400;
    }

    .login-form {
      padding: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .form-input {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 2px solid var(--border-color);
      border-radius: 12px;
      background: var(--primary-bg);
      color: var(--text-primary);
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--primary-blue);
      box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
      background: var(--card-bg);
    }

    .form-input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .form-input::placeholder {
      color: var(--text-muted);
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #ef4444;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
    }

    .error-icon {
      font-size: 1rem;
    }

    .login-button {
      width: 100%;
      padding: 1rem 1.5rem;
      background: linear-gradient(135deg, var(--primary-blue), var(--navy-blue));
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .login-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    .login-button:active:not(:disabled) {
      transform: translateY(0);
    }

    .login-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .loading-spinner-inline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }

    .login-footer {
      padding: 1.5rem 2rem;
      text-align: center;
      border-top: 1px solid var(--border-color);
      background: var(--primary-bg);
    }

    .footer-text {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Responsive Design */
    @media (max-width: 480px) {
      .login-container {
        padding: 1rem;
      }

      .login-card {
        max-width: 100%;
      }

      .login-header {
        padding: 2rem 1.5rem 1.5rem 1.5rem;
      }

      .login-form {
        padding: 1.5rem;
      }

      .login-title {
        font-size: 1.5rem;
      }

      .login-subtitle {
        font-size: 0.875rem;
      }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  showError = false;
  isLoading = false;

  constructor(private authService: AuthService) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      return;
    }

    this.isLoading = true;
    this.showError = false;

    // Simulate loading delay for better UX
    setTimeout(() => {
      const success = this.authService.login(this.username, this.password);
      
      if (!success) {
        this.showError = true;
        this.password = ''; // Clear password on failed attempt
      }
      
      this.isLoading = false;
    }, 800);
  }
}