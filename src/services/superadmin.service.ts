import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { environment } from '../environments/environment';

export interface PendingUser {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  reporting_to?: number | '';
  showRoleDropdown?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private http = inject(HttpClient);
  private api = environment.apiBase;
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || '';
    const type = localStorage.getItem('token_type') || 'bearer';
    return new HttpHeaders({ 'Authorization': `${type} ${token}` });
  }

  // Dashboard methods
  getKeyHighlights(): Observable<{ total_submissions: number; current_demand: number; number_of_managers: number }> {
    return this.http.get<{ total_submissions: number; current_demand: number; number_of_managers: number }>(
      `${this.api}/superadmin/dashboard/key-highlights`, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDailySubmissionsTrend(startDate?: string, endDate?: string): Observable<{ daily_trend: Array<{ date: string; count: number; managers?: Array<{ manager_name: string; count: number }> }> }> {
    let url = `${this.api}/superadmin/dashboard/daily-submissions-trend`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ daily_trend: Array<{ date: string; count: number; managers?: Array<{ manager_name: string; count: number }> }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByManagers(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ manager_id: number; manager_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/superadmin/dashboard/demand-by-managers`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ distribution: Array<{ manager_id: number; manager_name: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByStatus(startDate?: string, endDate?: string): Observable<{ status_counts: Array<{ status: string; count: number }> }> {
    let url = `${this.api}/superadmin/dashboard/demand-by-status`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ status_counts: Array<{ status: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandBySkill(startDate?: string, endDate?: string): Observable<{ skill_distribution: Array<{ skill: string; count: number; percentage: number }> }> {
    let url = `${this.api}/superadmin/dashboard/demand-by-skill`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ skill_distribution: Array<{ skill: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getSubmissionsByManagers(startDate?: string, endDate?: string): Observable<{ manager_submissions: Array<{ manager_id: number; manager_name: string; count: number }> }> {
    let url = `${this.api}/superadmin/dashboard/submissions-by-managers`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ manager_submissions: Array<{ manager_id: number; manager_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandBySpocs(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ spoc_id: number; spoc_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/superadmin/dashboard/demand-by-spocs`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ distribution: Array<{ spoc_id: number; spoc_name: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getSubmissionsBySpocs(startDate?: string, endDate?: string): Observable<{ spoc_submissions: Array<{ spoc_id: number; spoc_name: string; count: number }> }> {
    let url = `${this.api}/superadmin/dashboard/submissions-by-spocs`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ spoc_submissions: Array<{ spoc_id: number; spoc_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  // Session helpers
  logout(): void {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token_type');
      localStorage.removeItem('expires_at');
    } catch {}
  }

  // Pending approvals
  getPendingCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${this.api}/superadmin/pending-approvals/count`,
      { headers: this.getAuthHeaders() }
    );
  }

  getPendingUsers(): Observable<PendingUser[]> {
    return this.http.get<PendingUser[]>(
      `${this.api}/superadmin/pending-users`,
      { headers: this.getAuthHeaders() }
    );
  }

  approveUser(userId: number, reportingTo?: number | ''): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/superadmin/approve/${userId}`,
      { reporting_to: reportingTo ?? null },
      { headers: this.getAuthHeaders() }
    );
  }

  rejectUser(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/superadmin/reject/${userId}`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  setUserRole(userId: number, role: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/superadmin/set-role/${userId}`,
      { role },
      { headers: this.getAuthHeaders() }
    );
  }

  getTeamLeaders(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.api}/users?role=team_leader`,
      { headers: this.getAuthHeaders() }
    );
  }

  getUsersByRole(role: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.api}/users?role=${encodeURIComponent(role)}`,
      { headers: this.getAuthHeaders() }
    );
  }

  updateUserReportingTo(userId: number, reportingTo: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.api}/superadmin/update-user-reporting-to`,
      { user_id: userId, reporting_to: reportingTo },
      { headers: this.getAuthHeaders() }
    );
  }
}
