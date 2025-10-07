import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
    const token = localStorage.getItem('teamleader_token') || '';
    const type = localStorage.getItem('teamleader_token_type') || 'bearer';
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
}


