import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-recruiter-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  styles: [`
    .settings-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
      background: #f8fafc;
      min-height: 100vh;
    }

    .settings-header {
      margin-bottom: 32px;
    }

    .settings-title {
      font-size: 32px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 8px 0;
    }

    .settings-subtitle {
      font-size: 16px;
      color: #64748b;
      margin: 0;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
    }

    .settings-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .settings-card:hover {
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .card-header {
      padding: 24px;
      border-bottom: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .card-header.profile {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .card-header.security {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .card-header.preferences {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .card-header.notifications {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }

    .card-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .card-subtitle {
      font-size: 14px;
      opacity: 0.9;
      margin: 0;
    }

    .card-content {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }

    .form-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 14px;
      transition: all 0.3s ease;
      background: #f8fafc;
    }

    .form-input:focus {
      outline: none;
      border-color: #3b82f6;
      background: white;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
    }

    .form-help {
      font-size: 12px;
      color: #64748b;
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
      position: relative;
      overflow: hidden;
    }

    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .btn:hover::before {
      left: 100%;
    }

    .btn-primary {
      background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%);
      color: white;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(24, 45, 23, 0.2);
    }

    .btn-secondary {
      background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
      color: white;
    }

    .btn-secondary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(107, 114, 128, 0.4);
    }

    .btn-danger {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
    }

    .btn-danger:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }

    .btn-group {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    .profile-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding: 20px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 12px;
    }

    .profile-avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: 600;
    }

    .profile-info h3 {
      margin: 0 0 4px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .profile-info p {
      margin: 0;
      font-size: 14px;
      color: #64748b;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: 0.4s;
      border-radius: 24px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: 0.4s;
      border-radius: 50%;
    }

    .toggle-switch input:checked + .toggle-slider {
      background-color: #3b82f6;
    }

    .toggle-switch input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }

    .notification-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .notification-item:last-child {
      border-bottom: none;
    }

    .notification-info h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }

    .notification-info p {
      margin: 0;
      font-size: 12px;
      color: #64748b;
    }

    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .toast {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 320px;
      animation: slideIn 0.3s ease;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .toast-success {
      border-left: 4px solid #10b981;
    }

    .toast-error {
      border-left: 4px solid #ef4444;
    }

    .toast-warning {
      border-left: 4px solid #f59e0b;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .toast-close:hover {
      color: #374151;
      background: #f1f5f9;
    }

    .icon {
      width: 20px;
      height: 20px;
    }

    @media (max-width: 768px) {
      .settings-container {
        padding: 16px;
      }

      .settings-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .btn-group {
        flex-direction: column;
      }
    }
  `],
  template: `
    <div class="settings-container">
      <!-- Header -->
      <div class="settings-header">
        <h1 class="settings-title">⚙️ Settings</h1>
        <p class="settings-subtitle">Manage your account preferences and configuration</p>
      </div>

      <!-- Settings Grid -->
      <div class="settings-grid">
        <!-- Profile Settings -->
        <div class="settings-card">
          <div class="card-header profile">
            <h2 class="card-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile Settings
            </h2>
            <p class="card-subtitle">Manage your personal information</p>
          </div>
          <div class="card-content">
            <div class="profile-section">
              <div class="profile-avatar">
                {{ getInitials() }}
              </div>
              <div class="profile-info">
                <h3>{{ getFullName() }}</h3>
                <p>Recruiter • {{ getEmail() }}</p>
              </div>
            </div>
            <form [formGroup]="profileForm" (ngSubmit)="updateProfile()">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">First Name</label>
                  <input 
                    formControlName="first_name" 
                    placeholder="Enter first name" 
                    class="form-input"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">Last Name</label>
                  <input 
                    formControlName="last_name" 
                    placeholder="Enter last name" 
                    class="form-input"
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input 
                  type="email"
                  formControlName="email" 
                  placeholder="Enter email address" 
                  class="form-input"
                />
                <div class="form-help">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  This email will be used for notifications
                </div>
              </div>
              <div class="btn-group">
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ loading ? 'Updating...' : 'Update Profile' }}
                </button>
              </div>
            </form>
          </div>
        </div>
        
        <!-- CV Download Settings -->
        <div class="settings-card">
          <div class="card-header">
            <h2 class="card-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CV Download Settings
            </h2>
            <p class="card-subtitle">Configure where CVs are downloaded</p>
          </div>
          <div class="card-content">
            <form [formGroup]="cvForm" (ngSubmit)="saveCVSettings()">
          <div class="form-group">
            <label class="form-label">CV Download Folder</label>
            <input 
              formControlName="cv_folder_path" 
              placeholder="C:\\path\\to\\folder" 
                  class="form-input"
                />
                <div class="form-help">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Enter the full path where CVs should be downloaded
                </div>
          </div>
              <div class="btn-group">
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
              {{ loading ? 'Saving...' : 'Save Settings' }}
            </button>
          </div>
        </form>
      </div>
        </div>
        
        <!-- Security Settings -->
        <div class="settings-card">
          <div class="card-header security">
            <h2 class="card-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Security Settings
            </h2>
            <p class="card-subtitle">Manage your account security</p>
          </div>
          <div class="card-content">
            <form [formGroup]="passwordForm" (ngSubmit)="resetPassword()">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input 
                  type="password" 
                  formControlName="current_password" 
                  placeholder="Enter current password" 
                  class="form-input"
                />
              </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input 
              type="password" 
              formControlName="new_password" 
                  placeholder="Enter new password" 
                  class="form-input"
                />
                <div class="form-help">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Minimum 8 characters required
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input 
                  type="password" 
                  formControlName="confirm_password" 
                  placeholder="Confirm new password" 
                  class="form-input"
                />
              </div>
              <div class="btn-group">
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {{ loading ? 'Updating...' : 'Update Password' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Notification Settings -->
        <div class="settings-card">
          <div class="card-header notifications">
            <h2 class="card-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5zM4.828 7l2.586 2.586a2 2 0 002.828 0L15 7H4.828z" />
              </svg>
              Notification Settings
            </h2>
            <p class="card-subtitle">Configure your notification preferences</p>
          </div>
          <div class="card-content">
            <div class="notification-item">
              <div class="notification-info">
                <h4>Email Notifications</h4>
                <p>Receive updates about new demands and CV submissions</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="notifications.email" (change)="updateNotifications()">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="notification-item">
              <div class="notification-info">
                <h4>CV Status Updates</h4>
                <p>Get notified when CV status changes</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="notifications.cvStatus" (change)="updateNotifications()">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="notification-item">
              <div class="notification-info">
                <h4>Demand Assignments</h4>
                <p>Receive notifications for new demand assignments</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="notifications.demandAssignments" (change)="updateNotifications()">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="notification-item">
              <div class="notification-info">
                <h4>Weekly Reports</h4>
                <p>Get weekly performance summaries</p>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" [(ngModel)]="notifications.weeklyReports" (change)="updateNotifications()">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Preferences -->
        <div class="settings-card">
          <div class="card-header preferences">
            <h2 class="card-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Preferences
            </h2>
            <p class="card-subtitle">Customize your experience</p>
          </div>
          <div class="card-content">
            <form [formGroup]="preferencesForm" (ngSubmit)="savePreferences()">
              <div class="form-group">
                <label class="form-label">Dashboard Theme</label>
                <select formControlName="theme" class="form-input">
                  <option value="light">Light Theme</option>
                  <option value="dark">Dark Theme</option>
                  <option value="auto">Auto (System)</option>
                </select>
                <div class="form-help">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Choose your preferred color scheme
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Items Per Page</label>
                <select formControlName="itemsPerPage" class="form-input">
                  <option value="10">10 items</option>
                  <option value="25">25 items</option>
                  <option value="50">50 items</option>
                  <option value="100">100 items</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Default Date Range</label>
                <select formControlName="defaultDateRange" class="form-input">
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </select>
              </div>
              <div class="btn-group">
                <button type="submit" class="btn btn-primary" [disabled]="loading">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  {{ loading ? 'Saving...' : 'Save Preferences' }}
                </button>
              </div>
            </form>
          </div>
          </div>
          
        <!-- Danger Zone -->
        <div class="settings-card">
          <div class="card-header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
            <h2 class="card-title">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Danger Zone
            </h2>
            <p class="card-subtitle">Irreversible actions</p>
          </div>
          <div class="card-content">
            <div class="form-group">
              <h4 style="color: #ef4444; margin-bottom: 8px;">Delete Account</h4>
              <p style="color: #64748b; margin-bottom: 16px; font-size: 14px;">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <button type="button" class="btn btn-danger" (click)="confirmDeleteAccount()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Account
            </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast Notifications -->
      <div class="toast-container" *ngIf="toasts.length > 0">
        <div *ngFor="let toast of toasts" class="toast" [ngClass]="'toast-' + toast.type">
          {{ toast.text }}
          <button class="toast-close" (click)="removeToast(toast.id)">×</button>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  api = environment.apiBase;
  
  cvForm: FormGroup;
  passwordForm: FormGroup;
  profileForm: FormGroup;
  preferencesForm: FormGroup;
  loading = false;
  toasts: { id: number; text: string; type: string }[] = [];
  
  notifications = {
    email: true,
    cvStatus: true,
    demandAssignments: true,
    weeklyReports: false
  };

  constructor() {
    this.cvForm = this.fb.group({ 
      cv_folder_path: ['', [Validators.required]] 
    });
    this.passwordForm = this.fb.group({ 
      current_password: ['', [Validators.required]],
      new_password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', [Validators.required]]
    });
    this.profileForm = this.fb.group({
      first_name: ['', [Validators.required]],
      last_name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]]
    });
    this.preferencesForm = this.fb.group({
      theme: ['light'],
      itemsPerPage: ['25'],
      defaultDateRange: ['30']
    });
  }

  ngOnInit(): void {
    this.loadCurrentSettings();
  }

  loadCurrentSettings(): void {
    const id = this.auth.getCurrentUserId();
    if (!id) return;

    // Load current CV folder path (new endpoint)
    this.http.get<any>(`${this.api}/recruiter/settings`, { params: { recruiter_id: id } as any }).subscribe({
      next: (response) => {
        if (response.cv_download_path) {
          this.cvForm.patchValue({ cv_folder_path: response.cv_download_path });
        }
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      }
    });
  }

  saveCVSettings(): void {
    if (this.cvForm.invalid) {
      this.showToast('Please enter a valid CV folder path', 'warning');
      return;
    }

    const id = this.auth.getCurrentUserId();
    if (!id) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    this.loading = true;
    this.http.post(`${this.api}/recruiter/settings`, { recruiter_id: id, cv_download_path: this.cvForm.value.cv_folder_path }).subscribe({
      next: (response) => {
        this.showToast('CV folder path saved successfully', 'success');
        this.loading = false;
      },
      error: (error) => {
        console.error('Error saving settings:', error);
        this.showToast('Failed to save settings. Please try again.', 'error');
        this.loading = false;
      }
    });
  }
  
  resetPassword(): void {
    if (this.passwordForm.invalid) {
      this.showToast('Password must be at least 8 characters long', 'warning');
      return;
    }

    const id = this.auth.getCurrentUserId();
    if (!id) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    this.loading = true;
    this.http.post(`${this.api}/user/${id}/reset-password`, this.passwordForm.value).subscribe({
      next: (response) => {
        this.showToast('Password reset successfully', 'success');
        this.passwordForm.reset();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error resetting password:', error);
        this.showToast('Failed to reset password. Please try again.', 'error');
        this.loading = false;
      }
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' = 'success'): void {
    const toast = {
      id: Date.now(),
      text: message,
      type: type
    };
    this.toasts.push(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      this.removeToast(toast.id);
    }, 5000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  // Profile methods
  getInitials(): string {
    const firstName = this.profileForm.get('first_name')?.value || 'R';
    const lastName = this.profileForm.get('last_name')?.value || 'U';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
  }

  getFullName(): string {
    const firstName = this.profileForm.get('first_name')?.value || 'Recruiter';
    const lastName = this.profileForm.get('last_name')?.value || 'User';
    return `${firstName} ${lastName}`;
  }

  getEmail(): string {
    return this.profileForm.get('email')?.value || 'recruiter@example.com';
  }

  updateProfile(): void {
    if (this.profileForm.invalid) {
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    const id = this.auth.getCurrentUserId();
    if (!id) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    this.loading = true;
    this.http.put(`${this.api}/user/${id}/profile`, this.profileForm.value).subscribe({
      next: (response) => {
        this.showToast('Profile updated successfully', 'success');
        this.loading = false;
      },
      error: (error) => {
        console.error('Error updating profile:', error);
        this.showToast('Failed to update profile. Please try again.', 'error');
        this.loading = false;
      }
    });
  }

  // Notification methods
  updateNotifications(): void {
    const id = this.auth.getCurrentUserId();
    if (!id) return;

    this.http.put(`${this.api}/user/${id}/notifications`, this.notifications).subscribe({
      next: (response) => {
        this.showToast('Notification preferences updated', 'success');
      },
      error: (error) => {
        console.error('Error updating notifications:', error);
        this.showToast('Failed to update notifications', 'error');
      }
    });
  }

  // Preferences methods
  savePreferences(): void {
    if (this.preferencesForm.invalid) {
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    const id = this.auth.getCurrentUserId();
    if (!id) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    this.loading = true;
    this.http.put(`${this.api}/user/${id}/preferences`, this.preferencesForm.value).subscribe({
      next: (response) => {
        this.showToast('Preferences saved successfully', 'success');
        this.loading = false;
      },
      error: (error) => {
        console.error('Error saving preferences:', error);
        this.showToast('Failed to save preferences. Please try again.', 'error');
        this.loading = false;
      }
    });
  }

  // Danger zone methods
  confirmDeleteAccount(): void {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      this.deleteAccount();
    }
  }

  deleteAccount(): void {
    const id = this.auth.getCurrentUserId();
    if (!id) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    this.loading = true;
    this.http.delete(`${this.api}/user/${id}`).subscribe({
      next: (response) => {
        this.showToast('Account deleted successfully', 'success');
        this.auth.logout();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error deleting account:', error);
        this.showToast('Failed to delete account. Please try again.', 'error');
        this.loading = false;
      }
    });
  }
}


