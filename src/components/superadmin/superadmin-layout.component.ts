import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-superadmin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="superadmin-dashboard">
      <div class="superadmin-sidebar">
        <div class="superadmin-sidebar-header">
          <div class="superadmin-sidebar-logo">Super Admin</div>
          <div class="superadmin-sidebar-subtitle">Management Dashboard</div>
        </div>
        <nav class="superadmin-sidebar-nav">
          <a routerLink="/superadmin/dashboard" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
            </svg>
            Dashboard
          </a>
          <a routerLink="/superadmin/client-settings" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6a2 2 0 012-2h8m-6 0V5a2 2 0 10-4 0v4m10 0a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2h2" />
            </svg>
            Client Settings
          </a>
          <a routerLink="/superadmin/demand-sheet" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3zm0-6C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
            </svg>
            Demand Sheet
          </a>
          <a routerLink="/superadmin/pending-approvals" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Pending Approvals
            <span *ngIf="pendingCount > 0" class="superadmin-nav-badge">{{ pendingCount }}</span>
          </a>
        </nav>
        <div class="superadmin-sidebar-footer">
          <button (click)="logout()" class="superadmin-logout-button">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
      <div class="superadmin-main-content">
        <header class="superadmin-header">
          <div class="flex justify-end items-center">
            <div class="relative cursor-pointer superadmin-bell-wrapper">
              <svg class="superadmin-bell-icon text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span *ngIf="pendingCount > 0" class="superadmin-bell-badge">{{ pendingCount }}</span>
            </div>
          </div>
        </header>
        <main class="superadmin-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .superadmin-dashboard { min-height: 100vh; background: #f7fafc; }
    .superadmin-sidebar { position: fixed; top:0; left:0; width:280px; height:100vh; background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%); color:#fff; z-index:1000; box-shadow: 4px 0 20px rgba(0,0,0,0.1); }
    .superadmin-sidebar-header { padding:24px; border-bottom:1px solid #4a5568; text-align:center; }
    .superadmin-sidebar-logo { font-size:24px; font-weight:700; color:#667eea; margin-bottom:8px; }
    .superadmin-sidebar-subtitle { color:#a0aec0; font-size:14px; }
    .superadmin-sidebar-nav { padding:20px 0; }
    .superadmin-nav-item { display:flex; align-items:center; padding:12px 24px; color:#e2e8f0; text-decoration:none; transition:all .2s ease; position:relative; }
    .superadmin-nav-item:hover { background: rgba(102, 126, 234, 0.1); color:#667eea; }
    .superadmin-nav-item.active { background: rgba(102, 126, 234, 0.2); color:#667eea; border-right:3px solid #667eea; }
    .superadmin-nav-icon { width:20px; height:20px; margin-right:12px; flex-shrink:0; }
    .superadmin-nav-badge { margin-left:auto; background:#e53e3e; color:#fff; font-size:12px; font-weight:600; padding:4px 8px; border-radius:12px; min-width:20px; text-align:center; }
    .superadmin-sidebar-footer { padding:20px 24px; border-top:1px solid #4a5568; }
    .superadmin-logout-button { width:100%; display:flex; align-items:center; padding:12px 16px; background:transparent; color:#e2e8f0; border:1px solid #4a5568; border-radius:8px; cursor:pointer; transition:all .2s ease; font-size:14px; }
    .superadmin-logout-button:hover { background: rgba(229, 62, 62, 0.1); color:#e53e3e; border-color:#e53e3e; }
    .superadmin-main-content { margin-left:0; min-height:100vh; background:#f7fafc; }
    .superadmin-header { background:#fff; border-bottom:1px solid #e2e8f0; padding:12px 20px; box-shadow:0 1px 3px rgba(0,0,0,.1); }
    .superadmin-content { padding:32px; }
    /* Notification bell sizing and tap target */
    .superadmin-bell-wrapper { width:40px; height:40px; display:flex; align-items:center; justify-content:center; }
    .superadmin-bell-icon { width:24px; height:24px; }
    .superadmin-bell-badge { position:absolute; top:0; right:0; transform: translate(30%, -30%); background:#e53e3e; color:#fff; font-size:11px; font-weight:700; line-height:1; padding:2px 5px; border-radius:9999px; min-width:16px; text-align:center; box-shadow:0 1px 2px rgba(0,0,0,.2); }
    @media (min-width: 1024px) {
      .superadmin-main-content { margin-left:280px; }
    }
    @media (max-width: 768px) {
      .superadmin-bell-wrapper { width:36px; height:36px; }
      .superadmin-bell-icon { width:20px; height:20px; }
    }
  `]
})
export class SuperAdminLayoutComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  pendingCount = 0;
  private superAdminBase = environment.superAdminBase || (environment.apiBase ? `${environment.apiBase}/superadmin` : '/superadmin');

  ngOnInit(): void {
    this.loadPendingCount();
  }

  loadPendingCount(): void {
    this.http.get<{ count: number }>(`${this.superAdminBase}/pending-approvals/count`).subscribe({
      next: (res) => this.pendingCount = res?.count ?? 0,
      error: () => this.pendingCount = 0
    });
  }

  logout(): void {
    try { localStorage.removeItem('superadmin_token'); } catch {}
    this.router.navigate(['/superadmin/login']).catch(() => {});
  }
}


