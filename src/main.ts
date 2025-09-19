import { Component, OnInit } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { importProvidersFrom } from '@angular/core';
import { DataService, DashboardData } from './services/data.service';
import { ThemeService } from './services/theme.service';
import { LineChartComponent } from './components/line-chart/line-chart.component';
import { BarChartComponent } from './components/bar-chart/bar-chart.component';
import { DonutChartComponent } from './components/donut-chart/donut-chart.component';
import { HorizontalBarChartComponent } from './components/horizontal-bar-chart/horizontal-bar-chart.component';
import { RecruiterPerformanceTrackerComponent } from './components/recruiter-performance-tracker/recruiter-performance-tracker.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LineChartComponent,
    BarChartComponent,
    DonutChartComponent,
    HorizontalBarChartComponent,
    RecruiterPerformanceTrackerComponent
  ],
  template: `
    <div style="min-height: 100vh; background-color: var(--primary-bg);">
      <!-- Header -->
      <header class="header">
        <div class="container">
          <div class="header-content">
            <div>
              <h1 class="header-title">
                Demand & Submission Report
              </h1>
              <p class="header-subtitle">Comprehensive analysis of recruitment metrics</p>
            </div>
            <div class="header-actions">
              <button class="theme-toggle" (click)="toggleTheme()" [attr.aria-label]="(themeService.isDarkMode$ | async) ? 'Switch to light mode' : 'Switch to dark mode'">
                <span *ngIf="!(themeService.isDarkMode$ | async)">🌙</span>
                <span *ngIf="themeService.isDarkMode$ | async">☀️</span>
              </button>
              <div class="report-badge">
                📊 Report Overview
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="container" style="padding: 2rem 0;">
        <div *ngIf="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <p class="loading-text">Loading dashboard data...</p>
        </div>

        <div *ngIf="!loading && dashboardData" class="animate-slide-up">
          <!-- Key Highlights -->
          <div class="key-highlights">
            <h2>Key Highlights</h2>
            <div class="highlights-grid">
              <div class="highlight-item">
                <div class="highlight-number">{{ dashboardData.totalSubmissions }}</div>
                <div class="highlight-label">Total Submissions</div>
               <div class="highlight-subtitle">
                  From Aug 18th to {{ today | date:'MMM d' }}
                </div>

              </div>
              <div class="highlight-item">
                <div class="highlight-number">{{ getSupplyGap() }}</div>
                <div class="highlight-label">Current Demand</div>
                <div class="highlight-subtitle">Open positions requiring supply</div>
              </div>
              <div class="highlight-item">
                <div class="highlight-number">{{ getDailyAverage() }}</div>
                <div class="highlight-label">Daily Submissions</div>
                <div class="highlight-subtitle">Average daily submission rate</div>
              </div>
            </div>
          </div>

          <!-- Part 1: Submissions Analysis -->
          <div class="charts-grid">
            <div class="card">
              <div class="card-header">
                <!-- <div class="part-label">Part 1</div> -->
                <!-- <h3 class="card-title">Daily Submissions Trend</h3>
                <p class="card-subtitle">Track daily submission patterns over time</p> -->
              </div>
              <div class="card-content">
                <app-line-chart [data]="dashboardData.submissions"></app-line-chart>
              </div>
            </div>
          </div>

          <!-- Part 2: Current Demand by SPOC -->
          <div class="charts-grid">
            <div class="card">
              <div class="card-header">
                <!-- <div class="part-label">Part 2</div> -->
                <h3 class="card-title">Current Demand</h3>
                <p class="card-subtitle">Distribution of Demand by SPOCs</p>
              </div>
              <div class="card-content">
                <div class="filter-controls">
                  <div class="filter-group">
                    <span class="filter-label">View</span>
                    <div class="radio-group">
                      <label class="radio-option">
                        <input type="radio" name="demandView" [value]="'Current'" [(ngModel)]="selectedDemandView" />
                        <span>Current</span>
                      </label>
                      <label class="radio-option">
                        <input type="radio" name="demandView" [value]="'All'" [(ngModel)]="selectedDemandView" />
                        <span>All</span>
                      </label>
                    </div>
                  </div>
                  <div class="filter-group">
                    <span class="filter-label">Month</span>
                    <select class="filter-select" [(ngModel)]="selectedMonthId">
                      <option [ngValue]="currentMonthId">{{ formatMonthLabel(currentMonthId) }} (Current)</option>
                      <option [ngValue]="''">All Months</option>
                      <option *ngFor="let m of getAvailableMonthIds()" [ngValue]="m">{{ formatMonthLabel(m) }}</option>
                    </select>
                  </div>
                </div>
                <app-donut-chart [statusCounts]="getFilteredSpocDemandCounts()"></app-donut-chart>
              </div>
            </div>
          </div>

          <!-- Part 3: Demand by Status -->
          <div class="charts-grid">
            <div class="card">
              <div class="card-header">
                <!-- <div class="part-label">Part 3</div> -->
                <h3 class="card-title">Demand by Status</h3>
                <p class="card-subtitle">Breakdown of Demands by status</p>
              </div>
              <div class="card-content">
                <div class="filter-controls">
                  <div class="filter-group">
                    <span class="filter-label">Month</span>
                    <select class="filter-select" [(ngModel)]="selectedStatusMonthId">
                      <option [ngValue]="currentMonthId">{{ formatMonthLabel(currentMonthId) }} (Current)</option>
                      <option [ngValue]="''">All Months</option>
                      <option *ngFor="let m of getAvailableMonthIds()" [ngValue]="m">{{ formatMonthLabel(m) }}</option>
                    </select>
                  </div>
                </div>
                <app-donut-chart [statusCounts]="getFilteredStatusCounts()"></app-donut-chart>
              </div>
            </div>
          </div>

          <!-- Part 4: Current Demand by Skill -->
          <div class="charts-grid">
            <div class="card">
              <div class="card-header">
                <!-- <div class="part-label">Part 4</div> -->
                <h3 class="card-title">Demand by Skill</h3>
                <p class="card-subtitle">Demand Distribution by Skills</p>
              </div>
              <div class="card-content">
                <div class="filter-controls">
                  <div class="filter-group">
                    <span class="filter-label">View</span>
                    <div class="radio-group">
                      <label class="radio-option">
                        <input type="radio" name="skillDemandView" [value]="'Current'" [(ngModel)]="selectedSkillDemandView" />
                        <span>Current</span>
                      </label>
                      <label class="radio-option">
                        <input type="radio" name="skillDemandView" [value]="'All'" [(ngModel)]="selectedSkillDemandView" />
                        <span>All</span>
                      </label>
                    </div>
                  </div>
                  <div class="filter-group">
                    <span class="filter-label">Month</span>
                    <select class="filter-select" [(ngModel)]="selectedSkillMonthId">
                      <option [ngValue]="currentMonthId">{{ formatMonthLabel(currentMonthId) }} (Current)</option>
                      <option [ngValue]="''">All Months</option>
                      <option *ngFor="let m of getAvailableMonthIds()" [ngValue]="m">{{ formatMonthLabel(m) }}</option>
                    </select>
                  </div>
                </div>
                <app-horizontal-bar-chart [data]="getFilteredSkillDemandCounts()"></app-horizontal-bar-chart>
              </div>
            </div>
          </div>

          <!-- Part 5: Top Performing Recruiters -->
          <div class="charts-grid">
            <div class="card">
              <div class="card-header">
                <!-- <div class="part-label">Part 5</div> -->
                <!-- <h3 class="card-title">Top Performing Recruiters</h3>
                <p class="card-subtitle">Recruiters with most submissions this period</p> -->
              </div>
              <div class="card-content">
                <app-bar-chart [data]="dashboardData.submissions"></app-bar-chart>
              </div>
            </div>
          </div>

          <!-- Part 6: SPOC-wise Submissions -->
        <!-- Part 6: SPOC-wise Submissions -->
        <div class="charts-grid">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">SPOC-wise Submissions</h3>
              <p class="card-subtitle">Number of profiles submitted to each SPOC</p>
            </div>
            <div class="card-content">
              <!-- Filters -->
              <div class="filter-controls">
                <div class="filter-group">
                  <span class="filter-label">View</span>
                  <div class="radio-group">
                    <label class="radio-option">
                      <input type="radio" name="spocTimeframe" value="Daily" [(ngModel)]="spocTimeframe" />
                      <span>Daily</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" name="spocTimeframe" value="Weekly" [(ngModel)]="spocTimeframe" />
                      <span>Weekly</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" name="spocTimeframe" value="Monthly" [(ngModel)]="spocTimeframe" />
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group">
                  <span class="filter-label">Month</span>
                  <select class="filter-select" [(ngModel)]="selectedSpocMonthId">
                    <option [ngValue]="currentMonthId">{{ formatMonthLabel(currentMonthId) }} (Current)</option>
                    <option [ngValue]="''">All Months</option>
                    <option *ngFor="let m of getAvailableMonthIds()" [ngValue]="m">{{ formatMonthLabel(m) }}</option>
                  </select>
                </div>
              </div>

              <app-horizontal-bar-chart [data]="getFilteredSpocSubmissions()"></app-horizontal-bar-chart>
            </div>
          </div>
        </div>

          <!-- Recruiter Case Tracker -->
          <div class="charts-grid">
            <div class="card ">
               <div class="card-header">
                <!-- <div class="part-label"></div> -->
                <!-- <h3 class="card-title"></h3>
                <p class="card-subtitle"></p> -->
              </div>
              <div class="card-content">
                <app-recruiter-performance-tracker [data]="dashboardData.recruiterPerformance"></app-recruiter-performance-tracker>
              </div>
            </div>
          </div>

               <!-- Observations Section -->
      <div class="observations">
        <h2>Observations: Supply vs. Demand</h2>
        <div class="filter-controls">
                  <div class="filter-group">
                    <span class="filter-label">View</span>
                    <div class="radio-group">
                      <label class="radio-option">
                        <input type="radio"  name="timeframe" value="Daily" [(ngModel)]="timeframe" />
                        <span>Daily</span>
                      </label>
                      <label class="radio-option">
                        <input type="radio" name="timeframe" value="Weekly" [(ngModel)]="timeframe" />
                        <span>Weekly</span>
                      </label>
                      <label class="radio-option">
                        <input type="radio" name="timeframe" value="Monthly" [(ngModel)]="timeframe" />
                        <span>Monthly</span>
                      </label>
                    </div>
                  </div>
                 
                </div>
        

        <div class="observations-content">
          <div>
            <h3 style="margin-bottom: 1rem; font-size: 1.125rem;">Key Insights</h3>
            <ul class="observations-list">
              <!-- Static -->
              <li>Supply Required: Profiles needed against {{ getSupplyGap() }} unique demands.</li>
              <li>High Demand Skill: {{ getTopDemandSkill() }} requires {{ getTopDemandCount() }} profiles</li>

              <!-- Timeframe-based -->
              <li>Profiles Submitted ({{ timeframe }}): {{ getFilteredSubmissionsCount() }} profiles submitted</li>
              <li>SPOC-wise Submissions ({{ timeframe }}): {{ getFilteredTopSpoc() }} gets maximum supply among SPOCs ({{ getFilteredTopSpocCount() }} submissions)</li>
            </ul>
          </div>
        </div>
      </div>
        </div>

        <div *ngIf="!loading && !dashboardData" style="text-align: center; padding: 4rem 0;">
          <p style="color: var(--text-secondary); font-size: 1.125rem;">No data available</p>
          <button class="btn btn-primary" (click)="loadDashboardData()" style="margin-top: 1rem;">
            Load Publicis Report Data
          </button>
        </div>
      </main>

      <!-- Footer -->
      <footer class="footer">
        <div class="container">
          <p class="footer-text">
            © 2025 Publicis SPOC Analytics Dashboard - Supply & Demand Report
          </p>
        </div>
      </footer>
    </div>
  `
})
export class App implements OnInit {
  dashboardData: DashboardData | null = null;
  loading = true;
  selectedDemandView: 'Current' | 'All' = 'Current';
  selectedMonthId: string = '';
  currentMonthId: string = '';
  selectedStatusMonthId: string = '';
  // Part 4 separate state
  selectedSkillDemandView: 'Current' | 'All' = 'Current';
  selectedSkillMonthId: string = '';

