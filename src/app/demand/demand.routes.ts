import { Routes } from '@angular/router';

export const demandRoutes: Routes = [
  {
    path: 'demand/create',
    loadComponent: () => import('./demand_sheet').then(m => m.DemandSheetComponent)
  }
];



