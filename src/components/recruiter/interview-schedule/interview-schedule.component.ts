import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../environments/environment';

interface InterviewSchedule {
  id: number;
  candidate_name: string;
  recruiter_name?: string;
  recruiter_id?: number;
  email?: string;
  round?: string;
  status: 'scheduled' | 'slot_allocated' | 'reschedule';
  interview_schedules?: {
    [key: string]: {
      slots: Array<{
        date: string;
        time: string;
        slot_status: number;
      }>;
      round_status: number;
    };
  };
  all_slots?: Array<{
    date: string;
    time: string;
    slot_status: number;
    round: string;
  }>;
  created_at?: string;
}

type TabType = 'waiting' | 'scheduled';

@Component({
  selector: 'app-interview-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="superadmin-card superadmin-card-elevated">
      <!-- Tabs -->
      <div class="superadmin-tabs">
        <button 
          class="superadmin-tab"
          [class.active]="activeTab() === 'waiting'"
          (click)="setActiveTab('waiting')">
          Waiting
        </button>
        <button 
          class="superadmin-tab"
          [class.active]="activeTab() === 'scheduled'"
          (click)="setActiveTab('scheduled')">
          Scheduled
        </button>
      </div>

      <!-- Search Filter -->
      <div class="superadmin-search-container">
        <input 
          type="text" 
          class="superadmin-search-input"
          placeholder="Search by candidate name..."
          [(ngModel)]="searchQuery"
          (input)="onSearchChange()">
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="superadmin-empty-state">
        <div class="superadmin-empty-icon">⏳</div>
        <h3 class="superadmin-empty-title">Loading...</h3>
        <p class="superadmin-empty-description">Please wait while we fetch the data.</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error && !loading" class="superadmin-empty-state">
        <div class="superadmin-empty-icon">⚠️</div>
        <h3 class="superadmin-empty-title">Error Loading Data</h3>
        <p class="superadmin-empty-description">{{ error }}</p>
        <button class="superadmin-btn superadmin-btn-approve" (click)="loadCandidates()" style="margin-top: 16px;">
          Retry
        </button>
      </div>

      <!-- Table -->
      <div *ngIf="!loading && !error && filteredCandidates().length > 0" class="superadmin-table-container">
        <table class="superadmin-table">
          <thead>
            <tr>
              <th>Candidate Name</th>
              <th>Round</th>
              <th>Available Slots</th>
              <th>Status</th>
              <th *ngIf="activeTab() === 'waiting'">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let candidate of paginatedCandidates()">
              <td>{{ candidate.candidate_name }}</td>
              <td>
                <span class="superadmin-role-badge">{{ getRoundLabel(candidate) }}</span>
              </td>
              <td>
                <div class="slots-container">
                  <div 
                    *ngFor="let slotInfo of getAllSlots(candidate)" 
                    class="slot-item"
                    [class.slot-allocated]="slotInfo.slot_status === 1">
                    <div class="slot-date">{{ slotInfo.date }}</div>
                    <div class="slot-time">{{ slotInfo.time }}</div>
                  </div>
                  <div *ngIf="getAllSlots(candidate).length === 0" class="no-slots">
                    No slots available
                  </div>
                </div>
              </td>
              <td>
                <span class="status-pill" [ngClass]="getStatusClass(candidate)">
                  {{ getStatusLabel(candidate) }}
                </span>
              </td>
              <td *ngIf="activeTab() === 'waiting'">
                <button 
                  class="superadmin-btn superadmin-btn-approve"
                  (click)="openAssignSlotModal(candidate)"
                  style="padding: 6px 12px; font-size: 12px;">
                  Assign Slot
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && !error && filteredCandidates().length === 0" class="superadmin-empty-state">
        <div class="superadmin-empty-icon">📅</div>
        <h3 class="superadmin-empty-title">No candidates found</h3>
        <p class="superadmin-empty-description">
          {{ searchQuery ? 'No candidates match your search criteria.' : 
            (activeTab() === 'waiting' ? 'No candidates are waiting for slot assignment.' : 
            'No candidates have scheduled slots.') }}
        </p>
      </div>

      <!-- Pagination -->
      <div *ngIf="!loading && !error && filteredCandidates().length > 0" class="superadmin-pagination">
        <div class="superadmin-pagination-info">
          Showing {{ startIndex() + 1 }} - {{ endIndex() }} of {{ filteredCandidates().length }} candidates
        </div>
        <div class="superadmin-pagination-controls">
          <button 
            class="superadmin-pagination-btn"
            [disabled]="currentPage() === 1"
            (click)="goToPage(currentPage() - 1)">
            Previous
          </button>
          <div class="superadmin-pagination-pages">
            <button 
              *ngFor="let page of visiblePages()"
              class="superadmin-pagination-page"
              [class.active]="page === currentPage()"
              [class.ellipsis]="page === -1"
              (click)="goToPage(page)"
              [disabled]="page === -1">
              {{ page === -1 ? '...' : page }}
            </button>
          </div>
          <button 
            class="superadmin-pagination-btn"
            [disabled]="currentPage() === totalPages()"
            (click)="goToPage(currentPage() + 1)">
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Assign Slot Modal -->
    <div *ngIf="showAssignModal" class="superadmin-modal-overlay" (click)="closeAssignModal()">
      <div class="superadmin-modal" (click)="$event.stopPropagation()">
        <div class="superadmin-modal-header">
          <h3>Assign Slot</h3>
          <button class="superadmin-modal-close" (click)="closeAssignModal()">×</button>
        </div>
        <div class="superadmin-modal-body" *ngIf="selectedCandidate">
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Candidate</label>
            <p class="modal-value">{{ selectedCandidate.candidate_name }}</p>
          </div>
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Round</label>
            <p class="modal-value">{{ getFirstRound(selectedCandidate) || 'N/A' }}</p>
          </div>
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Available Slots</label>
            <div class="slots-selection">
              <div 
                *ngFor="let slot of getAvailableSlots(selectedCandidate); let i = index"
                class="slot-option"
                [class.selected]="selectedSlotIndex === i"
                (click)="selectSlot(i)">
                <div class="slot-date">{{ slot.date }}</div>
                <div class="slot-time">{{ slot.time }}</div>
              </div>
              <div *ngIf="getAvailableSlots(selectedCandidate).length === 0" class="no-slots">
                No available slots
              </div>
            </div>
          </div>
          <div class="superadmin-modal-footer">
            <button 
              class="superadmin-btn superadmin-btn-secondary" 
              (click)="rejectAllSlots()"
              [disabled]="assigningSlot">
              Reject All Slots
            </button>
            <div style="flex: 1;"></div>
            <button 
              class="superadmin-btn superadmin-btn-secondary" 
              (click)="closeAssignModal()">
              Cancel
            </button>
            <button 
              class="superadmin-btn superadmin-btn-approve" 
              (click)="assignSlot()"
              [disabled]="selectedSlotIndex === null || assigningSlot">
              {{ assigningSlot ? 'Assigning...' : 'Assign Slot' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rejection Confirmation Modal -->
    <div *ngIf="showRejectModal" class="superadmin-modal-overlay" (click)="closeRejectModal()">
      <div class="superadmin-modal" (click)="$event.stopPropagation()">
        <div class="superadmin-modal-header">
          <h3>Confirm Rejection</h3>
          <button class="superadmin-modal-close" (click)="closeRejectModal()">×</button>
        </div>
        <div class="superadmin-modal-body">
          <p>Are you sure you want to reject all slots? The candidate will be moved to reschedule.</p>
        </div>
        <div class="superadmin-modal-footer">
          <button class="superadmin-btn superadmin-btn-secondary" (click)="closeRejectModal()">Cancel</button>
          <button 
            class="superadmin-btn superadmin-btn-danger" 
            (click)="confirmRejectAllSlots()"
            [disabled]="assigningSlot">
            {{ assigningSlot ? 'Processing...' : 'Reject All Slots' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .superadmin-section-title {
      font-size: 20px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 24px;
    }

    .superadmin-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      border: 1px solid rgba(24, 45, 23, 0.1);
      overflow: visible;
      min-height: 400px;
    }

    .superadmin-card-elevated { 
      box-shadow: 0 10px 18px rgba(24, 45, 23, 0.15); 
      border-color: rgba(24, 45, 23, 0.2); 
    }

    /* Tabs */
    .superadmin-tabs {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .superadmin-tab {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: #4a5568;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }

    .superadmin-tab:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .superadmin-tab.active {
      color: var(--kudzu-primary);
      border-bottom-color: var(--kudzu-primary);
      background: rgba(102, 126, 234, 0.05);
    }

    /* Search */
    .superadmin-search-container {
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .superadmin-search-input {
      width: 100%;
      max-width: 400px;
      padding: 10px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      color: #2d3748;
      transition: border-color 0.2s ease;
    }

    .superadmin-search-input:focus {
      outline: none;
      border-color: var(--kudzu-primary);
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    /* Table */
    .superadmin-table-container {
      overflow-x: auto;
    }

    .superadmin-table {
      width: 100%;
      border-collapse: collapse;
    }

    .superadmin-table th {
      background: #f7fafc;
      padding: 16px 24px;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
      font-size: 14px;
      border-bottom: 1px solid #e2e8f0;
    }

    .superadmin-table td {
      padding: 16px 24px;
      border-bottom: 1px solid #f1f5f9;
      color: #2d3748;
      vertical-align: middle;
    }

    .superadmin-table tr:hover {
      background: #f8fafc;
    }

    .superadmin-role-badge {
      display: inline-block;
      padding: 6px 12px;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #2d3748;
    }

    .slots-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 320px;
    }

    .slot-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 8px;
      border: 1px solid #e3efe5;
      border-left: 4px solid var(--kudzu-primary);
      border-radius: 14px;
      background: #f8fcf9;
      width: 100%;
      box-shadow: 0 2px 6px rgba(24, 45, 23, 0.08);
      font-family: 'Inter', sans-serif;
    }

    .slot-item.slot-allocated {
      border-left-color: #0d9c6a;
      background: #e6fff4;
      box-shadow: 0 3px 8px rgba(13, 156, 106, 0.18);
    }

    .slot-date {
      font-size: 13px;
      font-weight: 600;
      color: #1f2933;
    }

    .slot-time {
      font-size: 12px;
      font-weight: 500;
      color: #4a5568;
    }

    .no-slots {
      color: #9ca3af;
      font-size: 14px;
      font-style: italic;
    }

    /* Pagination */
    .superadmin-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 16px;
    }

    .superadmin-pagination-info {
      font-size: 14px;
      color: #4a5568;
    }

    .superadmin-pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-pill {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .status-waiting {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }

    .status-allocated {
      background: #d1fae5;
      color: #047857;
      border: 1px solid #6ee7b7;
    }

    .status-reschedule {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }

    .superadmin-pagination-btn {
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

    .superadmin-pagination-btn:hover:not(:disabled) {
      background: #f7fafc;
      border-color: var(--kudzu-primary);
      color: var(--kudzu-primary);
    }

    .superadmin-pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .superadmin-pagination-pages {
      display: flex;
      gap: 4px;
    }

    .superadmin-pagination-page {
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

    .superadmin-pagination-page:hover {
      background: #f7fafc;
      border-color: var(--kudzu-primary);
    }

    .superadmin-pagination-page.active {
      background: var(--kudzu-primary);
      color: white;
      border-color: var(--kudzu-primary);
    }

    .superadmin-pagination-page.ellipsis {
      border: none;
      background: transparent;
      cursor: default;
      min-width: auto;
      padding: 0 8px;
    }

    /* Buttons */
    .superadmin-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .superadmin-btn-secondary {
      background: #e2e8f0;
      color: #2d3748;
    }

    .superadmin-btn-secondary:hover {
      background: #cbd5e0;
    }

    .superadmin-btn-approve {
      background: var(--kudzu-primary);
      color: white;
    }

    .superadmin-btn-approve:hover {
      background: var(--kudzu-primary-dark);
    }

    .superadmin-btn-danger {
      background: #e53e3e;
      color: white;
    }

    .superadmin-btn-danger:hover {
      background: #c53030;
    }

    .superadmin-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Empty State */
    .superadmin-empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #718096;
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

    /* Modal Styles */
    .superadmin-modal-overlay {
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
    }

    .superadmin-modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .superadmin-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .superadmin-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #2d3748;
    }

    .superadmin-modal-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #718096;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }

    .superadmin-modal-close:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .superadmin-modal-body {
      padding: 24px;
    }

    .superadmin-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid #e2e8f0;
    }

    /* Form Styles */
    .superadmin-form-group {
      margin-bottom: 20px;
    }

    .superadmin-form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 8px;
    }

    .modal-value {
      font-size: 14px;
      color: #2d3748;
      margin: 0;
    }

    .slots-selection {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 8px;
    }

    .slot-option {
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      background: white;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      min-width: 120px;
    }

    .slot-option:hover {
      border-color: var(--kudzu-primary);
      background: rgba(102, 126, 234, 0.05);
    }

    .slot-option.selected {
      border-color: var(--kudzu-primary);
      background: rgba(102, 126, 234, 0.1);
    }

    .assigned-slot-display {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
  `]
})
export class InterviewScheduleComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  api = environment.apiBase;

  candidates = signal<InterviewSchedule[]>([]);
  activeTab = signal<TabType>('waiting');
  searchQuery = '';
  loading = false;
  error: string | null = null;
  currentPage = signal(1);
  itemsPerPage = 10;

  // Modal state
  showAssignModal = false;
  showRejectModal = false;
  selectedCandidate: InterviewSchedule | null = null;
  selectedSlotIndex: number | null = null;
  assigningSlot = false;

  // Computed values
  filteredCandidates = computed(() => {
    const candidates = this.candidates();
    if (!this.searchQuery.trim()) {
      return candidates;
    }
    const query = this.searchQuery.toLowerCase().trim();
    return candidates.filter(c => 
      c.candidate_name?.toLowerCase().includes(query)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredCandidates().length / this.itemsPerPage)));

  startIndex = computed(() => (this.currentPage() - 1) * this.itemsPerPage);
  endIndex = computed(() => Math.min(this.startIndex() + this.itemsPerPage, this.filteredCandidates().length));

  paginatedCandidates = computed(() => {
    const filtered = this.filteredCandidates();
    const start = this.startIndex();
    const end = this.endIndex();
    return filtered.slice(start, end);
  });

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push(-1); // ellipsis
        pages.push(total);
      } else if (current >= total - 2) {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = total - 4; i <= total; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1); // ellipsis
        for (let i = current - 1; i <= current + 1; i++) {
          pages.push(i);
        }
        pages.push(-1); // ellipsis
        pages.push(total);
      }
    }
    
    return pages;
  });

  ngOnInit(): void {
    this.loadCandidates();
  }

  getStatusLabel(candidate: InterviewSchedule): string {
    const status = (candidate.status ?? '') as string;
    switch (status) {
      case 'scheduled':
        return 'WAITING';
      case 'slot_allocated':
        return 'ALLOCATED';
      case 'reschedule':
        return 'RESCHEDULE';
      default:
        return status ? status.toUpperCase() : 'N/A';
    }
  }

  getStatusClass(candidate: InterviewSchedule): string {
    const status = (candidate.status ?? '') as string;
    switch (status) {
      case 'slot_allocated':
        return 'status-allocated';
      case 'reschedule':
        return 'status-reschedule';
      default:
        return 'status-waiting';
    }
  }

  setActiveTab(tab: TabType): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.loadCandidates();
  }

  loadCandidates(): void {
    this.loading = true;
    this.error = null;

    const endpoint = this.activeTab() === 'waiting' 
      ? '/interview-schedule/waiting' 
      : '/interview-schedule/scheduled';

    let params = new HttpParams()
      .set('page', '1')
      .set('size', '1000'); // Load all for client-side pagination
    
    if (this.searchQuery && this.searchQuery.trim()) {
      params = params.set('search', this.searchQuery.trim());
    }

    this.http.get<any>(`${this.api}${endpoint}`, { params }).subscribe({
      next: (res) => {
        this.candidates.set(res?.items || []);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading candidates:', error);
        this.candidates.set([]);
        this.loading = false;
        this.error = error?.error?.detail || error?.error?.message || 'Failed to load candidates';
      }
    });
  }

  onSearchChange(): void {
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getAllSlots(candidate: InterviewSchedule): Array<{date: string; time: string; slot_status: number; round: string}> {
    // Use all_slots from backend if available
    // For waiting tab: all slots with round_status=0
    // For scheduled tab: only slots with slot_status=1
    if (candidate.all_slots && candidate.all_slots.length > 0) {
      return candidate.all_slots;
    }
    
    // Fallback: extract from interview_schedules
    const slots: Array<{date: string; time: string; slot_status: number; round: string}> = [];
    if (!candidate.interview_schedules) return slots;
    
    for (const [roundKey, roundData] of Object.entries(candidate.interview_schedules)) {
      if (roundData.slots) {
        for (const slot of roundData.slots) {
          // For scheduled tab, only show slots with slot_status = 1
          if (this.activeTab() === 'scheduled' && slot.slot_status !== 1) {
            continue;
          }
          slots.push({
            ...slot,
            round: roundKey
          });
        }
      }
    }
    return slots;
  }

  getRoundLabel(candidate: InterviewSchedule): string {
    if (candidate.all_slots && candidate.all_slots.length > 0) {
      return candidate.all_slots[0].round;
    }

    if (candidate.round) {
      return candidate.round;
    }

    if (candidate.interview_schedules) {
      const roundKeys = Object.keys(candidate.interview_schedules);
      if (roundKeys.length > 0) {
        return roundKeys[0];
      }
    }

    return 'N/A';
  }

  getAvailableSlots(candidate: InterviewSchedule): Array<{date: string; time: string; slot_status: number}> {
    if (!candidate.interview_schedules) return [];
    const firstRound = this.getFirstRound(candidate);
    if (!firstRound) return [];
    
    const roundData = candidate.interview_schedules[firstRound];
    if (!roundData || !roundData.slots) return [];
    
    return roundData.slots.filter(slot => slot.slot_status === 0);
  }


  getFirstRound(candidate: InterviewSchedule): string | null {
    if (!candidate.interview_schedules) return null;
    const rounds = Object.keys(candidate.interview_schedules);
    return rounds.length > 0 ? rounds[0] : null;
  }

  openAssignSlotModal(candidate: InterviewSchedule): void {
    this.selectedCandidate = candidate;
    this.selectedSlotIndex = null;
    this.showAssignModal = true;
  }

  closeAssignModal(): void {
    this.showAssignModal = false;
    this.selectedCandidate = null;
    this.selectedSlotIndex = null;
  }

  selectSlot(index: number): void {
    this.selectedSlotIndex = index;
  }

  assignSlot(): void {
    if (!this.selectedCandidate || this.selectedSlotIndex === null) return;
    
    const firstRound = this.getFirstRound(this.selectedCandidate);
    if (!firstRound) return;

    const availableSlots = this.getAvailableSlots(this.selectedCandidate);
    if (this.selectedSlotIndex >= availableSlots.length) return;

    // Find the original index in the slots array
    const roundData = this.selectedCandidate.interview_schedules![firstRound];
    const allSlots = roundData.slots;
    const selectedSlot = availableSlots[this.selectedSlotIndex];
    
    // Find the index in the original array
    let originalIndex = -1;
    for (let i = 0; i < allSlots.length; i++) {
      if (allSlots[i].date === selectedSlot.date && 
          allSlots[i].time === selectedSlot.time && 
          allSlots[i].slot_status === 0) {
        originalIndex = i;
        break;
      }
    }

    if (originalIndex === -1) return;

    this.assigningSlot = true;
    this.http.post<any>(`${this.api}/interview-schedule/${this.selectedCandidate.id}/assign-slot`, {
      round_key: firstRound,
      slot_index: originalIndex
    }).subscribe({
      next: (response) => {
        this.assigningSlot = false;
        this.closeAssignModal();
        this.loadCandidates(); // Reload to refresh the list
      },
      error: (error) => {
        console.error('Error assigning slot:', error);
        this.assigningSlot = false;
        alert(error?.error?.detail || 'Failed to assign slot');
      }
    });
  }

  rejectAllSlots(): void {
    if (!this.selectedCandidate) return;
    this.showRejectModal = true;
  }

  confirmRejectAllSlots(): void {
    if (!this.selectedCandidate) return;
    
    const firstRound = this.getFirstRound(this.selectedCandidate);
    if (!firstRound) return;

    this.assigningSlot = true;
    this.http.post<any>(`${this.api}/interview-schedule/${this.selectedCandidate.id}/reject-all-slots`, {
      round_key: firstRound
    }).subscribe({
      next: (response) => {
        this.assigningSlot = false;
        this.closeRejectModal();
        this.closeAssignModal();
        this.loadCandidates(); // Reload to refresh the list
      },
      error: (error) => {
        console.error('Error rejecting slots:', error);
        this.assigningSlot = false;
        alert(error?.error?.detail || 'Failed to reject slots');
      }
    });
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
  }
}
