import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { provideRouter, Routes, CanActivateFn, Router, UrlTree, RouterOutlet } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';

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
import { ViewDemandComponent } from './components/teamleader/view-demand.component';
import { ToastContainerComponent } from './shared/components/toast-container.component';
import { DebugAuthComponent } from './components/debug-auth.component';
import { DemandSheetComponent } from './app/demand/demand_sheet';
import { ClientSettingsComponent } from './components/clientsettings';
import { RecruiterComponent } from './components/recruiter/recruiter.component';
import { RecruiterDashboardComponent } from './components/recruiter/recruiter-dashboard/recruiter-dashboard.component';
import { DemandManagementComponent } from './components/recruiter/demand-management/demand-management.component';
import { RecruiterActivityComponent } from './components/recruiter/recruiter-activity.component';
import { SubmittedComponent } from './components/recruiter/submitted/submitted.component';
import { SettingsComponent } from './components/recruiter/settings/settings.component';
import { InterviewScheduleComponent } from './components/recruiter/interview-schedule/interview-schedule.component';

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
  imports: [RouterOutlet, ToastContainerComponent, CommonModule],
  template: `
    <router-outlet></router-outlet>
    <app-toast-container></app-toast-container>
  `
})
class AppRoot implements OnInit {
  private router = inject(Router);
  
  ngOnInit() {
    // On app startup, check if user is already logged in
    this.initializeAuthState();
  }
  
  private initializeAuthState() {
    const token = localStorage.getItem('access_token');
    
    // If no token, let the guards handle redirect to signin
    if (!token) {
      console.log('🚫 No token found in localStorage');
      return;
    }
    
    try {
      // Parse and validate the token
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Check if token is expired
      if (payload.exp && payload.exp < Date.now() / 1000) {
        console.log('⏰ Token expired, clearing localStorage');
        this.clearLocalStorage();
        return;
      }
      
      // Extract and store recruiter_id if not already stored
      if (!localStorage.getItem('recruiter_id')) {
        const recruiterId = payload.uid || payload.user_id || payload.id;
        if (recruiterId) {
          localStorage.setItem('recruiter_id', recruiterId.toString());
          console.log('✅ Restored recruiter_id from token:', recruiterId);
        }
      }
      
      // Determine the user's role and redirect if needed
      const userRole = payload.role?.toLowerCase();
      const currentPath = window.location.pathname;
      
      console.log('🔐 Auth state restored for role:', userRole);
      console.log('📍 Current path:', currentPath);
      
      // Don't redirect if already on a protected route
      if (currentPath.startsWith('/signin') || currentPath.startsWith('/signup') || currentPath.startsWith('/verify')) {
        // If user is logged in and on auth pages, redirect to their dashboard
        this.redirectToRoleBasedDashboard(userRole);
      }
      
    } catch (error) {
      console.error('❌ Error initializing auth state:', error);
      this.clearLocalStorage();
    }
  }
  
  private redirectToRoleBasedDashboard(role: string) {
    if (role === 'super_admin') {
      this.router.navigate(['/superadmin/dashboard']).catch(() => {});
    } else if (role === 'team_leader' || role === 'teamleader' || role === 'team_leadr' || role === 'tl') {
      this.router.navigate(['/teamleader/dashboard']).catch(() => {});
    } else if (role === 'recruiter') {
      this.router.navigate(['/recruiter/dashboard']).catch(() => {});
    } else if (role === 'candidate') {
      this.router.navigate(['/dashboard']).catch(() => {});
    }
  }
  
  private clearLocalStorage() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('recruiter_id');
  }
}

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
      'team_leader': ['team_leader', 'teamleader', 'team_leadr', 'tl'],
      'recruiter': ['recruiter'],
      'candidate': ['candidate']
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
      } else if (userRole === 'team_leader' || userRole === 'teamleader' || userRole === 'team_leadr' || userRole === 'tl') {
        console.log('🔄 Redirecting team leader to dashboard');
        return router.parseUrl('/teamleader/dashboard') as UrlTree;
      } else if (userRole === 'recruiter') {
        console.log('🔄 Redirecting recruiter to dashboard');
        return router.parseUrl('/recruiter/dashboard') as UrlTree;
      } else if (userRole === 'candidate') {
        console.log('🔄 Redirecting candidate to dashboard');
        return router.parseUrl('/dashboard') as UrlTree;
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
      } else if (userRole === 'team_leader' || userRole === 'teamleader' || userRole === 'team_leadr' || userRole === 'tl') {
        return router.parseUrl('/teamleader/dashboard') as UrlTree;
    } else if (userRole === 'recruiter') {
      return router.parseUrl('/recruiter/dashboard') as UrlTree;
    } else if (userRole === 'candidate') {
      return router.parseUrl('/dashboard') as UrlTree;
    } else {
      // For unknown roles, show a generic dashboard
      return router.parseUrl('/dashboard') as UrlTree;
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
  { path: 'debug-auth', component: DebugAuthComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [rootRedirectGuard] },
  { path: 'demand/create', component: DemandSheetComponent, canActivate: [authGuard] },
  {
    path: 'superadmin',
    component: SuperAdminLayoutComponent,
    canActivate: [roleGuard('super_admin')],
    children: [
      { path: 'dashboard', component: SuperAdminDashboardComponent },
      { path: 'pending-approvals', component: SuperAdminDashboardComponent },
      { path: 'client-settings/client', component: ClientSettingsComponent },
      { path: 'client-settings/spoc', component: ClientSettingsComponent },
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
      { path: 'dashboard', component: TeamLeaderDashboardComponent },
      { path: 'demand-sheet', component: DemandSheetComponent },
      { path: 'view-demand', component: ViewDemandComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'recruiter',
    component: RecruiterComponent,
    canActivate: [roleGuard('recruiter')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: RecruiterDashboardComponent
      },
      {
        path: 'demands',
        component: DemandManagementComponent
      },
      {
        path: 'activity/:demandId',
        component: RecruiterActivityComponent,
        data: { hideSidebar: true }
      },
      {
        path: 'activity/:recruiterId/:demandId',
        component: RecruiterActivityComponent,
        data: { hideSidebar: true }
      },
      {
        path: 'submitted',
        component: SubmittedComponent
      },
      {
        path: 'settings',
        component: SettingsComponent
      },
      {
        path: 'interview-schedule',
        component: InterviewScheduleComponent
      }
    ]
  },
  { path: '', pathMatch: 'full', canActivate: [rootRedirectGuard], children: [] },
  { path: '**', redirectTo: '/signin' }
];

bootstrapApplication(AppRoot, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
});