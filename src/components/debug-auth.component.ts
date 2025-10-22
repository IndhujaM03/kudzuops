import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-debug-auth',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding: 20px; font-family: monospace;">
      <h2>Authentication Debug</h2>
      
      <div style="margin: 10px 0;">
        <strong>Token exists:</strong> {{ tokenExists }}
      </div>
      
      <div style="margin: 10px 0;">
        <strong>Token value:</strong> {{ tokenValue }}
      </div>
      
      <div style="margin: 10px 0;">
        <strong>Token payload:</strong>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">{{ tokenPayload }}</pre>
      </div>
      
      <div style="margin: 10px 0;">
        <strong>User ID (direct):</strong> {{ directUserId }}
      </div>
      
      <div style="margin: 10px 0;">
        <strong>User ID (observable):</strong> {{ observableUserId }}
      </div>
      
      <div style="margin: 10px 0;">
        <strong>User object:</strong>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">{{ userObject }}</pre>
      </div>
      
      <button (click)="refresh()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Refresh
      </button>
    </div>
  `
})
export class DebugAuthComponent implements OnInit {
  tokenExists = false;
  tokenValue = '';
  tokenPayload = '';
  directUserId: number | null = null;
  observableUserId: any = null;
  userObject = '';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    // Check token
    const token = localStorage.getItem('access_token');
    this.tokenExists = !!token;
    this.tokenValue = token ? token.substring(0, 50) + '...' : 'No token';
    
    // Parse token payload
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.tokenPayload = JSON.stringify(payload, null, 2);
      } catch (error) {
        this.tokenPayload = 'Error parsing token: ' + error;
      }
    } else {
      this.tokenPayload = 'No token to parse';
    }
    
    // Get user ID directly
    this.directUserId = this.authService.getCurrentUserId();
    
    // Get user from observable
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.observableUserId = user?.id;
        this.userObject = JSON.stringify(user, null, 2);
      },
      error: (error) => {
        this.observableUserId = 'Error: ' + error;
        this.userObject = 'Error: ' + error;
      }
    });
  }
}

