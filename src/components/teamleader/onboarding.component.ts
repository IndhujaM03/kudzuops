import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

interface CandidateOnboarding {
  id: number;
  demand_id: number;
  client_id?: number;
  client_name?: string;
  candidate_name: string;
  candidate_email?: string;
  candidate_phone?: string;
  recruiter_id?: number;
  interview_schedules?: string | any;
  cv_path?: string;
  skill?: string;
  created_at?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-page">
      <div class="max-w-7xl mx-auto px-4">
        <!-- Header -->
        <div class="onboarding-header" style="background:rgba(255, 255, 255, 0.8);backdrop-filter:blur(10px);border:1px solid rgba(24, 45, 23, 0.1);border-radius:12px;box-shadow:0 4px 10px rgba(24, 45, 23, 0.1);padding:20px;margin-bottom:20px;">
          <h2 style="margin:0;font-size:24px;font-weight:700;color:var(--kudzu-primary);">
            Candidate Onboarding
          </h2>
        </div>

        <div *ngIf="errorMsg()" class="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700">
          {{ errorMsg() }}
        </div>

        <div *ngIf="loading()" class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p class="mt-2 text-gray-600">Loading onboarding records...</p>
        </div>

        <!-- Table -->
        <div *ngIf="!loading() && onboardingRecords().length === 0" class="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p class="text-gray-500">No onboarding records found.</p>
        </div>

        <div *ngIf="!loading() && onboardingRecords().length > 0" class="table-wrapper">
          <table class="glassy-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Candidate Name</th>
                <th>Candidate Email</th>
                <th>Candidate Phone</th>
                <th>Client Name</th>
                <th>Demand ID</th>
                <th>Skills</th>
                <th>Interview Rounds</th>
                <th>CV</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let record of onboardingRecords(); let i = index">
                <td>{{ i + 1 }}</td>
                <td>{{ record.candidate_name || 'N/A' }}</td>
                <td>{{ record.candidate_email || 'N/A' }}</td>
                <td>{{ record.candidate_phone || 'N/A' }}</td>
                <td>{{ record.client_name || 'N/A' }}</td>
                <td>{{ record.demand_id }}</td>
                <td>{{ record.skill || '—' }}</td>
                <td>
                  <div class="rounds-info" *ngIf="getInterviewRounds(record.interview_schedules).length > 0">
                    <span *ngFor="let round of getInterviewRounds(record.interview_schedules)" 
                          class="round-badge">
                      {{ round }}
                    </span>
                  </div>
                  <span *ngIf="getInterviewRounds(record.interview_schedules).length === 0">N/A</span>
                </td>
                <td>
                  <button *ngIf="record.cv_path" 
                          (click)="openCv(record.cv_path, record)" 
                          class="cv-icon-btn"
                          title="View CV">
                    <svg class="cv-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <span *ngIf="!record.cv_path" class="text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- CV File Modal Popup -->
    <div *ngIf="showCvModal()" class="modal-overlay cv-modal-overlay" (click)="closeCvModal()">
      <div class="cv-modal-content" (click)="$event.stopPropagation()">
        <div class="cv-modal-header">
          <h3 class="cv-modal-title">CV File</h3>
          <button class="modal-close" (click)="closeCvModal()">✕</button>
        </div>
        <div class="cv-modal-body">
          <div *ngIf="selectedCvUrl(); else noUrl" class="cv-iframe-wrapper">
            <iframe 
              [src]="sanitizeUrl(selectedCvUrl())"
              class="cv-iframe"
              frameborder="0">
            </iframe>
          </div>
          <ng-template #noUrl>
            <div class="cv-error">CV file not available</div>
          </ng-template>
        </div>
        <div class="cv-modal-footer">
          <button class="btn-download" (click)="openCvInNewWindow()" *ngIf="selectedCvUrl()">
            Download CV
          </button>
          <button class="btn-close" (click)="closeCvModal()">
            Close
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .onboarding-page {
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
      min-height: 100vh;
      padding: 20px 0;
    }

