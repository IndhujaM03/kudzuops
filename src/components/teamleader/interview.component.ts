import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ToastService } from '../../services/toast.service';

interface InterviewSchedule {
  id: number;
  submission_id: number | null;
  recruiter_id: number;
  candidate_name: string;
  demand_id: number;
  candidate_email: string | null;
  candidate_phone: string | null;
  interview_schedules: any; // JSON object with rounds
  created_at: string;
  updated_at: string;
  status?: string; // Status column from database
  recruiter_name?: string; // Included from backend
  skill?: string; // Skill from demand_sheet
  spoc_name?: string; // SPOC name from client_spocs
}

interface ProcessedInterview {
  scheduleId: number;
  candidateName: string;
  recruiterId: number;
  recruiterName: string;
  round: string;
  slots: Array<{
    date: string;
    time: string;
    slot_status: number;
  }>;
  roundStatus: number;
  candidateEmail: string | null;
  candidatePhone: string | null;
  demandId: number;
  completedRounds?: string[]; // All completed rounds (round_status = 2) for this candidate
  skill?: string;
  spocName?: string;
}

@Component({
  selector: 'app-interview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './interview.component.html',
  styleUrls: ['./interview.component.css']
})
export class InterviewComponent implements OnInit {
  private http = inject(HttpClient);
  private toastService = inject(ToastService);

  apiBase = environment.apiBase || '';
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  // Tabs state
  activeTab: 'waiting' | 'spoc_communication' | 'confirmed' = 'waiting';
  
  // Raw schedules from API
  allSchedules = signal<InterviewSchedule[]>([]);
  
  // Processed data for each tab
  waitingInterviews = computed(() => this.processWaitingInterviews());
  spocCommunicationInterviews = computed(() => this.processSpocCommunicationInterviews());
  confirmedInterviews = computed(() => this.processConfirmedInterviews());

  // Pagination state
  currentPage = signal(1);
  itemsPerPage = 10;

