import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../environments/environment';

export interface TeamLeaderAuthResponse {
  access_token: string;
  token_type: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class TeamLeaderService {
  private http = inject(HttpClient);
  private api = environment.apiBase;

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

  // Dashboard methods (no filters)
  getKeyHighlights(): Observable<{ total_submissions: number; current_demand: number; number_of_recruiters: number }> {
    return this.http.get<{ total_submissions: number; current_demand: number; number_of_recruiters: number }>(
      `${this.api}/teamleader/dashboard/key-highlights`, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDailySubmissionsTrend(startDate?: string, endDate?: string): Observable<{ daily_trend: Array<{ date: string; count: number; recruiters?: Array<{ recruiter_name: string; count: number }> }> }> {
    let url = `${this.api}/teamleader/dashboard/daily-submissions-trend`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ daily_trend: Array<{ date: string; count: number; recruiters?: Array<{ recruiter_name: string; count: number }> }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByRecruiters(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ recruiter_id: number; recruiter_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/teamleader/dashboard/demand-by-recruiters`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ distribution: Array<{ recruiter_id: number; recruiter_name: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByStatus(startDate?: string, endDate?: string): Observable<{ status_counts: Array<{ status: string; count: number }> }> {
    let url = `${this.api}/teamleader/dashboard/demand-by-status`;
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
    let url = `${this.api}/teamleader/dashboard/demand-by-skill`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ skill_distribution: Array<{ skill: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getSubmissionsByRecruiters(startDate?: string, endDate?: string): Observable<{ recruiter_submissions: Array<{ recruiter_id: number; recruiter_name: string; count: number }> }> {
    let url = `${this.api}/teamleader/dashboard/submissions-by-recruiters`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ recruiter_submissions: Array<{ recruiter_id: number; recruiter_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandBySpocs(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ spoc_id: number; spoc_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/teamleader/dashboard/demand-by-spocs`;
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
    let url = `${this.api}/teamleader/dashboard/submissions-by-spocs`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ spoc_submissions: Array<{ spoc_id: number; spoc_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getAvailableYears(): Observable<{ years: number[] }> {
    return this.http.get<{ years: number[] }>(
      `${this.api}/teamleader/dashboard/available-years`, 
      { headers: this.getAuthHeaders() }
    );
  }

  // Update demand status with spoc_remark
  updateDemandStatus(demandId: number, status: string, spocRemark?: string): Observable<any> {
    return this.http.post<any>(
      `${this.api}/demand/${demandId}/status`,
      {
        status: status,
        spoc_remark: spocRemark || null
      },
      { headers: this.getAuthHeaders() }
    );
  }
}


