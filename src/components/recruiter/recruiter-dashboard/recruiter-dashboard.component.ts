import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { DashboardService } from '../../../services/dashboard.service';
import { environment } from '../../../environments/environment';
import * as d3 from 'd3';

interface DashboardSummary {
  total_demands: number;
  total_cvs: number;
  approved: number;
  under_verification: number;
  rejected: number;
  approval_rate: number;
}

interface DemandData {
  demand_id: number;
  job_title: string;
  client_name?: string;
  skill: string;
  no_of_positions: number;
  priority: string;
  demand_status: string;
  required_cv_count: number;
  uploaded_cv_count: number;
  progress_percentage: number;
  cv_stats: {
    total: number;
    approved: number;
    under_verification: number;
    rejected: number;
  };
}

interface TimeSeriesData {
  date: string;
  daily_uploads: number;
}

interface Activity {
  id: number;
  recruiter_id: number;
  demand_id: number;
  activity_status: string;
  opened_at: string;
  cv_list: any[];
  job_title: string;
  client_name: string;
  skill: string;
  no_of_positions: number;
  priority: string;
  demand_status: string;
  required_cv_count: number;
  uploaded_cv_count: number;
  progress_percentage: number;
  cv_stats: {
    total: number;
    approved: number;
    under_verification: number;
    rejected: number;
  };
}

interface DashboardData {
  summary: DashboardSummary;
  activities: Activity[];
  trend_data: TimeSeriesData[];
}

