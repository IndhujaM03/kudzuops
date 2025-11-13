import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface PendingUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  approval_status: boolean;
  reporting_to?: number;
  showRoleDropdown?: boolean;
}

export interface SuperAdminAuthResponse {
  access_token: string;
  token_type: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private http = inject(HttpClient);
  private api = environment.apiBase;
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    const type = localStorage.getItem('token_type') || 'bearer';
    console.log('🔑 SuperAdmin API using token:', !!token, 'Type:', type);
    return new HttpHeaders({ 'Authorization': `${type} ${token}` });
  }

  login(email: string, password: string): Observable<SuperAdminAuthResponse> {
    return this.http.post<SuperAdminAuthResponse>(`${this.api}/superadmin/login`, { email, password });
  }

  getPendingUsers(): Observable<PendingUser[]> {
    return this.http.get<PendingUser[]>(`${this.api}/superadmin/pending-users`, { headers: this.getAuthHeaders() });
  }

  getPendingCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.api}/superadmin/pending-approvals/count`, { headers: this.getAuthHeaders() });
  }

  getTeamLeaders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/teamleaders`, { headers: this.getAuthHeaders() });
  }

  getUsersByRole(role: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/users?role=${role}`, { headers: this.getAuthHeaders() });
  }

  approveUser(userId: number, reportingTo?: number): Observable<{ message: string }> {
    const payload = reportingTo ? { reporting_to: reportingTo } : {};
    return this.http.post<{ message: string }>(`${this.api}/superadmin/approve/${userId}`, payload, { headers: this.getAuthHeaders() });
  }

  rejectUser(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/superadmin/reject/${userId}`, {}, { headers: this.getAuthHeaders() });
  }

  setUserRole(userId: number, role: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/superadmin/set-role/${userId}`, { role }, { headers: this.getAuthHeaders() });
  }

  isSuperAdminLoggedIn(): boolean {
    const token = localStorage.getItem('access_token');
    return !!token;
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
  }

  storeAuth(response: SuperAdminAuthResponse): void {
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('token_type', response.token_type || 'bearer');
  }
}
