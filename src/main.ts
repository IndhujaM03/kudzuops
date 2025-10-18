import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideRouter, Routes, CanActivateFn, Router, UrlTree, RouterOutlet } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

// Import your standalone login component
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/login/signup.component';
import { VerifyComponent } from './components/login/verify.component';
import { ResetPasswordComponent } from './components/login/reset-password.component';
import { VerifyResetComponent } from './components/login/verify-reset.component';
import { SuperAdminDashboardComponent } from './components/superadmin/superadmin-dashboard.component';
import { SuperAdminLayoutComponent } from './components/superadmin/superadmin-layout.component';
import { TeamLeaderLayoutComponent } from './components/teamleader/teamleader-layout.component';
import { TeamLeaderDashboardComponent } from './components/teamleader/teamleader-dashboard.component';

// Simple protected Dashboard (same UI style)
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-100">
      <header class="bg-white shadow-sm border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div class="text-2xl font-bold text-green-600">Kudzu</div>
          <button (click)="logout()" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm">
            Logout
              </button>
        </div>
      </header>
      <main class="max-w-4xl mx-auto p-8">
        <div class="bg-white rounded-lg shadow p-6">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome to Kudzu Dashboard</h1>
          <p class="text-gray-600">You are authenticated.</p>
        </div>
      </main>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  ngOnInit() {
    const hash = window.location.hash || '';
    const match = hash.match(/token=([^&]+)/);
    if (match && match[1]) {
      const token = decodeURIComponent(match[1]);
      if (token) {
        localStorage.setItem('access_token', token);
        localStorage.setItem('token_type', 'bearer');
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
      }
    }
  }
  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('token_type');
    this.router.navigate(['/signin']).catch(() => {});
  }
}

