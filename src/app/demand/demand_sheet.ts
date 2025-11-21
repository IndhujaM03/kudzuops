import { Component, OnInit, inject, signal, computed, HostListener, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
import { ModalService } from '../../services/modal.service';
import { ToastService } from '../../services/toast.service';
import { forkJoin } from 'rxjs';

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
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  private toastService = inject(ToastService);

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
  activeTab: 'unassigned' | 'assigned' | 'cv_received' | 'submitted' | 'reschedule' = 'unassigned';
  unassigned = signal<any[]>([]);
  assigned = signal<any[]>([]);
  cvReceived = signal<any[]>([]);
  submitted = signal<any[]>([]);
  reschedule = signal<any[]>([]);
  rescheduleAvailable = signal(false);
  showRescheduleProfilesModal = signal(false);
  rescheduleProfiles = signal<any[]>([]);
  selectedRescheduleDemand: any = null;
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

  // Pagination state
  currentPage = signal(1);
  itemsPerPage = 10;

  // Pagination computed values for each tab
  paginatedUnassigned = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.unassigned().slice(start, end);
  });

  paginatedAssigned = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredAssigned().slice(start, end);
  });

  paginatedCvReceived = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.cvReceived().slice(start, end);
  });

  paginatedSubmitted = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.submitted().slice(start, end);
  });

  paginatedReschedule = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.reschedule().slice(start, end);
  });

  // Total pages for each tab
  totalPagesUnassigned = computed(() => Math.ceil(this.unassigned().length / this.itemsPerPage));
  totalPagesAssigned = computed(() => Math.ceil(this.filteredAssigned().length / this.itemsPerPage));
  totalPagesCvReceived = computed(() => Math.ceil(this.cvReceived().length / this.itemsPerPage));
  totalPagesSubmitted = computed(() => Math.ceil(this.submitted().length / this.itemsPerPage));
  totalPagesReschedule = computed(() => Math.ceil(this.reschedule().length / this.itemsPerPage));

  // Current tab's total pages
  currentTotalPages = computed(() => {
    switch (this.activeTab) {
      case 'unassigned': return this.totalPagesUnassigned();
      case 'assigned': return this.totalPagesAssigned();
      case 'cv_received': return this.totalPagesCvReceived();
      case 'submitted': return this.totalPagesSubmitted();
      case 'reschedule': return this.totalPagesReschedule();
      default: return 1;
    }
  });

  // Current tab's data length
  currentDataLength = computed(() => {
    switch (this.activeTab) {
      case 'unassigned': return this.unassigned().length;
      case 'assigned': return this.filteredAssigned().length;
      case 'cv_received': return this.cvReceived().length;
      case 'submitted': return this.submitted().length;
      case 'reschedule': return this.reschedule().length;
      default: return 0;
    }
  });

  // Start and end index for current page
  startIndex = computed(() => (this.currentPage() - 1) * this.itemsPerPage);
  endIndex = computed(() => Math.min(this.startIndex() + this.itemsPerPage, this.currentDataLength()));

  // Visible pages for pagination UI
  visiblePages = computed(() => {
    const total = this.currentTotalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      if (current > 3) {
        pages.push(-1); // -1 represents ellipsis
      }
      
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== total) {
          pages.push(i);
        }
      }
      
      if (current < total - 2) {
        pages.push(-1); // -1 represents ellipsis
      }
      
      pages.push(total);
    }
    
    return pages;
  });

  // Status edit modal state
  showStatusModal = signal(false);
  // Also use a regular property as backup for template binding
  showStatusModalProperty = false;
  selectedDemandId: number | null = null;
  selectedDemandStatus: string = '';
  statusRemark: string = '';
  selectedStatus: string = 'open';

  // Submitted profiles modal state
  showSubmittedProfilesModal = signal(false);
  // Also use a regular property as backup for template binding
  showSubmittedProfilesModalProperty = false;
  selectedSubmittedDemand: any = null;
  submittedProfiles = signal<any[]>([]);
  profileSelections = signal<Map<number, boolean>>(new Map()); // Map of profile index to selected (true = accept, false = reject)
  profileRemarks = signal<Map<number, string>>(new Map()); // Map of profile index to remark text

  // Schedule interview modal state
  showScheduleInterviewModal = signal(false);
  selectedCandidateForSchedule: any = null;
  interviewRounds = signal<Array<{ round: string; slots: Array<{ date: string; time: string }> }>>([
    { round: '', slots: [{ date: '', time: '' }] },
  ]);
  private rescheduleMode = signal(false);

  ngOnInit(): void {
    console.log('🔧 API Base URL:', this.apiBase);
    this.fetchClients();
    this.loadUnassigned();
    this.fetchTeamLeads();
    this.fetchAssignedToRecruiters();
    this.loadReschedule();
    
    // Subscribe to modal service for opening create demand modal
    this.modalService.openCreateDemand$.subscribe(shouldOpen => {
      if (shouldOpen) {
        this.openCreateModal();
        // Reset the service state
        this.modalService.closeCreateDemand();
      }
    });
  }

  fetchClients(): void {
    this.loading.set(true);
    const token = localStorage.getItem('access_token') || '';
    const tokenType = localStorage.getItem('token_type') || 'bearer';
    const headers: Record<string, string> = token ? { Authorization: `${tokenType} ${token}` } : {};
    
    console.log('🔍 Fetching clients from:', `${this.apiBase}/clientsettings/clients`);
    console.log('🔑 Auth token present:', !!token);
    
    this.http.get<Client[]>(`${this.apiBase}/clientsettings/clients`, { headers }).subscribe({
      next: (data) => {
        console.log('✅ Clients loaded:', data);
        this.clients.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('❌ Failed to load clients:', err);
        this.errorMsg.set(err?.error?.detail || 'Failed to load clients');
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
    const token = localStorage.getItem('access_token') || '';
    const tokenType = localStorage.getItem('token_type') || 'bearer';
    const headers: Record<string, string> = token ? { Authorization: `${tokenType} ${token}` } : {};
    
    this.http.get<Spoc[]>(`${this.apiBase}/clientsettings/spocs?client_id=${clientId}`, { headers }).subscribe({
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
          console.log('✅ Demand creation response:', res);
          const newId = res?.id;
          this.successMsg.set(res?.message || 'Demand Sheet Created Successfully');
          this.toastService.success('Demand Sheet Created Successfully');
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
          console.error('❌ Demand creation error:', err);
          this.errorMsg.set(err?.error?.detail || 'Failed to create demand');
          this.submitting.set(false);
        }
      });
  }

  setTab(tab: 'unassigned' | 'assigned' | 'cv_received' | 'submitted' | 'reschedule') {
    this.activeTab = tab;
    this.currentPage.set(1); // Reset to first page when changing tabs
    if (tab === 'unassigned') this.loadUnassigned();
    if (tab === 'assigned') this.loadAssigned();
    if (tab === 'cv_received') this.loadCvReceived();
    if (tab === 'submitted') this.loadSubmitted();
    if (tab === 'reschedule') this.loadReschedule();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.currentTotalPages() && page !== -1) {
      this.currentPage.set(page);
    }
  }

  hasRescheduleRecords(): boolean {
    return this.reschedule().length > 0;
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
    this.currentPage.set(1); // Reset to first page when searching
  }

  // Clear search
  clearAssignedSearch(): void {
    this.assignedSearchTerm.set('');
    this.filterAssigned();
    this.currentPage.set(1); // Reset to first page when clearing search
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
        // Group by demand_id to show aggregated view
        const demandMap = new Map<number, any>();
        
        (rows || []).forEach(activity => {
          const demandId = activity.demand_id;
          if (!demandId) return;
          
          // Count submitted profiles (status = 1) excluding scheduled interviews
          let submittedCount = 0;
          let submittedCvs: any[] = [];
          if (Array.isArray(activity.cv_list)) {
            submittedCvs = activity.cv_list.filter((cv: any) => {
              const cvStatus = cv.status;
              const interviewStatus = (cv.interview_status || cv.interviewStatus || '').toLowerCase();
              if (interviewStatus === 'scheduled') {
                return false;
              }
              return cvStatus === 1 || cvStatus === "1";
            });
            submittedCount = submittedCvs.length;
          }
          
          if (submittedCount > 0) {
            if (!demandMap.has(demandId)) {
              demandMap.set(demandId, {
                demand_id: demandId,
                client_name: activity.client_name,
                spoc_name: activity.spoc_name,
                skill: activity.skill,
                cv_count: 0,
                // Store all activities for this demand for modal display
                activities: []
              });
            }
            
            const demandData = demandMap.get(demandId);
            demandData.cv_count += submittedCount;
            // Store activity for modal (with approved CVs only)
            demandData.activities.push({
              ...activity,
              submitted_cvs: submittedCvs
            });
          }
        });
        
        // Convert map to array
        const groupedData = Array.from(demandMap.values());
        this.submitted.set(groupedData);
      },
      error: () => this.submitted.set([]),
    });
  }

  loadReschedule(): void {
    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    const headers: Record<string, string> = token ? { Authorization: `${tokenType} ${token}` } : {};

    this.http.get<{ items: any[] }>(`${this.apiBase}/interview-schedule/reschedule`, { headers }).subscribe({
      next: async (response) => {
        const items = response?.items || [];
        this.rescheduleAvailable.set(items.length > 0);
        
        // Flatten to individual candidates instead of grouping by demand
        const candidates: any[] = [];
        const recruiterIds = new Set<number>();
        
        items.forEach((record: any) => {
          const rounds = record.reschedule_rounds || [];
          rounds.forEach((round: any) => {
            candidates.push({
              schedule_id: record.id,
              round_key: round.round_key,
              round: round.round_key, // For display
              slots: round.slots || [],
              candidate_name: record.candidate_name,
              candidate_email: record.candidate_email,
              candidate_phone: record.candidate_phone,
              recruiter_id: record.recruiter_id,
              recruiter_name: record.recruiter_name,
              demand_id: record.demand_id,
              interview_schedules: record.interview_schedules,
            });
            
            // Collect recruiter IDs that need name lookup
            if (record.recruiter_id && !record.recruiter_name) {
              recruiterIds.add(record.recruiter_id);
            }
          });
        });

        // Fetch recruiter names for those missing
        if (recruiterIds.size > 0) {
          try {
            const recruitersResponse = await this.http.get<any[]>(`${this.apiBase}/users?role=recruiter`, { headers }).toPromise();
            const recruitersMap = new Map<number, string>();
            
            (recruitersResponse || []).forEach((recruiter: any) => {
              if (recruiter.id) {
                const name = this.getRecruiterDisplayName(recruiter);
                recruitersMap.set(recruiter.id, name);
              }
            });
            
            // Update candidates with recruiter names
            candidates.forEach((candidate) => {
              if (!candidate.recruiter_name && candidate.recruiter_id) {
                candidate.recruiter_name = recruitersMap.get(candidate.recruiter_id) || 'N/A';
              } else if (!candidate.recruiter_name) {
                candidate.recruiter_name = 'N/A';
              }
            });
          } catch (err) {
            console.error('Failed to fetch recruiter names:', err);
            // Set N/A for missing names
            candidates.forEach((candidate) => {
              if (!candidate.recruiter_name) {
                candidate.recruiter_name = 'N/A';
              }
            });
          }
        } else {
          // Ensure all candidates have recruiter_name set
          candidates.forEach((candidate) => {
            if (!candidate.recruiter_name) {
              candidate.recruiter_name = 'N/A';
            }
          });
        }

        this.reschedule.set(candidates);
      },
      error: (error) => {
        console.error('Failed to load reschedule list:', error);
        this.rescheduleAvailable.set(false);
        this.reschedule.set([]);
      },
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
  openCreateModal(): void { 
    this.showForm = true; 
  }
  closeCreateModal(): void { 
    this.showForm = false; 
  }

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

  openRescheduleProfilesModal(row: any): void {
    this.selectedRescheduleDemand = row;
    this.rescheduleProfiles.set(row?.reschedule_candidates || []);
    this.showRescheduleProfilesModal.set(true);
  }

  closeRescheduleProfilesModal(): void {
    this.showRescheduleProfilesModal.set(false);
    this.selectedRescheduleDemand = null;
    this.rescheduleProfiles.set([]);
  }

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
    const token = localStorage.getItem('access_token') || '';
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const apiUrl = `${this.apiBase}/teamleaders/${tlId}/recruiters`;
    console.log('🌐 Calling API:', apiUrl);
    
    this.http.get<any[]>(apiUrl, { headers }).subscribe({
      next: (rows) => {
        console.log('✅ Recruiters fetched for TL:', rows);
        // Update the recruiter list to show only those under this TL
        this.recruiters = rows || [];
        this.filteredRecruiters = [...this.recruiters];
        console.log('✅ Updated recruiters list:', this.recruiters);
        console.log('✅ Updated filtered recruiters:', this.filteredRecruiters);
      },
      error: (err) => {
        console.error('❌ Error fetching recruiters for TL:', err);
        console.error('❌ Error details:', err.error || err.message);
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
        // Don't load submitted here - it's not needed after creating a demand
        
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
        // Only load submitted if we're on that tab
        if (this.activeTab === 'submitted') {
          this.loadSubmitted();
        }
        
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
      recruiter_id: cv.recruiter_id || null,
      profile_name: cv.candidate_name || cv.profile_name,
      candidate_name: cv.candidate_name || cv.profile_name,
      candidate_email: cv.email || cv.candidate_email,
      candidate_phone: cv.phone || cv.candidate_phone,
      remark: cv.remarks || cv.remark,
      status: cv.status,
      cv_url: cvUrl,
      cv_available: cvAvailable,
      demand_id: cv.demand_id || null,
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

  handleScheduleInterviewClick(event: Event | null, profile: any): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.rescheduleMode.set(false);
    this.selectedCandidateForSchedule = this.buildScheduleCandidate(profile);
    this.initializeInterviewRounds(this.selectedCandidateForSchedule?.interview_schedules);
    this.showScheduleInterviewModal.set(true);
  }

  handleRescheduleCandidateClick(event: Event | null, candidate: any): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const enriched = {
      ...candidate,
      reschedule_round_key: candidate.round_key || candidate.reschedule_round_key,
      schedule_id: candidate.schedule_id || candidate.scheduleId || candidate.id,
    };
    this.rescheduleMode.set(true);
    this.selectedCandidateForSchedule = this.buildScheduleCandidate(enriched);
    this.initializeInterviewRounds(enriched.interview_schedules);
    this.showScheduleInterviewModal.set(true);
    this.closeRescheduleProfilesModal();
  }

  closeScheduleInterviewModal(): void {
    this.showScheduleInterviewModal.set(false);
    this.selectedCandidateForSchedule = null;
    this.rescheduleMode.set(false);
    this.resetInterviewRounds();
  }

  isRescheduleMode(): boolean {
    return this.rescheduleMode();
  }

  addSlotToRound(roundIndex: number): void {
    const rounds = this.interviewRounds();
    if (!rounds[roundIndex]) {
      return;
    }
    const updated = [...rounds];
    updated[roundIndex] = {
      ...updated[roundIndex],
      slots: [...updated[roundIndex].slots, { date: '', time: '' }],
    };
    this.interviewRounds.set(updated);
  }

  removeSlotFromRound(roundIndex: number, slotIndex: number): void {
    const rounds = this.interviewRounds();
    if (!rounds[roundIndex] || rounds[roundIndex].slots.length <= 1) {
      return;
    }
    const updatedSlots = rounds[roundIndex].slots.filter((_, idx) => idx !== slotIndex);
    const updated = [...rounds];
    updated[roundIndex] = { ...updated[roundIndex], slots: updatedSlots };
    this.interviewRounds.set(updated);
  }

  saveInterviewSchedule(): void {
    if (!this.selectedCandidateForSchedule) {
      this.errorMsg.set('No candidate selected for scheduling');
      return;
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `${tokenType} ${token}`;
    }

    if (this.isRescheduleMode()) {
      const rounds = this.interviewRounds();
      const targetRound = rounds[0];
      if (!targetRound) {
        this.errorMsg.set('Round information missing');
        return;
      }
      const validSlots = targetRound.slots.filter((slot) => slot.date && slot.time);
      if (!validSlots.length) {
        this.toastService.error('Please provide at least one valid slot.');
        return;
      }
      const roundKey =
        this.selectedCandidateForSchedule.reschedule_round_key ||
        targetRound.round ||
        this.selectedCandidateForSchedule.round_key;
      if (!roundKey) {
        this.errorMsg.set('Round information missing');
        return;
      }
      const slotsPayload = validSlots.map((slot) => ({
        date: slot.date,
        time: this.formatTimeForApi(slot.time),
      }));
      this.http
        .post(
          `${this.apiBase}/interview-schedule/${this.selectedCandidateForSchedule.schedule_id}/reschedule`,
          {
            round_key: roundKey,
            slots: slotsPayload,
          },
          { headers }
        )
        .subscribe({
          next: () => {
            this.toastService.success('Interview slots updated successfully');
            this.closeScheduleInterviewModal();
            // Remove the rescheduled candidate from the list
            const currentReschedule = this.reschedule();
            const updatedReschedule = currentReschedule.filter(
              (candidate) => candidate.schedule_id !== this.selectedCandidateForSchedule.schedule_id ||
                            candidate.round_key !== roundKey
            );
            this.reschedule.set(updatedReschedule);
            // Reload to ensure consistency
            this.loadReschedule();
            this.loadSubmitted();
          },
          error: (err) => {
            console.error('Failed to update reschedule slots:', err);
            this.errorMsg.set(err?.error?.detail || 'Failed to update reschedule slots');
          },
        });
      return;
    }

    const schedulePayload = this.buildInterviewSchedulePayload();
    if (!schedulePayload || Object.keys(schedulePayload).length === 0) {
      this.toastService.error('Please provide at least one valid slot.');
      return;
    }

    const candidate = this.selectedCandidateForSchedule;
    const payload: Record<string, any> = {
      submission_id: candidate.submission_id || candidate.activity_id || candidate.id || null,
      recruiter_id: candidate.recruiter_id || candidate.recruiter_email || null,
      candidate_name: candidate.candidate_name || candidate.profile_name || 'Candidate',
      demand_id: candidate.demand_id || this.selectedDemand?.demand_id || this.selectedDemand?.id || null,
      candidate_email: candidate.candidate_email || candidate.email || null,
      candidate_phone: candidate.candidate_phone || candidate.phone || null,
      interview_schedules: JSON.stringify(schedulePayload),
      status: 'scheduled',
    };

    this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, payload, { headers }).subscribe({
      next: () => {
        this.toastService.success('Interview schedule saved successfully');
        this.closeScheduleInterviewModal();
        
        // If scheduling from submitted profiles modal, remove the scheduled candidate from the list
        if (this.showSubmittedProfilesModal() && candidate.profile_index !== undefined) {
          const currentProfiles = [...this.submittedProfiles()];
          const remaining = currentProfiles.filter(
            (p: any) => Number(p.profile_index) !== Number(candidate.profile_index)
          );
          
          // Update the profiles list
          this.submittedProfiles.set(remaining);
          this.cdr.detectChanges();
          
          // If no profiles remain, close the submitted profiles modal
          if (remaining.length === 0) {
            setTimeout(() => {
              this.closeSubmittedProfilesModal();
            }, 300);
          }
        }
        
        this.loadReschedule();
        if (this.activeTab === 'cv_received') {
          this.loadCvReceived();
        } else if (this.activeTab === 'submitted') {
          this.loadSubmitted();
        }
      },
      error: (err) => {
        console.error('Failed to save interview schedule:', err);
        this.toastService.error(err?.error?.detail || 'Failed to save interview schedule');
      },
    });
  }

  saveRescheduleSchedule(): void {
    this.saveInterviewSchedule();
  }

  private buildScheduleCandidate(profile: any): any {
    return {
      ...profile,
      demand_id: profile.demand_id || this.selectedDemand?.demand_id || this.selectedDemand?.id,
      recruiter_id: profile.recruiter_id || this.selectedDemand?.recruiter_id,
      recruiter_name: profile.recruiter_name || profile.recruiter_email || this.selectedDemand?.recruiter_name,
      submission_id: profile.submission_id || profile.id || profile.activity_id || null,
      schedule_id: profile.schedule_id || profile.scheduleId || profile.id || null,
      reschedule_round_key: profile.reschedule_round_key || profile.round_key || null,
      interview_schedules: profile.interview_schedules || this.selectedCandidateForSchedule?.interview_schedules,
    };
  }

  private initializeInterviewRounds(rawSchedules: any): void {
    const parsed = this.parseInterviewSchedules(rawSchedules || this.selectedCandidateForSchedule?.interview_schedules);
    let rounds: Array<{ round: string; slots: Array<{ date: string; time: string }> }> = [];

    if (this.isRescheduleMode() && this.selectedCandidateForSchedule?.reschedule_round_key) {
      const roundKey = this.selectedCandidateForSchedule.reschedule_round_key;
      const target = parsed[roundKey];
      if (target) {
        const slots = Array.isArray(target?.slots)
          ? target.slots.map((slot: any) => ({
              date: slot?.date || '',
              time: this.normalizeTimeForInput(slot?.time || ''),
            }))
          : [{ date: '', time: '' }];
        rounds = [{ round: roundKey, slots }];
      }
    } else {
      Object.entries(parsed).forEach(([key, roundData]) => {
        const data = roundData as any;
        const slots = Array.isArray(data?.slots)
          ? data.slots.map((slot: any) => ({
              date: slot?.date || '',
              time: this.normalizeTimeForInput(slot?.time || ''),
            }))
          : [{ date: '', time: '' }];
        rounds.push({ round: key, slots });
      });
    }

    if (rounds.length === 0) {
      this.resetInterviewRounds();
    } else {
      this.interviewRounds.set(rounds);
    }
  }

  private resetInterviewRounds(): void {
    this.interviewRounds.set([{ round: '', slots: [{ date: '', time: '' }] }]);
  }

  private parseInterviewSchedules(raw: any): Record<string, any> {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }

  private normalizeTimeForInput(time: string): string {
    if (!time) return '';
    const upper = time.toUpperCase();
    if (!upper.includes('AM') && !upper.includes('PM')) {
      return time;
    }
    const [timePart, ampm] = upper.split(' ');
    const [hours, minutes = '00'] = timePart.split(':');
    let hour = parseInt(hours, 10);
    if (ampm === 'PM' && hour !== 12) {
      hour += 12;
    } else if (ampm === 'AM' && hour === 12) {
      hour = 0;
    }
    return `${hour.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }

  private formatTimeForApi(time: string): string {
    if (!time) return '';
    const [hours, minutes = '00'] = time.split(':');
    let hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  }

  private buildInterviewSchedulePayload(): Record<string, any> {
    const payload: Record<string, any> = {};
    this.interviewRounds().forEach((round, index) => {
      const validSlots = round.slots.filter((slot) => slot.date && slot.time);
      if (validSlots.length === 0) {
        return;
      }
      const roundKey = round.round?.trim() || `R${index + 1}`;
      payload[roundKey] = {
        round_status: 0,
        slots: validSlots.map((slot) => ({
          date: slot.date,
          time: this.formatTimeForApi(slot.time),
          slot_status: 0,
        })),
      };
    });
    return payload;
  }

  // CV Modal methods
  showCvModal = signal(false);
  currentCvUrl = signal<SafeResourceUrl | null>(null);
  cvLoading = signal(false);
  cvError = signal<string | null>(null);
  // DOCX preview state
  cvDocxMode = signal(false);
  cvDocxLoading = signal(false);
  cvDocxError = signal<string | null>(null);
  @ViewChild('cvDocxHost') cvDocxHostRef!: ElementRef;

  viewCvInModal(event: Event, cvUrl: string): void {
    event.preventDefault();
    event.stopPropagation();
    console.log('Opening CV modal with URL:', cvUrl);
    
    // Reset states
    this.cvError.set(null);
    this.cvLoading.set(false);
    this.cvDocxError.set(null);
    this.cvDocxLoading.set(false);
    this.cvDocxMode.set(false);
    this.showCvModal.set(true);

    const lower = (cvUrl || '').toLowerCase();
    if (lower.endsWith('.pdf')) {
      // PDF: use iframe via sanitized URL
      setTimeout(() => {
        this.currentCvUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(cvUrl));
        console.log('CV URL set to (PDF):', cvUrl);
      }, 50);
    } else if (lower.endsWith('.docx')) {
      // DOCX: render via docx-preview into host
      this.currentCvUrl.set(null);
      this.cvDocxMode.set(true);
      this.cvDocxLoading.set(true);
      setTimeout(() => {
        this.renderDocxFromUrl(cvUrl);
      }, 50);
    } else if (lower.endsWith('.doc')) {
      // Old .doc not supported for inline preview
      this.currentCvUrl.set(null);
      this.cvDocxMode.set(true);
      this.cvDocxLoading.set(false);
      this.cvDocxError.set('This .doc file type cannot be previewed. Please download to view.');
    } else {
      // Unknown: attempt docx render
      this.currentCvUrl.set(null);
      this.cvDocxMode.set(true);
      this.cvDocxLoading.set(true);
      setTimeout(() => {
        this.renderDocxFromUrl(cvUrl);
      }, 50);
    }
  }

  closeCvModal(): void {
    console.log('Closing CV modal');
    this.showCvModal.set(false);
    this.currentCvUrl.set(null);
    this.cvLoading.set(false);
    this.cvError.set(null);
    this.cvDocxMode.set(false);
    this.cvDocxLoading.set(false);
    this.cvDocxError.set(null);
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

  private async renderDocxFromUrl(url: string): Promise<void> {
    try {
      const host = this.cvDocxHostRef?.nativeElement;
      if (!host) {
        this.cvDocxError.set('Preview area not available');
        this.cvDocxLoading.set(false);
        return;
      }
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to load document (${resp.status})`);
      }
      const arrayBuffer = await resp.arrayBuffer();
      const docx = await import('docx-preview');
      host.innerHTML = '';
      await docx.renderAsync(arrayBuffer, host, undefined, {
        inWrapper: true,
        ignoreWidth: true,
        ignoreHeight: false,
        className: 'docx'
      });
      this.cvDocxLoading.set(false);
      this.cvDocxError.set(null);
    } catch (e: any) {
      console.error('DOCX render error:', e);
      this.cvDocxLoading.set(false);
      this.cvDocxError.set('Failed to preview this document. You can try downloading it.');
    }
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
    
    // Get profile data for the second API call
    const profiles = this.profiles();
    const profile = profiles.find(p => 
      (p._cv_index === cvIndex) || 
      (cvId && (p._cv_id === cvId || p._cv_id?.toString() === cvId?.toString()))
    );
    
    // Get demand_id from profile or selectedDemand
    const demandId = profile?.demand_id || this.selectedDemand?.demand_id || this.selectedDemand?.id;
    const recruiterId = profile?.recruiter_id || this.selectedDemand?.recruiter_id;
    const candidateName = profile?.profile_name || profile?.candidate_name;
    const candidateEmail = profile?.candidate_email || profile?.email;
    const candidatePhone = profile?.candidate_phone || profile?.phone;
    const cvUrl = profile?.cv_url || null;
    const remark = profile?.remark || null;
    
    // Call cv-approve API first
    this.http.post(url, { cv_index: cvIndex, cv_id: cvId ?? null }).subscribe({
      next: () => {
        // After cv-approve succeeds, call profile-action API to insert into tbl_submissions
        if (demandId && recruiterId && candidateName) {
          const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
          const headers: any = { 'Content-Type': 'application/json' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const profileActionPayload = {
            recruiter_id: recruiterId,
            candidate_name: candidateName,
            candidate_email: candidateEmail || null,
            candidate_phone: candidatePhone || null,
            cv_url: cvUrl,
            shortlisted: 1, // Accepted
            feedback: remark || null
          };
          
          this.http.post<any>(
            `${this.apiBase}/demand/${demandId}/profile-action`,
            profileActionPayload,
            { headers }
          ).subscribe({
            next: () => {
              this.showToastMessage('✅ CV accepted', 'success');
              // Refresh current lists and close modal
              this.loadCvReceived();
              this.loadSubmitted();
              this.closeProfileModal(); // Close modal automatically after action
            },
            error: (err) => {
              console.error('Failed to insert into tbl_submissions:', err);
              // Still show success for cv-approve, but log the error
              this.showToastMessage('✅ CV accepted (but submission record failed)', 'success');
              this.loadCvReceived();
              this.loadSubmitted();
              this.closeProfileModal();
            }
          });
        } else {
          // If we don't have enough data for profile-action, just proceed with cv-approve success
          this.showToastMessage('✅ CV accepted', 'success');
          this.loadCvReceived();
          this.loadSubmitted();
          this.closeProfileModal();
        }
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

  toggleRecruiterDropdown(event?: Event): void {
    console.log('Toggle recruiter dropdown:', this.showRecruiterDropdown);
    this.showRecruiterDropdown = !this.showRecruiterDropdown;
    if (this.showRecruiterDropdown) {
      this.showTeamLeaderDropdown = false;
      this.showAssignedToDropdown = false;
    }
  }

  toggleTeamLeaderDropdown(event?: Event): void {
    console.log('Toggle team leader dropdown:', this.showTeamLeaderDropdown);
    this.showTeamLeaderDropdown = !this.showTeamLeaderDropdown;
    if (this.showTeamLeaderDropdown) {
      this.showRecruiterDropdown = false;
      this.showAssignedToDropdown = false;
    }
  }

  toggleAssignedToDropdown(event?: Event): void {
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

  // Handle blur event for assigned to input
  onAssignedToInputBlur(): void {
    // Close dropdown when input loses focus
    // Use setTimeout to allow for potential clicks on dropdown items
    setTimeout(() => {
      // Check if focus moved to another element within the dropdown
      const activeElement = document.activeElement;
      const isWithinDropdown = activeElement && (
        activeElement.closest('.unified-dropdown') ||
        activeElement.closest('.dropdown-list') ||
        activeElement.closest('.selected-section')
      );
      
      if (this.showAssignedToDropdown && !isWithinDropdown) {
        this.closeAssignedToDropdown();
      }
    }, 200);
  }

  // Remove recruiter from selected list
  removeRecruiter(id: number): void {
    this.selectedRecruiterIds.delete(id);
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

  // Status editing methods
  private clickTimer: number | null = null;
  
  handleStatusClick(event: Event): void {
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
  }

  handleStatusDoubleClick(event: Event, demandId: number, currentStatus: string): void {
    console.log('Double-click detected on status cell. Demand ID:', demandId, 'Status:', currentStatus);
    event.stopPropagation();
    event.preventDefault();
    
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    
    if (!demandId || demandId === null || demandId === undefined || isNaN(demandId)) {
      console.error('Invalid demand ID:', demandId);
      this.errorMsg.set('Invalid demand ID: ' + demandId);
      return;
    }
    
    console.log('Opening modal with demand ID:', demandId);
    this.openStatusModal(demandId, currentStatus);
  }

  openStatusModal(demandId: number, currentStatus: string): void {
    console.log('Opening status modal for demand:', demandId, 'with status:', currentStatus);
    this.selectedDemandId = demandId;
    this.selectedDemandStatus = currentStatus;
    // Map database status to UI status
    const statusMap: { [key: string]: string } = {
      'open': 'open',
      'in_progress': 'open',
      'on_hold': 'hold',
      'closed': 'close',
      'rejected': 'cancel'  // Database "rejected" maps to UI "cancel"
    };
    this.selectedStatus = statusMap[currentStatus?.toLowerCase()] || 'open';
    this.statusRemark = '';
    this.showStatusModal.set(true);
    console.log('Status modal signal set to:', this.showStatusModal());
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.selectedDemandId = null;
    this.selectedDemandStatus = '';
    this.statusRemark = '';
    this.selectedStatus = 'open';
  }

  saveStatus(): void {
    if (!this.selectedDemandId) {
      this.errorMsg.set('No demand selected');
      return;
    }

    // Map UI status to database status
    const statusMap: { [key: string]: string } = {
      'open': 'open',
      'hold': 'on_hold',
      'close': 'closed',
      'cancel': 'rejected'  // Cancel maps to rejected in database
    };

    const dbStatus = statusMap[this.selectedStatus] || 'open';

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.post<any>(
      `${this.apiBase}/demand/${this.selectedDemandId}/status`,
      {
        status: dbStatus,
        spoc_remark: this.statusRemark || null
      },
      { headers }
    ).subscribe({
      next: () => {
        this.successMsg.set('Status updated successfully');
        this.closeStatusModal();
        // Reload data
        this.loadUnassigned();
        this.loadAssigned();
        this.loadCvReceived();
        setTimeout(() => this.successMsg.set(null), 3000);
      },
      error: (err) => {
        console.error('Error updating status:', err);
        this.errorMsg.set('Failed to update status: ' + (err.error?.detail || err.message));
        setTimeout(() => this.errorMsg.set(null), 5000);
      }
    });
  }

  formatStatus(status: string): string {
    if (!status) return 'Open';
    const statusMap: { [key: string]: string } = {
      'open': 'Open',
      'in_progress': 'Open',
      'on_hold': 'Hold',
      'closed': 'Closed',
      'rejected': 'Cancel',  // Database "rejected" displays as "Cancel" in UI
      'hold': 'Hold',
      'close': 'Closed',
      'cancel': 'Cancel'
    };
    return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusBadgeClass(status: string): string {
    if (!status) return 'status-open';
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'open' || normalizedStatus === 'in_progress') {
      return 'status-open';
    } else if (normalizedStatus === 'on_hold' || normalizedStatus === 'hold') {
      return 'status-hold';
    } else if (normalizedStatus === 'closed' || normalizedStatus === 'close' || normalizedStatus === 'cancel' || normalizedStatus === 'rejected') {
      return 'status-closed';
    }
    return 'status-open';
  }

  // Submitted profiles modal methods
  openSubmittedProfilesModal(demand: any): void {
    console.log('Opening submitted profiles modal for demand:', demand);
    this.selectedSubmittedDemand = demand;
    
    // Flatten all submitted CVs from all activities for this demand
    const allProfiles: any[] = [];
    let profileIndex = 0;
    
    if (demand.activities && Array.isArray(demand.activities)) {
      demand.activities.forEach((activity: any) => {
        if (activity.submitted_cvs && Array.isArray(activity.submitted_cvs)) {
          activity.submitted_cvs.forEach((cv: any) => {
            // Construct CV URL from file_path if cv_url is null
            let cvUrl = cv.cv_url;
            let cvAvailable = cv.cv_available !== false;
            
            if (!cvUrl && cv.file_path) {
              // Parse file_path to extract recruiter_id, demand_id, and filename
              // Format: C:/Users/.../src/assets/cv_uploads/<recruiter_id>/<demand_id>/<filename>
              // or: src/assets/cv_uploads/<recruiter_id>/<demand_id>/<filename>
              const filePath = cv.file_path.replace(/\\/g, '/');
              const parts = filePath.split('/');
              const idx = parts.findIndex((p: string) => p === 'cv_uploads');
              
              if (idx >= 0 && parts.length >= idx + 4) {
                const rid = parts[idx + 1];
                const did = parts[idx + 2];
                const fname = parts.slice(idx + 3).join('/');
                
                if (rid && did && fname) {
                  cvUrl = `${this.apiBase}/cv-file/${encodeURIComponent(rid)}/${encodeURIComponent(did)}/${encodeURIComponent(fname)}`;
                  cvAvailable = true;
                }
              } else if (cv.filename && activity.recruiter_id && demand.demand_id) {
                // Fallback: use filename with recruiter_id and demand_id from activity
                const encodedFilename = encodeURIComponent(cv.filename);
                cvUrl = `${this.apiBase}/cv-file/${activity.recruiter_id}/${demand.demand_id}/${encodedFilename}`;
                cvAvailable = true;
              }
            }
            
            allProfiles.push({
              ...cv,
              recruiter_name: activity.recruiter_name || activity.recruiter_email,
              recruiter_id: activity.recruiter_id,
              activity_id: activity.id,
              demand_id: demand.demand_id,
              profile_index: profileIndex++,
              cv_url: cvUrl || null,
              cv_available: cvAvailable
            });
          });
        }
      });
    }
    
    this.submittedProfiles.set(allProfiles);
    this.profileSelections.set(new Map());
    this.showSubmittedProfilesModal.set(true);
  }

  closeSubmittedProfilesModal(): void {
    this.showSubmittedProfilesModal.set(false);
    this.selectedSubmittedDemand = null;
    this.submittedProfiles.set([]);
    this.profileSelections.set(new Map());
    this.profileRemarks.set(new Map());
  }

  toggleProfileSelection(profileIndex: number, isAccept: boolean): void {
    const currentSelections = this.profileSelections();
    const newSelections = new Map(currentSelections);
    
    // If already selected with same action, deselect
    if (newSelections.get(profileIndex) === isAccept) {
      newSelections.delete(profileIndex);
    } else {
      // Set new selection (mutually exclusive - if accept is selected, remove reject and vice versa)
      newSelections.set(profileIndex, isAccept);
    }
    
    this.profileSelections.set(newSelections);
  }

  isProfileSelected(profileIndex: number, isAccept: boolean): boolean {
    return this.profileSelections().get(profileIndex) === isAccept;
  }

  updateProfileRemark(profileIndex: number, remark: string): void {
    const currentRemarks = this.profileRemarks();
    const newRemarks = new Map(currentRemarks);
    newRemarks.set(profileIndex, remark);
    this.profileRemarks.set(newRemarks);
  }

  getProfileRemark(profileIndex: number): string {
    return this.profileRemarks().get(profileIndex) || '';
  }

  saveProfileSelections(): void {
    if (!this.selectedSubmittedDemand) {
      this.errorMsg.set('No demand selected');
      return;
    }

    const selections = this.profileSelections();
    const profiles = this.submittedProfiles();
    const demandId = this.selectedSubmittedDemand.demand_id;

    if (selections.size === 0) {
      this.errorMsg.set('Please select at least one profile to accept or reject');
      return;
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Store the indices to remove before making API calls
    const removedIndices = new Set(Array.from(selections.keys()));
    
    // Process each selection and create HTTP observables
    const httpRequests: any[] = [];
    
    selections.forEach((isAccept, profileIndex) => {
      // Find profile by profile_index (not array index)
      const profile = profiles.find((p: any) => p.profile_index === profileIndex);
      if (!profile) {
        console.warn('Profile not found for index:', profileIndex);
        return;
      }

      const remark = this.profileRemarks().get(profileIndex) || '';

      const action = {
        recruiter_id: profile.recruiter_id,
        candidate_name: profile.candidate_name,
        candidate_email: profile.email || null,
        candidate_phone: profile.phone || null,
        cv_url: profile.cv_url || null,
        shortlisted: isAccept ? 1 : 0,
        feedback: remark || null
      };

      httpRequests.push(
        this.http.post<any>(
          `${this.apiBase}/demand/${demandId}/profile-action`,
          action,
          { headers }
        )
      );
    });

    // Execute all HTTP requests using forkJoin
    if (httpRequests.length > 0) {
      forkJoin(httpRequests).subscribe({
        next: () => {
          // Show success snackbar notification
          this.toastService.success('Profile selections saved successfully');
          
          // Get current profiles and filter out the ones that were saved
          const currentProfiles = [...this.submittedProfiles()]; // Create a copy
          console.log('Before removal - Total profiles:', currentProfiles.length);
          console.log('Removing indices:', Array.from(removedIndices));
          console.log('Current profile indices:', currentProfiles.map(p => p.profile_index));
          
          // Filter out removed profiles - create new array to ensure change detection
          // Convert all indices to numbers for comparison to handle string/number mismatches
          const removedIndicesNum = new Set(Array.from(removedIndices).map(idx => Number(idx)));
          const remaining: any[] = currentProfiles.filter((p: any) => {
            const profileIdx = Number(p.profile_index);
            const shouldRemove = removedIndicesNum.has(profileIdx);
            if (shouldRemove) {
              console.log('Removing profile:', profileIdx, p.candidate_name);
            }
            return !shouldRemove;
          });
          
          console.log('After removal - Remaining profiles:', remaining.length);
          
          // Create a completely new array reference to ensure change detection
          const newProfilesArray = remaining.length > 0 ? remaining.map(p => ({ ...p })) : [];
          console.log('Setting new profiles array, length:', newProfilesArray.length);
          
          // Update the profiles list immediately
          this.submittedProfiles.set(newProfilesArray);
          console.log('Signal updated, current value length:', this.submittedProfiles().length);
          
          // Force change detection to ensure UI updates immediately
          this.cdr.detectChanges();
          
          // Clear selections and remarks after successful save
          this.profileSelections.set(new Map());
          this.profileRemarks.set(new Map());
          
          // Always reload the submitted tab to update the main table with correct counts
          this.loadSubmitted();
          
          // If no profiles remain in modal, close it
          if (remaining.length === 0) {
            setTimeout(() => {
              this.closeSubmittedProfilesModal();
            }, 300);
          }
        },
        error: (err) => {
          console.error('Error saving profile selections:', err);
          this.toastService.error('Failed to save selections: ' + (err.error?.detail || err.message));
        }
      });
    }
  }

  viewSubmittedCv(cvUrl: string): void {
    if (cvUrl) {
      window.open(cvUrl, '_blank');
    }
  }
}


