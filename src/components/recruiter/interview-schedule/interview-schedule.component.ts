import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../environments/environment';

interface Interview {
  id: number;
  candidate_name: string;
  candidate_email: string;
  demand_id: number;
  job_title: string;
  client_name: string;
  interview_date: string;
  mode: 'online' | 'offline';
  status: 'scheduled' | 'completed' | 'cancelled';
  recruiter_id: number;
  created_at: string;
}

@Component({
  selector: 'app-interview-schedule',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="interview-schedule-container recruiter-theme">
      <!-- Header -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Interview Schedule</h2>
          <p class="card-subtitle">Manage scheduled interviews for your candidates</p>
        </div>
      </div>

      <!-- Interviews Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Scheduled Interviews</h3>
          <div class="card-actions">
            <button class="btn btn-primary" (click)="loadInterviews()">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading interviews...</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error && !loading" class="error-state">
          <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="error-title">Error Loading Interviews</h3>
          <p class="error-message">{{ error }}</p>
          <button class="btn btn-primary" (click)="loadInterviews()">Retry</button>
        </div>

        <!-- Interviews Table -->
        <div *ngIf="!loading && !error && interviews.length > 0" class="table-container">
          <div class="table-wrapper">
            <table class="interviews-table">
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Email</th>
                  <th>Demand ID</th>
                  <th>Job Title</th>
                  <th>Client</th>
                  <th>Interview Date</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let interview of interviews" class="interview-row">
                  <td class="candidate-name">{{ interview.candidate_name }}</td>
                  <td class="candidate-email">{{ interview.candidate_email }}</td>
                  <td class="demand-id">#{{ interview.demand_id }}</td>
                  <td class="job-title">{{ interview.job_title }}</td>
                  <td class="client-name">{{ interview.client_name }}</td>
                  <td class="interview-date">{{ interview.interview_date | date:'short' }}</td>
                  <td class="mode">
                    <span class="mode-badge" [ngClass]="'mode-' + interview.mode">
                      {{ interview.mode | titlecase }}
                    </span>
                  </td>
                  <td class="status">
                    <span class="status-badge" [ngClass]="'status-' + interview.status">
                      {{ interview.status | titlecase }}
                    </span>
                  </td>
                  <td class="actions">
                    <button 
                      class="btn btn-sm btn-success" 
                      (click)="updateInterviewStatus(interview, 'completed')"
                      [disabled]="isCompleted(interview)"
                      title="Mark as Completed"
                      *ngIf="isScheduled(interview)"
                    >
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button 
                      class="btn btn-sm btn-warning" 
                      (click)="updateInterviewStatus(interview, 'cancelled')"
                      [disabled]="isCancelled(interview)"
                      title="Cancel Interview"
                      *ngIf="isScheduled(interview)"
                    >
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <span *ngIf="isCompleted(interview)" class="completed-text">Completed</span>
                    <span *ngIf="isCancelled(interview)" class="cancelled-text">Cancelled</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button class="btn btn-secondary sm" (click)="prevPage()" [disabled]="page <= 1">Prev</button>
            <span class="page-info">Page {{ page }} / {{ totalPages }}</span>
            <button class="btn btn-secondary sm" (click)="nextPage()" [disabled]="page >= totalPages">Next</button>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && !error && interviews.length === 0" class="empty-state">
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 class="empty-title">No interviews scheduled</h3>
          <p class="empty-description">No interviews have been scheduled for your candidates yet.</p>
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
  `,
  styles: [`
    .interview-schedule-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .card-subtitle {
      font-size: 14px;
      color: #6b7280;
      margin: 4px 0 0 0;
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--kudzu-primary-dark);
    }

    .btn-success {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-success:hover {
      background: var(--kudzu-primary-dark);
    }

    .btn-warning {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-warning:hover {
      background: var(--kudzu-primary-dark);
    }

    .btn-secondary {
      background: var(--kudzu-primary-light);
      color: var(--kudzu-primary);
    }

    .btn-secondary:hover {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 12px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .icon {
      width: 16px;
      height: 16px;
    }

    .table-container {
      overflow-x: auto;
    }

    .table-wrapper {
      min-width: 100%;
    }

    .interviews-table {
      width: 100%;
      border-collapse: collapse;
    }

    .interviews-table th,
    .interviews-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .interviews-table th {
      background: #f8fafc;
      font-weight: 600;
      color: #374151;
      font-size: 14px;
    }

    .interview-row:hover {
      background: #f8fafc;
    }

    .mode-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .mode-online {
      background: #dbeafe;
      color: #1e40af;
    }

    .mode-offline {
      background: #fef3c7;
      color: #92400e;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-scheduled {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-completed {
      background: #d1fae5;
      color: #065f46;
    }

    .status-cancelled {
      background: #fecaca;
      color: #dc2626;
    }

    .completed-text {
      color: #065f46;
      font-weight: 500;
      font-size: 12px;
    }

    .cancelled-text {
      color: #dc2626;
      font-weight: 500;
      font-size: 12px;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      padding: 20px;
    }

    .page-info {
      font-size: 14px;
      color: #6b7280;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .error-icon {
      width: 48px;
      height: 48px;
      color: #ef4444;
      margin-bottom: 16px;
    }

    .error-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 8px 0;
    }

    .error-message {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 20px 0;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      color: #9ca3af;
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 8px 0;
    }

    .empty-description {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }

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

    .toast-success { border-left: 4px solid #10b981; }
    .toast-error { border-left: 4px solid #ef4444; }
    .toast-warning { border-left: 4px solid #f59e0b; }
    .toast-info { border-left: 4px solid #3b82f6; }

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
  `]
})
export class InterviewScheduleComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  api = environment.apiBase;

  interviews: Interview[] = [];
  loading = false;
  error: string | null = null;
  page = 1;
  size = 10;
  total = 0;
  toasts: { id: number; text: string; type: string }[] = [];

  get totalPages() { return Math.max(1, Math.ceil(this.total / this.size)); }

  ngOnInit(): void {
    this.loadInterviews();
  }

  loadInterviews(): void {
    const recruiterId = this.authService.getCurrentUserId();
    if (!recruiterId) {
      this.error = 'Unable to identify recruiter ID';
      return;
    }

    this.loading = true;
    this.error = null;

    this.http.get<any>(`${this.api}/interviews/recruiter/${recruiterId}`, {
      params: { page: this.page, size: this.size }
    }).subscribe({
      next: (res) => {
        this.interviews = res?.items || [];
        this.total = res?.total || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading interviews:', error);
        this.interviews = [];
        this.total = 0;
        this.loading = false;
        this.error = 'Failed to load interviews';
        this.showToast('Failed to load interviews', 'error');
      }
    });
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadInterviews();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadInterviews();
    }
  }

  updateInterviewStatus(interview: Interview, status: 'completed' | 'cancelled'): void {
    this.http.patch<any>(`${this.api}/interviews/${interview.id}/status`, {
      status: status
    }).subscribe({
      next: (response) => {
        interview.status = status;
        this.showToast(`Interview ${status} successfully`, 'success');
      },
      error: (error) => {
        console.error('Error updating interview status:', error);
        this.showToast('Failed to update interview status', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success'): void {
    const toast = {
      id: Date.now(),
      text: message,
      type: type
    };
    this.toasts.push(toast);
    
    setTimeout(() => {
      this.removeToast(toast.id);
    }, 5000);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  // Helper methods for status checking
  isScheduled(interview: any): boolean {
    return interview.status === 'scheduled';
  }

  isCompleted(interview: any): boolean {
    return interview.status === 'completed';
  }

  isCancelled(interview: any): boolean {
    return interview.status === 'cancelled';
  }
}
