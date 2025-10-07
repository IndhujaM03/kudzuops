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
    .tl-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; }
    .tl-card { background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.06); padding:20px; }
    .tl-card-title { font-size:14px; color:#4b5563; margin-bottom:8px; font-weight:600; }
    .tl-card-value { font-size:28px; font-weight:800; color:#111827; }
    .tl-card-unassigned { border-color:#fde68a; }
    .tl-card-assigned { border-color:#93c5fd; }
    .tl-card-submitted { border-color:#86efac; }
    @media (max-width: 768px) { .tl-grid { grid-template-columns: 1fr; } }
  `]
})
export class TeamLeaderDashboardComponent {}


