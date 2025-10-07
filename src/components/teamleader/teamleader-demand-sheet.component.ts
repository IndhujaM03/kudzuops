import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DemandItem {
  id: number;
  title: string;
  client?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-teamleader-demand-sheet',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tl-demand-wrapper">
      <h2 class="tl-page-title">Demand Sheet</h2>

      <div class="tl-tabs">
        <button class="tl-tab" [class.active]="activeTab() === 'unassigned'" (click)="setTab('unassigned')">Unassigned</button>
        <button class="tl-tab" [class.active]="activeTab() === 'assigned'" (click)="setTab('assigned')">Assigned</button>
        <button class="tl-tab" [class.active]="activeTab() === 'submitted'" (click)="setTab('submitted')">Submitted</button>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'unassigned'">
        <ng-container *ngIf="unassigned().length; else emptyUnassigned">
          <div class="tl-list">
            <div class="tl-item" *ngFor="let d of unassigned()">
              <div class="tl-item-title">{{ d.title }}</div>
              <div class="tl-item-sub">{{ d.client || '—' }} • {{ d.createdAt || '' }}</div>
            </div>
          </div>
        </ng-container>
        <ng-template #emptyUnassigned>
          <div class="tl-empty">No unassigned demands</div>
        </ng-template>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'assigned'">
        <ng-container *ngIf="assigned().length; else emptyAssigned">
          <div class="tl-list">
            <div class="tl-item" *ngFor="let d of assigned()">
              <div class="tl-item-title">{{ d.title }}</div>
              <div class="tl-item-sub">{{ d.client || '—' }} • {{ d.createdAt || '' }}</div>
            </div>
          </div>
        </ng-container>
        <ng-template #emptyAssigned>
          <div class="tl-empty">No assigned demands</div>
        </ng-template>
      </div>

      <div class="tl-tab-panel" *ngIf="activeTab() === 'submitted'">
        <ng-container *ngIf="submitted().length; else emptySubmitted">
          <div class="tl-list">
            <div class="tl-item" *ngFor="let d of submitted()">
              <div class="tl-item-title">{{ d.title }}</div>
              <div class="tl-item-sub">{{ d.client || '—' }} • {{ d.createdAt || '' }}</div>
            </div>
          </div>
        </ng-container>
        <ng-template #emptySubmitted>
          <div class="tl-empty">No submitted demands</div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .tl-demand-wrapper { background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.06); padding:16px; }
    .tl-page-title { margin:0 0 12px; font-size:18px; font-weight:700; color:#111827; }
    .tl-tabs { display:flex; gap:8px; border-bottom:1px solid #e5e7eb; margin-bottom:8px; }
    .tl-tab { background:transparent; border:none; padding:10px 12px; cursor:pointer; color:#374151; border-bottom:2px solid transparent; }
    .tl-tab.active { color:#111827; border-bottom-color:#667eea; }
    .tl-tab-panel { padding-top:8px; }
    .tl-list { display:flex; flex-direction:column; gap:8px; }
    .tl-item { padding:12px; border:1px solid #f1f5f9; border-radius:8px; background:#fafafa; }
    .tl-item-title { font-weight:600; color:#111827; margin-bottom:4px; }
    .tl-item-sub { font-size:12px; color:#6b7280; }
    .tl-empty { padding:16px; color:#6b7280; font-size:14px; }
  `]
})
export class TeamLeaderDemandSheetComponent {
  activeTab = signal<'unassigned' | 'assigned' | 'submitted'>('unassigned');

  unassigned = signal<DemandItem[]>([]);
  assigned = signal<DemandItem[]>([]);
  submitted = signal<DemandItem[]>([]);

  setTab(tab: 'unassigned' | 'assigned' | 'submitted') {
    this.activeTab.set(tab);
  }
}