// Root shell that only hosts the router
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`
})
class AppRoot {}

const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    return router.parseUrl('/signin') as UrlTree;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('expires_at');
      return router.parseUrl('/signin') as UrlTree;
    }
    
    return true;
  } catch (error) {
    // If token is invalid, clear it and redirect to login
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    return router.parseUrl('/signin') as UrlTree;
  }
};

const roleGuard = (requiredRole: string): CanActivateFn => () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  
  console.log(`🔒 Role guard checking for role: ${requiredRole}`);
  console.log('🔑 Token exists:', !!token);
  
  if (!token) {
    console.log('❌ No token found, redirecting to signin');
    return router.parseUrl('/signin') as UrlTree;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userRole = payload.role?.toLowerCase();
    
    console.log('👤 User role from token:', userRole);
    console.log('🎯 Required role:', requiredRole);
    console.log('📄 Full token payload:', payload);
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.log('⏰ Token expired, clearing and redirecting to signin');
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('expires_at');
      return router.parseUrl('/signin') as UrlTree;
    }
    
    const roleMapping: { [key: string]: string[] } = {
      'super_admin': ['super_admin'],
      'team_leader': ['team_leader', 'teamleader', 'team_leadr'],
      'recruiter': ['recruiter']
    };
    
    const allowedRoles = roleMapping[requiredRole] || [requiredRole];
    const hasAccess = allowedRoles.includes(userRole);
    
    console.log('✅ Allowed roles:', allowedRoles);
    console.log('🔓 Has access:', hasAccess);
    
    if (!hasAccess) {
      console.log('🚫 Access denied, redirecting to appropriate dashboard');
      // Redirect to appropriate dashboard based on user's actual role
      if (userRole === 'super_admin') {
        console.log('🔄 Redirecting super admin to dashboard');
        return router.parseUrl('/superadmin/dashboard') as UrlTree;
      } else if (userRole === 'team_leader' || userRole === 'teamleader' || userRole === 'team_leadr') {
        console.log('🔄 Redirecting team leader to demand sheet');
        return router.parseUrl('/teamleader/demand-sheet') as UrlTree;
      } else if (userRole === 'recruiter') {
        console.log('🔄 Redirecting recruiter to dashboard');
        return router.parseUrl('/recruiter/dashboard') as UrlTree;
      } else {
        console.log('🔄 Redirecting to default dashboard');
        return router.parseUrl('/dashboard') as UrlTree;
      }
    }
    
    console.log('✅ Access granted for', requiredRole);
    return true;
  } catch (error) {
    console.error('💥 Token parsing error in role guard:', error);
    // If token is invalid, clear it and redirect to login
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    return router.parseUrl('/signin') as UrlTree;
  }
};

// Root redirect guard to handle role-based initial navigation
const rootRedirectGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    return router.parseUrl('/signin') as UrlTree;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userRole = payload.role?.toLowerCase();
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('expires_at');
      return router.parseUrl('/signin') as UrlTree;
    }
    
    // Redirect based on role
    if (userRole === 'super_admin') {
      return router.parseUrl('/superadmin/dashboard') as UrlTree;
    } else if (userRole === 'team_leader' || userRole === 'teamleader' || userRole === 'team_leadr') {
      return router.parseUrl('/teamleader/demand-sheet') as UrlTree;
    } else if (userRole === 'recruiter') {
      return router.parseUrl('/recruiter/dashboard') as UrlTree;
    } else {
      // For unknown roles, show a generic dashboard or redirect to signin
      return router.parseUrl('/signin') as UrlTree;
    }
  } catch (error) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    return router.parseUrl('/signin') as UrlTree;
  }
};

const routes: Routes = [
  { path: 'signin', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'verify', component: VerifyComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-reset', component: VerifyResetComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [rootRedirectGuard] },
  { path: 'demand/create', loadComponent: () => import('./app/demand/demand_sheet').then(m => m.DemandSheetComponent), canActivate: [authGuard] },
  {
    path: 'superadmin',
    component: SuperAdminLayoutComponent,
    canActivate: [roleGuard('super_admin')],
    children: [
      { path: 'dashboard', component: SuperAdminDashboardComponent },
      { path: 'pending-approvals', component: SuperAdminDashboardComponent },
      { path: 'client-settings/client', loadComponent: () => import('./components/clientsettings').then(m => m.ClientSettingsComponent) },
      { path: 'client-settings/spoc', loadComponent: () => import('./components/clientsettings').then(m => m.ClientSettingsComponent) },
      { path: 'client-settings', redirectTo: 'client-settings/client', pathMatch: 'full' },
      { path: 'pending-users', redirectTo: 'pending-approvals', pathMatch: 'full' },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'teamleader',
    component: TeamLeaderLayoutComponent,
    canActivate: [roleGuard('team_leader')],
    children: [
      { path: 'demand-sheet', loadComponent: () => import('./app/demand/demand_sheet').then(m => m.DemandSheetComponent) },
      { path: '', redirectTo: 'demand-sheet', pathMatch: 'full' }
    ]
  },
  {
    path: 'recruiter',
    loadComponent: () => import('./components/recruiter/recruiter.component').then(m => m.RecruiterComponent),
    canActivate: [roleGuard('recruiter')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./components/recruiter/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'demands',
        loadComponent: () => import('./components/recruiter/demand-management/demand-management.component').then(m => m.DemandManagementComponent)
      },
      {
        path: 'activity/:demandId',
        loadComponent: () => import('./components/recruiter/recruiter-activity.component').then(m => m.RecruiterActivityComponent),
        data: { hideSidebar: true }
      },
      {
        path: 'activity/:recruiterId/:demandId',
        loadComponent: () => import('./components/recruiter/recruiter-activity.component').then(m => m.RecruiterActivityComponent),
        data: { hideSidebar: true }
      },
      {
        path: 'submitted',
        loadComponent: () => import('./components/recruiter/submitted/submitted.component').then(m => m.SubmittedComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./components/recruiter/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'interview-schedule',
        loadComponent: () => import('./components/recruiter/interview-schedule/interview-schedule.component').then(m => m.InterviewScheduleComponent)
      }
    ]
  },
  { path: '', pathMatch: 'full', canActivate: [rootRedirectGuard], children: [] },
  { path: '**', redirectTo: '/signin' }
];

bootstrapApplication(AppRoot, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
  ],
});