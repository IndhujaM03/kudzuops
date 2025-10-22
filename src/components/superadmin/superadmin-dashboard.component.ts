import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SuperAdminService, PendingUser } from '../../services/superadmin.service';

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2 class="superadmin-section-title"></h2>
      <div class="superadmin-card superadmin-card-elevated">
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
              <th>Reporting To</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of pendingUsers()">
              <td>{{ (user.first_name + ' ' + user.last_name).trim() || user.email.split('@')[0] }}</td>
              <td>{{ user.email }}</td>
              <td>
                <div class="superadmin-role-dropdown" [class.open]="user.showRoleDropdown">
                  <div class="superadmin-role-trigger" (click)="toggleRoleDropdown(user, $event)">
                    <span class="superadmin-role-display">
                      {{ user.role ? (user.role | titlecase) : 'Select Role' }}
                    </span>
                    <span class="superadmin-role-arrow">▼</span>
                  </div>
                  <div class="superadmin-role-checkboxes" *ngIf="user.showRoleDropdown" (click)="$event.stopPropagation()">
                    <label class="superadmin-role-checkbox">
                      <input type="checkbox" [checked]="user.role === 'recruiter'" (change)="setRoleFromCheckbox(user, 'recruiter'); $event.stopPropagation()">
                      <span>Recruiter</span>
                    </label>
                    <label class="superadmin-role-checkbox">
                      <input type="checkbox" [checked]="user.role === 'team_leader'" (change)="setRoleFromCheckbox(user, 'team_leader'); $event.stopPropagation()">
                      <span>Team Leader</span>
                    </label>
                    <label class="superadmin-role-checkbox">
                      <input type="checkbox" [checked]="user.role === 'manager'" (change)="setRoleFromCheckbox(user, 'manager'); $event.stopPropagation()">
                      <span>Manager</span>
                    </label>
                    <label class="superadmin-role-checkbox">
                      <input type="checkbox" [checked]="user.role === 'business_head'" (change)="setRoleFromCheckbox(user, 'business_head'); $event.stopPropagation()">
                      <span>Business Head</span>
                    </label>
                    <label class="superadmin-role-checkbox">
                      <input type="checkbox" [checked]="user.role === 'cluster_manager'" (change)="setRoleFromCheckbox(user, 'cluster_manager'); $event.stopPropagation()">
                      <span>Cluster Manager</span>
                    </label>
                    <label class="superadmin-role-checkbox">
                      <input type="checkbox" [checked]="user.role === 'super_admin'" (change)="setRoleFromCheckbox(user, 'super_admin'); $event.stopPropagation()">
                      <span>Super Admin</span>
                    </label>
                  </div>
                </div>
              </td>
              <td *ngIf="needsReportingPerson(user.role)">
                <select [(ngModel)]="user.reporting_to" class="superadmin-reporting-select">
                  <option value="">Select the reporting person</option>
                  <option *ngFor="let person of getReportingPersons(user.role)" [value]="person.id">
                    {{ (person.first_name + ' ' + person.last_name).trim() || person.email.split('@')[0] }}
                  </option>
                </select>
              </td>
              <td *ngIf="!needsReportingPerson(user.role)">
                <span class="superadmin-no-reporting">N/A</span>
              </td>
              <td>
                <span class="superadmin-status-badge pending">Pending</span>
              </td>
              <td>
                <div class="superadmin-action-buttons">
                  <button (click)="approveUser(user)" class="superadmin-btn superadmin-btn-approve superadmin-btn-pill">Approve</button>
                  <button (click)="rejectUser(user.id)" class="superadmin-btn superadmin-btn-reject superadmin-btn-pill">Reject</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  `,
  styles: [`
    /* Super Admin Dashboard Styles - Kudzu Theme */
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
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      border: 1px solid rgba(24, 45, 23, 0.1);
      overflow: visible;
      min-height: 400px;
    }
    .superadmin-card-elevated { 
      box-shadow: 0 10px 18px rgba(24, 45, 23, 0.15); 
      border-color: rgba(24, 45, 23, 0.2); 
    }

    .superadmin-table {
      width: 100%;
      border-collapse: collapse;
      overflow: visible;
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
      position: relative;
      vertical-align: middle;
      height: 60px;
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
      background: var(--kudzu-primary);
      color: white;
    }

    .superadmin-btn-approve:hover {
      background: var(--kudzu-primary-dark);
      transform: translateY(-1px);
    }

    .superadmin-btn-reject {
      background: #ef4444;
      color: white;
    }

    .superadmin-btn-reject:hover {
      background: #dc2626;
      transform: translateY(-1px);
    }
    .superadmin-btn-pill { border-radius: 9999px; padding: 8px 18px; }

    .superadmin-role-dropdown {
      position: relative;
      display: inline-block;
    }

    .superadmin-role-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      font-size: 14px;
      color: #2d3748;
      cursor: pointer;
      transition: border-color 0.2s ease;
      min-width: 140px;
      height: 36px;
      box-sizing: border-box;
    }

    .superadmin-role-trigger:hover {
      border-color: #667eea;
    }

    .superadmin-role-display {
      flex: 1;
      text-align: left;
    }

    .superadmin-role-arrow {
      margin-left: 8px;
      font-size: 12px;
      color: #6b7280;
      transition: transform 0.2s ease;
    }

    .superadmin-role-dropdown.open .superadmin-role-arrow {
      transform: rotate(180deg);
    }

    .superadmin-role-checkboxes {
      position: fixed;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      max-height: 250px;
      overflow-y: auto;
      min-width: 200px;
      max-width: 300px;
    }

    .superadmin-role-checkbox {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-size: 14px;
    }

    .superadmin-role-checkbox:hover {
      background-color: #f7fafc;
    }

    .superadmin-role-checkbox input[type="checkbox"] {
      margin-right: 8px;
      cursor: pointer;
    }

    .superadmin-role-checkbox span {
      color: #2d3748;
      font-weight: 500;
    }

    .superadmin-reporting-select {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      font-size: 14px;
      color: #2d3748;
      cursor: pointer;
      transition: border-color 0.2s ease;
      min-width: 200px;
      height: 36px;
      box-sizing: border-box;
    }

    .superadmin-reporting-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .superadmin-no-reporting {
      color: #6b7280;
      font-style: italic;
      font-size: 14px;
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
  
  // Reporting persons data
  teamLeaders = signal<any[]>([]);
  managers = signal<any[]>([]);
  businessHeads = signal<any[]>([]);
  clusterManagers = signal<any[]>([]);
  superAdmins = signal<any[]>([]);

  ngOnInit(): void {
    console.log('📊 SuperAdminDashboardComponent initialized');
    this.loadPendingUsers();
    this.loadReportingPersons();
    
    // Add click outside handler to close dropdowns
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.superadmin-role-dropdown')) {
        this.pendingUsers().forEach((user: any) => {
          user.showRoleDropdown = false;
        });
      }
    });
  }

  loadPendingUsers(): void {
    this.superAdminService.getPendingUsers().subscribe({
      next: (users) => {
        // Ensure users don't have a default role and initialize dropdown state
        const processedUsers = users.map(user => ({
          ...user,
          role: '', // Always start with empty role (Select Role)
          showRoleDropdown: false // Initialize dropdown state
        }));
        this.pendingUsers.set(processedUsers);
        this.pendingCount.set(processedUsers.length);
      },
      error: (err) => {
        console.error('Failed to load pending users:', err);
        if (err.status === 401 || err.status === 403) {
          this.router.navigate(['/superadmin/login']);
        }
      }
    });
  }

  approveUser(user: any): void {
    // Check if role is selected
    if (!user.role || user.role === '') {
      alert('Please choose a role.');
      return;
    }

    // Check if reporting person is required and selected
    if (this.needsReportingPerson(user.role) && !user.reporting_to) {
      alert('Please select a reporting person for this role.');
      return;
    }

    this.superAdminService.approveUser(user.id, user.reporting_to).subscribe({
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


  // Load all reporting persons
  loadReportingPersons(): void {
    this.loadTeamLeaders();
    this.loadManagers();
    this.loadBusinessHeads();
    this.loadClusterManagers();
    this.loadSuperAdmins();
  }

  loadTeamLeaders(): void {
    this.superAdminService.getTeamLeaders().subscribe({
      next: (data: any[]) => this.teamLeaders.set(data || []),
      error: (err: any) => console.error('Failed to load team leaders:', err)
    });
  }

  loadManagers(): void {
    this.superAdminService.getUsersByRole('manager').subscribe({
      next: (data: any[]) => this.managers.set(data || []),
      error: (err: any) => console.error('Failed to load managers:', err)
    });
  }

  loadBusinessHeads(): void {
    this.superAdminService.getUsersByRole('business_head').subscribe({
      next: (data: any[]) => this.businessHeads.set(data || []),
      error: (err: any) => console.error('Failed to load business heads:', err)
    });
  }

  loadClusterManagers(): void {
    this.superAdminService.getUsersByRole('cluster_manager').subscribe({
      next: (data: any[]) => this.clusterManagers.set(data || []),
      error: (err: any) => console.error('Failed to load cluster managers:', err)
    });
  }

  loadSuperAdmins(): void {
    this.superAdminService.getUsersByRole('super_admin').subscribe({
      next: (data: any[]) => this.superAdmins.set(data || []),
      error: (err: any) => console.error('Failed to load super admins:', err)
    });
  }

  // Check if a role needs a reporting person
  needsReportingPerson(role: string): boolean {
    return ['recruiter', 'team_leader', 'business_head', 'cluster_manager'].includes(role);
  }

  // Get reporting persons based on role
  getReportingPersons(role: string): any[] {
    switch (role) {
      case 'recruiter':
        return this.teamLeaders();
      case 'team_leader':
        return this.managers();
      case 'business_head':
        return this.clusterManagers();
      case 'cluster_manager':
        return this.superAdmins();
      default:
        return [];
    }
  }


  // Toggle role dropdown visibility
  toggleRoleDropdown(user: any, event: Event): void {
    // Close all other dropdowns first
    this.pendingUsers().forEach((u: any) => {
      if (u !== user) {
        u.showRoleDropdown = false;
      }
    });
    
    // Toggle current dropdown
    user.showRoleDropdown = !user.showRoleDropdown;
    
    if (user.showRoleDropdown) {
      // Calculate position for fixed dropdown
      const trigger = event.target as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      const dropdown = document.querySelector('.superadmin-role-checkboxes') as HTMLElement;
      
      if (dropdown) {
        // Position dropdown below the trigger
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.right = 'auto';
        dropdown.style.width = `${Math.max(rect.width, 200)}px`;
      }
    }
  }

  // Handle role selection from checkbox
  setRoleFromCheckbox(user: any, role: string): void {
    user.role = role;
    user.reporting_to = '';
    user.showRoleDropdown = false; // Close dropdown after selection
    
    // Update the role in the backend without refreshing the page
    this.superAdminService.setUserRole(user.id, role).subscribe({
      next: (res) => {
        console.log('Role updated successfully:', res.message);
        // Don't refresh the page, just update the local state
      },
      error: (err) => {
        console.error('Role update failed:', err);
        // Revert the role if update failed
        user.role = '';
      }
    });
  }

  logout(): void {
    this.superAdminService.logout();
    this.router.navigate(['/superadmin/login']);
  }
}
