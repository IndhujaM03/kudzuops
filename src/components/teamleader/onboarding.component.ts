import { Component, OnInit, inject, signal, computed } from '@angular/core';
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
        <div *ngIf="!loading()">
          <ng-container *ngIf="onboardingRecords().length > 0; else onboardingEmptyState">
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
              <tr *ngFor="let record of paginatedRecords(); let i = index">
                <td>{{ getRangeStart(onboardingRecords().length, currentPage()) + i }}</td>
                <td>{{ record.candidate_name || 'N/A' }}</td>
                <td>{{ record.candidate_email || 'N/A' }}</td>
                <td>{{ record.candidate_phone || 'N/A' }}</td>
                <td>{{ record.client_name || 'N/A' }}</td>
                <td>{{ record.demand_id }}</td>
                <td>{{ record.skill || '—' }}</td>
                <td>
                  <ng-container *ngIf="getInterviewRounds(record.interview_schedules) as rounds">
                    <span *ngIf="rounds.length > 0; else noRounds">{{ rounds.join(', ') }}</span>
                  </ng-container>
                  <ng-template #noRounds>
                    <span>N/A</span>
                  </ng-template>
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
          <div class="tl-pagination">
            <div class="tl-pagination-info">
              Showing {{ getRangeStart(onboardingRecords().length, currentPage()) }} - {{ getRangeEnd(onboardingRecords().length, currentPage()) }} of {{ onboardingRecords().length }} candidates
            </div>
            <div class="tl-pagination-controls">
              <button 
                class="tl-pagination-btn"
                [disabled]="currentPage() === 1"
                (click)="goToPage(currentPage() - 1)">
                Previous
              </button>
              <div class="tl-pagination-pages">
                <button 
                  *ngFor="let page of visiblePages()"
                  class="tl-pagination-page"
                  [class.active]="page === currentPage()"
                  [class.ellipsis]="page === -1"
                  (click)="goToPage(page)"
                  [disabled]="page === -1">
                  {{ page === -1 ? '...' : page }}
                </button>
              </div>
              <button 
                class="tl-pagination-btn"
                [disabled]="currentPage() === totalPages()"
                (click)="goToPage(currentPage() + 1)">
                Next
              </button>
            </div>
          </div>
        </div>
          </ng-container>
        </div>
        <ng-template #onboardingEmptyState>
          <div class="superadmin-empty-state">
            <div class="superadmin-empty-icon">👥</div>
            <h3 class="superadmin-empty-title">No users found</h3>
            <p class="superadmin-empty-description">No approved users in the system.</p>
          </div>
        </ng-template>
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

    /* Shared empty state (reuse Superadmin style) */
    .superadmin-empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #718096;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 18px rgba(24, 45, 23, 0.05);
    }

    .superadmin-empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .superadmin-empty-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #4a5568;
    }

    .superadmin-empty-description {
      font-size: 14px;
      color: #718096;
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

    .tl-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      gap: 12px;
      flex-wrap: wrap;
    }

    .tl-pagination-info {
      font-size: 14px;
      color: #4a5568;
    }

    .tl-pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tl-pagination-btn {
      padding: 8px 16px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #4a5568;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tl-pagination-btn:hover:not(:disabled) {
      background: #f7fafc;
      border-color: var(--kudzu-primary, #182D17);
      color: var(--kudzu-primary, #182D17);
    }

    .tl-pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .tl-pagination-pages {
      display: flex;
      gap: 4px;
    }

    .tl-pagination-page {
      min-width: 36px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #4a5568;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .tl-pagination-page:hover:not(.ellipsis) {
      background: #f7fafc;
      border-color: var(--kudzu-primary, #182D17);
    }

    .tl-pagination-page.active {
      background: var(--kudzu-primary, #182D17);
      color: white;
      border-color: var(--kudzu-primary, #182D17);
    }

    .tl-pagination-page.ellipsis {
      border: none;
      background: transparent;
      cursor: default;
      min-width: auto;
      padding: 0 8px;
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

  readonly itemsPerPage = 10;
  currentPage = signal(1);
  totalPages = computed(() => this.calculateTotalPages(this.onboardingRecords().length));
  visiblePages = computed(() => this.buildVisiblePages(this.totalPages(), this.currentPage()));
  paginatedRecords = computed(() => this.paginateList(this.onboardingRecords(), this.currentPage()));
  
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
        this.currentPage.set(1);
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

    // Filter rounds where round_status = 2 (Completed) AND slot_status = 1 within slots
    const completedRounds = Object.keys(schedules).filter(key => {
      const round = schedules[key];
      if (!round || round.round_status !== 2 || !Array.isArray(round.slots)) {
        return false;
      }
      return round.slots.some((slot: any) => slot && slot.slot_status === 1);
    });
    
    // Sort rounds: R1, R2, R3, etc.
    completedRounds.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 999;
      const numB = parseInt(b.replace(/\D/g, '')) || 999;
      return numA - numB;
    });
    
    return completedRounds;
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

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getRangeStart(totalItems: number, currentPage: number): number {
    if (!totalItems) {
      return 0;
    }
    return (currentPage - 1) * this.itemsPerPage + 1;
  }

  getRangeEnd(totalItems: number, currentPage: number): number {
    if (!totalItems) {
      return 0;
    }
    return Math.min(currentPage * this.itemsPerPage, totalItems);
  }

  private paginateList(items: CandidateOnboarding[], page: number): CandidateOnboarding[] {
    const totalPages = Math.max(1, Math.ceil(items.length / this.itemsPerPage));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * this.itemsPerPage;
    return items.slice(start, start + this.itemsPerPage);
  }

  private calculateTotalPages(totalItems: number): number {
    if (totalItems === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(totalItems / this.itemsPerPage));
  }

  private buildVisiblePages(total: number, current: number): number[] {
    const pages: number[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }

    pages.push(1);
    if (current > 3) {
      pages.push(-1);
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push(-1);
    }

    pages.push(total);
    return pages;
  }
}

