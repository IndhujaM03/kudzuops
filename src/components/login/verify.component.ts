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
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;padding:20px;">
      <div style="width:100%;max-width:380px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.06);padding:28px;">
        <div style="text-align:center;margin-bottom:18px;">
          <img src="assets/kudzulogo.png" alt="Kudzu Logo" style="width:56px;height:56px;border-radius:8px;" />
          <h1 style="margin:10px 0 4px;font-size:22px;font-weight:700;color:#111827;">{{ title }}</h1>
          <p style="margin:0;color:#6b7280;font-size:14px;">{{ subtitle }} {{ email }}</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div style="margin-bottom:14px;">
            <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Verification Code</label>
            <input maxlength="6" formControlName="code" placeholder="123456"
                   [class.error]="submitted && form.invalid"
                   style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:18px;letter-spacing:0.5em;text-align:center;" />
            <div *ngIf="submitted && form.invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">
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

          <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 12px;">
            <a (click)="resend()" style="font-size:13px;color:#2563eb;text-decoration:none;cursor:pointer;" [style.pointer-events]="cooldown>0 ? 'none' : 'auto'">
              <span *ngIf="cooldown===0">Resend code</span>
              <span *ngIf="cooldown>0">Resend code ({{cooldown}}s)</span>
            </a>
            <a routerLink="/signin" style="font-size:13px;color:#2563eb;text-decoration:none;">Back to sign in</a>
          </div>

          <div *ngIf="error" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-top:8px;font-size:14px;">
            {{ error }}
          </div>
          <div *ngIf="success" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-top:8px;font-size:14px;">
            {{ success }}
          </div>
        </form>
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
      next: (response) => { 
        this.loading = false; 
        this.success = 'Verified! Redirecting...'; 
        // Store the token if provided in response
        if (response.access_token) {
          localStorage.setItem('access_token', response.access_token);
          localStorage.setItem('token_type', response.token_type || 'bearer');
          if (response.expires_at) {
            localStorage.setItem('expires_at', response.expires_at);
          }
        }
        // Redirect based on role or default dashboard
        setTimeout(() => {
          const token = localStorage.getItem('access_token');
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const userRole = payload.role?.toLowerCase();
              if (userRole === 'super_admin') {
                this.router.navigate(['/superadmin/dashboard']);
              } else if (userRole === 'team_leader' || userRole === 'teamleader' || userRole === 'team_leadr') {
                this.router.navigate(['/teamleader/demand-sheet']);
              } else {
                this.router.navigate(['/dashboard']);
              }
            } catch (error) {
              this.router.navigate(['/dashboard']);
            }
          } else {
            this.router.navigate(['/dashboard']);
          }
        }, 1000);
      },
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

