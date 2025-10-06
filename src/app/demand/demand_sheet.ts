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
  });

  apiBase = environment.apiBase || '';

  ngOnInit(): void {
    this.fetchClients();
  }

  fetchClients(): void {
    this.loading.set(true);
    this.http.get<Client[]>(`${this.apiBase}/clients`).subscribe({
      next: (data) => {
        this.clients.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
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
          this.successMsg.set(res?.message || 'Demand Sheet Created Successfully');
          this.resetForm();
          this.submitting.set(false);
        },
        error: (err) => {
          this.errorMsg.set(err?.error?.detail || 'Failed to create demand');
          this.submitting.set(false);
        }
      });
  }
}


