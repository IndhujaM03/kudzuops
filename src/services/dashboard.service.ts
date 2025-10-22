import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface DashboardSummary {
  openDemands: number;
  closedDemands: number;
  totalDemands: number;
  totalUploads: number;
  totalApprovals: number;
  totalRejections: number;
  totalRequired: number;
}

export interface DemandData {
  demand_id: number;
  title: string;
  job_description?: string;
  required_cv_count: number;
  uploaded_cv_count: number;
  status: string;
  assigned_date?: string;
  client_name?: string;
  approved_cv_count: number;
}

export interface TimeSeriesData {
  date: string;
  uploads: number;
  approvals: number;
  rejections: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  demands: DemandData[];
  timeSeries: TimeSeriesData[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiBase || 'http://localhost:8000';

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    return new HttpHeaders({
      'Authorization': `${tokenType} ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getDashboardSummary(recruiterId: number): Observable<{summary: DashboardSummary}> {
    return this.http.get<{summary: DashboardSummary}>(
      `${this.apiUrl}/recruiter/${recruiterId}/dashboard/summary`,
      { headers: this.getAuthHeaders() }
    );
  }

  getDashboardDemands(recruiterId: number): Observable<{demands: DemandData[]}> {
    return this.http.get<{demands: DemandData[]}>(
      `${this.apiUrl}/recruiter/${recruiterId}/dashboard/demands`,
      { headers: this.getAuthHeaders() }
    );
  }

  getDashboardTimeSeries(recruiterId: number, days: number = 30): Observable<{timeSeries: TimeSeriesData[]}> {
    return this.http.get<{timeSeries: TimeSeriesData[]}>(
      `${this.apiUrl}/recruiter/${recruiterId}/dashboard/timeseries?days=${days}`,
      { headers: this.getAuthHeaders() }
    );
  }

  testDashboardConnection(recruiterId: number): Observable<any> {
    const url = `${this.apiUrl}/recruiter/${recruiterId}/dashboard/test`;
    console.log('Testing dashboard connection:', url);
    return this.http.get<any>(url, { headers: this.getAuthHeaders() });
  }

  getCompleteDashboardData(recruiterId: number, days: number = 30): Observable<DashboardData> {
    const url = `${this.apiUrl}/recruiter/${recruiterId}/dashboard/complete?days=${days}`;
    console.log('Dashboard service calling URL:', url);
    console.log('Recruiter ID:', recruiterId, 'Type:', typeof recruiterId);
    console.log('Days:', days);
    
    return this.http.get<DashboardData>(url, { headers: this.getAuthHeaders() });
  }
}