  // NEW: timeframe for Observations
  timeframe: 'Daily' | 'Weekly' | 'Monthly' = 'Monthly';
  // SPOC-wise submissions filters

spocTimeframe: 'Daily' | 'Weekly' | 'Monthly' = 'Monthly';
  selectedSpocMonthId: string = '';
  today = new Date();

  constructor(
    private dataService: DataService,
    public themeService: ThemeService
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }


  loadDashboardData() {
    this.loading = true;
    this.dataService.getDashboardData().subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.currentMonthId = this.getCurrentMonthId();
        this.selectedMonthId = this.currentMonthId;
        this.selectedStatusMonthId = this.currentMonthId;
        this.selectedSkillMonthId = this.currentMonthId;
        this.selectedSpocMonthId = this.currentMonthId;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.loading = false;
      }
    });
  }


  toggleTheme() {
    this.themeService.toggleTheme();
  }
  // -------------------------
  // SPOC-wise submissions helpers
  // -------------------------
  private getStartDateForSpocTimeframe(): Date {
    const now = new Date();
    if (this.spocTimeframe === 'Daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
    if (this.spocTimeframe === 'Weekly') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      start.setHours(0,0,0,0);
      return start;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
  }

  getFilteredSpocSubmissions(): { [key: string]: number } {
    if (!this.dashboardData?.submissions) return {};
    const start = this.getStartDateForSpocTimeframe();
    const monthId = this.selectedSpocMonthId;

    const filtered = this.dashboardData.submissions.filter(s => {
      const dt = this.parseDateSafe(s.date);
      const submissionMonth = dt.toISOString().slice(0,7);
      const matchesMonth = monthId ? submissionMonth === monthId : true;
      return dt >= start && matchesMonth;
    });

    return filtered.reduce((acc: any, s: any) => {
      const spoc = s.spoc || 'Unknown';
      acc[spoc] = (acc[spoc] || 0) + 1;
      return acc;
    }, {});
  }

  // getActiveStatusCount(): number {
  //   if (!this.dashboardData) return 0;
  //   // Count only active/open statuses
  //   const activeStatuses = ['Covered', 'Cancelled', 'Closed', 'Supply Required', 'On Hold'];
  //   return Object.entries(this.dashboardData.statusCounts)
  //     .filter(([status]) => activeStatuses.some(active => status.toLowerCase().includes(active.toLowerCase())))
  //     .reduce((sum, [, count]) => sum + count, 0);
  // }
  getSupplyRequiredCount(): number {
    if (!this.dashboardData || !this.dashboardData.statusCounts) return 0;

    return Object.entries(this.dashboardData.statusCounts)
      .filter(([status]) => status.toLowerCase() === 'supply required')
      .reduce((sum, [, count]) => sum + count, 0);
  }

  getDailyAverage(): number {
    if (!this.dashboardData) return 0;
    const uniqueDates = new Set(this.dashboardData.submissions.map(s => s.date));
    return Math.round(this.dashboardData.totalSubmissions / Math.max(uniqueDates.size, 1)) || 0;
  }

  // Demand all shows Functions
  // getSpocDemandCounts(): { [key: string]: number } {
  //   if (!this.dashboardData) return {};
  //   return this.dashboardData.demands.reduce((acc, d) => {
  //     const spoc = d.spoc || 'Unknown';
  //     acc[spoc] = (acc[spoc] || 0) + (d.supplyRequired || d.positions);
  //     return acc;
  //   }, {} as { [key: string]: number });
  // }
  getSpocDemandCounts(): { [key: string]: number } {
    if (!this.dashboardData || !this.dashboardData.demands) return {};

    return this.dashboardData.demands.reduce((acc, d) => {
      if (d.status?.toLowerCase() === "supply required") {
        const spoc = d.spoc || "Unknown";
        const positions = d.positions ?? 0;
        acc[spoc] = (acc[spoc] || 0) + positions;
      }
      return acc;
    }, {} as { [key: string]: number });
  }

  // Part 2: Filters and computed SPOC distribution
  getFilteredSpocDemandCounts(): { [key: string]: number } {
    if (!this.dashboardData || !this.dashboardData.demands) return {};
    const monthId = this.selectedMonthId || '';
    const view = this.selectedDemandView;
    const ignoreRadio = !!monthId && monthId !== this.currentMonthId; // past month selection ignores radio

    const filtered = this.dashboardData.demands.filter(d => {
      const demandMonth = (d.date || '').slice(0, 7); // YYYY-MM
      const matchesMonth = monthId ? demandMonth === monthId : true;
      if (!ignoreRadio && view === 'Current') {
        return matchesMonth && (d.status?.toLowerCase() === 'supply required');
      }
      // view === 'All'
      return matchesMonth;
    });

    return filtered.reduce((acc, d) => {
      const spoc = d.spoc || 'Unknown';
      const positions = d.positions ?? 0;
      acc[spoc] = (acc[spoc] || 0) + positions;
      return acc;
    }, {} as { [key: string]: number });
  }

  getAvailableMonthIds(): string[] {
    if (!this.dashboardData) return [];
    const ids = Array.from(new Set(this.dashboardData.demands
      .map(d => (d.date || '').slice(0, 7))
      .filter(m => !!m)));
    // Ensure current month shows first in dropdown list uniqueness
    return ids
      .filter(id => id !== this.currentMonthId)
      .sort((a, b) => a < b ? 1 : -1); // desc
  }

  getCurrentMonthId(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}-${m}`;
  }

  formatMonthLabel(id: string): string {
    if (!id) return 'All Months';
    const [y, m] = id.split('-').map(x => parseInt(x, 10));
    const dt = new Date(y, (m || 1) - 1, 1);
    return dt.toLocaleString(undefined, { month: 'short', year: 'numeric' });
  }

  // Part 4: Current Demand by Skill with same filter logic
  getFilteredSkillDemandCounts(): { [key: string]: number } {
    if (!this.dashboardData || !this.dashboardData.demands) return {};
    const monthId = this.selectedSkillMonthId || '';
    const view = this.selectedSkillDemandView;

    const filtered = this.dashboardData.demands.filter(d => {
      const demandMonth = (d.date || '').slice(0, 7);
      const matchesMonth = monthId ? demandMonth === monthId : true;
      if (view === 'Current') {
        return matchesMonth && (d.status?.toLowerCase() === 'supply required');
      }
      return matchesMonth;
    });

    return filtered.reduce((acc, d) => {
      const skill = d.skill || 'Unknown';
      const positions = d.positions ?? 0;
      acc[skill] = (acc[skill] || 0) + positions;
      return acc;
    }, {} as { [key: string]: number });
  }

  // Part 3: Demand by Status filtered by month
  getFilteredStatusCounts(): { [key: string]: number } {
    if (!this.dashboardData || !this.dashboardData.demands) return {};
    const monthId = this.selectedStatusMonthId || '';
    const filtered = this.dashboardData.demands.filter(d => {
      const demandMonth = (d.date || '').slice(0, 7);
      return monthId ? demandMonth === monthId : true;
    });
    return filtered.reduce((acc, d) => {
      const status = d.status || 'Unknown';
      const positions = d.supplyRequired || d.positions || 0;
      acc[status] = (acc[status] || 0) + positions;
      return acc;
    }, {} as { [key: string]: number });
  }

  getSkillCurrentDemand(): { [key: string]: number } {
    if (!this.dashboardData || !this.dashboardData.demands) return {};

    return this.dashboardData.demands.reduce((acc, d) => {
      if (d.status?.toLowerCase() === "supply required") {
        const skill = d.skill || "Unknown";
        const positions = d.positions  ?? 0;
        acc[skill] = (acc[skill] || 0) + positions;
      }
      return acc;
    }, {} as { [key: string]: number });
  }

  getRecruiterSubmissions(): { [key: string]: number } {
    if (!this.dashboardData) return {};
    return this.dashboardData.submissions.reduce((acc, s) => {
      const recruiter = s.recruiter || 'Unknown';
      acc[recruiter] = (acc[recruiter] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }

  getAlignmentPercentage(): number {
    if (!this.dashboardData) return 0;
    const demandSkills = new Set(this.dashboardData.demands.map(d => d.skill.toLowerCase()));
    const alignedSubmissions = this.dashboardData.submissions.filter(s => 
      demandSkills.has(s.skills.toLowerCase())
    ).length;
    return Math.round((alignedSubmissions / this.dashboardData.totalSubmissions) * 100) || 0;
  }

  getSupplyGap(): number {
     if (!this.dashboardData || !this.dashboardData.statusCounts) return 0;
    const supplyRequired = this.dashboardData.statusCounts['Supply Required'] ?? 0;

    const gap = supplyRequired;
    return Math.max(0, gap);
  }

  getTopSpoc(): string {
    if (!this.dashboardData) return 'N/A';
    const spocCounts = this.dashboardData.spocSubmissions;
    const topSpoc = Object.entries(spocCounts).reduce((a, b) => a[1] > b[1] ? a : b, ['N/A', 0]);
    return topSpoc[0];
  }

  getTopSpocCount(): number {
    if (!this.dashboardData) return 0;
    const spocCounts = this.dashboardData.spocSubmissions;
    const topSpoc = Object.entries(spocCounts).reduce((a, b) => a[1] > b[1] ? a : b, ['N/A', 0]);
    return topSpoc[1];
  }

  getTopDemandSkill(): string {
    if (!this.dashboardData) return 'N/A';
    const skillCounts = this.dashboardData.skillDemands;
    const topSkill = Object.entries(skillCounts).reduce((a, b) => a[1] > b[1] ? a : b, ['N/A', 0]);
    return topSkill[0];
  }

  getTopDemandCount(): number {
    if (!this.dashboardData) return 0;
    const skillCounts = this.dashboardData.skillDemands;
    const topSkill = Object.entries(skillCounts).reduce((a, b) => a[1] > b[1] ? a : b, ['N/A', 0]);
    return topSkill[1];
  }

  // ---------------------------
  // NEW: Timeframe-based helpers
  // ---------------------------

  // Return start-of-period date for the selected timeframe.
  // Daily -> today at 00:00
  // Weekly -> start of current week (Monday)
  // Monthly -> 1st of current month
  private getStartDateForTimeframe(): Date {
    const now = new Date();
    if (this.timeframe === 'Daily') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    }
    if (this.timeframe === 'Weekly') {
      // Get Monday as start of week
      const day = now.getDay(); // 0(Sun) - 6
      const diffToMonday = (day === 0) ? 6 : day - 1; // if Sunday, go back 6 days
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
      start.setHours(0,0,0,0);
      return start;
    }
    // Monthly
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  // Safe parse function (handles date strings)
  private parseDateSafe(d: any): Date {
    // If already Date
    if (d instanceof Date) return d;
    // If timestamp
    if (typeof d === 'number') return new Date(d);
    // else try parse
    return new Date(d);
  }

  // Number of submissions within timeframe
  getFilteredSubmissionsCount(): number {
    if (!this.dashboardData?.submissions) return 0;
    const start = this.getStartDateForTimeframe();
    return this.dashboardData.submissions.filter((s: any) => {
      const dt = this.parseDateSafe(s.date);
      return dt >= start;
    }).length;
  }

  // Supply required (positions) within timeframe
  getFilteredSupplyGap(): number {
    if (!this.dashboardData?.demands) return 0;
    const start = this.getStartDateForTimeframe();
    return this.dashboardData.demands
      .filter((d: any) => {
        const dt = this.parseDateSafe(d.date);
        return dt >= start && d.status?.toLowerCase() === 'supply required';
      })
      .reduce((sum: number, d: any) => sum + (d.positions ?? 0), 0);
  }

  // Top SPOC (by submissions) within timeframe
  getFilteredTopSpoc(): string {
    if (!this.dashboardData?.submissions) return 'N/A';
    const start = this.getStartDateForTimeframe();
    const filtered = this.dashboardData.submissions.filter((s: any) => {
      const dt = this.parseDateSafe(s.date);
      return dt >= start;
    });
    const counts = filtered.reduce((acc: any, s: any) => {
      const spoc = s.spoc || 'Unknown';
      acc[spoc] = (acc[spoc] || 0) + 1;
      return acc;
    }, {});
    if (!Object.keys(counts).length) return 'N/A';
    return Object.entries(counts).reduce((a: any, b: any) => a[1] > b[1] ? a : b, ['N/A', 0])[0];
  }

  getFilteredTopSpocCount(): number {
    if (!this.dashboardData?.submissions) return 0;
    const start = this.getStartDateForTimeframe();
    const filtered = this.dashboardData.submissions.filter((s: any) => {
      const dt = this.parseDateSafe(s.date);
      return dt >= start;
    });
    const counts = filtered.reduce((acc: any, s: any) => {
      const spoc = s.spoc || 'Unknown';
      acc[spoc] = (acc[spoc] || 0) + 1;
      return acc;
    }, {});
    if (!Object.keys(counts).length) return 0;
    return Object.entries(counts).reduce((a: any, b: any) => a[1] > b[1] ? a : b, ['N/A', 0])[1] as number;
  }

  // Top demand skill (by positions) within timeframe
  getFilteredTopDemandSkill(): string {
    if (!this.dashboardData?.demands) return 'N/A';
    const start = this.getStartDateForTimeframe();
    const filtered = this.dashboardData.demands.filter((d: any) => {
      const dt = this.parseDateSafe(d.date);
      return dt >= start;
    });
    const counts = filtered.reduce((acc: any, d: any) => {
      const skill = d.skill || 'Unknown';
      acc[skill] = (acc[skill] || 0) + (d.positions ?? 0);
      return acc;
    }, {});
    if (!Object.keys(counts).length) return 'N/A';
    return Object.entries(counts).reduce((a: any, b: any) => a[1] > b[1] ? a : b, ['N/A', 0])[0];
  }

  getFilteredTopDemandCount(): number {
    if (!this.dashboardData?.demands) return 0;
    const start = this.getStartDateForTimeframe();
    const filtered = this.dashboardData.demands.filter((d: any) => {
      const dt = this.parseDateSafe(d.date);
      return dt >= start;
    });
    const counts = filtered.reduce((acc: any, d: any) => {
      const skill = d.skill || 'Unknown';
      acc[skill] = (acc[skill] || 0) + (d.positions ?? 0);
      return acc;
    }, {});
    if (!Object.keys(counts).length) return 0;
    return Object.entries(counts).reduce((a: any, b: any) => a[1] > b[1] ? a : b, ['N/A', 0])[1] as number;
  }
}

bootstrapApplication(App, {
  providers: [
    importProvidersFrom(HttpClientModule)
  ]
});