  // Pagination computed values for each tab
  paginatedWaiting = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.waitingInterviews().slice(start, end);
  });

  paginatedSpocCommunication = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.spocCommunicationInterviews().slice(start, end);
  });

  paginatedConfirmed = computed(() => {
    const start = (this.currentPage() - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.confirmedInterviews().slice(start, end);
  });

  // Total pages for each tab
  totalPagesWaiting = computed(() => Math.ceil(this.waitingInterviews().length / this.itemsPerPage));
  totalPagesSpocCommunication = computed(() => Math.ceil(this.spocCommunicationInterviews().length / this.itemsPerPage));
  totalPagesConfirmed = computed(() => Math.ceil(this.confirmedInterviews().length / this.itemsPerPage));

  // Current tab's total pages
  currentTotalPages = computed(() => {
    switch (this.activeTab) {
      case 'waiting': return this.totalPagesWaiting();
      case 'spoc_communication': return this.totalPagesSpocCommunication();
      case 'confirmed': return this.totalPagesConfirmed();
      default: return 1;
    }
  });

  // Current tab's data length
  currentDataLength = computed(() => {
    switch (this.activeTab) {
      case 'waiting': return this.waitingInterviews().length;
      case 'spoc_communication': return this.spocCommunicationInterviews().length;
      case 'confirmed': return this.confirmedInterviews().length;
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

  // Recruiter names cache (we'll need to fetch this)
  recruiterNames: Map<number, string> = new Map();

  // SPOC Confirmation Modal state
  showSpocConfirmationModal = signal(false);
  selectedInterviewForAction: ProcessedInterview | null = null;
  spocConfirmationAnswer: 'yes' | 'no' | null = null;
  showRescheduleSlots = signal(false);
  rescheduleSlots = signal<Array<{date: string, time: string, slot_status: number}>>([{date: '', time: '', slot_status: 0}]);

  // Interview Status Modal state (for Confirmed tab)
  showInterviewStatusModal = signal(false);
  selectedConfirmedInterview: ProcessedInterview | null = null;
  interviewStatusAction: 'completed' | 'not_completed' | null = null;
  completedAction: 'final' | 'next_round' | null = null;
  notCompletedAction: 'yes' | 'no' | null = null;
  showNextRoundSlots = signal(false);
  nextRoundSlots = signal<Array<{date: string, time: string, slot_status: number}>>([{date: '', time: '', slot_status: 0}]);
  selectedNextRound: string = '';

  ngOnInit(): void {
    this.loadInterviewSchedules();
  }

  setTab(tab: 'waiting' | 'spoc_communication' | 'confirmed'): void {
    this.activeTab = tab;
    this.currentPage.set(1); // Reset to first page when changing tabs
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.currentTotalPages() && page !== -1) {
      this.currentPage.set(page);
    }
  }

  refreshData(): void {
    this.loadInterviewSchedules();
  }

  loadInterviewSchedules(): void {
    this.loading.set(true);
    this.errorMsg.set(null);

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    this.http.get<{ items: InterviewSchedule[], total: number }>(`${this.apiBase}/interview-schedule/all`, { headers }).subscribe({
      next: (response) => {
        console.log('Received interview schedules response:', response);
        const items = response.items || [];
        console.log('Total items received:', items.length);
        
        // Ensure interview_schedules is parsed if it's a string
        items.forEach((schedule: InterviewSchedule) => {
          if (typeof schedule.interview_schedules === 'string') {
            try {
              schedule.interview_schedules = JSON.parse(schedule.interview_schedules);
            } catch (e) {
              console.error('Failed to parse interview_schedules for schedule', schedule.id, e);
              schedule.interview_schedules = {};
            }
          }
          
          // Populate recruiter names
          if (schedule.recruiter_name) {
            this.recruiterNames.set(schedule.recruiter_id, schedule.recruiter_name);
          }
        });
        
        this.allSchedules.set(items);
        
        // Fallback: load recruiter names if not in response
        if (items.some((s: InterviewSchedule) => !s.recruiter_name)) {
          this.loadRecruiterNames();
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load interview schedules:', error);
        this.errorMsg.set(`Failed to load interview schedules: ${error.error?.detail || error.message}`);
        this.loading.set(false);
      }
    });
  }

  loadRecruiterNames(): void {
    // Fetch all recruiters to get their names
    const schedules = this.allSchedules();
    const recruiterIds = [...new Set(schedules.map(s => s.recruiter_id))];
    
    if (recruiterIds.length === 0) return;

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch all users with recruiter role
    this.http.get<any[]>(`${this.apiBase}/users?role=recruiter`, { headers }).subscribe({
      next: (users) => {
        users.forEach(user => {
          const name = user.display_name || user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || `Recruiter ${user.id}`;
          this.recruiterNames.set(user.id, name);
        });
      },
      error: (error) => {
        console.error('Failed to load recruiter names:', error);
        // Fallback: set default names
        recruiterIds.forEach(id => {
          if (!this.recruiterNames.has(id)) {
            this.recruiterNames.set(id, `Recruiter ${id}`);
          }
        });
      }
    });
  }

  processWaitingInterviews(): ProcessedInterview[] {
    const processed: ProcessedInterview[] = [];
    const schedules = this.allSchedules();

    console.log('Processing waiting interviews. Total schedules:', schedules.length);

    // Filter schedules where status = "scheduled"
    const scheduledSchedules = schedules.filter(schedule => 
      schedule.status === 'scheduled' || schedule.status === null || schedule.status === undefined
    );

    scheduledSchedules.forEach(schedule => {
      const interviewSchedules = schedule.interview_schedules || {};
      
      console.log('Schedule ID:', schedule.id, 'Candidate:', schedule.candidate_name);
      console.log('Interview schedules data:', interviewSchedules);
      
      // Check if interview_schedules is a string (needs parsing)
      let parsedSchedules = interviewSchedules;
      if (typeof interviewSchedules === 'string') {
        try {
          parsedSchedules = JSON.parse(interviewSchedules);
        } catch (e) {
          console.error('Failed to parse interview_schedules:', e);
          return;
        }
      }
      
      // Iterate through each round (R1, R2, etc.)
      Object.keys(parsedSchedules).forEach(roundKey => {
        const roundData = parsedSchedules[roundKey];
        if (!roundData || !roundData.slots) {
          console.log('Round', roundKey, 'has no slots or invalid data');
          return;
        }

        // Check if round_status = 0 (waiting status)
        const roundStatus = roundData.round_status;
        const isWaitingRound = roundStatus === 0 || roundStatus === '0' || roundStatus === null || roundStatus === undefined;
        
        console.log('Round', roundKey, 'has', roundData.slots.length, 'slots, round_status:', roundStatus, 'isWaiting:', isWaitingRound);
        
        // If round_status = 0, include all slots for this round
        if (isWaitingRound && roundData.slots.length > 0) {
          // Include all slots for this round
          processed.push({
            scheduleId: schedule.id,
            candidateName: schedule.candidate_name || 'Unknown',
            recruiterId: schedule.recruiter_id,
            recruiterName: schedule.recruiter_name || this.recruiterNames.get(schedule.recruiter_id) || `Recruiter ${schedule.recruiter_id}`,
            round: roundKey,
            slots: roundData.slots, // Include all slots for rounds with round_status = 0
            roundStatus: roundData.round_status || 0,
            candidateEmail: schedule.candidate_email,
            candidatePhone: schedule.candidate_phone,
            demandId: schedule.demand_id
          });
        }
      });
    });

    console.log('Total processed waiting interviews:', processed.length);
    return processed;
  }

  processSpocCommunicationInterviews(): ProcessedInterview[] {
    const processed: ProcessedInterview[] = [];
    const schedules = this.allSchedules();

    console.log('Processing SPOC communication interviews. Total schedules:', schedules.length);

    // Filter schedules where status = "slot_allocated"
    const slotAllocatedSchedules = schedules.filter(schedule => 
      schedule.status === 'slot_allocated'
    );

    console.log('Schedules with status slot_allocated:', slotAllocatedSchedules.length);

    slotAllocatedSchedules.forEach(schedule => {
      const interviewSchedules = schedule.interview_schedules || {};
      
      console.log('Schedule ID:', schedule.id, 'Candidate:', schedule.candidate_name);
      
      // Check if interview_schedules is a string (needs parsing)
      let parsedSchedules = interviewSchedules;
      if (typeof interviewSchedules === 'string') {
        try {
          parsedSchedules = JSON.parse(interviewSchedules);
        } catch (e) {
          console.error('Failed to parse interview_schedules:', e);
          return;
        }
      }
      
      // Iterate through each round
      Object.keys(parsedSchedules).forEach(roundKey => {
        const roundData = parsedSchedules[roundKey];
        if (!roundData || !roundData.slots) {
          console.log('Round', roundKey, 'has no slots or invalid data');
          return;
        }

        // Check if round_status = 0
        const roundStatus = roundData.round_status;
        const isRoundStatusZero = roundStatus === 0 || roundStatus === '0' || roundStatus === null || roundStatus === undefined;
        
        if (!isRoundStatusZero) {
          console.log('Round', roundKey, 'round_status is not 0, skipping');
          return;
        }

        // Filter slots where slot_status = 1 (selected by candidate)
        const selectedSlots = roundData.slots.filter((slot: any) => {
          const slotStatus = slot.slot_status;
          const isSelected = slotStatus === 1 || slotStatus === '1';
          console.log('Slot:', slot.date, slot.time, 'slot_status:', slotStatus, 'isSelected:', isSelected);
          return isSelected;
        });
        
        console.log('Selected slots for round', roundKey, ':', selectedSlots.length);
        
        // Only show the selected slot(s)
        selectedSlots.forEach((slot: any) => {
          processed.push({
            scheduleId: schedule.id,
            candidateName: schedule.candidate_name || 'Unknown',
            recruiterId: schedule.recruiter_id,
            recruiterName: schedule.recruiter_name || this.recruiterNames.get(schedule.recruiter_id) || `Recruiter ${schedule.recruiter_id}`,
            round: roundKey,
            slots: [slot], // Only the selected slot
            roundStatus: roundData.round_status || 0,
            candidateEmail: schedule.candidate_email,
            candidatePhone: schedule.candidate_phone,
            demandId: schedule.demand_id
          });
        });
      });
    });

    console.log('Total processed SPOC communication interviews:', processed.length);
    return processed;
  }

  processConfirmedInterviews(): ProcessedInterview[] {
    const processed: ProcessedInterview[] = [];
    const schedules = this.allSchedules();

    console.log('Processing confirmed interviews. Total schedules:', schedules.length);

    // Filter schedules where status = "confirmed"
    const confirmedSchedules = schedules.filter(schedule => 
      schedule.status === 'confirmed'
    );

    console.log('Schedules with status confirmed:', confirmedSchedules.length);

    // Group by candidate (email + demand_id or name + demand_id) to collect all pending rounds (round_status = 0) from ALL schedules
    const candidateMap = new Map<string, {
      schedule: InterviewSchedule;
      pendingRounds: Set<string>; // Use Set to avoid duplicates - rounds with round_status = 0
      activeRound?: { roundKey: string; roundData: any; slots: any[] };
    }>();

    confirmedSchedules.forEach(schedule => {
      // Create unique key for candidate (email + demand_id is most reliable)
      const candidateKey = schedule.candidate_email 
        ? `${schedule.candidate_email}_${schedule.demand_id || 'no_demand'}`
        : `${schedule.candidate_name}_${schedule.demand_id || 'no_demand'}`;
      
      const interviewSchedules = schedule.interview_schedules || {};
      
      // Check if interview_schedules is a string (needs parsing)
      let parsedSchedules = interviewSchedules;
      if (typeof interviewSchedules === 'string') {
        try {
          parsedSchedules = JSON.parse(interviewSchedules);
        } catch (e) {
          console.error('Failed to parse interview_schedules:', e);
          return;
        }
      }
      
      // Initialize candidate data if not exists
      if (!candidateMap.has(candidateKey)) {
        candidateMap.set(candidateKey, {
          schedule,
          pendingRounds: new Set<string>(), // Rounds with round_status = 0
          activeRound: undefined
        });
      }
      
      const candidateData = candidateMap.get(candidateKey)!;
      
      // Sort rounds: R1, R2, R3, etc.
      const roundKeys = Object.keys(parsedSchedules);
      const sortRoundKey = (key: string): number => {
        const match = key.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
      };
      const sortedRoundKeys = roundKeys.sort((a, b) => sortRoundKey(a) - sortRoundKey(b));
      
      sortedRoundKeys.forEach(roundKey => {
        const roundData = parsedSchedules[roundKey];
        if (!roundData || !roundData.slots) return;

        const roundStatus = roundData.round_status;
        
        // Collect pending rounds (round_status = 0) - add to Set to avoid duplicates
        if (roundStatus === 0 || roundStatus === '0') {
          candidateData.pendingRounds.add(roundKey);
        }
        
        // Find active round (round_status = 0) with confirmed slots (slot_status = 1)
        // Only set if not already set (prefer first active round found)
        if ((roundStatus === 0 || roundStatus === '0') && !candidateData.activeRound) {
          const confirmedSlots = roundData.slots.filter((slot: any) => {
            const slotStatus = slot.slot_status;
            return slotStatus === 1 || slotStatus === '1';
          });
          
          if (confirmedSlots.length > 0) {
            candidateData.activeRound = {
              roundKey,
              roundData,
              slots: confirmedSlots
            };
          }
        }
      });
      
      // Update schedule reference to the most recent one (for skill, spoc_name, etc.)
      candidateData.schedule = schedule;
    });

    // Convert map to processed interviews
    candidateMap.forEach((candidateData, candidateKey) => {
      const schedule = candidateData.schedule;
      
      // Convert Set to sorted array - pending rounds (round_status = 0)
      const pendingRoundsArray = Array.from(candidateData.pendingRounds);
      const sortRoundKey = (key: string): number => {
        const match = key.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
      };
      pendingRoundsArray.sort((a, b) => sortRoundKey(a) - sortRoundKey(b));
      
      // If there's an active round, create an entry for it
      if (candidateData.activeRound) {
        processed.push({
          scheduleId: schedule.id,
          candidateName: schedule.candidate_name || 'Unknown',
          recruiterId: schedule.recruiter_id,
          recruiterName: schedule.recruiter_name || this.recruiterNames.get(schedule.recruiter_id) || `Recruiter ${schedule.recruiter_id}`,
          round: candidateData.activeRound.roundKey,
          slots: candidateData.activeRound.slots,
          roundStatus: candidateData.activeRound.roundData.round_status || 0,
          candidateEmail: schedule.candidate_email,
          candidatePhone: schedule.candidate_phone,
          demandId: schedule.demand_id,
          completedRounds: pendingRoundsArray, // Store pending rounds for display
          skill: schedule.skill,
          spocName: schedule.spoc_name
        });
      } else if (pendingRoundsArray.length > 0) {
        // If no active round but has pending rounds, still show the candidate
        processed.push({
          scheduleId: schedule.id,
          candidateName: schedule.candidate_name || 'Unknown',
          recruiterId: schedule.recruiter_id,
          recruiterName: schedule.recruiter_name || this.recruiterNames.get(schedule.recruiter_id) || `Recruiter ${schedule.recruiter_id}`,
          round: pendingRoundsArray[0], // Use first pending round as default
          slots: [],
          roundStatus: 0,
          candidateEmail: schedule.candidate_email,
          candidatePhone: schedule.candidate_phone,
          demandId: schedule.demand_id,
          completedRounds: pendingRoundsArray, // Store pending rounds for display
          skill: schedule.skill,
          spocName: schedule.spoc_name
        });
      }
    });

    console.log('Total processed confirmed interviews:', processed.length);
    return processed;
  }
  
  getCompletedRoundsDisplay(interview: ProcessedInterview): string {
    // For Confirmed tab, show pending rounds (round_status = 0) instead of completed rounds
    if (interview.completedRounds && interview.completedRounds.length > 0) {
      // Sort rounds: R1, R2, R3, etc.
      const sortRoundKey = (key: string): number => {
        const match = key.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
      };
      const sortedRounds = [...interview.completedRounds].sort((a, b) => sortRoundKey(a) - sortRoundKey(b));
      return sortedRounds.join(', ');
    }
    
    // If no pending rounds in completedRounds, try to get rounds with round_status = 0 from the schedule
    // Fetch from all schedules for this candidate with status = "confirmed"
    const schedules = this.allSchedules();
    const candidateSchedules = schedules.filter(s => 
      s.status === 'confirmed' &&
      ((s.candidate_email && interview.candidateEmail && s.candidate_email === interview.candidateEmail) ||
       (s.candidate_name && interview.candidateName && s.candidate_name === interview.candidateName))
    );
    
    if (candidateSchedules.length > 0) {
      // Collect all rounds with round_status = 0 from all confirmed schedules for this candidate
      const pendingRounds: string[] = [];
      
      candidateSchedules.forEach(schedule => {
        if (schedule.interview_schedules) {
          let parsedSchedules = schedule.interview_schedules;
          if (typeof parsedSchedules === 'string') {
            try {
              parsedSchedules = JSON.parse(parsedSchedules);
            } catch (e) {
              return;
            }
          }
          
          // Get all rounds with round_status = 0
          Object.keys(parsedSchedules).forEach(roundKey => {
            const roundData = parsedSchedules[roundKey];
            if (roundData && (roundData.round_status === 0 || roundData.round_status === '0')) {
              if (!pendingRounds.includes(roundKey)) {
                pendingRounds.push(roundKey);
              }
            }
          });
        }
      });
      
      if (pendingRounds.length > 0) {
        // Sort rounds: R1, R2, R3, etc.
        const sortRoundKey = (key: string): number => {
          const match = key.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : 999;
        };
        const sortedRounds = pendingRounds.sort((a, b) => sortRoundKey(a) - sortRoundKey(b));
        return sortedRounds.join(', ');
      }
    }
    
    return 'N/A';
  }

  getRecruiterName(recruiterId: number): string {
    return this.recruiterNames.get(recruiterId) || `Recruiter ${recruiterId}`;
  }

  openSpocConfirmationModal(interview: ProcessedInterview): void {
    this.selectedInterviewForAction = interview;
    this.spocConfirmationAnswer = null;
    this.showRescheduleSlots.set(false);
    this.rescheduleSlots.set([{date: '', time: '', slot_status: 0}]);
    this.showSpocConfirmationModal.set(true);
  }

  closeSpocConfirmationModal(): void {
    this.showSpocConfirmationModal.set(false);
    this.selectedInterviewForAction = null;
    this.spocConfirmationAnswer = null;
    this.showRescheduleSlots.set(false);
    this.rescheduleSlots.set([{date: '', time: '', slot_status: 0}]);
  }

  handleSpocConfirmation(answer: 'yes' | 'no'): void {
    this.spocConfirmationAnswer = answer;
    if (answer === 'yes') {
      this.confirmInterview();
    } else {
      this.showRescheduleSlots.set(true);
      // Initialize with existing slot
      if (this.selectedInterviewForAction && this.selectedInterviewForAction.slots.length > 0) {
        const existingSlot = this.selectedInterviewForAction.slots[0];
        this.rescheduleSlots.set([{
          date: existingSlot.date || '',
          time: this.convertTimeTo24Hour(existingSlot.time || ''),
          slot_status: 0
        }]);
      }
    }
  }

  convertTimeTo24Hour(time12: string): string {
    if (!time12) return '';
    if (time12.includes(':')) {
      const parts = time12.split(' ');
      if (parts.length === 2) {
        const [time, ampm] = parts;
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours, 10);
        if (ampm.toUpperCase() === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (ampm.toUpperCase() === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        return `${hour24.toString().padStart(2, '0')}:${minutes || '00'}`;
      }
    }
    return time12;
  }

  addRescheduleSlot(): void {
    const currentSlots = this.rescheduleSlots();
    this.rescheduleSlots.set([...currentSlots, {date: '', time: '', slot_status: 0}]);
  }

  removeRescheduleSlot(index: number): void {
    const currentSlots = this.rescheduleSlots();
    if (currentSlots.length > 1) {
      const newSlots = currentSlots.filter((_, i) => i !== index);
      this.rescheduleSlots.set(newSlots);
    }
  }

  confirmInterview(): void {
    if (!this.selectedInterviewForAction) return;

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch current schedule to get all data
    this.http.get<{ items: any[] }>(`${this.apiBase}/interview-schedule/all`, { headers }).subscribe({
      next: (response) => {
        const schedules = response.items || [];
        const currentSchedule = schedules.find(s => s.id === this.selectedInterviewForAction!.scheduleId);
        
        if (!currentSchedule) {
          this.errorMsg.set('Schedule not found');
          return;
        }

        // Get existing interview_schedules (keep as is, just update status)
        let existingSchedules: any = {};
        if (currentSchedule.interview_schedules) {
          if (typeof currentSchedule.interview_schedules === 'string') {
            try {
              existingSchedules = JSON.parse(currentSchedule.interview_schedules);
            } catch (e) {
              console.error('Failed to parse existing schedules:', e);
              existingSchedules = {};
            }
          } else {
            existingSchedules = currentSchedule.interview_schedules;
          }
        }

        // Update the schedule with status = "confirmed"
        this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, {
          submission_id: currentSchedule.submission_id,
          recruiter_id: currentSchedule.recruiter_id,
          candidate_name: currentSchedule.candidate_name,
          demand_id: currentSchedule.demand_id,
          candidate_email: currentSchedule.candidate_email,
          candidate_phone: currentSchedule.candidate_phone,
          interview_schedules: JSON.stringify(existingSchedules),
          status: 'confirmed'
        }, { headers }).subscribe({
          next: () => {
            // Reload schedules to refresh the UI
            this.loadInterviewSchedules();
            this.closeSpocConfirmationModal();
          },
          error: (error) => {
            console.error('Failed to confirm interview:', error);
            this.errorMsg.set(`Failed to confirm interview: ${error.error?.detail || error.message}`);
          }
        });
      },
      error: (error) => {
        console.error('Failed to fetch current schedule:', error);
        this.errorMsg.set('Failed to fetch current schedule');
      }
    });
  }

  saveRescheduleFromSpoc(): void {
    if (!this.selectedInterviewForAction) return;

    const slots = this.rescheduleSlots();
    const validSlots = slots.filter(slot => slot.date && slot.time);
    
    if (validSlots.length === 0) {
      this.errorMsg.set('Please fill in at least one date and time slot');
      return;
    }

    // Format time to 12-hour format
    const formatTime = (time24: string): string => {
      if (!time24) return '';
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes || '00'} ${ampm}`;
    };

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch current schedule to get all rounds
    this.http.get<{ items: any[] }>(`${this.apiBase}/interview-schedule/all`, { headers }).subscribe({
      next: (response) => {
        const schedules = response.items || [];
        const currentSchedule = schedules.find(s => s.id === this.selectedInterviewForAction!.scheduleId);
        
        if (!currentSchedule) {
          this.errorMsg.set('Schedule not found');
          return;
        }

        // Parse existing interview_schedules
        let existingSchedules: any = {};
        if (currentSchedule.interview_schedules) {
          if (typeof currentSchedule.interview_schedules === 'string') {
            try {
              existingSchedules = JSON.parse(currentSchedule.interview_schedules);
            } catch (e) {
              console.error('Failed to parse existing schedules:', e);
              existingSchedules = {};
            }
          } else {
            existingSchedules = currentSchedule.interview_schedules;
          }
        }

        // Update the specific round with new slots
        existingSchedules[this.selectedInterviewForAction!.round] = {
          round_status: 0,
          slots: validSlots.map(slot => ({
            date: slot.date,
            time: formatTime(slot.time),
            slot_status: 0
          }))
        };

        // Update the schedule
        this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, {
          submission_id: currentSchedule.submission_id,
          recruiter_id: currentSchedule.recruiter_id,
          candidate_name: currentSchedule.candidate_name,
          demand_id: currentSchedule.demand_id,
          candidate_email: currentSchedule.candidate_email,
          candidate_phone: currentSchedule.candidate_phone,
          interview_schedules: JSON.stringify(existingSchedules),
          status: 'scheduled'
        }, { headers }).subscribe({
          next: () => {
            // Reload schedules to refresh the UI
            this.loadInterviewSchedules();
            this.closeSpocConfirmationModal();
          },
          error: (error) => {
            console.error('Failed to save reschedule:', error);
            this.errorMsg.set(`Failed to save reschedule: ${error.error?.detail || error.message}`);
          }
        });
      },
      error: (error) => {
        console.error('Failed to fetch current schedule:', error);
        this.errorMsg.set('Failed to fetch current schedule');
      }
    });
  }

  // Interview Status Modal functions (for Confirmed tab)
  openInterviewStatusModal(interview: ProcessedInterview, action: 'completed' | 'not_completed'): void {
    this.selectedConfirmedInterview = interview;
    this.interviewStatusAction = action;
    this.completedAction = null;
    this.notCompletedAction = null;
    this.showNextRoundSlots.set(false);
    this.showRescheduleSlots.set(false);
    this.nextRoundSlots.set([{date: '', time: '', slot_status: 0}]);
    this.rescheduleSlots.set([{date: '', time: '', slot_status: 0}]);
    this.selectedNextRound = '';
    this.showInterviewStatusModal.set(true);
  }

  closeInterviewStatusModal(): void {
    this.showInterviewStatusModal.set(false);
    this.selectedConfirmedInterview = null;
    this.interviewStatusAction = null;
    this.completedAction = null;
    this.notCompletedAction = null;
    this.showNextRoundSlots.set(false);
    this.showRescheduleSlots.set(false);
    this.nextRoundSlots.set([{date: '', time: '', slot_status: 0}]);
    this.rescheduleSlots.set([{date: '', time: '', slot_status: 0}]);
    this.selectedNextRound = '';
  }

  handleCompletedAction(action: 'final' | 'next_round'): void {
    this.completedAction = action;
    if (action === 'final') {
      this.markInterviewAsFinal();
    } else {
      this.showNextRoundSlots.set(true);
    }
  }

  handleNotCompletedAction(action: 'yes' | 'no'): void {
    this.notCompletedAction = action;
    if (action === 'yes') {
      this.showRescheduleSlots.set(true);
      // Initialize with existing slot
      if (this.selectedConfirmedInterview && this.selectedConfirmedInterview.slots.length > 0) {
        const existingSlot = this.selectedConfirmedInterview.slots[0];
        this.rescheduleSlots.set([{
          date: existingSlot.date || '',
          time: this.convertTimeTo24Hour(existingSlot.time || ''),
          slot_status: 0
        }]);
      }
    } else {
      // If No, discard the interview
      this.discardInterview();
    }
  }

  addNextRoundSlot(): void {
    const currentSlots = this.nextRoundSlots();
    this.nextRoundSlots.set([...currentSlots, {date: '', time: '', slot_status: 0}]);
  }

  removeNextRoundSlot(index: number): void {
    const currentSlots = this.nextRoundSlots();
    if (currentSlots.length > 1) {
      const newSlots = currentSlots.filter((_, i) => i !== index);
      this.nextRoundSlots.set(newSlots);
    }
  }

  markInterviewAsFinal(): void {
    if (!this.selectedConfirmedInterview) return;

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Call the finalize endpoint which handles:
    // 1. Update tbl_interview_schedule (status = "completed", round_status = 2)
    // 2. Fetch demand and client details
    // 3. Fetch CV path from recruiter_activity
    // 4. Insert into tbl_client_onboarding
    this.http.post(`${this.apiBase}/interview-schedule/finalize`, {
      schedule_id: this.selectedConfirmedInterview.scheduleId,
      round_key: this.selectedConfirmedInterview.round
    }, { headers }).subscribe({
      next: (response) => {
        console.log('Interview finalized successfully:', response);
        // Reload schedules to refresh the UI
        this.loadInterviewSchedules();
        this.closeInterviewStatusModal();
      },
      error: (error) => {
        console.error('Failed to mark interview as final:', error);
        this.errorMsg.set(`Failed to mark interview as final: ${error.error?.detail || error.message}`);
      }
    });
  }

  saveNextRound(): void {
    if (!this.selectedConfirmedInterview || !this.selectedNextRound) {
      this.toastService.error('Please select a round');
      return;
    }

    const slots = this.nextRoundSlots();
    const validSlots = slots.filter(slot => slot.date && slot.time);
    
    if (validSlots.length === 0) {
      this.errorMsg.set('Please fill in at least one date and time slot');
      return;
    }

    // Format time to 12-hour format
    const formatTime = (time24: string): string => {
      if (!time24) return '';
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes || '00'} ${ampm}`;
    };

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch current schedule to get all rounds
    this.http.get<{ items: any[] }>(`${this.apiBase}/interview-schedule/all`, { headers }).subscribe({
      next: (response) => {
        const schedules = response.items || [];
        const currentSchedule = schedules.find(s => s.id === this.selectedConfirmedInterview!.scheduleId);
        
        if (!currentSchedule) {
          this.errorMsg.set('Schedule not found');
          return;
        }

        // Parse existing interview_schedules
        let existingSchedules: any = {};
        if (currentSchedule.interview_schedules) {
          if (typeof currentSchedule.interview_schedules === 'string') {
            try {
              existingSchedules = JSON.parse(currentSchedule.interview_schedules);
            } catch (e) {
              console.error('Failed to parse existing schedules:', e);
              existingSchedules = {};
            }
          } else {
            existingSchedules = currentSchedule.interview_schedules;
          }
        }

        // Update the previous round's round_status to 2 (completed)
        const previousRoundKey = this.selectedConfirmedInterview!.round;
        if (existingSchedules[previousRoundKey]) {
          existingSchedules[previousRoundKey].round_status = 2;
        }

        // Create new round key with slots
        existingSchedules[this.selectedNextRound] = {
          round_status: 0,
          slots: validSlots.map(slot => ({
            date: slot.date,
            time: formatTime(slot.time),
            slot_status: 0
          }))
        };

        // Update the schedule with status = "scheduled"
        this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, {
          submission_id: currentSchedule.submission_id,
          recruiter_id: currentSchedule.recruiter_id,
          candidate_name: currentSchedule.candidate_name,
          demand_id: currentSchedule.demand_id,
          candidate_email: currentSchedule.candidate_email,
          candidate_phone: currentSchedule.candidate_phone,
          interview_schedules: JSON.stringify(existingSchedules),
          status: 'scheduled'
        }, { headers }).subscribe({
          next: () => {
            // Reload schedules to refresh the UI
            this.loadInterviewSchedules();
            this.closeInterviewStatusModal();
          },
          error: (error) => {
            console.error('Failed to save next round:', error);
            this.errorMsg.set(`Failed to save next round: ${error.error?.detail || error.message}`);
          }
        });
      },
      error: (error) => {
        console.error('Failed to fetch current schedule:', error);
        this.errorMsg.set('Failed to fetch current schedule');
      }
    });
  }

  saveRescheduleFromConfirmed(): void {
    if (!this.selectedConfirmedInterview) return;

    const slots = this.rescheduleSlots();
    const validSlots = slots.filter(slot => slot.date && slot.time);
    
    if (validSlots.length === 0) {
      this.errorMsg.set('Please fill in at least one date and time slot');
      return;
    }

    // Format time to 12-hour format
    const formatTime = (time24: string): string => {
      if (!time24) return '';
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes || '00'} ${ampm}`;
    };

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch current schedule to get all rounds
    this.http.get<{ items: any[] }>(`${this.apiBase}/interview-schedule/all`, { headers }).subscribe({
      next: (response) => {
        const schedules = response.items || [];
        const currentSchedule = schedules.find(s => s.id === this.selectedConfirmedInterview!.scheduleId);
        
        if (!currentSchedule) {
          this.errorMsg.set('Schedule not found');
          return;
        }

        // Parse existing interview_schedules
        let existingSchedules: any = {};
        if (currentSchedule.interview_schedules) {
          if (typeof currentSchedule.interview_schedules === 'string') {
            try {
              existingSchedules = JSON.parse(currentSchedule.interview_schedules);
            } catch (e) {
              console.error('Failed to parse existing schedules:', e);
              existingSchedules = {};
            }
          } else {
            existingSchedules = currentSchedule.interview_schedules;
          }
        }

        // Update the existing round with new slots
        const roundKey = this.selectedConfirmedInterview!.round;
        existingSchedules[roundKey] = {
          round_status: 0,
          slots: validSlots.map(slot => ({
            date: slot.date,
            time: formatTime(slot.time),
            slot_status: 0
          }))
        };

        // Update the schedule with status = "scheduled"
        this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, {
          submission_id: currentSchedule.submission_id,
          recruiter_id: currentSchedule.recruiter_id,
          candidate_name: currentSchedule.candidate_name,
          demand_id: currentSchedule.demand_id,
          candidate_email: currentSchedule.candidate_email,
          candidate_phone: currentSchedule.candidate_phone,
          interview_schedules: JSON.stringify(existingSchedules),
          status: 'scheduled'
        }, { headers }).subscribe({
          next: () => {
            // Reload schedules to refresh the UI
            this.loadInterviewSchedules();
            this.closeInterviewStatusModal();
          },
          error: (error) => {
            console.error('Failed to save reschedule:', error);
            this.errorMsg.set(`Failed to save reschedule: ${error.error?.detail || error.message}`);
          }
        });
      },
      error: (error) => {
        console.error('Failed to fetch current schedule:', error);
        this.errorMsg.set('Failed to fetch current schedule');
      }
    });
  }

  discardInterview(): void {
    if (!this.selectedConfirmedInterview) return;

    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Fetch current schedule to get all data
    this.http.get<{ items: any[] }>(`${this.apiBase}/interview-schedule/all`, { headers }).subscribe({
      next: (response) => {
        const schedules = response.items || [];
        const currentSchedule = schedules.find(s => s.id === this.selectedConfirmedInterview!.scheduleId);
        
        if (!currentSchedule) {
          this.errorMsg.set('Schedule not found');
          return;
        }

        // Get existing interview_schedules (keep as is, just update status)
        let existingSchedules: any = {};
        if (currentSchedule.interview_schedules) {
          if (typeof currentSchedule.interview_schedules === 'string') {
            try {
              existingSchedules = JSON.parse(currentSchedule.interview_schedules);
            } catch (e) {
              console.error('Failed to parse existing schedules:', e);
              existingSchedules = {};
            }
          } else {
            existingSchedules = currentSchedule.interview_schedules;
          }
        }

        // Update the schedule with status = "discard"
        this.http.post(`${this.apiBase}/interview-schedule/multiple-slots`, {
          submission_id: currentSchedule.submission_id,
          recruiter_id: currentSchedule.recruiter_id,
          candidate_name: currentSchedule.candidate_name,
          demand_id: currentSchedule.demand_id,
          candidate_email: currentSchedule.candidate_email,
          candidate_phone: currentSchedule.candidate_phone,
          interview_schedules: JSON.stringify(existingSchedules),
          status: 'discard'
        }, { headers }).subscribe({
          next: () => {
            // Reload schedules to refresh the UI (discarded interviews will be filtered out)
            this.loadInterviewSchedules();
            this.closeInterviewStatusModal();
          },
          error: (error) => {
            console.error('Failed to discard interview:', error);
            this.errorMsg.set(`Failed to discard interview: ${error.error?.detail || error.message}`);
          }
        });
      },
      error: (error) => {
        console.error('Failed to fetch current schedule:', error);
        this.errorMsg.set('Failed to fetch current schedule');
      }
    });
  }
}

