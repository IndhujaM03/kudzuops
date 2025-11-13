import { Component, OnInit, OnDestroy, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessHeadService } from '../../services/businesshead.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-businesshead-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <!-- Dashboard Header -->
      <div class="dashboard-header">
        <h1 class="dashboard-title">businesshead Report – Comprehensive Analysis of Recruitment Performance</h1>
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <!-- Daily Submissions Trend -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Daily Submissions Trend</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="dailyTrendView" value="daily" [(ngModel)]="dailyTrendView" (ngModelChange)="onDailyTrendFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="dailyTrendView" value="weekly" [(ngModel)]="dailyTrendView" (ngModelChange)="onDailyTrendFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="dailyTrendView" value="monthly" [(ngModel)]="dailyTrendView" (ngModelChange)="onDailyTrendFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="dailyTrendMonth" (ngModelChange)="onDailyTrendFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="daily-trend-chart" class="chart-container"></div>
        </div>

        <!-- Demand by Managers (Pie) -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Distribution of Demand by Managers</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="demandManagersView" value="daily" [(ngModel)]="demandManagersView" (ngModelChange)="onDemandManagersFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandManagersView" value="weekly" [(ngModel)]="demandManagersView" (ngModelChange)="onDemandManagersFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandManagersView" value="monthly" [(ngModel)]="demandManagersView" (ngModelChange)="onDemandManagersFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="demandManagersMonth" (ngModelChange)="onDemandManagersFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="demand-managers-chart" class="chart-container"></div>
        </div>

        <!-- Demand by SPOCs (Pie) -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Distribution of Demand by SPOCs</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="demandSpocsView" value="daily" [(ngModel)]="demandSpocsView" (ngModelChange)="onDemandSpocsFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandSpocsView" value="weekly" [(ngModel)]="demandSpocsView" (ngModelChange)="onDemandSpocsFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandSpocsView" value="monthly" [(ngModel)]="demandSpocsView" (ngModelChange)="onDemandSpocsFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="demandSpocsMonth" (ngModelChange)="onDemandSpocsFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="demand-spocs-chart" class="chart-container"></div>
        </div>

        <!-- Demand by Status (Bar) -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Demand by Status</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="demandStatusView" value="daily" [(ngModel)]="demandStatusView" (ngModelChange)="onDemandStatusFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandStatusView" value="weekly" [(ngModel)]="demandStatusView" (ngModelChange)="onDemandStatusFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandStatusView" value="monthly" [(ngModel)]="demandStatusView" (ngModelChange)="onDemandStatusFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="demandStatusMonth" (ngModelChange)="onDemandStatusFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="demand-status-chart" class="chart-container"></div>
        </div>

        <!-- Demand by Skill (Donut) -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Demand by Skill</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="demandSkillView" value="daily" [(ngModel)]="demandSkillView" (ngModelChange)="onDemandSkillFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandSkillView" value="weekly" [(ngModel)]="demandSkillView" (ngModelChange)="onDemandSkillFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="demandSkillView" value="monthly" [(ngModel)]="demandSkillView" (ngModelChange)="onDemandSkillFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="demandSkillMonth" (ngModelChange)="onDemandSkillFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="demand-skill-chart" class="chart-container"></div>
        </div>

        <!-- Submissions by Managers (Bar) -->
        <div class="chart-card chart-card-full">
          <div class="chart-header">
            <h3 class="chart-title">Submissions by Managers</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="submissionsManagersView" value="daily" [(ngModel)]="submissionsManagersView" (ngModelChange)="onSubmissionsManagersFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="submissionsManagersView" value="weekly" [(ngModel)]="submissionsManagersView" (ngModelChange)="onSubmissionsManagersFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="submissionsManagersView" value="monthly" [(ngModel)]="submissionsManagersView" (ngModelChange)="onSubmissionsManagersFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="submissionsManagersMonth" (ngModelChange)="onSubmissionsManagersFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="submissions-managers-chart" class="chart-container"></div>
        </div>

        <!-- SPOC-wise Submissions (Bar) -->
        <div class="chart-card chart-card-full">
          <div class="chart-header">
            <h3 class="chart-title">SPOC-wise Submissions</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="submissionsSpocsView" value="daily" [(ngModel)]="submissionsSpocsView" (ngModelChange)="onSubmissionsSpocsFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="submissionsSpocsView" value="weekly" [(ngModel)]="submissionsSpocsView" (ngModelChange)="onSubmissionsSpocsFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="submissionsSpocsView" value="monthly" [(ngModel)]="submissionsSpocsView" (ngModelChange)="onSubmissionsSpocsFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
                <div class="filter-group-month">
                  <label class="filter-label">Month:</label>
                  <select class="filter-dropdown-month" [(ngModel)]="submissionsSpocsMonth" (ngModelChange)="onSubmissionsSpocsFilterChange()">
                    <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div id="submissions-spocs-chart" class="chart-container"></div>
        </div>
      </div>
    </div>

    <!-- Tooltip -->
    <div id="chart-tooltip" class="chart-tooltip"></div>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .dashboard-header {
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 2px solid rgba(24, 45, 23, 0.1);
    }

    .dashboard-title {
      font-size: 28px;
      font-weight: 700;
      color: #182D17;
      margin: 0;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }

    .key-highlights {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 32px;
    }

    .highlight-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 20px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      transition: all 0.3s ease;
    }

    .highlight-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 20px rgba(24, 45, 23, 0.15);
    }

    .card-icon {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      flex-shrink: 0;
    }

    .submissions-icon {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    }

    .demand-icon {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }

    .team-leaders-icon {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }

    .card-content {
      flex: 1;
    }

    .card-label {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .card-value {
      font-size: 32px;
      font-weight: 800;
      color: #111827;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }

    .chart-card {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      transition: all 0.3s ease;
    }

    .chart-card:hover {
      box-shadow: 0 10px 20px rgba(24, 45, 23, 0.15);
    }

    .chart-card-full {
      grid-column: 1 / -1;
    }

    .chart-header {
      margin-bottom: 20px;
    }

    .chart-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin: 0 0 12px 0;
    }

    .chart-filters {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-top: 8px;
    }

    .filter-container {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 10px 14px;
      background: rgba(249, 250, 251, 0.8);
      border-radius: 10px;
      border: 1px solid rgba(24, 45, 23, 0.08);
    }

    .filter-group-view {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .filter-group-month {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .filter-label {
      font-size: 13px;
      font-weight: 500;
      color: #4b5563;
      white-space: nowrap;
    }

    .radio-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .radio-label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #4b5563;
      position: relative;
    }

    .radio-label input[type="radio"] {
      width: 16px;
      height: 16px;
      margin: 0;
      cursor: pointer;
      appearance: none;
      border: 2px solid rgba(24, 45, 23, 0.3);
      border-radius: 50%;
      background: white;
      position: relative;
      transition: all 0.2s ease;
    }

    .radio-label input[type="radio"]:checked {
      border-color: #182D17;
      background: white;
    }

    .radio-label input[type="radio"]:checked::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #182D17;
    }

    .radio-label input[type="radio"]:hover {
      border-color: #182D17;
    }

    .radio-label span {
      user-select: none;
      font-weight: 400;
    }

    .filter-dropdown-month {
      padding: 6px 32px 6px 10px;
      border: 1px solid rgba(24, 45, 23, 0.2);
      border-radius: 6px;
      background: white;
      color: #111827;
      font-size: 13px;
      font-weight: 400;
      cursor: pointer;
      transition: all 0.2s ease;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23111111' d='M5 7L1 3h8z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      background-size: 10px;
      min-width: 100px;
    }

    .filter-dropdown-month:hover {
      border-color: rgba(24, 45, 23, 0.3);
    }

    .filter-dropdown-month:focus {
      outline: none;
      border-color: #182D17;
      box-shadow: 0 0 0 2px rgba(24, 45, 23, 0.1);
    }

    .filter-dropdown-month option {
      padding: 8px;
      background: white;
      color: #111827;
    }

    .chart-container {
      width: 100%;
      height: 350px;
      position: relative;
      min-height: 350px;
    }
    
    .chart-container svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* Tooltip */
    .chart-tooltip {
      position: absolute;
      padding: 12px 16px;
      background: rgba(24, 45, 23, 0.95);
      color: #fff;
      border-radius: 8px;
      font-size: 12px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .chart-tooltip.visible {
      opacity: 1;
    }

    .chart-tooltip .tooltip-title {
      font-weight: 600;
      margin-bottom: 4px;
    }

    .chart-tooltip .tooltip-item {
      margin: 2px 0;
    }

    @media (max-width: 1200px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) { 
      .dashboard-container {
        padding: 16px;
      }

      .key-highlights {
        grid-template-columns: repeat(3, 1fr);
      }

      .chart-container {
        height: 300px;
      }
    }
  `]
})
export class BusinessHeadDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private businessHeadService = inject(BusinessHeadService);
  totalSubmissions = signal<number>(0);
  currentDemand = signal<number>(0);
  numberOfManagers = signal<number>(0);
  
  // View filters for each chart (Daily, Weekly, Monthly)
  dailyTrendView: string = 'monthly';
  demandManagersView: string = 'monthly';
  demandSpocsView: string = 'monthly';
  demandStatusView: string = 'monthly';
  demandSkillView: string = 'monthly';
  submissionsManagersView: string = 'monthly';
  submissionsSpocsView: string = 'monthly';

  // Month selection for monthly view
  dailyTrendMonth: string = 'all';
  demandManagersMonth: string = 'all';
  demandSpocsMonth: string = 'all';
  demandStatusMonth: string = 'all';
  demandSkillMonth: string = 'all';
  submissionsManagersMonth: string = 'all';
  submissionsSpocsMonth: string = 'all';

  // Month options
  monthOptions = [
    { value: 'all', label: 'All' },
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' }
  ];
  
  private chartSvgs: Map<string, any> = new Map();
  private tooltip: any = null;
  private kudzuColors = [
    '#182D17', // kudzu-primary
    '#122314', // kudzu-primary-dark
    '#10b981', // green
    '#6366f1', // indigo
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#f97316', // orange
    '#14b8a6', // teal
    '#ec4899', // pink
    '#a855f7', // violet
    '#d946ef', // fuchsia
    '#eab308', // yellow
  ];

  // Color mapping for specific status values
  private statusColors: { [key: string]: string } = {
    'open': '#10b981',      // emerald green
    'closed': '#ef4444',    // red
    'processing': '#3b82f6', // blue
    'assigned': '#f59e0b',   // amber
    'idle': '#6b7280',       // gray
    'pending': '#f97316',    // orange
  };

  private recruiterChartColors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#14b8a6', // teal
    '#ec4899', // pink
    '#6366f1', // indigo
  ];

  ngOnInit(): void {
    // Component initialization
  }

  ngAfterViewInit(): void {
    this.tooltip = d3.select('#chart-tooltip');
    setTimeout(() => {
      this.loadDashboardData();
    }, 100);
  }

  ngOnDestroy(): void {
    this.chartSvgs.forEach((svg) => {
      if (svg) svg.remove();
    });
    this.chartSvgs.clear();
  }

  // Helper method to calculate date range from view and month selection
  getDateRange(view: string, month: string = 'all'): { startDate?: string; endDate?: string } {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    // If month is specified (not 'all'), filter by that month
    if (month !== 'all') {
      const monthIndex = parseInt(month);
      const currentYear = now.getFullYear();
      const monthStart = new Date(currentYear, monthIndex, 1);
      const monthEnd = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);

      switch (view) {
        case 'daily':
          // Show all days in the selected month for daily view
          startDate = monthStart;
          endDate = monthEnd;
          break;
        
        case 'weekly':
          // Show all weeks that overlap with the selected month
          // Start from the first day of the month, end on the last day
          startDate = monthStart;
          endDate = monthEnd;
          break;
        
        case 'monthly':
          // Specific month selected for monthly view
          startDate = monthStart;
          endDate = monthEnd;
          break;
        
        default:
          return {};
      }
    } else {
      // Month is 'all', use default date ranges based on view
      switch (view) {
        case 'daily':
          // Last 30 days for daily view
          startDate.setDate(now.getDate() - 30);
          endDate.setHours(23, 59, 59, 999);
          break;
        
        case 'weekly':
          // Last 12 weeks for weekly view
          startDate.setDate(now.getDate() - (12 * 7));
          endDate.setHours(23, 59, 59, 999);
          break;
        
        case 'monthly':
          // Last 12 months for monthly view (all months) - go back 12 months from today
          startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        
        default:
          return {};
      }
    }

    startDate.setHours(0, 0, 0, 0);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  loadDashboardData(): void {
    // Load key highlights (no filters)
    this.businessHeadService.getKeyHighlights().subscribe({
      next: (data: any) => {
        console.log('Business Head Key Highlights Response:', data);
        this.totalSubmissions.set(data?.total_submissions ?? 0);
        this.currentDemand.set(data?.current_demand ?? 0);
        this.numberOfManagers.set(data?.number_of_managers ?? 0);
        console.log('Business Head Signals updated:', {
          totalSubmissions: this.totalSubmissions(),
          currentDemand: this.currentDemand(),
          numberOfManagers: this.numberOfManagers()
        });
      },
      error: (error: any) => {
        console.error('Error loading Business Head key highlights:', error);
        // Set defaults on error
        this.totalSubmissions.set(0);
        this.currentDemand.set(0);
        this.numberOfManagers.set(0);
      }
    });

    // Load and render all charts (no filters)
    this.loadDailyTrendChart();
    this.loadDemandByManagersChart();
    this.loadDemandBySpocsChart();
    this.loadDemandByStatusChart();
    this.loadDemandBySkillChart();
    this.loadSubmissionsByManagersChart();
    this.loadSubmissionsBySpocsChart();
  }

  loadDailyTrendChart(): void {
    const dateRange = this.getDateRange(this.dailyTrendView, this.dailyTrendMonth);
    this.businessHeadService.getDailySubmissionsTrend(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.daily_trend || [];
        console.log('Daily Submissions Trend data:', data);
        console.log('Date range:', dateRange);
        if (data && data.length > 0) {
          this.renderLineChart('daily-trend-chart', data);
        } else {
          console.warn('No data in daily_trend array');
          this.showEmptyState('daily-trend-chart', 'No submission data available');
        }
      },
      error: (error: any) => {
        console.error('Error loading daily trend:', error);
        this.showEmptyState('daily-trend-chart', 'No submission data available');
      }
    });
  }

  loadDemandByManagersChart(): void {
    const dateRange = this.getDateRange(this.demandManagersView, this.demandManagersMonth);
    this.businessHeadService.getDemandByManagers(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.distribution || [];
        this.renderPieChart('demand-managers-chart', data, 'manager_name', 'count', 'percentage', true);
      },
      error: (error: any) => {
        console.error('Error loading demand by managers:', error);
        this.showEmptyState('demand-managers-chart', 'No demand data available');
      }
    });
  }

  loadDemandBySpocsChart(): void {
    const dateRange = this.getDateRange(this.demandSpocsView, this.demandSpocsMonth);
    this.businessHeadService.getDemandBySpocs(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.distribution || [];
        this.renderPieChart('demand-spocs-chart', data, 'spoc_name', 'count', 'percentage', true);
      },
      error: (error: any) => {
        console.error('Error loading demand by SPOCs:', error);
        this.showEmptyState('demand-spocs-chart', 'No demand data available');
      }
    });
  }

  loadDemandByStatusChart(): void {
    const dateRange = this.getDateRange(this.demandStatusView, this.demandStatusMonth);
    this.businessHeadService.getDemandByStatus(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.status_counts || [];
        console.log('Demand by Status data:', data);
        if (data && data.length > 0) {
          this.renderBarChart('demand-status-chart', data, 'status', 'count', 'Status', 'Count');
        } else {
          this.showEmptyState('demand-status-chart', 'No status data available');
        }
      },
      error: (error: any) => {
        console.error('Error loading demand by status:', error);
        this.showEmptyState('demand-status-chart', 'No status data available');
      }
    });
  }

  loadDemandBySkillChart(): void {
    const dateRange = this.getDateRange(this.demandSkillView, this.demandSkillMonth);
    this.businessHeadService.getDemandBySkill(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.skill_distribution || [];
        this.renderDonutChart('demand-skill-chart', data, 'skill', 'count', 'percentage');
      },
      error: (error: any) => {
        console.error('Error loading demand by skill:', error);
        this.showEmptyState('demand-skill-chart', 'No skill data available');
      }
    });
  }

  loadSubmissionsByManagersChart(): void {
    const dateRange = this.getDateRange(this.submissionsManagersView, this.submissionsManagersMonth);
    this.businessHeadService.getSubmissionsByManagers(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.manager_submissions || [];
        this.renderBarChart('submissions-managers-chart', data, 'manager_name', 'count', 'Manager', 'Submissions');
      },
      error: (error: any) => {
        console.error('Error loading submissions by managers:', error);
        this.showEmptyState('submissions-managers-chart', 'No submission data available');
      }
    });
  }

  loadSubmissionsBySpocsChart(): void {
    const dateRange = this.getDateRange(this.submissionsSpocsView, this.submissionsSpocsMonth);
    this.businessHeadService.getSubmissionsBySpocs(
      dateRange.startDate,
      dateRange.endDate
    ).subscribe({
      next: (response: any) => {
        const data = response.spoc_submissions || [];
        this.renderBarChart('submissions-spocs-chart', data, 'spoc_name', 'count', 'SPOC', 'Submissions');
      },
      error: (error: any) => {
        console.error('Error loading submissions by SPOCs:', error);
        this.showEmptyState('submissions-spocs-chart', 'No submission data available');
      }
    });
  }

  // Filter change handlers
  onDailyTrendFilterChange(): void {
    this.loadDailyTrendChart();
  }

  onDemandManagersFilterChange(): void {
    this.loadDemandByManagersChart();
  }

  onDemandSpocsFilterChange(): void {
    this.loadDemandBySpocsChart();
  }

  onDemandStatusFilterChange(): void {
    this.loadDemandByStatusChart();
  }

  onDemandSkillFilterChange(): void {
    this.loadDemandBySkillChart();
  }

  onSubmissionsManagersFilterChange(): void {
    this.loadSubmissionsByManagersChart();
  }

  onSubmissionsSpocsFilterChange(): void {
    this.loadSubmissionsBySpocsChart();
  }

  showEmptyState(chartId: string, message: string): void {
    const container = d3.select(`#${chartId}`);
    container.selectAll('*').remove();
    container.append('div')
      .style('text-align', 'center')
      .style('padding-top', '150px')
      .style('color', '#6b7280')
      .style('font-size', '14px')
      .text(message);
  }

  renderLineChart(containerId: string, data: Array<{ date: string; count: number; managers?: Array<{ manager_name: string; count: number }> }>): void {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();

    if (!data || data.length === 0) {
      this.showEmptyState(containerId, 'No data available');
      return;
    }

    const containerElement = document.getElementById(containerId);
    if (!containerElement) return;
    
    const containerWidth = containerElement.clientWidth || 600;
    const containerHeight = containerElement.clientHeight || 350;
    
    // Filter out invalid dates and sort
    const validData = data.filter(d => {
      if (!d.date) return false;
      const date = new Date(d.date);
      return !isNaN(date.getTime());
    });
    
    if (validData.length === 0) {
      this.showEmptyState(containerId, 'No valid data available');
      return;
    }
    
    const sortedData = [...validData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
      .style('display', 'block');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get date extent
    const dateExtent = d3.extent(sortedData, d => new Date(d.date));
    if (!dateExtent[0] || !dateExtent[1]) {
      this.showEmptyState(containerId, 'Invalid date range');
      return;
    }

    const xScale = d3.scaleTime()
      .domain(dateExtent as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(sortedData, d => d.count) || 0] as [number, number])
      .nice()
      .range([height, 0]);

    const line = d3.line<{ date: string; count: number }>()
      .x(d => xScale(new Date(d.date)))
      .y(d => yScale(d.count))
      .curve(d3.curveMonotoneX);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
        .tickSize(-height)
        .tickFormat(() => ''))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.1)
      .style('stroke', '#182D17');

    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => ''))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.1)
      .style('stroke', '#182D17');

    // Line
    g.append('path')
      .datum(sortedData)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2.5)
      .attr('d', line)
      .style('transition', 'all 0.3s ease');

    // Dots with hover
    g.selectAll('.dot')
      .data(sortedData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(new Date(d.date)))
      .attr('cy', d => yScale(d.count))
      .attr('r', 4)
      .attr('fill', '#6366f1')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        const tooltipContent = `
          <div class="tooltip-title">${d3.timeFormat('%b %d, %Y')(new Date(d.date))}</div>
          <div class="tooltip-item">Total: ${d.count}</div>
          ${d.managers && d.managers.length > 0 ? d.managers.map(r => `<div class="tooltip-item">${r.manager_name}: ${r.count}</div>`).join('') : ''}
        `;
        this.showTooltip(event, tooltipContent);
        d3.select(event.currentTarget).attr('r', 6);
      })
      .on('mouseout', (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget).attr('r', 4);
      });

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat((d: Date | d3.NumberValue) => {
        if (d instanceof Date) {
          return d3.timeFormat('%b %d')(d);
        }
        return '';
      }))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

    // Y axis with numeric scale
    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => d.toString()))
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

    // Axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#4b5563')
      .text('Submissions');

    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#4b5563')
      .text('Date');

    this.chartSvgs.set(containerId, svg);
  }

  renderPieChart(containerId: string, data: any[], labelKey: string, valueKey: string, percentageKey?: string, useAlternateColors: boolean = false): void {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();

    if (!data || data.length === 0) {
      this.showEmptyState(containerId, 'No data available');
      return;
    }

    const containerElement = document.getElementById(containerId);
    if (!containerElement) return;
    
    // Create flex container for legend and chart
    const flexContainer = container.append('div')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '6px')
      .style('width', '100%')
      .style('height', '100%');

    // Legend container on the left
    const legendContainer = flexContainer.append('div')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('flex-wrap', 'wrap')
      .style('gap', '10px')
      .style('min-width', '110px')
      .style('max-width', '130px')
      .style('align-items', 'flex-start');

    // Chart container on the right
    const chartContainer = flexContainer.append('div')
      .style('flex', '1')
      .style('display', 'flex')
      .style('justify-content', 'flex-start')
      .style('align-items', 'center');

    const containerWidth = containerElement.clientWidth || 350;
    const containerHeight = containerElement.clientHeight || 350;
    const chartSize = Math.min(containerWidth - 130, containerHeight); // Reserve minimal space for legend
    const width = chartSize;
    const height = chartSize;
    const radius = Math.min(width, height) / 2 - 40;

    const svg = chartContainer.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('display', 'block')
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<any>()
      .value(d => d[valueKey])
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(0)
      .outerRadius(radius);

    const arcs = svg.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    const colorPalette = useAlternateColors ? this.recruiterChartColors : this.kudzuColors;
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colorPalette[i % colorPalette.length])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('transition', 'all 0.3s ease')
      .on('mouseover', (event, d) => {
        const percentage = percentageKey ? d.data[percentageKey] : ((d.data[valueKey] / d3.sum(data, x => x[valueKey]) * 100).toFixed(1));
        const tooltipContent = `
          <div class="tooltip-title">${d.data[labelKey]}</div>
          <div class="tooltip-item">Count: ${d.data[valueKey]}</div>
          <div class="tooltip-item">Percentage: ${percentage}%</div>
        `;
        this.showTooltip(event, tooltipContent);
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('transform', `scale(1.05)`);
      })
      .on('mouseout', (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('transform', 'scale(1)');
      });

    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('dy', '.35em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#111827')
      .style('font-weight', '500')
      .text(d => d.data[labelKey]);

    // Legend items (already created above, now populate)
    data.forEach((d, i) => {
      const legendItem = legendContainer.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '8px');

      legendItem.append('div')
        .style('width', '12px')
        .style('height', '12px')
        .style('border-radius', '2px')
        .style('background', useAlternateColors ? this.recruiterChartColors[i % this.recruiterChartColors.length] : this.kudzuColors[i % this.kudzuColors.length]);

      legendItem.append('span')
        .style('font-size', '12px')
        .style('color', '#6b7280')
        .text(`${d[labelKey]}: ${d[valueKey]}`);
    });

    this.chartSvgs.set(containerId, svg);
  }

  renderDonutChart(containerId: string, data: any[], labelKey: string, valueKey: string, percentageKey?: string, useAlternateColors: boolean = false): void {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();

    if (!data || data.length === 0) {
      this.showEmptyState(containerId, 'No data available');
      return;
    }

    const containerElement = document.getElementById(containerId);
    if (!containerElement) return;
    
    // Create flex container for legend and chart
    const flexContainer = container.append('div')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '6px')
      .style('width', '100%')
      .style('height', '100%');

    // Legend container on the left
    const legendContainer = flexContainer.append('div')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('flex-wrap', 'wrap')
      .style('gap', '10px')
      .style('min-width', '110px')
      .style('max-width', '130px')
      .style('align-items', 'flex-start');

    // Chart container on the right
    const chartContainer = flexContainer.append('div')
      .style('flex', '1')
      .style('display', 'flex')
      .style('justify-content', 'flex-start')
      .style('align-items', 'center');

    const containerWidth = containerElement.clientWidth || 350;
    const containerHeight = containerElement.clientHeight || 350;
    const chartSize = Math.min(containerWidth - 130, containerHeight); // Reserve minimal space for legend
    const width = chartSize;
    const height = chartSize;
    const radius = Math.min(width, height) / 2 - 40;
    const innerRadius = radius * 0.6;

    const svg = chartContainer.append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('display', 'block')
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<any>()
      .value(d => d[valueKey])
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcs = svg.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    const donutColorPalette = useAlternateColors ? this.recruiterChartColors : this.kudzuColors;
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => donutColorPalette[i % donutColorPalette.length])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('transition', 'all 0.3s ease')
      .on('mouseover', (event, d) => {
        const percentage = percentageKey ? d.data[percentageKey] : ((d.data[valueKey] / d3.sum(data, x => x[valueKey]) * 100).toFixed(1));
        const tooltipContent = `
          <div class="tooltip-title">${d.data[labelKey]}</div>
          <div class="tooltip-item">Count: ${d.data[valueKey]}</div>
          <div class="tooltip-item">Percentage: ${percentage}%</div>
        `;
        this.showTooltip(event, tooltipContent);
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('transform', `scale(1.05)`);
      })
      .on('mouseout', (event) => {
        this.hideTooltip();
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('transform', 'scale(1)');
      });

    // Center text
    const total = d3.sum(data, d => d[valueKey]);
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .style('font-size', '24px')
      .style('font-weight', '700')
      .style('fill', '#111827')
      .text(total);

    // Legend items (already created above, now populate)
    data.forEach((d, i) => {
      const legendItem = legendContainer.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '8px');

      legendItem.append('div')
        .style('width', '12px')
        .style('height', '12px')
        .style('border-radius', '2px')
        .style('background', donutColorPalette[i % donutColorPalette.length]);

      legendItem.append('span')
        .style('font-size', '12px')
        .style('color', '#6b7280')
        .text(`${d[labelKey]}: ${d[valueKey]}`);
    });

    this.chartSvgs.set(containerId, svg);
  }

  renderBarChart(containerId: string, data: any[], xKey: string, yKey: string, xLabel: string, yLabel: string): void {
    const container = d3.select(`#${containerId}`);
    container.selectAll('*').remove();

    if (!data || data.length === 0) {
      this.showEmptyState(containerId, 'No data available');
      return;
    }

    const containerElement = document.getElementById(containerId);
    if (!containerElement) return;
    
    // Create flex container for legend and chart
    const flexContainer = container.append('div')
      .style('display', 'flex')
      .style('align-items', 'flex-start')
      .style('gap', '6px')
      .style('width', '100%')
      .style('height', '100%');

    // Legend container on the left
    const legendContainer = flexContainer.append('div')
      .style('display', 'flex')
      .style('flex-direction', 'column')
      .style('flex-wrap', 'wrap')
      .style('gap', '10px')
      .style('min-width', '110px')
      .style('max-width', '130px')
      .style('align-items', 'flex-start')
      .style('padding-top', '20px');

    // Chart container on the right
    const chartContainer = flexContainer.append('div')
      .style('flex', '1')
      .style('display', 'flex')
      .style('justify-content', 'flex-start')
      .style('align-items', 'center');

    const containerWidth = containerElement.clientWidth || 600;
    const containerHeight = containerElement.clientHeight || 350;
    const chartAreaWidth = containerWidth - 130; // Reserve minimal space for legend

    const margin = { top: 20, right: 30, bottom: 80, left: 60 };
    const width = chartAreaWidth;
    const chartWidth = width - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = chartContainer.append('svg')
      .attr('width', width)
      .attr('height', containerHeight)
      .attr('viewBox', `0 0 ${width} ${containerHeight}`)
      .style('display', 'block');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(data.map(d => d[xKey]))
      .range([0, chartWidth])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[yKey]) || 0] as [number, number])
      .nice()
      .range([height, 0]);

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale)
        .tickSize(-chartWidth)
        .tickFormat(() => ''))
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.1)
      .style('stroke', '#182D17');

    // Helper function to get color for a bar
    const getBarColor = (d: any, index: number): string => {
      const keyValue = String(d[xKey]).toLowerCase();
      
      // Check if it's a status chart and use status-specific colors
      if (containerId === 'demand-status-chart' && this.statusColors[keyValue]) {
        return this.statusColors[keyValue];
      }
      
      // Use recruiterChartColors for submissions by Managers chart
      if (containerId === 'submissions-managers-chart') {
        return this.recruiterChartColors[index % this.recruiterChartColors.length];
      }
      
      // Use recruiterChartColors for submissions by SPOCs chart
      if (containerId === 'submissions-spocs-chart') {
        return this.recruiterChartColors[index % this.recruiterChartColors.length];
      }
      
      // Otherwise use index-based colors from kudzuColors array
      return this.kudzuColors[index % this.kudzuColors.length];
    };

    // Bars
    const bars = g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d[xKey]) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', d => yScale(d[yKey]))
      .attr('height', d => height - yScale(d[yKey]))
      .attr('fill', (d, i) => getBarColor(d, i))
      .style('transition', 'all 0.3s ease')
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        const tooltipContent = `
          <div class="tooltip-title">${d[xKey]}</div>
          <div class="tooltip-item">${yLabel}: ${d[yKey]}</div>
        `;
        this.showTooltip(event, tooltipContent);
        const currentColor = getBarColor(d, data.indexOf(d));
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('fill', d3.rgb(currentColor).brighter(0.3).toString());
      })
      .on('mouseout', (event, d) => {
        this.hideTooltip();
        const originalColor = getBarColor(d, data.indexOf(d));
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('fill', originalColor);
      });

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

    // Y axis with numeric scale
    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => d.toString()))
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

    // Axis labels
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0 - margin.left)
      .attr('x', 0 - (height / 2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#4b5563')
      .text(yLabel);

    g.append('text')
      .attr('transform', `translate(${chartWidth / 2}, ${height + margin.bottom - 10})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#4b5563')
      .text(xLabel);

    // Legend on the left
    data.forEach((d, i) => {
      const legendItem = legendContainer.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '8px');

      const barColor = getBarColor(d, i);
      legendItem.append('div')
        .style('width', '12px')
        .style('height', '12px')
        .style('border-radius', '2px')
        .style('background', barColor);

      legendItem.append('span')
        .style('font-size', '12px')
        .style('color', '#6b7280')
        .text(`${d[xKey]}: ${d[yKey]}`);
    });

    this.chartSvgs.set(containerId, svg);
  }

  showTooltip(event: any, content: string): void {
    this.tooltip
      .html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .classed('visible', true);
  }

  hideTooltip(): void {
    this.tooltip.classed('visible', false);
  }
}
