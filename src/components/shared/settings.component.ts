import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2 class="superadmin-section-title">Settings</h2>
    <div class="superadmin-card superadmin-card-elevated">
      <!-- Tabs -->
      <div class="superadmin-tabs">
        <button 
          class="superadmin-tab"
          [class.active]="activeTab() === 'profile'"
          (click)="setActiveTab('profile')">
          Profile
        </button>
        <button 
          class="superadmin-tab"
          [class.active]="activeTab() === 'password'"
          (click)="setActiveTab('password')">
          Change Password
        </button>
      </div>

      <!-- Profile Tab -->
      <div *ngIf="activeTab() === 'profile'" class="settings-content">
        <form [formGroup]="profileForm" (ngSubmit)="onProfileSubmit()" class="settings-form">
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">First Name</label>
            <input 
              type="text" 
              class="superadmin-form-input"
              formControlName="first_name"
              placeholder="Enter your first name"
              [class.error]="isFieldInvalid('first_name')">
            <div *ngIf="isFieldInvalid('first_name')" class="form-error-message">
              <span *ngIf="profileForm.get('first_name')?.errors?.['required']">
                First name is required
              </span>
            </div>
          </div>

          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Last Name</label>
            <input 
              type="text" 
              class="superadmin-form-input"
              formControlName="last_name"
              placeholder="Enter your last name"
              [class.error]="isFieldInvalid('last_name')">
            <div *ngIf="isFieldInvalid('last_name')" class="form-error-message">
              <span *ngIf="profileForm.get('last_name')?.errors?.['required']">
                Last name is required
              </span>
            </div>
          </div>

          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Email</label>
            <input 
              type="email" 
              class="superadmin-form-input"
              formControlName="email"
              placeholder="Enter your email"
              [class.error]="isFieldInvalid('email')">
            <div *ngIf="isFieldInvalid('email')" class="form-error-message">
              <span *ngIf="profileForm.get('email')?.errors?.['required']">
                Email is required
              </span>
              <span *ngIf="profileForm.get('email')?.errors?.['email']">
                Please enter a valid email address
              </span>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="superadmin-btn superadmin-btn-approve"
              [disabled]="profileForm.invalid || profileLoading()">
              <span *ngIf="!profileLoading()">Save Changes</span>
              <span *ngIf="profileLoading()">Saving...</span>
            </button>
          </div>
        </form>
      </div>

      <!-- Change Password Tab -->
      <div *ngIf="activeTab() === 'password'" class="settings-content">
        <form [formGroup]="passwordForm" (ngSubmit)="onPasswordSubmit()" class="settings-form">
          <div class="superadmin-form-group">
            <label class="superadmin-form-label" for="current_password">Current Password</label>
            <div class="password-input-wrapper">
              <input
                [type]="showCurrentPassword() ? 'text' : 'password'"
                id="current_password"
                formControlName="current_password"
                placeholder="Enter your current password"
                class="superadmin-form-input"
                [class.error]="isPasswordFieldInvalid('current_password')">
              <button
                type="button"
                class="password-toggle"
                (click)="toggleCurrentPassword()"
                tabindex="-1">
                <svg *ngIf="!showCurrentPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg *ngIf="showCurrentPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <div *ngIf="isPasswordFieldInvalid('current_password')" class="form-error-message">
              <span *ngIf="passwordForm.get('current_password')?.errors?.['required']">
                Current password is required
              </span>
            </div>
          </div>

          <div class="superadmin-form-group">
            <label class="superadmin-form-label" for="new_password">New Password</label>
            <div class="password-input-wrapper">
              <input
                [type]="showNewPassword() ? 'text' : 'password'"
                id="new_password"
                formControlName="new_password"
                placeholder="Enter your new password"
                class="superadmin-form-input"
                [class.error]="isPasswordFieldInvalid('new_password')">
              <button
                type="button"
                class="password-toggle"
                (click)="toggleNewPassword()"
                tabindex="-1">
                <svg *ngIf="!showNewPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg *ngIf="showNewPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <div *ngIf="isPasswordFieldInvalid('new_password')" class="form-error-message">
              <span *ngIf="passwordForm.get('new_password')?.errors?.['required']">
                New password is required
              </span>
              <span *ngIf="passwordForm.get('new_password')?.errors?.['minlength']">
                Password must be at least 6 characters long
              </span>
            </div>
          </div>

          <div class="superadmin-form-group">
            <label class="superadmin-form-label" for="confirm_password">Confirm New Password</label>
            <div class="password-input-wrapper">
              <input
                [type]="showConfirmPassword() ? 'text' : 'password'"
                id="confirm_password"
                formControlName="confirm_password"
                placeholder="Confirm your new password"
                class="superadmin-form-input"
                [class.error]="isPasswordFieldInvalid('confirm_password')">
              <button
                type="button"
                class="password-toggle"
                (click)="toggleConfirmPassword()"
                tabindex="-1">
                <svg *ngIf="!showConfirmPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg *ngIf="showConfirmPassword()" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
            <div *ngIf="isPasswordFieldInvalid('confirm_password')" class="form-error-message">
              <span *ngIf="passwordForm.get('confirm_password')?.errors?.['required']">
                Please confirm your new password
              </span>
              <span *ngIf="passwordForm.get('confirm_password')?.errors?.['passwordMismatch']">
                Passwords do not match
              </span>
            </div>
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="superadmin-btn superadmin-btn-approve"
              [disabled]="passwordForm.invalid || passwordLoading()">
              <span *ngIf="!passwordLoading()">Change Password</span>
              <span *ngIf="passwordLoading()">Updating...</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .superadmin-section-title {
      font-size: 20px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 24px;
    }

    .superadmin-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      border: 1px solid rgba(24, 45, 23, 0.1);
      overflow: visible;
      min-height: 400px;
    }

    .superadmin-card-elevated { 
      box-shadow: 0 10px 18px rgba(24, 45, 23, 0.15); 
      border-color: rgba(24, 45, 23, 0.2); 
    }

    /* Tabs */
    .superadmin-tabs {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .superadmin-tab {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: #4a5568;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }

    .superadmin-tab:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .superadmin-tab.active {
      color: var(--kudzu-primary);
      border-bottom-color: var(--kudzu-primary);
      background: rgba(102, 126, 234, 0.05);
    }

    .settings-content {
      padding: 24px;
    }

    .settings-form {
      max-width: 600px;
    }

    .superadmin-form-group {
      margin-bottom: 24px;
    }

    .superadmin-form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 8px;
    }

    .superadmin-form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      color: #2d3748;
      background: white;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .superadmin-form-input:focus {
      outline: none;
      border-color: var(--kudzu-primary);
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .superadmin-form-input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .superadmin-form-input::placeholder {
      color: #a0aec0;
    }

    .password-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .password-input-wrapper .superadmin-form-input {
      padding-right: 48px;
    }

    .password-toggle {
      position: absolute;
      right: 12px;
      background: none;
      border: none;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s ease;
    }

    .password-toggle:hover {
      color: var(--kudzu-primary);
    }

    .form-error-message {
      margin-top: 6px;
      font-size: 12px;
      color: #ef4444;
      font-weight: 500;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e2e8f0;
    }

    .superadmin-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .superadmin-btn-approve {
      background: var(--kudzu-primary);
      color: white;
    }

    .superadmin-btn-approve:hover:not(:disabled) {
      background: var(--kudzu-primary-dark);
    }

    .superadmin-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .settings-content {
        padding: 20px;
      }

      .superadmin-tabs {
        padding: 12px 16px;
      }
    }
  `]
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);
  private api = environment.apiBase;

  activeTab = signal<'profile' | 'password'>('profile');
  profileForm: FormGroup;
  passwordForm: FormGroup;
  profileLoading = signal(false);
  passwordLoading = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  constructor() {
    this.profileForm = this.fb.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  setActiveTab(tab: 'profile' | 'password'): void {
    this.activeTab.set(tab);
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('new_password');
    const confirmPassword = control.get('confirm_password');
    
    if (!newPassword || !confirmPassword) {
      return null;
    }
    
    if (newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      if (confirmPassword.hasError('passwordMismatch')) {
        confirmPassword.setErrors(null);
      }
      return null;
    }
  }

  toggleCurrentPassword(): void {
    this.showCurrentPassword.set(!this.showCurrentPassword());
  }

  toggleNewPassword(): void {
    this.showNewPassword.set(!this.showNewPassword());
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.profileForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  isPasswordFieldInvalid(fieldName: string): boolean {
    const field = this.passwordForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  loadUserProfile(): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    });

    this.http.get<any>(`${this.api}/users/me`, { headers }).subscribe({
      next: (response) => {
        this.profileForm.patchValue({
          first_name: response.first_name || '',
          last_name: response.last_name || '',
          email: response.email || ''
        });
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
        this.toastService.error('Failed to load profile. Please try again.');
      }
    });
  }

  onProfileSubmit(): void {
    if (this.profileForm.invalid) {
      Object.keys(this.profileForm.controls).forEach(key => {
        this.profileForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.profileLoading.set(true);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    });

    this.http.put(
      `${this.api}/users/update-profile`,
      this.profileForm.value,
      { headers }
    ).subscribe({
      next: (response: any) => {
        this.profileLoading.set(false);
        this.toastService.success('Profile updated successfully.');
      },
      error: (error: any) => {
        this.profileLoading.set(false);
        console.error('Error updating profile:', error);
        const errorMessage = error.error?.detail || error.error?.message || 'Failed to update profile. Please try again.';
        this.toastService.error(errorMessage);
      }
    });
  }

  onPasswordSubmit(): void {
    if (this.passwordForm.invalid) {
      Object.keys(this.passwordForm.controls).forEach(key => {
        this.passwordForm.get(key)?.markAsTouched();
      });
      return;
    }

    const userId = this.auth.getCurrentUserId();
    if (!userId) {
      this.toastService.error('Authentication error. Please login again.');
      return;
    }

    const formValue = this.passwordForm.value;

    if (formValue.new_password !== formValue.confirm_password) {
      this.toastService.error('New passwords do not match.');
      return;
    }

    this.passwordLoading.set(true);

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`
    });

    this.http.put(
      `${this.api}/users/change-password/${userId}`,
      {
        current_password: formValue.current_password,
        new_password: formValue.new_password
      },
      { headers }
    ).subscribe({
      next: (response: any) => {
        this.passwordLoading.set(false);
        this.toastService.success('Password updated successfully.');
        
        this.passwordForm.reset();
        
        setTimeout(() => {
          this.auth.logout();
          this.router.navigate(['/signin']).catch(() => {});
        }, 1500);
      },
      error: (error: any) => {
        this.passwordLoading.set(false);
        console.error('Error changing password:', error);
        
        if (error.status === 401 || error.status === 400) {
          const errorMessage = error.error?.detail || error.error?.message || 'Current password is incorrect.';
          this.toastService.error(errorMessage);
        } else {
          this.toastService.error('Failed to update password. Please try again.');
        }
      }
    });
  }
}
