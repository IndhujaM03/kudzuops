import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastContainerComponent } from '../../shared/components/toast-container.component';


@Component({
  selector: 'app-recruiter-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent],
  template: `
    <div class="admin-layout">
      <!-- Sidebar -->
      <div class="sidebar" *ngIf="!shouldHideSidebar()">
        <div class="sidebar-header">
          <h1 class="sidebar-title">Recruiter</h1>
          <p class="sidebar-subtitle">Operations Dashboard</p>
          <div *ngIf="userInfo" class="sidebar-user-info">
            <p class="sidebar-user-name">{{ userInfo.display_name }}</p>
            <p class="sidebar-user-role">{{ userInfo.role | titlecase }}</p>
          </div>
        </div>
        
        <nav class="sidebar-nav">
          <a routerLink="/recruiter/dashboard" routerLinkActive="active" class="sidebar-nav-item">
            <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
            </svg>
            Dashboard
          </a>
          
          <a routerLink="/recruiter/demands" routerLinkActive="active" class="sidebar-nav-item">
            <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Assigned Demands
          </a>
          
          
        
          
          <a routerLink="/recruiter/settings" routerLinkActive="active" class="sidebar-nav-item">
            <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </a>
        </nav>
        
        <div class="sidebar-footer">
          <button (click)="logout()" class="btn btn-ghost sidebar-logout-btn">
            <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="main-content" [class.fullWidth]="shouldHideSidebar()">
        <!-- Header -->
        <header class="header">
          <div class="header-content">
            <div class="header-left">
              <h2 class="header-title">Dashboard</h2>
            </div>
            <div class="header-actions">
              <div class="notification-btn">
                <button class="notification-button">
                  <svg class="notification-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <!-- Page Content -->
        <main class="page-content">
          <div class="container">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
    
    <!-- Toast Container -->
    <app-toast-container></app-toast-container>
  `,
  styles: [`
    .admin-layout {
      display: flex;
      min-height: 100vh;
      background: #f8fafc;
    }

    .sidebar {
      width: 280px;
      background: white;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 24px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .sidebar-title {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 4px 0;
    }

    .sidebar-subtitle {
      font-size: 14px;
      opacity: 0.9;
      margin: 0 0 16px 0;
    }

    .sidebar-user-info {
      background: rgba(255, 255, 255, 0.1);
      padding: 12px;
      border-radius: 8px;
      backdrop-filter: blur(10px);
    }

    .sidebar-user-name {
      font-weight: 500;
      margin: 0 0 4px 0;
      font-size: 14px;
    }

    .sidebar-user-role {
      font-size: 12px;
      opacity: 0.8;
      margin: 0;
    }

    .sidebar-nav {
      flex: 1;
      padding: 20px 0;
    }

    .sidebar-nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      color: #6b7280;
      text-decoration: none;
      transition: all 0.2s;
      border-left: 3px solid transparent;
    }

    .sidebar-nav-item:hover {
      background: #f8fafc;
      color: #374151;
    }

    .sidebar-nav-item.active {
      background: #eff6ff;
      color: #2563eb;
      border-left-color: #2563eb;
    }

    .sidebar-nav-icon {
      width: 20px;
      height: 20px;
    }


    .sidebar-footer {
      padding: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .sidebar-logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f3f4f6;
      color: #374151;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }

    .sidebar-logout-btn:hover {
      background: #e5e7eb;
      color: #1f2937;
    }

    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .header {
      background: white;
      border-bottom: 1px solid #e5e7eb;
      padding: 0 24px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }

    .header-left {
      display: flex;
      align-items: center;
    }

    .header-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .notification-btn {
      position: relative;
    }

    .notification-button {
      background: none;
      border: none;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.2s;
    }

    .notification-button:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .notification-icon {
      width: 20px;
      height: 20px;
    }

    .page-content {
      flex: 1;
      padding: 0;
    }

    .container {
      max-width: 100%;
      margin: 0;
      padding: 0;
    }

    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        position: fixed;
        top: 0;
        left: -100%;
        z-index: 1000;
        transition: left 0.3s ease;
      }

      .sidebar.open {
        left: 0;
      }

      .main-content {
        width: 100%;
      }
    }
  `]
})
export class RecruiterComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  
  userInfo: any = null;

  ngOnInit(): void {
    this.loadUserInfo();
  }

  loadUserInfo(): void {
    this.auth.getCurrentUser().subscribe({
      next: (user) => this.userInfo = user,
      error: () => this.userInfo = null
    });
  }

  shouldHideSidebar(): boolean {
    try {
      // Prefer explicit route data flag anywhere in the activated tree
      let node: any = this.router.routerState.snapshot.root;
      while (node && node.firstChild) node = node.firstChild;
      if (node?.data && node.data['hideSidebar']) return true;
      // Fallback: hide for activity pages by URL pattern
      const url = this.router.url || '';
      return url.includes('/recruiter/activity/');
    } catch {
      return false;
    }
  }


  logout() {
    try { localStorage.removeItem('access_token'); } catch {}
    this.router.navigate(['/signin']).catch(() => {});
  }
}


