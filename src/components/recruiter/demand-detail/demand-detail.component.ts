import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { environment } from '../../../environments/environment';

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

interface AIQuestion {
  id: number;
  question: string;
  difficulty: string;
  category: string;
}

interface CVFile {
  id: number;
  filename: string;
  file_path: string;
  uploaded_at: string;
  is_processed: boolean;
}

interface SubmissionData {
  candidateName: string;
  email: string;
  phone: string;
  notes: string;
  cvIds: number[];
}

@Component({
  selector: 'app-demand-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  styles: [`
    /* Import Manrope Font */
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

    /* Kudzu Theme Variables */
    :root {
      --kudzu-primary: rgb(24, 45, 23);
      --kudzu-primary-light: rgba(24, 45, 23, 0.1);
      --kudzu-primary-dark: rgb(18, 35, 18);
    }

    .demand-detail-container {
      padding: 20px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .header-left h1 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 600;
      color: var(--kudzu-primary);
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .header-left p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    /* Demand Details Structure */
    .demand-row-1,
    .demand-row-2 {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 8px;
    }

    .demand-row-2 {
      margin-bottom: 0;
    }

    .demand-label {
      font-weight: 600;
      color: var(--kudzu-primary);
      font-size: 14px;
      min-width: fit-content;
    }

    .demand-value {
      color: #374151;
      font-size: 14px;
      font-weight: 500;
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
    @media (max-width: 768px) {
      .demand-row-1,
      .demand-row-2 {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .demand-label {
        font-size: 13px;
        margin-bottom: 2px;
      }

      .demand-value {
        font-size: 13px;
        margin-bottom: 8px;
      }

      .demand-row-2 {
        margin-bottom: 0;
      }
    }

    .header-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .processing-badge {
      background: #d1fae5;
      color: #065f46;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .back-btn {
      background: #6b7280;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .back-btn:hover {
      background: #4b5563;
    }

    .main-content {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 20px;
      margin-bottom: 20px;
    }

    .left-panel {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .right-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .panel-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #f8fafc;
    }

    .panel-title {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .panel-content {
      padding: 20px;
    }

    .jd-content {
      max-height: 400px;
      overflow-y: auto;
      line-height: 1.6;
      color: #374151;
    }

    .jd-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 500;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
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

    .btn-success {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-success:hover {
      background: var(--kudzu-primary-dark);
    }

    .icon {
      width: 16px;
      height: 16px;
    }

    .questions-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .question-item {
      background: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
      border-left: 4px solid rgb(24, 45, 23);
    }

    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .question-number {
      background: rgb(24, 45, 23);
      color: white;
      width: 20px;
      height: 20px;
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
      padding: 20px;
      color: #6b7280;
    }

    .upload-area {
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      transition: all 0.2s;
      cursor: pointer;
    }

    .upload-area.drag-over {
      border-color: rgb(24, 45, 23);
      background: rgba(24, 45, 23, 0.05);
    }

    .upload-icon {
      width: 32px;
      height: 32px;
      margin: 0 auto 12px;
      color: #9ca3af;
    }

    .upload-area h4 {
      margin: 0 0 8px;
      color: #374151;
      font-size: 14px;
    }

    .upload-area p {
      margin: 0 0 12px;
      color: #6b7280;
      font-size: 12px;
    }

    .cvs-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .cv-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: #f8fafc;
      border-radius: 6px;
      margin-bottom: 8px;
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
      font-size: 14px;
    }

    .cv-meta {
      font-size: 12px;
      color: #6b7280;
    }

    .cv-actions {
      display: flex;
      gap: 4px;
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 12px;
    }

    .submission-form {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 4px;
    }

    .form-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    .form-input:focus {
      outline: none;
      border-color: rgb(24, 45, 23);
      box-shadow: 0 0 0 3px rgba(24, 45, 23, 0.1);
    }

    .form-textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      resize: vertical;
      min-height: 80px;
    }

    .form-textarea:focus {
      outline: none;
      border-color: rgb(24, 45, 23);
      box-shadow: 0 0 0 3px rgba(24, 45, 23, 0.1);
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }

    .error {
      text-align: center;
      padding: 40px;
      color: #dc2626;
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

    @media (max-width: 768px) {
      .main-content {
        grid-template-columns: 1fr;
      }
    }
  `],
  template: `
    <div class="demand-detail-container">
      <!-- Header -->
      <div class="header">
        <div class="header-left">
          <h1>Demand #{{ demand?.id }}</h1>
          <!-- Row 1: Job Title, Client, SPOC -->
          <div class="demand-row-1">
            <span class="demand-label">Job Title:</span>
            <span class="demand-value">{{ demand?.job_title || demand?.skill || 'N/A' }}</span>
            <span class="demand-label">Client:</span>
            <span class="demand-value">{{ demand?.client_name || 'N/A' }}</span>
            <span class="demand-label">SPOC:</span>
            <span class="demand-value">{{ demand?.spoc_name || 'N/A' }}</span>
          </div>
          <!-- Row 2: Position, Priority -->
          <div class="demand-row-2">
            <span class="demand-label">Position:</span>
            <span class="demand-value">{{ demand?.no_of_positions || 0 }}</span>
            <span class="demand-label">Priority:</span>
            <span class="demand-value priority-value" [class]="'priority-' + (demand?.priority || 'medium')">
              {{ (demand?.priority || 'medium') | titlecase }}
            </span>
          </div>
        </div>
        <div class="header-right">
          <span class="processing-badge" *ngIf="isProcessing">🟢 Processing</span>
          <button class="back-btn" (click)="goBack()">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading">
        <p>Loading demand details...</p>
          </div>
          
      <!-- Error State -->
      <div *ngIf="error" class="error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" (click)="loadDemandDetail()">Retry</button>
                </div>
                
      <!-- Main Content -->
      <div *ngIf="demand && !loading" class="main-content">
        <!-- Left Panel - Job Description -->
        <div class="left-panel">
          <div class="panel-header">
            <h3 class="panel-title">Job Description</h3>
          </div>
          <div class="panel-content">
            <div class="jd-content" [innerHTML]="demand.job_description"></div>
            <div class="jd-actions">
              <button class="btn btn-secondary" (click)="copyJD()">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                Copy JD
                  </button>
              <button class="btn btn-secondary" (click)="downloadJD()" *ngIf="demand.job_description_url">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                Download
                  </button>
                </div>
              </div>
                </div>
                
        <!-- Right Panel -->
        <div class="right-panel">
          <!-- AI Questions -->
          <div class="left-panel">
            <div class="panel-header">
              <h3 class="panel-title">Interview Questions</h3>
                    </div>
            <div class="panel-content">
              <div class="questions-list" *ngIf="questions.length > 0">
                <div *ngFor="let question of questions; let i = index" class="question-item">
                  <div class="question-header">
                    <span class="question-number">{{ i + 1 }}</span>
                    <span class="question-difficulty" [class]="'difficulty-' + question.difficulty">
                      {{ question.difficulty | titlecase }}
                    </span>
                  </div>
                  <div class="question-text">{{ question.question }}</div>
                </div>
              </div>
              <div class="no-questions" *ngIf="questions.length === 0">
                <p>No questions generated yet.</p>
                <button class="btn btn-primary" (click)="generateQuestions()">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Generate Questions
                </button>
                        </div>
                      </div>
                    </div>

          <!-- CV Upload -->
          <div class="left-panel">
            <div class="panel-header">
              <h3 class="panel-title">Upload CVs</h3>
                  </div>
            <div class="panel-content">
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
                    </div>
                  </div>
                  
          <!-- Uploaded CVs -->
          <div class="left-panel" *ngIf="cvs.length > 0">
            <div class="panel-header">
              <h3 class="panel-title">Uploaded CVs ({{ cvs.length }})</h3>
            </div>
            <div class="panel-content">
              <div class="cvs-list">
                <div *ngFor="let cv of cvs" class="cv-item">
                  <label class="cv-checkbox">
                    <input 
                      type="checkbox" 
                      [value]="cv.id"
                      [checked]="selectedCVs.includes(cv.id)"
                      (change)="onCVSelect(cv.id)"
                    >
                    <span class="checkmark"></span>
                  </label>
                        <div class="cv-info">
                    <div class="cv-name">{{ cv.filename }}</div>
                    <div class="cv-meta">
                      Uploaded: {{ cv.uploaded_at | date:'short' }}
                    </div>
                  </div>
                  <div class="cv-actions">
                    <button class="btn btn-sm btn-secondary" (click)="downloadCV(cv)">
                      <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Submission Form -->
      <div *ngIf="demand && !loading" class="submission-form">
        <h3>Submit Candidate Profile</h3>
        <form [formGroup]="submissionForm" (ngSubmit)="submitProfile()">
          <div class="form-group">
            <label class="form-label">Candidate Name *</label>
            <input 
              type="text" 
              class="form-input"
              formControlName="candidateName"
              placeholder="Enter candidate name"
            >
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input 
              type="email" 
              class="form-input"
              formControlName="email"
              placeholder="candidate@example.com"
            >
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input 
              type="tel" 
              class="form-input"
              formControlName="phone"
              placeholder="+1 (555) 123-4567"
            >
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea 
              class="form-textarea"
              formControlName="notes"
              placeholder="Additional notes about the candidate..."
            ></textarea>
            </div>
          <div class="form-group">
            <button 
              type="submit" 
              class="btn btn-success"
              [disabled]="submissionForm.invalid || selectedCVs.length === 0"
            >
              <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Submit Profile ({{ selectedCVs.length }} CVs selected)
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
export class DemandDetailComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private api = environment.apiBase;

  demand: DemandDetail | null = null;
  questions: AIQuestion[] = [];
  cvs: CVFile[] = [];
  selectedCVs: number[] = [];
  loading = true;
  error: string | null = null;
  isProcessing = false;
  isDragOver = false;
  toasts: { id: number; text: string; type: string }[] = [];

  submissionForm: FormGroup;

  constructor() {
    this.submissionForm = this.fb.group({
      candidateName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const demandId = params['id'];
      if (demandId) {
        this.loadDemandDetail();
      }
    });
  }

  loadDemandDetail(): void {
    const demandId = this.route.snapshot.params['id'];
    const recruiterId = this.getUserIdFromToken();
    
    if (!recruiterId) {
      this.error = 'Authentication error. Please login again.';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    // Load demand details
    this.http.get<any>(`${this.api}/recruiter/${recruiterId}/demand/${demandId}`).subscribe({
      next: (response) => {
        this.demand = response;
        this.isProcessing = response.status === 'processing';
        this.loadQuestions();
        this.loadCVs();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading demand detail:', error);
        this.error = 'Failed to load demand details. Please try again.';
        this.loading = false;
      }
    });
  }

  loadQuestions(): void {
    if (!this.demand) return;

    this.http.get<any>(`${this.api}/demand/${this.demand.id}/questions`).subscribe({
      next: (response) => {
        this.questions = response.questions || [];
      },
      error: (error) => {
        console.error('Error loading questions:', error);
      }
    });
  }

  loadCVs(): void {
    const demandId = this.route.snapshot.params['id'];
    const recruiterId = this.getUserIdFromToken();
    
    if (!recruiterId) return;

    this.http.get<any>(`${this.api}/recruiter/${recruiterId}/demand/${demandId}/cvs`).subscribe({
      next: (response) => {
        this.cvs = response || [];
      },
      error: (error) => {
        console.error('Error loading CVs:', error);
      }
    });
  }
  
  generateQuestions(): void {
    if (!this.demand) return;

    const payload = {
      jd_text: this.demand.job_description,
      count: 5,
      difficulty: 'medium'
    };

    this.http.post<any>(`${this.api}/ai/generate_questions`, payload).subscribe({
      next: (response) => {
        this.questions = response.questions || [];
        this.showToast('Questions generated successfully', 'success');
      },
      error: (error) => {
        console.error('Error generating questions:', error);
        this.showToast('Failed to generate questions. Please try again.', 'error');
      }
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFiles(Array.from(input.files));
    }
  }

  uploadFiles(files: File[]): void {
    const demandId = this.route.snapshot.params['id'];
    const recruiterId = this.getUserIdFromToken();
    
    if (!recruiterId) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    files.forEach(file => {
    const formData = new FormData();
    formData.append('file', file);
      formData.append('demand_id', demandId);
      formData.append('recruiter_id', recruiterId.toString());

      this.http.post<any>(`${this.api}/recruiter/upload-cv`, formData).subscribe({
        next: (response) => {
          this.toastService.success(`✅ Profile uploaded successfully! (${file.name})`);
          this.loadCVs(); // Reload CVs list
        },
        error: (error) => {
          console.error('Error uploading file:', error);
          this.showToast(`Failed to upload "${file.name}"`, 'error');
        }
      });
    });
  }

  onCVSelect(cvId: number): void {
    const index = this.selectedCVs.indexOf(cvId);
    if (index > -1) {
      this.selectedCVs.splice(index, 1);
    } else {
      this.selectedCVs.push(cvId);
    }
  }

  submitProfile(): void {
    if (this.submissionForm.invalid) {
      this.showToast('Please fill in candidate name and email', 'warning');
      return;
    }

    if (this.selectedCVs.length === 0) {
      this.showToast('Please select at least one CV', 'warning');
      return;
    }

    const demandId = this.route.snapshot.params['id'];
    const recruiterId = this.getUserIdFromToken();
    
    if (!recruiterId) {
      this.showToast('Authentication error. Please login again.', 'error');
      return;
    }

    const formValue = this.submissionForm.value;
    const payload = {
      recruiter_id: recruiterId,
      demandId: parseInt(demandId),
      candidateName: formValue.candidateName,
      email: formValue.email,
      phone: formValue.phone,
      notes: formValue.notes,
      cvIds: this.selectedCVs
    };

    this.http.post<any>(`${this.api}/recruiter/submission/submit`, payload).subscribe({
      next: (response) => {
        console.log('✅ Profile submission response:', response);
        
        // Update CV count after successful submission
        const demandId = this.route.snapshot.params['id'];
        const updatePayload = {
          demand_id: demandId,
          recruiter_id: this.auth.getCurrentUserId(),
          increment: this.selectedCVs.length
        };
        
        this.http.post<any>(`${this.api}/recruiter/update-cv-count-and-check`, updatePayload).subscribe({
          next: (countResponse) => {
            console.log('✅ CV count updated:', countResponse);
            this.toastService.success('✅ Profile submitted successfully!');
            this.submissionForm.reset();
            this.selectedCVs = [];
          },
          error: (countError) => {
            console.error('Error updating CV count:', countError);
            this.toastService.success('✅ Profile submitted successfully!');
            this.submissionForm.reset();
            this.selectedCVs = [];
          }
        });
        
        // Check if demand was closed and show popup
        if (response.demand_closed) {
          this.showDemandClosedPopup();
        } else {
          // Navigate back to dashboard after a short delay
          setTimeout(() => {
            this.router.navigate(['/recruiter/dashboard']);
          }, 3000);
        }
      },
      error: (error) => {
        console.error('Error submitting profile:', error);
        this.showToast('Failed to submit profile. Please try again.', 'error');
      }
    });
  }

  copyJD(): void {
    if (this.demand?.job_description) {
      navigator.clipboard.writeText(this.demand.job_description);
      this.toastService.success('✅ Job description copied to clipboard!');
    }
  }

  downloadJD(): void {
    if (this.demand?.job_description_url) {
      window.open(this.demand.job_description_url, '_blank');
    }
  }

  downloadCV(cv: CVFile): void {
    // Implement CV download functionality
    console.log('Download CV:', cv);
    this.showToast('CV download functionality coming soon', 'warning');
  }

  goBack(): void {
    this.router.navigate(['/recruiter/dashboard']);
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

  showDemandClosedPopup(): void {
    // Create and show popup message
    const popup = document.createElement('div');
    popup.className = 'demand-closed-popup';
    popup.innerHTML = `
      <div class="popup-overlay">
        <div class="popup-content">
          <div class="popup-header">
            <h3>Demand Closed</h3>
          </div>
          <div class="popup-body">
            <p>The demand is closed.</p>
          </div>
          <div class="popup-footer">
            <button class="btn btn-primary" onclick="this.closest('.demand-closed-popup').remove(); window.location.href='/recruiter/dashboard';">Close</button>
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
        min-width: 80px !important;
        transition: all 0.2s ease !important;
        background: #3b82f6 !important;
        color: white !important;
        box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3) !important;
      }
      .popup-footer .btn:hover {
        background: #2563eb !important;
        box-shadow: 0 4px 8px rgba(59, 130, 246, 0.4) !important;
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

  private getUserIdFromToken(): number | null {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      const userId = Number(payload.uid);
      
      if (!userId || isNaN(userId)) return null;
      
      return userId;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
}