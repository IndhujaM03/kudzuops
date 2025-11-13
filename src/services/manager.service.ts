import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ManagerService {
  private http = inject(HttpClient);
  private api = environment.apiBase;

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || '';
    const type = localStorage.getItem('token_type') || 'bearer';
    return new HttpHeaders({ 'Authorization': `${type} ${token}` });
  }

  // Dashboard methods
  getKeyHighlights(): Observable<{ total_submissions: number; current_demand: number; number_of_team_leaders: number }> {
    return this.http.get<{ total_submissions: number; current_demand: number; number_of_team_leaders: number }>(
      `${this.api}/manager/dashboard/key-highlights`, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDailySubmissionsTrend(startDate?: string, endDate?: string): Observable<{ daily_trend: Array<{ date: string; count: number; team_leaders?: Array<{ team_leader_name: string; count: number }> }> }> {
    let url = `${this.api}/manager/dashboard/daily-submissions-trend`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ daily_trend: Array<{ date: string; count: number; team_leaders?: Array<{ team_leader_name: string; count: number }> }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByTeamLeaders(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ team_leader_id: number; team_leader_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/manager/dashboard/demand-by-team-leaders`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ distribution: Array<{ team_leader_id: number; team_leader_name: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByStatus(startDate?: string, endDate?: string): Observable<{ status_counts: Array<{ status: string; count: number }> }> {
    let url = `${this.api}/manager/dashboard/demand-by-status`;
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
    let url = `${this.api}/manager/dashboard/demand-by-skill`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ skill_distribution: Array<{ skill: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getSubmissionsByTeamLeaders(startDate?: string, endDate?: string): Observable<{ team_leader_submissions: Array<{ team_leader_id: number; team_leader_name: string; count: number }> }> {
    let url = `${this.api}/manager/dashboard/submissions-by-team-leaders`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ team_leader_submissions: Array<{ team_leader_id: number; team_leader_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandBySpocs(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ spoc_id: number; spoc_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/manager/dashboard/demand-by-spocs`;
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
    let url = `${this.api}/manager/dashboard/submissions-by-spocs`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ spoc_submissions: Array<{ spoc_id: number; spoc_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }
}




