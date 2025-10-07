import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-teamleader-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="tl-dashboard">
      <div class="tl-sidebar">
        <div class="tl-sidebar-header">
          <div class="tl-sidebar-logo">Team Leader</div>
          <div class="tl-sidebar-subtitle">Operations</div>
        </div>
        <nav class="tl-sidebar-nav">
          <a routerLink="/teamleader/demand-sheet" routerLinkActive="active" class="tl-nav-item">
            <svg class="tl-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8M8 12h8M8 17h8" />
            </svg>
            Demand Sheet
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
        <header class="tl-header"></header>
        <main class="tl-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .tl-dashboard { min-height: 100vh; background:#f7fafc; }
    .tl-sidebar { position: fixed; top:0; left:0; width:260px; height:100vh; background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%); color:#fff; box-shadow: 4px 0 20px rgba(0,0,0,0.1); }
    .tl-sidebar-header { padding:24px; border-bottom:1px solid #4a5568; text-align:center; }
    .tl-sidebar-logo { font-size:22px; font-weight:700; color:#667eea; margin-bottom:6px; }
    .tl-sidebar-subtitle { color:#a0aec0; font-size:13px; }
    .tl-sidebar-nav { padding:16px 0; }
    .tl-nav-item { display:flex; align-items:center; padding:12px 20px; color:#e2e8f0; text-decoration:none; transition:all .2s; }
    .tl-nav-item:hover { background: rgba(102,126,234,.1); color:#667eea; }
    .tl-nav-item.active { background: rgba(102,126,234,.2); color:#667eea; border-right:3px solid #667eea; }
    .tl-nav-icon { width:20px; height:20px; margin-right:12px; }
    .tl-sidebar-footer { padding:16px 20px; border-top:1px solid #4a5568; }
    .tl-logout-button { width:100%; display:flex; align-items:center; gap:10px; padding:10px 14px; background:transparent; color:#e2e8f0; border:1px solid #4a5568; border-radius:8px; cursor:pointer; }
    .tl-logout-button:hover { background: rgba(229, 62, 62, 0.1); color:#e53e3e; border-color:#e53e3e; }
    .tl-main-content { margin-left:0; min-height:100vh; }
    .tl-header { background:#fff; border-bottom:1px solid #e2e8f0; height:56px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .tl-content { padding:24px; }
    @media (min-width: 1024px) { .tl-main-content { margin-left:260px; } }
  `]
})
export class TeamLeaderLayoutComponent implements OnInit {
  private router = inject(Router);
  ngOnInit(): void {}
  logout(): void {
    try { localStorage.removeItem('teamleader_token'); } catch {}
    this.router.navigate(['/teamleader/login']).catch(() => {});
  }
}


