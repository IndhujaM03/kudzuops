import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface OnboardingFormResponse {
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  status: string;
  generated_link?: string;
  documents?: any;
  confirmed_rounds?: Array<{
    round: string;
    slots: Array<{ date: string; time: string; status: string }>;
  }>;
  read_only: boolean;
}

export interface OnboardingFormSubmissionResponse {
  status: string;
  message: string;
  documents: any;
}

@Injectable({ providedIn: 'root' })
export class OnboardingPublicService {
  private http = inject(HttpClient);
  private api = environment.apiBase;

  getForm(candidateId: string | number, token: string): Observable<OnboardingFormResponse> {
    return this.http.get<OnboardingFormResponse>(
      `${this.api}/onboarding/form/${candidateId}/${token}`
    );
  }

  submitForm(
    candidateId: string | number,
    token: string,
    formData: FormData
  ): Observable<OnboardingFormSubmissionResponse> {
    return this.http.post<OnboardingFormSubmissionResponse>(
      `${this.api}/onboarding/form/${candidateId}/${token}`,
      formData
    );
  }
}

