import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SuperAdminService } from '../../services/superadmin.service';

interface User {
  id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  role: string;
  reporting_to?: number | null;
  reporting_to_name?: string;
}

type RoleTab = 'recruiter' | 'team_leader' | 'manager' | 'business_head' | 'cluster_manager' | 'super_admin' | 'hr' | 'all';

@Component({
  selector: 'app-superadmin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2 class="superadmin-section-title">Users Management</h2>
    <div class="superadmin-card superadmin-card-elevated">
      <!-- Role Tabs -->
      <div class="superadmin-tabs">
        <button 
          *ngFor="let tab of roleTabs"
          class="superadmin-tab"
          [class.active]="activeTab() === tab.value"
          (click)="setActiveTab(tab.value)">
          {{ tab.label }}
        </button>
      </div>

      <!-- Search Filter -->
      <div class="superadmin-search-container">
        <input 
          type="text" 
          class="superadmin-search-input"
          placeholder="Search by name or email..."
          [(ngModel)]="searchQuery"
          (input)="onSearchChange()">
      </div>

      <!-- Users Table -->
      <div *ngIf="filteredUsers().length === 0" class="superadmin-empty-state">
        <div class="superadmin-empty-icon">👥</div>
        <h3 class="superadmin-empty-title">No users found</h3>
        <p class="superadmin-empty-description">{{ searchQuery ? 'No users match your search criteria.' : 'No approved users in the system.' }}</p>
      </div>

      <div *ngIf="filteredUsers().length > 0" class="superadmin-table-container">
        <table class="superadmin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Reporting To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of paginatedUsers()">
              <td>{{ getUserDisplayName(user) }}</td>
              <td>{{ user.email }}</td>
              <td>
                <span class="superadmin-role-badge">{{ user.role ? (user.role | titlecase) : 'N/A' }}</span>
              </td>
              <td>
                <div *ngIf="user.reporting_to_name; else noReporting">
                  {{ user.reporting_to_name }}
                </div>
                <ng-template #noReporting>
                  <span class="superadmin-no-reporting">Not Assigned</span>
                </ng-template>
              </td>
              <td>
                <button 
                  class="superadmin-edit-btn"
                  (click)="openEditModal(user)"
                  title="Edit User">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div *ngIf="filteredUsers().length > 0" class="superadmin-pagination">
        <div class="superadmin-pagination-info">
          Showing {{ startIndex() + 1 }} - {{ endIndex() }} of {{ filteredUsers().length }} users
        </div>
        <div class="superadmin-pagination-controls">
          <button 
            class="superadmin-pagination-btn"
            [disabled]="currentPage() === 1"
            (click)="goToPage(currentPage() - 1)">
            Previous
          </button>
          <div class="superadmin-pagination-pages">
            <button 
              *ngFor="let page of visiblePages()"
              class="superadmin-pagination-page"
              [class.active]="page === currentPage()"
              [class.ellipsis]="page === -1"
              (click)="goToPage(page)"
              [disabled]="page === -1">
              {{ page === -1 ? '...' : page }}
            </button>
          </div>
          <button 
            class="superadmin-pagination-btn"
            [disabled]="currentPage() === totalPages()"
            (click)="goToPage(currentPage() + 1)">
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div *ngIf="showEditModal" class="superadmin-modal-overlay" (click)="closeEditModal()">
      <div class="superadmin-modal" (click)="$event.stopPropagation()">
        <div class="superadmin-modal-header">
          <h3>Edit User</h3>
          <button class="superadmin-modal-close" (click)="closeEditModal()">×</button>
        </div>
        <div class="superadmin-modal-body" *ngIf="selectedUserForEdit">
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Name</label>
            <input 
              type="text" 
              class="superadmin-form-input"
              [value]="getUserDisplayName(selectedUserForEdit)"
              readonly
              disabled>
          </div>
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Role</label>
            <input 
              type="text" 
              class="superadmin-form-input"
              [value]="selectedUserForEdit.role ? (selectedUserForEdit.role | titlecase) : 'N/A'"
              readonly
              disabled>
          </div>
          <div class="superadmin-form-group">
            <label class="superadmin-form-label">Reporting To</label>
            <select 
              [(ngModel)]="selectedReportingTo" 
              class="superadmin-form-select"
              [disabled]="!needsReportingPerson(selectedUserForEdit.role)">
              <option [ngValue]="null" *ngIf="needsReportingPerson(selectedUserForEdit.role)">Not Assigned</option>
              <option 
                *ngFor="let person of getReportingPersons(selectedUserForEdit.role)" 
                [ngValue]="person.id">
                {{ getUserDisplayName(person) }} ({{ person.role | titlecase }})
              </option>
              <option *ngIf="!needsReportingPerson(selectedUserForEdit.role)" [ngValue]="null">N/A</option>
            </select>
          </div>
        </div>
        <div class="superadmin-modal-footer">
          <button class="superadmin-btn superadmin-btn-secondary" (click)="closeEditModal()">Cancel</button>
          <button 
            class="superadmin-btn superadmin-btn-approve" 
            (click)="saveUserEdit()"
            [disabled]="!canSaveEdit()">
            Save
          </button>
        </div>
      </div>
    </div>

  `,
  styles: [`
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

    /* Tabs */
    .superadmin-tabs {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .superadmin-tab {
      padding: 8px 16px;
      border: none;
      background: transparent;
      color: #4a5568;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
    }

    .superadmin-tab:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .superadmin-tab.active {
      color: var(--kudzu-primary);
      border-bottom-color: var(--kudzu-primary);
      background: rgba(102, 126, 234, 0.05);
    }

    /* Search */
    .superadmin-search-container {
      padding: 16px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .superadmin-search-input {
      width: 100%;
      max-width: 400px;
      padding: 10px 16px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      color: #2d3748;
      transition: border-color 0.2s ease;
    }

    .superadmin-search-input:focus {
      outline: none;
      border-color: var(--kudzu-primary);
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .superadmin-search-input::placeholder {
      color: #a0aec0;
    }

    /* Table */
    .superadmin-table-container {
      overflow-x: auto;
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
    }

    .superadmin-table tr:hover {
      background: #f8fafc;
    }

    .superadmin-role-badge {
      display: inline-block;
      padding: 6px 12px;
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #2d3748;
      text-transform: capitalize;
    }

    .superadmin-no-reporting {
      color: #6b7280;
      font-style: italic;
      font-size: 14px;
    }

    /* Edit Button */
    .superadmin-edit-btn {
      background: none;
      border: none;
      color: #4a5568;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .superadmin-edit-btn:hover {
      background: #f7fafc;
      color: var(--kudzu-primary);
    }

    .superadmin-edit-btn svg {
      display: block;
    }

    /* Pagination */
    .superadmin-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 16px;
    }

    .superadmin-pagination-info {
      font-size: 14px;
      color: #4a5568;
    }

    .superadmin-pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .superadmin-pagination-btn {
      padding: 8px 16px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #4a5568;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .superadmin-pagination-btn:hover:not(:disabled) {
      background: #f7fafc;
      border-color: var(--kudzu-primary);
      color: var(--kudzu-primary);
    }

    .superadmin-pagination-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .superadmin-pagination-pages {
      display: flex;
      gap: 4px;
    }

    .superadmin-pagination-page {
      min-width: 36px;
      height: 36px;
      padding: 0 12px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #4a5568;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .superadmin-pagination-page:hover {
      background: #f7fafc;
      border-color: var(--kudzu-primary);
    }

    .superadmin-pagination-page.active {
      background: var(--kudzu-primary);
      color: white;
      border-color: var(--kudzu-primary);
    }

    .superadmin-pagination-page.ellipsis {
      border: none;
      background: transparent;
      cursor: default;
      min-width: auto;
      padding: 0 8px;
    }

    .superadmin-pagination-page.ellipsis:hover {
      background: transparent;
      border: none;
    }

    /* Buttons */
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

    .superadmin-btn-secondary {
      background: #e2e8f0;
      color: #2d3748;
    }

    .superadmin-btn-secondary:hover {
      background: #cbd5e0;
    }

    .superadmin-btn-approve {
      background: var(--kudzu-primary);
      color: white;
    }

    .superadmin-btn-approve:hover {
      background: var(--kudzu-primary-dark);
    }

    .superadmin-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Empty State */
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

    /* Modal Styles */
    .superadmin-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .superadmin-modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    }

    .superadmin-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
    }

    .superadmin-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #2d3748;
    }

    .superadmin-modal-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #718096;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }

    .superadmin-modal-close:hover {
      background: #f7fafc;
      color: #2d3748;
    }

    .superadmin-modal-body {
      padding: 24px;
    }

    .superadmin-modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 20px 24px;
      border-top: 1px solid #e2e8f0;
    }

    /* Form Styles */
    .superadmin-form-group {
      margin-bottom: 20px;
    }

    .superadmin-form-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 8px;
    }

    .superadmin-form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      color: #2d3748;
      background: #f7fafc;
      cursor: not-allowed;
    }

    .superadmin-form-input:disabled {
      opacity: 0.7;
    }

    .superadmin-form-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-size: 14px;
      color: #2d3748;
      background: white;
      cursor: pointer;
      transition: border-color 0.2s ease;
    }

    .superadmin-form-select:focus {
      outline: none;
      border-color: var(--kudzu-primary);
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .superadmin-form-select:disabled {
      background: #f7fafc;
      cursor: not-allowed;
      opacity: 0.7;
    }

  `]
})
export class SuperAdminUsersComponent implements OnInit {
  private superAdminService = inject(SuperAdminService);
  private router = inject(Router);

  allUsers = signal<User[]>([]);
  private userDirectory = new Map<number, any>();
  
  // Reporting persons data
  teamLeaders = signal<any[]>([]);
  managers = signal<any[]>([]);
  businessHeads = signal<any[]>([]);
  clusterManagers = signal<any[]>([]);
  superAdmins = signal<any[]>([]);

  // Tabs
  roleTabs = [
    { label: 'All', value: 'all' as RoleTab },
    { label: 'Recruiter', value: 'recruiter' as RoleTab },
    { label: 'TL', value: 'team_leader' as RoleTab },
    { label: 'Manager', value: 'manager' as RoleTab },
    { label: 'Business Head', value: 'business_head' as RoleTab },
    { label: 'Cluster Manager', value: 'cluster_manager' as RoleTab },
    { label: 'Super Admin', value: 'super_admin' as RoleTab },
    { label: 'HR', value: 'hr' as RoleTab }
  ];
  activeTab = signal<RoleTab>('all');

  // Search
  searchQuery = '';

  // Pagination
  currentPage = signal(1);
  itemsPerPage = 10;

  // Modal state
  showEditModal = false;
  selectedUserForEdit: User | null = null;
  selectedReportingTo: number | null = null;
  originalReportingTo: number | null = null;

  // Computed values
  filteredUsers = computed(() => {
    let users = this.allUsers();
    
    // Exclude candidates (safety filter)
    users = users.filter(u => u.role && u.role.toLowerCase() !== 'candidate');
    
    // Filter by active tab first
    if (this.activeTab() !== 'all') {
      users = users.filter(u => {
        // Normalize role comparison
        const userRole = (u.role || '').toLowerCase();
        const activeTab = this.activeTab().toLowerCase();
        return userRole === activeTab;
      });
    }
    
    // Filter by search query (applies to filtered tab results)
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      users = users.filter(u => {
        const name = this.getUserDisplayName(u).toLowerCase();
        const email = (u.email || '').toLowerCase();
        const role = (u.role || '').toLowerCase();
        // Search across name, email, and role
        return name.includes(query) || email.includes(query) || role.includes(query);
      });
    }
    
    return users;
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredUsers().length / this.itemsPerPage);
  });

  startIndex = computed(() => {
    return (this.currentPage() - 1) * this.itemsPerPage;
  });

  endIndex = computed(() => {
    return Math.min(this.startIndex() + this.itemsPerPage, this.filteredUsers().length);
  });

  paginatedUsers = computed(() => {
    const start = this.startIndex();
    const end = this.endIndex();
    return this.filteredUsers().slice(start, end);
  });

  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    
    if (total <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, current page, and last page with ellipsis
      pages.push(1);
      
      if (current > 3) {
        pages.push(-1); // -1 represents ellipsis
      }
      
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        if (i !== 1 && i !== total) {
          pages.push(i);
        }
      }
      
      if (current < total - 2) {
        pages.push(-1); // -1 represents ellipsis
      }
      
      pages.push(total);
    }
    
    return pages;
  });

  ngOnInit(): void {
    this.loadUsersForTab(this.activeTab());
    this.loadReportingPersons();
  }

  setActiveTab(tab: RoleTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1); // Reset to first page when changing tabs
    this.loadUsersForTab(tab);
  }

  onSearchChange(): void {
    this.currentPage.set(1); // Reset to first page when searching
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages() && page !== -1) {
      this.currentPage.set(page);
    }
  }

  loadUsersForTab(tab: RoleTab): void {
    const roleParam = tab === 'all' ? '' : tab;
    this.superAdminService.getUsersByRole(roleParam).subscribe({
      next: (usersData: any[]) => {
        if (tab === 'all') {
          this.buildUserDirectory(usersData, true);
        } else if (this.userDirectory.size === 0) {
          this.buildUserDirectory(usersData, true);
        } else {
          this.buildUserDirectory(usersData);
        }
        this.allUsers.set(this.processUsers(usersData));
      },
      error: (err: any) => {
        console.error('Failed to load users:', err);
        this.allUsers.set([]);
      }
    });
  }

  private buildUserDirectory(usersData: any[], replace = false): void {
    if (replace) {
      this.userDirectory.clear();
    }
    (usersData || []).forEach(user => {
      if (user?.id) {
        this.userDirectory.set(user.id, user);
      }
    });
  }

  private processUsers(usersData: any[]): User[] {
    const approvedUsers = (usersData || []).filter(u => {
      return u.role && u.role !== '' && u.role !== null && u.role.toLowerCase() !== 'candidate';
    });

    const processedUsers: User[] = approvedUsers.map(u => {
      const user: User = {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        role: u.role,
        reporting_to: u.reporting_to || null
      };

      if (user.reporting_to) {
        const reportingUser = this.userDirectory.get(user.reporting_to);
        if (reportingUser) {
          user.reporting_to_name = this.getUserDisplayName(reportingUser);
        }
      }

      return user;
    });

    processedUsers.sort((a, b) => {
      if (a.role !== b.role) {
        return a.role.localeCompare(b.role);
      }
      return this.getUserDisplayName(a).localeCompare(this.getUserDisplayName(b));
    });

    return processedUsers;
  }

  getUserDisplayName(user: any): string {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`.trim();
    }
    if (user.first_name) {
      return user.first_name;
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return 'Unknown';
  }

  needsReportingPerson(role: string | undefined): boolean {
    if (!role) return false;
    return ['recruiter', 'team_leader', 'manager', 'business_head', 'cluster_manager'].includes(role);
  }

  getReportingPersons(role: string | undefined): any[] {
    if (!role) return [];
    switch (role) {
      case 'recruiter':
        return this.teamLeaders();
      case 'team_leader':
        return this.managers();
      case 'manager':
        const businessHeads = this.businessHeads();
        const superAdmins = this.superAdmins();
        return [...businessHeads, ...superAdmins];
      case 'business_head':
        return this.clusterManagers();
      case 'cluster_manager':
        return this.superAdmins();
      default:
        return [];
    }
  }

  openEditModal(user: User): void {
    this.selectedUserForEdit = user;
    this.selectedReportingTo = user.reporting_to || null;
    this.originalReportingTo = user.reporting_to || null;
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedUserForEdit = null;
    this.selectedReportingTo = null;
    this.originalReportingTo = null;
  }

  canSaveEdit(): boolean {
    if (!this.selectedUserForEdit) return false;
    
    // For roles that don't need reporting person, always allow save (even if disabled)
    if (!this.needsReportingPerson(this.selectedUserForEdit.role)) {
      return true;
    }
    
    // For roles that need reporting person, check if value changed
    return this.selectedReportingTo !== this.originalReportingTo;
  }

  saveUserEdit(): void {
    if (!this.selectedUserForEdit) return;

    // If role doesn't need reporting person, just close
    if (!this.needsReportingPerson(this.selectedUserForEdit.role)) {
      this.closeEditModal();
      return;
    }

    // If reporting to hasn't changed, just close
    if (this.selectedReportingTo === this.originalReportingTo) {
      this.closeEditModal();
      return;
    }

    // Update reporting to
    if (this.selectedReportingTo === null) {
      // Handle null case - might need to clear reporting_to
      this.closeEditModal();
      return;
    }

    this.updateUserReportingTo(this.selectedUserForEdit.id, this.selectedReportingTo);
    this.closeEditModal();
  }

  updateUserReportingTo(userId: number, reportingTo: number): void {
    // Call backend API to update reporting_to
    this.superAdminService.updateUserReportingTo(userId, reportingTo).subscribe({
      next: (res: any) => {
        console.log('Reporting To updated successfully:', res.message);
        this.refreshUserDirectory();
        this.loadUsersForTab(this.activeTab()); // Reload to refresh data
      },
      error: (err: any) => {
        console.error('Failed to update Reporting To:', err);
        alert('Failed to update Reporting To. Please try again.');
      }
    });
  }

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

  private refreshUserDirectory(): void {
    this.superAdminService.getUsersByRole('').subscribe({
      next: (usersData: any[]) => this.buildUserDirectory(usersData, true),
      error: (err: any) => console.error('Failed to refresh user directory:', err)
    });
  }
}

