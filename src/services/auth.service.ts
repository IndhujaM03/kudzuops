import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

export interface AuthResponse {
  access_token?: string;
  token_type: string;
  message?: string;
  verification_required?: boolean;
  redirect_url?: string;
  expires_at?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8000';

  private isLoggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('access_token'));
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, { email, password }).pipe(
      tap(r => {
        console.log('Login response received:', r);
        this.storeAuth(r);
        console.log('Token stored in localStorage:', !!localStorage.getItem('access_token'));
      })
    );
  }

  signup(first_name: string, last_name: string, email: string, password: string, confirm: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.api}/auth/register`, { first_name, last_name, email, password, confirm_password: confirm });
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
    console.log('Storing auth response:', r);
    if (!r || !r.access_token) {
      console.log('No access token in response, not storing');
      return;
    }
    localStorage.setItem('access_token', r.access_token);
    localStorage.setItem('token_type', r.token_type || 'bearer');
    if (r.expires_at) {
      localStorage.setItem('expires_at', r.expires_at);
    }
    this.isLoggedInSubject.next(true);
    console.log('Auth stored successfully');
  }

  isAuthenticated(): boolean { return this.isLoggedInSubject.value; }

  getCurrentUserId(): number | null {
    try {
      const token = localStorage.getItem('access_token');
      console.log('Token exists:', !!token);
      if (!token) return null;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Available ID fields:', {
        uid: payload.uid,
        user_id: payload.user_id,
        id: payload.id
      });
      
      // Backend encodes user id as `uid` (see _issue_token)
      const userId = payload.uid || payload.user_id || payload.id || null;
      console.log('Extracted user ID:', userId);
      return userId;
    } catch (error) {
      console.error('Error parsing token for user ID:', error);
      return null;
    }
  }

  getCurrentUser(): Observable<any> {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return new Observable(observer => observer.error('No token found'));
      }
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      const user = {
        id: payload.uid || payload.user_id || payload.id,
        email: payload.email,
        role: payload.role,
        display_name: payload.display_name || payload.name || payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name
      };
      
      return new Observable(observer => {
        observer.next(user);
        observer.complete();
      });
    } catch (error) {
      console.error('Error getting current user:', error);
      return new Observable(observer => observer.error(error));
    }
  }
}