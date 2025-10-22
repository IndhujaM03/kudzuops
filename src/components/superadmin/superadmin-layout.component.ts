import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SuperAdminService } from '../../services/superadmin.service';
import { AuthService } from '../../services/auth.service';
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
          <div class="superadmin-nav-dropdown">
            <button (click)="clientSettingsOpen = !clientSettingsOpen" class="superadmin-nav-dropdown-button">
              <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6a2 2 0 012-2h8m-6 0V5a2 2 0 10-4 0v4m10 0a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2h2" />
              </svg>
              <span>Client Settings</span>
              <svg class="superadmin-nav-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="clientSettingsOpen ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'" />
              </svg>
            </button>
            <nav *ngIf="clientSettingsOpen" class="superadmin-nav-submenu">
              <a routerLink="/superadmin/client-settings/client" routerLinkActive="active" class="superadmin-nav-subitem">Client</a>
              <a routerLink="/superadmin/client-settings/spoc" routerLinkActive="active" class="superadmin-nav-subitem">SPOCs</a>
            </nav>
          </div>
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
          <div class="superadmin-header-content">
            <div class="superadmin-user-info">
              <div class="user-initials">{{ getUserInitials() }}</div>
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
    .superadmin-dashboard { 
      min-height: 100vh; 
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }
    
    .superadmin-sidebar { 
      position: fixed; 
      top: 0; 
      left: 0; 
      width: 280px; 
      height: 100vh; 
      background: linear-gradient(180deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%);
      color: #fff; 
      z-index: 1000; 
      box-shadow: 4px 0 20px rgba(24, 45, 23, 0.15);
      backdrop-filter: blur(10px);
    }
    
    .superadmin-sidebar-header { 
      padding: 24px; 
      border-bottom: 1px solid rgba(255, 255, 255, 0.1); 
      text-align: center; 
    }
    
    .superadmin-sidebar-logo { 
      font-size: 24px; 
      font-weight: 700; 
      color: #fff; 
      margin-bottom: 8px; 
    }
    
    .superadmin-sidebar-subtitle { 
      color: rgba(255, 255, 255, 0.8); 
      font-size: 14px; 
    }
    
    .superadmin-sidebar-nav { 
      padding: 20px 0; 
    }
    
    .superadmin-nav-item { 
      display: flex !important; 
      align-items: center !important; 
      padding: 12px 24px !important; 
      color: rgba(255, 255, 255, 0.9) !important; 
      text-decoration: none !important; 
      transition: all 0.2s ease !important; 
      position: relative !important; 
    }
    
    .superadmin-nav-item:hover { 
      background: rgba(255, 255, 255, 0.1) !important; 
      color: #fff !important; 
    }
    
    .superadmin-nav-item.active { 
      background: rgba(255, 255, 255, 0.15) !important; 
      color: #fff !important; 
      border-right: 3px solid #fff !important; 
    }
    
    .superadmin-nav-icon { 
      width: 20px; 
      height: 20px; 
      margin-right: 12px; 
      flex-shrink: 0; 
    }
    
    .superadmin-nav-item a { 
      color: inherit; 
      text-decoration: none; 
    }
    
    .superadmin-nav-badge { 
      margin-left: auto; 
      background: #ef4444; 
      color: #fff; 
      font-size: 12px; 
      font-weight: 600; 
      padding: 4px 8px; 
      border-radius: 12px; 
      min-width: 20px; 
      text-align: center; 
    }
    
    .superadmin-sidebar-footer { 
      padding: 20px 24px; 
      border-top: 1px solid rgba(255, 255, 255, 0.1); 
    }
    
    .superadmin-logout-button { 
      width: 100%; 
      display: flex; 
      align-items: center; 
      padding: 12px 16px; 
      background: transparent; 
      color: rgba(255, 255, 255, 0.9); 
      border: 1px solid rgba(255, 255, 255, 0.2); 
      border-radius: 8px; 
      cursor: pointer; 
      transition: all 0.2s ease; 
      font-size: 14px; 
    }
    
    .superadmin-logout-button:hover { 
      background: rgba(239, 68, 68, 0.1); 
      color: #fff; 
      border-color: #ef4444; 
    }
    
    .superadmin-main-content { 
      margin-left: 280px; 
      min-height: 100vh; 
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding-top: 80px; /* Add space for fixed header */
    }
    
    .superadmin-header { 
      position: fixed;
      top: 0;
      left: 280px;
      right: 0;
      z-index: 1000;
      height: 80px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-bottom: 1px solid rgba(24, 45, 23, 0.1);
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      display: flex;
      align-items: center;
    }

    .superadmin-header-content {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 32px;
      width: 100%;
      height: 100%;
    }


    .superadmin-user-info {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-initials {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--kudzu-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .user-initials:hover {
      background: var(--kudzu-primary-dark);
      transform: scale(1.05);
    }
    
    .superadmin-content { 
      padding: 32px; 
    }
    
    .superadmin-bell-wrapper { 
      width: 40px; 
      height: 40px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
    }
    
    .superadmin-bell-icon { 
      width: 24px; 
      height: 24px; 
      color: var(--kudzu-primary);
    }
    
    .superadmin-bell-badge { 
      position: absolute; 
      top: 0; 
      right: 0; 
      transform: translate(30%, -30%); 
      background: #ef4444; 
      color: #fff; 
      font-size: 11px; 
      font-weight: 700; 
      line-height: 1; 
      padding: 2px 5px; 
      border-radius: 9999px; 
      min-width: 16px; 
      text-align: center; 
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); 
    }
    
    @media (max-width: 768px) {
      .superadmin-main-content {
        margin-left: 0;
        width: 100%;
      }

      .superadmin-header {
        left: 0;
        height: 50px;
        display: flex;
        align-items: center;
      }

      .superadmin-header-content {
        padding: 0 20px;
        width: 100%;
        height: 100%;
      }

      .superadmin-user-info {
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

      .superadmin-content {
        padding: 20px;
      }
    }

    /* Dropdown Menu Styles */
    .superadmin-nav-dropdown {
      display: flex;
      flex-direction: column;
    }

    .superadmin-nav-dropdown-button {
      display: flex !important;
      align-items: center !important;
      padding: 12px 24px !important;
      color: rgba(255, 255, 255, 0.9) !important;
      background: transparent !important;
      border: none !important;
      width: 100% !important;
      text-align: left !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
    }

    .superadmin-nav-dropdown-button:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: white !important;
    }

    .superadmin-nav-arrow {
      width: 16px !important;
      height: 16px !important;
      margin-left: auto !important;
    }

    .superadmin-nav-submenu {
      display: flex;
      flex-direction: column;
    }

    .superadmin-nav-subitem {
      display: flex !important;
      align-items: center !important;
      padding: 8px 24px 8px 48px !important;
      color: rgba(255, 255, 255, 0.8) !important;
      text-decoration: none !important;
      transition: all 0.2s ease !important;
      font-size: 14px !important;
    }

    .superadmin-nav-subitem:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: white !important;
    }

    .superadmin-nav-subitem.active {
      background: rgba(255, 255, 255, 0.15) !important;
      color: white !important;
    }
  `]
})
export class SuperAdminLayoutComponent implements OnInit {
  private superAdminService = inject(SuperAdminService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  
  pendingCount = 0;
  clientSettingsOpen = false;
  userInfo: any = null;
  apiBase = environment.apiBase || '';

  ngOnInit(): void {
    console.log('🏢 SuperAdminLayoutComponent initialized');
    this.loadPendingCount();
    this.loadUserInfo();
    // Fallback: try to get user info from localStorage
    this.loadUserInfoFromStorage();
  }

  loadPendingCount(): void {
    this.superAdminService.getPendingCount().subscribe({
      next: (res) => this.pendingCount = res?.count ?? 0,
      error: (err) => {
        console.error('Failed to load pending count:', err);
        this.pendingCount = 0;
      }
    });
  }

  loadUserInfo(): void {
    console.log('🔄 Loading Super Admin user info from API...');
    this.auth.getCurrentUser().subscribe({
      next: (user) => {
        this.userInfo = user;
        console.log('✅ Super Admin user info loaded from API:', user);
        console.log('📊 Super Admin user info fields:', {
          id: user?.id,
          email: user?.email,
          display_name: user?.display_name,
          first_name: user?.first_name,
          last_name: user?.last_name,
          name: user?.name,
          role: user?.role
        });
        
        // If we don't have name fields, use email as fallback
        if (user?.id && (!user?.first_name && !user?.last_name && !user?.display_name)) {
          console.log('🔄 No name fields found, using email as fallback for Super Admin...');
          this.useEmailAsName(user);
        }
      },
      error: (error) => {
        console.error('❌ Error loading Super Admin user info from API:', error);
        this.userInfo = null;
      }
    });
  }

  useEmailAsName(user: any): void {
    console.log('🔄 Fetching Super Admin user profile from database for user:', user);
    
    // Fetch user profile from database
    this.fetchUserProfileFromDB(user.id);
  }

  fetchUserProfileFromDB(userId: number): void {
    console.log('🔄 Fetching Super Admin user profile from database for ID:', userId);
    
    // First try to get from localStorage
    const storedUser = localStorage.getItem(`user_profile_${userId}`);
    if (storedUser) {
      try {
        const profile = JSON.parse(storedUser);
        console.log('✅ Found stored Super Admin user profile:', profile);
        this.updateUserInfoWithProfile(profile);
        return;
      } catch (error) {
        console.error('❌ Error parsing stored Super Admin user profile:', error);
      }
    }
    
    // Fetch from database
    this.http.get<any[]>(`${this.apiBase}/users`).subscribe({
      next: (users) => {
        console.log('✅ Fetched users from database for Super Admin:', users);
        const userProfile = users.find(u => u.id === userId);
        if (userProfile) {
          console.log('✅ Found Super Admin user profile in database:', userProfile);
          // Store in localStorage for future use
          localStorage.setItem(`user_profile_${userId}`, JSON.stringify(userProfile));
          this.updateUserInfoWithProfile(userProfile);
        } else {
          console.log('⚠️ Super Admin user profile not found in database, using fallback');
          this.useFallbackName();
        }
      },
      error: (error) => {
        console.error('❌ Error fetching Super Admin user profile from database:', error);
        this.useFallbackName();
      }
    });
  }

  updateUserInfoWithProfile(profile: any): void {
    console.log('🔄 Updating Super Admin user info with profile:', profile);
    
    let displayName = 'Super Admin';
    
    if (profile.first_name && profile.last_name) {
      displayName = `${profile.first_name} ${profile.last_name}`;
    } else if (profile.first_name) {
      displayName = profile.first_name;
    } else if (profile.email) {
      // Use email as fallback
      const emailName = profile.email.split('@')[0];
      displayName = emailName
        .replace(/[._-]/g, ' ')
        .split(' ')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    this.userInfo = {
      ...this.userInfo,
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email,
      display_name: displayName
    };
    
    console.log('✅ Updated Super Admin user info with profile data:', this.userInfo);
  }

  useFallbackName(): void {
    console.log('⚠️ Using fallback name strategy for Super Admin');
    this.userInfo = {
      ...this.userInfo,
      display_name: 'Super Admin'
    };
  }

  loadUserInfoFromStorage(): void {
    try {
      const userInfo = localStorage.getItem('user_info');
      if (userInfo && !this.userInfo) {
        this.userInfo = JSON.parse(userInfo);
        console.log('Super Admin user info loaded from storage:', this.userInfo);
      }
    } catch (error) {
      console.error('Error parsing super admin user info from storage:', error);
    }
  }

  getPageTitle(): string {
    const url = this.router.url || '';
    if (url.includes('/dashboard')) return 'Dashboard';
    if (url.includes('/client-settings/client')) return 'Client Settings';
    if (url.includes('/client-settings/spoc')) return 'SPOC Settings';
    if (url.includes('/pending-approvals')) return 'Pending Approvals';
    return 'Dashboard';
  }

  getUserDisplayName(): string {
    if (!this.userInfo) {
      return 'Loading...';
    }
    
    if (this.userInfo.display_name) {
      return this.userInfo.display_name;
    }
    if (this.userInfo.first_name && this.userInfo.last_name) {
      return `${this.userInfo.first_name} ${this.userInfo.last_name}`;
    }
    if (this.userInfo.first_name) {
      return this.userInfo.first_name;
    }
    if (this.userInfo.name) {
      return this.userInfo.name;
    }
    if (this.userInfo.email) {
      return this.userInfo.email;
    }
    return 'Super Admin';
  }

  getUserInitials(): string {
    if (!this.userInfo) {
      return 'S';
    }
    
    // Try to get initials from display_name or first_name + last_name
    if (this.userInfo.display_name) {
      const parts = this.userInfo.display_name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    
    if (this.userInfo.first_name && this.userInfo.last_name) {
      return (this.userInfo.first_name[0] + this.userInfo.last_name[0]).toUpperCase();
    }
    
    if (this.userInfo.first_name) {
      return this.userInfo.first_name[0].toUpperCase();
    }
    
    if (this.userInfo.name) {
      const parts = this.userInfo.name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return parts[0][0].toUpperCase();
    }
    
    if (this.userInfo.email) {
      return this.userInfo.email[0].toUpperCase();
    }
    
    return 'S';
  }

  logout(): void {
    this.superAdminService.logout();
    this.router.navigate(['/superadmin/login']).catch(() => {});
  }
}


