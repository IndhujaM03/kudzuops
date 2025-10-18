import { Routes } from '@angular/router';

// Standalone layout component for recruiter area
import { RecruiterComponent } from './recruiter.component';

export const recruiterRoutes: Routes = [
  {
    path: '',
    component: RecruiterComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'demands',
        loadComponent: () => import('./demand-management/demand-management.component').then(m => m.DemandManagementComponent)
      },
      {
        path: 'activity/:demandId',
        loadComponent: () => import('./recruiter-activity.component').then(m => m.RecruiterActivityComponent),
        data: { hideSidebar: true }
      },
      {
        path: 'activity/:recruiterId/:demandId',
        loadComponent: () => import('./recruiter-activity.component').then(m => m.RecruiterActivityComponent),
        data: { hideSidebar: true }
      },
      {
        path: 'submitted',
        loadComponent: () => import('./submitted/submitted.component').then(m => m.SubmittedComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'interview-schedule',
        loadComponent: () => import('./interview-schedule/interview-schedule.component').then(m => m.InterviewScheduleComponent)
      }
    ]
  }
];


