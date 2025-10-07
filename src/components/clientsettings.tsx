import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

interface ClientDto {
  id: number;
  client_name: string;
  industry?: string;
  location?: string;
  is_active: boolean;
}

interface SpocDto {
  id: number;
  client_id: number;
  spoc_name: string;
  designation?: string;
  email?: string;
  phone_number?: string;
}

@Component({
  selector: 'app-client-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="demand-sheet-page" style="min-height:100vh;background:#f7fafc;padding:24px 16px;">
      <div style="width:100%;max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:16px;">
        
        <div style="width:100%;display:grid;grid-template-columns:1fr;gap:20px;">
        <!-- Client Form Card -->
        <div *ngIf="isClientView()" class="demand-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.05);padding:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">Create Client</h2>
          <form [formGroup]="clientForm" (ngSubmit)="submitClient()" novalidate>
            <div style="display:grid;grid-template-columns:1fr;gap:12px;">
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Client name</label>
                <input type="text" formControlName="clientname" placeholder="Acme Corp"
                       [class.error]="clientSubmitted && clientForm.controls['clientname'].invalid"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
                <div *ngIf="clientSubmitted && clientForm.controls['clientname'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Client name is required</div>
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Location</label>
                <input type="text" formControlName="location" placeholder="Bengaluru"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Industry</label>
                <input type="text" formControlName="industry" placeholder="IT Services"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Status</label>
                <select formControlName="status" style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;">
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
              <button type="button" (click)="resetClient()" style="background:#fff;border:1px solid #e5e7eb;color:#111827;padding:10px 14px;border-radius:8px;">Cancel</button>
              <button type="submit" class="login-button" [disabled]="clientLoading || clientForm.invalid" 
                      style="padding:6px 10px;font-size:12px;line-height:16px;border-radius:6px;width:120px;display:inline-block;text-align:center;">
                <span *ngIf="!clientLoading">Submit</span>
                <span *ngIf="clientLoading">Submitting…</span>
              </button>
            </div>
            <div *ngIf="clientError" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ clientError }}</div>
            <div *ngIf="clientSuccess" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ clientSuccess }}</div>
          </form>
        </div>

        <!-- SPOC Form Card -->
        <div *ngIf="isSpocView()" class="demand-card" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.05);padding:20px;">
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">Create SPOC</h2>
          <form [formGroup]="spocForm" (ngSubmit)="submitSpoc()" novalidate>
            <div style="display:grid;grid-template-columns:1fr;gap:12px;">
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Name</label>
                <input type="text" formControlName="name" placeholder="Jane Doe"
                       [class.error]="spocSubmitted && spocForm.controls['name'].invalid"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
                <div *ngIf="spocSubmitted && spocForm.controls['name'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Name is required</div>
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Client</label>
                <select formControlName="client_id" [disabled]="clientsLoading"
                        [class.error]="spocSubmitted && spocForm.controls['client_id'].invalid"
                        style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;">
                  <option value="" disabled selected>Select client</option>
                  <option *ngFor="let c of clients()" [value]="c.id">{{ c.client_name }} ({{ c.is_active ? 'Active' : 'Inactive' }})</option>
                </select>
                <div *ngIf="spocSubmitted && spocForm.controls['client_id'].invalid" style="color:#b91c1c;font-size:12px;margin-top:6px;">Client is required</div>
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Email</label>
                <input type="email" formControlName="email_id" placeholder="jane@example.com"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Designation</label>
                <input type="text" formControlName="designation" placeholder="Manager"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Phone number</label>
                <input type="tel" formControlName="phone_number" placeholder="+91 98765 43210"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
              </div>
              <div>
                <label style="display:block;margin-bottom:6px;font-weight:600;color:#111827;font-size:13px;">Reporting manager (optional)</label>
                <input type="text" formControlName="spoc_reporting_manager" placeholder="John Smith"
                       style="width:100%;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:14px;" />
              </div>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;">
              <button type="button" (click)="resetSpoc()" style="background:#fff;border:1px solid #e5e7eb;color:#111827;padding:10px 14px;border-radius:8px;">Cancel</button>
              <button type="submit" class="login-button" [disabled]="spocLoading || spocForm.invalid"
                      style="padding:6px 10px;font-size:12px;line-height:10px;border-radius:6px;width:120px;display:inline-block;text-align:center;">
                <span *ngIf="!spocLoading">Submit</span>
                <span *ngIf="spocLoading">Submitting…</span>
              </button>
            </div>
            <div *ngIf="spocError" style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ spocError }}</div>
            <div *ngIf="spocSuccess" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:10px 12px;border-radius:8px;margin-top:10px;font-size:14px;">{{ spocSuccess }}</div>
          </form>
        </div>

        <!-- Right column: simple lists -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.05);padding:16px;">
          <h3 style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827;">Existing Clients</h3>
          <div *ngIf="clientsLoading" style="color:#6b7280;font-size:14px;">Loading…</div>
          <ul *ngIf="!clientsLoading && clients().length" style="margin:0;padding-left:18px;">
            <li *ngFor="let c of clients()" style="margin-bottom:6px;color:#374151;">
              {{ c.client_name }} • {{ c.industry || '—' }} • {{ c.location || '—' }} • {{ c.is_active ? 'Active' : 'Inactive' }}
            </li>
          </ul>
          <div *ngIf="!clientsLoading && !clients().length" style="color:#6b7280;font-size:14px;">No clients yet</div>
        </div>
        
      </div>
    </div>
  `
})
export class ClientSettingsComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  apiBase = 'http://localhost:8000/clientsettings';

  // Clients state
  clients = signal<ClientDto[]>([]);
  clientsLoading = false;

  clientLoading = false;
  clientSubmitted = false;
  clientError = '';
  clientSuccess = '';

  clientForm = this.fb.group({
    clientname: ['', [Validators.required]],
    location: [''],
    industry: [''],
    status: ['inactive']
  });

  // SPOC state
  spocLoading = false;
  spocSubmitted = false;
  spocError = '';
  spocSuccess = '';

  spocForm = this.fb.group({
    name: ['', [Validators.required]],
    client_id: ['', [Validators.required]],
    email_id: [''],
    designation: [''],
    phone_number: [''],
    spoc_reporting_manager: ['']
  });

  constructor() {
    this.refreshClients();
  }

  isClientView() {
    const url = this.router.url || '';
    return url.includes('/superadmin/client-settings/client');
  }

  isSpocView() {
    const url = this.router.url || '';
    return url.includes('/superadmin/client-settings/spoc');
  }

  private authHeaders() {
    const token = localStorage.getItem('superadmin_token') || localStorage.getItem('access_token') || '';
    return token ? { Authorization: `Bearer ${token}` } : {} as any;
  }

  refreshClients() {
    this.clientsLoading = true;
    this.http.get<ClientDto[]>(`${this.apiBase}/clients`, { headers: this.authHeaders() }).subscribe({
      next: (rows) => { this.clients.set(rows || []); this.clientsLoading = false; },
      error: () => { this.clients.set([]); this.clientsLoading = false; }
    });
  }

  resetClient() {
    this.clientForm.reset({ clientname: '', location: '', industry: '', status: 'inactive' });
    this.clientSubmitted = false; this.clientError = ''; this.clientSuccess = '';
  }

  submitClient() {
    this.clientSubmitted = true;
    if (this.clientForm.invalid || this.clientLoading) return;
    this.clientLoading = true; this.clientError = ''; this.clientSuccess = '';
    const payload = this.clientForm.value;
    this.http.post<ClientDto>(`${this.apiBase}/clients`, payload, { headers: this.authHeaders() }).subscribe({
      next: (c) => {
        this.clientLoading = false; this.clientSuccess = 'Client created';
        this.resetClient(); this.refreshClients();
      },
      error: (e: HttpErrorResponse) => {
        this.clientLoading = false; this.clientError = e.error?.detail || 'Failed to create client';
      }
    });
  }

  resetSpoc() {
    this.spocForm.reset({ name: '', client_id: '', email_id: '', designation: '', phone_number: '', spoc_reporting_manager: '' });
    this.spocSubmitted = false; this.spocError = ''; this.spocSuccess = '';
  }

  submitSpoc() {
    this.spocSubmitted = true;
    if (this.spocForm.invalid || this.spocLoading) return;
    this.spocLoading = true; this.spocError = ''; this.spocSuccess = '';
    const payload = this.spocForm.value;
    this.http.post<SpocDto>(`${this.apiBase}/spocs`, payload, { headers: this.authHeaders() }).subscribe({
      next: (s) => {
        this.spocLoading = false; this.spocSuccess = 'SPOC created';
        this.resetSpoc();
      },
      error: (e: HttpErrorResponse) => {
        this.spocLoading = false; this.spocError = e.error?.detail || 'Failed to create SPOC';
      }
    });
  }
}


