import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../services/toast.service';
import { environment } from '../environments/environment';

interface ClientDto {
  id: number;
  client_name: string;
  industry?: string;
  location?: string;
  email?: string;
  contact_person?: string;
  status?: string;
}

interface SpocDto {
  id: number;
  client_id: number;
  spoc_name: string;
  designation?: string;
  email?: string;
  phone_number?: string;
  spoc_reporting_manager?: string;
}

@Component({
  selector: 'app-client-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="demand-sheet-page" style="min-height:100vh;background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);padding:24px 16px;font-family:'Manrope', 'Manrope Placeholder', sans-serif;">
      <div style="width:100%;max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:16px;">
        
        <!-- Header with Create Buttons -->
        <div class="demand-card" style="background:rgba(255, 255, 255, 0.8);backdrop-filter:blur(10px);border:1px solid rgba(24, 45, 23, 0.1);border-radius:12px;box-shadow:0 4px 10px rgba(24, 45, 23, 0.1);padding:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;font-size:24px;font-weight:700;color:var(--kudzu-primary);">
              {{ isClientView() ? 'Client Management' : 'SPOC Management' }}
            </h2>
            <div style="display:flex;gap:12px;">
              <button *ngIf="isClientView()" (click)="showCreateClientForm = true" 
                      style="background:var(--kudzu-primary);color:white;border:none;padding:10px 16px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;gap:8px;">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Create Client
              </button>
              <button *ngIf="isSpocView()" (click)="showCreateSpocForm = true" 
                      style="background:var(--kudzu-primary);color:white;border:none;padding:10px 16px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;transition:all 0.2s ease;display:flex;align-items:center;gap:8px;">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Create SPOC
              </button>
            </div>
          </div>

          <!-- Clients Table -->
          <div *ngIf="isClientView()">
            <div *ngIf="clientsLoading()" style="text-align:center;padding:40px;">
              <div style="color:#6b7280;font-size:16px;">Loading clients...</div>
            </div>
            <div *ngIf="clientsError()" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:12px;border-radius:8px;margin-bottom:16px;">
              {{ clientsError() }}
            </div>
            <div *ngIf="!clientsLoading() && !clientsError()" class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Client Name</th>
                    <th>Industry</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let client of clients()" class="table-row">
                    <td>{{ client.id }}</td>
                    <td>{{ client.client_name }}</td>
                    <td>{{ client.industry || '-' }}</td>
                    <td>{{ client.location || '-' }}</td>
                    <td>
                      <span [style.background]="client.status === 'active' ? '#10b981' : '#6b7280'" 
                            [style.color]="'white'" 
                            [style.padding]="'4px 8px'" 
                            [style.border-radius]="'6px'" 
                            [style.font-size]="'12px'">
                        {{ client.status || 'inactive' }}
                      </span>
                    </td>
                    <td>
                      <button (click)="editClient(client)" style="background:#3b82f6;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;margin-right:8px;">
                        Edit
                      </button>
                      <button (click)="deleteClient(client.id)" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="clients().length === 0" style="text-align:center;padding:40px;color:#6b7280;">
                No clients found. Create your first client using the button above.
              </div>
            </div>
          </div>

          <!-- SPOCs Table -->
          <div *ngIf="isSpocView()">
            <div *ngIf="spocsLoading()" style="text-align:center;padding:40px;">
              <div style="color:#6b7280;font-size:16px;">Loading SPOCs...</div>
            </div>
            <div *ngIf="spocsError()" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:12px;border-radius:8px;margin-bottom:16px;">
              {{ spocsError() }}
            </div>
            <div *ngIf="!spocsLoading() && !spocsError()" class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>SPOC Name</th>
                    <th>Client</th>
                    <th>Designation</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Reporting Manager</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let spoc of spocs()" class="table-row">
                    <td>{{ spoc.id }}</td>
                    <td>{{ spoc.spoc_name }}</td>
                    <td>{{ getClientName(spoc.client_id) }}</td>
                    <td>{{ spoc.designation || '-' }}</td>
                    <td>{{ spoc.email || '-' }}</td>
                    <td>{{ spoc.phone_number || '-' }}</td>
                    <td>{{ spoc.spoc_reporting_manager || '-' }}</td>
                    <td>
                      <button (click)="editSpoc(spoc)" style="background:#3b82f6;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;margin-right:8px;">
                        Edit
                      </button>
                      <button (click)="deleteSpoc(spoc.id)" style="background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;">
                        Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="spocs().length === 0" style="text-align:center;padding:40px;color:#6b7280;">
                No SPOCs found. Create your first SPOC using the button above.
              </div>
            </div>
          </div>
        </div>

        <!-- Create/Edit Client Form Modal -->
        <div *ngIf="showCreateClientForm" class="modal-overlay" (click)="closeCreateClientForm()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title">{{ editingClient ? 'Edit Client' : 'Create Client' }}</div>
              <button class="modal-close" (click)="closeCreateClientForm()">✕</button>
            </div>
            <div class="modal-body">
              <form [formGroup]="clientForm" (ngSubmit)="submitClient()" novalidate>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;">
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Client name</label>
                    <input type="text" formControlName="clientname" placeholder="Acme Corp"
                           [class.error]="clientSubmitted && clientForm.controls['clientname'].invalid"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                    <div *ngIf="clientSubmitted && clientForm.controls['clientname'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Client name is required</div>
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Location</label>
                    <input type="text" formControlName="location" placeholder="Bengaluru"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Industry</label>
                    <input type="text" formControlName="industry" placeholder="IT Services"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Status</label>
                    <select formControlName="status"
                            [disabled]="!!editingClient"
                            [class.error]="clientSubmitted && clientForm.controls['status'].invalid"
                            [style.background]="editingClient ? '#f9fafb' : '#fff'"
                            [style.color]="editingClient ? '#6b7280' : '#111827'"
                            style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;transition:all 0.2s ease;">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <div *ngIf="clientSubmitted && clientForm.controls['status'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Status is required</div>
                    <div *ngIf="editingClient" style="color:#6b7280;font-size:12px;margin-top:6px;">Status is computed based on SPOCs</div>
                  </div>
                </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
                  <button type="button" (click)="closeCreateClientForm()" style="background:#fff;border:1px solid #e5e7eb;color:#111827;padding:10px 14px;border-radius:8px;">Cancel</button>
              <button type="submit" class="login-button" [disabled]="clientLoading || clientForm.invalid" 
                          style="background:var(--kudzu-primary);color:white;border:none;padding:10px 14px;font-size:14px;font-weight:600;border-radius:8px;width:85px;display:inline-block;text-align:center;cursor:pointer;transition:all 0.2s ease;">
                <span *ngIf="!clientLoading">Submit</span>
                <span *ngIf="clientLoading">Submitting…</span>
              </button>
            </div>
            <div *ngIf="clientError" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ clientError }}</div>
            <div *ngIf="clientSuccess" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ clientSuccess }}</div>
          </form>
            </div>
          </div>
        </div>

        <!-- Create/Edit SPOC Form Modal -->
        <div *ngIf="showCreateSpocForm" class="modal-overlay" (click)="closeCreateSpocForm()">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title">{{ editingSpoc ? 'Edit SPOC' : 'Create SPOC' }}</div>
              <button class="modal-close" (click)="closeCreateSpocForm()">✕</button>
            </div>
            <div class="modal-body">
              <form [formGroup]="spocForm" (ngSubmit)="submitSpoc()" novalidate>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;">
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Name</label>
                    <input type="text" formControlName="name" placeholder="Jane Doe"
                           [class.error]="spocSubmitted && spocForm.controls['name'].invalid"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                    <div *ngIf="spocSubmitted && spocForm.controls['name'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Name is required</div>
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Client</label>
                    <select formControlName="client_id" [disabled]="clientsLoading()"
                            [class.error]="spocSubmitted && spocForm.controls['client_id'].invalid"
                            style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;">
                      <option value="" disabled selected>Select client</option>
                      <option *ngFor="let c of clients()" [value]="c.id">{{ c.client_name }}</option>
                    </select>
                    <div *ngIf="spocSubmitted && spocForm.controls['client_id'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Client is required</div>
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Email</label>
                    <input type="email" formControlName="email_id" placeholder="jane@example.com"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Designation</label>
                    <input type="text" formControlName="designation" placeholder="Manager"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Phone number</label>
                    <input type="tel" formControlName="phone_number" placeholder="+91 98765 43210"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                  </div>
                  <div>
                    <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Reporting Manager</label>
                    <input type="text" formControlName="spoc_reporting_manager" placeholder="John Smith"
                           style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;transition:all 0.2s ease;" />
                  </div>
                </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
                  <button type="button" (click)="closeCreateSpocForm()" style="background:#fff;border:1px solid #e5e7eb;color:#111827;padding:10px 14px;border-radius:8px;">Cancel</button>
              <button type="submit" class="login-button" [disabled]="spocLoading || spocForm.invalid"
                          style="background:var(--kudzu-primary);color:white;border:none;padding:10px 14px;width:85px;font-size:14px;font-weight:600;border-radius:8px;display:inline-block;text-align:center;cursor:pointer;transition:all 0.2s ease;">
                <span *ngIf="!spocLoading">Submit</span>
                <span *ngIf="spocLoading">Submitting…</span>
              </button>
            </div>
            <div *ngIf="spocError" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ spocError }}</div>
            <div *ngIf="spocSuccess" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ spocSuccess }}</div>
          </form>
        </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    .data-table th {
      background: #f8fafc;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }

    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
      color: #374151;
    }

    .table-row:hover {
      background: #f9fafb;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
    }

    .modal-close:hover {
      color: #374151;
    }

    .modal-body {
      padding: 24px;
    }

    .error {
      border-color: #ef4444 !important;
    }
  `]
})
export class ClientSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private toastService = inject(ToastService);

  apiBase = `${environment.apiBase}/clientsettings`;

  // Clients state
  clients = signal<ClientDto[]>([]);
  clientsLoading = signal(false);
  clientsError = signal('');

  // SPOCs state
  spocs = signal<SpocDto[]>([]);
  spocsLoading = signal(false);
  spocsError = signal('');

  // Modal states
  showCreateClientForm = false;
  showCreateSpocForm = false;
  editingClient: ClientDto | null = null;
  editingSpoc: SpocDto | null = null;

  // Client form state
  clientLoading = false;
  clientSubmitted = false;
  clientError = '';
  clientSuccess = '';

  clientForm: FormGroup = this.fb.group({
    clientname: ['', [Validators.required]],
    location: [''],
    industry: [''],
    status: ['inactive', [Validators.required]]
  });

  // SPOC form state
  spocLoading = false;
  spocSubmitted = false;
  spocError = '';
  spocSuccess = '';

  spocForm: FormGroup = this.fb.group({
    name: ['', [Validators.required]],
    client_id: ['', [Validators.required]],
    email_id: [''],
    designation: [''],
    phone_number: [''],
    spoc_reporting_manager: ['']
  });

  ngOnInit(): void {
    this.refreshClients();
    this.refreshSpocs();
  }

  isClientView(): boolean {
    const url = this.router.url || '';
    return url.includes('/superadmin/client-settings/client');
  }

  isSpocView(): boolean {
    const url = this.router.url || '';
    return url.includes('/superadmin/client-settings/spoc');
  }

  private authHeaders(): { [key: string]: string } {
    const token = localStorage.getItem('access_token') || '';
    const tokenType = localStorage.getItem('token_type') || 'bearer';
    return token ? { Authorization: `${tokenType} ${token}` } : {};
  }

  refreshClients(): void {
    this.clientsLoading.set(true);
    this.clientsError.set('');
    this.http.get<ClientDto[]>(`${this.apiBase}/clients`, { headers: this.authHeaders() }).subscribe({
      next: (rows) => { 
        this.clients.set(rows || []); 
        this.clientsLoading.set(false); 
      },
      error: (e: HttpErrorResponse) => { 
        this.clients.set([]); 
        this.clientsLoading.set(false);
        this.clientsError.set(e.error?.detail || 'Failed to load clients');
      }
    });
  }

  refreshSpocs(): void {
    this.spocsLoading.set(true);
    this.spocsError.set('');
    this.http.get<SpocDto[]>(`${this.apiBase}/spocs`, { headers: this.authHeaders() }).subscribe({
      next: (rows) => { 
        this.spocs.set(rows || []); 
        this.spocsLoading.set(false); 
      },
      error: (e: HttpErrorResponse) => { 
        this.spocs.set([]); 
        this.spocsLoading.set(false);
        this.spocsError.set(e.error?.detail || 'Failed to load SPOCs');
      }
    });
  }

  getClientName(clientId: number): string {
    const client = this.clients().find(c => c.id === clientId);
    return client ? client.client_name : `Client #${clientId}`;
  }

  // Modal methods
  closeCreateClientForm(): void {
    this.showCreateClientForm = false;
    this.editingClient = null;
    this.resetClient();
  }

  closeCreateSpocForm(): void {
    this.showCreateSpocForm = false;
    this.editingSpoc = null;
    this.resetSpoc();
  }

  // Client methods
  editClient(client: ClientDto): void {
    this.editingClient = client;
    this.clientForm.patchValue({
      clientname: client.client_name,
      location: client.location || '',
      industry: client.industry || '',
      status: client.status || 'inactive'
    });
    this.showCreateClientForm = true;
  }

  deleteClient(clientId: number): void {
    if (confirm('Are you sure you want to delete this client?')) {
      this.http.delete(`${this.apiBase}/clients/${clientId}`, { headers: this.authHeaders() }).subscribe({
        next: () => {
          this.toastService.success('Client deleted successfully');
          this.refreshClients();
        },
        error: (e: HttpErrorResponse) => {
          this.toastService.error(e.error?.detail || 'Failed to delete client');
        }
      });
    }
  }

  resetClient(): void {
    this.clientForm.reset({ clientname: '', location: '', industry: '', status: 'inactive' });
    this.clientSubmitted = false; 
    this.clientError = ''; 
    this.clientSuccess = '';
  }

  submitClient(): void {
    this.clientSubmitted = true;
    if (this.clientForm.invalid || this.clientLoading) return;
    this.clientLoading = true; 
    this.clientError = ''; 
    this.clientSuccess = '';
    const payload = this.clientForm.value;
    
    if (this.editingClient) {
      // Update existing client
      this.http.put<ClientDto>(`${this.apiBase}/clients/${this.editingClient.id}`, payload, { headers: this.authHeaders() }).subscribe({
        next: (c) => {
          this.clientLoading = false; 
          this.clientSuccess = 'Client updated';
          this.toastService.success('Client updated successfully!');
          this.closeCreateClientForm();
          this.refreshClients();
        },
        error: (e: HttpErrorResponse) => {
          this.clientLoading = false; 
          this.clientError = e.error?.detail || 'Failed to update client';
          this.toastService.error('Failed to update client. Please try again.');
        }
      });
    } else {
      // Create new client
    this.http.post<ClientDto>(`${this.apiBase}/clients`, payload, { headers: this.authHeaders() }).subscribe({
      next: (c) => {
        this.clientLoading = false; 
        this.clientSuccess = 'Client created';
          this.toastService.success('Client created successfully!');
          this.closeCreateClientForm();
        this.refreshClients();
      },
      error: (e: HttpErrorResponse) => {
        this.clientLoading = false; 
        this.clientError = e.error?.detail || 'Failed to create client';
          this.toastService.error('Failed to create client. Please try again.');
        }
      });
    }
  }

  // SPOC methods
  editSpoc(spoc: SpocDto): void {
    this.editingSpoc = spoc;
    this.spocForm.patchValue({
      name: spoc.spoc_name,
      client_id: spoc.client_id,
      email_id: spoc.email || '',
      designation: spoc.designation || '',
      phone_number: spoc.phone_number || '',
      spoc_reporting_manager: spoc.spoc_reporting_manager || ''
    });
    this.showCreateSpocForm = true;
  }

  deleteSpoc(spocId: number): void {
    if (confirm('Are you sure you want to delete this SPOC?')) {
      this.http.delete(`${this.apiBase}/spocs/${spocId}`, { headers: this.authHeaders() }).subscribe({
        next: () => {
          this.toastService.success('SPOC deleted successfully');
          this.refreshSpocs();
        },
        error: (e: HttpErrorResponse) => {
          this.toastService.error(e.error?.detail || 'Failed to delete SPOC');
        }
      });
    }
  }

  resetSpoc(): void {
    this.spocForm.reset({ 
      name: '', 
      client_id: '', 
      email_id: '', 
      designation: '', 
      phone_number: '',
      spoc_reporting_manager: ''
    });
    this.spocSubmitted = false; 
    this.spocError = ''; 
    this.spocSuccess = '';
  }

  submitSpoc(): void {
    this.spocSubmitted = true;
    if (this.spocForm.invalid || this.spocLoading) return;
    this.spocLoading = true; 
    this.spocError = ''; 
    this.spocSuccess = '';
    const payload = this.spocForm.value;
    
    if (this.editingSpoc) {
      // Update existing SPOC
      this.http.put<SpocDto>(`${this.apiBase}/spocs/${this.editingSpoc.id}`, payload, { headers: this.authHeaders() }).subscribe({
        next: (s) => {
          this.spocLoading = false; 
          this.spocSuccess = 'SPOC updated';
          this.toastService.success('SPOC updated successfully!');
          this.closeCreateSpocForm();
          this.refreshSpocs();
        },
        error: (e: HttpErrorResponse) => {
          this.spocLoading = false; 
          this.spocError = e.error?.detail || 'Failed to update SPOC';
          this.toastService.error('Failed to update SPOC. Please try again.');
        }
      });
    } else {
      // Create new SPOC
      this.http.post<SpocDto>(`${this.apiBase}/spocs`, payload, { headers: this.authHeaders() }).subscribe({
        next: (s) => {
          this.spocLoading = false; 
          this.spocSuccess = 'SPOC created';
          this.toastService.success('SPOC created successfully!');
          this.closeCreateSpocForm();
          this.refreshSpocs();
        },
        error: (e: HttpErrorResponse) => {
          this.spocLoading = false; 
          this.spocError = e.error?.detail || 'Failed to create SPOC';
          this.toastService.error('Failed to create SPOC. Please try again.');
        }
      });
    }
  }
}