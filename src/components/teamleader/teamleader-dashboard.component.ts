import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-teamleader-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tl-grid">
      <div class="tl-card tl-card-unassigned">
        <div class="tl-card-title">Unassigned</div>
        <div class="tl-card-value">0</div>
      </div>
      <div class="tl-card tl-card-assigned">
        <div class="tl-card-title">Assigned</div>
        <div class="tl-card-value">0</div>
      </div>
      <div class="tl-card tl-card-submitted">
        <div class="tl-card-title">Submitted</div>
        <div class="tl-card-value">0</div>
      </div>
    </div>
  `,
  styles: [`
    .tl-grid { 
      display:grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap:20px; 
    }
    .tl-card { 
      background:rgba(255, 255, 255, 0.8); 
      backdrop-filter:blur(10px);
      border:1px solid rgba(24, 45, 23, 0.1); 
      border-radius:12px; 
      box-shadow:0 4px 6px rgba(24, 45, 23, 0.1); 
      padding:24px; 
      transition:all 0.2s ease;
    }
    .tl-card:hover {
      transform: translateY(-2px);
      box-shadow:0 10px 18px rgba(24, 45, 23, 0.15);
    }
    .tl-card-title { 
      font-size:14px; 
      color:#4b5563; 
      margin-bottom:8px; 
      font-weight:600; 
    }
    .tl-card-value { 
      font-size:28px; 
      font-weight:800; 
      color:#111827; 
    }
    .tl-card-unassigned { 
      border-left:4px solid #f59e0b; 
    }
    .tl-card-assigned { 
      border-left:4px solid var(--kudzu-primary); 
    }
    .tl-card-submitted { 
      border-left:4px solid #10b981; 
    }
    @media (max-width: 768px) { 
      .tl-grid { grid-template-columns: 1fr; } 
    }
  `]
})
export class TeamLeaderDashboardComponent {}


