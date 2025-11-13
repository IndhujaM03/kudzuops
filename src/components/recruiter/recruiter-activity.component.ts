import { Component, OnInit, OnDestroy, inject, ViewChild, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';
import { DataService } from '../../services/data.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../environments/environment';
// PDF and DOCX viewing temporarily disabled

interface Demand {
  id: number;
  job_title: string;
  job_description?: string;
  job_description_url?: string; // legacy name
  ob_description_url?: string; // requested field name
  client_name: string;
  skill: string;
  no_of_positions: number;
  priority: string;
  status: string;
  spoc_name?: string;
  spoc_email?: string;
  spoc_phone?: string;
}

interface Activity {
  id: number;
  recruiter_id: number;
  demand_id: number;
  activity_status: string;
  opened_at: string;
  cv_list: any[];
  job_description?: string;
  job_description_url?: string;
  uploaded_cv_count?: number;
  required_cv_count?: number;
}

interface CVEntry {
  file_name: string;
  detected_at: string;
  file_path?: string;
  candidate_name?: string;
  email?: string;
  phone?: string;
  remarks?: string;
  cv_path?: string;
  status?: string;
  verified_status?: string;
  demand_id?: number;
  recruiter_id?: number;
  file_size?: number;
}

interface CandidateForm {
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  remarks: string;
}

@Component({
  selector: 'app-recruiter-activity',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="activity-container">
      <!-- Resume List Inline (sidebar removed) -->
      <div class="resume-list-inline" *ngIf="!loading && activity && (error !== 'This demand is not yet in processing. Please start the process from the demands table.')">
        <div class="inline-header">
          <h3>Resumes</h3>
          <div class="inline-actions">
            <button class="btn btn-sm btn-outline" (click)="refreshResumeList()" [disabled]="cvLoading" title="Refresh list">
              <svg class="icon" [class.spinning]="cvLoading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <input #fileInput type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" (change)="onFilesSelected($event)">
            <button class="btn btn-sm btn-outline" (click)="triggerFilePicker()" [disabled]="isUploadDisabled()" title="Upload Resume">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </button>
          </div>
        </div>
        <div class="resume-list-scroll">
          <div class="resume-row" *ngFor="let cv of filteredCvList()" (click)="openResumeViewModal(cv)">
            <div class="resume-row-left">
              <span class="filename" [title]="cv.file_name">{{ cv.file_name }}</span>
            </div>
            <div class="resume-row-right">
              <button *ngIf="!cv.status" class="icon-btn" title="Add details" (click)="$event.stopPropagation(); openResumeViewModal(cv)">+</button>
              <span *ngIf="cv.status" class="status-pill" [ngClass]="statusClass(cv.status)">
                <span class="dot"></span>
                {{ displayStatus(cv.status) }}
              </span>
            </div>
          </div>
          <div *ngIf="filteredCvList().length === 0" class="no-resumes">
            <p>No resumes found</p>
          </div>
        </div>
        
      </div>

      <!-- Main Content (scoped to activity page; avoid global .main-content) -->
      <div class="activity-main">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            <button class="btn btn-secondary" (click)="goBack()">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Demands
            </button>
            <h1 class="title">Demand Details</h1>
          </div>
          <div class="header-right">
            <div class="mode-indicator" [ngClass]="'mode-' + mode">
              {{ mode === 'view' ? 'View Mode' : 'Process Mode' }}
            </div>         
          </div>
        </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading activity...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading && error !== 'This demand is not yet in processing. Please start the process from the demands table.'" class="error-state">
        <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="error-title">Error Loading Activity</h3>
        <p class="error-message">{{ error }}</p>
        <button class="btn btn-primary" (click)="loadActivity()">Retry</button>
      </div>

      <!-- Open Status Warning -->
      <div *ngIf="error === 'This demand is not yet in processing. Please start the process from the demands table.' && activity" class="open-status-warning">
        <div class="warning-content">
          <svg class="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 class="warning-title">Demand Not Started</h3>
          <p class="warning-message">This demand is currently in 'Open' status. To begin processing, please go back to the demands table and click "Start Process".</p>
          <button class="btn btn-primary" (click)="goBack()">Back to Demands</button>
        </div>
      </div>

      <!-- Activity Content -->
      <div *ngIf="!loading && activity && (error !== 'This demand is not yet in processing. Please start the process from the demands table.')" class="activity-content">
        <!-- Demand Details Section -->
        <div class="demand-details-section" *ngIf="demand">
          <div class="section-header">
            <h2>Demand Details</h2>
          </div>
          <div class="demand-details-card">
            <!-- Row 1: Job Title, Client, SPOC -->
            <div class="demand-row-1">
              <div class="demand-item">
                <span class="demand-label">Job Title:</span>
                <span class="demand-value">{{ demand.job_title || demand.skill || 'N/A' }}</span>
              </div>
              <div class="demand-item">
                <span class="demand-label">Client:</span>
                <span class="demand-value">{{ demand.client_name || 'N/A' }}</span>
              </div>
              <div class="demand-item">
                <span class="demand-label">SPOC:</span>
                <span class="demand-value">{{ demand.spoc_name || 'N/A' }}</span>
              </div>
            </div>
            <!-- Row 2: Position, Priority -->
            <div class="demand-row-2">
              <div class="demand-item">
                <span class="demand-label">Position:</span>
                <span class="demand-value">{{ demand.no_of_positions || 0 }}</span>
              </div>
              <div class="demand-item">
                <span class="demand-label">Priority:</span>
                <span class="demand-value priority-value" [class]="'priority-' + (demand.priority || 'medium')">
                  {{ (demand.priority || 'medium') | titlecase }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Section: Job Description -->
        <div class="top-section">
          <!-- Job Description -->
          <div class="job-description-section">
            <div class="section-header">
              <h2>Job Description</h2>
            </div>
            <div class="job-description-content">
              <div *ngIf="demand?.job_description" [innerHTML]="demand?.job_description"></div>
              <div *ngIf="!demand?.job_description && activity?.job_description" [innerHTML]="activity.job_description"></div>
              <div *ngIf="!demand?.job_description && !activity?.job_description" class="no-content">
                <p>No job description available</p>
              </div>
              
            </div>
          </div>

          <!-- AI Questions section hidden -->
        </div>


        <!-- CV Submissions Table (from activity.cv_list only) -->
        <div class="cv-section">
          <div class="section-header">
            <h2>CV Submissions</h2>
            <div class="section-actions" *ngIf="activity as a">
              <span class="count-pill">Uploaded: {{ a.uploaded_cv_count || 0 }}</span>
              <span class="count-pill alt" *ngIf="a.required_cv_count != null">Required: {{ a.required_cv_count }}</span>
            </div>
          </div>
          <div class="cv-table-wrapper">
            <table class="cv-table" *ngIf="(activity?.cv_list || []).length > 0; else noCv">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Candidate</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of activity?.cv_list">
                  <td>{{ row.candidate_id }}</td>
                  <td>{{ row.candidate_name || row.name }}</td>
                  <td>{{ row.email }}</td>
                  <td>{{ row.phone }}</td>
                  <td>{{ mapNumericStatus(row.status) }}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" *ngIf="row.file_path" (click)="viewCV(row.file_path)" title="View CV">
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <ng-template #noCv>
              <div class="no-content">
                <p>No CVs submitted yet.</p>
              </div>
            </ng-template>
          </div>
        </div>
      </div>
    </div>

    <!-- Resume View Modal -->
    <div class="modal-overlay" *ngIf="showResumeViewModal" (click)="closeResumeViewModal()">
      <div class="modal large two-panel draggable" 
           [class.is-dragging]="isDragging"
           (click)="$event.stopPropagation()"
           (mousedown)="onModalMouseDown($event)"
           (mousemove)="onModalMouseMove($event)"
           (mouseup)="onModalMouseUp()"
           (mouseleave)="onModalMouseUp()"
           [style]="getModalStyle()">
        <div class="modal-header draggable-header">
          <h3>Resume Verification</h3>
          <div class="modal-actions">
            <button class="close-btn" (click)="closeResumeViewModal()" title="Close">❌</button>
          </div>
        </div>
        <div class="modal-body">
          <div class="panel-left">
            <ng-container *ngIf="selectedResume as sr">
              <!-- DOCX Preview -->
              <div *ngIf="isDocx(sr.file_name)" class="docx-container">
                <div #docxHost class="docx-host"></div>
                <div *ngIf="docxLoading" class="docx-loading">Loading document...</div>
                <div *ngIf="docxError" class="docx-error">
                  <p>Unable to preview document.</p>
                  <button class="btn btn-primary" (click)="openFileInNewTab(sr)">Open Document</button>
                </div>
              </div>
              <!-- PDF Preview -->
              <div *ngIf="isPdf(sr.file_name)" class="pdf-container">
                <canvas #pdfCanvas class="pdf-canvas"></canvas>
                <div *ngIf="pdfLoading" class="pdf-loading">Loading PDF document...</div>
                <div *ngIf="pdfError" class="pdf-error">
                  <p>Unable to preview PDF file.</p>
                  <button class="btn btn-primary" (click)="openFileInNewTab(sr)">Open PDF File</button>
                </div>
              </div>
              <!-- Fallback for unsupported formats (e.g., .doc) -->
              <div *ngIf="!isDocx(sr.file_name) && !isPdf(sr.file_name)" class="docx-helper">
                <div class="docx-message">This file type cannot be previewed in the browser.</div>
                <button class="btn btn-outline" (click)="openFileInNewTab(sr)">Open in new tab</button>
              </div>
            </ng-container>
          </div>
          <div class="vertical-divider"></div>
          <div class="panel-right">
            <!-- Quota Exceeded Alert -->
            <div *ngIf="quotaExceeded" class="quota-alert">
              <div class="alert-content">
                <div class="alert-icon">⚠️</div>
                <div class="alert-text">
                  <strong>All required profiles have already been submitted for this demand.</strong>
                </div>
              </div>
              <button class="btn btn-primary" (click)="handleQuotaExceeded()">OK</button>
            </div>

            <form [formGroup]="resumeForm" *ngIf="selectedResume" class="candidate-form">
              <div class="form-group">
                <label>Candidate Name *</label>
                <input type="text" class="form-input" formControlName="candidate_name" placeholder="Enter candidate name">
              </div>
              <div class="form-group">
                <label>Email *</label>
                <input type="email" class="form-input" formControlName="email" placeholder="Enter email">
              </div>
              <div class="form-group">
                <label>Phone Number</label>
                <input type="tel" class="form-input" formControlName="phone" placeholder="Enter phone number">
              </div>
              <div class="form-group">
                <label>Remarks</label>
                <textarea rows="3" class="form-input" formControlName="remarks" placeholder="Notes or context (optional)"></textarea>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select class="form-input" formControlName="status">
                  <option value="discard">Discard</option>
                  <option value="hold">Hold</option>
                  <option value="submitted">Submitted</option>
                </select>
              </div>
              <div class="form-actions">
                <button class="save-btn" (click)="saveResumeDetails()" [disabled]="!resumeForm.valid" title="Save">
  Save
</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- CV View Popup Modal -->
    <div class="modal-overlay" *ngIf="showCVViewModal" (click)="closeCVViewModal()">
      <div class="cv-view-modal" (click)="$event.stopPropagation()">
        <div class="cv-view-header">
          <h3>View CV</h3>
          <button class="close-btn" (click)="closeCVViewModal()" title="Close">❌</button>
        </div>
        <div class="cv-view-body">
          <!-- PDF uses iframe; DOCX renders into the host below -->
          <iframe *ngIf="cvViewUrl" [src]="cvViewUrl" class="cv-iframe" allow="fullscreen" allowfullscreen (error)="onIframeError($event)"></iframe>
          <div *ngIf="!cvViewUrl" #cvDocxHost class="cv-docx-host"></div>
        </div>
      </div>
    </div>
    </div>
  `,
  styles: [`
    .activity-container {
      display: flex;
      min-height: 100vh;
      background: #F8FAFC;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .resume-sidebar {
      width: 300px;
      background: #f9fafb;
      border-right: 1px solid #e5e7eb;
      padding: 20px;
      overflow-y: auto;
      height: calc(100vh - 100px);
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
    }

    .activity-main {
      flex: 1;
      padding: 12px;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .sidebar-header h3 {
      margin: 0;
      color: #374151;
      font-size: 18px;
      font-weight: 600;
    }

    .resume-list {
      max-height: calc(100vh - 200px);
      overflow-y: auto;
    }

    .resume-item {
      display: flex;
      align-items: center;
      padding: 12px;
      margin-bottom: 8px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .resume-item:hover {
      border-color: #3b82f6;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
    }

    .resume-icon {
      font-size: 20px;
      margin-right: 12px;
    }

    .resume-info {
      flex: 1;
      min-width: 0;
    }

    .resume-filename {
      font-weight: 500;
      color: #374151;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .resume-time {
      font-size: 12px;
      color: #6b7280;
      margin-top: 2px;
    }

    .resume-candidate {
      font-size: 12px;
      color: #059669;
      font-weight: 500;
      margin-top: 2px;
    }

    .no-resumes {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }

    .no-resumes p {
      margin: 0;
      font-size: 14px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 10px 12px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }


    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 6px;
      font-weight: 500;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%);
      color: white;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
      font-weight: 600;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
    }

    .btn-primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px rgba(24, 45, 23, 0.1);
    }

    .btn-primary:hover:not(:disabled)::before {
      left: 100%;
    }

    .btn-secondary {
      background: #e5e7eb;
      color:var(--kudzu-primary);
    }

    .btn-secondary:hover {
      background: var(--kudzu-primary-light);
    }

    .btn-outline {
      background: transparent;
      color: var(--kudzu-primary);
      border: 1px solid var(--kudzu-primary);
    }

    .btn-outline:hover {
      background: var(--kudzu-primary-dark);
      color: white;
    }

    .btn-danger {
      background: #dc2626;
      color: white;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .icon {
      width: 16px;
      height: 16px;
    }

    .icon.spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .activity-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .demand-details-section {
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .demand-details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 16px;
      margin-top: 6px;
    }

    @media (max-width: 768px) {
      .demand-details-grid {
        grid-template-columns: 1fr;
      }
    }

    .demand-details-grid.compact .detail-item {
      margin-bottom: 0;
    }

    /* New Demand Details Card Structure */
    .demand-details-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-top: 8px;
    }

    .demand-row-1,
    .demand-row-2 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 12px;
      align-items: center;
    }

    .demand-row-2 {
      margin-bottom: 0;
    }

    .demand-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .demand-label {
      font-weight: 600;
      color: var(--kudzu-primary);
      font-size: 13px;
      margin-bottom: 2px;
    }

    .demand-value {
      color: #374151;
      font-size: 14px;
      font-weight: 500;
      word-break: break-word;
    }

    .demand-value.priority-value {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .demand-value.priority-value.priority-high {
      background: #fef2f2;
      color: #dc2626;
    }

    .demand-value.priority-value.priority-medium {
      background: #fef3c7;
      color: #d97706;
    }

    .demand-value.priority-value.priority-low {
      background: #f0fdf4;
      color: #16a34a;
    }

    /* Responsive Design for Demand Details */
    @media (max-width: 1024px) {
      .demand-row-1,
      .demand-row-2 {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    }

    @media (max-width: 768px) {
      .demand-row-1,
      .demand-row-2 {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .demand-label {
        font-size: 12px;
        margin-bottom: 2px;
      }

      .demand-value {
        font-size: 13px;
      }

      .demand-row-2 {
        margin-bottom: 0;
      }
    }

    .detail-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-item label {
      font-weight: 600;
      color: var(--kudzu-primary);
      font-size: 14px;
    }

    .detail-item span {
      color: #1e293b;
      font-size: 14px;
    }

    .priority-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .priority-low { background: #d1fae5; color: #065f46; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-high { background: #fecaca; color: #dc2626; }
    .priority-urgent { background: #fecaca; color: #7f1d1d; }

    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-open { background: #dbeafe; color: #1e40af; }
    .status-assigned { background: #e0e7ff; color: #3730a3; }
    .status-processing { background: #d1fae5; color: #065f46; }
    .status-closed { background: #f3f4f6; color: #374151; }

    .top-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .job-description-section,
    .ai-questions-section {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .count-pill { font-size: 12px; padding: 4px 8px; border-radius: 999px; background: #ecfdf5; color: #065f46; margin-left: 8px; }
    .count-pill.alt { background: #eef2ff; color: #3730a3; }

    .section-header h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--kudzu-primary);
      margin: 0;
    }

    .section-actions {
      display: flex;
      gap: 8px;
    }

    .job-description-content,
    .ai-questions-content {
      padding: 12px;
      max-height: 380px;
      overflow-y: auto;
    }

    .questions-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .question-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }

    .question-number {
      background: #3b82f6;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .question-text {
      color: #374151;
      line-height: 1.5;
    }

    .cv-section {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      margin-top: 12px;
    }
    .cv-table-wrapper { padding: 12px; }
    .cv-table { width: 100%; border-collapse: collapse; }
    .cv-table th, .cv-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .cv-table thead th { font-weight: 600; color: #374151; background: #f9fafb; }

    .cv-folder-info {
      padding: 16px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e5e7eb;
    }

    .folder-info {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .folder-icon {
      width: 20px;
      height: 20px;
      color: #6b7280;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .folder-details {
      flex: 1;
      min-width: 0;
    }

    .folder-label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 4px;
    }

    .folder-path {
      font-size: 14px;
      color: #1f2937;
      font-family: 'Courier New', monospace;
      background: #e5e7eb;
      padding: 4px 8px;
      border-radius: 4px;
      word-break: break-all;
      margin-bottom: 4px;
    }

    .folder-instruction {
      font-size: 12px;
      color: #6b7280;
      font-style: italic;
    }

    .cv-list {
      padding: 12px;
    }

    .cv-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cv-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .cv-item:hover {
      background: #f9fafb;
    }

    .cv-item.selected {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .cv-info {
      flex: 1;
    }

    .cv-filename {
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .cv-time {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 4px;
    }

    .cv-candidate {
      font-size: 14px;
      color: #374151;
      margin-bottom: 4px;
    }

    .cv-status {
      margin-top: 4px;
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .status-under_verification {
      background: #fef3c7;
      color: #92400e;
    }

    .status-selected {
      background: #d1fae5;
      color: #065f46;
    }

    .status-rejected {
      background: #fecaca;
      color: #dc2626;
    }

    .cv-actions {
      display: flex;
      gap: 8px;
    }

    .no-content,
    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;
      color: #6b7280;
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      color: #9ca3af;
      margin-bottom: 16px;
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

    .loading-spinner.small {
      width: 20px;
      height: 20px;
      border-width: 2px;
      margin-bottom: 8px;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
    }

    .open-status-warning {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }

    .warning-content {
      background: white;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 500px;
      border-left: 4px solid #f59e0b;
    }

    .warning-icon {
      width: 48px;
      height: 48px;
      color: #f59e0b;
      margin-bottom: 16px;
    }

    .warning-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 8px 0;
    }

    .warning-message {
      font-size: 14px;
      color: #6b7280;
      margin: 0 0 20px 0;
      line-height: 1.5;
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
      width: 90vw;
      height: 95vh !important;
      overflow: hidden;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .modal.large {
      max-width: none;
    }

    .modal.draggable {
      cursor: move;
    }

    .draggable-header {
      cursor: move;
      user-select: none;
    }

    .modal.draggable.is-dragging {
      cursor: grabbing;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quota-alert {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .alert-content {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .alert-icon {
      font-size: 20px;
    }

    .alert-text {
      flex: 1;
      color: #92400e;
    }

    .alert-text strong {
      font-weight: 600;
    }

    .close-btn {
      background: transparent !important;
      border: none !important;
      padding: 4px !important;
      cursor: pointer !important;
      color: var(--kudzu-text-secondary) !important;
      border-radius: 4px !important;
      transition: all 0.2s !important;
    }

    .close-btn:hover {
      background: var(--kudzu-primary-light) !important;
      color: var(--kudzu-primary) !important;
    }

    .modal.two-panel .modal-body {
      padding: 0;
      height: calc(95vh - 120px) !important;
      display: grid;
      grid-template-columns: 2fr 1px 1fr;
    }
    .panel-left, .panel-right {
      height: 100%;
      overflow: auto;
    }
    .panel-left { background: #0b0b0b; }
    .doc-frame { 
      width: 100%; 
      height: 100%; 
      border: 0; 
      background: #ffffff;
      min-height: 600px;
    }
    .vertical-divider { width: 1px; background: #e5e7eb; }
    
    /* DOCX Preview Styles */
    .docx-container {
      width: 100%;
      height: 100%;
      background: #ffffff;
      overflow: hidden;
      position: relative;
    }
    
    .docx-host {
      width: 100%;
      height: 100%;
      padding: 20px;
      background: #ffffff;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      cursor: text;
    }
    
    .docx-host:hover {
      cursor: grab;
    }
    
    .docx-host:active {
      cursor: grabbing;
    }
    
    /* Ensure docx content respects margins */
    .docx-host ::ng-deep img,
    .docx-host ::ng-deep table {
      max-width: 100% !important;
      height: auto !important;
    }
    
    /* Add proper margins to paragraphs */
    .docx-host ::ng-deep p {
      margin: 8px 0;
      line-height: 1.6;
    }
    
    /* Wrap table if it's too wide */
    .docx-host ::ng-deep table {
      margin: 10px 0;
    }
    
    .docx-loading, .pdf-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #6b7280;
      font-size: 16px;
      background: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    
    .docx-error, .pdf-error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #dc2626;
      font-size: 16px;
      background: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    
    .docx-error .btn, .pdf-error .btn {
      margin-top: 12px;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .docx-error .btn:hover, .pdf-error .btn:hover {
      background: #2563eb;
    }
    
    /* PDF Preview Styles */
    .pdf-container {
      width: 100%;
      height: 100%;
      background: #ffffff;
      overflow: auto;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px;
    }
    
    .pdf-canvas {
      max-width: 100%;
      height: auto;
      border: 1px solid #e5e7eb;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .candidate-form { 
      padding: 16px; 
      display: flex; 
      flex-direction: column; 
      gap: 10px; 
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-weight: 500;
      color: #374151;
      font-size: 14px;
    }

    .form-input {
      padding: 10px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .form-input textarea {
      resize: vertical;
      min-height: 80px;
    }

    .form-input:focus {
      outline: none;
      border-color: #059669;
      box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
    }

    .form-input::placeholder {
      color: #9ca3af;
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .candidate-form {
        padding: 12px;
        gap: 8px;
      }
      
      .form-actions {
        margin-top: 6px;
        padding-top: 6px;
      }
    }
    .status-row { position: sticky; bottom: 0; background: #fff; padding-bottom: 4px; }
    .docx-helper { height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; color: #e5e7eb; }
    .docx-message { font-size: 14px; color: #e5e7eb; }

    .modal-footer {
      display: flex !important;
      justify-content: flex-end !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 12px 24px !important;
      border-top: 1px solid #eef2f7;
      background: #f9fafb;
      margin-top: 4px;
    }

    .form-actions {
  display: flex;
  justify-content: flex-end;   /* aligns the button to the right */
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
}

.save-btn {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 6px 16px !important;     /* compact padding */
  font-size: 13px !important;
  font-weight: 500 !important;
  color: #fff !important;
  border: none !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  height: auto !important;
  line-height: 1.2 !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
  width: auto !important;           /* prevent full width */
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08) !important;
}

.save-btn:active:not(:disabled) {
  transform: translateY(0) !important;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.06) !important;
}

.save-btn:disabled {
  opacity: 0.5 !important;
  cursor: not-allowed !important;
  transform: none !important;
  box-shadow: none !important;
}


    .modal-footer .btn {
      min-width: auto !important;
      padding: 1px 4px !important;
      font-size: 9px !important;
      height: 20px !important;
      line-height: 1 !important;
      border-radius: 3px !important;
    }

    .modal-footer .btn-primary {
      padding: 1px 6px !important;
      font-size: 9px !important;
      height: 20px !important;
      line-height: 1 !important;
      border-radius: 3px !important;
    }

    .modal-footer .btn-secondary {
      padding: 1px 4px !important;
      font-size: 9px !important;
      height: 20px !important;
      line-height: 1 !important;
      border-radius: 3px !important;
    }

    /* Additional specific overrides */
    .modal.large .modal-footer .btn {
      min-width: auto !important;
      padding: 1px 4px !important;
      font-size: 9px !important;
      height: 20px !important;
      line-height: 1 !important;
      border-radius: 3px !important;
    }

    .modal.large .modal-footer .btn-primary {
      padding: 1px 6px !important;
      font-size: 9px !important;
      height: 20px !important;
      line-height: 1 !important;
      border-radius: 3px !important;
      width:65px;
    }

    .cv-selection {
      margin-bottom: 24px;
    }

    .cv-selection h4 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 12px 0;
    }

    .cv-checkboxes {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .cv-checkbox {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .cv-checkbox:hover {
      background: #f9fafb;
    }

    .cv-checkbox input[type="checkbox"] {
      margin: 0;
    }

    .checkbox-text {
      flex: 1;
      font-weight: 500;
      color: #374151;
    }

    .cv-time {
      font-size: 12px;
      color: #6b7280;
    }

    .candidate-forms {
      border-top: 1px solid #e5e7eb;
      padding-top: 24px;
    }

    .candidate-forms h4 {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 16px 0;
    }

    .candidate-form-group {
      margin-bottom: 24px;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
    }

    .candidate-form-group h5 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 12px 0;
    }

    .form-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-group label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .form-input {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    /* Inline resume grid */
    .resume-list-inline {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 16px;
      width: 280px;
      margin-right: 12px;
    }

    .inline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .inline-actions { display: flex; gap: 8px; align-items: center; }

    .resume-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }

    .resume-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #f9fafb;
    }

    .resume-card .resume-filename {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
    }

    .resume-card .resume-time {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 8px;
    }

    .resume-card .row {
      font-size: 12px;
      color: #374151;
    }

    .resume-card .row span {
      color: #6b7280;
      margin-right: 6px;
    }

    .resume-status {
      margin-top: 8px;
      font-size: 12px;
      color: #92400e;
      background: #fef3c7;
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* New compact list styles */
    .resume-list-scroll {
      max-height: 360px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    .resume-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
    }
    .resume-row:hover { background: #f9fafb; }
    .resume-row:last-child { border-bottom: none; }
    .resume-row-left .filename {
      font-size: 13px;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 180px;
      display: inline-block;
    }
    .icon-btn {
      width: 22px;
      height: 22px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #ffffff;
      color: #374151;
      line-height: 18px;
      text-align: center;
      font-weight: 700;
      padding: 0;
      cursor: pointer;
    }
    .icon-btn:hover { background: #f3f4f6; }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #334155;
    }
    .status-pill .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      background: #9ca3af;
    }
    .pill-submitted { background: #ecfdf5; color: #065f46; }
    .pill-submitted .dot { background: #10b981; }
    .pill-hold { background: #fffbeb; color: #92400e; }
    .pill-hold .dot { background: #f59e0b; }
    .pill-discard { background: #fef2f2; color: #991b1b; }
    .pill-discard .dot { background: #ef4444; }
    .inline-footer { margin-top: 10px; display: flex; justify-content: flex-end; }

    @media (max-width: 768px) {
      .activity-container {
        padding: 10px;
      }

      .header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .header-left {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }

      .top-section {
        grid-template-columns: 1fr;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .modal {
        width: 95%;
        margin: 20px;
      }
    }

    /* CV View Modal Styles */
    .cv-view-modal {
      width: 92%;
      height: 92%;
      max-width: 1400px;
      max-height: 900px;
      background: #111827; /* slightly darker around edges */
      border-radius: 10px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .cv-view-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .cv-view-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .cv-view-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: auto; /* allow scroll inside the modal */
      padding: 0 0 16px 0; /* bottom padding for breathing room */
      background: #1f2937; /* remove white gaps */
    }

    .cv-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #1f2937;
    }

    /* DOCX render host inside the view-only modal */
    .cv-docx-host {
      flex: 1;
      min-height: 100%;
      overflow: auto; /* ensure docx content scrolls */
      background: #1f2937;
      padding: 0 12px 24px; /* small side and bottom padding */
    }

    .cv-error-message {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: #f9fafb;
      color: #6b7280;
      font-size: 16px;
    }

    .cv-error-message p {
      margin: 0;
      text-align: center;
    }

    /* Eye icon button styling */
    .btn .icon {
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }

    .btn:not(:has(.icon)) {
      padding-left: 12px;
    }

    @media (max-width: 768px) {
      .cv-view-modal {
        width: 98%;
        height: 96%;
        margin: 10px;
      }
    }
  `]
})
export class RecruiterActivityComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private dataService = inject(DataService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private refreshInterval?: number;
  api = environment.apiBase;

  // Data
  activity: Activity | null = null;
  demand: Demand | null = null;
  cvList: CVEntry[] = [];
  aiQuestions: string[] = [];
  cvFolderPath: string | null = null;

  // State
  loading = false;
  error: string | null = null;
  aiLoading = false;
  cvLoading = false;

  // Resume View Modal
  showResumeViewModal = false;
  selectedResume: CVEntry | null = null;
  resumeForm: FormGroup;
  
  // CV View Modal
  showCVViewModal = false;
  cvViewUrl: SafeResourceUrl | null = null;
  @ViewChild('fileInput') fileInput!: any;
  @ViewChild('docxHost') docxHostRef!: ElementRef;
  @ViewChild('cvDocxHost') cvDocxHostRef!: ElementRef;
  @ViewChild('pdfCanvas') pdfCanvasRef!: ElementRef;
  
  // Quota validation
  quotaExceeded = false;
  
  // Drag functionality for modal
  isDragging = false;
  dragOffset = { x: 0, y: 0 };
  modalPosition = { x: 0, y: 0 };
  docxLoading = false;
  docxError = false;
  pdfLoading = false;
  pdfError = false;
  // Cached viewer URL to avoid reloads on change detection
  viewerUrl: SafeResourceUrl | null = null;
  submissionsLoading = false;

  // Mock-only (front-end) storage for resumes
  mockMode = false;
  mockResumes: Array<{ id: string; fileName: string; uploadedAt: string; status: string; url: string; candidate?: { name?: string; email?: string; phone?: string; } }> = [];

  // Route params
  recruiterId: number = 0;
  demandId: number = 0;
  mode: 'view' | 'process' = 'view';

  constructor() {
    // Initialize resume form
    this.resumeForm = this.fb.group({
      candidate_name: ['', [Validators.required]],
      phone: [''],
      email: ['', [Validators.required, Validators.email]],
      remarks: [''],
      cv_path: [''],
      status: ['underverification']
    });
  }

  getJdUrl(): string | null {
    // Prefer provided ob_description_url, fallback to legacy job_description_url
    const url = this.demand?.ob_description_url || this.demand?.job_description_url || this.activity?.job_description_url;
    return url ? String(url) : null;
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const paramRecruiter = params['recruiterId'];
      const paramDemand = params['demandId'];
      
      // Preferred simple form: /activity/:demandId
      if (paramDemand !== undefined) {
        this.demandId = +paramDemand;
      }

      // Derive recruiterId from route if present, else from auth
      this.recruiterId = paramRecruiter ? +paramRecruiter : (this.authService.getCurrentUserId() || 0);

      // If recruiterId still 0, try storage
      if (!this.recruiterId) {
        const storedId = Number(localStorage.getItem('user_id') || sessionStorage.getItem('user_id'));
        if (storedId) this.recruiterId = storedId;
      }

      // Determine mode based on route structure
      // If both recruiterId and demandId are in route, it's process mode
      // If only demandId is in route, it's view mode
      this.mode = (paramRecruiter && paramDemand) ? 'process' : 'view';

      // If still missing critical params, route back to demands to avoid guard loops
      if (!this.recruiterId || !this.demandId) {
        this.router.navigate(['/recruiter/demands']);
        return;
      }
      this.loadActivity();
      if (this.mockMode) this.loadMockResumes();
      
      // Always load local CV list (from recruiter_folder_path/recruiterId/demandId)
      // Commented out because it overrides the CV list from loadActivity()
      // this.loadCVFolder();
      
      // Auto-refresh only in process mode
      if (this.mode === 'process') {
        this.startAutoRefresh();
      }
    });
    // DOCX files will show fallback message
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.enableBodyScroll();
  }

  private disableBodyScroll(): void {
    try {
      document.body.style.overflow = 'hidden';
    } catch {}
  }

  private enableBodyScroll(): void {
    try {
      document.body.style.overflow = '';
    } catch {}
  }

  loadActivity(): void {
    this.loading = true;
    this.error = null;

    if (this.mode === 'process') {
      // In process mode, load the activity for the specific demand
      this.http.get<any>(`${this.api}/recruiter/activity/${this.demandId}?recruiter_id=${this.recruiterId}`).subscribe({
        next: (response) => {
          if (response) {
            this.activity = response;
            // Set the CV list from the activity response
            this.cvList = response.cv_list || [];
            console.log('🔍 CV list from activity:', this.cvList);
            this.loadDemandDetails();
            
            // If activity_status is 'open', show a message that process needs to be started
            if (response.activity_status === 'open') {
              this.error = 'This demand is not yet in processing. Please start the process from the demands table.';
            }
          } else {
            this.error = 'No active activity found for this demand';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading activity:', error);
          this.error = 'Failed to load activity';
          this.loading = false;
        }
      });
    } else {
      // In view mode, load demand details directly
      this.loadDemandDetails();
    }
  }

  loadDemandDetails(): void {
    const demandId = this.activity?.demand_id || this.demandId;
    if (!demandId) return;

    this.http.get<any>(`${this.api}/recruiter/${this.recruiterId}/demand/${demandId}`).subscribe({
      next: (response) => {
        this.demand = response || {} as any;
        // Normalize JD URL field for template helpers
        const obUrl = (this.demand as any)?.ob_description_url;
        if (this.demand && !this.demand.job_description_url && obUrl) {
          (this.demand as any).job_description_url = obUrl;
        }
        // In view mode, set activity data from demand
        if (this.mode === 'view' && !this.activity) {
          this.activity = {
            id: 0,
            recruiter_id: this.recruiterId,
            demand_id: demandId,
            activity_status: 'view',
            opened_at: new Date().toISOString(),
            cv_list: [],
            job_description: response.job_description,
            job_description_url: response.ob_description_url || response.job_description_url
          };
        }
        // Load AI questions for both view and process modes
        this.loadAIQuestions();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading demand details:', error);
        this.error = 'Failed to load demand details';
        this.loading = false;
      }
    });
  }

  loadAIQuestions(): void {
    const demandId = this.activity?.demand_id || this.demandId;
    if (!this.recruiterId || !demandId) return;
    this.http.get<any>(`${this.api}/recruiter/${this.recruiterId}/activity/ai-questions?demand_id=${demandId}`).subscribe({
      next: (response) => {
        this.aiQuestions = response.questions || [];
      },
      error: (error) => {
        console.error('Error loading AI questions:', error);
        // Don't show error toast for view mode, just log it
        if (this.mode === 'process') {
          this.toastService.error('Failed to load AI questions. Please try again.');
        }
      }
    });
  }


  loadCVFolder(): void {
    if (!this.recruiterId || !this.demandId) return;
    this.refreshResumeList();
  }

  refreshCVList(): void {
    if (!this.activity) return;
    
    this.cvLoading = true;
    this.loadActivity(); // This will reload the activity and CV list
    this.cvLoading = false;
  }

  refreshAIQuestions(): void {
    const demandId = this.activity?.demand_id || this.demandId;
    if (!this.recruiterId || !demandId) return;
    
    this.aiLoading = true;
    this.http.get<any>(`${this.api}/recruiter/${this.recruiterId}/activity/ai-questions?demand_id=${demandId}`).subscribe({
      next: (response) => {
        this.aiQuestions = response.questions || [];
        this.aiLoading = false;
        this.toastService.success('AI questions generated successfully');
      },
      error: (error) => {
        console.error('Error generating AI questions:', error);
        this.toastService.error('Failed to generate AI questions. Please try again.');
        this.aiLoading = false;
      }
    });
  }

  getDemandFolderPath(): string {
    if (!this.cvFolderPath || this.cvFolderPath.trim() === '') {
      return 'Default Downloads folder';
    }
    return `${this.cvFolderPath}/demand/${this.recruiterId}/${this.demandId}/`;
  }

  openResumeViewModal(cv: CVEntry): void {
    console.log('🔍 openResumeViewModal called with CV:', cv);
    console.log('🔍 Current showResumeViewModal state:', this.showResumeViewModal);
    
    this.selectedResume = cv;
    this.resumeForm.patchValue({
      candidate_name: cv.candidate_name || '',
      phone: cv.phone || '',
      email: cv.email || '',
      remarks: cv.remarks || '',
      cv_path: cv.cv_path || cv.file_path || '',
      status: cv.status || 'underverification'
    });
    
    // Re-fetch latest counts before opening modal
    this.reFetchLatestCounts();
    
    // Check if quota is exceeded
    this.checkQuotaInModal();
    
    console.log('🔍 Setting showResumeViewModal to true');
    this.showResumeViewModal = true;
    this.disableBodyScroll();
    console.log('🔍 showResumeViewModal is now:', this.showResumeViewModal);
    
    // Check if modal element exists in DOM
    setTimeout(() => {
      const modalElement = document.querySelector('.modal-overlay');
      console.log('🔍 Modal element in DOM:', modalElement);
      if (modalElement) {
        console.log('🔍 Modal element styles:', window.getComputedStyle(modalElement));
        console.log('🔍 Modal element display:', window.getComputedStyle(modalElement).display);
        console.log('🔍 Modal element visibility:', window.getComputedStyle(modalElement).visibility);
        console.log('🔍 Modal element z-index:', window.getComputedStyle(modalElement).zIndex);
      } else {
        console.log('❌ Modal element not found in DOM');
      }
    }, 100);
    // Render the document based on file type
    const name = (cv as any).file_name || '';
    if (this.isPdf(name)) {
      setTimeout(() => this.renderPdf(cv), 50);
    } else if (this.isDocx(name)) {
      setTimeout(() => this.renderDocx(cv), 50);
    } else {
      // Fallback attempt: try docx renderer, else open in new tab
      setTimeout(async () => {
        try { await this.renderDocx(cv); } catch { this.openFileInNewTab(cv); }
      }, 50);
    }
    // Focus first input for better cursor behavior
    setTimeout(() => {
      const el = document.querySelector('.candidate-form input.form-input') as HTMLInputElement | null;
      el?.focus();
    }, 0);
  }

  // Map backend status to display and class
  displayStatus(status: string | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'submitted') return 'Submitted';
    if (s === 'hold' || s === 'on_hold') return 'Hold';
    if (s === 'rejected' || s === 'discard') return 'Discard';
    return '';
  }

  statusClass(status: string | undefined): string {
    const s = (status || '').toLowerCase();
    if (s === 'submitted') return 'pill-submitted';
    if (s === 'hold' || s === 'on_hold') return 'pill-hold';
    if (s === 'rejected' || s === 'discard') return 'pill-discard';
    return '';
  }

  triggerFilePicker(): void {
    // Check quota before allowing file selection
    if (this.checkQuotaBeforeUpload()) {
      return;
    }
    (this.fileInput?.nativeElement as HTMLInputElement)?.click();
  }

  // Enhanced method to check quota before file upload
  checkQuotaBeforeUpload(): boolean {
    if (this.mockMode) return false;
    
    const uploadedCount = this.activity?.uploaded_cv_count || 0;
    const requiredCount = this.activity?.required_cv_count || 0;
    
    if (uploadedCount >= requiredCount && requiredCount > 0) {
      this.showQuotaExceededPopup();
      return true;
    }
    return false;
  }

  // Check quota before submission with backend validation
  checkQuotaBeforeSubmissionWithBackend(): void {
    if (!this.activity) {
      console.log('❌ No activity found');
      return;
    }

    // Use demandId from component if activity.demand_id is not available
    const demandId = this.activity.demand_id || this.demandId;
    
    if (!demandId) {
      console.log('❌ No demand_id found in activity or component');
      return;
    }

    const payload = {
      demand_id: demandId,
      recruiter_id: this.recruiterId
    };

    this.http.post<any>(`${this.api}/recruiter/check-quota-and-update-status`, payload, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).subscribe({
      next: (response) => {
        if (response && response.success) {
          if (response.quota_met) {
            // Show quota exceeded popup and redirect
            this.showQuotaExceededPopup();
          } else {
            // Allow submission to proceed with form data
            const formData = this.resumeForm.value;
            this.proceedWithSubmission(formData);
          }
        } else {
          console.warn('Failed to check quota:', response?.message);
          // Proceed anyway if check fails
          const formData = this.resumeForm.value;
          this.proceedWithSubmission(formData);
        }
      },
      error: (error) => {
        console.error('Error checking quota:', error);
        // Proceed anyway if check fails
        const formData = this.resumeForm.value;
        this.proceedWithSubmission(formData);
      }
    });
  }

  proceedWithSubmission(formData?: any): void {
    // This method will be called when quota check passes
    if (formData) {
      this.proceedWithResumeSubmission(formData);
    } else {
      console.log('Proceeding with submission - quota check passed');
    }
  }

  proceedWithResumeSubmission(formData: any): void {
    const statusTitle = (formData.status === 'submitted') ? 'Submitted' : (formData.status === 'hold') ? 'Hold' : (formData.status === 'discard') ? 'Discard' : '';
    const payload = {
      candidate_name: formData.candidate_name,
      email: formData.email,
      phone: formData.phone,
      remarks: formData.remarks,
      status: statusTitle
    };
    const id = (this.selectedResume as any).id;
    const selectedFileName = (this.selectedResume as any).file_name;
    
    this.http.put<any>(`${this.api}/recruiter/update_resume_status/${id}`, payload, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' })
    }).subscribe({
      next: (resp) => {
        if (resp && resp.success) {
          // Immediately update local cvList to remove submitted resume from view
          if (formData.status === 'submitted' || formData.status === 'discard') {
            this.cvList = (this.cvList || []).filter((cv: any) => {
              // Remove by matching ID or filename
              return cv.id !== id && cv.file_name !== selectedFileName;
            });
          } else {
            // For 'hold' status, update the status in the list
            const cvIndex = this.cvList.findIndex((cv: any) => cv.id === id || cv.file_name === selectedFileName);
            if (cvIndex !== -1) {
              this.cvList[cvIndex] = { ...this.cvList[cvIndex], status: 'hold' };
              this.cvList = [...this.cvList]; // Trigger change detection
            }
          }
          
          this.toastService.success('Resume details saved successfully');
          this.closeResumeViewModal();
          
          // Refresh from backend after a short delay to ensure DB is updated
          setTimeout(() => {
            this.refreshResumeList();
          }, 300);
          
          // Update CV count and check for auto-close
          // Increment only when status selected is 'submitted'
          const shouldIncrement = (formData.status === 'submitted');
          this.updateCVCountAndCheck(shouldIncrement ? 1 : 0);
        } else {
          const msg = (resp && resp.message) ? resp.message : 'Failed to save CV details.';
          this.toastService.error(msg);
        }
      },
      error: (error) => {
        console.error('Error saving resume details:', error);
        const msg = error?.error?.message || 'Failed to save CV details. Please try again.';
        this.toastService.error(msg);
      }
    });
  }

  isUploadDisabled(): boolean {
    // Only disable upload when activity_status is 'closed'
    if (!this.activity) return false;
    
    return this.activity.activity_status === 'closed';
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    console.log('Selected files:', files.length);
    
    if (this.mockMode) {
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        const item = {
          id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now()),
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          status: '',
          url
        };
        this.mockResumes = [item, ...this.mockResumes];
      });
      this.saveMockResumes();
      this.toastService.success(`${files.length} resume(s) uploaded`);
      input.value = '';
      return;
    }
    
    // Upload all files
    this.uploadMultipleFiles(files);
    input.value = '';
  }

  uploadMultipleFiles(files: File[]): void {
    // Check quota before allowing upload
    if (this.checkQuotaBeforeUpload()) {
      return;
    }

    this.cvLoading = true;
    let uploadCount = 0;
    const totalFiles = files.length;
    
    files.forEach((file, index) => {
      const form = new FormData();
      form.append('file', file);
      
      this.http.post<any>(`${this.api}/recruiter/upload_resume/${this.recruiterId}/${this.demandId}`, form).subscribe({
        next: () => {
          uploadCount++;
          console.log(`Uploaded ${uploadCount}/${totalFiles}: ${file.name}`);
          
          if (uploadCount === totalFiles) {
            this.toastService.success(`✅ Profile uploaded successfully! (${totalFiles} file${totalFiles > 1 ? 's' : ''})`);
            
            // Auto-refresh the activity data to get latest counts and CV submissions
            this.refreshActivityData();
            this.cvLoading = false;
            
            // Check for auto-close after all uploads complete
            this.checkAndAutoCloseActivity();
          }
        },
        error: (error) => {
          console.error(`Upload failed for ${file.name}:`, error);
          uploadCount++;
          
          if (uploadCount === totalFiles) {
            this.toastService.error('Some uploads failed. Please check and retry.');
            this.refreshResumeList();
            this.cvLoading = false;
          }
        }
      });
    });
  }

  refreshActivityData(): void {
    // Refresh the activity data to get latest counts and status
    this.http.get<any>(`${this.api}/recruiter/activity/${this.recruiterId}/${this.demandId}`).subscribe({
      next: (activity) => {
        this.activity = activity;
        this.refreshResumeList();
        // Also refresh CV submissions to show newly uploaded CVs immediately
        this.refreshCvSubmissions();
        console.log('Activity data refreshed:', activity);
      },
      error: (error) => {
        console.error('Error refreshing activity data:', error);
      }
    });
  }

  checkAndAutoCloseActivity(): void {
    if (!this.activity) return;
    
    // Get updated activity data to check counts
    this.http.get<any>(`${this.api}/recruiter/activity/${this.recruiterId}/${this.demandId}`).subscribe({
      next: (activity) => {
        if (activity && activity.required_cv_count && activity.uploaded_cv_count) {
          console.log(`Checking auto-close: required=${activity.required_cv_count}, uploaded=${activity.uploaded_cv_count}, status=${activity.activity_status}`);
          
          // Only auto-close if:
          // 1. Counts match exactly
          // 2. Activity is in 'processing' status (not already closed)
          // 3. Activity ID exists
          if (activity.required_cv_count === activity.uploaded_cv_count 
              && activity.id 
              && activity.activity_status === 'processing'
              && activity.activity_status !== 'closed') {
            console.log('Auto-closing activity - counts match and status is processing');
            
            // Auto-close the activity
            this.http.post<any>(`${this.api}/recruiter/close-activity-complete`, {
              activity_id: activity.id,
              recruiter_id: this.recruiterId,
              demand_id: this.demandId
            }).subscribe({
              next: (response) => {
                // Check if the response indicates success
                if (response && response.success === true) {
                  this.toastService.success('✅ Activity closed successfully!');
                  
                  // Redirect only when activity is successfully closed
                  setTimeout(() => {
                    this.router.navigate(['/recruiter/demands']);
                  }, 1500); // Slightly longer delay to ensure toast is visible
                } else {
                  // CV count mismatch or other failure - don't redirect
                  const message = response?.message || 'Cannot close activity';
                  console.log('⚠️ Auto-close skipped:', message);
                  // Don't show error toast for count mismatch - it's expected behavior
                  if (response?.message && !response.message.includes('CV count mismatch')) {
                    this.toastService.error(message);
                  }
                }
              },
              error: (error) => {
                console.error('Error auto-closing activity:', error);
                // Don't show error if activity is already closed (404)
                if (error.status !== 404) {
                  this.toastService.error('Failed to auto-close activity');
                }
                // Don't redirect on error
              }
            });
          } else {
            console.log('Skipping auto-close:', {
              countsMatch: activity.required_cv_count === activity.uploaded_cv_count,
              hasId: !!activity.id,
              isProcessing: activity.activity_status === 'processing',
              isNotClosed: activity.activity_status !== 'closed'
            });
          }
        }
      },
      error: (error) => {
        // If activity doesn't exist (404), that's okay - just skip auto-close
        if (error.status === 404) {
          console.log('No activity found - skipping auto-close check');
        } else {
          console.error('Error checking activity status:', error);
        }
      }
    });
  }

  getAssetUrl(path: string | null | undefined): SafeResourceUrl {
    const p = String(path || '').trim().replace(/\\/g, '/');
    if (!p) return this.sanitizer.bypassSecurityTrustResourceUrl('');
    // Normalize to served assets
    let normalized = p;
    if (p.includes('/assets/')) {
      // Ensure it begins with a single leading slash to be served by Angular
      const idx = p.indexOf('/assets/');
      normalized = p.slice(idx);
    } else if (p.startsWith('src/assets/')) {
      normalized = '/' + p.replace(/^src\//, '');
    } else if (p.startsWith('assets/')) {
      normalized = '/' + p;
    }
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    const lower = normalized.toLowerCase();
    if (lower.endsWith('.pdf')) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(normalized);
    }
    // We avoid embedding DOCX with Office viewer in dev because it requires a publicly accessible URL.
    // The left panel shows an action to open in a new tab for DOCX files.
    return this.sanitizer.bypassSecurityTrustResourceUrl(normalized);
  }

  getFileApiUrl(cv: any): SafeResourceUrl {
    const name = String(cv.file_name || '').trim();
    // Avoid encoding slashes but safely encode the filename
    const safeName = encodeURIComponent(name);
    const url = `${this.api}/recruiter/file/${this.recruiterId}/${this.demandId}/${safeName}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // Keep one private builder for internal use
  private getFileApiUrlString(cv: any): string {
    const name = String(cv.file_name || '').trim();
    const safeName = encodeURIComponent(name);
    return `/recruiter/file/${this.recruiterId}/${this.demandId}/${safeName}`;
  }

  // Initialize PDF.js
  // Initialize PDF.js - temporarily disabled
  private async initializePdfJs(): Promise<void> {
    console.log('🔍 PDF.js initialization disabled');
  }

  // Render PDF using iframe
  private async renderPdf(cv: any): Promise<void> {
    try {
      this.pdfLoading = true;
      this.pdfError = false;
      
      const canvas = this.pdfCanvasRef?.nativeElement;
      if (!canvas) {
        console.error('PDF canvas element not found');
        this.pdfError = true;
        this.pdfLoading = false;
        return;
      }
      
      const fileUrl = this.api + this.getFileApiUrlString(cv);
      console.log('🔍 Loading PDF from:', fileUrl);
      
      // Use iframe to display PDF without native viewer controls
      const container = canvas.parentElement;
      if (container) {
        container.innerHTML = `<iframe src="${fileUrl}#toolbar=0&navpanes=0&scrollbar=1" allow="fullscreen" allowfullscreen style="width: 100%; height: 100%; border: none;"></iframe>`;
      }
      
      console.log('✅ PDF rendered successfully');
      this.pdfLoading = false;
    } catch (error) {
      console.error('Error rendering PDF:', error);
      this.pdfError = true;
      this.pdfLoading = false;
    }
  }

  // Render DOCX/DOC using docx-preview client-side library
  private async renderDocx(cv: any): Promise<void> {
    try {
      this.docxLoading = true;
      this.docxError = false;
      
      // Prefer the view-only host if present (view icon path)
      const host = (this.cvDocxHostRef?.nativeElement || this.docxHostRef?.nativeElement);
      if (!host) {
        console.error('Document host element not found');
        this.docxError = true;
        this.docxLoading = false;
        return;
      }
      
      const fileName = cv.file_name || '';
      const isOldDoc = fileName.toLowerCase().endsWith('.doc');
      const fileApiUrl = this.api + this.getFileApiUrlString(cv);
      
      console.log('🔍 Loading document from:', fileApiUrl);
      
      if (isOldDoc) {
        // .doc files can't be previewed by browsers
        this.docxLoading = false;
        this.docxError = true;
        return;
      }
      
      // Fetch the file for .docx
      const response = await fetch(fileApiUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      // Use docx-preview for .docx files
      const docx = await import('docx-preview');
      
      host.innerHTML = '';
      
      await docx.renderAsync(arrayBuffer, host, undefined, {
        inWrapper: true,
        ignoreWidth: true,
        ignoreHeight: false,
        className: 'docx'
      });
      
      // Add styling
      host.querySelectorAll('table').forEach((table: any) => {
        table.style.maxWidth = '100%';
        table.style.margin = '10px auto';
      });
      
      console.log('✅ Document rendered successfully');
      this.docxLoading = false;
    } catch (error) {
      console.error('Error rendering document:', error);
      this.docxError = true;
      this.docxLoading = false;
    }
  }

  // Wait for DOM element to be available
  private async waitForElement(selector: string, timeout: number = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        // Try multiple selectors for the same element
        const selectors = [
          selector,
          `[ng-reflect-ng-if="true"] ${selector}`,
          `.modal-overlay ${selector}`,
          `app-recruiter-activity ${selector}`
        ];
        
        let element: Element | null = null;
        for (const sel of selectors) {
          element = document.querySelector(sel);
          if (element) break;
        }
        
        if (element) {
          console.log(`✅ Found element with selector: ${selector}`);
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          console.error(`❌ Element ${selector} not found within ${timeout}ms`);
          console.log('Available elements in modal:', document.querySelectorAll('.modal-overlay *'));
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  }

  // Render fallback for unknown file types
  private async renderFallback(cv: any): Promise<void> {
    console.log('🔍 renderFallback called with CV:', cv);
    
    try {
      // Wait for DOM element to be available
      await this.waitForElement('#docxHost');
      const host = this.docxHostRef?.nativeElement;
      if (!host) {
        throw new Error('Host element not found');
      }
      
      host.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #6b7280;">
          <h3>File Preview Not Available</h3>
          <p>This file type cannot be previewed in the browser.</p>
          <button onclick="window.open('${this.getFileApiUrlString(cv)}', '_blank')" 
                  style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
            Open File
          </button>
        </div>
      `;
      
      console.log('✅ Fallback rendered successfully');
      
    } catch (e) {
      console.error('❌ Fallback rendering error:', e);
    }
  }

  mapNumericStatus(value: any): string {
    const num = Number(value);
    if (Number.isNaN(num)) return String(value || '').toString();
    if (num === 0) return 'Under Verification';
    if (num === 1) return 'Approved';
    if (num === 2) return 'Rejected';
    return String(value);
  }

  openInNewTab(path?: string | null): void {
    let url = String(path || '').replace(/\\/g, '/');
    if (url.includes('/assets/')) {
      url = url.slice(url.indexOf('/assets/'));
    } else if (url.startsWith('src/assets/')) {
      url = '/' + url.replace(/^src\//, '');
    } else if (!url.startsWith('/')) {
      url = '/' + url;
    }
    // Ensure absolute API URL so the Angular router doesn't intercept
    const absolute = url.startsWith('http') ? url : `${this.api}${url}`;
    window.open(absolute, '_blank');
  }

  // Explicit PDF check to simplify template conditions
  isPdf(path?: string | null): boolean {
    const p = String(path || '').toLowerCase();
    return p.endsWith('.pdf');
  }

  isDocx(path?: string | null): boolean {
    const p = String(path || '').toLowerCase();
    return p.endsWith('.docx') || p.endsWith('.doc');
  }

  // Open API-served file directly in a new tab
  openFileInNewTab(cv: any): void {
    window.open(`${this.api}${this.getFileApiUrlString(cv)}`, '_blank');
  }

  // View CV in popup modal
  viewCV(filePath: string): void {
    console.log('🔍 viewCV called with filePath:', filePath);
    this.openCVViewModal(filePath);
  }

  closeResumeViewModal(): void {
    this.showResumeViewModal = false;
    this.selectedResume = null;
    this.resumeForm.reset();
    this.quotaExceeded = false;
    this.enableBodyScroll();
  }

  // CV View Modal Methods
  openCVViewModal(filePath: string): void {
    // Extract filename from file path
    const fileName = filePath.split('/').pop() || '';
    const lower = fileName.toLowerCase();
    const cv: any = { file_name: fileName, file_path: filePath, status: '' };

    console.log('🔍 CV View Debug:', {
      originalFilePath: filePath,
      extractedFileName: fileName,
      recruiterId: this.recruiterId,
      demandId: this.demandId
    });

    // Show view-only modal
    this.showCVViewModal = true;
    this.disableBodyScroll();

    if (lower.endsWith('.pdf')) {
      // PDF via iframe
      this.cvViewUrl = this.getFileApiUrl(cv);
    } else if (lower.endsWith('.docx')) {
      // DOCX via docx-preview into host
      this.cvViewUrl = null;
      setTimeout(() => this.renderDocx(cv), 0);
    } else if (lower.endsWith('.doc')) {
      // .doc not supported → prompt to download
      this.cvViewUrl = null;
      this.docxError = true;
    } else {
      // Unknown type → try docx renderer
      this.cvViewUrl = null;
      setTimeout(() => this.renderDocx(cv), 0);
    }
  }

  closeCVViewModal(): void {
    this.showCVViewModal = false;
    this.cvViewUrl = null;
    this.enableBodyScroll();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.showCVViewModal) {
      this.closeCVViewModal();
    }
  }

  onIframeError(event: any): void {
    console.error('❌ Iframe failed to load CV file:', event);
    this.toastService.error('Failed to load CV file. Please check if the file exists.');
  }

  downloadResume(): void {
    if (!this.selectedResume) return;
    
    // Open the file in a new tab for download
    const downloadUrl = `${this.api}${this.getFileApiUrlString(this.selectedResume)}`;
    window.open(downloadUrl, '_blank');
  }

  saveResumeDetails(): void {
    if (!this.resumeForm.valid || !this.selectedResume) return;

    const formData = this.resumeForm.value;
    if (this.mockMode) {
      const targetName = (this.selectedResume as any).file_name || (this.selectedResume as any).filename;
      this.mockResumes = this.mockResumes.map(r => r.fileName === targetName ? {
        ...r,
        status: formData.status,
        candidate: { name: formData.candidate_name, email: formData.email, phone: formData.phone }
      } : r);
      this.saveMockResumes();
      this.toastService.success('Resume details saved');
      this.closeResumeViewModal();
      return;
    }

    // Check quota before submission if status is 'submitted'
    if (formData.status === 'submitted') {
      this.checkQuotaBeforeSubmissionWithBackend();
    } else {
      this.proceedWithSubmission(formData);
    }
  }

  // Re-fetch latest counts before any action
  reFetchLatestCounts(): void {
    if (!this.activity) return;

    this.http.get<any>(`${this.api}/recruiter/activity/${this.demandId}?recruiter_id=${this.recruiterId}`).subscribe({
      next: (response) => {
        if (response && this.activity) {
          this.activity.uploaded_cv_count = response.uploaded_cv_count || 0;
          this.activity.required_cv_count = response.required_cv_count || 0;
          this.activity.activity_status = response.activity_status;
        }
      },
      error: (error) => {
        console.error('Error fetching latest counts:', error);
      }
    });
  }

  // Check quota inside modal
  checkQuotaInModal(): void {
    if (!this.activity) return;
    
    const uploadedCount = this.activity.uploaded_cv_count || 0;
    const requiredCount = this.activity.required_cv_count || 0;
    
    this.quotaExceeded = uploadedCount >= requiredCount && requiredCount > 0;
  }

  // Handle quota exceeded in modal
  handleQuotaExceeded(): void {
    if (!this.activity) return;
    
    // Update activity_status to 'closed' in database
    const payload = {
      demand_id: this.demandId,
      recruiter_id: this.recruiterId
    };
    
    this.http.post<any>(`${this.api}/recruiter/check-quota-and-update-status`, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          // Close modal and redirect
          this.closeResumeViewModal();
          window.location.href = '/recruiter/demands';
        }
      },
      error: (error) => {
        console.error('Error updating activity status:', error);
        // Still close modal and redirect even if update fails
        this.closeResumeViewModal();
        window.location.href = '/recruiter/demands';
      }
    });
  }

  checkQuotaBeforeSubmission(callback: () => void): void {
    if (!this.activity) return;

    const payload = {
      demand_id: this.demandId,
      recruiter_id: this.recruiterId
    };

    this.http.post<any>(`${this.api}/recruiter/check-quota-and-update-status`, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          if (response.quota_met) {
            // Show quota exceeded popup
            this.showQuotaExceededPopup();
          } else {
            // Proceed with submission
            callback();
          }
        } else {
          console.warn('Failed to check quota:', response?.message);
          // Proceed anyway if check fails
          callback();
        }
      },
      error: (error) => {
        console.error('Error checking quota:', error);
        // Proceed anyway if check fails
        callback();
      }
    });
  }


  // Lightweight refresh of activity cv_list without blocking the page
  refreshCvSubmissions(): void {
    if (!this.recruiterId || !this.demandId) return;
    this.submissionsLoading = true;
    this.http.get<any>(`${this.api}/recruiter/activity/${this.demandId}?recruiter_id=${this.recruiterId}`).subscribe({
      next: (response) => {
        if (response) {
          // Preserve demand and other state, replace activity content
          this.activity = {
            ...(this.activity as any),
            ...response
          } as any;
        }
        this.submissionsLoading = false;
      },
      error: () => {
        this.submissionsLoading = false;
      }
    });
  }

  refreshResumeList(): void {
    if (this.mockMode) {
      this.loadMockResumes();
      return;
    }
    this.http.get<any>(`${this.api}/recruiter/resumes/${this.recruiterId}/${this.demandId}`).subscribe({
      next: (resp) => {
        const rows = resp?.items || [];
        this.cvList = rows.map((r: any) => ({
          id: r.id,
          file_name: r.filename,
          detected_at: r.created_at,
          file_path: r.file_path,
          status: r.status || '',
          candidate_name: r.candidate_details?.candidate_name,
          email: r.candidate_details?.email,
          phone: r.candidate_details?.phone
        } as any));
      },
      error: () => {
        this.cvList = [];
      }
    });
  }

  getPendingResumes(): CVEntry[] {
    if (this.mockMode) {
      return this.mockResumes
        .filter(r => !r.status)
        .map(r => ({ file_name: r.fileName, detected_at: r.uploadedAt, file_path: r.url, status: '' } as any));
    }
    return (this.cvList || []).filter((cv: any) => !cv.status || cv.status === '' || cv.status === null);
  }

  // Show only records where status is null/empty or 'hold' (from tbl_cv_downloads)
  // Exclude resumes with 'submitted', 'discard', or any other status
  filteredCvList(): CVEntry[] {
    const list = this.cvList || [];
    return list.filter((cv: any) => {
      // Handle null, undefined, or empty status - these should be shown
      if (!cv?.status || cv.status === null || cv.status === undefined || cv.status === '') {
        return true;
      }
      
      // Convert to string and normalize for comparison
      const s = String(cv.status).trim().toLowerCase();
      
      // Explicitly exclude 'submitted', 'discard', and numeric status '1' (submitted)
      const excludedStatuses = ['submitted', 'discard', '1'];
      if (excludedStatuses.includes(s)) {
        return false;
      }
      
      // Only show if status is 'hold' or 'on_hold'
      const allowedStatuses = ['hold', 'on_hold'];
      return allowedStatuses.includes(s);
    });
  }

  private getMockKey(): string {
    return `mock-resumes:${this.recruiterId}:${this.demandId}`;
  }

  private loadMockResumes(): void {
    try {
      const raw = localStorage.getItem(this.getMockKey());
      this.mockResumes = raw ? JSON.parse(raw) : [];
    } catch {
      this.mockResumes = [];
    }
  }

  private saveMockResumes(): void {
    localStorage.setItem(this.getMockKey(), JSON.stringify(this.mockResumes));
  }

  startAutoRefresh(): void {
    // Start automatic refresh every 5 seconds when in process mode
    if (this.mode === 'process' && !this.refreshInterval) {
      this.refreshInterval = window.setInterval(() => {
        this.refreshResumeList();
      }, 5000);
    }
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  async promptMoveExistingResumes(oldRecruiterId: number): Promise<boolean> {
    const confirmed = confirm(
      `Move existing resumes from old recruiter folder to new recruiter folder?\n\n` +
      `This will move all PDF/DOCX files from the previous recruiter's demand folder to the current recruiter's folder.`
    );
    
    if (confirmed) {
      try {
        const response = await this.dataService.moveExistingResumes(
          this.recruiterId, 
          this.demandId
        ).toPromise() as any;
        
        this.toastService.show(
          `Moved ${response.moved_files?.length || 0} resume files successfully`, 
          'success'
        );
        
        // Refresh the resume list to show moved files
        this.refreshResumeList();
        return true;
      } catch (error) {
        console.error('Error moving resumes:', error);
        this.toastService.show('Failed to move existing resumes', 'error');
        return false;
      }
    }
    
    return false;
  }

  closeActivity(): void {
    if (!this.activity) return;

    this.http.post<any>(`${this.api}/recruiter/${this.recruiterId}/demand/${this.demandId}/close`, {}).subscribe({
      next: (response) => {
        this.toastService.success('Activity closed successfully');
        this.goBack();
      },
      error: (error) => {
        console.error('Error closing activity:', error);
        this.toastService.error('Failed to close activity');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/recruiter/demands']);
  }

  // Drag functionality methods
  onModalMouseDown(event: MouseEvent): void {
    if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('draggable-header')) {
      this.isDragging = true;
      this.dragOffset = {
        x: event.clientX - this.modalPosition.x,
        y: event.clientY - this.modalPosition.y
      };
      event.preventDefault();
    }
  }

  onModalMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      this.modalPosition = {
        x: event.clientX - this.dragOffset.x,
        y: event.clientY - this.dragOffset.y
      };
    }
  }

  onModalMouseUp(): void {
    this.isDragging = false;
  }

  getModalStyle(): any {
    if (this.isDragging || (this.modalPosition.x !== 0 || this.modalPosition.y !== 0)) {
      return {
        transform: `translate(${this.modalPosition.x}px, ${this.modalPosition.y}px)`,
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        margin: '0'
      };
    }
    return {
      transform: 'translate(-50%, -50%)',
      position: 'fixed' as const,
      top: '50%',
      left: '50%',
      margin: '0'
    };
  }

  checkAndCloseActivityIfComplete(): void {
    if (!this.activity) return;

    // Check if uploaded CV count equals required CV count
    const uploadedCount = this.activity.uploaded_cv_count || 0;
    const requiredCount = this.activity.required_cv_count || 0;

    console.log('🔍 Auto-close check:', {
      uploadedCount,
      requiredCount,
      activity: this.activity
    });

    if (uploadedCount >= requiredCount && requiredCount > 0) {
      console.log('✅ Triggering auto-close - required CV count reached');
      // Close the activity and demand
      this.closeActivityAndDemand();
    } else {
      console.log('❌ Auto-close not triggered:', {
        reason: uploadedCount < requiredCount ? 'Not enough CVs' : 'No required count set',
        uploadedCount,
        requiredCount
      });
      
      // Also try to check with backend for more accurate count
      this.checkCVCountWithBackend();
    }
  }

  checkCVCountWithBackend(): void {
    if (!this.activity) return;
    
    // Get fresh activity data from backend
    this.http.get<any>(`${this.api}/recruiter/activity/${this.demandId}?recruiter_id=${this.recruiterId}`).subscribe({
      next: (response) => {
        if (response) {
          const freshUploadedCount = response.uploaded_cv_count || 0;
          const freshRequiredCount = response.required_cv_count || 0;
          
          console.log('🔍 Backend CV count check:', {
            freshUploadedCount,
            freshRequiredCount
          });
          
          if (freshUploadedCount >= freshRequiredCount && freshRequiredCount > 0) {
            console.log('✅ Backend check: Triggering auto-close');
            this.closeActivityAndDemand();
          }
        }
      },
      error: (error) => {
        console.error('Error checking CV count with backend:', error);
      }
    });
  }

  updateCVCountAndCheck(increment: number = 0): void {
    if (!this.activity) return;

    // Only update count if there are actually submitted CVs
    // The backend will recalculate the count based on cv_list status
    const payload = {
      demand_id: this.demandId,
      recruiter_id: this.recruiterId,
      increment: increment
    };

    console.log('🔄 Calling update-cv-count-and-check with payload:', payload);

    this.http.post<any>(`${this.api}/recruiter/update-cv-count-and-check`, payload).subscribe({
      next: (response) => {
        console.log('✅ update-cv-count-and-check response:', response);
        if (response && response.success) {
          if (response.closed) {
            // Show success toast for completion
            this.toastService.success('✅ All required profiles submitted successfully.');
            
            // Show popup message for demand closure and navigate to demands page
            this.showDemandClosedPopup();
            
            // Update local activity status
            if (this.activity) {
              this.activity.activity_status = 'closed';
              this.activity.uploaded_cv_count = response.uploaded_count;
            }
          } else {
            // Show success toast for partial submission
            this.toastService.success('✅ Profile submitted successfully.');
            // Just refresh the activity data
            this.loadActivity();
          }
        } else {
          console.warn('Failed to update CV count:', response?.message);
        }
      },
      error: (error) => {
        console.error('❌ Error updating CV count:', error);
        console.error('Error details:', error.error);
        console.error('Error status:', error.status);
        // Don't show error to user as this is automatic
      }
    });
  }

  showQuotaExceededPopup(): void {
    // Create and show quota exceeded popup
    const popup = document.createElement('div');
    popup.className = 'quota-exceeded-popup';
    popup.innerHTML = `
      <div class="popup-overlay">
        <div class="popup-content">
          <div class="popup-header">
            <h3>⚠️ All Required Profiles Submitted</h3>
          </div>
          <div class="popup-body">
            <p>All required profiles have already been submitted for this demand.</p>
            <p>The activity has been automatically closed.</p>
          </div>
          <div class="popup-footer">
            <button class="btn btn-primary" onclick="this.closest('.quota-exceeded-popup').remove(); window.location.href='/recruiter/demands';">OK</button>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .quota-exceeded-popup {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      .quota-exceeded-popup .popup-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .quota-exceeded-popup .popup-content {
        background: white;
        border-radius: 8px;
        box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        width: 90%;
      }
      .quota-exceeded-popup .popup-header {
        padding: 20px 24px 0;
        text-align: center;
      }
      .quota-exceeded-popup .popup-header h3 {
        margin: 0;
        color: #dc2626;
        font-size: 18px;
        font-weight: 600;
      }
      .quota-exceeded-popup .popup-body {
        padding: 16px 24px;
        text-align: center;
      }
      .quota-exceeded-popup .popup-body p {
        margin: 0;
        color: #374151;
        font-size: 14px;
        line-height: 1.5;
      }
      .quota-exceeded-popup .popup-footer {
        padding: 0 24px 20px;
        text-align: center;
      }
      .quota-exceeded-popup .btn {
        padding: 12px 24px !important;
        border: none !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        min-width: 80px !important;
        transition: all 0.2s ease !important;
      }
      .quota-exceeded-popup .btn-primary {
        background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%) !important;
        color: white !important;
        box-shadow: 0 2px 4px rgba(24, 45, 23, 0.3) !important;
        font-family: "Manrope", "Manrope Placeholder", sans-serif !important;
      }
      .quota-exceeded-popup .btn-primary:hover {
        background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%) !important;
        box-shadow: 0 4px 8px rgba(24, 45, 23, 0.4) !important;
        transform: translateY(-1px) !important;
      }
      .quota-exceeded-popup .btn-primary:active {
        background: #1d4ed8 !important;
        transform: translateY(0) !important;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(popup);
    
    // Auto-remove after 10 seconds if not manually closed
    setTimeout(() => {
      if (document.body.contains(popup)) {
        popup.remove();
        window.location.href = '/recruiter/demands';
      }
    }, 10000);
  }

  showDemandClosedPopup(): void {
    // Create and show popup message
    const popup = document.createElement('div');
    popup.className = 'demand-closed-popup';
    popup.innerHTML = `
      <div class="popup-overlay">
        <div class="popup-content">
          <div class="popup-header">
            <h3>✅ Demand Completed</h3>
          </div>
          <div class="popup-body">
            <p>All required profiles have been submitted successfully.</p>
            <p>The demand is now closed and you will be redirected to the demands page.</p>
          </div>
          <div class="popup-footer">
            <button class="btn btn-primary" onclick="this.closest('.demand-closed-popup').remove(); window.location.href='/recruiter/demands';">OK</button>
          </div>
        </div>
      </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .demand-closed-popup {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
      }
      .popup-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .popup-content {
        background: white;
        border-radius: 8px;
        box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        width: 90%;
      }
      .popup-header {
        padding: 20px 20px 0;
        border-bottom: 1px solid #e5e7eb;
      }
      .popup-header h3 {
        margin: 0;
        color: #1f2937;
        font-size: 18px;
        font-weight: 600;
      }
      .popup-body {
        padding: 20px;
      }
      .popup-body p {
        margin: 0;
        color: #374151;
        font-size: 16px;
      }
      .popup-footer {
        padding: 0 20px 20px;
        display: flex;
        justify-content: flex-end;
      }
      .popup-footer .btn {
        padding: 12px 24px !important;
        border: none !important;
        border-radius: 8px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        font-family: "Manrope", "Manrope Placeholder", sans-serif !important;
        min-width: 80px !important;
        transition: all 0.2s ease !important;
        background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%) !important;
        color: white !important;
        box-shadow: 0 2px 4px rgba(24, 45, 23, 0.3) !important;
      }
      .popup-footer .btn:hover {
        background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%) !important;
        box-shadow: 0 4px 8px rgba(24, 45, 23, 0.4) !important;
        transform: translateY(-1px) !important;
      }
      .popup-footer .btn:active {
        background: #1d4ed8 !important;
        transform: translateY(0) !important;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(popup);
  }

  closeActivityAndDemand(): void {
    if (!this.activity) return;

    const payload = {
      activity_id: this.activity.id,
      demand_id: this.demandId,
      recruiter_id: this.recruiterId
    };

    this.http.post<any>(`${this.api}/recruiter/close-activity-complete`, payload).subscribe({
      next: (response) => {
        if (response && response.success) {
          this.toastService.success('Activity and demand closed automatically - required CV count reached!');
          // Update local activity status
          if (this.activity) {
            this.activity.activity_status = 'closed';
          }
          // Refresh the activity data
          this.loadActivity();
        } else {
          console.warn('Failed to auto-close activity:', response?.message);
        }
      },
      error: (error) => {
        console.error('Error auto-closing activity:', error);
        // Don't show error to user as this is automatic
      }
    });
  }
}