import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { environment } from '../../../environments/environment';

interface Demand {
  id: number;
  client_name: string;
  job_title: string;
  skill: string;
  no_of_positions: number;
  priority: string;
  status: string;
  assigned_date: string;
  created_at: string;
}

interface ProcessCount {
  total_assigned: number;
  current_processes: number;
  completed_processes: number;
}

interface SubmissionStats {
  today: number;
  this_week: number;
  total: number;
}

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <!-- Process Overview Card -->
      <div class="card">
        <div class="card-header">
          <p class="card-subtitle">Manage your assigned demands and track your progress</p>
        </div>
        
        <div class="overview-grid">
          <div class="overview-card">
            <div class="overview-icon total">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="overview-content">
              <h3 class="overview-number">{{ processCount.total_assigned }}</h3>
              <p class="overview-label">Total Assigned</p>
            </div>
          </div>

          <div class="overview-card current">
            <div class="overview-icon current">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="overview-content">
              <h3 class="overview-number">{{ processCount.current_processes }}</h3>
              <p class="overview-label">🟢 Current Processes</p>
            </div>
          </div>

          <div class="overview-card">
            <div class="overview-icon completed">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="overview-content">
              <h3 class="overview-number">{{ processCount.completed_processes }}</h3>
              <p class="overview-label">Completed</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Submission Stats -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Submission Stats</h2>
          <p class="card-subtitle">Your submission performance</p>
        </div>

        <div class="overview-grid">
          <div class="overview-card">
            <div class="overview-icon total">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h18M9 7h6m-9 4h9m-6 4h6m-9 4h9" />
              </svg>
            </div>
            <div class="overview-content">
              <h3 class="overview-number">{{ submissionStats.total }}</h3>
              <p class="overview-label">Total Submissions</p>
            </div>
          </div>

          <div class="overview-card current">
            <div class="overview-icon current">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M4 6h16" />
              </svg>
            </div>
            <div class="overview-content">
              <h3 class="overview-number">{{ submissionStats.this_week }}</h3>
              <p class="overview-label">This Week</p>
            </div>
          </div>

          <div class="overview-card">
            <div class="overview-icon completed">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M4 6h16" />
              </svg>
            </div>
            <div class="overview-content">
              <h3 class="overview-number">{{ submissionStats.today }}</h3>
              <p class="overview-label">Today</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Submissions Table -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">My Submissions</h2>
          <p class="card-subtitle">View your submitted candidate profiles</p>
        </div>
        <div class="card-body">
          <!-- Loading State -->
          <div *ngIf="submissionsLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading submissions...</p>
          </div>

          <!-- Submissions Table -->
          <div *ngIf="!submissionsLoading && submissions.length > 0" class="table-container">
            <div class="table-wrapper">
              <table class="submissions-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Candidate Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Demand ID</th>
                    <th>Job Title</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Submitted At</th>
                    <th>Resume</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let submission of submissions" class="submission-row">
                    <td class="submission-id">{{ submission.id }}</td>
                    <td class="candidate-name">{{ submission.candidate_name }}</td>
                    <td class="candidate-email">{{ submission.candidate_email }}</td>
                    <td class="candidate-phone">{{ submission.candidate_phone }}</td>
                    <td class="demand-id">#{{ submission.demand_id }}</td>
                    <td class="job-title">{{ submission.job_title }}</td>
                    <td class="client-name">{{ submission.client_name }}</td>
                    <td class="status">
                      <span class="status-badge" [ngClass]="'status-' + (submission.status || 'pending')">
                        {{ submission.status || 'Pending' }}
                      </span>
                    </td>
                    <td class="submitted-date">{{ submission.submitted_at | date:'short' }}</td>
                    <td class="resume-link">
                      <a *ngIf="submission.resume_url" [href]="submission.resume_url" target="_blank" class="resume-btn">
                        <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View
                      </a>
                      <span *ngIf="!submission.resume_url" class="muted">N/A</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="pagination">
              <button class="btn btn-secondary sm" (click)="prevSubmissionsPage()" [disabled]="submissionsPage <= 1">Prev</button>
              <span class="page-info">Page {{ submissionsPage }} / {{ submissionsTotalPages }}</span>
              <button class="btn btn-secondary sm" (click)="nextSubmissionsPage()" [disabled]="submissionsPage >= submissionsTotalPages">Next</button>
            </div>
          </div>

          <!-- Empty State -->
          <div *ngIf="!submissionsLoading && submissions.length === 0" class="empty-state">
            <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="empty-title">No submissions yet</h3>
            <p class="empty-description">You haven't submitted any candidate profiles yet.</p>
          </div>
        </div>
      </div>

      <!-- Quick Links to Assigned Demands -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Actions</h2>
          <p class="card-subtitle">Jump to your assigned demands to take action</p>
        </div>
        <div class="card-body" style="padding: 16px 20px;">
          <button class="btn btn-primary" (click)="goToAssignedDemands()">Go to Assigned Demands</button>
        </div>
      </div>

      <!-- Move to Process Modal -->
      <div class="modal-overlay" *ngIf="showMoveModal" (click)="closeMoveModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">Move to Process</h3>
            <button class="modal-close" (click)="closeMoveModal()">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p class="modal-text">Select a demand to move your current process to:</p>
            <div class="demand-list">
              <div 
                *ngFor="let demand of availableDemands" 
                class="demand-option"
                (click)="selectDemandForMove(demand)"
              >
                <div class="demand-info">
                  <h4 class="demand-title">#{{ demand.id }} - {{ demand.job_title || demand.skill }}</h4>
                  <p class="demand-client">{{ demand.client_name || 'N/A' }}</p>
                </div>
                <div class="demand-status">
                  <span class="status-badge" [ngClass]="'status-' + (demand.status || 'assigned')">
                    {{ getStatusDisplayText(demand.status || 'assigned') }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Import Manrope Font */
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

    /* Kudzu Theme Variables */
    :root {
      --kudzu-primary: rgb(24, 45, 23);
      --kudzu-primary-light: rgba(24, 45, 23, 0.1);
      --kudzu-primary-dark: rgb(18, 35, 18);
    }

    .dashboard-container {
      padding: 20px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      margin-bottom: 20px;
      overflow: hidden;
    }

    .card-header {
      padding: 20px;
      border-bottom: 1px solid rgba(24, 45, 23, 0.1);
      background: rgba(24, 45, 23, 0.02);
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--kudzu-primary);
      margin: 0 0 4px 0;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .card-subtitle {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 20px;
    }

    .overview-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(5px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      transition: all 0.2s ease;
    }

    .overview-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(24, 45, 23, 0.1);
    }

    .overview-card.current {
      background: linear-gradient(135deg, rgba(24, 45, 23, 0.1) 0%, rgba(24, 45, 23, 0.05) 100%);
      border-color: var(--kudzu-primary);
    }

    .overview-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .overview-icon svg {
      width: 24px;
      height: 24px;
    }

    .overview-icon.total {
      background: var(--kudzu-primary-light);
      color: var(--kudzu-primary);
    }

    .overview-icon.current {
      background: var(--kudzu-primary);
      color: white;
    }

    .overview-icon.completed {
      background: var(--kudzu-primary-light);
      color: var(--kudzu-primary-dark);
    }

    .overview-content {
      flex: 1;
    }

    .overview-number {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
      margin: 0 0 4px 0;
    }

    .overview-label {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
      font-weight: 500;
    }

    .table-container {
      overflow-x: auto;
    }

    .table-wrapper {
      min-width: 800px;
    }

    .demands-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .demands-table th,
    .demands-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .demands-table th {
      background: #f9fafb;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 12px;
    }

    .demand-row:hover {
      background: #f9fafb;
    }

    .demand-id {
      font-weight: 600;
      color: #3b82f6;
    }

    .client-name {
      font-weight: 500;
      color: #374151;
    }

    .job-title {
      color: #6b7280;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-assigned { background: #dbeafe; color: #1e40af; }
    .status-processing { background: #d1fae5; color: #065f46; }
    .status-in_progress { background: #fef3c7; color: #92400e; }
    .status-completed { background: #d1fae5; color: #065f46; }
    .status-closed { background: #f3f4f6; color: #6b7280; }
    .status-loading { background: #f3f4f6; color: #6b7280; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-selected { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fecaca; color: #dc2626; }
    .status-under_verification { background: #dbeafe; color: #1e40af; }

    .assigned-date {
      color: #6b7280;
      font-size: 13px;
    }

    .action-menu {
      position: relative;
      display: inline-block;
    }

    .action-trigger {
      background: none;
      border: none;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s;
    }

    .action-trigger:hover,
    .action-trigger.active {
      background: #f3f4f6;
      color: #374151;
    }

    .action-trigger svg {
      width: 16px;
      height: 16px;
    }

    .action-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      min-width: 180px;
      overflow: hidden;
    }

    .action-item {
      width: 100%;
      padding: 12px 16px;
      background: none;
      border: none;
      text-align: left;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #374151;
      transition: background-color 0.2s;
    }

    .action-item:hover {
      background: #f9fafb;
    }

    .action-item.danger {
      color: #dc2626;
    }

    .action-item.danger:hover {
      background: #fef2f2;
    }

    .action-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px 20px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      gap: 12px;
    }

    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-primary:hover {
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

    .btn-secondary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    .page-info {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    }

    .loading-state,
    .error-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid var(--kudzu-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-icon,
    .empty-icon {
      width: 48px;
      height: 48px;
      color: #9ca3af;
      margin-bottom: 16px;
    }

    .error-icon {
      color: #ef4444;
    }

    .error-title,
    .empty-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 8px 0;
    }

    .error-message,
    .empty-description {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 20px 0;
    }

    .submissions-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .submissions-table th,
    .submissions-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }

    .submissions-table th {
      background: #f9fafb;
      font-weight: 600;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 12px;
    }

    .submission-row:hover {
      background: #f9fafb;
    }

    .submission-id {
      font-weight: 600;
      color: #3b82f6;
    }

    .resume-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--kudzu-primary-light);
      color: var(--kudzu-primary);
      border-radius: 4px;
      text-decoration: none;
      font-size: 12px;
      transition: all 0.2s;
    }

    .resume-btn:hover {
      background: var(--kudzu-primary);
      color: white;
    }

    .resume-btn .icon {
      width: 14px;
      height: 14px;
    }

    .muted {
      color: #9ca3af;
      font-size: 12px;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 8px;
      box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .modal-close {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: #6b7280;
      border-radius: 4px;
    }

    .modal-close:hover {
      background: #f3f4f6;
    }

    .modal-close svg {
      width: 20px;
      height: 20px;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-text {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 16px 0;
    }

    .demand-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .demand-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .demand-option:hover {
      background: #f9fafb;
      border-color: var(--kudzu-primary);
    }

    .demand-info {
      flex: 1;
    }

    .demand-title {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 4px 0;
    }

    .demand-client {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }

    .demand-status {
      flex-shrink: 0;
    }

    @media (max-width: 768px) {
      .dashboard-container {
        padding: 10px;
      }

      .overview-grid {
        grid-template-columns: 1fr;
        gap: 12px;
        padding: 16px;
      }

      .overview-card {
        padding: 16px;
      }

      .table-container {
        margin: 0 -10px;
      }

      .modal {
        width: 95%;
        margin: 20px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  api = environment.apiBase;

  demands: Demand[] = [];
  processCount: ProcessCount = {
    total_assigned: 0,
    current_processes: 0,
    completed_processes: 0
  };
  submissionStats: SubmissionStats = { today: 0, this_week: 0, total: 0 };
  
  // Submissions
  submissions: any[] = [];
  submissionsLoading = false;
  submissionsPage = 1;
  submissionsSize = 10;
  submissionsTotal = 0;
  
  loading = false;
  error: string | null = null;
  page = 1;
  size = 10;
  total = 0;
  
  // Action menu state
  activeMenuId: number | null = null;
  
  // Move to process modal
  showMoveModal = false;
  selectedDemand: Demand | null = null;
  availableDemands: Demand[] = [];

  get totalPages() { 
    return Math.max(1, Math.ceil(this.total / this.size)); 
  }

  get submissionsTotalPages() {
    return Math.max(1, Math.ceil(this.submissionsTotal / this.submissionsSize));
  }

  getStatusDisplayText(status: string): string {
    switch (status) {
      case 'assigned': return 'Assigned';
      case 'processing': return 'Processing';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'closed': return 'Closed';
      case 'loading': return 'Loading...';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  ngOnInit(): void {
    // Add a longer delay to ensure token and credentials are available after hard refresh
    setTimeout(() => {
      this.loadDashboardData();
    }, 1000); // Increased to 1000ms to ensure localStorage is ready
    
    // Close action menu when clicking outside
    document.addEventListener('click', (event) => {
      if (!(event.target as Element).closest('.action-menu')) {
        this.activeMenuId = null;
      }
    });
  }

  loadDashboardData(): void {
    this.loading = true;
    this.error = null;
    
    // Check if we have auth token first
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('No auth token found. User might not be logged in.');
      this.loading = false;
      this.error = 'Please log in to view your dashboard.';
      setTimeout(() => {
        this.router.navigate(['/signin']);
      }, 2000);
      return;
    }
    
    let recruiterId = this.authService.getCurrentUserId();
    
    // If no recruiter ID yet, wait for it to be ready
    if (!recruiterId) {
      console.warn('Recruiter ID not ready yet, waiting...');
      let retryCount = 0;
      const maxRetries = 5;
      
      const retry = setInterval(() => {
        retryCount++;
        recruiterId = this.authService.getCurrentUserId();
        
        if (recruiterId && typeof recruiterId === 'number' && recruiterId > 0) {
          console.log('✅ Recruiter ID ready after', retryCount, 'retries:', recruiterId);
          clearInterval(retry);
          this.loadDashboardDataInternal(recruiterId);
        } else if (retryCount >= maxRetries) {
          console.error('❌ Failed to get recruiter ID after', maxRetries, 'retries');
          clearInterval(retry);
          this.loading = false;
          this.error = 'Unable to authenticate. Redirecting to login...';
          setTimeout(() => {
            localStorage.removeItem('access_token');
            localStorage.removeItem('token_type');
            localStorage.removeItem('expires_at');
            this.router.navigate(['/signin']);
          }, 2000);
        }
      }, 300); // Check every 300ms
      
      return;
    }
    
    this.loadDashboardDataInternal(recruiterId);
  }

  private loadDashboardDataInternal(recruiterId: number): void {
    this.loading = true;
    this.error = null;

    // Load process count, submission stats, and submissions in parallel
    Promise.all([
      this.loadProcessCount(recruiterId),
      this.loadSubmissionStats(recruiterId),
      this.loadSubmissions(recruiterId)
    ]).finally(() => {
      this.loading = false;
    });
  }

  loadProcessCount(recruiterId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Fetch dashboard data to get accurate process counts
      this.http.get<any>(`${this.api}/recruiter/${recruiterId}/dashboard`).subscribe({
        next: (data) => {
          // Extract process count from dashboard data
          if (data && data.summary) {
            // Get total assigned from summary
            const total_assigned = data.summary.total_demands || 0;
            
            // Count current processes (activities with status 'processing' or 'open' or 'hold')
            const current_processes = data.activities?.filter((a: any) => 
              a.activity_status === 'processing' || 
              a.activity_status === 'open' || 
              a.activity_status === 'hold'
            ).length || 0;
            
            // Count completed processes (activities with status 'closed')
            const completed_processes = data.activities?.filter((a: any) => 
              a.activity_status === 'closed'
            ).length || 0;
            
            this.processCount = {
              total_assigned: total_assigned,
              current_processes: current_processes,
              completed_processes: completed_processes
            };
          } else {
            // If no data structure, set to zeros
            this.processCount = {
              total_assigned: 0,
              current_processes: 0,
              completed_processes: 0
            };
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading process count:', error);
          // Set to zeros on error (no hardcoded mock values)
          this.processCount = {
            total_assigned: 0,
            current_processes: 0,
            completed_processes: 0
          };
          resolve();
        }
      });
    });
  }

  loadDemands(recruiterId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // No longer needed on dashboard; keep stub for compatibility
      resolve();
    });
  }

  loadSubmissionStats(recruiterId: number): Promise<void> {
    return new Promise((resolve) => {
      this.http.get<SubmissionStats>(`${this.api}/recruiter/${recruiterId}/submission-stats`).subscribe({
        next: (stats) => {
          this.submissionStats = stats;
          resolve();
        },
        error: () => {
          // Fallback to zeros on error
          this.submissionStats = { today: 0, this_week: 0, total: 0 };
          resolve();
        }
      });
    });
  }

  loadSubmissions(recruiterId: number): Promise<void> {
    return new Promise((resolve) => {
      this.submissionsLoading = true;
      this.http.get<any>(`${this.api}/submissions/recruiter/${recruiterId}`, {
        params: { page: this.submissionsPage, size: this.submissionsSize }
      }).subscribe({
        next: (response) => {
          this.submissions = response?.items || [];
          this.submissionsTotal = response?.total || 0;
          this.submissionsLoading = false;
          resolve();
        },
        error: (error) => {
          console.error('Error loading submissions:', error);
          this.submissions = [];
          this.submissionsTotal = 0;
          this.submissionsLoading = false;
          resolve();
        }
      });
    });
  }

  nextSubmissionsPage(): void {
    if (this.submissionsPage < this.submissionsTotalPages) {
      this.submissionsPage++;
      const recruiterId = this.authService.getCurrentUserId();
      if (recruiterId) {
        this.loadSubmissions(recruiterId);
      }
    }
  }

  prevSubmissionsPage(): void {
    if (this.submissionsPage > 1) {
      this.submissionsPage--;
      const recruiterId = this.authService.getCurrentUserId();
      if (recruiterId) {
        this.loadSubmissions(recruiterId);
      }
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadDashboardData();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadDashboardData();
    }
  }

  toggleActionMenu(demandId: number): void {
    this.activeMenuId = this.activeMenuId === demandId ? null : demandId;
  }

  viewDemandDetails(demand: Demand): void {
    this.activeMenuId = null;
    this.router.navigate(['/recruiter/demands']);
  }

  startProcess(demand: Demand): void {
    this.activeMenuId = null;
    const recruiterId = this.authService.getCurrentUserId();
    
    if (!recruiterId) {
      this.toastService.error('Unable to identify recruiter ID');
      return;
    }

    // Show loading state
    const originalStatus = demand.status;
    demand.status = 'loading';

    this.http.post<any>(`${this.api}/recruiter/${recruiterId}/demand/${demand.id}/open`, {}).subscribe({
      next: (response) => {
        this.toastService.success('Process started successfully!');
        // Update demand status to processing
        demand.status = 'processing';
        // Refresh the dashboard data to get updated counts
        this.loadDashboardData();
      },
      error: (error) => {
        console.error('Error starting process:', error);
        // Revert status on error
        demand.status = originalStatus;
        
        if (error.status === 400) {
          this.toastService.error(error.error?.detail || 'Cannot start process. You may have reached the limit of 3 concurrent processes.');
        } else {
          this.toastService.error('Failed to start process. Please try again.');
        }
      }
    });
  }

  moveToProcess(demand: Demand): void {
    this.activeMenuId = null;
    this.selectedDemand = demand;
    
    // Load available demands (excluding current one)
    const recruiterId = this.authService.getCurrentUserId();
    if (recruiterId) {
      this.http.get<any>(`${this.api}/recruiter/${recruiterId}/demands`, {
        params: { page: 1, size: 100 } // Get all for selection
      }).subscribe({
        next: (response) => {
          this.availableDemands = (response.items || []).filter((d: Demand) => 
            d.id !== demand.id && d.status !== 'in_progress'
          );
          this.showMoveModal = true;
        },
        error: (error) => {
          console.error('Error loading available demands:', error);
          this.toastService.error('Failed to load available demands');
        }
      });
    }
  }

  selectDemandForMove(targetDemand: Demand): void {
    if (!this.selectedDemand) return;

    const recruiterId = this.authService.getCurrentUserId();
    if (!recruiterId) {
      this.toastService.error('Authentication error');
      return;
    }

    const params = `recruiter_id=${recruiterId}&from_demand_id=${this.selectedDemand.id}&to_demand_id=${targetDemand.id}`;
    this.http.patch(`${this.api}/recruiter/move-process?${params}`, {}).subscribe({
      next: (response) => {
        this.toastService.success('Moved to new process successfully');
        this.closeMoveModal();
        this.loadDashboardData(); // Refresh data
      },
      error: (error) => {
        console.error('Error moving process:', error);
        this.toastService.error('Failed to update process. Try again.');
      }
    });
  }

  closeProcess(demand: Demand): void {
    this.activeMenuId = null;
    
    const recruiterId = this.authService.getCurrentUserId();
    if (!recruiterId) {
      this.toastService.error('Authentication error');
      return;
    }

    this.http.patch(`${this.api}/recruiter/close-process?recruiter_id=${recruiterId}&demand_id=${demand.id}`, {}).subscribe({
      next: (response) => {
        this.toastService.success('Process closed successfully');
        this.loadDashboardData(); // Refresh data
      },
      error: (error) => {
        console.error('Error closing process:', error);
        this.toastService.error('Failed to update process. Try again.');
      }
    });
  }

  closeMoveModal(): void {
    this.showMoveModal = false;
    this.selectedDemand = null;
    this.availableDemands = [];
  }

  // Public method for template navigation
  goToAssignedDemands(): void {
    this.router.navigate(['/recruiter/demands']);
  }
}