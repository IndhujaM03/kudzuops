import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../environments/environment';

interface AssignedDemand {
  id: number;
  client_id: number;
  client_name: string;
  job_title: string;
  demand_name: string;
  skill: string;
  no_of_positions: number;
  priority: string;
  status: string;
  activity_status?: string;
  updated_at: string;
  assigned_to: any[];
}

interface DemandDetail {
  id: number;
  job_title: string;
  job_description: string;
  job_description_url: string;
  client_name: string;
  spoc_name: string;
  spoc_email: string;
  spoc_phone: string;
  skill: string;
  no_of_positions: number;
  priority: string;
  status: string;
  experience_level: string;
  location: string;
  salary_range: string;
  start_date: string;
  end_date: string;
  requirements: string;
  remarks: string;
  created_at: string;
  assigned_to: any[];
}

interface CVFile {
  id: number;
  filename: string;
  file_path: string;
  uploaded_at: string;
  is_processed: boolean;
}

interface AIQuestion {
  id: number;
  question: string;
  difficulty: string;
  category: string;
}

interface ViewDrawer {
  show: boolean;
  demand: DemandDetail | null;
  activeTab: 'jd' | 'questions' | 'upload' | 'cvs';
  questions: AIQuestion[];
  cvs: CVFile[];
  isProcessing: boolean;
  selectedCVs: number[];
}

