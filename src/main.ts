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
import { SuperAdminLoginComponent } from './components/superadmin/superadmin-login.component';
import { SuperAdminDashboardComponent } from './components/superadmin/superadmin-dashboard.component';
import { SuperAdminLayoutComponent } from './components/superadmin/superadmin-layout.component';
import { demandRoutes } from './app/demand/demand.routes';

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
  return token ? true : (router.parseUrl('/signin') as UrlTree);
};

const superAdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = localStorage.getItem('superadmin_token');
  return token ? true : (router.parseUrl('/superadmin/login') as UrlTree);
};

const routes: Routes = [
  { path: 'signin', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'verify', component: VerifyComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-reset', component: VerifyResetComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: '', children: demandRoutes, canActivate: [authGuard] },
  { path: 'superadmin/login', component: SuperAdminLoginComponent },
  {
    path: 'superadmin',
    component: SuperAdminLayoutComponent,
    canActivate: [superAdminGuard],
    children: [
      { path: 'dashboard', component: SuperAdminDashboardComponent },
      { path: 'demand-sheet', loadComponent: () => import('./app/demand/demand_sheet').then(m => m.DemandSheetComponent) },
      { path: 'pending-approvals', loadComponent: () => import('./components/superadmin/superadmin-dashboard.component').then(m => m.SuperAdminDashboardComponent) },
      // Backward compatibility: support older link path
      { path: 'pending-users', redirectTo: 'pending-approvals', pathMatch: 'full' },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: '/signin' }
];

bootstrapApplication(AppRoot, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
  ],
});