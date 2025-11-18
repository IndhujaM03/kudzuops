import { Component, OnInit, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HrService, OnboardingDetailResponse } from '../../services/hr.service';
import { environment } from '../../environments/environment';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-hr-onboarding',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-container">
      <section class="onboarding-table-card">
        <header class="table-card-header">
          <div class="table-title">Candidate Onboarding</div>
        </header>

        <!-- Tab Navigation -->
        <div class="tab-navigation">
          <button
            class="tab-button"
            [class.active]="activeTab() === 'pending'"
            (click)="switchTab('pending')"
          >
            Pending Onboarding
            <span class="tab-count" *ngIf="pendingCount() > 0">({{ pendingCount() }})</span>
          </button>
          <button
            class="tab-button"
            [class.active]="activeTab() === 'completed'"
            (click)="switchTab('completed')"
          >
            Completed Onboarding
            <span class="tab-count" *ngIf="completedCount() > 0">({{ completedCount() }})</span>
          </button>
        </div>

        <div *ngIf="errorMessage()" class="table-alert error">
          {{ errorMessage() }}
        </div>

        <div *ngIf="isLoading()" class="table-alert muted">
          Loading onboarding data...
        </div>

        <!-- Pending Onboarding Tab -->
        <div *ngIf="activeTab() === 'pending' && !isLoading() && !errorMessage()">
          <div *ngIf="pendingRows().length" class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Candidate Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Generate Link</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let record of pendingRows(); let i = index">
                  <td>{{ i + 1 }}</td>
                  <td>{{ formatCell(getRecordValue(record, 'candidate_name')) }}</td>
                  <td>{{ formatCell(getRecordValue(record, 'candidate_email')) }}</td>
                  <td>{{ formatCell(getRecordValue(record, 'candidate_phone')) }}</td>
                  <td>
                    <button
                      class="btn primary small"
                      (click)="handleGenerateLink(record)"
                      [disabled]="isGenerating(record)"
                    >
                      {{ isGenerating(record) ? 'Generating...' : 'Generate Link' }}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="!isLoading() && !errorMessage() && pendingRows().length === 0" class="table-empty">
            No pending onboarding records.
          </div>
        </div>

        <!-- Completed Onboarding Tab -->
        <div *ngIf="activeTab() === 'completed' && !isLoading() && !errorMessage()">
          <div *ngIf="completedRows().length" class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Candidate Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>View Form Data</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let record of completedRows(); let i = index">
                  <td>{{ i + 1 }}</td>
                  <td>{{ formatCell(getRecordValue(record, 'candidate_name')) }}</td>
                  <td>{{ formatCell(getRecordValue(record, 'candidate_email')) }}</td>
                  <td>{{ formatCell(getRecordValue(record, 'candidate_phone')) }}</td>
                  <td>
                    <button class="btn primary small" (click)="openOnboardingModal(record)">
                      View Form Data
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="!isLoading() && !errorMessage() && completedRows().length === 0" class="table-empty">
            No completed onboarding records.
          </div>
        </div>
      </section>

      <div *ngIf="isOnboardingModalOpen()" class="modal-overlay" (click)="closeOnboardingModal()">
        <div class="modal onboarding-modal" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>Onboarding Form Data</h3>
            <div class="modal-header-actions">
              <button class="close-btn" (click)="closeOnboardingModal()">×</button>
            </div>
          </header>
          <ng-container *ngIf="isOnboardingDetailLoading(); else detailLoaded">
            <div class="modal-body">
              <div class="detail-loading">Loading onboarding details...</div>
            </div>
          </ng-container>
          <ng-template #detailLoaded>
            <div class="modal-body" *ngIf="onboardingDetail() as detail; else noDetail">
            <div class="detail-section">
              <div class="detail-heading">Candidate Information</div>
              <div class="detail-row">
                  <div class="detail-label">Name</div>
                  <div class="detail-value">{{ formatCell(detail.candidate_name) }}</div>
              </div>
              <div class="detail-row">
                  <div class="detail-label">Email</div>
                  <div class="detail-value">{{ formatCell(detail.candidate_email) }}</div>
              </div>
              <div class="detail-row">
                  <div class="detail-label">Phone</div>
                  <div class="detail-value">{{ formatCell(detail.candidate_phone) }}</div>
                </div>
                <div class="detail-row">
                  <div class="detail-label">Status</div>
                  <div class="detail-value">
                    <span class="status-pill" [class.completed]="(detail.status || '').toLowerCase() === 'completed'">
                      {{ (detail.status || 'pending') | titlecase }}
                    </span>
                  </div>
                </div>
                <div class="detail-row" *ngIf="detail.generated_link">
                  <div class="detail-label">Candidate Link</div>
                  <div class="detail-value">
                    <button class="clipboard-btn" (click)="copyLink(detail.generated_link)" title="Copy link">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
              </div>
            </div>

            <div class="detail-section">
                <div class="detail-heading">Documents</div>
                <ng-container *ngIf="detail.documents; else pendingDocs">
                  <div class="document-grid">
                    <div class="document-row">
                      <div class="document-label">Passport Photo</div>
                      <button
                        *ngIf="detail.documents?.passport_photo as url"
                        class="view-doc-btn"
                        (click)="openDocumentPreview(url, 'Passport Photo')"
                      >
                        View
                      </button>
                      <span *ngIf="!detail.documents?.passport_photo">—</span>
                    </div>
                    <div class="document-row">
                      <div class="document-label">Updated Resume</div>
                      <button
                        *ngIf="detail.documents?.updated_resume as url"
                        class="view-doc-btn"
                        (click)="openDocumentPreview(url, 'Updated Resume')"
                      >
                        View
                      </button>
                      <span *ngIf="!detail.documents?.updated_resume">—</span>
                        </div>
                    <div class="document-row">
                      <div class="document-label">Education Details</div>
                      <div class="document-value">{{ readableDetails(detail.documents?.education_details) }}</div>
                      </div>
                    <div class="document-row">
                      <div class="document-label">Employee Details</div>
                      <div class="document-value">{{ readableDetails(detail.documents?.employee_details) }}</div>
                    </div>
                    <div class="document-row" *ngIf="additionalDocuments(detail).length">
                      <div class="document-label">Additional Documents</div>
                      <div class="document-value">
                        <div class="extra-doc" *ngFor="let doc of additionalDocuments(detail)">
                          <span>{{ doc.doc_name || 'Document' }}</span>
                          <button *ngIf="doc.url" class="view-doc-btn" (click)="openDocumentPreview(doc.url, doc.doc_name || 'Document')">View</button>
                        </div>
                      </div>
                  </div>
                </div>
              </ng-container>
                <ng-template #pendingDocs>
                  <div class="pending-docs">Candidate has not submitted the form yet.</div>
              </ng-template>
            </div>

            </div>
            <ng-template #noDetail>
              <div class="modal-body">
                <div class="detail-loading">Unable to load onboarding details.</div>
          </div>
            </ng-template>
          </ng-template>
        </div>
      </div>
      <div *ngIf="isCvModalOpen() && cvPreviewUrl()" class="modal-overlay" (click)="closeCvModal()">
        <div class="modal cv-modal" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>CV Preview</h3>
            <button class="close-btn" (click)="closeCvModal()">×</button>
          </header>
          <div class="modal-body cv-modal-body">
            <iframe [src]="cvPreviewUrl()" title="CV Preview" loading="lazy"></iframe>
          </div>
        </div>
      </div>

      <div *ngIf="isDocumentPreviewOpen()" class="modal-overlay" (click)="closeDocumentPreview()">
        <div class="modal document-preview-modal" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>{{ documentPreviewTitle() }}</h3>
            <button class="close-btn" (click)="closeDocumentPreview()">×</button>
          </header>
          <div class="modal-body document-preview-body">
            <ng-container *ngIf="documentPreviewUrl() as url">
              <!-- PDF via iframe -->
              <iframe 
                *ngIf="isPdfFile(url) && documentPreviewSafeUrl()" 
                [src]="documentPreviewSafeUrl()" 
                class="document-iframe" 
                allow="fullscreen" 
                allowfullscreen
                (error)="onDocumentPreviewError($event)"
                title="Document Preview">
              </iframe>
              
              <!-- Images -->
              <div *ngIf="isImageFile(url)" class="image-preview">
                <img [src]="resolveDocumentUrl(url)" [alt]="documentPreviewTitle()" />
              </div>
              
              <!-- DOCX/DOC renderer host -->
              <div *ngIf="isDocxFile(url) && !documentPreviewSafeUrl()" #docxHost class="docx-host"></div>
              
              <!-- Loading state -->
              <div *ngIf="documentPreviewLoading()" class="document-loading">
                Loading document...
              </div>
              
              <!-- Error state for .doc files -->
              <div *ngIf="documentPreviewError() && isDocFile(url)" class="docx-error">
                <p>.doc files cannot be previewed in the browser.</p>
                <a [href]="resolveDocumentUrl(url)" target="_blank" class="download-btn">Download Document</a>
              </div>
              
              <!-- Error state for other files -->
              <div *ngIf="documentPreviewError() && !isDocFile(url)" class="document-error">
                <p>Failed to load document. Please try downloading it.</p>
                <a [href]="resolveDocumentUrl(url)" target="_blank" class="download-btn">Download Document</a>
              </div>
            </ng-container>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .onboarding-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 24px;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .btn {
      border-radius: 10px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 600;
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .btn.primary {
      background: var(--kudzu-primary);
      color: #fff;
      border-color: transparent;
    }

    .btn.ghost {
      background: transparent;
      color: var(--kudzu-primary);
      border-color: rgba(15, 23, 42, 0.1);
    }

    .btn.small {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
    }

    .card-subtext {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 20px;
    }

    .onboarding-table-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      border: 1px solid rgba(15, 23, 42, 0.06);
      padding: 24px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .table-card-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      flex-wrap: wrap;
    }

    .table-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }

    .table-subtitle {
      font-size: 14px;
      color: #94a3b8;
    }

    .tab-navigation {
      display: flex;
      gap: 8px;
      border-bottom: 2px solid rgba(15, 23, 42, 0.08);
      margin-bottom: 20px;
    }

    .tab-button {
      padding: 12px 24px;
      background: transparent;
      border: none;
      border-bottom: 3px solid transparent;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      bottom: -2px;
    }

    .tab-button:hover {
      color: var(--kudzu-primary);
      background: rgba(37, 99, 235, 0.04);
    }

    .tab-button.active {
      color: var(--kudzu-primary);
      border-bottom-color: var(--kudzu-primary);
    }

    .tab-count {
      font-size: 12px;
      font-weight: 500;
      color: #94a3b8;
      margin-left: 4px;
    }

    .tab-button.active .tab-count {
      color: var(--kudzu-primary);
    }

    .table-alert {
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }

    .table-alert.error {
      background: rgba(248, 113, 113, 0.15);
      color: #b91c1c;
      border: 1px solid rgba(248, 113, 113, 0.4);
    }

    .table-alert.muted {
      background: rgba(59, 130, 246, 0.08);
      color: #1d4ed8;
      border: 1px dashed rgba(59, 130, 246, 0.4);
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 14px;
      color: #0f172a;
    }

    thead th {
      background: rgba(15, 23, 42, 0.04);
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.08em;
      font-weight: 600;
    }

    th,
    td {
      text-align: left;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.3);
      white-space: nowrap;
    }

    tbody tr:hover {
      background: rgba(15, 23, 42, 0.02);
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .table-empty {
      padding: 24px;
      text-align: center;
      color: #94a3b8;
      font-weight: 500;
    }

    .round-chip-group {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .round-chip {
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.12);
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 600;
    }

    .cv-column {
      text-align: center;
      width: 90px;
    }

    .process-column {
      min-width: 220px;
    }

    .process-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(251, 191, 36, 0.18);
      color: #92400e;
      font-size: 12px;
      font-weight: 700;
      text-transform: capitalize;
    }

    .status-pill.completed {
      background: rgba(34, 197, 94, 0.18);
      color: #047857;
    }

    .onboarding-icon-button {
      border: none;
      background: transparent;
      padding: 6px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #475569;
      transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
    }

    .onboarding-icon-button:hover {
      background: rgba(148, 163, 184, 0.15);
      color: var(--kudzu-primary);
      transform: translateY(-1px);
    }

    .onboarding-icon-button svg {
      width: 16px;
      height: 16px;
      stroke-width: 2;
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
      width: min(640px, 100%);
    .onboarding-modal {
      width: min(780px, 100%);
    }

    .modal-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

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

    .close-btn {
      background: none;
      border: none;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      color: #0f172a;
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
    }

    .detail-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }

    .detail-heading {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0f172a;
    }

    .detail-row {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-label {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .detail-value {
      font-size: 14px;
      color: #0f172a;
      word-break: break-word;
    }


    .document-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .document-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      padding-bottom: 8px;
    }

    .document-label {
      font-weight: 600;
      color: #0f172a;
    }

    .document-value {
      flex: 1;
      font-size: 13px;
      color: #475569;
    }

    .extra-doc {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 0;
    }

    .pending-docs {
      color: #94a3b8;
      font-size: 13px;
    }

    .clipboard-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      background: transparent;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 8px;
      cursor: pointer;
      color: #475569;
      transition: all 0.2s ease;
    }

    .clipboard-btn:hover {
      background: rgba(37, 99, 235, 0.08);
      border-color: rgba(37, 99, 235, 0.4);
      color: #2563eb;
      transform: translateY(-1px);
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

    .detail-loading {
      text-align: center;
      color: #475569;
      font-weight: 600;
    }

    .document-preview-modal {
      width: min(90vw, 1000px);
      max-height: 90vh;
    }

    .document-preview-body {
      padding: 0;
      height: calc(90vh - 80px);
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8fafc;
      position: relative;
    }

    .document-iframe {
      width: 100%;
      height: 100%;
      border: none;
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

    .docx-host {
      width: 100%;
      height: 100%;
      overflow-y: auto;
      padding: 20px;
      background: #fff;
    }

    .docx-host :global(.docx) {
      max-width: 100%;
    }

    .docx-host :global(table) {
      max-width: 100%;
      margin: 10px auto;
    }

    .document-loading {
      text-align: center;
      padding: 40px;
      color: #64748b;
      font-size: 16px;
      font-weight: 500;
    }

    .document-error,
    .docx-error {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;
    }

    .document-error p,
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

    .cv-modal {
      width: min(900px, 100%);
    }

    .cv-modal-body {
      height: 75vh;
      padding: 0;
    }

    .cv-modal-body iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #f8fafc;
    }
  `]
})
export class HrOnboardingComponent implements OnInit {
  private hrService = inject(HrService);
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastService);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  onboardingRows = signal<Array<Record<string, unknown>>>([]);
  pendingRows = signal<Array<Record<string, unknown>>>([]);
  completedRows = signal<Array<Record<string, unknown>>>([]);
  pendingCount = signal(0);
  completedCount = signal(0);
  activeTab = signal<'pending' | 'completed'>('pending');
  totalOnboardingRecords = signal(0);
  cvPreviewUrl = signal<SafeResourceUrl | null>(null);
  isCvModalOpen = signal(false);
  generatingCandidateId = signal<number | null>(null);
  isOnboardingModalOpen = signal(false);
  isOnboardingDetailLoading = signal(false);
  onboardingDetail = signal<OnboardingDetailResponse | null>(null);
  documentPreviewUrl = signal<string | null>(null);
  documentPreviewTitle = signal<string>('');
  documentPreviewSafeUrl = signal<SafeResourceUrl | null>(null);
  documentPreviewLoading = signal(false);
  documentPreviewError = signal(false);
  isDocumentPreviewOpen = signal(false);
  @ViewChild('docxHost') docxHostRef!: ElementRef;

  ngOnInit(): void {
    this.loadOnboardingData();
  }

  refreshOnboarding(): void {
    this.loadOnboardingData();
  }

  switchTab(tab: 'pending' | 'completed'): void {
    this.activeTab.set(tab);
    // Data is already loaded, just switch the view
  }

  private loadOnboardingData(limit: number = 100, offset: number = 0): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    let pendingLoaded = false;
    let completedLoaded = false;
    
    const checkComplete = () => {
      if (pendingLoaded && completedLoaded) {
        this.isLoading.set(false);
      }
    };

    // Load pending records
    this.hrService.getOnboardingRecords(limit, offset, undefined, true).subscribe({
      next: (response) => {
        const rows = response?.items ?? [];
        this.pendingRows.set(rows);
        this.pendingCount.set(response?.total ?? rows.length);
        pendingLoaded = true;
        checkComplete();
      },
      error: (error) => {
        console.error('Failed to load pending onboarding records', error);
        const detail = error?.error?.detail || 'Unable to fetch pending onboarding data.';
        if (!this.errorMessage()) {
          this.errorMessage.set(detail);
        }
        this.pendingRows.set([]);
        this.pendingCount.set(0);
        pendingLoaded = true;
        checkComplete();
      }
    });

    // Load completed records
    this.hrService.getOnboardingRecords(limit, offset, 'completed', false).subscribe({
      next: (response) => {
        const rows = response?.items ?? [];
        this.completedRows.set(rows);
        this.completedCount.set(response?.total ?? rows.length);
        completedLoaded = true;
        checkComplete();
      },
      error: (error) => {
        console.error('Failed to load completed onboarding records', error);
        const detail = error?.error?.detail || 'Unable to fetch completed onboarding data.';
        if (!this.errorMessage()) {
          this.errorMessage.set(detail);
        }
        this.completedRows.set([]);
        this.completedCount.set(0);
        completedLoaded = true;
        checkComplete();
      }
    });
  }

  getRecordValue(record: Record<string, unknown>, column: string): unknown {
    return record ? record[column] : undefined;
  }

  formatCell(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (this.isIsoDate(trimmed)) {
        const parsed = new Date(trimmed);
        return isNaN(parsed.getTime()) ? trimmed : parsed.toLocaleString();
      }
      return trimmed;
    }

    if (value instanceof Date) {
      return value.toLocaleString();
    }

    if (typeof value === 'number') {
      return value.toLocaleString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private isIsoDate(value: string): boolean {
    const isoPattern = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
    return isoPattern.test(value);
  }

  closeCvModal(): void {
    this.isCvModalOpen.set(false);
    this.cvPreviewUrl.set(null);
  }

  openCvPreview(record: Record<string, unknown>): void {
    const path = this.getRecordValue(record, 'cv_path');
    if (typeof path !== 'string' || !path.trim()) {
      this.closeCvModal();
      return;
    }
    const resolved = this.resolveCvUrl(path.trim());
    this.cvPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(resolved));
    this.isCvModalOpen.set(true);
  }

  private resolveCvUrl(cvPath: string): string {
    const normalizedPath = cvPath.replace(/\\/g, '/');

    if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
      return normalizedPath;
    }

    // CV files are served directly, not under /api
    if (normalizedPath.startsWith('/cv-files/')) {
      const baseUrl = environment.apiBase.replace('/api', '');
      return `${baseUrl}${normalizedPath}`;
    }

    if (normalizedPath.startsWith('cv-files/')) {
      const baseUrl = environment.apiBase.replace('/api', '');
      return `${baseUrl}/${normalizedPath}`;
    }

    const cvUploadsMarker = 'src/assets/cv_uploads';
    const uploadIndex = normalizedPath.indexOf(cvUploadsMarker);
    if (uploadIndex !== -1) {
      const relativeSegment = normalizedPath
        .slice(uploadIndex + cvUploadsMarker.length)
        .replace(/^\/+/, '');
      // CV files are served directly, not under /api
      const baseUrl = environment.apiBase.replace('/api', '');
      return `${baseUrl}/cv-files/${relativeSegment}`;
    }

    // If path already looks like a relative path to cv-files, use it directly
    if (normalizedPath.includes('/cv_uploads/') || normalizedPath.match(/^\d+\/\d+\//)) {
      // Extract recruiter_id/demand_id/filename pattern
      const match = normalizedPath.match(/(\d+)\/(\d+)\/(.+)$/);
      if (match) {
        const baseUrl = environment.apiBase.replace('/api', '');
        return `${baseUrl}/cv-files/${match[1]}/${match[2]}/${match[3]}`;
      }
    }

    if (normalizedPath.startsWith('/')) {
      const baseUrl = environment.apiBase.replace('/api', '');
      return `${baseUrl}${normalizedPath}`;
    }

    const baseUrl = environment.apiBase.replace('/api', '');
    return `${baseUrl}/${normalizedPath}`;
  }

  hasGeneratedLink(record: Record<string, unknown>): boolean {
    const link = this.getRecordValue(record, 'generated_link');
    return typeof link === 'string' && !!link.trim();
  }

  handleGenerateLink(record: Record<string, unknown>): void {
    const candidateId = this.getRecordId(record);
    if (!candidateId || this.generatingCandidateId() === candidateId) {
      return;
    }
    this.generatingCandidateId.set(candidateId);
    this.hrService.generateOnboardingLink(candidateId).subscribe({
      next: (response) => {
        this.toast.success('Onboarding link generated and shared with the candidate.');
        this.updateRowAfterLink(candidateId, response.generated_link, response.status);
        this.generatingCandidateId.set(null);
      },
      error: (error) => {
        const detail = error?.error?.detail || 'Failed to generate onboarding link.';
        this.toast.error(detail);
        this.generatingCandidateId.set(null);
      },
    });
  }

  private updateRowAfterLink(candidateId: number, link: string, status: string): void {
    // Remove from pending and refresh data
    const updatedPending = this.pendingRows().filter((row) => {
      const rowId = this.getRecordId(row);
      return rowId !== candidateId;
    });
    this.pendingRows.set(updatedPending);
    this.pendingCount.set(updatedPending.length);
    
    // Reload data to ensure consistency
    this.loadOnboardingData();
  }

  isGenerating(record: Record<string, unknown>): boolean {
    const candidateId = this.getRecordId(record);
    return !!candidateId && this.generatingCandidateId() === candidateId;
  }

  formatStatusLabel(record: Record<string, unknown>): string {
    const status = (this.getRecordValue(record, 'status') as string)?.toLowerCase() || 'pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  isStatusCompleted(record: Record<string, unknown>): boolean {
    const status = (this.getRecordValue(record, 'status') as string)?.toLowerCase();
    return status === 'completed';
  }

  openOnboardingModal(record: Record<string, unknown>): void {
    const candidateId = this.getRecordId(record);
    if (!candidateId) {
      return;
    }
    this.isOnboardingModalOpen.set(true);
    this.fetchOnboardingDetail(candidateId);
  }

  private fetchOnboardingDetail(candidateId: number): void {
    this.isOnboardingDetailLoading.set(true);
    this.onboardingDetail.set(null);
    this.hrService.getOnboardingRecordDetails(candidateId).subscribe({
      next: (detail) => {
        this.onboardingDetail.set(detail);
        this.isOnboardingDetailLoading.set(false);
      },
      error: (error) => {
        const detailMessage = error?.error?.detail || 'Unable to load onboarding details.';
        this.toast.error(detailMessage);
        this.isOnboardingDetailLoading.set(false);
      },
    });
  }

  closeOnboardingModal(): void {
    this.isOnboardingModalOpen.set(false);
    this.onboardingDetail.set(null);
  }

  copyLink(link: string): void {
    if (!link) return;
    if (!navigator?.clipboard) {
      this.toast.warning('Copy not supported in this browser. Please copy the link manually.');
      return;
    }
    navigator.clipboard.writeText(link).then(
      () => this.toast.success('Link Copied'),
      () => this.toast.error('Unable to copy link. Please copy it manually.')
    );
  }

  openDocumentPreview(url: string, title: string): void {
    this.documentPreviewUrl.set(url);
    this.documentPreviewTitle.set(title);
    this.documentPreviewError.set(false);
    this.documentPreviewLoading.set(false);
    this.isDocumentPreviewOpen.set(true);
    
    const lower = url.toLowerCase();
    
    if (this.isPdfFile(url)) {
      // PDF via iframe
      this.documentPreviewSafeUrl.set(this.getSafeDocumentUrl(url));
      this.documentPreviewLoading.set(false);
    } else if (lower.endsWith('.docx')) {
      // DOCX via docx-preview
      this.documentPreviewSafeUrl.set(null);
      setTimeout(() => this.renderDocx(url), 0);
    } else if (lower.endsWith('.doc')) {
      // .doc not supported
      this.documentPreviewSafeUrl.set(null);
      this.documentPreviewError.set(true);
      this.documentPreviewLoading.set(false);
    } else if (this.isImageFile(url)) {
      // Images
      this.documentPreviewSafeUrl.set(null);
      this.documentPreviewLoading.set(false);
    } else {
      // Unknown type, try docx renderer
      this.documentPreviewSafeUrl.set(null);
      setTimeout(() => this.renderDocx(url), 0);
    }
  }

  closeDocumentPreview(): void {
    this.isDocumentPreviewOpen.set(false);
    this.documentPreviewUrl.set(null);
    this.documentPreviewTitle.set('');
    this.documentPreviewSafeUrl.set(null);
    this.documentPreviewError.set(false);
    this.documentPreviewLoading.set(false);
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

  isDocFile(url: string): boolean {
    if (!url) return false;
    return url.toLowerCase().endsWith('.doc');
  }

  onDocumentPreviewError(event: any): void {
    console.error('❌ Document preview failed to load:', event);
    this.documentPreviewError.set(true);
    this.documentPreviewLoading.set(false);
    this.toast.error('Failed to load document. Please check if the file exists.');
  }

  private async renderDocx(url: string): Promise<void> {
    try {
      this.documentPreviewLoading.set(true);
      this.documentPreviewError.set(false);
      
      const host = this.docxHostRef?.nativeElement;
      if (!host) {
        console.error('Document host element not found');
        this.documentPreviewError.set(true);
        this.documentPreviewLoading.set(false);
        return;
      }
      
      const lower = url.toLowerCase();
      const isOldDoc = lower.endsWith('.doc');
      
      if (isOldDoc) {
        // .doc files can't be previewed by browsers
        this.documentPreviewLoading.set(false);
        this.documentPreviewError.set(true);
        return;
      }
      
      // Resolve the full URL
      const fileUrl = this.resolveDocumentUrl(url);
      console.log('🔍 Loading document from:', fileUrl);
      
      // Fetch the file for .docx
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }
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
      this.documentPreviewLoading.set(false);
    } catch (error) {
      console.error('Error rendering document:', error);
      this.documentPreviewError.set(true);
      this.documentPreviewLoading.set(false);
      this.toast.error('Failed to render document. Please try downloading it.');
    }
  }

  getSafeDocumentUrl(url: string): SafeResourceUrl {
    const resolved = this.resolveDocumentUrl(url);
    return this.sanitizer.bypassSecurityTrustResourceUrl(resolved);
  }

  resolveDocumentUrl(path: unknown): string {
    if (typeof path !== 'string' || !path) {
      return '';
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Onboarding files are served directly, not under /api
    if (path.startsWith('/onboarding-files/')) {
      const baseUrl = environment.apiBase.replace('/api', '');
      return `${baseUrl}${path}`;
    }
    return `${environment.apiBase}${path.startsWith('/') ? path : `/${path}`}`;
  }

  readableDetails(value: unknown): string {
    if (value === null || value === undefined || value === '') {
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

  additionalDocuments(detail: OnboardingDetailResponse | null): Array<{ doc_name?: string; url?: string }> {
    const docs = detail?.documents as Record<string, unknown> | null;
    if (!docs) return [];
    const extras = docs['additional_documents'];
    if (Array.isArray(extras)) {
      return extras as Array<{ doc_name?: string; url?: string }>;
    }
    if (extras && typeof extras === 'object') {
      // Handle dictionary format: { "Document Name": "url" }
      return Object.entries(extras as Record<string, string>).map(([name, url]) => ({
        doc_name: name,
        url: url,
      }));
    }
    // Check for additional_documents_list as fallback
    const extrasList = docs['additional_documents_list'];
    if (Array.isArray(extrasList)) {
      return extrasList as Array<{ doc_name?: string; url?: string }>;
    }
    return [];
  }

  getInterviewRounds(record: Record<string, unknown>): string[] {
    const schedules = this.parseInterviewSchedules(record);
    if (!schedules) return [];
    const rounds: string[] = [];
    for (const [roundKey, roundValue] of Object.entries<any>(schedules)) {
      if (Number(roundValue?.round_status) === 2) {
        rounds.push(this.formatRound(roundKey));
      }
    }
    return rounds;
  }

  private parseInterviewSchedules(record: Record<string, unknown>): Record<string, unknown> | null {
    const raw = this.getRecordValue(record, 'interview_schedules');
    if (!raw) return null;

    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    return typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  }

  private formatRound(roundKey: string): string {
    if (!roundKey) return 'Round';
    return roundKey
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private getRecordId(record: Record<string, unknown>): number | null {
    const id = this.getRecordValue(record, 'id');
    if (typeof id === 'number') {
      return id;
    }
    if (typeof id === 'string' && id.trim()) {
      const parsed = Number(id);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }
}

