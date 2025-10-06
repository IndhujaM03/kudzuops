import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

export interface AuthResponse {
  access_token?: string;
  token_type: string;
  message?: string;
  verification_required?: boolean;
  redirect_url?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8000';

  private isLoggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('access_token'));
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, { email, password }).pipe(
      tap(r => this.storeAuth(r))
    );
  }

  signup(email: string, password: string, confirm: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/register`, { email, password, confirm_password: confirm });
  }

  verify(email: string, code: string, google = false): Observable<AuthResponse> {
    const endpoint = google ? 'verify-google' : 'verify';
    return this.http.post<AuthResponse>(`${this.api}/auth/${endpoint}`, { email, code }).pipe(
      tap(r => this.storeAuth(r))
    );
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/verify/resend`, { email });
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/request-reset`, { email });
  }

  verifyReset(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/verify-reset`, { email, code, new_password: newPassword });
  }

  sso(provider: 'google' | 'corp', ssoToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/sso`, { provider, sso_token: ssoToken }).pipe(
      tap(r => this.storeAuth(r))
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    this.isLoggedInSubject.next(false);
  }

  private storeAuth(r: AuthResponse) {
    if (!r || !r.access_token) {
      return;
    }
    localStorage.setItem('access_token', r.access_token);
    localStorage.setItem('token_type', r.token_type || 'bearer');
    this.isLoggedInSubject.next(true);
  }

  isAuthenticated(): boolean { return this.isLoggedInSubject.value; }
}