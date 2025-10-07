import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TeamLeaderService } from '../../services/teamleader.service';

@Component({
  selector: 'app-teamleader-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="superadmin-login-container">
      <div class="superadmin-login-card">
        <div class="superadmin-login-header">
          <div class="superadmin-login-logo">
            <img class="logo-image" src="assets/kudzulogo.png" alt="Kudzu Logo">
          </div>
          <h1 class="superadmin-login-title">Team Leader Login</h1>
          <p class="superadmin-login-subtitle">Access the TL dashboard</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="superadmin-login-form">
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Email address</label>
            <input type="email" formControlName="email" class="superadmin-form-input" placeholder="you@kudzu.com" [class.error]="submitted && form.get('email')?.invalid" />
            <div class="superadmin-error-message" *ngIf="submitted && form.get('email')?.invalid">
              <span class="superadmin-error-icon">⚠</span>
              <span *ngIf="form.get('email')?.errors?.['required']">Email is required</span>
              <span *ngIf="form.get('email')?.errors?.['email']">Enter a valid email</span>
            </div>
          </div>

          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Password</label>
            <input type="password" formControlName="password" class="superadmin-form-input" placeholder="••••••••" [class.error]="submitted && form.get('password')?.invalid" />
            <div class="superadmin-error-message" *ngIf="submitted && form.get('password')?.invalid">
              <span class="superadmin-error-icon">⚠</span>
              <span *ngIf="form.get('password')?.errors?.['required']">Password is required</span>
            </div>
          </div>

          <button type="submit" class="superadmin-login-button" [disabled]="loading() || form.invalid">
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
  styles: []
})
export class TeamLeaderLoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private tl = inject(TeamLeaderService);

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
    this.tl.login(email, password).subscribe({
      next: (res) => {
        const redirect = (res as any)?.redirect_url || '';
        // Only allow TL login to proceed if backend indicates teamleader route
        if (redirect.startsWith('/teamleader')) {
          this.tl.storeAuth(res);
          this.router.navigate([redirect]);
          return;
        }
        // Otherwise, show an error and do not store token
        this.error = 'This account is not a Team Leader. Please use the correct portal.';
        this.loading.set(false);
      },
      error: (err) => {
        this.error = err?.error?.detail || 'Login failed';
        this.loading.set(false);
      }
    });
  }
}


