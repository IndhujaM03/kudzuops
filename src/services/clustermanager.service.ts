import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ClusterManagerService {
  private http = inject(HttpClient);
  private api = environment.apiBase;

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || '';
    const type = localStorage.getItem('token_type') || 'bearer';
    return new HttpHeaders({ 'Authorization': `${type} ${token}` });
  }

  // Dashboard methods
  getKeyHighlights(): Observable<{ total_submissions: number; current_demand: number; number_of_business_heads: number }> {
    return this.http.get<{ total_submissions: number; current_demand: number; number_of_business_heads: number }>(
      `${this.api}/clustermanager/dashboard/key-highlights`, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDailySubmissionsTrend(startDate?: string, endDate?: string): Observable<{ daily_trend: Array<{ date: string; count: number; business_heads?: Array<{ business_head_name: string; count: number }> }> }> {
    let url = `${this.api}/clustermanager/dashboard/daily-submissions-trend`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ daily_trend: Array<{ date: string; count: number; business_heads?: Array<{ business_head_name: string; count: number }> }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByBusinessHeads(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ business_head_id: number; business_head_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/clustermanager/dashboard/demand-by-business-heads`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ distribution: Array<{ business_head_id: number; business_head_name: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandByStatus(startDate?: string, endDate?: string): Observable<{ status_counts: Array<{ status: string; count: number }> }> {
    let url = `${this.api}/clustermanager/dashboard/demand-by-status`;
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
    let url = `${this.api}/clustermanager/dashboard/demand-by-skill`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ skill_distribution: Array<{ skill: string; count: number; percentage: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getSubmissionsByBusinessHeads(startDate?: string, endDate?: string): Observable<{ business_head_submissions: Array<{ business_head_id: number; business_head_name: string; count: number }> }> {
    let url = `${this.api}/clustermanager/dashboard/submissions-by-business-heads`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return this.http.get<{ business_head_submissions: Array<{ business_head_id: number; business_head_name: string; count: number }> }>(
      url, 
      { headers: this.getAuthHeaders() }
    );
  }

  getDemandBySpocs(startDate?: string, endDate?: string): Observable<{ distribution: Array<{ spoc_id: number; spoc_name: string; count: number; percentage: number }> }> {
    let url = `${this.api}/clustermanager/dashboard/demand-by-spocs`;
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
    let url = `${this.api}/clustermanager/dashboard/submissions-by-spocs`;
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




