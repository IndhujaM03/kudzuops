import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  selectedTeamLeaderId: number | '' = '';
  selectedRecruiterIds: Set<number> = new Set<number>();

  // Tabs state
  activeTab: 'unassigned' | 'assigned' | 'submitted' = 'unassigned';
  unassigned = signal<any[]>([]);
  assigned = signal<any[]>([]);
  submitted = signal<any[]>([]);
  assignedSearch: number | null = null;
  assignInput: Record<number, number> = {};

  ngOnInit(): void {
    this.fetchClients();
    this.loadUnassigned();
    this.fetchTeamLeads();
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
      priority: 'Medium',
      job_description_url: '',
      remarks: '',
      status: 'Open',
      assigned_to: '',
    });
    this.spocs.set([]);
  }

  isValid(): boolean {
    const f = this.form();
    return Boolean(f.client_id) && Boolean(f.spoc_id);
  }

  submit(): void {
    if (!this.isValid()) {
      this.errorMsg.set('Please fill required fields: Client and SPOC');
      return;
    }
    this.errorMsg.set(null);
    this.successMsg.set(null);
    this.submitting.set(true);

    const payload: any = {
      client_id: Number(this.form().client_id),
      spoc_id: Number(this.form().spoc_id),
      skills: this.form().skills?.trim() || null,
      no_of_positions: this.form().no_of_positions ? Number(this.form().no_of_positions) : null,
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
          this.submitting.set(false);
          this.showForm = false; // auto-close form
          this.resetForm();
          // If Assigned To provided, assign recruiter
          const recruiterId = Number(this.form().assigned_to || 0);
          if (newId && recruiterId) {
            this.assignRecruiter(newId, recruiterId, true);
          } else {
            this.loadUnassigned();
          }
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail || 'Failed to create demand');
          this.submitting.set(false);
        }
      });
  }

  setTab(tab: 'unassigned' | 'assigned' | 'submitted') {
    this.activeTab = tab;
    if (tab === 'unassigned') this.loadUnassigned();
    if (tab === 'assigned') this.loadAssigned();
    if (tab === 'submitted') this.loadSubmitted();
  }

  loadUnassigned(): void {
    this.http.get<any[]>(`${this.apiBase}/demand/unassigned`).subscribe({
      next: (rows) => this.unassigned.set(rows || []),
      error: () => this.unassigned.set([]),
    });
  }

  loadAssigned(): void {
    const params = this.assignedSearch ? `?recruiter_id=${this.assignedSearch}` : '';
    this.http.get<any[]>(`${this.apiBase}/demand/assigned${params}`).subscribe({
      next: (rows) => this.assigned.set(rows || []),
      error: () => this.assigned.set([]),
    });
  }

  loadSubmitted(): void {
    this.http.get<any[]>(`${this.apiBase}/demand/submitted`).subscribe({
      next: (rows) => this.submitted.set(rows || []),
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
    this.assignTarget = row;
    this.showAssign = true;
    this.selectedTeamLeaderId = '';
    this.selectedRecruiterIds.clear();
    this.recruiters = [];
  }
  closeAssignModal(): void { this.showAssign = false; this.assignTarget = null; }

  // TL/Recruiter filters
  fetchTeamLeads(): void {
    this.http.get<any[]>(`${this.apiBase}/teamleaders`).subscribe({
      next: (rows) => this.teamLeaders = rows || [],
      error: () => this.teamLeaders = [],
    });
  }

  onTeamLeaderChange(): void {
    const tlId = Number(this.selectedTeamLeaderId || 0);
    this.selectedRecruiterIds.clear();
    if (!tlId) { this.recruiters = []; return; }
    this.http.get<any[]>(`${this.apiBase}/teamleaders/${tlId}/recruiters`).subscribe({
      next: (rows) => this.recruiters = rows || [],
      error: () => this.recruiters = [],
    });
  }

  toggleRecruiter(recruiterId: number, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) this.selectedRecruiterIds.add(recruiterId);
    else this.selectedRecruiterIds.delete(recruiterId);
  }

  assignSelected(): void {
    if (!this.assignTarget || this.selectedRecruiterIds.size === 0) { this.errorMsg.set('Select at least one recruiter'); return; }
    const demandId = this.assignTarget.id;
    const ids = Array.from(this.selectedRecruiterIds);
    // Backend expects jsonb[] assigned_to; send array of recruiter JSON or IDs as backend expects
    // Here, we send { demand_id, recruiters: ids } to a bulk-assign endpoint if available; fallback loop
    this.http.post<{ message: string }>(`${this.apiBase}/demand/assign/bulk`, { demand_id: demandId, recruiters: ids }).subscribe({
      next: () => {
        this.successMsg.set('Assigned successfully');
        this.closeAssignModal();
        this.loadUnassigned();
        this.loadAssigned();
      },
      error: () => {
        // Fallback: assign one-by-one
        let completed = 0;
        ids.forEach((rid) => {
          this.http.post(`${this.apiBase}/demand/assign`, { demand_id: demandId, recruiter_id: rid }).subscribe({
            next: () => { completed++; if (completed === ids.length) { this.successMsg.set('Assigned successfully'); this.closeAssignModal(); this.loadUnassigned(); this.loadAssigned(); } },
            error: () => { completed++; if (completed === ids.length) { this.closeAssignModal(); this.loadUnassigned(); this.loadAssigned(); } }
          });
        });
      }
    });
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
}


