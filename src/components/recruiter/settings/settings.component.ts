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
    .recruiter-settings-wrapper {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
      padding: 32px;
    }

    .space-y-6 > * + * { margin-top: 1.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }

    .card { 
      background: rgba(255, 255, 255, 0.8); 
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1); 
      border-radius: 12px; 
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1); 
      margin-bottom: 24px; 
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(24, 45, 23, 0.15);
    }

    .card-header { 
      padding: 24px; 
      border-bottom: 1px solid rgba(24, 45, 23, 0.1); 
      background: rgba(24, 45, 23, 0.02);
    }

    .card-title { 
      font-size: 20px; 
      font-weight: 700; 
      color: var(--kudzu-primary); 
      margin: 0 0 8px 0; 
      letter-spacing: -0.025em;
    }

    .card-subtitle { 
      font-size: 14px; 
      color: #6b7280; 
      margin: 0; 
      font-weight: 500;
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
      letter-spacing: 0.025em;
    }

    .form-help { 
      font-size: 12px; 
      color: #6b7280; 
      margin-top: 6px; 
      font-weight: 500;
    }

    .input { 
      width: 100%; 
      padding: 12px 16px; 
      border: 2px solid rgba(24, 45, 23, 0.1); 
      border-radius: 8px; 
      font-size: 14px; 
      font-weight: 500;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(5px);
      transition: all 0.3s ease;
      color: #374151;
    }

    .input:focus { 
      outline: none; 
      border-color: var(--kudzu-primary); 
      box-shadow: 0 0 0 3px rgba(24, 45, 23, 0.1); 
      background: rgba(255, 255, 255, 0.95);
      transform: translateY(-1px);
    }

    .input::placeholder {
      color: #9ca3af;
      font-weight: 400;
    }

    .btn { 
      display: inline-flex; 
      align-items: center; 
      gap: 8px; 
      padding: 12px 24px; 
      border-radius: 8px; 
      font-weight: 600; 
      text-decoration: none; 
      border: none; 
      cursor: pointer; 
      transition: all 0.3s ease; 
      font-size: 14px;
      letter-spacing: 0.025em;
      position: relative;
      overflow: hidden;
    }

    .btn-primary { 
      background: linear-gradient(135deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%); 
      color: white; 
      box-shadow: 0 4px 15px rgba(24, 45, 23, 0.3);
    }

    .btn-primary:hover:not(:disabled) { 
      background: linear-gradient(135deg, var(--kudzu-primary-dark) 0%, rgb(12, 25, 12) 100%); 
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(24, 45, 23, 0.4);
    }

    .btn-secondary { 
      background: linear-gradient(135deg, var(--kudzu-primary-light) 0%, var(--kudzu-primary) 100%); 
      color: var(--kudzu-primary); 
      box-shadow: 0 4px 15px rgba(24, 45, 23, 0.2);
    }

    .btn-secondary:hover:not(:disabled) { 
      background: linear-gradient(135deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%); 
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(24, 45, 23, 0.3);
    }

    .btn:disabled { 
      opacity: 0.6; 
      cursor: not-allowed; 
      transform: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .flex { display: flex; }
    .justify-end { justify-content: flex-end; }

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
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 8px;
      padding: 16px 20px;
      box-shadow: 0 8px 25px rgba(24, 45, 23, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-width: 320px;
      transition: all 0.3s ease;
    }

    .toast:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(24, 45, 23, 0.2);
    }

    .toast-success {
      border-left: 4px solid #10b981;
      background: rgba(16, 185, 129, 0.05);
    }

    .toast-error {
      border-left: 4px solid #ef4444;
      background: rgba(239, 68, 68, 0.05);
    }

    .toast-warning {
      border-left: 4px solid #f59e0b;
      background: rgba(245, 158, 11, 0.05);
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      margin-left: 12px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .toast-close:hover {
      color: #374151;
      background: rgba(0, 0, 0, 0.05);
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .recruiter-settings-wrapper {
        padding: 16px;
      }
      
      .card-header {
        padding: 20px;
      }
      
      .toast {
        min-width: 280px;
        margin: 0 16px;
      }
      
      .toast-container {
        right: 16px;
        left: 16px;
      }
    }
  `],
  template: `
    <div class="recruiter-settings-wrapper">
      <div class="space-y-6">
        <!-- CV Settings -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">CV Download Settings</h2>
            <p class="card-subtitle">Configure where CVs are downloaded</p>
          </div>
          
          <form [formGroup]="cvForm" (ngSubmit)="saveCVSettings()" class="space-y-4" style="padding: 24px;">
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
              <button type="submit" class="btn btn-primary" [disabled]="loading">
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
          
          <form [formGroup]="passwordForm" (ngSubmit)="resetPassword()" class="space-y-4" style="padding: 24px;">
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


