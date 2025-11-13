import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../environments/environment';

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
  private api = environment.apiBase;
  private authBase = environment.authBase || (this.api ? `${this.api}/auth` : '/api/auth');

  private isLoggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('access_token'));
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authBase}/login`, { email, password }).pipe(
      tap(r => {
        console.log('Login response received:', r);
        this.storeAuth(r);
        console.log('Token stored in localStorage:', !!localStorage.getItem('access_token'));
      })
    );
  }

  signup(first_name: string, last_name: string, email: string, password: string, confirm: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authBase}/register`, { first_name, last_name, email, password, confirm_password: confirm });
  }

  verify(email: string, code: string, google = false): Observable<AuthResponse> {
    const endpoint = google ? 'verify-google' : 'verify';
    return this.http.post<AuthResponse>(`${this.authBase}/${endpoint}`, { email, code }).pipe(
      tap(r => this.storeAuth(r))
    );
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authBase}/verify/resend`, { email });
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authBase}/request-reset`, { email });
  }

  verifyReset(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authBase}/verify-reset`, { email, code, new_password: newPassword });
  }

  sso(provider: 'google' | 'corp', ssoToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authBase}/sso`, { provider, sso_token: ssoToken }).pipe(
      tap(r => this.storeAuth(r))
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('expires_at');
    localStorage.removeItem('recruiter_id');
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
    
    // CRITICAL: Extract and store recruiter_id from JWT token
    try {
      const payload = JSON.parse(atob(r.access_token.split('.')[1]));
      const recruiterId = payload.uid || payload.user_id || payload.id;
      if (recruiterId) {
        localStorage.setItem('recruiter_id', recruiterId.toString());
        console.log('Recruiter ID stored in localStorage:', recruiterId);
      }
    } catch (error) {
      console.error('Error extracting recruiter_id from token:', error);
    }
    
    this.isLoggedInSubject.next(true);
    console.log('Auth stored successfully');
  }

  isAuthenticated(): boolean { return this.isLoggedInSubject.value; }

  getCurrentUserId(): number | null {
    try {
      console.log('🔍 getCurrentUserId called');
      
      // FIRST: Try to get recruiter_id from localStorage (fastest, most reliable)
      const storedRecruiterId = localStorage.getItem('recruiter_id');
      console.log('📦 Stored recruiter_id in localStorage:', storedRecruiterId);
      
      if (storedRecruiterId) {
        const id = parseInt(storedRecruiterId, 10);
        console.log('🔢 Parsed ID:', id, 'isNaN:', isNaN(id));
        if (!isNaN(id) && id > 0) {
          console.log('✅ Using recruiter_id from localStorage:', id);
          return id;
        }
      }
      
      // FALLBACK: Parse from JWT token
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token exists:', !!token);
      if (!token) {
        console.log('❌ No token found');
        return null;
      }
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      console.log('Token payload:', payload);
      console.log('Available ID fields:', {
        uid: payload.uid,
        user_id: payload.user_id,
        id: payload.id
      });
      
      // Backend encodes user id as `uid` (see _issue_token)
      const userId = payload.uid || payload.user_id || payload.id || null;
      
      // Store it in localStorage for next time
      if (userId) {
        localStorage.setItem('recruiter_id', userId.toString());
        console.log('Extracted and stored user ID:', userId);
      }
      
      console.log('Extracted user ID from token:', userId);
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