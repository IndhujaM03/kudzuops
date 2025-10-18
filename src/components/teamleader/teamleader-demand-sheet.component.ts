import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TeamLeaderService } from '../../services/teamleader.service';

interface DemandItem {
  id: number;
  title: string;
  client?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-teamleader-demand-sheet',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tl-demand-wrapper">
      <h2 class="tl-page-title">Demand Sheet</h2>

      <div class="tl-tabs">
        <button class="tl-tab" [class.active]="activeTab() === 'unassigned'" (click)="setTab('unassigned')">Unassigned</button>
        <button class="tl-tab" [class.active]="activeTab() === 'assigned'" (click)="setTab('assigned')">Assigned</button>
        <button class="tl-tab" [class.active]="activeTab() === 'cv-received'" (click)="setTab('cv-received')">CV Received</button>
        <button class="tl-tab" [class.active]="activeTab() === 'submitted'" (click)="setTab('submitted')">Submitted</button>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'unassigned'">
        <ng-container *ngIf="unassigned().length; else emptyUnassigned">
          <div class="tl-list">
            <div class="tl-item" *ngFor="let d of unassigned()">
              <div class="tl-item-title">{{ d.title }}</div>
              <div class="tl-item-sub">{{ d.client || '—' }} • {{ d.createdAt || '' }}</div>
            </div>
          </div>
        </ng-container>
        <ng-template #emptyUnassigned>
          <div class="tl-empty">No unassigned demands</div>
        </ng-template>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'assigned'">
        <div class="tl-refresh-section">
          <button (click)="loadAssignedDemands()" class="tl-refresh-btn">🔄 Refresh</button>
        </div>
        <ng-container *ngIf="assigned().length; else emptyAssigned">
          <div class="tl-list">
            <div class="tl-item" *ngFor="let d of assigned()">
              <div class="tl-item-title">{{ d.title }}</div>
              <div class="tl-item-sub">{{ d.client || '—' }} • {{ d.createdAt || '' }}</div>
              <div class="tl-item-cv-count">
                <span class="cv-count-label">CV Progress:</span>
                <span class="cv-count-value">{{ d.cvCount || '0/0' }}</span>
              </div>
              <div class="tl-item-recruiters" *ngIf="d.assignedRecruiters && d.assignedRecruiters.length > 0">
                <span class="recruiter-label">Assigned to:</span>
                <span class="recruiter-names">{{ d.assignedRecruiters.join(', ') }}</span>
              </div>
            </div>
          </div>
        </ng-container>
        <ng-template #emptyAssigned>
          <div class="tl-empty">No assigned demands</div>
        </ng-template>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'cv-received'">
        <!-- Debug Info -->
        <div style="background: #f3f4f6; padding: 10px; margin-bottom: 10px; border-radius: 4px; font-size: 12px;">
          <strong>Debug:</strong> CV Received count: {{ cvReceived().length }} | 
          Data: {{ cvReceived() | json }}
        </div>
        
        <ng-container *ngIf="cvReceived().length; else emptyCvReceived">
          <div class="cv-table-container">
            <table class="cv-table">
              <thead>
                <tr>
                  <th>Demand ID</th>
                  <th>CV Progress</th>
                  <th>Candidate Name</th>
                  <th>Recruiter Name</th>
                  <th>Client</th>
                  <th>Skill</th>
                  <th>Upload Date</th>
                  <th>CV Link</th>
                  <th>View Profile</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cvData of cvReceived(); let i = index">
                  <ng-container *ngFor="let cv of getWaitingCvs(cvData.cv_list); let j = index">
                    <tr class="cv-row">
                      <td class="demand-id">{{ cvData.demand_id || 'N/A' }}</td>
                      <td class="cv-progress">
                        <div class="progress-container">
                          <span class="progress-text">{{ cvData.total_uploaded_cv_count || cvData.uploaded_cv_count || 0 }}/{{ cvData.required_cv_count || 0 }}</span>
                          <div class="progress-bar">
                            <div class="progress-fill" [style.width.%]="getProgressPercentage(cvData.total_uploaded_cv_count || cvData.uploaded_cv_count || 0, cvData.required_cv_count || 0)"></div>
                          </div>
                        </div>
                      </td>
                      <td class="candidate-name">{{ cv.candidate_name || 'N/A' }}</td>
                      <td class="recruiter-name">{{ cvData.recruiter_name || 'N/A' }}</td>
                      <td class="client-name">{{ cvData.client_name || 'N/A' }}</td>
                      <td class="skill">{{ cvData.skill || 'N/A' }}</td>
                      <td class="upload-date">{{ formatDate(cv.upload_date) }}</td>
                      <td class="cv-link">
                        <a [href]="cv.cv_url" target="_blank" class="cv-link-btn" *ngIf="cv.cv_url">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          View CV
                        </a>
                        <span *ngIf="!cv.cv_url" class="no-link">No link</span>
                      </td>
                      <td class="view-profile">
                        <button (click)="viewProfile(cv, cvData)" class="btn-view-profile" title="View Full Profile">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                          View Profile
                        </button>
                      </td>
                      <td class="status">
                        <span class="status-badge status-waiting">Waiting</span>
                      </td>
                      <td class="actions">
                        <div class="action-buttons">
                          <button (click)="approveCv(cvData.id, j)" class="btn-approve" title="Accept CV">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Accept
                          </button>
                          <button (click)="rejectCv(cvData.id, j)" class="btn-reject" title="Reject CV">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  </ng-container>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
        <ng-template #emptyCvReceived>
          <div class="tl-empty">No CVs waiting for approval</div>
        </ng-template>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'submitted'">
        <!-- Debug Info -->
        <div style="background: #f3f4f6; padding: 10px; margin-bottom: 10px; border-radius: 4px; font-size: 12px;">
          <strong>Debug:</strong> CV Submitted count: {{ cvSubmitted().length }} | 
          Data: {{ cvSubmitted() | json }}
        </div>
        
