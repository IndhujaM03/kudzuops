import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SuperAdminService, PendingUser } from '../../services/superadmin.service';

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  template: `
    <div class="superadmin-dashboard">
      <!-- Sidebar -->
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
          <a routerLink="/superadmin/pending-users" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Pending Users
            <span *ngIf="pendingCount() > 0" class="superadmin-nav-badge">
              {{ pendingCount() }}
            </span>
          </a>
          <a routerLink="/superadmin/all-users" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            All Users
          </a>
          <a routerLink="/superadmin/roles" routerLinkActive="active" class="superadmin-nav-item">
            <svg class="superadmin-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Roles
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

      <!-- Main Content -->
      <div class="superadmin-main-content">
        <header class="superadmin-header">
          <h1 class="superadmin-header-title">Dashboard</h1>
        </header>
        <main class="superadmin-content">
          <h2 class="superadmin-section-title">Pending Approvals</h2>
          <div class="superadmin-card">
            <div *ngIf="pendingUsers().length === 0" class="superadmin-empty-state">
              <div class="superadmin-empty-icon">✅</div>
              <h3 class="superadmin-empty-title">No pending users</h3>
              <p class="superadmin-empty-description">All users have been processed.</p>
            </div>
            <table *ngIf="pendingUsers().length > 0" class="superadmin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let user of pendingUsers()">
                  <td>{{ user.email.split('@')[0] }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <select [(ngModel)]="user.role" (change)="setRole(user.id, $event)" class="superadmin-role-select">
                      <option value="candidate">Candidate</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="manager">Manager</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
                  <td>
                    <span class="superadmin-status-badge pending">Pending</span>
                  </td>
                  <td>
                    <div class="superadmin-action-buttons">
                      <button (click)="approveUser(user.id)" class="superadmin-btn superadmin-btn-approve">
                        ✅ Approve
                      </button>
                      <button (click)="rejectUser(user.id)" class="superadmin-btn superadmin-btn-reject">
                        ❌ Reject
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    /* Super Admin Dashboard Styles */
    .superadmin-dashboard {
      min-height: 100vh;
      background: #f7fafc;
    }

    .superadmin-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 280px;
      height: 100vh;
      background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%);
      color: white;
      z-index: 1000;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
    }

    .superadmin-sidebar-header {
      padding: 24px;
      border-bottom: 1px solid #4a5568;
      text-align: center;
    }

    .superadmin-sidebar-logo {
      font-size: 24px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 8px;
    }

    .superadmin-sidebar-subtitle {
      color: #a0aec0;
      font-size: 14px;
    }

    .superadmin-sidebar-nav {
      padding: 20px 0;
      flex: 1;
    }

    .superadmin-nav-item {
      display: flex;
      align-items: center;
      padding: 12px 24px;
      color: #e2e8f0;
      text-decoration: none;
      transition: all 0.2s ease;
      position: relative;
    }

    .superadmin-nav-item:hover {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
    }

    .superadmin-nav-item.active {
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
      border-right: 3px solid #667eea;
    }

    .superadmin-nav-icon {
      width: 20px;
      height: 20px;
      margin-right: 12px;
      flex-shrink: 0;
    }

    .superadmin-nav-badge {
      margin-left: auto;
      background: #e53e3e;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 12px;
      min-width: 20px;
      text-align: center;
    }

    .superadmin-sidebar-footer {
      padding: 20px 24px;
      border-top: 1px solid #4a5568;
    }

    .superadmin-logout-button {
      width: 100%;
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: transparent;
      color: #e2e8f0;
      border: 1px solid #4a5568;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 14px;
    }

    .superadmin-logout-button:hover {
      background: rgba(229, 62, 62, 0.1);
      color: #e53e3e;
      border-color: #e53e3e;
    }

    .superadmin-main-content {
      margin-left: 280px;
      min-height: 100vh;
      background: #f7fafc;
    }

    .superadmin-header {
      background: white;
      border-bottom: 1px solid #e2e8f0;
      padding: 20px 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .superadmin-header-title {
      font-size: 24px;
      font-weight: 700;
      color: #1a202c;
      margin: 0;
    }

    .superadmin-content {
      padding: 32px;
    }

    .superadmin-section-title {
      font-size: 20px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 24px;
    }

    .superadmin-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }

    .superadmin-table {
      width: 100%;
      border-collapse: collapse;
    }

    .superadmin-table th {
      background: #f7fafc;
      padding: 16px 24px;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
      font-size: 14px;
      border-bottom: 1px solid #e2e8f0;
    }

    .superadmin-table td {
      padding: 16px 24px;
      border-bottom: 1px solid #f1f5f9;
      color: #2d3748;
    }

    .superadmin-table tr:hover {
      background: #f8fafc;
    }

    .superadmin-status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .superadmin-status-badge.pending {
      background: #fef5e7;
      color: #d69e2e;
    }

    .superadmin-status-badge.approved {
      background: #f0fff4;
      color: #38a169;
    }

    .superadmin-action-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .superadmin-btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .superadmin-btn-approve {
      background: #48bb78;
      color: white;
    }

    .superadmin-btn-approve:hover {
      background: #38a169;
      transform: translateY(-1px);
    }

    .superadmin-btn-reject {
      background: #f56565;
      color: white;
    }

    .superadmin-btn-reject:hover {
      background: #e53e3e;
      transform: translateY(-1px);
    }

    .superadmin-role-select {
      padding: 6px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      font-size: 14px;
      color: #2d3748;
      cursor: pointer;
      transition: border-color 0.2s ease;
    }

    .superadmin-role-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .superadmin-empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #718096;
    }

    .superadmin-empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .superadmin-empty-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #4a5568;
    }

    .superadmin-empty-description {
      font-size: 14px;
      color: #718096;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .superadmin-sidebar {
        transform: translateX(-100%);
        transition: transform 0.3s ease;
      }
      
      .superadmin-sidebar.open {
        transform: translateX(0);
      }
      
      .superadmin-main-content {
        margin-left: 0;
      }
      
      .superadmin-content {
        padding: 20px;
      }
      
      .superadmin-table {
        font-size: 14px;
      }
      
      .superadmin-table th,
      .superadmin-table td {
        padding: 12px 16px;
      }
    }
  `]
})
export class SuperAdminDashboardComponent implements OnInit {
  private superAdminService = inject(SuperAdminService);
  private router = inject(Router);

