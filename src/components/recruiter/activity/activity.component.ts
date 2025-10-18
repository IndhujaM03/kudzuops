import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-recruiter-activity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="activity-container">
      <div class="header">
        <h2>Demand Details</h2>
        <div class="actions" *ngIf="activity">
          <span class="badge" *ngIf="activity.activity_status === 'processing'">Processing</span>
        </div>
      </div>

      <div *ngIf="!activity" class="empty">No active activity. Start a process from your Demands list.</div>

      <div *ngIf="activity" class="grid">
        <div class="panel full">
          <div class="panel-header"><h3>Job Description</h3></div>
          <div class="panel-body jd" [innerHTML]="activity.job_description"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .activity-container { padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .badge { background: #d1fae5; color: #065f46; padding: 4px 8px; border-radius: 4px; margin-right: 8px; }
    .btn { padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-warning { background: #f59e0b; color: #fff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .panel.full { grid-column: 1 / -1; }
    .panel-header { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .panel-body { padding: 16px; }
    .jd { background: #f8fafc; padding: 12px; border-radius: 6px; }
    .muted { color: #6b7280; }
    .cv-list { display: grid; gap: 8px; }
    .cv-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px; }
    .q-list { margin: 0; padding-left: 16px; }
    .cv-actions { margin-bottom: 8px; }
    .cv-check { margin-right: 8px; }
  `]
})
export class ActivityComponent implements OnInit {
  private data = inject(DataService);
  private auth = inject(AuthService);
  private router = inject(Router);

  activity: any;
  cvs: any[] = [];
  questions: string[] = [];
  audit: any[] = [];
  selected: Record<string, boolean> = {};
  showPopup = false;
  selections: Array<{ file: string; time?: string; candidate_name?: string; candidate_email?: string; candidate_phone?: string; remarks?: string; }> = [];

  ngOnInit(): void {
    const rid = this.auth.getCurrentUserId();
    if (!rid) { this.router.navigate(['/auth/login']); return; }
    this.data.getCurrentActivity(rid).subscribe({
      next: (a) => {
        this.activity = a;
        if (a?.cv_list) this.cvs = a.cv_list;
        if (a) this.loadAudit();
      }
    });
  }

  closeProcess(): void {
    if (!this.activity) return;
    this.data.closeActivity(this.activity.recruiter_id, this.activity.demand_id).subscribe({
      next: () => { this.activity.activity_status = 'closed'; }
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !this.activity) return;
    Array.from(input.files).forEach(file => {
      // For now just mark uploaded in activity; real upload is elsewhere
      const ts = new Date().toISOString();
      this.data.updateCvEvent(this.activity.recruiter_id, this.activity.demand_id, file.name, ts, 'uploaded').subscribe({
        next: () => { this.cvs.unshift({ file: file.name, time: ts }); }
      });
    });
    input.value = '';
  }

  generateQuestions(): void {
    const jd = this.activity?.job_description || '';
    if (!jd) return;
    this.data.generateQuestions(jd, 5).subscribe({
      next: (r) => { this.questions = r.questions || []; }
    });
  }

  loadAudit(): void {
    if (!this.activity) return;
    this.data.getAuditEvents(this.activity.recruiter_id, this.activity.demand_id, 25).subscribe({
      next: (r) => { this.audit = r.items || []; }
    });
  }

  keyFor(cv: any): string { return `${cv.filename || cv.file}|${cv.timestamp || cv.time || ''}`; }
  isSelected(cv: any): boolean { return !!this.selected[this.keyFor(cv)]; }
  toggleSelect(cv: any): void {
    const k = this.keyFor(cv);
    this.selected[k] = !this.selected[k];
  }
  hasSelection(): boolean { return Object.values(this.selected).some(Boolean); }
  openPopup(): void {
    this.selections = this.cvs.filter(cv => this.isSelected(cv)).map(cv => ({ file: cv.filename || cv.file, time: cv.timestamp || cv.time }));
    this.showPopup = true;
  }
  closePopup(): void { this.showPopup = false; }
  saveSelections(): void {
    this.data.submitSelectedCvs(this.activity.id, this.activity.recruiter_id, this.selections).subscribe({
      next: (r) => {
        this.cvs = r.cv_list || this.cvs;
        this.selected = {};
        this.showPopup = false;
        this.loadAudit();
      }
    });
  }
}