@Component({
  selector: 'app-recruiter-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-info">
          <h1>Recruiter Dashboard</h1>
          <div class="recruiter-info" *ngIf="currentUser">
            <span class="recruiter-name">{{ currentUser.first_name || 'Recruiter' }} {{ currentUser.last_name || '' }}</span>
            <span class="recruiter-role">Recruiter</span>
          </div>
        </div>
        <div class="header-controls">
          <div class="date-range-selector">
            <label>Filter:</label>
            <select [(ngModel)]="selectedDays" (change)="onDateRangeChange()">
              <option value="1">Daily</option>
              <option value="7">Weekly</option>
              <option value="30" selected>Monthly</option>
            </select>
          </div>
          <button class="refresh-btn" (click)="refreshData()" [disabled]="loading">
            <svg class="icon" [class.spinning]="loading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-container">
        <div class="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error" class="error-container">
        <div class="error-message">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p>{{ error }}</p>
          <button class="retry-btn" (click)="refreshData()">Retry</button>
        </div>
      </div>

      <!-- Dashboard Content -->
      <div *ngIf="!loading && !error && dashboardData" class="dashboard-content">
        <!-- KPI Cards -->
        <div class="kpi-cards">
          <div class="kpi-card">
            <div class="kpi-icon open">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="kpi-content">
              <h3>{{ dashboardData.summary.total_demands }}</h3>
              <p>Total Demands</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon uploads">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div class="kpi-content">
              <h3>{{ dashboardData.summary.total_cvs }}</h3>
              <p>Total CVs</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon approvals">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="kpi-content">
              <h3>{{ dashboardData.summary.approved }}</h3>
              <p>Approved CVs</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon verification">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="kpi-content">
              <h3>{{ dashboardData.summary.under_verification }}</h3>
              <p>Under Verification</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon rejections">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="kpi-content">
              <h3>{{ dashboardData.summary.rejected }}</h3>
              <p>Rejected CVs</p>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
          <!-- Pie Chart - CV Status Overview -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>🥧 CV Status Overview</h3>
            </div>
            <div #pieChart class="chart" id="pie-chart"></div>
          </div>

          <!-- Bar Chart - CVs per Demand -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>📊 CVs per Demand</h3>
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-color required"></span>
                  Required
                </span>
                <span class="legend-item">
                  <span class="legend-color uploaded"></span>
                  Uploaded
                </span>
                <span class="legend-item">
                  <span class="legend-color approved"></span>
                  Approved
                </span>
              </div>
            </div>
            <div #barChart class="chart" id="bar-chart"></div>
          </div>

          <!-- Stacked Bar Chart - Required vs Uploaded CVs -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>🧱 Required vs Uploaded CVs</h3>
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-color required"></span>
                  Required
                </span>
                <span class="legend-item">
                  <span class="legend-color uploaded"></span>
                  Uploaded
                </span>
              </div>
            </div>
            <div #stackedBarChart class="chart" id="stacked-bar-chart"></div>
          </div>

          <!-- Line Chart - CV Uploads Trend -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>📈 CV Uploads Trend</h3>
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-color uploads"></span>
                  Daily Uploads
                </span>
              </div>
            </div>
            <div #lineChart class="chart" id="line-chart"></div>
          </div>
        </div>

        <!-- Activities Table -->
        <div class="demands-table-container">
          <div class="table-header">
            <h3>Active Demands</h3>
            <div class="table-controls">
              <input type="text" placeholder="Search demands..." [(ngModel)]="searchTerm" (input)="filterDemands()">
              <select [(ngModel)]="statusFilter" (change)="filterDemands()">
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="processing">Processing</option>
                <option value="hold">Hold</option>
              </select>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="demands-table">
              <thead>
                <tr>
                  <th>Demand ID</th>
                  <th>Job Title</th>
                  <th>Client</th>
                  <th>Required CVs</th>
                  <th>Uploaded CVs</th>
                  <th>Status</th>
                  <th>Progress (%)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let activity of filteredActivities" (click)="selectActivity(activity)">
                  <td>
                    <span class="demand-id">#{{ activity.demand_id }}</span>
                  </td>
                  <td>
                    <div class="demand-title">{{ activity.job_title }}</div>
                    <div class="demand-skill">{{ activity.skill }}</div>
                  </td>
                  <td>{{ activity.client_name || 'N/A' }}</td>
                  <td>{{ activity.required_cv_count }}</td>
                  <td>{{ activity.uploaded_cv_count }}</td>
                  <td>
                    <span class="status-badge" [ngClass]="getStatusClass(activity.activity_status)">
                      {{ activity.activity_status }}
                    </span>
                  </td>
                  <td>
                    <div class="progress-container">
                      <div class="progress-bar">
                        <div class="progress-fill" [style.width.%]="activity.progress_percentage"></div>
                      </div>
                      <span class="progress-text">{{ activity.progress_percentage }}%</span>
                    </div>
                  </td>
                  <td>
                    <button class="action-btn" (click)="$event.stopPropagation(); viewActivityDetails(activity)" title="View Details">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div *ngIf="filteredActivities.length === 0" class="no-data">
              <p>No activities found matching your criteria</p>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data State -->
      <div *ngIf="!loading && !error && !dashboardData" class="no-data-container">
        <div class="no-data-message">
          <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3>No Data Available</h3>
          <p>No data available for the selected date range</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 20px;
      background: #f8fafc;
      min-height: 100vh;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .header-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dashboard-header h1 {
      margin: 0;
      color: #1e293b;
      font-size: 28px;
      font-weight: 600;
    }

    .recruiter-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .recruiter-name {
      font-size: 16px;
      font-weight: 500;
      color: #374151;
    }

    .recruiter-role {
      font-size: 14px;
      color: #6b7280;
      background: #f3f4f6;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-block;
      width: fit-content;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .date-range-selector {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .date-range-selector label {
      font-weight: 500;
      color: #64748b;
    }

    .date-range-selector select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: white;
      color: #374151;
    }

    .refresh-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: linear-gradient(226deg, rgb(0, 242, 166) -141%, rgb(28, 35, 53) 100%);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
    }

    .refresh-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .refresh-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px rgba(24, 45, 23, 0.1);
    }

    .refresh-btn:hover:not(:disabled)::before {
      left: 100%;
    }

    .refresh-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .icon {
      width: 20px;
      height: 20px;
    }

    .icon.spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .loading-container, .error-container, .no-data-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }

    .error-message, .no-data-message {
      text-align: center;
      color: #6b7280;
    }

    .error-message .icon, .no-data-message .icon {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: #ef4444;
    }

    .retry-btn {
      margin-top: 16px;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }

    .kpi-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
    }

    .kpi-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .kpi-icon.open { background: #dbeafe; color: #1d4ed8; }
    .kpi-icon.closed { background: #dcfce7; color: #16a34a; }
    .kpi-icon.uploads { background: #fef3c7; color: #d97706; }
    .kpi-icon.approvals { background: #dcfce7; color: #22c55e; }
    .kpi-icon.verification { background: #dbeafe; color: #3b82f6; }
    .kpi-icon.rejections { background: #fee2e2; color: #ef4444; }

    .kpi-content h3 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }

    .kpi-content p {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 14px;
    }

    .charts-section {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
      width: 100%;
    }

    .chart-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
      width: 100%;
      min-height: 450px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .chart-header h3 {
      margin: 0;
      color: #1e293b;
      font-size: 18px;
      font-weight: 600;
    }

    .chart-legend {
      display: flex;
      gap: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #64748b;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .legend-color.required { background: #3b82f6; }
    .legend-color.uploaded { background: #f59e0b; }
    .legend-color.approved { background: #22c55e; }
    .legend-color.uploads { background: #3b82f6; }
    .legend-color.approvals { background: #22c55e; }
    .legend-color.rejections { background: #ef4444; }

    .chart {
      height: 400px;
      padding: 20px;
      min-width: 100%;
    }

    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
    }

    .demands-table-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .table-header h3 {
      margin: 0;
      color: #1e293b;
      font-size: 18px;
      font-weight: 600;
    }

    .table-controls {
      display: flex;
      gap: 12px;
    }

    .table-controls input, .table-controls select {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    .demands-table {
      width: 100%;
      border-collapse: collapse;
    }

    .demands-table th {
      background: #f8fafc;
      padding: 12px 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
    }

    .demands-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f3f4f6;
    }

    .demands-table tbody tr {
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .demands-table tbody tr:hover {
      background: #f8fafc;
    }

    .demand-title {
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 2px;
    }

    .demand-skill {
      font-size: 12px;
      color: #64748b;
    }

    .demand-id {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-badge.open { background: #dbeafe; color: #1d4ed8; }
    .status-badge.processing { background: #d1fae5; color: #065f46; }
    .status-badge.hold { background: #fef3c7; color: #facc15; }
    .status-badge.closed { background: #dcfce7; color: #16a34a; }

    .progress-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 80px;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e5e7eb;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 4px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      transition: width 0.3s;
      border-radius: 3px;
    }

    .progress-text {
      font-size: 12px;
      color: #64748b;
    }

    .action-btn {
      padding: 6px;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: #e5e7eb;
    }

    .action-btn .icon {
      width: 16px;
      height: 16px;
    }

    .no-data {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }

    @media (max-width: 768px) {
      .dashboard-container {
        padding: 10px;
      }

      .dashboard-header {
        flex-direction: column;
        gap: 20px;
        align-items: stretch;
      }

      .header-info {
        align-items: center;
        text-align: center;
      }

      .header-controls {
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
      }

      .charts-section {
        grid-template-columns: 1fr;
        gap: 15px;
      }

      .chart-container {
        min-height: 400px;
      }

      .chart {
        height: 350px;
      }

      .kpi-cards {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .table-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .table-controls {
        justify-content: stretch;
      }

      .table-controls input, .table-controls select {
        flex: 1;
      }
    }
  `]
})
export class RecruiterDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('barChart') barChartRef!: ElementRef;
  @ViewChild('lineChart') lineChartRef!: ElementRef;
  @ViewChild('pieChart') pieChartRef!: ElementRef;
  @ViewChild('stackedBarChart') stackedBarChartRef!: ElementRef;

  dashboardData: DashboardData | null = null;
  loading = false;
  error: string | null = null;
  selectedDays = 30;
  searchTerm = '';
  statusFilter = '';
  filteredActivities: Activity[] = [];

  private apiUrl = environment.apiBase;
  currentUser: any;
  private resizeTimeout: any;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private dashboardService: DashboardService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('Dashboard component initializing...');
    console.log('Token exists:', !!localStorage.getItem('access_token'));
    
    // Validate token exists and is not expired
    const token = localStorage.getItem('access_token');
    const expiresAt = localStorage.getItem('expires_at');
    
    if (token && expiresAt) {
      const expiresTime = new Date(expiresAt).getTime();
      const now = new Date().getTime();
      if (now >= expiresTime) {
        console.error('Token has expired');
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_type');
        localStorage.removeItem('expires_at');
        this.error = 'Session expired. Please log in again.';
        setTimeout(() => {
          this.router.navigate(['/signin']);
        }, 2000);
        return;
      }
    }
    
    // First try to get user ID directly
    const directUserId = this.authService.getCurrentUserId();
    console.log('Direct user ID from token:', directUserId);
    
    if (directUserId && directUserId !== null && directUserId !== undefined) {
      this.currentUser = { id: directUserId };
      console.log('Using direct user ID:', directUserId);
      this.loadDashboardData();
      return;
    }
    
    // If no valid ID found from direct method, clear localStorage and redirect
    if (!localStorage.getItem('access_token')) {
      console.error('No access token found in localStorage');
      this.error = 'Please log in to continue';
      setTimeout(() => {
        this.router.navigate(['/signin']);
      }, 2000);
      return;
    }
    
    // If direct method fails, try the Observable method
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        console.log('Current user from auth service Observable:', user);
        this.currentUser = user;
        
        // CRITICAL: Only load dashboard data if we have a valid user ID
        if (this.currentUser && this.currentUser.id) {
          this.loadDashboardData();
        } else {
          console.error('No valid user ID found. Redirecting to login.');
          this.error = 'User not authenticated. Redirecting to login...';
          setTimeout(() => {
            this.router.navigate(['/signin']);
          }, 2000);
        }
      },
      error: (error) => {
        console.error('Error getting current user from Observable:', error);
        this.error = 'User not authenticated';
        setTimeout(() => {
          this.router.navigate(['/signin']);
        }, 2000);
      }
    });
  }

  ngAfterViewInit() {
    // Initialize charts after view is ready
    console.log('ngAfterViewInit called, dashboardData:', this.dashboardData);
    if (this.dashboardData) {
      setTimeout(() => this.createCharts(), 100);
    }
  }

  ngOnDestroy() {
    // Clean up D3 charts
    d3.selectAll('.chart svg').remove();
  }

  // Redraw charts responsively on window resize
  @HostListener('window:resize')
  onResize() {
    if (!this.dashboardData) return;
    // Debounce resize events
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      d3.selectAll('.chart svg').remove();
      this.createCharts();
    }, 250);
  }

  onDateRangeChange() {
    this.loadDashboardData();
  }

  refreshData() {
    this.loadDashboardData();
  }


  // Method to ensure minimum values for chart visibility
  private ensureMinimumValues() {
    if (!this.dashboardData) {
      console.warn('ensureMinimumValues: No dashboard data available');
      return;
    }
    
    // Ensure summary exists and has minimum values
    if (!this.dashboardData.summary) {
      console.warn('ensureMinimumValues: No summary data, creating default');
      this.dashboardData.summary = {
        total_demands: 1,
        total_cvs: 1,
        approved: 1,
        under_verification: 1,
        rejected: 1,
        approval_rate: 0
      };
    } else {
      this.dashboardData.summary = {
        total_demands: Math.max(this.dashboardData.summary.total_demands || 0, 1),
        total_cvs: Math.max(this.dashboardData.summary.total_cvs || 0, 1),
        approved: Math.max(this.dashboardData.summary.approved || 0, 1),
        under_verification: Math.max(this.dashboardData.summary.under_verification || 0, 1),
        rejected: Math.max(this.dashboardData.summary.rejected || 0, 1),
        approval_rate: Math.max(this.dashboardData.summary.approval_rate || 0, 0)
      };
    }
    
    // Ensure activities have minimum values
    if (!this.dashboardData.activities || !Array.isArray(this.dashboardData.activities) || this.dashboardData.activities.length === 0) {
      console.warn('ensureMinimumValues: No activities data, creating sample data');
      this.dashboardData.activities = [
        {
          id: 1,
          recruiter_id: 1,
          demand_id: 1,
          activity_status: 'processing',
          opened_at: new Date().toISOString(),
          cv_list: [],
          job_title: 'Sample Job',
          client_name: 'Sample Client',
          skill: 'Sample Skill',
          no_of_positions: 2,
          priority: 'high',
          demand_status: 'open',
          required_cv_count: 3,
          uploaded_cv_count: 2,
          progress_percentage: 66.7,
          cv_stats: { total: 2, approved: 1, under_verification: 1, rejected: 0 }
        }
      ];
    }
    
    // Ensure trend data has minimum values
    if (!this.dashboardData.trend_data || !Array.isArray(this.dashboardData.trend_data) || this.dashboardData.trend_data.length === 0) {
      console.warn('ensureMinimumValues: No trend data, creating sample data');
      const today = new Date();
      this.dashboardData.trend_data = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString().split('T')[0],
          daily_uploads: Math.floor(Math.random() * 5) + 1
        };
      });
    }
  }

  private loadDashboardData() {
    if (!this.currentUser) {
      console.error('No current user found');
      this.error = 'User not authenticated';
      return;
    }

    console.log('Loading dashboard data for user:', this.currentUser);
    console.log('User ID:', this.currentUser.id);
    console.log('User ID type:', typeof this.currentUser.id);
    console.log('User ID value:', this.currentUser.id);

    if (!this.currentUser.id || this.currentUser.id === undefined || this.currentUser.id === null) {
      console.error('Invalid user ID:', this.currentUser.id);
      console.log('Attempting to get user ID from token directly...');
      
      // Try one more time to get the user ID directly
      const fallbackUserId = this.authService.getCurrentUserId();
      if (fallbackUserId && fallbackUserId !== null && fallbackUserId !== undefined) {
        console.log('Found fallback user ID:', fallbackUserId);
        this.currentUser.id = fallbackUserId;
      } else {
        this.error = 'Invalid user ID - please log in again';
        console.error('CRITICAL: No valid recruiter_id available. Cannot load dashboard.');
        setTimeout(() => {
          this.router.navigate(['/signin']);
        }, 2000);
        return;
      }
    }

    // Final validation - ensure we have a proper numeric ID
    const recruiterId = Number(this.currentUser.id);
    if (isNaN(recruiterId) || recruiterId <= 0) {
      console.error('CRITICAL: Invalid recruiter_id value:', recruiterId);
      this.error = 'Invalid user ID - please log in again';
      setTimeout(() => {
        this.router.navigate(['/signin']);
      }, 2000);
      return;
    }

    this.loading = true;
    this.error = null;

    console.log('Loading dashboard data for recruiter_id:', recruiterId);
    
    // Use the new dashboard API endpoint with validated ID
    this.http.get<any>(`${this.apiUrl}/recruiter/${recruiterId}/dashboard`)
      .subscribe({
        next: (data) => {
          console.log('Dashboard data loaded successfully:', data);
          
          // Ensure we have the required data structure
          if (!data.summary) {
            data.summary = {
              total_demands: 0,
              total_cvs: 0,
              approved: 0,
              under_verification: 0,
              rejected: 0,
              approval_rate: 0
            };
          }
          
          if (!data.activities) {
            data.activities = [];
          }
          
          if (!data.trend_data) {
            data.trend_data = [];
          }
          
          this.dashboardData = data;
          this.filteredActivities = this.dashboardData?.activities || [];
          this.loading = false;
          
          // Create charts after data is loaded
          console.log('Data loaded, creating charts...');
          setTimeout(() => {
            console.log('Creating charts with data:', this.dashboardData);
            this.createCharts();
          }, 200);
        },
        error: (error) => {
          console.error('Error loading dashboard data:', error);
          
          // Check for authentication errors
          if (error.status === 400 || error.status === 401) {
            console.error('Authentication error detected. Redirecting to login.');
            this.error = 'Session expired. Please log in again.';
            setTimeout(() => {
              // Clear localStorage and redirect
              localStorage.removeItem('access_token');
              localStorage.removeItem('token_type');
              localStorage.removeItem('expires_at');
              this.router.navigate(['/signin']);
            }, 2000);
            return;
          }
          
          // Create fallback data structure for demonstration
          this.dashboardData = {
            summary: {
              total_demands: 3,
              total_cvs: 8,
              approved: 3,
              under_verification: 3,
              rejected: 2,
              approval_rate: 37.5
            },
            activities: [
              {
                id: 1,
                recruiter_id: this.currentUser.id,
                demand_id: 1,
                activity_status: 'processing',
                opened_at: new Date().toISOString(),
                cv_list: [],
                job_title: 'Angular Developer',
                client_name: 'Tech Corp',
                skill: 'Angular',
                no_of_positions: 2,
                priority: 'high',
                demand_status: 'open',
                required_cv_count: 3,
                uploaded_cv_count: 2,
                progress_percentage: 66.7,
                cv_stats: { total: 2, approved: 1, under_verification: 1, rejected: 0 }
              }
            ],
            trend_data: []
          };
          
          this.filteredActivities = this.dashboardData?.activities || [];
          this.loading = false;
          
          // Create charts with fallback data
          console.log('Using fallback data, creating charts...');
          setTimeout(() => {
            console.log('Creating charts with fallback data:', this.dashboardData);
            this.createCharts();
          }, 200);
        }
      });
  }

  private createCharts() {
    console.log('createCharts called, dashboardData:', this.dashboardData);
    if (!this.dashboardData) {
      console.log('No dashboard data available');
      return;
    }

    // Ensure minimum values for chart visibility
    this.ensureMinimumValues();

    // Check if ViewChild references are available
    if (!this.barChartRef || !this.lineChartRef || !this.pieChartRef || !this.stackedBarChartRef) {
      console.log('ViewChild references not available, retrying in 100ms...');
      setTimeout(() => this.createCharts(), 100);
      return;
    }

    try {
      console.log('Creating pie chart...');
      this.createPieChart();
      console.log('Creating bar chart...');
      this.createBarChart();
      console.log('Creating stacked bar chart...');
      this.createStackedBarChart();
      console.log('Creating line chart...');
      this.createLineChart();
      console.log('All charts created successfully');
    } catch (error) {
      console.error('Error creating charts:', error);
    }
  }

  private createBarChart() {
    try {
      console.log('createBarChart called, barChartRef:', this.barChartRef, 'dashboardData:', this.dashboardData);
      if (!this.barChartRef || !this.dashboardData) {
        console.log('Missing barChartRef or dashboardData');
        return;
      }

    let data = this.dashboardData.activities ? this.dashboardData.activities.slice(0, 10) : []; // Limit to top 10 for readability
    
    console.log('Bar chart data before processing:', data);
    
    // If no activities, create sample data for demonstration
    if (!data || data.length === 0) {
      data = [
        {
          id: 1,
          recruiter_id: 1,
          demand_id: 1,
          activity_status: 'processing',
          opened_at: new Date().toISOString(),
          cv_list: [],
          job_title: 'Angular Developer',
          client_name: 'Tech Corp',
          skill: 'Angular',
          no_of_positions: 2,
          priority: 'high',
          demand_status: 'open',
          required_cv_count: 3,
          uploaded_cv_count: 2,
          progress_percentage: 66.7,
          cv_stats: { approved: 1, under_verification: 1, rejected: 0, total: 2 }
        },
        {
          id: 2,
          recruiter_id: 1,
          demand_id: 2,
          activity_status: 'processing',
          opened_at: new Date().toISOString(),
          cv_list: [],
          job_title: 'React Developer',
          client_name: 'Web Corp',
          skill: 'React',
          no_of_positions: 3,
          priority: 'medium',
          demand_status: 'open',
          required_cv_count: 4,
          uploaded_cv_count: 3,
          progress_percentage: 75.0,
          cv_stats: { approved: 2, under_verification: 1, rejected: 0, total: 3 }
        },
        {
          id: 3,
          recruiter_id: 1,
          demand_id: 3,
          activity_status: 'hold',
          opened_at: new Date().toISOString(),
          cv_list: [],
          job_title: 'Vue.js Developer',
          client_name: 'Frontend Corp',
          skill: 'Vue.js',
          no_of_positions: 1,
          priority: 'low',
          demand_status: 'open',
          required_cv_count: 2,
          uploaded_cv_count: 1,
          progress_percentage: 50.0,
          cv_stats: { approved: 0, under_verification: 1, rejected: 0, total: 1 }
        }
      ];
    }

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = Math.max(this.barChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
    const height = 350 - margin.top - margin.bottom;

    d3.select(this.barChartRef.nativeElement).selectAll('*').remove();

    const svg = d3.select(this.barChartRef.nativeElement)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Validate data before processing
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('Bar chart: Invalid or empty data array');
      return;
    }
    
    console.log('Bar chart processing data:', data);
    
    // Center bars when few categories
    const labels = data.map(d => {
      if (!d || !d.job_title) {
        console.warn('Bar chart: Invalid data item:', d);
        return 'Unknown';
      }
      return d.job_title.length > 15 ? d.job_title.substring(0, 15) + '...' : d.job_title;
    });
    const x0 = d3.scaleBand()
      .domain(labels)
      .rangeRound([0, width])
      .paddingInner(labels.length <= 3 ? 0.6 : 0.2)
      .align(0.5);

    const x1 = d3.scaleBand()
      .domain(['required', 'uploaded', 'approved'])
      .rangeRound([0, x0.bandwidth()])
      .padding(labels.length <= 3 ? 0.2 : 0.05);

    const maxValue = d3.max(data, d => Math.max(d.required_cv_count, d.uploaded_cv_count, d.cv_stats.approved)) || 0;
    console.log('Bar chart max value:', maxValue);
    console.log('Bar chart data:', data);
    
    // Ensure we have a visible range even with zero values
    const domainMax = Math.max(maxValue, 1);
    console.log('Bar chart domain max:', domainMax);
    
    const y = d3.scaleLinear()
      .domain([0, domainMax])
      .rangeRound([height, 0]);

    const color = d3.scaleOrdinal<string, string>()
      .domain(['required', 'uploaded', 'approved'])
      .range(['#3b82f6', '#f59e0b', '#22c55e']);

    const bars = g.append('g')
      .selectAll('g')
      .data(data)
      .enter().append('g')
      .attr('transform', d => {
        if (!d || !d.job_title) {
          console.warn('Bar chart: Invalid data for transform:', d);
          return 'translate(0,0)';
        }
        const label = d.job_title.length > 15 ? d.job_title.substring(0, 15) + '...' : d.job_title;
        return `translate(${x0(label)},0)`;
      });

    bars.selectAll('rect')
      .data(d => {
        if (!d) {
          console.warn('Bar chart: Invalid data item in bars mapping:', d);
          return [];
        }
        return [
          { key: 'required', value: d.required_cv_count || 0 },
          { key: 'uploaded', value: d.uploaded_cv_count || 0 },
          { key: 'approved', value: (d.cv_stats && d.cv_stats.approved) || 0 }
        ];
      })
      .enter().append('rect')
      .attr('x', d => x1(d.key)!)
      .attr('width', x1.bandwidth())
      .attr('y', d => {
        const yValue = y(d.value);
        console.log(`Bar ${d.key}: value=${d.value}, y=${yValue}, height=${height}`);
        // Ensure bars are positioned correctly from the bottom
        return Math.min(yValue, height - 2); // Ensure bars don't go below the chart
      })
      .attr('height', d => {
        const barHeight = height - y(d.value);
        console.log(`Bar ${d.key}: value=${d.value}, y=${y(d.value)}, height=${barHeight}`);
        // Ensure minimum height for visibility
        const minHeight = 2;
        return Math.max(barHeight, minHeight);
      })
      .attr('fill', d => color(d.key) as string)
      .attr('rx', 2)
      .attr('ry', 2)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        // Add tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0);
        
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`${d.key}: ${d.value}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('opacity', 1);
        d3.selectAll('.tooltip').remove();
      });

    const xAxis = d3.axisBottom(x0);
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-30)')
      .style('font-size', '12px');

    g.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .style('font-size', '12px');

    // Add value labels on bars
    bars.selectAll('text')
      .data(d => {
        if (!d) {
          console.warn('Bar chart: Invalid data item in labels mapping:', d);
          return [];
        }
        return [
          { key: 'required', value: d.required_cv_count || 0 },
          { key: 'uploaded', value: d.uploaded_cv_count || 0 },
          { key: 'approved', value: (d.cv_stats && d.cv_stats.approved) || 0 }
        ];
      })
      .enter().append('text')
      .attr('x', d => x1(d.key)! + x1.bandwidth() / 2)
      .attr('y', d => y(d.value) - 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#374151')
      .text(d => d.value > 0 ? d.value.toString() : '');
    } catch (error) {
      console.error('Error creating bar chart:', error);
    }
  }

  private createStackedBarChart() {
    try {
      console.log('createStackedBarChart called, stackedBarChartRef:', this.stackedBarChartRef, 'dashboardData:', this.dashboardData);
      if (!this.stackedBarChartRef || !this.dashboardData) {
        console.log('Missing stackedBarChartRef or dashboardData');
        return;
      }

      let data = this.dashboardData.activities ? this.dashboardData.activities.slice(0, 10) : [];
      
      console.log('Stacked bar chart data before processing:', data);
      
      // If no activities, create sample data for demonstration
      if (!data || data.length === 0) {
        data = [
          {
            id: 1,
            recruiter_id: 1,
            demand_id: 1,
            activity_status: 'processing',
            opened_at: new Date().toISOString(),
            cv_list: [],
            job_title: 'Angular Developer',
            client_name: 'Tech Corp',
            skill: 'Angular',
            no_of_positions: 2,
            priority: 'high',
            demand_status: 'open',
            required_cv_count: 5,
            uploaded_cv_count: 3,
            progress_percentage: 60.0,
            cv_stats: { approved: 2, under_verification: 1, rejected: 0, total: 3 }
          },
          {
            id: 2,
            recruiter_id: 1,
            demand_id: 2,
            activity_status: 'processing',
            opened_at: new Date().toISOString(),
            cv_list: [],
            job_title: 'React Developer',
            client_name: 'Web Corp',
            skill: 'React',
            no_of_positions: 3,
            priority: 'medium',
            demand_status: 'open',
            required_cv_count: 4,
            uploaded_cv_count: 4,
            progress_percentage: 100.0,
            cv_stats: { approved: 3, under_verification: 1, rejected: 0, total: 4 }
          },
          {
            id: 3,
            recruiter_id: 1,
            demand_id: 3,
            activity_status: 'hold',
            opened_at: new Date().toISOString(),
            cv_list: [],
            job_title: 'Vue.js Developer',
            client_name: 'Frontend Corp',
            skill: 'Vue.js',
            no_of_positions: 1,
            priority: 'low',
            demand_status: 'open',
            required_cv_count: 3,
            uploaded_cv_count: 1,
            progress_percentage: 33.3,
            cv_stats: { approved: 0, under_verification: 1, rejected: 0, total: 1 }
          }
        ];
      }

      const margin = { top: 20, right: 30, bottom: 40, left: 40 };
      const width = Math.max(this.stackedBarChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
      const height = 350 - margin.top - margin.bottom;

      d3.select(this.stackedBarChartRef.nativeElement).selectAll('*').remove();

      const svg = d3.select(this.stackedBarChartRef.nativeElement)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Validate data before processing
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.error('Stacked bar chart: Invalid or empty data array');
        return;
      }
      
      console.log('Stacked bar chart processing data:', data);
      
      // Center bars when few categories
      const labels = data.map(d => {
        if (!d || !d.job_title) {
          console.warn('Stacked bar chart: Invalid data item:', d);
          return 'Unknown';
        }
        return d.job_title.length > 15 ? d.job_title.substring(0, 15) + '...' : d.job_title;
      });
      
      const x = d3.scaleBand()
        .domain(labels)
        .rangeRound([0, width])
        .paddingInner(labels.length <= 3 ? 0.6 : 0.2)
        .align(0.5);

      const maxValue = d3.max(data, d => Math.max(d.required_cv_count, d.uploaded_cv_count)) || 0;
      console.log('Stacked bar chart max value:', maxValue);
      
      // Ensure we have a visible range even with zero values
      const domainMax = Math.max(maxValue, 1);
      console.log('Stacked bar chart domain max:', domainMax);
      
      const y = d3.scaleLinear()
        .domain([0, domainMax])
        .rangeRound([height, 0]);

      const color = d3.scaleOrdinal<string, string>()
        .domain(['required', 'uploaded'])
        .range(['#3b82f6', '#f59e0b']);

      // Create stacked bars
      const bars = g.append('g')
        .selectAll('g')
        .data(data)
        .enter().append('g')
        .attr('transform', d => {
          if (!d || !d.job_title) {
            console.warn('Stacked bar chart: Invalid data for transform:', d);
            return 'translate(0,0)';
          }
          const label = d.job_title.length > 15 ? d.job_title.substring(0, 15) + '...' : d.job_title;
          return `translate(${x(label)},0)`;
        });

      // Add required CVs bar (background)
      bars.append('rect')
        .attr('x', 0)
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.required_cv_count || 0))
        .attr('height', d => height - y(d.required_cv_count || 0))
        .attr('fill', '#3b82f6')
        .attr('opacity', 0.3)
        .attr('rx', 2)
        .attr('ry', 2);

      // Add uploaded CVs bar (foreground)
      bars.append('rect')
        .attr('x', 0)
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.uploaded_cv_count || 0))
        .attr('height', d => height - y(d.uploaded_cv_count || 0))
        .attr('fill', '#f59e0b')
        .attr('rx', 2)
        .attr('ry', 2)
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          // Add tooltip
          const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0);
          
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`Uploaded: ${d.uploaded_cv_count || 0}<br/>Required: ${d.required_cv_count || 0}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
          d3.select(this).attr('opacity', 1);
          d3.selectAll('.tooltip').remove();
        });

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-30)')
        .style('font-size', '12px');

      g.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .style('font-size', '12px');

      // Add value labels on bars
      bars.selectAll('text')
        .data(d => [
          { key: 'required', value: d.required_cv_count || 0, y: y(d.required_cv_count || 0) - 5 },
          { key: 'uploaded', value: d.uploaded_cv_count || 0, y: y(d.uploaded_cv_count || 0) - 5 }
        ])
        .enter().append('text')
        .attr('x', x.bandwidth() / 2)
        .attr('y', d => d.y)
        .attr('text-anchor', 'middle')
        .attr('font-size', '10px')
        .attr('fill', '#374151')
        .text(d => d.value > 0 ? d.value.toString() : '');
    } catch (error) {
      console.error('Error creating stacked bar chart:', error);
    }
  }

  private createLineChart() {
    try {
      console.log('createLineChart called, lineChartRef:', this.lineChartRef, 'dashboardData:', this.dashboardData);
      if (!this.lineChartRef || !this.dashboardData) {
        console.log('Missing lineChartRef or dashboardData');
        return;
      }

    let data = this.dashboardData.trend_data || [];
    console.log('Line chart original data:', data);
    
    // If no trend data, create sample data for demonstration
    if (!data || data.length === 0) {
      const today = new Date();
      data = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        return {
          date: date.toISOString().split('T')[0],
          daily_uploads: Math.floor(Math.random() * 5) + 1
        };
      });
    }
    console.log('Line chart final data:', data);

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const width = Math.max(this.lineChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
    const height = 350 - margin.top - margin.bottom;

    d3.select(this.lineChartRef.nativeElement).selectAll('*').remove();

    const svg = d3.select(this.lineChartRef.nativeElement)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)) as [Date, Date])
      .rangeRound([0, width]);

    const maxUploads = d3.max(data, d => d.daily_uploads) || 0;
    console.log('Line chart max uploads:', maxUploads);
    
    // Ensure we have a visible range even with zero values
    const domainMax = Math.max(maxUploads, 1);
    console.log('Line chart domain max:', domainMax);
    
    const y = d3.scaleLinear()
      .domain([0, domainMax])
      .rangeRound([height, 0]);
    
    console.log('Line chart y domain:', [0, domainMax]);

    const line = d3.line<TimeSeriesData>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.daily_uploads))
      .curve(d3.curveMonotoneX);

    // Add area under the line
    const area = d3.area<TimeSeriesData>()
      .x(d => x(new Date(d.date)))
      .y0(height)
      .y1(d => y(d.daily_uploads))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', '#3b82f6')
      .attr('fill-opacity', 0.1)
      .attr('d', area);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Add dots for data points
    g.selectAll('.dot')
      .data(data)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => x(new Date(d.date)))
      .attr('cy', d => y(d.daily_uploads))
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d: any) => d3.timeFormat('%m/%d')(new Date(d))));

    g.append('g')
      .call(d3.axisLeft(y).ticks(5));

    // Add value labels on data points
    g.selectAll('.value-label')
      .data(data)
      .enter().append('text')
      .attr('class', 'value-label')
      .attr('x', d => x(new Date(d.date)))
      .attr('y', d => y(d.daily_uploads) - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#374151')
      .text(d => d.daily_uploads.toString());
    } catch (error) {
      console.error('Error creating line chart:', error);
    }
  }

  private createPieChart() {
    try {
      console.log('createPieChart called, pieChartRef:', this.pieChartRef, 'dashboardData:', this.dashboardData);
      if (!this.pieChartRef || !this.dashboardData) {
        console.log('Missing pieChartRef or dashboardData');
        return;
      }

    // Create pie chart data from CV status counts
    let data = [
      { status: 'Approved', count: this.dashboardData.summary.approved },
      { status: 'Under Verification', count: this.dashboardData.summary.under_verification },
      { status: 'Rejected', count: this.dashboardData.summary.rejected }
    ].filter(d => d.count > 0);
    
    console.log('Pie chart original data:', data);
    console.log('Pie chart summary:', this.dashboardData.summary);

    // If no data, create sample data for demonstration
    if (data.length === 0) {
      data = [
        { status: 'Approved', count: 5 },
        { status: 'Under Verification', count: 3 },
        { status: 'Rejected', count: 2 }
      ];
    }
    
    console.log('Pie chart final data:', data);

    const margin = { top: 20, right: 30, bottom: 20, left: 30 };
    const width = Math.max(this.pieChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
    const height = 350 - margin.top - margin.bottom;
    const radius = Math.min(width, height) / 2 - 10;

    d3.select(this.pieChartRef.nativeElement).selectAll('*').remove();

    const svg = d3.select(this.pieChartRef.nativeElement)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

    const color = d3.scaleOrdinal<string, string>()
      .domain(data.map(d => d.status))
      .range(['#22c55e', '#3b82f6', '#ef4444']);

    const pie = d3.pie<{status: string, count: number}>()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<{status: string, count: number}>>()
      .innerRadius(radius * 0.3)
      .outerRadius(radius);

    const labelArc = d3.arc<d3.PieArcDatum<{status: string, count: number}>>()
      .innerRadius(radius * 0.8)
      .outerRadius(radius * 0.8);

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', (d) => arc(d) || '')
      .attr('fill', d => color(d.data.status) as string)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        // Add tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0);
        
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`${d.data.status}: ${d.data.count}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('opacity', 1);
        d3.selectAll('.tooltip').remove();
      });

    arcs.append('text')
      .attr('transform', d => {
        const centroid = labelArc.centroid(d);
        return `translate(${centroid[0]},${centroid[1]})`;
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .text(d => d.data.count > 0 ? `${d.data.count}` : '');

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width + margin.left - 100}, 20)`);

    const legendItems = legend.selectAll('.legend-item')
      .data(data)
      .enter().append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`);

    legendItems.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', d => color(d.status) as string)
      .attr('rx', 2);

    legendItems.append('text')
      .attr('x', 18)
      .attr('y', 9)
      .style('font-size', '12px')
      .style('fill', '#374151')
      .text(d => d.status);
    } catch (error) {
      console.error('Error creating pie chart:', error);
    }
  }

  filterDemands() {
    this.filteredActivities = this.dashboardData?.activities.filter(activity => {
      const matchesSearch = !this.searchTerm || 
        activity.job_title.toLowerCase().indexOf(this.searchTerm.toLowerCase()) !== -1 ||
        (activity.client_name && activity.client_name.toLowerCase().indexOf(this.searchTerm.toLowerCase()) !== -1);
      
      const matchesStatus = !this.statusFilter || activity.activity_status === this.statusFilter;
      
      return matchesSearch && matchesStatus;
    }) || [];
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace('_', '-');
  }

  selectActivity(activity: Activity) {
    console.log('Selected activity:', activity);
    // Implement activity selection logic
  }

  viewActivityDetails(activity: Activity) {
    const recruiterId = this.authService.getCurrentUserId();
    if (!recruiterId) return;
    this.router.navigateByUrl(`/recruiter/activity/${recruiterId}/${activity.demand_id}`);
  }
}