    .table-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    .glassy-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
    }

    .glassy-table thead th {
      text-align: left;
      font-weight: 600;
      color: #0f172a;
      padding: 12px 14px;
      border-bottom: 1px solid #eef2f7;
      background: #f9fafb;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .glassy-table tbody td {
      padding: 12px 14px;
      border-top: 1px solid #eef2f7;
      color: #111827;
      vertical-align: middle;
      background: white;
    }

    .glassy-table tbody tr:last-child td {
      border-bottom: none;
    }

    .rounds-info {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .round-badge {
      display: inline-block;
      padding: 4px 10px;
      background: #dbeafe;
      color: #1e40af;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .cv-icon-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s ease;
      color: var(--kudzu-primary);
    }

    .cv-icon-btn:hover {
      background: rgba(24, 45, 23, 0.1);
      transform: scale(1.1);
    }

    .cv-icon {
      width: 20px;
      height: 20px;
      color: var(--kudzu-primary);
    }

    /* CV Modal Styles - Kudzu Theme */
    .modal-overlay.cv-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    }

    .cv-modal-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(24, 45, 23, 0.2);
      max-width: 75vw;
      width: 75vw;
      max-height: 85vh;
      height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      z-index: 10001;
      border: 1px solid rgba(24, 45, 23, 0.1);
    }

    .cv-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--kudzu-primary);
      border-radius: 12px 12px 0 0;
    }

    .cv-modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: white;
    }

    .cv-modal-header .modal-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      cursor: pointer;
      padding: 6px 10px;
      color: white;
      font-size: 20px;
      border-radius: 6px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      line-height: 1;
    }

    .cv-modal-header .modal-close:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }

    .cv-modal-body {
      padding: 0;
      flex: 1;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
    }

    .cv-iframe-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cv-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
      min-height: 400px;
    }

    .cv-error {
      padding: 40px;
      text-align: center;
      color: #6b7280;
      font-size: 16px;
    }

    .cv-modal-footer {
      padding: 14px 20px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      border-radius: 0 0 12px 12px;
    }

    .btn-download,
    .btn-close {
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-download {
      background: var(--kudzu-primary);
      color: white;
    }

    .btn-download:hover {
      background: var(--kudzu-primary-dark, #182d17);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(24, 45, 23, 0.2);
    }

    .btn-close {
      background: #e5e7eb;
      color: #374151;
    }

    .btn-close:hover {
      background: #d1d5db;
    }

    @media (max-width: 768px) {
      .cv-modal-content {
        max-width: 95vw;
        width: 95vw;
        max-height: 90vh;
        height: 90vh;
      }
      .glassy-table {
        font-size: 12px;
      }

      .glassy-table th,
      .glassy-table td {
        padding: 8px 10px;
      }
    }
  `]
})
export class OnboardingComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  apiBase = environment.apiBase || '';
  loading = signal(false);
  errorMsg = signal<string | null>(null);
  onboardingRecords = signal<CandidateOnboarding[]>([]);
  
  // CV Modal state
  showCvModal = signal(false);
  selectedCvUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.loadOnboardingRecords();
  }

  loadOnboardingRecords(): void {
    this.loading.set(true);
    this.errorMsg.set(null);

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.get<{ items: CandidateOnboarding[] }>(`${this.apiBase}/candidate-onboarding/all`, { headers }).subscribe({
      next: (response) => {
        this.onboardingRecords.set(response.items || []);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load onboarding records:', error);
        this.errorMsg.set(`Failed to load onboarding records: ${error.error?.detail || error.message}`);
        this.loading.set(false);
      }
    });
  }

  getInterviewRounds(interviewSchedules: string | any): string[] {
    if (!interviewSchedules) return [];
    
    let schedules: any = {};
    if (typeof interviewSchedules === 'string') {
      try {
        schedules = JSON.parse(interviewSchedules);
      } catch (e) {
        return [];
      }
    } else {
      schedules = interviewSchedules;
    }

    return Object.keys(schedules).filter(key => schedules[key] && schedules[key].round_status === 2);
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  }

  openCv(cvPath: string, record: CandidateOnboarding): void {
    if (!cvPath) {
      this.errorMsg.set('CV path is not available');
      return;
    }
    
    const apiBase = this.apiBase || '';
    let cvUrl = '';
    
    // Try to extract recruiter_id and demand_id from the path or use record data
    // Path formats could be:
    // 1. src/assets/cv_uploads/{recruiter_id}/{demand_id}/{filename}
    // 2. {recruiter_id}/{demand_id}/{filename}
    // 3. Just filename (use record.demand_id and record.recruiter_id)
    // 4. Full absolute path
    
    let recruiterId = record.recruiter_id;
    let demandId = record.demand_id;
    let filename = '';
    
    // Normalize path separators
    const normalizedPath = cvPath.replace(/\\/g, '/').trim();
    
    // Try to parse the path
    const pathParts = normalizedPath.split('/').filter(part => part.length > 0);
    
    // Check if path contains recruiter_id and demand_id
    // Look for pattern: .../recruiter_id/demand_id/filename
    if (pathParts.length >= 3) {
      for (let i = 0; i <= pathParts.length - 3; i++) {
        const part1 = pathParts[i];
        const part2 = pathParts[i + 1];
        const part3 = pathParts[i + 2];
        
        // Check if part1 and part2 are numeric (likely recruiter_id and demand_id)
        if (!isNaN(Number(part1)) && !isNaN(Number(part2)) && part3) {
          recruiterId = Number(part1);
          demandId = Number(part2);
          filename = part3;
          break;
        }
      }
    }
    
    // If we couldn't parse, try to extract just the filename
    if (!filename && pathParts.length > 0) {
      filename = pathParts[pathParts.length - 1];
    }
    
    // If we still don't have recruiter_id or demand_id, use from record
    if (!recruiterId || !demandId) {
      recruiterId = record.recruiter_id;
      demandId = record.demand_id;
    }
    
    // Construct URL using the cv-file endpoint
    // The endpoint is at /api/cv-file/{recruiter_id}/{demand_id}/{filename}
    if (recruiterId && demandId && filename) {
      // Encode filename for URL (handle spaces and special characters)
      // But preserve forward slashes if filename contains path segments
      const encodedFilename = filename.split('/').map(part => encodeURIComponent(part)).join('/');
      cvUrl = `${apiBase}/cv-file/${recruiterId}/${demandId}/${encodedFilename}`;
    } else {
      // Fallback: try to use the path as-is with cv-files endpoint
      if (normalizedPath.startsWith('src/assets/cv_uploads/')) {
        const relativePath = normalizedPath.replace('src/assets/cv_uploads/', '');
        cvUrl = `${apiBase}/cv-files/${relativePath}`;
      } else if (normalizedPath.startsWith('/')) {
        cvUrl = `${apiBase}/cv-files${normalizedPath}`;
      } else {
        cvUrl = `${apiBase}/cv-files/${normalizedPath}`;
      }
    }
    
    // Open in modal instead of new window
    this.selectedCvUrl.set(cvUrl);
    this.showCvModal.set(true);
  }

  closeCvModal(): void {
    this.showCvModal.set(false);
    this.selectedCvUrl.set(null);
  }

  sanitizeUrl(url: string | null): SafeResourceUrl {
    if (!url) return this.sanitizer.bypassSecurityTrustResourceUrl('');
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  openCvInNewWindow(): void {
    const url = this.selectedCvUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }
}

