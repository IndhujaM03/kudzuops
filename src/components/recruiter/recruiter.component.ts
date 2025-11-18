import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ToastContainerComponent } from '../../shared/components/toast-container.component';
import { environment } from '../../environments/environment';


@Component({
  selector: 'app-recruiter-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastContainerComponent],
  template: `
    <div class="admin-layout">
      <!-- Sidebar -->
      <div class="sidebar" *ngIf="!shouldHideSidebar()">
        <div class="sidebar-header">
          <h1 class="sidebar-title">{{ getUserDisplayName() }}</h1>
          <p class="sidebar-subtitle">Recruiter</p>
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
          
          <a routerLink="/recruiter/interview-schedule" routerLinkActive="active" class="sidebar-nav-item">
            <svg class="sidebar-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Interview Schedule
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
      <div class="main-content" [ngClass]="{ fullWidth: shouldHideSidebar(), noHeader: shouldHideHeader() }">
        <!-- Header -->
        <header class="header" *ngIf="!shouldHideHeader()">
          <div class="header-content">
            <div class="header-left">
              <!-- Left side content can be added here if needed -->
            </div>
            <div class="header-right">
              <div class="user-initials">{{ getUserInitials() }}</div>
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
    /* Import Manrope Font */
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

    /* Kudzu Theme Variables */
    :root {
      --kudzu-primary: rgb(24, 45, 23);
      --kudzu-primary-light: rgba(24, 45, 23, 0.1);
      --kudzu-primary-dark: rgb(18, 35, 18);
    }

    .admin-layout {
      display: flex;
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      background: linear-gradient(180deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%);
      color: white;
      display: flex;
      flex-direction: column;
      box-shadow: 4px 0 20px rgba(24, 45, 23, 0.15);
      backdrop-filter: blur(10px);
      z-index: 1001;
    }

    .sidebar-header {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: transparent;
      color: white;
    }

    .sidebar-title {
      font-size: 18px !important;
      font-weight: 600 !important;
      margin: 0 0 4px 0 !important;
      color: white !important;
      font-family: "Manrope", "Manrope Placeholder", sans-serif !important;
      display: block !important;
      visibility: visible !important;
    }

    .sidebar-subtitle {
      font-size: 12px !important;
      opacity: 0.8 !important;
      margin: 0 !important;
      color: rgba(255, 255, 255, 0.8) !important;
      display: block !important;
      visibility: visible !important;
    }



    .sidebar-nav {
      flex: 1;
      padding: 20px 0;
    }

    .sidebar-nav-item {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 12px 24px !important;
      color: rgba(255, 255, 255, 0.9) !important;
      text-decoration: none !important;
      transition: all 0.2s ease !important;
      border-left: 3px solid transparent !important;
      position: relative !important;
    }

    .sidebar-nav-item:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: white !important;
    }

    .sidebar-nav-item.active {
      background: rgba(255, 255, 255, 0.15) !important;
      color: white !important;
      border-left-color: white !important;
    }

    .sidebar-nav-icon {
      width: 20px;
      height: 20px;
    }


    .sidebar-footer {
      padding: 20px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .sidebar-logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: transparent;
      color: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
      font-weight: 500;
    }

    .sidebar-logout-btn:hover {
      background: rgba(239, 68, 68, 0.1);
      color: white;
      border-color: #ef4444;
    }

    .main-content {
      margin-left: 280px;
      flex: 1;
      display: flex;
      flex-direction: column;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding-top: 60px; /* Add space for fixed header */
    }

    /* Fullscreen adjustments when sidebar/header hidden */
    .main-content.fullWidth { margin-left: 0; }
    .main-content.noHeader { padding-top: 0; }

    .header {
      position: fixed;
      top: 0;
      left: 280px;
      right: 0;
      z-index: 1000;
      height: 60px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-bottom: 1px solid rgba(24, 45, 23, 0.1);
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      display: flex;
      align-items: center;
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      width: 100%;
      height: 100%;
    }

    .header-left {
      display: flex;
      align-items: center;
    }

    .header-right {
      display: flex;
      align-items: center;
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



    .page-content {
      flex: 1;
      padding: 32px;
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
        z-index: 1001;
        transition: left 0.3s ease;
      }

      .sidebar.open {
        left: 0;
      }

      .main-content {
        margin-left: 0;
        width: 100%;
      }

      .header {
        left: 0;
        height: 50px;
        display: flex;
        align-items: center;
      }

      .header-content {
        padding: 0 20px;
        width: 100%;
        height: 100%;
      }


      .page-content {
        padding: 20px;
      }
    }
  `]
})
export class RecruiterComponent implements OnInit {
  private router = inject(Router);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  
  userInfo: any = null;
  apiBase = environment.apiBase || '';

  ngOnInit(): void {
    this.loadUserInfo();
    // Fallback: try to get user info from localStorage
    this.loadUserInfoFromStorage();
    
    // Also try to get from localStorage immediately as backup
    const storedUser = localStorage.getItem('user_info');
    console.log('🔍 Immediate localStorage check:', storedUser);
    if (storedUser && !this.userInfo) {
      try {
        this.userInfo = JSON.parse(storedUser);
        console.log('✅ User info loaded from localStorage on init:', this.userInfo);
        console.log('📊 Init storage user info fields:', {
          id: this.userInfo?.id,
          email: this.userInfo?.email,
          display_name: this.userInfo?.display_name,
          first_name: this.userInfo?.first_name,
          last_name: this.userInfo?.last_name,
          name: this.userInfo?.name,
          role: this.userInfo?.role
        });
      } catch (e) {
        console.error('❌ Error parsing stored user info:', e);
      }
    } else if (storedUser) {
      console.log('ℹ️ User info already loaded, skipping init localStorage');
    } else {
      console.log('⚠️ No user info in localStorage on init');
    }
  }

