import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-manager-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="tl-dashboard">
      <div class="tl-sidebar">
        <div class="tl-sidebar-header">
          <div class="tl-sidebar-logo">Manager</div>
          <div class="tl-sidebar-subtitle">Operations</div>
        </div>
        <nav class="tl-sidebar-nav">
          <a routerLink="/manager/dashboard" routerLinkActive="active" class="tl-nav-item">
            <svg class="tl-nav-icon" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </a>
          <a routerLink="/manager/demand-sheet" routerLinkActive="active" class="tl-nav-item">
            <svg class="tl-nav-icon" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h8M8 12h8M8 17h8" />
            </svg>
            <span>Demand Sheet</span>
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
              <div class="user-initials">{{ getUserInitials() }}</div>
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
    .tl-dashboard { 
      min-height: 100vh; 
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }
    .tl-sidebar { 
      position: fixed; 
      top: 0; 
      left: 0; 
      width: 280px; 
      height: 100vh; 
      background: linear-gradient(180deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%); 
      color: #fff; 
      z-index: 1001; /* Higher than header */
      box-shadow: 4px 0 20px rgba(24, 45, 23, 0.15);
      backdrop-filter: blur(10px);
    }
    .tl-sidebar-header { 
      padding:24px; 
      border-bottom:1px solid rgba(255, 255, 255, 0.1); 
      text-align:center; 
    }
    .tl-sidebar-logo { 
      font-size:24px; 
      font-weight:700; 
      color:#fff; 
      margin-bottom:8px; 
    }
    .tl-sidebar-subtitle { 
      color:rgba(255, 255, 255, 0.8); 
      font-size:14px; 
    }
    .tl-sidebar-nav { 
      padding:20px 0; 
    }
    .tl-nav-item { 
      display:flex; 
      align-items:center; 
      padding:12px 24px; 
      color: #ffffff !important; 
      text-decoration:none; 
      transition:all 0.2s ease;
      position: relative;
    }
    .tl-nav-item span {
      color: #ffffff !important;
    }
    .tl-nav-item:hover { 
      background: rgba(255, 255, 255, 0.1); 
      color:#ffffff !important; 
    }
    .tl-nav-item:hover span {
      color: #ffffff !important;
    }
    .tl-nav-item.active { 
      background: rgba(255, 255, 255, 0.15); 
      color:#ffffff !important; 
      border-right:3px solid #ffffff; 
    }
    .tl-nav-item.active span {
      color: #ffffff !important;
    }
    .tl-nav-icon { 
      width:20px; 
      height:20px; 
      margin-right:12px; 
      flex-shrink: 0;
      color: #ffffff !important;
      stroke: #ffffff !important;
    }
    .tl-nav-arrow {
      width:16px;
      height:16px;
      margin-left:auto;
      transition: transform 0.2s ease;
      transform: rotate(0deg);
      color: #ffffff !important;
      stroke: #ffffff !important;
    }
    .tl-nav-arrow.rotated {
      transform: rotate(180deg);
    }
    .tl-submenu {
      background: rgba(0, 0, 0, 0.1);
      margin-left: 20px;
      border-radius: 8px;
      overflow: hidden;
    }
    .tl-submenu-item {
      display: flex;
      align-items: center;
      padding: 10px 20px;
      color: #ffffff !important;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
      text-decoration: none;
    }
    .tl-submenu-item span {
      color: #ffffff !important;
    }
    .tl-submenu-item:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff !important;
    }
    .tl-submenu-item:hover span {
      color: #ffffff !important;
    }
    .tl-submenu-item.active {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff !important;
    }
    .tl-submenu-item.active span {
      color: #ffffff !important;
    }
    .tl-submenu-icon {
      width: 16px;
      height: 16px;
      margin-right: 12px;
      flex-shrink: 0;
      color: #ffffff !important;
      stroke: #ffffff !important;
    }
    .tl-sidebar-footer { 
      padding:20px 24px; 
      border-top:1px solid rgba(255, 255, 255, 0.1); 
    }
    .tl-logout-button { 
      width:100%; 
      display:flex; 
      align-items:center; 
      padding:12px 16px; 
      background:transparent; 
      color:rgba(255, 255, 255, 0.9); 
      border:1px solid rgba(255, 255, 255, 0.2); 
      border-radius:8px; 
      cursor:pointer; 
      transition:all 0.2s ease;
      font-size:14px;
    }
    .tl-logout-button:hover { 
      background: rgba(239, 68, 68, 0.1); 
      color:#fff; 
      border-color:#ef4444; 
    }
    .tl-main-content { 
      margin-left: 0;
      margin-top: 0;
      min-height: 100vh; 
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding-top: 80px; /* Add space for fixed header */
    }
    
    .tl-header { 
      position: fixed;
      top: 0;
      left: 280px; /* Start after sidebar */
      right: 0;
      z-index: 1000;
      height: 80px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-bottom: 1px solid rgba(24, 45, 23, 0.1);
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      display: flex;
      align-items: center;
    }
    
    .tl-header-content {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 32px;
      width: 100%;
      height: 100%;
    }
    
    
    .tl-user-info {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
      transition: all 0.3s ease;
      height: auto;
      min-height: auto;
      margin: 0;
      position: relative;
      top: 0;
      transform: translateY(0);
    }

    .tl-user-info:hover {
      background: transparent;
      transform: translateY(0);
      box-shadow: none;
    }
    
    .user-initials {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--kudzu-primary);
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      margin: 0;
      transition: all 0.3s ease;
    }

    .user-initials:hover {
      background: var(--kudzu-primary-dark);
      transform: scale(1.05);
    }
    .tl-content { 
      padding: 32px;
    }
    @media (min-width: 1024px) { 
      .tl-main-content { 
        margin-left: 280px; /* Back to original spacing */
      } 
    }

    @media (max-width: 768px) {
      .tl-header {
        left: 0;
        height: 50px;
        display: flex;
        align-items: center;
      }

      .tl-header-content {
        padding: 0 20px;
        width: 100%;
        height: 100%;
      }

      .tl-user-info {
        padding: 8px 16px;
        height: 36px;
        min-height: 36px;
        margin: 0;
        position: relative;
        top: 0;
        transform: translateY(0);
      }

      .user-initials {
        width: 28px;
        height: 28px;
        font-size: 10px;
      }
    }
  `]
})
export class ManagerLayoutComponent implements OnInit {
  private router = inject(Router);
  currentUser = { name: 'Indhuja' };

  ngOnInit(): void {
    // Get user info from localStorage or service
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      try {
        this.currentUser = JSON.parse(userInfo);
      } catch (e) {
        console.error('Error parsing user info:', e);
      }
    }
  }

  getUserInitials(): string {
    if (!this.currentUser) {
      return 'T';
    }
    
    const name = this.currentUser.name || 'Manager';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  logout(): void {
    try { 
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('expires_at');
    } catch {}
    this.router.navigate(['/signin']).catch(() => {});
  }
}


