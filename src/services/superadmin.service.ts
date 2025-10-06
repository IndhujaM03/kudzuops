import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PendingUser {
  id: number;
  email: string;
  role: string;
  approval_status: boolean;
}

export interface SuperAdminAuthResponse {
  access_token: string;
  token_type: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class SuperAdminService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8000';
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('superadmin_token') || localStorage.getItem('access_token');
    const type = localStorage.getItem('superadmin_token_type') || localStorage.getItem('token_type') || 'bearer';
    return new HttpHeaders({ 'Authorization': `${type} ${token}` });
  }

  login(email: string, password: string): Observable<SuperAdminAuthResponse> {
    return this.http.post<SuperAdminAuthResponse>(`${this.api}/superadmin/login`, { email, password });
  }

  getPendingUsers(): Observable<PendingUser[]> {
    return this.http.get<PendingUser[]>(`${this.api}/superadmin/pending-users`, { headers: this.getAuthHeaders() });
  }

  approveUser(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/superadmin/approve/${userId}`, {}, { headers: this.getAuthHeaders() });
  }

  rejectUser(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/superadmin/reject/${userId}`, {}, { headers: this.getAuthHeaders() });
  }

  setUserRole(userId: number, role: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/superadmin/set-role/${userId}`, { role }, { headers: this.getAuthHeaders() });
  }

  isSuperAdminLoggedIn(): boolean {
    const token = localStorage.getItem('superadmin_token');
    return !!token;
  }

  logout(): void {
    localStorage.removeItem('superadmin_token');
    localStorage.removeItem('superadmin_token_type');
  }

  storeAuth(response: SuperAdminAuthResponse): void {
    localStorage.setItem('superadmin_token', response.access_token);
    localStorage.setItem('superadmin_token_type', response.token_type || 'bearer');
  }
}
