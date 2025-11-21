import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-businesshead-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="tl-dashboard">
      <div class="tl-sidebar">
        <div class="tl-sidebar-header">
          <h1 class="tl-sidebar-title">{{ getUserDisplayName() }}</h1>
          <p class="tl-sidebar-subtitle">Business Head</p>
        </div>
        <nav class="tl-sidebar-nav">
          <a routerLink="/businesshead/dashboard" routerLinkActive="active" class="tl-nav-item">
            <svg class="tl-nav-icon" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </a>
          <a routerLink="/businesshead/settings" routerLinkActive="active" class="tl-nav-item">
            <svg class="tl-nav-icon" fill="none" stroke="#ffffff" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
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
            <div class="tl-header-left">
              <!-- Left side content can be added here if needed -->
            </div>
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
    .tl-dashboard { min-height: 100vh; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); font-family: "Manrope", "Manrope Placeholder", sans-serif; }
    .tl-sidebar { position: fixed; top:0; left:0; width:280px; height:100vh; background: linear-gradient(180deg, var(--kudzu-primary) 0%, var(--kudzu-primary-dark) 100%); color:#fff; z-index:1001; box-shadow:4px 0 20px rgba(24,45,23,0.15); backdrop-filter: blur(10px); }
    .tl-sidebar-header { padding:24px 20px; border-bottom:1px solid rgba(255,255,255,0.1); background:transparent; color:white; }
    .tl-sidebar-title { font-size:18px !important; font-weight:600 !important; margin:0 0 4px 0 !important; color:white !important; font-family:"Manrope", "Manrope Placeholder", sans-serif !important; display:block !important; visibility:visible !important; }
    .tl-sidebar-subtitle { font-size:12px !important; opacity:0.8 !important; margin:0 !important; color:rgba(255,255,255,0.8) !important; display:block !important; visibility:visible !important; }
    .tl-sidebar-nav { padding:20px 0; }
    .tl-nav-item { display:flex; align-items:center; padding:12px 24px; color:#ffffff !important; text-decoration:none; transition:all 0.2s ease; position: relative; }
    .tl-nav-item:hover { background: rgba(255,255,255,0.1); color:#ffffff !important; }
    .tl-nav-item.active { background: rgba(255,255,255,0.15); color:#ffffff !important; border-right:3px solid #ffffff; }
    .tl-nav-icon { width:20px; height:20px; margin-right:12px; flex-shrink:0; color:#ffffff !important; stroke:#ffffff !important; }
    .tl-sidebar-footer { padding:20px 24px; border-top:1px solid rgba(255,255,255,0.1); }
    .tl-logout-button { width:100%; display:flex; align-items:center; padding:12px 16px; background:transparent; color:rgba(255,255,255,0.9); border:1px solid rgba(255,255,255,0.2); border-radius:8px; cursor:pointer; transition:all 0.2s ease; font-size:14px; }
    .tl-main-content { margin-left:280px; min-height:100vh; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding-top:80px; }
    .tl-header { position:fixed; top:0; left:280px; right:0; z-index:1000; height:80px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-bottom: 1px solid rgba(24,45,23,0.1); box-shadow:0 4px 6px rgba(24,45,23,0.1); display:flex; align-items:center; }
    .tl-header-content { display:flex; align-items:center; justify-content:space-between; padding:0 32px; width:100%; height:100%; }
    .tl-header-left { display:flex; align-items:center; }
    .tl-header-role { font-size:16px; font-weight:600; color:var(--kudzu-primary); font-family:"Manrope", "Manrope Placeholder", sans-serif; }
    .tl-content { padding:32px; }
    .tl-user-info .user-initials { width:32px; height:32px; border-radius:50%; background: var(--kudzu-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; }
  `]
})
export class BusinessHeadLayoutComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiBase = environment.apiBase || 'http://localhost:8000';
  currentUser: any = { first_name: '', last_name: '' };

  ngOnInit(): void {
    this.loadUserInfo();
  }

  loadUserInfo(): void {
    // First try to get from AuthService (extracts from token)
    this.auth.getCurrentUser().subscribe({
      next: (user) => {
        if (user?.first_name && user?.last_name) {
          this.currentUser = {
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: user.display_name,
            email: user.email
          };
        } else if (user?.id) {
          // If token doesn't have name, fetch from database
          this.fetchUserProfileFromDB(user.id);
        } else {
          // Fallback: try API endpoint
          this.fetchUserFromAPI();
        }
      },
      error: (error) => {
        console.error('Error getting user from AuthService:', error);
        // Fallback: try API endpoint
        this.fetchUserFromAPI();
      }
    });
  }

  fetchUserFromAPI(): void {
    const token = localStorage.getItem('access_token') || '';
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    this.http.get<any>(`${this.apiBase}/users/me`, { headers }).subscribe({
      next: (user) => {
        this.currentUser = {
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          display_name: user.display_name || user.name,
          email: user.email || ''
        };
      },
      error: (error) => {
        console.error('Error loading user info from API:', error);
        // Final fallback: try to get from token
        try {
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            this.currentUser = {
              first_name: payload.first_name || '',
              last_name: payload.last_name || '',
              display_name: payload.display_name || payload.name,
              email: payload.email || ''
            };
          }
        } catch (e) {
          console.error('Error parsing token:', e);
        }
      }
    });
  }

  fetchUserProfileFromDB(userId: number): void {
    const token = localStorage.getItem('access_token') || '';
    const headers: { [key: string]: string } = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    this.http.get<any[]>(`${this.apiBase}/users`, { headers }).subscribe({
      next: (users) => {
        const userProfile = users.find(u => u.id === userId);
        if (userProfile) {
          this.currentUser = {
            first_name: userProfile.first_name || '',
            last_name: userProfile.last_name || '',
            display_name: userProfile.display_name || userProfile.name,
            email: userProfile.email || ''
          };
        }
      },
      error: (error) => {
        console.error('Error fetching user profile from database:', error);
      }
    });
  }

  getUserDisplayName(): string {
    if (!this.currentUser) {
      return 'Loading...';
    }
    
    if (this.currentUser.first_name && this.currentUser.last_name) {
      return `${this.currentUser.first_name} ${this.currentUser.last_name}`.trim();
    }
    
    if (this.currentUser.first_name) {
      return this.currentUser.first_name;
    }
    
    if (this.currentUser.display_name) {
      return this.currentUser.display_name;
    }
    
    if (this.currentUser.email) {
      return this.currentUser.email;
    }
    
    return 'Business Head';
  }

  getUserInitials(): string {
    if (!this.currentUser) {
      return 'BH';
    }
    
    // Use first letter of first_name and first letter of last_name
    if (this.currentUser.first_name && this.currentUser.last_name) {
      const first = this.currentUser.first_name.trim()[0] || '';
      const last = this.currentUser.last_name.trim()[0] || '';
      if (first && last) {
        return (first + last).toUpperCase();
      }
    }
    
    // Fallback to first letter of first_name only
    if (this.currentUser.first_name) {
      const first = this.currentUser.first_name.trim()[0] || '';
      if (first) {
        return first.toUpperCase();
      }
    }
    
    return 'BH';
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





