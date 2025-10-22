import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

export interface TeamLeaderAuthResponse {
  access_token: string;
  token_type: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class TeamLeaderService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8000';

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || localStorage.getItem('teamleader_token') || '';
    const type = localStorage.getItem('token_type') || localStorage.getItem('teamleader_token_type') || 'bearer';
    return new HttpHeaders({ 'Authorization': `${type} ${token}` });
  }

  login(email: string, password: string): Observable<TeamLeaderAuthResponse> {
    // Reuse general auth login
    return this.http.post<TeamLeaderAuthResponse>(`${this.api}/auth/login`, { email, password });
  }

  storeAuth(response: TeamLeaderAuthResponse): void {
    localStorage.setItem('teamleader_token', response.access_token);
    localStorage.setItem('teamleader_token_type', response.token_type || 'bearer');
  }

  logout(): void {
    localStorage.removeItem('teamleader_token');
    localStorage.removeItem('teamleader_token_type');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('teamleader_token');
  }

  // CV Management methods
  getCvReceived(): Observable<any[]> {
    console.log('🌐 Making API call to:', `${this.api}/cv-received`);
    console.log('🔑 Auth headers:', this.getAuthHeaders());
    return this.http.get<any[]>(`${this.api}/cv-received`, { headers: this.getAuthHeaders() });
  }

  getCvSubmitted(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/cv-submitted`, { headers: this.getAuthHeaders() });
  }

  approveCv(activityId: number, cvIndex: number): Observable<any> {
    return this.http.post<any>(`${this.api}/cv-approve/${activityId}?cv_index=${cvIndex}`, {}, { headers: this.getAuthHeaders() });
  }

  rejectCv(activityId: number, cvIndex: number): Observable<any> {
    // First reject the CV using the existing endpoint
    return this.http.post<any>(`${this.api}/cv-reject/${activityId}?cv_index=${cvIndex}`, {}, { headers: this.getAuthHeaders() }).pipe(
      switchMap((rejectResponse) => {
        // Then update CV count and check for status changes
        return this.http.post<any>(`${this.api}/recruiter/update-cv-count-and-check`, {
          demand_id: rejectResponse.demand_id,
          recruiter_id: rejectResponse.recruiter_id,
          increment: -1
        }, { headers: this.getAuthHeaders() });
      })
    );
  }

  // Demand management methods
  getUnassignedDemands(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/demand/unassigned`, { headers: this.getAuthHeaders() });
  }

  getAssignedDemands(): Observable<any[]> {
    const timestamp = new Date().getTime();
    return this.http.get<any[]>(`${this.api}/demand/assigned?t=${timestamp}`, { headers: this.getAuthHeaders() });
  }

  assignDemandToRecruiters(demandId: number, recruiterIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.api}/demand/assign`, {
      demand_id: demandId,
      recruiter_ids: recruiterIds
    }, { headers: this.getAuthHeaders() });
  }
}


