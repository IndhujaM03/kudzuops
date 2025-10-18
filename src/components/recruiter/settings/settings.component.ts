import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-recruiter-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  styles: [`
    .space-y-6 > * + * { margin-top: 1.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); margin-bottom: 20px; overflow: hidden; }
    .card-header { padding: 20px; border-bottom: 1px solid #e5e7eb; }
    .card-title { font-size: 18px; font-weight: 600; color: #1e293b; margin: 0 0 4px 0; }
    .card-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px; }
    .form-help { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
    .input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-weight: 500; text-decoration: none; border: none; cursor: pointer; transition: all 0.2s; font-size: 14px; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover:not(:disabled) { background: #2563eb; }
    .btn-secondary { background: #6b7280; color: white; }
    .btn-secondary:hover:not(:disabled) { background: #4b5563; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .flex { display: flex; }
    .justify-end { justify-content: flex-end; }
    .green { background: #10b981 !important; }
    .green:hover:not(:disabled) { background: #059669 !important; }

    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .toast {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px 16px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 300px;
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
      font-size: 18px;
      cursor: pointer;
      color: #6b7280;
      padding: 0;
      margin-left: 12px;
    }

    .toast-close:hover {
      color: #374151;
    }
  `],
  template: `
    <div class="space-y-6 recruiter-theme">
      <!-- CV Settings -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">CV Download Settings</h2>
          <p class="card-subtitle">Configure where CVs are downloaded</p>
        </div>
        
        <form [formGroup]="cvForm" (ngSubmit)="saveCVSettings()" class="space-y-4">
          <div class="form-group">
            <label class="form-label">CV Download Folder</label>
            <input 
              formControlName="cv_folder_path" 
              placeholder="C:\\path\\to\\folder" 
              class="input"
            />
            <div class="form-help">Enter the full path where CVs should be downloaded</div>
          </div>
          
          <div class="flex justify-end">
            <button type="submit" class="btn btn-primary green" [disabled]="loading">
              {{ loading ? 'Saving...' : 'Save Settings' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Password Settings -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Password Settings</h2>
          <p class="card-subtitle">Change your account password</p>
        </div>
        
        <form [formGroup]="passwordForm" (ngSubmit)="resetPassword()" class="space-y-4">
          <div class="form-group">
            <label class="form-label">New Password</label>
            <input 
              type="password" 
              formControlName="new_password" 
              placeholder="••••••••" 
              class="input"
            />
            <div class="form-help">Minimum 8 characters required</div>
          </div>
          
          <div class="flex justify-end">
            <button type="submit" class="btn btn-secondary" [disabled]="loading">
              {{ loading ? 'Resetting...' : 'Reset Password' }}
            </button>
          </div>
        </form>
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
  loading = false;
  toasts: { id: number; text: string; type: string }[] = [];

  constructor() {
    this.cvForm = this.fb.group({ 
      cv_folder_path: ['', [Validators.required]] 
    });
    this.passwordForm = this.fb.group({ 
      new_password: ['', [Validators.required, Validators.minLength(8)]] 
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
}