@Component({
  selector: 'app-demand-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="demand-management-container">
      <!-- Header -->
      <div class="header">
        <div class="header-stats">
          <div class="stat-item">
            <span class="stat-label">Total Assigned:</span>
            <span class="stat-value">{{ demands.length }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Processing:</span>
            <span class="stat-value">{{ processingCount }}</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <input 
            type="text" 
            placeholder="Search demands..." 
            class="search-input"
            [(ngModel)]="searchTerm"
            (input)="applyFilters()"
          >
        </div>
        <div class="filter-group">
          <select class="filter-select" [(ngModel)]="selectedPriority" (change)="applyFilters()">
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div class="filter-group">
          <select class="filter-select" [(ngModel)]="selectedStatus" (change)="applyFilters()">
            <option value="">All Statuses</option>
            <option value="assigned">Assigned</option>
            <option value="processing">Processing</option>
            <option value="hold">Hold</option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading demands...</p>
      </div>

      <!-- Demands Table -->
      <div class="table-container" *ngIf="!loading">
        <div class="table-wrapper">
        <table class="demands-table">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Client</th>
              <th>Role</th>
              <th>Positions</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let demand of filteredDemands; let i = index" class="demand-row">
              <td class="serial-number">{{ (currentPage - 1) * pageSize + i + 1 }}</td>
              <td>{{ demand.client_name }}</td>
              <td class="job-title">{{ demand.job_title || demand.skill || ('Demand #' + demand.id) }}</td>
              <td>{{ demand.no_of_positions }}</td>
              <td>
                <span class="priority-badge" [class]="'priority-' + demand.priority">
                  {{ demand.priority | titlecase }}
                </span>
              </td>
              <td>
                <span class="status-badge" [class]="'status-' + (demand.activity_status || 'open')">
                  {{ (demand.activity_status || 'open') | titlecase }}
                </span>
              </td>
              <td>{{ demand.updated_at | date:'short' }}</td>
              <td class="actions">
                <div class="action-menu" [class.active]="activeMenuId === demand.id">
                  <button 
                    class="action-trigger" 
                    (click)="toggleActionMenu(demand.id); $event.stopPropagation()"
                    [class.active]="activeMenuId === demand.id"
                    title="Actions"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="icon">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  <div class="action-dropdown" *ngIf="activeMenuId === demand.id" (click)="$event.stopPropagation()">
                    
                    
                    <!-- Start Process: Only if status = 'open' -->
                    <button 
                      class="action-item" 
                      (click)="activeMenuId=null; startProcess(demand)"
                      *ngIf="demand.activity_status === 'open'"
                    >
                      <svg class="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start Process
                    </button>
                    
                    <!-- Process: Only visible if status = 'processing' -->
                    <button 
                      class="action-item" 
                      (click)="activeMenuId=null; navigateToRecruiterActivity(demand)"
                      *ngIf="demand.activity_status === 'processing'"
                    >
                      <svg class="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Process
                    </button>
                    
                    <!-- Hold: Only if status = 'processing' -->
                    <button 
                      class="action-item" 
                      (click)="activeMenuId=null; holdProcess(demand)"
                      *ngIf="demand.activity_status === 'processing'"
                    >
                      <svg class="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Hold
                    </button>
                    
                    <!-- Resume: Only if status = 'hold' -->
                    <button 
                      class="action-item" 
                      (click)="activeMenuId=null; resumeProcess(demand)"
                      *ngIf="demand.activity_status === 'hold'"
                    >
                      <svg class="action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Resume
                    </button>
                    
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalPages > 1">
        <div class="pagination-info">
          <span class="pagination-text">
            Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, totalItems) }} of {{ totalItems }} demands
          </span>
        </div>
        <div class="pagination-controls">
          <button 
            class="page-btn" 
            [disabled]="currentPage === 1"
            (click)="goToPage(currentPage - 1)"
          >
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          <span class="page-info">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button 
            class="page-btn" 
            [disabled]="currentPage === totalPages"
            (click)="goToPage(currentPage + 1)"
          >
            Next
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="filteredDemands.length === 0">
        <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3>No demands found</h3>
        <p>You don't have any assigned demands matching your current filters.</p>
      </div>
    </div>

    <!-- View Drawer -->
    <div class="drawer-overlay" *ngIf="viewDrawer.show" (click)="closeViewDrawer()">
      <div class="drawer" (click)="$event.stopPropagation()">
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div class="drawer-title">
            <button class="back-btn" (click)="closeViewDrawer()">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Demands
            </button>
            <div class="title-info">
              <h3>{{ viewDrawer.demand?.job_title }}</h3>
              <span class="client-name">{{ viewDrawer.demand?.client_name }}</span>
            </div>
          </div>
          <div class="drawer-actions">
            <span class="processing-badge" *ngIf="viewDrawer.isProcessing">Processing</span>
            <button class="close-btn" (click)="closeViewDrawer()">
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Drawer Tabs -->
        <div class="drawer-tabs">
          <button 
            class="tab" 
            [class.active]="viewDrawer.activeTab === 'jd'"
            (click)="switchTab('jd')"
          >
            Job Description
          </button>
          <button 
            class="tab" 
            [class.active]="viewDrawer.activeTab === 'questions'"
            (click)="switchTab('questions')"
          >
            AI Questions
          </button>
          <button 
            class="tab" 
            [class.active]="viewDrawer.activeTab === 'upload'"
            (click)="switchTab('upload')"
          >
            Upload CV
          </button>
          <button 
            class="tab" 
            [class.active]="viewDrawer.activeTab === 'cvs'"
            (click)="switchTab('cvs')"
          >
            CVs ({{ viewDrawer.cvs.length }})
          </button>
        </div>

        <!-- Drawer Content -->
        <div class="drawer-content">
          <!-- Job Description Tab -->
          <div class="tab-content" *ngIf="viewDrawer.activeTab === 'jd'">
            <div class="jd-content">
              <div class="jd-header">
                <h4>Job Description</h4>
                <div class="jd-actions">
                  <button class="btn btn-sm btn-secondary" (click)="copyJD()">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                  <button class="btn btn-sm btn-secondary" (click)="downloadJD()" *ngIf="viewDrawer.demand?.job_description_url">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
              <div class="jd-text" [innerHTML]="viewDrawer.demand?.job_description"></div>
              
              <div class="demand-details">
                <div class="detail-row">
                  <span class="label">Skill:</span>
                  <span class="value">{{ viewDrawer.demand?.skill }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Experience Level:</span>
                  <span class="value">{{ viewDrawer.demand?.experience_level }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Location:</span>
                  <span class="value">{{ viewDrawer.demand?.location }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Salary Range:</span>
                  <span class="value">{{ viewDrawer.demand?.salary_range }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Start Date:</span>
                  <span class="value">{{ viewDrawer.demand?.start_date | date:'medium' }}</span>
                </div>
                <div class="detail-row">
                  <span class="label">End Date:</span>
                  <span class="value">{{ viewDrawer.demand?.end_date | date:'medium' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- AI Questions Tab -->
          <div class="tab-content" *ngIf="viewDrawer.activeTab === 'questions'">
            <div class="questions-content">
              <div class="questions-header">
                <h4>Interview Questions</h4>
                <button class="btn btn-sm btn-primary" (click)="generateQuestions()">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Generate Questions
                </button>
              </div>
              
              <div class="questions-list" *ngIf="viewDrawer.questions.length > 0">
                <div *ngFor="let question of viewDrawer.questions; let i = index" class="question-item">
                  <div class="question-header">
                    <span class="question-number">{{ i + 1 }}</span>
                    <span class="question-difficulty" [class]="'difficulty-' + question.difficulty">
                      {{ question.difficulty | titlecase }}
                    </span>
                  </div>
                  <div class="question-text">{{ question.question }}</div>
                </div>
              </div>
              
              <div class="no-questions" *ngIf="viewDrawer.questions.length === 0">
                <p>No questions generated yet. Click "Generate Questions" to create interview questions based on the job description.</p>
              </div>
            </div>
          </div>

          <!-- Upload CV Tab -->
          <div class="tab-content" *ngIf="viewDrawer.activeTab === 'upload'">
            <div class="upload-content">
              <div class="upload-area" 
                   (dragover)="onDragOver($event)" 
                   (dragleave)="onDragLeave($event)" 
                   (drop)="onDrop($event)"
                   [class.drag-over]="isDragOver">
                <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h4>Upload CV Files</h4>
                <p>Drag and drop CV files here, or click to browse</p>
                <input 
                  type="file" 
                  #fileInput 
                  multiple 
                  accept=".pdf,.doc,.docx"
                  (change)="onFileSelect($event)"
                  style="display: none;"
                >
                <button class="btn btn-primary" (click)="fileInput.click()">
                  Choose Files
                </button>
              </div>
              
              <!-- Form Actions -->
              <div class="form-actions">
                <button class="btn btn-primary btn-save" (click)="submitUploadedFiles()">
                  Save & Continue
                </button>
              </div>
              
              <div class="upload-progress" *ngIf="uploadingFiles.length > 0">
                <h5>Uploading Files:</h5>
                <div *ngFor="let file of uploadingFiles" class="upload-item">
                  <span class="file-name">{{ file.name }}</span>
                  <div class="progress-bar">
                    <div class="progress-fill" [style.width.%]="file.progress"></div>
                  </div>
                  <span class="progress-text">{{ file.progress }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- CVs Tab -->
          <div class="tab-content" *ngIf="viewDrawer.activeTab === 'cvs'">
            <div class="cvs-content">
              <div class="cvs-header">
                <h4>Uploaded CVs</h4>
                <div class="cvs-actions">
                  <button 
                    class="btn btn-sm btn-primary" 
                    (click)="submitSelectedCVs()"
                    [disabled]="viewDrawer.selectedCVs.length === 0"
                  >
                    Submit Selected ({{ viewDrawer.selectedCVs.length }})
                  </button>
                </div>
              </div>
              
              <div class="cvs-list" *ngIf="viewDrawer.cvs.length > 0">
                <div *ngFor="let cv of viewDrawer.cvs" class="cv-item">
                  <label class="cv-checkbox">
                    <input 
                      type="checkbox" 
                      [value]="cv.id"
                      [checked]="viewDrawer.selectedCVs.includes(cv.id)"
                      (change)="onCVSelect(cv.id)"
                    >
                    <span class="checkmark"></span>
                  </label>
                  <div class="cv-info">
                    <div class="cv-name">{{ cv.filename }}</div>
                    <div class="cv-meta">
                      Uploaded: {{ cv.uploaded_at | date:'short' }}
                      <span class="cv-status" [class]="cv.is_processed ? 'processed' : 'pending'">
                        {{ cv.is_processed ? 'Processed' : 'Pending' }}
                      </span>
                    </div>
                  </div>
                  <div class="cv-actions">
                    <button class="btn btn-sm btn-secondary" (click)="previewCV(cv)">
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button class="btn btn-sm btn-secondary" (click)="downloadCV(cv)">
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="no-cvs" *ngIf="viewDrawer.cvs.length === 0">
                <p>No CVs uploaded yet. Go to the "Upload CV" tab to upload candidate resumes.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .demand-management-container {
      padding: 20px;
      background: #f8fafc;
      min-height: 100vh;
    }

    .header {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      max-width: 1200px;
      margin-left: auto;
      margin-right: auto;
    }

    .header-stats {
      display: flex;
      gap: 24px;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
    }

    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .search-input, .filter-select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      min-width: 200px;
    }

    .search-input:focus, .filter-select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .table-container {
      background: white;
      border-radius: 8px;
      /* allow action menus to overflow outside the container */
      overflow: visible;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .demands-table {
      width: 100%;
      border-collapse: collapse;
    }

    .demands-table th {
      background: #f8fafc;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }

    .demands-table td {
      padding: 8px 16px;
      border-bottom: 1px solid #f3f4f6;
    }

    .demand-row:hover {
      background: #f8fafc;
    }

    .serial-number {
      font-weight: 600;
      color: #6b7280;
      text-align: center;
      width: 60px;
    }

    .job-title {
      font-weight: 500;
      color: #1e293b;
    }

    .priority-badge,     .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }


    .priority-low { background: #dcfce7; color: #166534; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-high { background: #fed7aa; color: #c2410c; }
    .priority-urgent { background: #fecaca; color: #dc2626; }

    .status-assigned { background: #dbeafe; color: #1e40af; }
    .status-processing { background: #d1fae5; color: #065f46; }
    .status-hold { background: #fef3c7; color: #92400e; }
    .status-closed { background: #f3f4f6; color: #374151; }

    .actions {
      display: flex;
      gap: 8px;
    }

    /* Action menu (3-dot) styling to match Super Admin */
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

    /* Prevent clipping at bottom by opening upward if near the viewport edge */
    @media (pointer: fine) {
      .action-menu.open-up .action-dropdown {
        top: auto;
        bottom: 100%;
      }
    }

    .action-item {
      width: 100%;
      padding: 10px 14px;
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

    .action-item .action-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 6px;
      font-weight: 500;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 12px;
    }

    .btn-save {
      width: 120px;
      margin-left: auto;
      display: block;
    }

    .form-actions {
      margin-top: 20px;
      padding: 20px 0;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
    }

    .btn-primary {
      background:var(--kudzu-primary);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background:var(--kudzu-primary-dark);
    }

    .btn-secondary {
      background: var(--kudzu-primary-light);
      color: var(--kudzu-primary);
    }

    .btn-secondary:hover {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-success {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: var(--kudzu-primary-dark);
    }

    .btn-warning {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-warning:hover {
      background: var(--kudzu-primary-dark);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .icon {
      width: 16px;
      height: 16px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #6b7280;
    }

    .empty-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      color: #d1d5db;
    }

    .empty-state h3 {
      margin: 0 0 8px;
      color: #374151;
    }

    .empty-state p {
      margin: 0;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
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

    /* Drawer Styles */
    .drawer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      justify-content: flex-end;
    }

    .drawer {
      background: white;
      width: 70%;
      max-width: 900px;
      height: 100vh;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 6px rgba(0, 0, 0, 0.1);
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
      max-width: 100%;
    }

    .drawer-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f3f4f6;
      color: #374151;
      border: none;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .back-btn:hover {
      background: #e5e7eb;
    }

    .title-info h3 {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .client-name {
      font-size: 14px;
      color: #6b7280;
    }

    .drawer-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .processing-badge {
      background: #d1fae5;
      color: #065f46;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: #6b7280;
    }

    .close-btn:hover {
      background: #f3f4f6;
    }

    .drawer-tabs {
      display: flex;
      border-bottom: 1px solid #e5e7eb;
    }

    .tab {
      flex: 1;
      padding: 12px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-weight: 500;
      color: #6b7280;
      transition: all 0.2s;
    }

    .tab.active {
      color: #3b82f6;
      border-bottom-color: #3b82f6;
    }

    .drawer-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .tab-content {
      height: 100%;
    }

    /* Job Description Styles */
    .jd-content {
      height: 100%;
    }

    .jd-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .jd-header h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .jd-actions {
      display: flex;
      gap: 8px;
    }

    .jd-text {
      background: #f8fafc;
      padding: 16px;
      border-radius: 6px;
      margin-bottom: 20px;
      line-height: 1.6;
      color: #374151;
    }

    .demand-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .detail-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .detail-row .label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-row .value {
      font-weight: 500;
      color: #1e293b;
    }

    /* Questions Styles */
    .questions-content {
      height: 100%;
    }

    .questions-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .questions-header h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .questions-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .question-item {
      background: #f8fafc;
      padding: 16px;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
    }

    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
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
    }

    .question-difficulty {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }

    .difficulty-easy { background: #dcfce7; color: #166534; }
    .difficulty-medium { background: #fef3c7; color: #92400e; }
    .difficulty-hard { background: #fecaca; color: #dc2626; }

    .question-text {
      color: #374151;
      line-height: 1.5;
    }

    .no-questions {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }

    /* Upload Styles */
    .upload-content {
      height: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }

    .upload-area {
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 60px 40px;
      text-align: center;
      transition: all 0.2s;
      cursor: pointer;
      background: #fafafa;
    }

    .upload-area.drag-over {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .upload-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      color: #9ca3af;
    }

    .upload-area h4 {
      margin: 0 0 8px;
      color: #374151;
    }

    .upload-area p {
      margin: 0 0 16px;
      color: #6b7280;
    }

    .upload-progress {
      margin-top: 20px;
    }

    .upload-progress h5 {
      margin: 0 0 12px;
      color: #374151;
    }

    .upload-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .file-name {
      flex: 1;
      font-size: 14px;
      color: #374151;
    }

    .progress-bar {
      flex: 2;
      height: 8px;
      background: #f3f4f6;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s;
    }

    .progress-text {
      font-size: 12px;
      color: #6b7280;
      min-width: 40px;
      text-align: right;
    }

    /* CVs Styles */
    .cvs-content {
      height: 100%;
    }

    .cvs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .cvs-header h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .cvs-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .cv-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .cv-checkbox {
      display: flex;
      align-items: center;
      cursor: pointer;
    }

    .cv-info {
      flex: 1;
    }

    .cv-name {
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .cv-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: #6b7280;
    }

    .cv-status {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }

    .cv-status.processed {
      background: #dcfce7;
      color: #166534;
    }

    .cv-status.pending {
      background: #fef3c7;
      color: #92400e;
    }

    .cv-actions {
      display: flex;
      gap: 8px;
    }

    .no-cvs {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }
  `]
})
export class DemandManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private auth = inject(AuthService);
  api = environment.apiBase;

  demands: AssignedDemand[] = [];
  filteredDemands: AssignedDemand[] = [];
  processingCount = 0;
  loading = false;
  // Pagination
  Math = Math;
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  get totalPages() { return Math.max(1, Math.ceil(this.totalItems / this.pageSize)); }

  // Filters
  searchTerm = '';
  selectedPriority = '';
  selectedStatus = '';

  // View drawer
  viewDrawer: ViewDrawer = {
    show: false,
    demand: null,
    activeTab: 'jd',
    questions: [],
    cvs: [],
    isProcessing: false,
    selectedCVs: []
  };

  // Upload
  isDragOver = false;
  uploadingFiles: any[] = [];
  // Action menu state
  activeMenuId: number | null = null;

  ngOnInit() {
    this.loadDemands();
    this.loadProcessingCount();
  }

  loadDemands() {
    this.loading = true;
    const recruiterId = this.auth.getCurrentUserId();
    
    if (!recruiterId) {
      console.error('No recruiter ID found');
      this.loading = false;
      return;
    }

    const params: any = { page: this.currentPage, size: this.pageSize };
    console.log(`🔍 Fetching assigned demands for recruiter ID: ${recruiterId}`);
    
    this.http.get<any>(`${this.api}/recruiter/${recruiterId}/demands`, { params }).subscribe({
      next: (response) => {
        console.log('📊 Assigned demands response:', response);
        this.demands = response.items || [];
        this.filteredDemands = [...this.demands];
        this.totalItems = response.total || this.demands.length || 0;
        this.loading = false;
        console.log(`✅ Loaded ${this.demands.length} assigned demands`);
      },
      error: (error) => {
        console.error('❌ Error loading assigned demands:', error);
        this.demands = [];
        this.filteredDemands = [];
        this.totalItems = 0;
        this.loading = false;
        console.log('📝 No assigned demands found or server not available');
      }
    });
  }

  loadProcessingCount() {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;
    this.http.get<any>(`${this.api}/recruiter/${userId}/process-count`).subscribe({
      next: (response) => {
        this.processingCount = response?.count ?? this.processingCount;
      },
      error: () => {
        // ignore
      }
    });
  }

  goToPage(page: number) {
    this.currentPage = page;
    this.loadDemands();
  }

  applyFilters() {
    this.filteredDemands = this.demands.filter(demand => {
      const matchesSearch = !this.searchTerm || 
        demand.job_title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        demand.client_name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        demand.skill.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesPriority = !this.selectedPriority || demand.priority === this.selectedPriority;
      const currentStatus = demand.activity_status || 'open';
      // Exclude closed items from display
      if (currentStatus === 'closed') {
        return false;
      }
      const matchesStatus = !this.selectedStatus || currentStatus === this.selectedStatus;
      
      return matchesSearch && matchesPriority && matchesStatus;
    });
  }

  openViewDrawer(demand: AssignedDemand) {
    // Navigate to simplified activity route ensuring auth
    const demandId = demand.id;
    const isAuthed = (this.auth.isAuthenticated && this.auth.isAuthenticated()) || !!localStorage.getItem('access_token');
    if (!isAuthed) {
      this.router.navigateByUrl('/auth/login');
      return;
    }
    this.router.navigateByUrl(`/recruiter/activity/${demandId}`);
  }

  navigateToRecruiterActivity(demand: AssignedDemand) {
    // Navigate to recruiter activity page in process mode
    const demandId = demand.id;
    const recruiterId = this.auth.getCurrentUserId();
    const isAuthed = (this.auth.isAuthenticated && this.auth.isAuthenticated()) || !!localStorage.getItem('access_token');

    if (!isAuthed) {
      this.router.navigateByUrl('/auth/login');
      return;
    }
    
    if (!recruiterId) {
      alert('Unable to determine recruiter ID. Please log in again.');
      return;
    }
    
    // Navigate to process mode: /recruiter/activity/:recruiterId/:demandId
    this.router.navigateByUrl(`/recruiter/activity/${recruiterId}/${demandId}`);
  }

  loadFullDemandDetails(demandId: number) {
    const recruiterId = this.auth.getCurrentUserId();
    this.http.get<any>(`${this.api}/recruiter/${recruiterId}/demand/${demandId}`).subscribe({
      next: (response) => {
        // Update the demand details in the drawer
        this.viewDrawer.demand = {
          ...this.viewDrawer.demand,
          ...response
        } as any;
      },
      error: (error) => {
        console.error('Error loading demand details:', error);
      }
    });
  }

  closeViewDrawer() {
    this.viewDrawer.show = false;
  }

  switchTab(tab: 'jd' | 'questions' | 'upload' | 'cvs') {
    this.viewDrawer.activeTab = tab;
  }

  toggleActionMenu(demandId: number): void {
    this.activeMenuId = this.activeMenuId === demandId ? null : demandId;
    // If opening the menu and it's near the bottom, add class to open upward
    setTimeout(() => {
      const menuEl = document.querySelector(
        `.action-menu${this.activeMenuId === demandId ? '' : ''}`
      ) as HTMLElement | null;
      if (!menuEl) return;
      const rect = menuEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 180) {
        menuEl.classList.add('open-up');
      } else {
        menuEl.classList.remove('open-up');
      }
    }, 0);
  }

  startProcess(demand: AssignedDemand) {
    const recruiterId = this.auth.getCurrentUserId();
    
    // Start the activity process using the new API
    this.http.post<any>(`${this.api}/recruiter/${recruiterId}/demand/${demand.id}/open`, {}).subscribe({
      next: (response) => {
        // Navigate to the new activity page
        this.router.navigate(['/recruiter/activity', recruiterId, demand.id]);
        this.loadProcessingCount();
        // Show success message
        alert('Process started successfully!');
      },
      error: (error) => {
        console.error('Error starting process:', error);
        const errorMessage = error.error?.detail || 'Failed to start process. Please try again.';
        alert(errorMessage);
      }
    });
  }

  // Removed Close Task per new spec

  holdProcess(demand: AssignedDemand) {
    const recruiterId = this.auth.getCurrentUserId();

    this.http.post<any>(`${this.api}/recruiter/${recruiterId}/demand/${demand.id}/hold`, {}).subscribe({
      next: (response) => {
        demand.activity_status = 'on_hold';
        this.loadProcessingCount();
        this.loadDemands();
        alert('Process put on hold successfully!');
      },
      error: (error) => {
        console.error('Error holding process:', error);
        const errorMessage = error.error?.detail || 'Failed to hold process. Please try again.';
        alert(errorMessage);
      }
    });
  }

  resumeProcess(demand: AssignedDemand) {
    const recruiterId = this.auth.getCurrentUserId();

    this.http.post<any>(`${this.api}/recruiter/${recruiterId}/demand/${demand.id}/resume`, {}).subscribe({
      next: (response) => {
        demand.activity_status = 'processing';
        this.loadProcessingCount();
        this.loadDemands();
        alert('Process resumed successfully!');
      },
      error: (error) => {
        console.error('Error resuming process:', error);
        const errorMessage = error.error?.detail || 'Failed to resume process. Please try again.';
        alert(errorMessage);
      }
    });
  }

  loadDemandQuestions() {
    if (!this.viewDrawer.demand) return;

    const recruiterId = this.auth.getCurrentUserId();
    this.http.get<any>(`${this.api}/recruiter/${recruiterId}/activity/ai-questions?demand_id=${this.viewDrawer.demand.id}`).subscribe({
      next: (response) => {
        // Convert questions array to AIQuestion objects
        this.viewDrawer.questions = (response.questions || []).map((q: string, index: number) => ({
          id: index + 1,
          question: q,
          difficulty: 'medium',
          category: 'general'
        }));
      },
      error: (error) => {
        console.error('Error loading questions:', error);
      }
    });
  }

  loadDemandCVs() {
    if (!this.viewDrawer.demand) return;

    this.http.get<any>(`${this.api}/recruiter/${this.auth.getCurrentUserId()}/demand/${this.viewDrawer.demand.id}/cvs`).subscribe({
      next: (response) => {
        this.viewDrawer.cvs = response || [];
      },
      error: (error) => {
        console.error('Error loading CVs:', error);
      }
    });
  }

  generateQuestions() {
    if (!this.viewDrawer.demand) return;

    const recruiterId = this.auth.getCurrentUserId();
    this.http.get<any>(`${this.api}/recruiter/${recruiterId}/activity/ai-questions?demand_id=${this.viewDrawer.demand.id}`).subscribe({
      next: (response) => {
        // Convert questions array to AIQuestion objects
        this.viewDrawer.questions = (response.questions || []).map((q: string, index: number) => ({
          id: index + 1,
          question: q,
          difficulty: 'medium',
          category: 'general'
        }));
      },
      error: (error) => {
        console.error('Error generating questions:', error);
        alert('Failed to generate questions. Please try again.');
      }
    });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFiles(Array.from(input.files));
    }
  }

  uploadFiles(files: File[]) {
    if (!this.viewDrawer.demand) return;

    files.forEach(file => {
      const uploadFile = {
        name: file.name,
        progress: 0
      };
      this.uploadingFiles.push(uploadFile);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('demand_id', this.viewDrawer.demand!.id.toString());
      const recruiterId = this.auth.getCurrentUserId();
      if (!recruiterId) {
        console.error('No recruiter ID found');
        return;
      }
      formData.append('recruiter_id', recruiterId.toString());

      this.http.post<any>(`${this.api}/recruiter/upload-cv`, formData).subscribe({
        next: (response) => {
          uploadFile.progress = 100;
          setTimeout(() => {
            this.uploadingFiles = this.uploadingFiles.filter(f => f !== uploadFile);
            this.loadDemandCVs();
          }, 1000);
        },
        error: (error) => {
          console.error('Error uploading file:', error);
          this.uploadingFiles = this.uploadingFiles.filter(f => f !== uploadFile);
        }
      });
    });
  }

  onCVSelect(cvId: number) {
    const index = this.viewDrawer.selectedCVs.indexOf(cvId);
    if (index > -1) {
      this.viewDrawer.selectedCVs.splice(index, 1);
    } else {
      this.viewDrawer.selectedCVs.push(cvId);
    }
  }

  submitSelectedCVs() {
    if (this.viewDrawer.selectedCVs.length === 0) return;

    const payload = {
      recruiter_id: this.auth.getCurrentUserId(),
      demandId: this.viewDrawer.demand!.id,
      cvIds: this.viewDrawer.selectedCVs,
      candidateName: 'Selected Candidates',
      email: 'candidates@example.com',
      phone: '',
      notes: 'Submitted via CV selection'
    };

    this.http.post<any>(`${this.api}/recruiter/submission/submit`, payload).subscribe({
      next: (response) => {
        alert('CVs submitted successfully!');
        this.viewDrawer.selectedCVs = [];
        this.loadDemands();
      },
      error: (error) => {
        console.error('Error submitting CVs:', error);
        alert('Failed to submit CVs. Please try again.');
      }
    });
  }

  copyJD() {
    if (this.viewDrawer.demand?.job_description) {
      navigator.clipboard.writeText(this.viewDrawer.demand.job_description);
      alert('Job description copied to clipboard!');
    }
  }

  downloadJD() {
    if (this.viewDrawer.demand?.job_description_url) {
      window.open(this.viewDrawer.demand.job_description_url, '_blank');
    }
  }

  previewCV(cv: CVFile) {
    // Implement CV preview functionality
    console.log('Preview CV:', cv);
  }

  downloadCV(cv: CVFile) {
    // Implement CV download functionality
    console.log('Download CV:', cv);
  }

  submitUploadedFiles() {
    // Handle the save action for uploaded files
    console.log('Saving uploaded files...');
    // You can implement the actual save logic here
    alert('Files saved successfully!');
  }
}