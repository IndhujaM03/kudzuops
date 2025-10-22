import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../services/data.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-recruiter-submitted',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="submitted-container">
      <div class="header">
        <h2>Submitted Profiles</h2>
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Candidate</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Demand</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Resume</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of submissions">
              <td>{{ s.id }}</td>
              <td>{{ s.candidate_name }}</td>
              <td>{{ s.candidate_email }}</td>
              <td>{{ s.candidate_phone }}</td>
              <td>{{ s.demand_id }}</td>
              <td>{{ s.status }}</td>
              <td>{{ s.created_at | date:'short' }}</td>
              <td>
                <a *ngIf="s.resume_url" [href]="s.resume_url" target="_blank">Open</a>
                <span *ngIf="!s.resume_url" class="muted">N/A</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="submissions.length === 0" class="muted empty">No submissions yet</div>
      </div>
    </div>
  `,
  styles: [`
    .submitted-container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .table-wrap { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .tbl { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: left; }
    thead th { background: #f8fafc; }
    .muted { color: #6b7280; }
    .empty { padding: 24px; text-align: center; }
  `]
})
export class SubmittedComponent implements OnInit {
  private data = inject(DataService);
  private auth = inject(AuthService);

  submissions: any[] = [];

  ngOnInit(): void {
    const rid = this.auth.getCurrentUserId();
    if (!rid) return;
    this.data.getRecruiterSubmitted(rid).subscribe({
      next: (r) => { this.submissions = r.items || []; }
    });
  }
}






