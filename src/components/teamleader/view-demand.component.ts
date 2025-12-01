import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

// ViewDemandComponent - Team Leader view for managing demands

@Component({
  selector: 'app-view-demand',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './view-demand.component.html',
  styleUrls: ['./view-demand.component.css']
})
export class ViewDemandComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);

  apiBase = environment.apiBase;

  // Tabs state
  activeTab: 'unassigned' | 'assigned' | 'cv_received' | 'submitted' = 'unassigned';
  unassigned = signal<any[]>([]);
  assigned = signal<any[]>([]);
  cvReceived = signal<any[]>([]);
  submitted = signal<any[]>([]);

  // Assigned tab search
  assignedSearchTerm = signal('');
  filteredAssigned = signal<any[]>([]);

  // Profile modal state
  showProfileModal = false;
  selectedDemand: any = null;
  profiles = signal<any[]>([]);
  selectedActivityId: number | null = null;

  // CV Modal state
  showCvModal = signal(false);
  selectedCvUrl = signal<string | null>(null);

  // Status edit modal state
  showStatusModal = signal(false);
  selectedDemandId: number | null = null;
  selectedDemandStatus: string = '';
  statusRemark: string = '';
  selectedStatus: string = 'open';

  // CV Received count
  cvReceivedCount = computed(() => this.cvReceived().length);

  // Schedule interview modal state
  showScheduleInterviewModal = signal(false);
  selectedCandidateForSchedule: any = null;
  interviewRounds = signal<Array<{ round: string; slots: Array<{ date: string; time: string }> }>>([
    {
      round: '',
      slots: [{ date: '', time: '' }],
    },
  ]);

  ngOnInit(): void {
    if (!this.apiBase) {
      console.error('API base URL is not configured in environment.apiBase');
      this.errorMsg.set('API base URL is not configured. Please contact the administrator.');
      return;
    }

    console.log('ViewDemandComponent initialized - Status edit feature enabled');
    this.loadUnassigned();
    this.loadAssigned();
    this.loadCvReceived();
    this.loadSubmitted();
  }

  setTab(tab: 'unassigned' | 'assigned' | 'cv_received' | 'submitted') {
    this.activeTab = tab;
    if (tab === 'unassigned') this.loadUnassigned();
    if (tab === 'assigned') this.loadAssigned();
    if (tab === 'cv_received') this.loadCvReceived();
    if (tab === 'submitted') this.loadSubmitted();
  }

  loadUnassigned(): void {
    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    this.http.get<any[]>(`${this.apiBase}/demand/unassigned`, { headers }).subscribe({
      next: (rows) => {
        console.log('Unassigned demands loaded:', rows);
        console.log('First demand structure:', rows?.[0]);
        const demandsWithStatus = (rows || []).map((d: any) => {
          console.log('Demand item:', d, 'ID:', d.id, 'Status:', d.status);
          return {
            ...d,
            id: d.id,
            status: d.status || 'open'
          };
        });
        this.unassigned.set(demandsWithStatus);
      },
      error: (err) => {
        console.error('Error loading unassigned:', err);
        this.unassigned.set([]);
      },
    });
  }

  loadAssigned(): void {
    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    this.http.get<any[]>(`${this.apiBase}/demand/assigned`, { headers }).subscribe({
      next: (rows) => {
        console.log('Assigned demands loaded:', rows);
        const demandsWithStatus = (rows || []).map((d: any) => ({
          ...d,
          status: d.status || 'open'
        }));
        this.assigned.set(demandsWithStatus);
        this.filterAssigned();
      },
      error: (err) => {
        console.error('Error loading assigned:', err);
        this.assigned.set([]);
        this.filteredAssigned.set([]);
      },
    });
  }

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

  onAssignedSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.assignedSearchTerm.set(target.value);
    this.filterAssigned();
  }

  clearAssignedSearch(): void {
    this.assignedSearchTerm.set('');
    this.filterAssigned();
  }

  loadCvReceived(): void {
    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    this.http.get<any[]>(`${this.apiBase}/cv-received`, { headers }).subscribe({
      next: (rows) => {
        // Transform the data: expand cv_list into individual rows
        const expandedRows: any[] = [];
        (rows || []).forEach((activity: any) => {
          // Parse cv_list if it's a string
          let cvList = activity.cv_list || [];
          if (typeof cvList === 'string') {
            try {
              cvList = JSON.parse(cvList);
            } catch (e) {
              console.error('Error parsing cv_list:', e);
              cvList = [];
            }
          }
          
          if (Array.isArray(cvList) && cvList.length > 0) {
            // Filter only CVs with status = 0 (waiting for approval)
            const waitingCvs = cvList.filter((cv: any) => {
              const status = cv.status;
              return status === 0 || status === '0';
            });
            
            waitingCvs.forEach((cv: any) => {
              expandedRows.push({
                activity_id: activity.id,
                demand_id: activity.demand_id,
                recruiter_id: activity.recruiter_id,
                recruiter_name: activity.recruiter_name || activity.recruiter_email || '-',
                recruiter_email: activity.recruiter_email || '-',
                uploaded_cv_count: activity.uploaded_cv_count || 0,
                required_cv_count: activity.required_cv_count || 0,
                client_name: activity.client_name || '-',
                spoc_name: activity.spoc_name || '-',
                skill: activity.skill || '-',
                candidate_name: cv.candidate_name || '-',
                candidate_email: cv.candidate_email || '-',
                candidate_phone: cv.candidate_phone || '-',
                cv_url: cv.cv_url || '',
                status: cv.status,
                demand_status: activity.demand_status || activity.status || 'open',
                upload_date: cv.upload_date || cv.uploaded_at || '',
                remark: cv.remark || ''
              });
            });
          }
        });
        this.cvReceived.set(expandedRows);
      },
      error: (err) => {
        console.error('Error loading CV received:', err);
        this.cvReceived.set([]);
      },
    });
  }

  loadSubmitted(): void {
    this.http.get<any[]>(`${this.apiBase}/cv-submitted`).subscribe({
      next: (rows) => {
        // Transform the data: expand cv_list into individual rows
        const expandedRows: any[] = [];
        (rows || []).forEach((activity: any) => {
          // Parse cv_list if it's a string
          let cvList = activity.cv_list || [];
          if (typeof cvList === 'string') {
            try {
              cvList = JSON.parse(cvList);
            } catch (e) {
              console.error('Error parsing cv_list:', e);
              cvList = [];
            }
          }
          
          if (Array.isArray(cvList) && cvList.length > 0) {
            // Filter only CVs with status = 1 (submitted)
            const submittedCvs = cvList.filter((cv: any) => {
              const status = cv.status;
              return status === 1 || status === '1' || status === 1;
            });
            
            submittedCvs.forEach((cv: any) => {
              expandedRows.push({
                activity_id: activity.id,
                demand_id: activity.demand_id,
                recruiter_id: activity.recruiter_id || '-',
                recruiter_name: activity.recruiter_name || activity.recruiter_email || '-',
                recruiter_email: activity.recruiter_email || '-',
                uploaded_cv_count: activity.uploaded_cv_count || 0,
                required_cv_count: activity.required_cv_count || 0,
                client_name: activity.client_name || '-',
                spoc_name: activity.spoc_name || '-',
                skill: activity.skill || '-',
                candidate_name: cv.candidate_name || '-',
                candidate_email: cv.candidate_email || '-',
                candidate_phone: cv.candidate_phone || '-',
                cv_url: cv.cv_url || '',
                status: cv.status,
                upload_date: cv.upload_date || cv.uploaded_at || '',
                remark: cv.remark || ''
              });
            });
          } else {
            // If no CVs or cv_list is not an array, still show the row with demand info
            expandedRows.push({
              activity_id: activity.id,
              demand_id: activity.demand_id,
              recruiter_id: activity.recruiter_id || '-',
              recruiter_name: activity.recruiter_name || activity.recruiter_email || '-',
              recruiter_email: activity.recruiter_email || '-',
              uploaded_cv_count: activity.uploaded_cv_count || 0,
              required_cv_count: activity.required_cv_count || 0,
              client_name: activity.client_name || '-',
              spoc_name: activity.spoc_name || '-',
              skill: activity.skill || '-',
              candidate_name: '-',
              candidate_email: '-',
              candidate_phone: '-',
              cv_url: '',
              status: '',
              upload_date: '',
              remark: ''
            });
          }
        });
        this.submitted.set(expandedRows);
      },
      error: (err) => {
        console.error('Error loading submitted CVs:', err);
        this.submitted.set([]);
      },
    });
  }

  viewJD(url: string): void {
    if (url) {
      window.open(url, '_blank');
    }
  }

  viewProfiles(cv: any): void {
    this.selectedDemand = cv;
    this.selectedActivityId = cv.activity_id || null;
    
    if (this.selectedActivityId) {
      this.http.get<any[]>(`${this.apiBase}/recruiter-activity/${this.selectedActivityId}/profiles`).subscribe({
        next: (data) => {
          // Add cv_index to each profile for Accept/Reject buttons
          // The backend returns profiles in the same order as cv_list, so index matches
          const profilesWithIndex = (data || []).map((profile: any, index: number) => ({
            ...profile,
            _cv_index: index
          }));
          this.profiles.set(profilesWithIndex);
          this.showProfileModal = true;
        },
        error: (err) => {
          console.error('Failed to load profiles:', err);
          this.errorMsg.set('Failed to load profile information');
        }
      });
    } else {
      this.profiles.set([]);
      this.showProfileModal = true;
    }
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.selectedDemand = null;
    this.profiles.set([]);
    this.selectedActivityId = null;
  }

  approveCv(activityId: number, cvIndex: number, profile?: any): void {
    const url = `${this.apiBase}/cv-approve/${activityId}`;
    this.http.post(url, { cv_index: cvIndex }).subscribe({
      next: () => {
        if (this.activeTab === 'submitted' && this.selectedDemand) {
          // Insert into tbl_submissions for the selected candidate
          const demandId = this.selectedDemand.demand_id || this.selectedDemand.id;
          const body = {
            recruiter_id: this.selectedDemand.recruiter_id,
            candidate_name: profile?.profile_name || profile?.candidate_name,
            candidate_email: profile?.candidate_email || null,
            candidate_phone: profile?.candidate_phone || null,
            shortlisted: 1,
            feedback: profile?.remark || null
          };
          this.http.post(`${this.apiBase}/demand/${demandId}/profile-action`, body).subscribe({
            next: () => {
              this.successMsg.set('✅ CV accepted');
              // Remove the selected profile from the modal list without reload
              const updated = this.profiles().filter(p => p._cv_index !== cvIndex);
              this.profiles.set(updated);
            },
            error: (err) => {
              this.errorMsg.set(err?.error?.detail || 'Failed to record acceptance');
            }
          });
        } else {
          this.successMsg.set('✅ CV accepted');
          this.loadCvReceived();
          this.closeProfileModal();
        }
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail || 'Failed to accept CV');
      }
    });
  }

  rejectCv(activityId: number, cvIndex: number, profile?: any): void {
    const url = `${this.apiBase}/cv-reject/${activityId}`;
    this.http.post(url, { cv_index: cvIndex }).subscribe({
      next: () => {
        if (this.activeTab === 'submitted' && this.selectedDemand) {
          // Insert into tbl_submissions with shortlisted = 0
          const demandId = this.selectedDemand.demand_id || this.selectedDemand.id;
          const body = {
            recruiter_id: this.selectedDemand.recruiter_id,
            candidate_name: profile?.profile_name || profile?.candidate_name,
            candidate_email: profile?.candidate_email || null,
            candidate_phone: profile?.candidate_phone || null,
            shortlisted: 0,
            feedback: profile?.remark || null
          };
          this.http.post(`${this.apiBase}/demand/${demandId}/profile-action`, body).subscribe({
            next: () => {
              this.successMsg.set('✅ CV rejected');
              // Remove the selected profile from the modal list without reload
              const updated = this.profiles().filter(p => p._cv_index !== cvIndex);
              this.profiles.set(updated);
            },
            error: (err) => {
              this.errorMsg.set(err?.error?.detail || 'Failed to record rejection');
            }
          });
        } else {
          this.successMsg.set('✅ CV rejected');
          this.loadCvReceived();
          this.closeProfileModal();
        }
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.detail || 'Failed to reject CV');
      }
    });
  }

  downloadCV(cvPath: string): void {
    if (!cvPath) {
      console.error('No CV path provided');
      return;
    }
    
    // Handle different URL formats
    let fullUrl = '';
    
    if (cvPath.startsWith('http://') || cvPath.startsWith('https://')) {
      // Already a full URL
      fullUrl = cvPath;
    } else if (cvPath.startsWith('/')) {
      // Absolute path - add API base
      fullUrl = `${this.apiBase}${cvPath}`;
    } else {
      // Relative path - add API base with slash
      fullUrl = `${this.apiBase}/${cvPath}`;
    }
    
    console.log('Opening CV URL:', fullUrl);
    // Open in modal popup instead of new window
    this.selectedCvUrl.set(fullUrl);
    this.showCvModal.set(true);
    console.log('CV Modal state:', { showCvModal: this.showCvModal(), selectedCvUrl: this.selectedCvUrl() });
  }

  closeCvModal(): void {
    this.showCvModal.set(false);
    this.selectedCvUrl.set(null);
  }

  sanitizeUrl(url: string | null): SafeResourceUrl | null {
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  openCvInNewWindow(): void {
    const url = this.selectedCvUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  handleScheduleInterviewClick(event: Event, profile: any): void {
    event?.stopPropagation();
    const enrichedProfile = {
      ...profile,
      demand_id: profile.demand_id || this.selectedDemand?.demand_id || this.selectedDemand?.id,
      recruiter_id: profile.recruiter_id || this.selectedDemand?.recruiter_id,
      recruiter_name: profile.recruiter_name || this.selectedDemand?.recruiter_name || profile.recruiter_email,
      submission_id: profile.submission_id || profile.id || profile.activity_id || null,
    };
    this.selectedCandidateForSchedule = enrichedProfile;
    this.initializeInterviewRounds(enrichedProfile?.interview_schedules);
    this.showScheduleInterviewModal.set(true);
  }

  closeScheduleInterviewModal(): void {
    this.showScheduleInterviewModal.set(false);
    this.selectedCandidateForSchedule = null;
    this.resetInterviewRounds();
  }

  addInterviewRound(): void {
    const currentRounds = this.interviewRounds();
    this.interviewRounds.set([
      ...currentRounds,
      {
        round: '',
        slots: [{ date: '', time: '' }],
      },
    ]);
  }

  removeInterviewRound(index: number): void {
    const currentRounds = this.interviewRounds();
    if (currentRounds.length <= 1) {
      return;
    }
    const updated = currentRounds.filter((_, i) => i !== index);
    this.interviewRounds.set(updated);
  }

  addSlotToRound(roundIndex: number): void {
    const currentRounds = this.interviewRounds();
    const target = currentRounds[roundIndex];
    if (!target) {
      return;
    }
    const updatedRound = {
      ...target,
      slots: [...target.slots, { date: '', time: '' }],
    };
    const updatedRounds = [...currentRounds];
    updatedRounds[roundIndex] = updatedRound;
    this.interviewRounds.set(updatedRounds);
  }

  removeSlotFromRound(roundIndex: number, slotIndex: number): void {
    const currentRounds = this.interviewRounds();
    const target = currentRounds[roundIndex];
    if (!target || target.slots.length <= 1) {
      return;
    }
    const updatedRound = {
      ...target,
      slots: target.slots.filter((_, i) => i !== slotIndex),
    };
    const updatedRounds = [...currentRounds];
    updatedRounds[roundIndex] = updatedRound;
    this.interviewRounds.set(updatedRounds);
  }

  saveInterviewSchedule(): void {
    if (!this.selectedCandidateForSchedule) {
      this.errorMsg.set('No candidate selected for scheduling');
      return;
    }

    const schedulePayload = this.buildInterviewSchedulePayload();
    if (!schedulePayload || Object.keys(schedulePayload).length === 0) {
      this.errorMsg.set('Please provide at least one round with a valid slot');
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

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, payload, { headers }).subscribe({
      next: () => {
        this.successMsg.set('Interview schedule saved successfully');
        this.closeScheduleInterviewModal();
        this.loadCvReceived();
        this.loadSubmitted();
      },
      error: (err) => {
        console.error('Failed to save interview schedule:', err);
        this.errorMsg.set(err?.error?.detail || 'Failed to save interview schedule');
      },
    });
  }

  private initializeInterviewRounds(rawSchedules: any): void {
    const parsed = this.parseInterviewSchedules(rawSchedules || this.selectedCandidateForSchedule?.interview_schedules);
    const rounds: Array<{ round: string; slots: Array<{ date: string; time: string }> }> = [];

    Object.entries(parsed).forEach(([roundKey, roundValue]) => {
      const data = roundValue as any;
      const slots = Array.isArray(data?.slots)
        ? data.slots.map((slot: any) => ({
            date: slot?.date || '',
            time: this.normalizeTimeForInput(slot?.time || ''),
          }))
        : [{ date: '', time: '' }];
      rounds.push({
        round: roundKey,
        slots,
      });
    });

    if (rounds.length === 0) {
      this.resetInterviewRounds();
    } else {
      this.interviewRounds.set(rounds);
    }
  }

  private resetInterviewRounds(): void {
    this.interviewRounds.set([
      {
        round: '',
        slots: [{ date: '', time: '' }],
      },
    ]);
  }

  private parseInterviewSchedules(raw: any): Record<string, any> {
    if (!raw) {
      return {};
    }
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
    if (!time) {
      return '';
    }
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
    if (!time) {
      return '';
    }
    const [hours, minutes = '00'] = time.split(':');
    let hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
  }

  private buildInterviewSchedulePayload(): Record<string, any> {
    const payload: Record<string, any> = {};
    this.interviewRounds().forEach((roundData, index) => {
      const validSlots = roundData.slots.filter((slot) => slot.date && slot.time);
      if (validSlots.length === 0) {
        return;
      }
      const roundKey = roundData.round?.trim() || `R${index + 1}`;
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

  // Status editing methods
  private clickTimer: number | null = null;
  
  handleStatusClick(event: Event): void {
    // Prevent single click from doing anything, but allow double-click
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
      'closed': 'close'
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
      'cancel': 'closed'
    };

    const dbStatus = statusMap[this.selectedStatus] || 'open';

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.post(`${this.apiBase}/demand/${this.selectedDemandId}/status`, {
      status: dbStatus,
      spoc_remark: this.statusRemark || null
    }, { headers }).subscribe({
      next: () => {
        this.successMsg.set('Status updated successfully');
        this.closeStatusModal();
        
        // Refresh the current tab data
        if (this.activeTab === 'unassigned') {
          this.loadUnassigned();
        } else if (this.activeTab === 'assigned') {
          this.loadAssigned();
        } else if (this.activeTab === 'cv_received') {
          this.loadCvReceived();
        }
      },
      error: (error) => {
        console.error('Failed to update status:', error);
        this.errorMsg.set(`Failed to update status: ${error.error?.detail || error.message}`);
      }
    });
  }

  formatStatus(status: string): string {
    if (!status) return 'Open';
    const statusMap: { [key: string]: string } = {
      'open': 'Open',
      'in_progress': 'In Progress',
      'on_hold': 'Hold',
      'hold': 'Hold',
      'closed': 'Closed',
      'close': 'Close',
      'cancel': 'Cancel'
    };
    return statusMap[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusBadgeClass(status: string): string {
    if (!status) return 'status-open';
    const statusLower = status.toLowerCase();
    if (statusLower === 'open' || statusLower === 'in_progress') {
      return 'status-open';
    } else if (statusLower === 'on_hold' || statusLower === 'hold') {
      return 'status-hold';
    } else if (statusLower === 'closed' || statusLower === 'close' || statusLower === 'cancel') {
      return 'status-closed';
    }
    return 'status-open';
  }
}