  loadUserInfo(): void {
    console.log('🔄 Loading user info from API...');
    this.auth.getCurrentUser().subscribe({
      next: (user) => {
        this.userInfo = user;
        console.log('✅ User info loaded from API:', user);
        console.log('📊 User info fields:', {
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
          console.log('🔄 No name fields found, using email as fallback...');
          this.useEmailAsName(user);
        }
      },
      error: (error) => {
        console.error('❌ Error loading user info from API:', error);
        this.userInfo = null;
      }
    });
  }

  useEmailAsName(user: any): void {
    console.log('🔄 Fetching user profile from database for user:', user);
    
    // Fetch user profile from database
    this.fetchUserProfileFromDB(user.id);
  }

  fetchUserProfileFromDB(userId: number): void {
    console.log('🔄 Fetching user profile from database for ID:', userId);
    
    // First try to get from localStorage
    const storedUser = localStorage.getItem(`user_profile_${userId}`);
    if (storedUser) {
      try {
        const profile = JSON.parse(storedUser);
        console.log('✅ Found stored user profile:', profile);
        this.updateUserInfoWithProfile(profile);
        return;
      } catch (error) {
        console.error('❌ Error parsing stored user profile:', error);
      }
    }
    
    // Fetch from database
    this.http.get<any[]>(`${this.apiBase}/users`).subscribe({
      next: (users) => {
        console.log('✅ Fetched users from database:', users);
        const userProfile = users.find(u => u.id === userId);
        if (userProfile) {
          console.log('✅ Found user profile in database:', userProfile);
          // Store in localStorage for future use
          localStorage.setItem(`user_profile_${userId}`, JSON.stringify(userProfile));
          this.updateUserInfoWithProfile(userProfile);
        } else {
          console.log('⚠️ User profile not found in database, using fallback');
          this.useFallbackName();
        }
      },
      error: (error) => {
        console.error('❌ Error fetching user profile from database:', error);
        this.useFallbackName();
      }
    });
  }

  updateUserInfoWithProfile(profile: any): void {
    console.log('🔄 Updating user info with profile:', profile);
    
    let displayName = 'Recruiter';
    
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
    
    console.log('✅ Updated user info with profile data:', this.userInfo);
  }

  useFallbackName(): void {
    console.log('⚠️ Using fallback name strategy');
    this.userInfo = {
      ...this.userInfo,
      display_name: this.userInfo?.role === 'recruiter' ? 'Recruiter' : 'User'
    };
  }

  loadUserInfoFromStorage(): void {
    try {
      const userInfo = localStorage.getItem('user_info');
      console.log('🔍 Checking localStorage for user info:', userInfo);
      if (userInfo && !this.userInfo) {
        this.userInfo = JSON.parse(userInfo);
        console.log('✅ User info loaded from storage:', this.userInfo);
        console.log('📊 Storage user info fields:', {
          id: this.userInfo?.id,
          email: this.userInfo?.email,
          display_name: this.userInfo?.display_name,
          first_name: this.userInfo?.first_name,
          last_name: this.userInfo?.last_name,
          name: this.userInfo?.name,
          role: this.userInfo?.role
        });
      } else if (userInfo) {
        console.log('ℹ️ User info already loaded from API, skipping storage');
      } else {
        console.log('⚠️ No user info found in localStorage');
      }
    } catch (error) {
      console.error('❌ Error parsing user info from storage:', error);
    }
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

  shouldHideHeader(): boolean {
    try {
      // Hide header on activity (process) pages
      const url = this.router.url || '';
      return url.includes('/recruiter/activity/');
    } catch {
      return false;
    }
  }


  getPageTitle(): string {
    const url = this.router.url || '';
    if (url.includes('/dashboard')) return 'Dashboard';
    if (url.includes('/demands')) return 'Assigned Demands';
    if (url.includes('/settings')) return 'Settings';
    if (url.includes('/submitted')) return 'Submitted CVs';
    if (url.includes('/interview-schedule')) return 'Interview Schedule';
    if (url.includes('/activity/')) return 'Recruiter Activity';
    return 'Dashboard';
  }

  getUserDisplayName(): string {
    if (!this.userInfo) {
      return 'Loading...';
    }
    
    console.log('🔍 Getting user display name for:', this.userInfo);
    
    if (this.userInfo.display_name) {
      console.log('✅ Using display_name:', this.userInfo.display_name);
      return this.userInfo.display_name;
    }
    if (this.userInfo.first_name && this.userInfo.last_name) {
      const fullName = `${this.userInfo.first_name} ${this.userInfo.last_name}`;
      console.log('✅ Using first_name + last_name:', fullName);
      return fullName;
    }
    if (this.userInfo.first_name) {
      console.log('✅ Using first_name:', this.userInfo.first_name);
      return this.userInfo.first_name;
    }
    if (this.userInfo.name) {
      console.log('✅ Using name:', this.userInfo.name);
      return this.userInfo.name;
    }
    if (this.userInfo.email) {
      console.log('✅ Using email:', this.userInfo.email);
      return this.userInfo.email;
    }
    
    // If we have an ID but no name, show a generic name
    if (this.userInfo.id) {
      console.log('⚠️ No name fields found, using ID-based name');
      return `Recruiter #${this.userInfo.id}`;
    }
    
    console.log('⚠️ No user info available, using fallback');
    return 'Recruiter';
  }

  getUserInitials(): string {
    if (!this.userInfo) {
      return 'R';
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
    
    return 'R';
  }

  logout() {
    try { localStorage.removeItem('access_token'); } catch {}
    this.router.navigate(['/signin']).catch(() => {});
  }
}