        <ng-container *ngIf="cvSubmitted().length; else emptySubmitted">
          <div class="cv-table-container">
            <table class="cv-table">
              <thead>
                <tr>
                  <th>Demand ID</th>
                  <th>CV Progress</th>
                  <th>Candidate Name</th>
                  <th>Recruiter Name</th>
                  <th>Client</th>
                  <th>Skill</th>
                  <th>Upload Date</th>
                  <th>CV Link</th>
                  <th>View Profile</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let cvData of cvSubmitted(); let i = index">
                  <ng-container *ngFor="let cv of getApprovedCvs(cvData.cv_list); let j = index">
                    <tr class="cv-row">
                      <td class="demand-id">{{ cvData.demand_id || 'N/A' }}</td>
                      <td class="cv-progress">
                        <div class="progress-container">
                          <span class="progress-text">{{ cvData.total_uploaded_cv_count || cvData.uploaded_cv_count || 0 }}/{{ cvData.required_cv_count || 0 }}</span>
                          <div class="progress-bar">
                            <div class="progress-fill" [style.width.%]="getProgressPercentage(cvData.total_uploaded_cv_count || cvData.uploaded_cv_count || 0, cvData.required_cv_count || 0)"></div>
                          </div>
                        </div>
                      </td>
                      <td class="candidate-name">{{ cv.candidate_name || 'N/A' }}</td>
                      <td class="recruiter-name">{{ cvData.recruiter_name || 'N/A' }}</td>
                      <td class="client-name">{{ cvData.client_name || 'N/A' }}</td>
                      <td class="skill">{{ cvData.skill || 'N/A' }}</td>
                      <td class="upload-date">{{ formatDate(cv.upload_date) }}</td>
                      <td class="cv-link">
                        <a [href]="cv.cv_url" target="_blank" class="cv-link-btn" *ngIf="cv.cv_url">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          View CV
                        </a>
                        <span *ngIf="!cv.cv_url" class="no-link">No link</span>
                      </td>
                      <td class="view-profile">
                        <button (click)="viewProfile(cv, cvData)" class="btn-view-profile" title="View Full Profile">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                          View Profile
                        </button>
                      </td>
                      <td class="status">
                        <span class="status-badge status-approved">Approved</span>
                      </td>
                    </tr>
                  </ng-container>
                </tr>
              </tbody>
            </table>
          </div>
        </ng-container>
        <ng-template #emptySubmitted>
          <div class="tl-empty">No submitted CVs</div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .tl-demand-wrapper { background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.06); padding:16px; }
    .tl-page-title { margin:0 0 12px; font-size:18px; font-weight:700; color:#111827; }
    .tl-tabs { display:flex; gap:8px; border-bottom:1px solid #e5e7eb; margin-bottom:8px; }
    .tl-tab { background:transparent; border:none; padding:10px 12px; cursor:pointer; color:#374151; border-bottom:2px solid transparent; }
    .tl-tab.active { color:#111827; border-bottom-color:#667eea; }
    .tl-tab-panel { padding-top:8px; }
    .tl-list { display:flex; flex-direction:column; gap:8px; }
    .tl-item { padding:12px; border:1px solid #f1f5f9; border-radius:8px; background:#fafafa; }
    .tl-item-title { font-weight:600; color:#111827; margin-bottom:4px; }
    .tl-item-sub { font-size:12px; color:#6b7280; }
    .tl-item-cv-count { margin-top:4px; font-size:11px; color:#3b82f6; }
    .cv-count-label { font-weight:600; }
    .cv-count-value { margin-left:4px; font-weight:700; }
    .tl-item-recruiters { margin-top:4px; font-size:11px; color:#059669; }
    .recruiter-label { font-weight:600; }
    .recruiter-names { margin-left:4px; }
    .tl-empty { padding:16px; color:#6b7280; font-size:14px; }
    .tl-refresh-section { margin-bottom:12px; }
    .tl-refresh-btn { background:#3b82f6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:14px; }
    .tl-refresh-btn:hover { background:#2563eb; }
    
    /* CV Table Styles */
    .cv-table-container { overflow-x: auto; margin-top: 16px; }
    .cv-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .cv-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
    .cv-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .cv-row:hover { background: #f8fafc; }
    .candidate-name { font-weight: 600; color: #111827; }
    .recruiter-name { color: #6b7280; }
    .client-name { color: #374151; font-weight: 500; }
    .skill { color: #6b7280; }
    .upload-date { color: #6b7280; font-size: 13px; }
    .cv-link-btn { display: inline-flex; align-items: center; gap: 4px; color: #3b82f6; text-decoration: none; font-size: 13px; padding: 4px 8px; border-radius: 4px; background: #eff6ff; transition: all 0.2s; }
    .cv-link-btn:hover { background: #dbeafe; color: #1d4ed8; }
    .no-link { color: #9ca3af; font-style: italic; }
    .status-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .status-waiting { background: #fef3c7; color: #d97706; }
    .status-approved { background: #dcfce7; color: #166534; }
    .action-buttons { display: flex; gap: 8px; }
    .btn-approve, .btn-reject { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
    .btn-approve { background: #dcfce7; color: #166534; }
    .btn-approve:hover { background: #bbf7d0; color: #14532d; }
    .btn-reject { background: #fee2e2; color: #dc2626; }
    .btn-reject:hover { background: #fecaca; color: #b91c1c; }
    
    /* New styles for enhanced CV table */
    .demand-id { font-weight: 600; color: #1f2937; font-family: monospace; }
    .btn-view-profile { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; background: #e0f2fe; color: #0277bd; }
    .btn-view-profile:hover { background: #b3e5fc; color: #01579b; }
    
    /* CV Progress Bar Styles */
    .cv-progress { min-width: 120px; }
    .progress-container { display: flex; flex-direction: column; gap: 4px; }
    .progress-text { font-size: 12px; font-weight: 600; color: #374151; text-align: center; }
    .progress-bar { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 4px; transition: width 0.3s ease; }
    .progress-fill[style*="100%"] { background: linear-gradient(90deg, #059669, #047857); }
  `]
})
export class TeamLeaderDemandSheetComponent {
  private teamLeaderService = inject(TeamLeaderService);
  
  activeTab = signal<'unassigned' | 'assigned' | 'cv-received' | 'submitted'>('unassigned');

  unassigned = signal<DemandItem[]>([]);
  assigned = signal<DemandItem[]>([]);
  cvReceived = signal<any[]>([]);
  cvSubmitted = signal<any[]>([]);
  submitted = signal<DemandItem[]>([]);

  setTab(tab: 'unassigned' | 'assigned' | 'cv-received' | 'submitted') {
    this.activeTab.set(tab);
    if (tab === 'unassigned') {
      console.log('🎯 Unassigned tab clicked');
      this.loadUnassignedDemands();
    } else if (tab === 'assigned') {
      console.log('🎯 Assigned tab clicked');
      this.loadAssignedDemands();
    } else if (tab === 'cv-received') {
      console.log('🎯 CV Received tab clicked');
      this.loadCvReceived();
    } else if (tab === 'submitted') {
      console.log('🎯 Submitted tab clicked');
      this.loadCvSubmitted();
    }
  }

  getWaitingCvs(cvList: any[]): any[] {
    if (!cvList || !Array.isArray(cvList)) return [];
    return cvList.filter(cv => cv.status === 0);
  }

  getApprovedCvs(cvList: any[]): any[] {
    if (!cvList || !Array.isArray(cvList)) return [];
    return cvList.filter(cv => cv.status === 1);
  }

  getProgressPercentage(uploaded: number, required: number): number {
    if (!required || required === 0) return 0;
    const percentage = (uploaded / required) * 100;
    return Math.min(percentage, 100); // Cap at 100%
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  }

  async loadUnassignedDemands() {
    console.log('🔄 Loading unassigned demands...');
    try {
      this.teamLeaderService.getUnassignedDemands().subscribe({
        next: (data) => {
          console.log('📊 Unassigned demands data:', data);
          const demands = data.map((item: any) => ({
            id: item.id,
            title: item.skill || item.job_title || `Demand #${item.id}`,
            client: item.client_name || 'Unknown Client',
            createdAt: item.created_at || item.updated_at
          }));
          this.unassigned.set(demands);
        },
        error: (error) => {
          console.error('❌ Error loading unassigned demands:', error);
          this.unassigned.set([]);
        }
      });
    } catch (error) {
      console.error('❌ Failed to load unassigned demands:', error);
      this.unassigned.set([]);
    }
  }

  async loadAssignedDemands() {
    console.log('🔄 Loading assigned demands...');
    try {
      // Force refresh by adding timestamp
      const timestamp = new Date().getTime();
      this.teamLeaderService.getAssignedDemands().subscribe({
        next: (data) => {
          console.log('📊 Assigned demands data:', data);
          const demands = data.map((item: any) => {
            const cvCount = `${item.total_uploaded_cv_count || 0}/${item.required_cv_count || 0}`;
            console.log(`📊 Demand ${item.id} - Raw Data:`, item);
            console.log(`📊 Demand ${item.id} - CV Count: ${cvCount} (uploaded: ${item.total_uploaded_cv_count}, required: ${item.required_cv_count})`);
            return {
              id: item.id,
              title: item.skill || item.job_title || `Demand #${item.id}`,
              client: item.client_name || 'Unknown Client',
              createdAt: item.created_at || item.updated_at,
              assignedRecruiters: item.assigned_recruiter_names || [],
              cvCount: cvCount
            };
          });
          this.assigned.set(demands);
        },
        error: (error) => {
          console.error('❌ Error loading assigned demands:', error);
          this.assigned.set([]);
        }
      });
    } catch (error) {
      console.error('❌ Failed to load assigned demands:', error);
      this.assigned.set([]);
    }
  }

  async loadCvReceived() {
    console.log('🔄 Loading CV received data...');
    try {
      this.teamLeaderService.getCvReceived().subscribe({
        next: (data) => {
          console.log('✅ CV received data loaded:', data);
          console.log('📊 Data length:', data?.length || 0);
          console.log('📊 First item:', data?.[0]);
          this.cvReceived.set(data);
        },
        error: (error) => {
          console.error('❌ Failed to load CV received data:', error);
          console.error('Error details:', error);
        }
      });
    } catch (error) {
      console.error('❌ Exception in loadCvReceived:', error);
    }
  }

  async loadCvSubmitted() {
    console.log('🔄 Loading CV submitted data...');
    try {
      this.teamLeaderService.getCvSubmitted().subscribe({
        next: (data) => {
          console.log('✅ CV submitted data loaded:', data);
          console.log('📊 Submitted data length:', data?.length || 0);
          console.log('📊 First submitted item:', data?.[0]);
          this.cvSubmitted.set(data);
        },
        error: (error) => {
          console.error('❌ Failed to load CV submitted data:', error);
          console.error('Error details:', error);
        }
      });
    } catch (error) {
      console.error('❌ Exception in loadCvSubmitted:', error);
    }
  }

  viewProfile(cv: any, cvData: any) {
    const profileData = {
      candidate_name: cv.candidate_name,
      candidate_email: cv.candidate_email,
      candidate_phone: cv.candidate_phone,
      experience_years: cv.experience_years,
      skills: cv.skills,
      cv_url: cv.cv_url,
      cv_available: cv.cv_available !== false,
      upload_date: cv.upload_date,
      demand_id: cvData.demand_id,
      recruiter_name: cvData.recruiter_name,
      client_name: cvData.client_name,
      skill: cvData.skill
    };
    
    // Create a modal or popup to show profile details
    const profileWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    if (profileWindow) {
      profileWindow.document.write(`
      <html>
        <head>
          <title>Candidate Profile - ${cv.candidate_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .profile-container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .profile-header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px; }
            .profile-title { font-size: 24px; font-weight: bold; color: #333; margin: 0; }
            .profile-subtitle { color: #666; margin: 5px 0 0 0; }
            .profile-section { margin: 20px 0; }
            .profile-label { font-weight: bold; color: #555; margin-bottom: 5px; }
            .profile-value { color: #333; margin-bottom: 15px; }
            .skills-list { display: flex; flex-wrap: wrap; gap: 8px; }
            .skill-tag { background: #e3f2fd; color: #1976d2; padding: 4px 12px; border-radius: 16px; font-size: 14px; }
            .cv-link { display: inline-block; background: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
            .cv-link:hover { background: #45a049; }
            .no-cv { display: inline-block; background: #f5f5f5; color: #666; padding: 10px 20px; border-radius: 5px; margin-top: 10px; font-style: italic; }
            .close-btn { position: absolute; top: 10px; right: 15px; background: #f44336; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; }
          </style>
        </head>
        <body>
          <button class="close-btn" onclick="window.close()">✕ Close</button>
          <div class="profile-container">
            <div class="profile-header">
              <h1 class="profile-title">${cv.candidate_name}</h1>
              <p class="profile-subtitle">${cvData.skill} • ${cvData.client_name}</p>
            </div>
            
            <div class="profile-section">
              <div class="profile-label">Contact Information</div>
              <div class="profile-value"><strong>Email:</strong> ${cv.candidate_email}</div>
              <div class="profile-value"><strong>Phone:</strong> ${cv.candidate_phone}</div>
            </div>
            
            <div class="profile-section">
              <div class="profile-label">Experience</div>
              <div class="profile-value"><strong>Years of Experience:</strong> ${cv.experience_years} years</div>
            </div>
            
            <div class="profile-section">
              <div class="profile-label">Skills</div>
              <div class="skills-list">
                ${cv.skills.map((skill: string) => `<span class="skill-tag">${skill}</span>`).join('')}
              </div>
            </div>
            
            <div class="profile-section">
              <div class="profile-label">CV Document</div>
              <div class="profile-value">
                ${cv.cv_url && cv.cv_available !== false 
                  ? `<a href="${cv.cv_url}" target="_blank" class="cv-link">📄 View CV Document</a>`
                  : `<span class="no-cv">CV not available</span>`
                }
              </div>
            </div>
            
            <div class="profile-section">
              <div class="profile-label">Demand Information</div>
              <div class="profile-value"><strong>Demand ID:</strong> ${cvData.demand_id}</div>
              <div class="profile-value"><strong>Recruiter:</strong> ${cvData.recruiter_name}</div>
              <div class="profile-value"><strong>Upload Date:</strong> ${cv.upload_date}</div>
            </div>
          </div>
        </body>
      </html>
    `);
      profileWindow.document.close();
    }
  }

  async approveCv(activityId: number, cvIndex: number) {
    if (!confirm('Are you sure you want to ACCEPT this CV? It will move to the Submitted tab.')) {
      return;
    }
    
    try {
      this.teamLeaderService.approveCv(activityId, cvIndex).subscribe({
        next: (response) => {
          alert('✅ CV accepted successfully! It has been moved to the Submitted tab.');
          this.loadCvReceived(); // Refresh the data
        },
        error: (error) => {
          console.error('Failed to approve CV:', error);
          alert(`❌ Failed to accept CV: ${error.error?.detail || error.message}`);
        }
      });
    } catch (error) {
      console.error('Failed to approve CV:', error);
      alert('❌ Failed to accept CV. Please try again.');
    }
  }

  async rejectCv(activityId: number, cvIndex: number) {
    if (!confirm('Are you sure you want to REJECT this CV? This will decrease the uploaded CV count and allow the recruiter to upload a new CV.')) {
      return;
    }
    
    try {
      this.teamLeaderService.rejectCv(activityId, cvIndex).subscribe({
        next: (response) => {
          console.log('✅ CV rejection response:', response);
          
          // Enhanced feedback based on the response
          let message = '❌ CV rejected successfully!';
          
          if (response.uploaded_count !== undefined && response.required_count !== undefined) {
            message += `\n\n📊 Current Progress: ${response.uploaded_count}/${response.required_count}`;
            
            if (response.reopened) {
              message += '\n\n🔄 Activity and demand reopened due to CV count decrease!';
            } else if (response.uploaded_count === response.required_count) {
              message += '\n\n🎯 Required CV count reached! Activity status updated to Hold.';
            } else {
              message += '\n\n📝 Activity remains open for more CVs.';
            }
          }
          
          alert(message);
          
          // Refresh all relevant data
          this.loadCvReceived(); // Refresh CV received data
          this.loadAssignedDemands(); // Refresh assigned demands to show updated counts
        },
        error: (error) => {
          console.error('Failed to reject CV:', error);
          alert(`❌ Failed to reject CV: ${error.error?.detail || error.message}`);
        }
      });
    } catch (error) {
      console.error('Failed to reject CV:', error);
      alert('❌ Failed to reject CV. Please try again.');
    }
  }
}
