import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  OnboardingFormResponse,
  OnboardingFormSubmissionResponse,
  OnboardingPublicService,
} from '../../services/onboarding-public.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-onboarding-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="onboarding-form-shell">
      <div class="form-card">
        <header class="form-header">
          <div>
            <h1>Candidate Onboarding</h1>
            <p>Please complete the required details to finish your onboarding.</p>
          </div>
          <div class="brand">Kudzu</div>
        </header>

        <section *ngIf="isLoading()" class="state-card muted">Loading onboarding form...</section>
        <section *ngIf="errorMessage()" class="state-card error">{{ errorMessage() }}</section>

        <ng-container *ngIf="!isLoading() && candidate() as data">
          <section class="state-card success" *ngIf="successMessage()">
            {{ successMessage() }}
          </section>

          <section class="info-grid">
            <div>
              <div class="label">Name</div>
              <div class="value">{{ data.candidate_name || '—' }}</div>
            </div>
            <div>
              <div class="label">Email</div>
              <div class="value">{{ data.candidate_email || '—' }}</div>
            </div>
            <div>
              <div class="label">Phone</div>
              <div class="value">{{ data.candidate_phone || '—' }}</div>
            </div>
            <div>
              <div class="label">Current Status</div>
              <div class="status-pill" [class.completed]="data.status === 'completed'">
                {{ data.status || 'pending' }}
              </div>
            </div>
          </section>

          <form
            class="form-fields"
            *ngIf="!data.read_only"
            (ngSubmit)="submitForm()"
            novalidate
          >
            <div class="field-group">
              <label>Passport Photo <span>*</span></label>
              <div class="file-upload-wrapper">
                <input #passportInput type="file" accept="image/*" (change)="handlePassportChange($event)" style="display: none" required />
                <button type="button" class="upload-btn" (click)="passportInput.click()">
                  <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Choose File
                </button>
                <span class="file-name" *ngIf="passportFileName()">{{ passportFileName() }}</span>
                <span class="file-name placeholder" *ngIf="!passportFileName()">No file selected</span>
              </div>
            </div>

            <div class="field-group">
              <label>Updated Resume <span>*</span></label>
              <div class="file-upload-wrapper">
                <input #resumeInput type="file" accept=".pdf,.doc,.docx" (change)="handleResumeChange($event)" style="display: none" required />
                <button type="button" class="upload-btn" (click)="resumeInput.click()">
                  <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Choose File
                </button>
                <span class="file-name" *ngIf="resumeFileName()">{{ resumeFileName() }}</span>
                <span class="file-name placeholder" *ngIf="!resumeFileName()">No file selected</span>
              </div>
            </div>

            <div class="field-group">
              <label>Education Details <span>*</span></label>
              <textarea
                rows="4"
                name="educationDetails"
                [(ngModel)]="educationDetails"
                placeholder="Add degrees, institutions, passing years..."
                required
              ></textarea>
            </div>

            <div class="field-group">
              <label>Employee Details <span>*</span></label>
              <textarea
                rows="4"
                name="employeeDetails"
                [(ngModel)]="employeeDetails"
                placeholder="Add employee code, previous employer, designation..."
                required
              ></textarea>
            </div>

            <div class="field-group">
              <label>Additional Documents</label>
              <div class="additional-docs">
                <div class="doc-row" *ngFor="let doc of additionalDocuments; let i = index">
                  <input
                    type="text"
                    class="doc-name"
                    [(ngModel)]="doc.name"
                    name="docName{{ i }}"
                    placeholder="Document name (e.g., Aadhaar)"
                    required
                  />
                  <div class="file-upload-wrapper">
                    <input [id]="'additionalInput' + i" type="file" (change)="handleAdditionalDocChange(i, $event)" style="display: none" required />
                    <button type="button" class="upload-btn" (click)="triggerFileInput('additionalInput' + i)">
                      <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Choose File
                    </button>
                    <span class="file-name" *ngIf="getAdditionalFileName(i)">{{ getAdditionalFileName(i) }}</span>
                    <span class="file-name placeholder" *ngIf="!getAdditionalFileName(i)">No file selected</span>
                  </div>
                  <button type="button" class="remove-btn" (click)="removeDocumentField(i)" aria-label="Remove">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <button type="button" class="add-doc-btn" (click)="addDocumentField()">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Document
              </button>
            </div>

            <div class="actions">
              <button class="primary-btn" type="submit" [disabled]="isSubmitting()">
                {{ isSubmitting() ? 'Submitting...' : 'Submit Onboarding Form' }}
              </button>
            </div>
          </form>

          <section class="documents-card" *ngIf="data.read_only">
            <h3>Submitted Documents</h3>
            <ng-container *ngIf="data.documents as docs; else noDocs">
              <div class="doc-list">
                <div class="doc-item">
                  <span>Passport Photo</span>
                  <button *ngIf="docs.passport_photo as url" class="view-doc-btn" (click)="openDocumentPreview(url, 'Passport Photo')">View</button>
                </div>
                <div class="doc-item">
                  <span>Updated Resume</span>
                  <button *ngIf="docs.updated_resume as url" class="view-doc-btn" (click)="openDocumentPreview(url, 'Updated Resume')">View</button>
                </div>
                <div class="doc-item">
                  <span>Education Details</span>
                  <div class="doc-text">{{ readableDetails(docs.education_details) }}</div>
                </div>
                <div class="doc-item">
                  <span>Employee Details</span>
                  <div class="doc-text">{{ readableDetails(docs.employee_details) }}</div>
                </div>
                <div class="doc-item" *ngIf="hasAdditionalDocuments(docs)">
                  <span>Additional Documents</span>
                  <div class="doc-text">
                    <div class="additional-doc-item" *ngFor="let extra of getAdditionalDocumentsList(docs)">
                      <span>{{ extra.doc_name || extra.name || 'Document' }}</span>
                      <button *ngIf="extra.url" class="view-doc-btn" (click)="openDocumentPreview(extra.url, extra.doc_name || extra.name || 'Document')">View</button>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>
            <ng-template #noDocs>
              <div class="doc-empty">Documents will appear once submitted.</div>
            </ng-template>
          </section>
        </ng-container>
      </div>

      <div *ngIf="isDocumentPreviewOpen()" class="modal-overlay" (click)="closeDocumentPreview()">
        <div class="modal document-preview-modal" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>{{ documentPreviewTitle() }}</h3>
            <button class="close-btn" (click)="closeDocumentPreview()">×</button>
          </header>
          <div class="modal-body document-preview-body">
            <ng-container *ngIf="documentPreviewUrl() as url">
              <!-- Image Preview -->
              <div *ngIf="isImageFile(url)" class="image-preview">
                <img [src]="resolveDocumentUrl(url)" [alt]="documentPreviewTitle()" />
              </div>
              <!-- PDF Preview -->
              <div *ngIf="isPdfFile(url)" class="pdf-preview">
                <iframe [src]="getSafeDocumentUrl(url)" title="Document Preview" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
                <div *ngIf="pdfLoading" class="docx-loading">Loading PDF document...</div>
                <div *ngIf="pdfError" class="docx-error">
                  <p>Unable to preview PDF file.</p>
                  <button class="download-btn" (click)="openFileInNewTab(url)">Open PDF File</button>
                </div>
              </div>
              <!-- DOCX Preview -->
              <div *ngIf="isDocxFile(url)" class="docx-preview">
                <div #docxHost class="docx-host"></div>
                <div *ngIf="docxLoading" class="docx-loading">Loading document...</div>
                <div *ngIf="docxError" class="docx-error">
                  <p>Unable to preview document.</p>
                  <button class="download-btn" (click)="openFileInNewTab(url)">Open Document</button>
                </div>
              </div>
            </ng-container>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: radial-gradient(circle at top, #f1f5f9, #e2e8f0);
        padding: 32px 16px;
        font-family: "Manrope", "Manrope Placeholder", sans-serif;
      }

      .onboarding-form-shell {
        max-width: 920px;
        margin: 0 auto;
      }

      .form-card {
        background: #fff;
        border-radius: 32px;
        padding: 32px;
        box-shadow: 0 25px 60px rgba(15, 23, 42, 0.1);
        border: 1px solid rgba(15, 23, 42, 0.06);
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .form-header {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }

      .form-header h1 {
        margin: 0;
        font-size: 28px;
      }

      .form-header p {
        margin: 4px 0 0;
        color: #64748b;
      }

      .brand {
        font-weight: 800;
        font-size: 20px;
        color: #16a34a;
      }

      .state-card {
        padding: 16px;
        border-radius: 16px;
        font-weight: 600;
      }

      .state-card.muted {
        background: rgba(59, 130, 246, 0.08);
        color: #1d4ed8;
      }

      .state-card.error {
        background: rgba(248, 113, 113, 0.15);
        color: #b91c1c;
      }

      .state-card.success {
        background: rgba(34, 197, 94, 0.12);
        color: #15803d;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        padding: 16px;
        border: 1px solid rgba(15, 23, 42, 0.06);
        border-radius: 20px;
        background: #f8fafc;
      }

      .label {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
      }

      .value {
        font-size: 18px;
        font-weight: 600;
        color: #0f172a;
      }

      .status-pill {
        display: inline-flex;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(251, 191, 36, 0.2);
        color: #92400e;
        font-size: 13px;
        font-weight: 700;
        text-transform: capitalize;
      }

      .status-pill.completed {
        background: rgba(16, 185, 129, 0.16);
        color: #047857;
      }

      .documents-card {
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 24px;
        padding: 20px;
      }

      .form-fields {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .field-group label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        margin-bottom: 6px;
      }

      .field-group span {
        color: #ef4444;
      }

      .field-group textarea,
      .field-group input[type='text'] {
        width: 100%;
      }

      textarea,
      input[type='text'] {
        border: 1px solid rgba(15, 23, 42, 0.16);
        border-radius: 14px;
        padding: 12px;
        font-size: 14px;
      }

      textarea:focus,
      input:focus {
        outline: 2px solid rgba(37, 99, 235, 0.3);
        border-color: transparent;
      }

      .file-upload-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .upload-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: #fff;
        border: 1px solid rgba(15, 23, 42, 0.16);
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .upload-btn:hover {
        background: #f8fafc;
        border-color: rgba(37, 99, 235, 0.4);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
      }

      .upload-icon {
        flex-shrink: 0;
      }

      .file-name {
        font-size: 14px;
        color: #0f172a;
        font-weight: 500;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-name.placeholder {
        color: #94a3b8;
        font-weight: 400;
      }

      .additional-docs {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 16px;
      }

      .doc-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: flex-start;
        padding: 16px;
        background: #f8fafc;
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 14px;
      }

      .doc-name {
        flex: 1;
        min-width: 200px;
      }

      .remove-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: none;
        background: rgba(239, 68, 68, 0.1);
        color: #dc2626;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .remove-btn:hover {
        background: rgba(239, 68, 68, 0.2);
        transform: translateY(-1px);
      }

      .add-doc-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: #fff;
        border: 1px dashed rgba(37, 99, 235, 0.4);
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        color: #2563eb;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .add-doc-btn:hover {
        background: rgba(37, 99, 235, 0.05);
        border-color: rgba(37, 99, 235, 0.6);
        transform: translateY(-1px);
      }

      .actions {
        display: flex;
        justify-content: flex-end;
      }

      .primary-btn {
        background: #2563eb;
        color: #fff;
        border: none;
        border-radius: 14px;
        padding: 14px 22px;
        font-weight: 700;
        cursor: pointer;
        min-width: 220px;
      }

      .primary-btn[disabled] {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .doc-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .doc-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        padding-bottom: 6px;
      }

      .doc-text {
        max-width: 60%;
        font-size: 14px;
        color: #334155;
      }

      .additional-doc-item {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 0;
      }

      .doc-empty {
        color: #94a3b8;
        font-weight: 500;
      }

      .view-doc-btn {
        padding: 6px 14px;
        background: #fff;
        border: 1px solid rgba(37, 99, 235, 0.3);
        border-radius: 8px;
        color: #2563eb;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .view-doc-btn:hover {
        background: rgba(37, 99, 235, 0.08);
        border-color: rgba(37, 99, 235, 0.5);
        transform: translateY(-1px);
      }

      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1002;
        padding: 24px;
      }

      .modal {
        background: #fff;
        border-radius: 16px;
        width: min(90vw, 1000px);
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px rgba(15, 23, 42, 0.25);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }

      .modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        color: #0f172a;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .close-btn:hover {
        background: rgba(15, 23, 42, 0.08);
      }

      .modal-body {
        padding: 24px;
        overflow-y: auto;
      }

      .document-preview-body {
        padding: 0;
        height: calc(90vh - 80px);
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
      }

      .image-preview {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .image-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
      }

      .pdf-preview {
        width: 100%;
        height: 100%;
        position: relative;
        background: #f8fafc;
      }

      .pdf-preview iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #f8fafc;
      }

      .docx-preview {
        width: 100%;
        height: 100%;
        background: #ffffff;
        overflow: auto;
        position: relative;
      }

      .docx-host {
        width: 100%;
        height: 100%;
        padding: 20px;
        background: #ffffff;
        overflow: auto;
      }

      .docx-host :global(.docx) {
        max-width: 100%;
      }

      .docx-loading,
      .docx-error {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        padding: 32px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1);
        z-index: 10;
      }

      .docx-loading {
        color: #475569;
        font-size: 15px;
      }

      .docx-error p {
        margin: 0 0 20px;
        color: #475569;
        font-size: 15px;
      }

      .download-btn {
        display: inline-block;
        padding: 12px 24px;
        background: #2563eb;
        color: #fff;
        border-radius: 10px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .download-btn:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }

      @media (max-width: 640px) {
        .form-card {
          padding: 24px 16px;
        }
        .form-header h1 {
          font-size: 24px;
        }
        .info-grid {
          grid-template-columns: 1fr;
          padding: 12px;
        }
        .doc-item {
          flex-direction: column;
        }
        .file-upload-wrapper {
          flex-direction: column;
          align-items: stretch;
        }
        .file-name {
          width: 100%;
          text-align: left;
        }
        .doc-row {
          flex-direction: column;
          gap: 12px;
        }
        .doc-name {
          min-width: 100%;
        }
        .file-upload-wrapper {
          width: 100%;
        }
        .upload-btn {
          width: 100%;
          justify-content: center;
        }
      }
    `,
  ],
})
export class OnboardingFormComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private onboardingService = inject(OnboardingPublicService);
  private sanitizer = inject(DomSanitizer);
  private apiBase = environment.apiBase;

  isLoading = signal(true);
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  candidate = signal<OnboardingFormResponse | null>(null);
  documentPreviewUrl = signal<string | null>(null);
  documentPreviewTitle = signal<string>('');
  isDocumentPreviewOpen = signal(false);
  @ViewChild('docxHost') docxHostRef!: ElementRef;
  docxLoading = false;
  docxError = false;
  pdfLoading = false;
  pdfError = false;

  educationDetails = '';
  employeeDetails = '';
  additionalDocuments: Array<{ name: string; file: File | null }> = [];
  private passportFile: File | null = null;
  private resumeFile: File | null = null;

  private candidateId = '';
  private token = '';

  ngOnInit(): void {
    this.candidateId = this.route.snapshot.paramMap.get('candidateId') || '';
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.candidateId || !this.token) {
      this.errorMessage.set('Invalid onboarding link.');
      this.isLoading.set(false);
      return;
    }
    this.loadForm();
  }

  private loadForm(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.onboardingService.getForm(this.candidateId, this.token).subscribe({
      next: (response) => {
        this.candidate.set(response);
        if (response.read_only && response.documents) {
          this.successMessage.set('Your onboarding form is already submitted.');
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        const detail =
          error?.error?.detail ||
          error?.message ||
          'Unable to load onboarding form.';
        this.errorMessage.set(detail);
        this.isLoading.set(false);
      },
    });
  }

  handlePassportChange(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0] || null;
    this.passportFile = file;
  }

  handleResumeChange(event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0] || null;
    this.resumeFile = file;
  }

  passportFileName(): string {
    return this.passportFile?.name || '';
  }

  resumeFileName(): string {
    return this.resumeFile?.name || '';
  }

  getAdditionalFileName(index: number): string {
    return this.additionalDocuments[index]?.file?.name || '';
  }

  triggerFileInput(id: string): void {
    const input = document.getElementById(id) as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  addDocumentField(): void {
    this.additionalDocuments.push({ name: '', file: null });
  }

  removeDocumentField(index: number): void {
    this.additionalDocuments.splice(index, 1);
  }

  handleAdditionalDocChange(index: number, event: Event): void {
    const file = (event.target as HTMLInputElement)?.files?.[0] || null;
    if (this.additionalDocuments[index]) {
      this.additionalDocuments[index].file = file;
    }
  }

  submitForm(): void {
    if (!this.passportFile || !this.resumeFile) {
      this.errorMessage.set('Passport photo and updated resume are required.');
      return;
    }
    if (!this.educationDetails.trim() || !this.employeeDetails.trim()) {
      this.errorMessage.set('Education and employee details are required.');
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const formData = new FormData();
    formData.append('passport_photo', this.passportFile);
    formData.append('updated_resume', this.resumeFile);
    formData.append('education_details', this.educationDetails.trim());
    formData.append('employee_details', this.employeeDetails.trim());

    this.additionalDocuments.forEach((doc) => {
      if (doc.file) {
        formData.append('additional_document_names', doc.name || doc.file.name || 'Document');
        formData.append('additional_files', doc.file);
      }
    });

    this.onboardingService.submitForm(this.candidateId, this.token, formData).subscribe({
      next: (response: OnboardingFormSubmissionResponse) => {
        const current = this.candidate();
        if (current) {
          this.candidate.set({
            ...current,
            status: response.status,
            documents: response.documents,
            read_only: true,
          });
        }
        this.successMessage.set(response.message);
        this.isSubmitting.set(false);
      },
      error: (error) => {
        const detail =
          error?.error?.detail ||
          error?.message ||
          'Unable to submit onboarding form.';
        this.errorMessage.set(detail);
        this.isSubmitting.set(false);
      },
    });
  }

  resolveDocumentUrl(path: unknown): string {
    if (typeof path !== 'string') {
      return '';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Onboarding files are served directly, not under /api
    if (path.startsWith('/onboarding-files/')) {
      const baseUrl = this.apiBase.replace('/api', '');
      return `${baseUrl}${path}`;
    }
    return `${this.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
  }

  readableDetails(value: unknown): string {
    if (!value) {
      return '—';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      // Extract text from JSON objects like {"text": "test company,5years"}
      const obj = value as Record<string, unknown>;
      if (obj['text'] && typeof obj['text'] === 'string') {
        return obj['text'] as string;
      }
      // If it's an array, join the values
      if (Array.isArray(value)) {
        return value.map(v => String(v)).join(', ');
      }
      // Otherwise try to stringify
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  hasAdditionalDocuments(docs: any): boolean {
    if (!docs) return false;
    if (Array.isArray(docs.additional_documents)) {
      return docs.additional_documents.length > 0;
    }
    if (docs.additional_documents && typeof docs.additional_documents === 'object') {
      return Object.keys(docs.additional_documents).length > 0;
    }
    if (Array.isArray(docs.additional_documents_list)) {
      return docs.additional_documents_list.length > 0;
    }
    return false;
  }

  getAdditionalDocumentsList(docs: any): Array<{ doc_name?: string; name?: string; url: string }> {
    if (!docs) return [];
    if (Array.isArray(docs.additional_documents)) {
      return docs.additional_documents;
    }
    if (Array.isArray(docs.additional_documents_list)) {
      return docs.additional_documents_list;
    }
    if (docs.additional_documents && typeof docs.additional_documents === 'object') {
      return Object.entries(docs.additional_documents).map(([name, url]) => ({
        doc_name: name,
        name: name,
        url: url as string,
      }));
    }
    return [];
  }

  openDocumentPreview(url: string, title: string): void {
    this.documentPreviewUrl.set(url);
    this.documentPreviewTitle.set(title);
    this.isDocumentPreviewOpen.set(true);
    
    // Load the appropriate preview based on file type
    setTimeout(() => {
      if (this.isPdfFile(url)) {
        this.pdfLoading = true;
        this.pdfError = false;
        // PDF will load via iframe, reset loading after a delay
        setTimeout(() => {
          this.pdfLoading = false;
        }, 1000);
      } else if (this.isDocxFile(url)) {
        this.renderDocx(url);
      }
    }, 50);
  }

  closeDocumentPreview(): void {
    this.isDocumentPreviewOpen.set(false);
    this.documentPreviewUrl.set(null);
    this.documentPreviewTitle.set('');
    this.docxLoading = false;
    this.docxError = false;
    this.pdfLoading = false;
    this.pdfError = false;
    // Clear docx host
    if (this.docxHostRef?.nativeElement) {
      this.docxHostRef.nativeElement.innerHTML = '';
    }
  }

  isImageFile(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp');
  }

  isPdfFile(url: string): boolean {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf');
  }

  isDocxFile(url: string): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith('.doc') || lower.endsWith('.docx');
  }

  getSafeDocumentUrl(url: string): SafeResourceUrl {
    const resolved = this.resolveDocumentUrl(url);
    // For PDF, add toolbar=0 to hide native controls
    if (this.isPdfFile(url)) {
      return this.sanitizer.bypassSecurityTrustResourceUrl(`${resolved}#toolbar=0&navpanes=0&scrollbar=1`);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(resolved);
  }

  openFileInNewTab(url: string): void {
    const resolved = this.resolveDocumentUrl(url);
    window.open(resolved, '_blank');
  }

  // Render DOCX/DOC using docx-preview client-side library (same as recruiter activity)
  private async renderDocx(url: string): Promise<void> {
    try {
      this.docxLoading = true;
      this.docxError = false;
      
      const host = this.docxHostRef?.nativeElement;
      if (!host) {
        console.error('Document host element not found');
        this.docxError = true;
        this.docxLoading = false;
        return;
      }
      
      const isOldDoc = url.toLowerCase().endsWith('.doc');
      const fileUrl = this.resolveDocumentUrl(url);
      
      console.log('🔍 Loading document from:', fileUrl);
      
      if (isOldDoc) {
        // .doc files can't be previewed by browsers
        this.docxLoading = false;
        this.docxError = true;
        return;
      }
      
      // Fetch the file for .docx
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      
      // Use docx-preview for .docx files (dynamically imported)
      const docx = await import('docx-preview');
      
      host.innerHTML = '';
      
      await docx.renderAsync(arrayBuffer, host, undefined, {
        inWrapper: true,
        ignoreWidth: true,
        ignoreHeight: false,
        className: 'docx'
      });
      
      // Add styling for tables
      host.querySelectorAll('table').forEach((table: any) => {
        table.style.maxWidth = '100%';
        table.style.margin = '10px auto';
      });
      
      console.log('✅ DOCX rendered successfully');
      this.docxLoading = false;
    } catch (error) {
      console.error('Error rendering DOCX:', error);
      this.docxError = true;
      this.docxLoading = false;
    }
  }
}

