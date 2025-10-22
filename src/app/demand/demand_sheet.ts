import { Component, OnInit, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

interface Client {
  id: number;
  name?: string;
  client_name?: string;
  [key: string]: any;
}

interface Spoc {
  id: number;
  name?: string;
  email?: string;
  spoc_name?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-demand-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './demand_sheet.html',
  styleUrls: ['./demand_sheet.css']
})
export class DemandSheetComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  clients = signal<Client[]>([]);
  spocs = signal<Spoc[]>([]);

  loading = signal(false);
  submitting = signal(false);
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  form = signal({
    client_id: '' as string | number,
    spoc_id: '' as string | number,
    skills: '' as string,
    no_of_positions: '' as number | string,
    required_cv_count: '' as number | string,
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    job_description_url: '' as string,
    remarks: '' as string,
    status: 'Open' as string,
    assigned_to: '' as number | string,
  });

  apiBase = environment.apiBase || '';
  showForm = false;

  // Assign modal state
  showAssign = false;
  assignTarget: any = null;
  teamLeaders: any[] = [];
  recruiters: any[] = [];
  filteredRecruiters: any[] = [];
  selectedTeamLeaderId: number | '' = '';
  selectedRecruiterIds: Set<number> = new Set<number>();
  
  // Team Leader filter state
  showTlFilter = false;
  recruiterSearchTerm = '';
  teamLeaderSearchTerm = '';
  filteredTeamLeaders: any[] = [];
  
  // Dropdown visibility state
  showRecruiterDropdown = false;
  showTeamLeaderDropdown = false;
  showAssignedToDropdown = false;

  // Assigned To field state
  assignedToSearchTerm = '';
  assignedToRecruiters: any[] = [];
  filteredAssignedToRecruiters: any[] = [];
  selectedAssignedToIds: Set<number> = new Set<number>();

  // Tabs state
  activeTab: 'unassigned' | 'assigned' | 'cv_received' | 'submitted' = 'unassigned';
  unassigned = signal<any[]>([]);
  assigned = signal<any[]>([]);
  cvReceived = signal<any[]>([]);
  submitted = signal<any[]>([]);
  assignInput: Record<number, number> = {};

  // Assigned tab search
  assignedSearchTerm = signal('');
  filteredAssigned = signal<any[]>([]);

  // Profile modal state
  showProfileModal = false;
  selectedDemand: any = null;
  profiles = signal<any[]>([]);
  selectedActivityId: number | null = null;

  // TL Action state
  tlActions: Record<number, string> = {};

  // Toast notification state
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');

  // CV Received count
  cvReceivedCount = computed(() => this.cvReceived().length);

  ngOnInit(): void {
    console.log('🔧 API Base URL:', this.apiBase);
    this.fetchClients();
    this.loadUnassigned();
    this.fetchTeamLeads();
    this.fetchAssignedToRecruiters();
  }

  fetchClients(): void {
    this.loading.set(true);
    this.http.get<Client[]>(`${this.apiBase}/clients`).subscribe({
      next: (data) => {
        this.clients.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail || '');
        this.loading.set(false);
      }
    });
  }

  onClientChange(): void {
    const clientId = Number(this.form().client_id || 0);
    this.form.update((f) => ({ ...f, spoc_id: '' }));
    if (!clientId) {
      this.spocs.set([]);
      return;
    }
    this.loading.set(true);
    this.http.get<Spoc[]>(`${this.apiBase}/clients/${clientId}/spoc`).subscribe({
      next: (data) => {
        this.spocs.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail || 'Failed to load SPOCs');
        this.loading.set(false);
      }
    });
  }

  resetForm(): void {
    this.form.set({
      client_id: '',
      spoc_id: '',
      skills: '',
      no_of_positions: '',
      required_cv_count: '',
      priority: 'Medium',
      job_description_url: '',
      remarks: '',
      status: 'Open',
      assigned_to: '',
    });
    this.spocs.set([]);
    this.selectedAssignedToIds.clear();
    this.assignedToSearchTerm = '';
    this.filteredAssignedToRecruiters = [...this.assignedToRecruiters];
  }

  isValid(): boolean {
    const f = this.form();
    return Boolean(f.client_id) && Boolean(f.spoc_id) && Boolean(f.required_cv_count);
  }

  submit(): void {
    if (!this.isValid()) {
      this.errorMsg.set('Please fill required fields: Client, SPOC, and Required Profile');
      return;
    }
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.submitting.set(true);

    console.log('🔍 Submitting demand with selectedAssignedToIds:', this.selectedAssignedToIds.size);
    console.log('📊 Selected recruiter IDs:', Array.from(this.selectedAssignedToIds));

    const payload: any = {
      client_id: Number(this.form().client_id),
      spoc_id: Number(this.form().spoc_id),
      skills: this.form().skills?.trim() || null,
      no_of_positions: this.form().no_of_positions ? Number(this.form().no_of_positions) : null,
      required_cv_count: this.form().required_cv_count ? Number(this.form().required_cv_count) : null,
      priority: this.form().priority || null,
      job_description_url: this.form().job_description_url?.trim() || null,
      remarks: this.form().remarks?.trim() || null,
      status: 'Open',
    };

    this.http.post<{ message: string; id: number }>(`${this.apiBase}/demand/create`, payload)
      .subscribe({
        next: (res) => {
          const newId = res?.id;
          this.successMsg.set(res?.message || 'Demand Sheet Created Successfully');
          this.showToastMessage('✅ Demand created successfully!', 'success');
          this.submitting.set(false);
          this.showForm = false; // auto-close form
          
          // If Assigned To provided, assign recruiters and move to Assigned tab
          if (newId && this.selectedAssignedToIds.size > 0) {
            console.log('🎯 Demand has assigned recruiters, calling assignRecruitersFromForm');
            this.assignRecruitersFromForm(newId);
          } else {
            console.log('📝 Demand has no assigned recruiters, loading unassigned');
            this.loadUnassigned();
          }
          
          // Reset form after processing assignment
          this.resetForm();
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail || 'Failed to create demand');
          this.submitting.set(false);
        }
      });
  }

  setTab(tab: 'unassigned' | 'assigned' | 'cv_received' | 'submitted') {
    this.activeTab = tab;
    if (tab === 'unassigned') this.loadUnassigned();
    if (tab === 'assigned') this.loadAssigned();
    if (tab === 'cv_received') this.loadCvReceived();
    if (tab === 'submitted') this.loadSubmitted();
  }

  loadUnassigned(): void {
    this.http.get<any[]>(`${this.apiBase}/demand/unassigned`).subscribe({
      next: (rows) => this.unassigned.set(rows || []),
      error: () => this.unassigned.set([]),
    });
  }

  loadAssigned(): void {
    this.http.get<any[]>(`${this.apiBase}/demand/assigned`).subscribe({
      next: (rows) => {
        this.assigned.set(rows || []);
        this.filterAssigned();
      },
      error: () => {
        this.assigned.set([]);
        this.filteredAssigned.set([]);
      },
    });
  }

  // Filter assigned demands based on search term
  filterAssigned(): void {
    const searchTerm = this.assignedSearchTerm().toLowerCase().trim();
    if (!searchTerm) {
      this.filteredAssigned.set(this.assigned());
      return;
    }

    const filtered = this.assigned().filter(demand => {
      const email = (demand.recruiter_email || '').toLowerCase();
      const role = (demand.recruiter_role || '').toLowerCase();
      const projectName = (demand.project_name || '').toLowerCase();
      const clientName = (demand.client_name || '').toLowerCase();
      const skills = (demand.skills || demand.skill || '').toLowerCase();
      
      return email.includes(searchTerm) || 
             role.includes(searchTerm) || 
             projectName.includes(searchTerm) || 
             clientName.includes(searchTerm) || 
             skills.includes(searchTerm);
    });

    this.filteredAssigned.set(filtered);
  }

  // Handle search input change
  onAssignedSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.assignedSearchTerm.set(target.value);
    this.filterAssigned();
  }

  // Clear search
  clearAssignedSearch(): void {
    this.assignedSearchTerm.set('');
    this.filterAssigned();
  }

  loadCvReceived(): void {
    // New API: waiting-for-approval CVs with cv_list.status = 0
    this.http.get<any[]>(`${this.apiBase}/cv-received`).subscribe({
      next: (rows) => {
        // Flatten the CV data to show individual CV records in main table
        const flattenedData: any[] = [];
        
        (rows || []).forEach(activity => {
          if (Array.isArray(activity.cv_list)) {
            activity.cv_list.forEach((cv: any, index: number) => {
              if (cv.status === 0 || cv.status === "0") { // Only show pending CVs
                flattenedData.push({
                  // Activity/Recruiter info
                  activity_id: activity.id,
                  recruiter_id: activity.recruiter_id,
                  demand_id: activity.demand_id,
                  recruiter_name: activity.recruiter_name,
                  recruiter_email: activity.recruiter_email,
                  client_name: activity.client_name,
                  spoc_name: activity.spoc_name,
                  skill: activity.skill,
                  no_of_positions: activity.no_of_positions,
                  priority: activity.priority,
                  job_description_url: activity.job_description_url,
                  required_cv_count: activity.required_cv_count,
                  uploaded_cv_count: activity.uploaded_cv_count,
                  activity_status: activity.activity_status,
                  
                  // Individual CV info
                  candidate_id: cv.candidate_id,
                  candidate_name: cv.candidate_name,
                  email: cv.email,
                  phone: cv.phone,
                  status: cv.status,
                  remarks: cv.remarks,
                  filename: cv.filename,
                  file_path: cv.file_path,
                  cv_url: cv.cv_url,
                  cv_available: cv.cv_available,
                  upload_date: cv.upload_date,
                  
                  // For actions
                  _cv_index: index,
                  _cv_id: cv.candidate_id
                });
              }
            });
          }
        });
        
        this.cvReceived.set(flattenedData);
      },
      error: () => this.cvReceived.set([]),
    });
  }

  loadSubmitted(): void {
    // New API: approved CVs with cv_list.status = 1
    this.http.get<any[]>(`${this.apiBase}/cv-submitted`).subscribe({
      next: (rows) => {
        // Flatten the CV data to show individual CV records in main table
        const flattenedData: any[] = [];
        
        (rows || []).forEach(activity => {
          if (Array.isArray(activity.cv_list)) {
            activity.cv_list.forEach((cv: any, index: number) => {
              if (cv.status === 1 || cv.status === "1") { // Only show approved CVs
                flattenedData.push({
                  // Activity/Recruiter info
                  activity_id: activity.id,
                  recruiter_id: activity.recruiter_id,
                  demand_id: activity.demand_id,
                  recruiter_name: activity.recruiter_name,
                  recruiter_email: activity.recruiter_email,
                  client_name: activity.client_name,
                  spoc_name: activity.spoc_name,
                  skill: activity.skill,
                  no_of_positions: activity.no_of_positions,
                  priority: activity.priority,
                  job_description_url: activity.job_description_url,
                  required_cv_count: activity.required_cv_count,
                  uploaded_cv_count: activity.uploaded_cv_count,
                  activity_status: activity.activity_status,
                  
                  // Individual CV info
                  candidate_id: cv.candidate_id,
                  candidate_name: cv.candidate_name,
                  email: cv.email,
                  phone: cv.phone,
                  status: cv.status,
                  remarks: cv.remarks,
                  filename: cv.filename,
                  file_path: cv.file_path,
                  cv_url: cv.cv_url,
                  cv_available: cv.cv_available,
                  upload_date: cv.upload_date,
                  
                  // For actions
                  _cv_index: index,
                  _cv_id: cv.candidate_id
                });
              }
            });
          }
        });
        
        this.submitted.set(flattenedData);
      },
      error: () => this.submitted.set([]),
    });
  }

  assignRecruiter(demandId: number, recruiterId?: number, silent?: boolean): void {
    const rid = recruiterId ?? Number(this.assignInput[demandId] || 0);
    if (!rid) { if (!silent) this.errorMsg.set('Enter a Recruiter ID'); return; }
    this.http.post<{ message: string }>(`${this.apiBase}/demand/assign`, { demand_id: demandId, recruiter_id: rid }).subscribe({
      next: () => {
        if (!silent) this.successMsg.set('Assigned successfully');
        this.loadUnassigned();
        this.loadAssigned();
      },
      error: (err) => { if (!silent) this.errorMsg.set(err?.error?.detail || 'Failed to assign'); }
    });
  }

  // Modal helpers
  openCreateModal(): void { this.showForm = true; }
  closeCreateModal(): void { this.showForm = false; }

  openAssignModal(row: any): void {
    console.log('🔍 Opening assign modal for demand:', row);
    this.assignTarget = row;
    this.showAssign = true;
    this.selectedTeamLeaderId = '';
    this.selectedRecruiterIds.clear();
    this.recruiters = [];
    this.filteredRecruiters = [];
    this.teamLeaders = [];
    this.filteredTeamLeaders = [];
    this.showTlFilter = false;
    this.recruiterSearchTerm = '';
    this.teamLeaderSearchTerm = '';
    
    // Fetch all recruiters first
    this.fetchAllRecruiters();
    // Fetch team leaders when modal opens
    this.fetchTeamLeads();
    console.log('🔍 Modal opened, initial state:', {
      showAssign: this.showAssign,
      showTlFilter: this.showTlFilter,
      teamLeaders: this.teamLeaders,
      recruiters: this.recruiters
    });
  }
  closeAssignModal(): void { this.showAssign = false; this.assignTarget = null; }

  // TL/Recruiter filters
  fetchAllRecruiters(): void {
    console.log('🔍 Fetching all recruiters from:', `${this.apiBase}/users?role=recruiter`);
    this.http.get<any[]>(`${this.apiBase}/users?role=recruiter`).subscribe({
      next: (rows) => {
        console.log('✅ All recruiters fetched:', rows);
        this.recruiters = rows || [];
        this.filteredRecruiters = [...this.recruiters];
        console.log('✅ Updated recruiters list:', this.recruiters);
        console.log('✅ Updated filtered recruiters:', this.filteredRecruiters);
      },
      error: (err) => {
        console.error('❌ Failed to fetch recruiters:', err);
        this.recruiters = [];
        this.filteredRecruiters = [];
      },
    });
  }

  fetchTeamLeads(): void {
    console.log('🔍 Fetching team leaders from:', `${this.apiBase}/teamleaders`);
    this.http.get<any[]>(`${this.apiBase}/teamleaders`).subscribe({
      next: (rows) => {
        console.log('✅ Team leaders fetched:', rows);
        this.teamLeaders = rows || [];
        this.filteredTeamLeaders = [...this.teamLeaders];
        console.log('✅ Team leaders array updated:', this.teamLeaders);
      },
      error: (err) => {
        console.error('❌ Failed to fetch team leaders:', err);
        this.teamLeaders = [];
        this.filteredTeamLeaders = [];
      },
    });
  }

  onTeamLeaderChange(): void {
    const tlId = Number(this.selectedTeamLeaderId || 0);
    console.log('🔍 Team Leader changed to:', tlId);
    this.selectedRecruiterIds.clear();
    if (!tlId) { 
      // Show all recruiters when no TL is selected
      console.log('🔍 No TL selected, fetching all recruiters');
      this.fetchAllRecruiters();
      return; 
    }
    // Filter recruiters based on selected Team Leader
    console.log('🔍 Fetching recruiters for TL:', tlId);
    this.http.get<any[]>(`${this.apiBase}/teamleaders/${tlId}/recruiters`).subscribe({
      next: (rows) => {
        console.log('✅ Recruiters fetched for TL:', rows);
        // Update the recruiter list to show only those under this TL
        this.recruiters = rows || [];
        this.filteredRecruiters = [...this.recruiters];
      },
      error: (err) => {
        console.error('❌ Error fetching recruiters for TL:', err);
        this.recruiters = [];
        this.filteredRecruiters = [];
      },
    });
  }

  // Team Leader filter methods
  toggleTlFilter(): void {
    console.log('🔍 Toggling TL filter, current state:', this.showTlFilter);
    this.showTlFilter = !this.showTlFilter;
    console.log('🔍 TL filter new state:', this.showTlFilter);
    console.log('🔍 Available team leaders:', this.teamLeaders);
  }

  closeTlFilter(): void {
    this.showTlFilter = false;
  }

  getSelectedTeamLeaderName(): string {
    if (!this.selectedTeamLeaderId) return '';
    const tl = this.teamLeaders.find(t => t.id === this.selectedTeamLeaderId);
    return tl ? this.getTeamLeaderDisplayName(tl) : '';
  }

  selectTeamLeader(tlId: number): void {
    console.log('🔍 Selecting Team Leader:', tlId);
    this.selectedTeamLeaderId = tlId;
    this.closeTlFilter();
    this.onTeamLeaderChange();
  }

  // Recruiter search methods
  filterRecruiters(): void {
    const searchTerm = this.recruiterSearchTerm.toLowerCase().trim();
    if (!searchTerm) {
      this.filteredRecruiters = [...this.recruiters];
      return;
    }
    
    this.filteredRecruiters = this.recruiters.filter(recruiter => {
      const displayName = this.getRecruiterDisplayName(recruiter).toLowerCase();
      return displayName.includes(searchTerm);
    });
  }

  // Team Leader search methods
  filterTeamLeaders(): void {
    const searchTerm = this.teamLeaderSearchTerm.toLowerCase().trim();
    if (!searchTerm) {
      this.filteredTeamLeaders = [...this.teamLeaders];
      return;
    }
    
    this.filteredTeamLeaders = this.teamLeaders.filter(teamLeader => {
      const displayName = this.getTeamLeaderDisplayName(teamLeader).toLowerCase();
      return displayName.includes(searchTerm);
    });
  }

  // Assigned To field methods
  fetchAssignedToRecruiters(): void {
    console.log('🔍 Fetching recruiters for Assigned To...');
    this.http.get<any[]>(`${this.apiBase}/users?role=recruiter`).subscribe({
      next: (rows) => {
        console.log('✅ Fetched recruiters for Assigned To:', rows);
        this.assignedToRecruiters = rows || [];
        this.filteredAssignedToRecruiters = [...this.assignedToRecruiters];
        console.log('📊 Assigned To Recruiters:', this.assignedToRecruiters.length);
      },
      error: (err) => {
        console.error('❌ Failed to fetch recruiters for Assigned To:', err);
        this.assignedToRecruiters = [];
        this.filteredAssignedToRecruiters = [];
      },
    });
  }

  filterAssignedToRecruiters(): void {
    const searchTerm = this.assignedToSearchTerm.toLowerCase().trim();
    console.log('🔍 Filtering assigned to recruiters with term:', searchTerm);
    console.log('📊 Total recruiters available:', this.assignedToRecruiters.length);
    
    if (!searchTerm) {
      this.filteredAssignedToRecruiters = [...this.assignedToRecruiters];
      console.log('📋 Showing all recruiters:', this.filteredAssignedToRecruiters.length);
      return;
    }
    
    this.filteredAssignedToRecruiters = this.assignedToRecruiters.filter(recruiter => {
      const displayName = this.getRecruiterDisplayName(recruiter).toLowerCase();
      return displayName.includes(searchTerm);
    });
    console.log('📋 Filtered recruiters:', this.filteredAssignedToRecruiters.length);
  }

  toggleAssignedToRecruiter(recruiterId: number, ev: Event): void {
    ev.stopPropagation();
    const isCurrentlySelected = this.selectedAssignedToIds.has(recruiterId);
    if (isCurrentlySelected) {
      this.selectedAssignedToIds.delete(recruiterId);
      console.log('❌ Removed recruiter:', recruiterId);
    } else {
      this.selectedAssignedToIds.add(recruiterId);
      console.log('✅ Added recruiter:', recruiterId);
    }
    console.log('📊 Total selected:', this.selectedAssignedToIds.size);
  }

  assignRecruitersFromForm(demandId: number): void {
    const recruiterIds = Array.from(this.selectedAssignedToIds);
    
    console.log('🔍 Assigning demand from form:', demandId, 'to recruiters:', recruiterIds);
    
    this.http.post<{ message: string }>(`${this.apiBase}/demand/assign/bulk`, { 
      demand_id: demandId, 
      recruiters: recruiterIds 
    }).subscribe({
      next: (response) => {
        console.log('✅ Form assignment successful:', response);
        this.showToastMessage('✅ Demand created and assigned successfully!', 'success');
        
        // Switch to Assigned tab and refresh
        this.activeTab = 'assigned';
        this.loadAssigned();
        this.loadUnassigned(); // Refresh unassigned to remove the demand
        this.loadSubmitted();
        
        // Clear any error messages
        this.errorMsg.set(null);
        this.successMsg.set(null);
      },
      error: (err) => {
        console.error('❌ Form assignment failed:', err);
        this.showToastMessage('❌ Demand created but assignment failed', 'error');
        this.errorMsg.set(err?.error?.detail || 'Assignment failed');
        this.successMsg.set(null);
      }
    });
  }

  toggleRecruiter(recruiterId: number, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selectedRecruiterIds.add(recruiterId);
    else this.selectedRecruiterIds.delete(recruiterId);
  }

  assignSelected(): void {
    if (!this.assignTarget || this.selectedRecruiterIds.size === 0) { 
      this.showToastMessage('Select at least one recruiter', 'error');
      return; 
    }
    
    const demandId = this.assignTarget.id;
    const ids = Array.from(this.selectedRecruiterIds);
    
    console.log('🔍 Assigning demand:', demandId, 'to recruiters:', ids);
    
    this.http.post<{ message: string }>(`${this.apiBase}/demand/assign/bulk`, { 
      demand_id: demandId, 
      recruiters: ids 
    }).subscribe({
      next: (response) => {
        console.log('✅ Assignment successful:', response);
        this.showToastMessage('✅ Assigned Successfully', 'success');
        this.closeAssignModal();
        
        // Refresh all tabs to reflect the changes
        this.loadUnassigned();
        this.loadAssigned();
        this.loadSubmitted();
        
        // Clear any error messages
        this.errorMsg.set(null);
        this.successMsg.set(null);
      },
      error: (err) => {
        console.error('❌ Bulk assignment failed:', err);
        this.showToastMessage('❌ Assignment Failed', 'error');
        this.errorMsg.set(err?.error?.detail || 'Assignment failed');
        this.successMsg.set(null);
      }
    });
  }

  // JD Modal methods
  showJdModal = signal(false);
  currentJdContent = signal('');

  openJdModal(jdUrl: string): void {
    this.currentJdContent.set(jdUrl);
    this.showJdModal.set(true);
  }

  closeJdModal(): void {
    this.showJdModal.set(false);
    this.currentJdContent.set('');
  }

  // Toast notification methods
  showToastMessage(message: string, type: 'success' | 'error'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      this.hideToast();
    }, 3000);
  }

  hideToast(): void {
    this.showToast.set(false);
  }

  // Get recruiter role for display
  getRecruiterRole(demand: any): string {
    return demand.recruiter_role || 'Recruiter';
  }

  formatAssignees(arr: any[]): string {
    try {
      // arr may be jsonb[] of objects or primitive IDs
      const names = arr.map((v: any) => {
        if (v && typeof v === 'object') return v.name || v.email || v.id || String(v);
        return String(v);
      });
      return names.join(', ');
    } catch {
      return Array.isArray(arr) ? arr.join(', ') : String(arr || '');
    }
  }

  // Profile modal methods
  viewProfiles(cv: any): void {
    this.selectedDemand = cv;
    this.showProfileModal = true;
    this.selectedActivityId = Number(cv?.activity_id || cv?.id || null);
    
    // Construct CV URL, prefer parsing from file_path to avoid recruiter/demand mismatch
    let cvUrl: string | null = null;
    let cvAvailable = false;
    const filePath: string | undefined = cv.file_path || cv.filepath;
    const filenameRaw: string | undefined = cv.filename;
    
    // Try to parse recruiterId and demandId from file_path like: src/assets/cv_uploads/<rid>/<did>/<filename>
    if (filePath && filePath.includes('cv_uploads')) {
      const parts = filePath.replace(/\\/g, '/').split('/');
      const idx = parts.findIndex(p => p === 'cv_uploads');
      if (idx >= 0 && parts.length >= idx + 4) {
        const rid = parts[idx + 1];
        const did = parts[idx + 2];
        const fname = parts.slice(idx + 3).join('/');
        if (rid && did && fname) {
          cvUrl = `${this.apiBase}/cv-file/${encodeURIComponent(rid)}/${encodeURIComponent(did)}/${encodeURIComponent(fname)}`;
          // Check if file actually exists before marking as available
          this.checkCvFileExists(Number(rid), Number(did), fname).then(exists => {
            cvAvailable = exists;
            // Update the profile with the correct availability status
            this.updateProfileCvAvailability(cv.candidate_id || cv._cv_id, exists);
          });
        }
      }
    }
    
    // Fallback to recruiter_id/demand_id + filename from the row if parsing failed
    if (!cvUrl && filenameRaw && cv.recruiter_id && cv.demand_id) {
      cvUrl = `${this.apiBase}/cv-file/${cv.recruiter_id}/${cv.demand_id}/${encodeURIComponent(filenameRaw)}`;
      // Check if file actually exists before marking as available
      this.checkCvFileExists(cv.recruiter_id, cv.demand_id, filenameRaw).then(exists => {
        cvAvailable = exists;
        // Update the profile with the correct availability status
        this.updateProfileCvAvailability(cv.candidate_id || cv._cv_id, exists);
      });
    }
    
    // Since we're now showing individual CV records, create a single profile entry
    const enriched = [{
      recruiter_name: cv.recruiter_name || cv.recruiter_email || '',
      profile_name: cv.candidate_name || cv.profile_name,
      candidate_email: cv.email || cv.candidate_email,
      candidate_phone: cv.phone || cv.candidate_phone,
      remark: cv.remarks || cv.remark,
      status: cv.status,
      cv_url: cvUrl,
      cv_available: cvAvailable,
      _cv_index: cv._cv_index || 0,
      _cv_id: cv.candidate_id || cv._cv_id || null // Use candidate_id for identification
    }];
    
    this.profiles.set(enriched);
  }

  // Check if CV file exists on the server
  async checkCvFileExists(recruiterId: number, demandId: number, filename: string): Promise<boolean> {
    try {
      const response = await this.http.get<any>(`${this.apiBase}/cv-file-exists/${recruiterId}/${demandId}/${encodeURIComponent(filename)}`).toPromise();
      return response?.exists || false;
    } catch (error) {
      console.error('Error checking CV file existence:', error);
      return false;
    }
  }

  // Update profile CV availability status
  updateProfileCvAvailability(cvId: string | number, exists: boolean): void {
    const currentProfiles = this.profiles();
    const updatedProfiles = currentProfiles.map(profile => {
      if (profile._cv_id === cvId) {
        return { ...profile, cv_available: exists };
      }
      return profile;
    });
    this.profiles.set(updatedProfiles);
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.selectedDemand = null;
    this.profiles.set([]);
  }

  // CV Modal methods
  showCvModal = signal(false);
  currentCvUrl = signal<SafeResourceUrl | null>(null);
  cvLoading = signal(false);
  cvError = signal<string | null>(null);

  viewCvInModal(event: Event, cvUrl: string): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('Opening CV modal with URL:', cvUrl);
    
    // Reset states
    this.cvError.set(null);
    this.cvLoading.set(false);
    this.showCvModal.set(true);
    
    // Add a small delay to ensure modal is rendered before setting URL
    setTimeout(() => {
      this.currentCvUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(cvUrl));
      console.log('CV URL set to:', cvUrl);
    }, 100);
  }

  closeCvModal(): void {
    console.log('Closing CV modal');
    this.showCvModal.set(false);
    this.currentCvUrl.set(null);
    this.cvLoading.set(false);
    this.cvError.set(null);
  }

  onCvLoad(): void {
    console.log('CV document loaded successfully');
    this.cvLoading.set(false);
    this.cvError.set(null);
  }

  onCvError(): void {
    console.log('CV document failed to load');
    this.cvLoading.set(false);
    this.cvError.set('CV file is not available or cannot be accessed.');
  }

  // Helpers for cv_list filtering
  getWaitingCvs(cvList: any[]): any[] {
    if (!Array.isArray(cvList)) return [];
    return cvList.filter(cv => cv && cv.status === 0);
  }

  getApprovedCvs(cvList: any[]): any[] {
    if (!Array.isArray(cvList)) return [];
    return cvList.filter(cv => cv && cv.status === 1);
  }

  // TL actions for CVs (only in CV Received tab)
  approveCv(activityId: number, cvIndex: number, cvId?: string | null): void {
    if (!activityId && this.selectedActivityId != null) activityId = this.selectedActivityId;
    const url = `${this.apiBase}/cv-approve/${activityId}`;
    this.http.post(url, { cv_index: cvIndex, cv_id: cvId ?? null }).subscribe({
      next: () => {
        this.showToastMessage('✅ CV accepted', 'success');
        // Refresh current lists and close modal
        this.loadCvReceived();
        this.loadSubmitted();
        this.closeProfileModal(); // Close modal automatically after action
      },
      error: (err) => this.showToastMessage(err?.error?.detail || 'Failed to accept CV', 'error')
    });
  }

  rejectCv(activityId: number, cvIndex: number, cvId?: string | null): void {
    if (!activityId && this.selectedActivityId != null) activityId = this.selectedActivityId;
    const url = `${this.apiBase}/cv-reject/${activityId}`;
    this.http.post(url, { cv_index: cvIndex, cv_id: cvId ?? null }).subscribe({
      next: () => {
        this.showToastMessage('❌ CV rejected', 'success');
        this.loadCvReceived();
        this.closeProfileModal(); // Close modal automatically after action
      },
      error: (err) => this.showToastMessage(err?.error?.detail || 'Failed to reject CV', 'error')
    });
  }

  // TL Action methods
  submitTlAction(demand: any): void {
    const action = this.tlActions[demand.id];
    if (!action) {
      this.errorMsg.set('Please select an action (Accepted/Rejected)');
      return;
    }

    this.http.post<{ message: string }>(`${this.apiBase}/demand/submitted/${demand.id}/action`, { action }).subscribe({
      next: (res) => {
        this.successMsg.set(res?.message || 'Action submitted successfully');
        this.tlActions[demand.id] = '';
        this.loadSubmitted();
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail || 'Failed to submit action');
      }
    });
  }

  // JD View method
  viewJD(url: string): void {
    if (url) {
      this.openJdModal(url);
    }
  }

  // Helper method to get proper recruiter display name
  getRecruiterDisplayName(recruiter: any): string {
    if (!recruiter) return 'Unknown Recruiter';
    
    // Try to get full name first
    if (recruiter.first_name && recruiter.last_name) {
      return `${recruiter.first_name} ${recruiter.last_name}`.trim();
    }
    
    // Try first name only
    if (recruiter.first_name) {
      return recruiter.first_name;
    }
    
    // Try name field
    if (recruiter.name) {
      return recruiter.name;
    }
    
    // Try email as fallback
    if (recruiter.email) {
      return recruiter.email;
    }
    
    // Last resort
    return `Recruiter #${recruiter.id}`;
  }

  // Helper method to get proper team leader display name
  getTeamLeaderDisplayName(teamLeader: any): string {
    if (!teamLeader) return 'Unknown Team Leader';
    
    // Try to get full name first
    if (teamLeader.first_name && teamLeader.last_name) {
      return `${teamLeader.first_name} ${teamLeader.last_name}`.trim();
    }
    
    // Try first name only
    if (teamLeader.first_name) {
      return teamLeader.first_name;
    }
    
    // Try name field
    if (teamLeader.name) {
      return teamLeader.name;
    }
    
    // Try email as fallback
    if (teamLeader.email) {
      return teamLeader.email;
    }
    
    // Last resort
    return `Team Leader #${teamLeader.id}`;
  }

  // Helper methods for dropdown functionality
  getSelectedRecruiterNames(): number[] {
    return Array.from(this.selectedRecruiterIds);
  }

  getRecruiterById(id: number): any {
    return this.recruiters.find(r => r.id === id);
  }

  toggleRecruiterDropdown(): void {
    console.log('Toggle recruiter dropdown:', this.showRecruiterDropdown);
    this.showRecruiterDropdown = !this.showRecruiterDropdown;
    if (this.showRecruiterDropdown) {
      this.showTeamLeaderDropdown = false;
      this.showAssignedToDropdown = false;
    }
  }

  toggleTeamLeaderDropdown(): void {
    console.log('Toggle team leader dropdown:', this.showTeamLeaderDropdown);
    this.showTeamLeaderDropdown = !this.showTeamLeaderDropdown;
    if (this.showTeamLeaderDropdown) {
      this.showRecruiterDropdown = false;
      this.showAssignedToDropdown = false;
    }
  }

  toggleAssignedToDropdown(): void {
    console.log('🔄 Toggle assigned to dropdown called');
    console.log('Current state:', this.showAssignedToDropdown);
    
    this.showAssignedToDropdown = !this.showAssignedToDropdown;
    console.log('New state:', this.showAssignedToDropdown);
    
    if (this.showAssignedToDropdown) {
      this.showRecruiterDropdown = false;
      this.showTeamLeaderDropdown = false;
      
      // Ensure we have recruiters data
      if (this.assignedToRecruiters.length === 0) {
        console.log('🔄 No recruiters found, fetching...');
        this.fetchAssignedToRecruiters();
      }
    } else {
      // Clear search when closing
      this.assignedToSearchTerm = '';
      this.filteredAssignedToRecruiters = [...this.assignedToRecruiters];
    }
  }

  closeAssignedToDropdown(): void {
    this.showAssignedToDropdown = false;
    this.assignedToSearchTerm = '';
    this.filteredAssignedToRecruiters = [...this.assignedToRecruiters];
  }

  getSelectedAssignedToNames(): number[] {
    return Array.from(this.selectedAssignedToIds);
  }

  getAssignedToRecruiterById(id: number): any {
    return this.assignedToRecruiters.find(r => r.id === id);
  }

  removeAssignedToRecruiter(id: number): void {
    this.selectedAssignedToIds.delete(id);
  }

  // Close all dropdowns
  closeAllDropdowns(): void {
    this.showRecruiterDropdown = false;
    this.showTeamLeaderDropdown = false;
    this.showAssignedToDropdown = false;
  }

  // Handle click outside to close dropdowns
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const isDropdownClick = target.closest('.unified-dropdown') || target.closest('.relative');
    if (!isDropdownClick) {
      this.closeAllDropdowns();
    }
  }
}