  pendingUsers = signal<PendingUser[]>([]);
  pendingCount = signal(0);

  ngOnInit(): void {
    this.loadPendingUsers();
  }

  loadPendingUsers(): void {
    this.superAdminService.getPendingUsers().subscribe({
      next: (users) => {
        this.pendingUsers.set(users);
        this.pendingCount.set(users.length);
      },
      error: (err) => {
        console.error('Failed to load pending users:', err);
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/superadmin/login']);
        }
      }
    });
  }

  approveUser(userId: number): void {
    this.superAdminService.approveUser(userId).subscribe({
      next: (res) => {
        console.log('User approved:', res.message);
        this.loadPendingUsers(); // Refresh the list
      },
      error: (err) => {
        console.error('Approval failed:', err);
      }
    });
  }

  rejectUser(userId: number): void {
    this.superAdminService.rejectUser(userId).subscribe({
      next: (res) => {
        console.log('User rejected:', res.message);
        this.loadPendingUsers(); // Refresh the list
      },
      error: (err) => {
        console.error('Rejection failed:', err);
      }
    });
  }

  setRole(userId: number, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const role = selectElement.value;
    this.superAdminService.setUserRole(userId, role).subscribe({
      next: (res) => {
        console.log('Role updated:', res.message);
        this.loadPendingUsers(); // Refresh the list
      },
      error: (err) => {
        console.error('Role update failed:', err);
      }
    });
  }

  logout(): void {
    this.superAdminService.logout();
    this.router.navigate(['/superadmin/login']);
  }
}
