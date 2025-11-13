import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-clustermanager-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="tl-dashboard">
      <div class="tl-sidebar">
        <div class="tl-sidebar-header">
          <div class="tl-sidebar-logo">Cluster Manager</div>
          <div class="tl-sidebar-subtitle">Operations</div>
        </div>
        <nav class="tl-sidebar-nav">
          <a routerLink="/clustermanager/dashboard" routerLinkActive="active" class="tl-nav-item">
            <svg class="tl-nav-icon" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </a>
        </nav>
        <div class="tl-sidebar-footer">
          <button (click)="logout()" class="tl-logout-button">
            <svg class="tl-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
      <div class="tl-main-content">
        <header class="tl-header">
          <div class="tl-header-content">
            <div class="tl-user-info">
              <div class="user-initials">CM</div>
            </div>
          </div>
        </header>
        <main class="tl-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .tl-dashboard { min-height: 100vh; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); font-family: "Manrope", "Manrope Placeholder", sans-serif; }
    .tl-sidebar { position: fixed; top:0; left:0; width:280px; height:100vh; background: linear-gradient(180deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%); color:#fff; z-index:1001; box-shadow:4px 0 20px rgba(24,45,23,0.15); backdrop-filter: blur(10px); }
    .tl-sidebar-header { padding:24px; border-bottom:1px solid rgba(255,255,255,0.1); text-align:center; }
    .tl-sidebar-logo { font-size:24px; font-weight:700; color:#fff; margin-bottom:8px; }
    .tl-sidebar-subtitle { color:rgba(255,255,255,0.8); font-size:14px; }
    .tl-sidebar-nav { padding:20px 0; }
    .tl-nav-item { display:flex; align-items:center; padding:12px 24px; color:#ffffff !important; text-decoration:none; transition:all 0.2s ease; position: relative; }
    .tl-nav-item:hover { background: rgba(255,255,255,0.1); color:#ffffff !important; }
    .tl-nav-item.active { background: rgba(255,255,255,0.15); color:#ffffff !important; border-right:3px solid #ffffff; }
    .tl-nav-icon { width:20px; height:20px; margin-right:12px; flex-shrink:0; color:#ffffff !important; stroke:#ffffff !important; }
    .tl-sidebar-footer { padding:20px 24px; border-top:1px solid rgba(255,255,255,0.1); }
    .tl-logout-button { width:100%; display:flex; align-items:center; padding:12px 16px; background:transparent; color:rgba(255,255,255,0.9); border:1px solid rgba(255,255,255,0.2); border-radius:8px; cursor:pointer; transition:all 0.2s ease; font-size:14px; }
    .tl-main-content { margin-left:280px; min-height:100vh; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding-top:80px; }
    .tl-header { position:fixed; top:0; left:280px; right:0; z-index:1000; height:80px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-bottom: 1px solid rgba(24,45,23,0.1); box-shadow:0 4px 6px rgba(24,45,23,0.1); display:flex; align-items:center; }
    .tl-header-content { display:flex; align-items:center; justify-content:flex-end; padding:0 32px; width:100%; height:100%; }
    .tl-content { padding:32px; }
    .tl-user-info .user-initials { width:32px; height:32px; border-radius:50%; background: var(--kudzu-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; }
  `]
})
export class ClusterManagerLayoutComponent implements OnInit {
  private router = inject(Router);
  ngOnInit(): void {}
  logout(): void { try { localStorage.clear(); } catch {} this.router.navigate(['/signin']).catch(() => {}); }
}





