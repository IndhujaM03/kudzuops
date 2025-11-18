import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ManagerService } from './manager.service';
import { environment } from '../environments/environment';

export interface HrOnboardingResponse {
  items: Array<Record<string, unknown>>;
  columns: string[];
  total: number;
  limit: number;
  offset: number;
}

export interface OnboardingDetailResponse extends Record<string, unknown> {
  id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  generated_link?: string | null;
  status?: string | null;
  documents?: any;
  confirmed_rounds?: Array<{
    round: string;
    slots: Array<{ date: string; time: string; status: string }>;
  }>;
}

@Injectable({ providedIn: 'root' })
export class HrService {
  private managerService = inject(ManagerService);
  private http = inject(HttpClient);
  private api = environment.apiBase;

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token') || '';
    const type = localStorage.getItem('token_type') || 'bearer';
    return new HttpHeaders({ Authorization: `${type} ${token}` });
  }

  getKeyHighlights(): Observable<{ total_submissions: number; current_demand: number; number_of_team_leaders: number }> {
    return this.managerService.getKeyHighlights();
  }

  getDailySubmissionsTrend(startDate?: string, endDate?: string) {
    return this.managerService.getDailySubmissionsTrend(startDate, endDate);
  }

  getDemandByTeamLeaders(startDate?: string, endDate?: string) {
    return this.managerService.getDemandByTeamLeaders(startDate, endDate);
  }

  getDemandBySpocs(startDate?: string, endDate?: string) {
    return this.managerService.getDemandBySpocs(startDate, endDate);
  }

  getDemandByStatus(startDate?: string, endDate?: string) {
    return this.managerService.getDemandByStatus(startDate, endDate);
  }

  getDemandBySkill(startDate?: string, endDate?: string) {
    return this.managerService.getDemandBySkill(startDate, endDate);
  }

  getSubmissionsByTeamLeaders(startDate?: string, endDate?: string) {
    return this.managerService.getSubmissionsByTeamLeaders(startDate, endDate);
  }

  getSubmissionsBySpocs(startDate?: string, endDate?: string) {
    return this.managerService.getSubmissionsBySpocs(startDate, endDate);
  }

  getOnboardingRecords(
    limit: number = 100,
    offset: number = 0,
    status?: string,
    pendingOnly?: boolean
  ): Observable<HrOnboardingResponse> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    params.set('offset', offset.toString());
    if (status) {
      params.set('status', status);
    }
    if (pendingOnly) {
      params.set('pending_only', 'true');
    }
    const url = `${this.api}/hr/onboarding?${params.toString()}`;
    return this.http.get<HrOnboardingResponse>(url, { headers: this.getAuthHeaders() });
  }

  generateOnboardingLink(candidateId: number): Observable<{ generated_link: string; status: string }> {
    const url = `${this.api}/hr/onboarding/${candidateId}/generate-link`;
    return this.http.post<{ generated_link: string; status: string }>(url, {}, { headers: this.getAuthHeaders() });
  }

  getOnboardingRecordDetails(candidateId: number): Observable<OnboardingDetailResponse> {
    const url = `${this.api}/hr/onboarding/${candidateId}`;
    return this.http.get<OnboardingDetailResponse>(url, { headers: this.getAuthHeaders() });
  }

  // HR Dashboard methods
  getHrKeyHighlights(): Observable<{
    total_candidates: number;
    onboarding_pending: number;
    onboarding_completed: number;
    total_interviews_scheduled: number;
  }> {
    return this.http.get<{
      total_candidates: number;
      onboarding_pending: number;
      onboarding_completed: number;
      total_interviews_scheduled: number;
    }>(`${this.api}/hr/dashboard/key-highlights`, { headers: this.getAuthHeaders() });
  }

  getDailyCandidateRegistration(
    startDate?: string,
    endDate?: string,
    view: string = 'monthly'
  ): Observable<{ daily_trend: Array<{ date: string; count: number }> }> {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    params.set('view', view);
    const url = `${this.api}/hr/dashboard/daily-candidate-registration?${params.toString()}`;
    return this.http.get<{ daily_trend: Array<{ date: string; count: number }> }>(
      url,
      { headers: this.getAuthHeaders() }
    );
  }

  getInterviewStatusOverview(
    startDate?: string,
    endDate?: string
  ): Observable<{ status_overview: Array<{ status: string; count: number }> }> {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const url = `${this.api}/hr/dashboard/interview-status-overview?${params.toString()}`;
    return this.http.get<{ status_overview: Array<{ status: string; count: number }> }>(
      url,
      { headers: this.getAuthHeaders() }
    );
  }

  getOnboardingStatusGraph(
    startDate?: string,
    endDate?: string
  ): Observable<{
    status_distribution: Array<{ status: string; count: number; percentage: number }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const url = `${this.api}/hr/dashboard/onboarding-status-graph?${params.toString()}`;
    return this.http.get<{
      status_distribution: Array<{ status: string; count: number; percentage: number }>;
      total: number;
    }>(url, { headers: this.getAuthHeaders() });
  }
}