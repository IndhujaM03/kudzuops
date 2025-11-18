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
  total_cvs_uploaded?: number;
  total_cvs?: number;  // For backward compatibility
  approved_cvs_count?: number;
  approved?: number;  // For backward compatibility
  under_verification?: number;
  rejected?: number;
  approval_rate?: number;
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
              <h3>{{ dashboardData.summary.total_cvs_uploaded || dashboardData.summary.total_cvs }}</h3>
              <p>Total CVs Uploaded</p>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon approvals">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="kpi-content">
              <h3>{{ dashboardData.summary.approved_cvs_count || dashboardData.summary.approved }}</h3>
              <p>Approved CVs Count</p>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-section">
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
              <div class="chart-filters">
                <div class="filter-container">
                  <div class="filter-group-view">
                    <label class="filter-label">View:</label>
                    <div class="radio-group">
                      <label class="radio-label">
                        <input type="radio" name="trendView" value="daily" [(ngModel)]="trendView" (ngModelChange)="onTrendFilterChange()">
                        <span>Daily</span>
                      </label>
                      <label class="radio-label">
                        <input type="radio" name="trendView" value="weekly" [(ngModel)]="trendView" (ngModelChange)="onTrendFilterChange()">
                        <span>Weekly</span>
                      </label>
                      <label class="radio-label">
                        <input type="radio" name="trendView" value="monthly" [(ngModel)]="trendView" (ngModelChange)="onTrendFilterChange()">
                        <span>Monthly</span>
                      </label>
              </div>
            </div>
                  <div class="filter-group-month">
                    <label class="filter-label">Month:</label>
                    <select class="filter-dropdown-month" [(ngModel)]="trendMonth" (ngModelChange)="onTrendFilterChange()">
                      <option *ngFor="let option of monthOptions" [value]="option.value">{{ option.label }}</option>
              </select>
            </div>
          </div>
                      </div>
                    </div>
            <div #lineChart class="chart" id="line-chart"></div>
          </div>

          <!-- Demand Performance (Top 5) -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>🏆 Demand Performance (Top 5)</h3>
            </div>
            <div #demandPerformanceChart class="chart" id="demand-performance-chart"></div>
          </div>

          <!-- Interview Outcomes Pie Chart -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>🥧 Interview Outcomes</h3>
            </div>
            <div #interviewPieChart class="chart" id="interview-pie-chart"></div>
          </div>

          <!-- Daily Activity Heatmap -->
          <div class="chart-container">
            <div class="chart-header">
              <h3>🔥 Daily Activity Heatmap</h3>
            </div>
            <div #heatmapChart class="chart" id="heatmap-chart"></div>
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
      padding: 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      font-family: "Manrope", "Manrope Placeholder", sans-serif;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      padding: 24px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 16px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
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
      padding: 24px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 16px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      transition: all 0.3s ease;
    }

    .kpi-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 10px 20px rgba(24, 45, 23, 0.15);
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
      display: flex;
      flex-direction: column;
      gap: 30px;
      margin-bottom: 30px;
      width: 100%;
    }

    .chart-container {
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(24, 45, 23, 0.1);
      border-radius: 16px;
      box-shadow: 0 4px 6px rgba(24, 45, 23, 0.1);
      overflow: hidden;
      width: 100%;
      min-height: 300px;
      transition: all 0.3s ease;
    }

    .chart-container:hover {
      box-shadow: 0 10px 20px rgba(24, 45, 23, 0.15);
    }

    .chart-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px;
      border-bottom: 1px solid rgba(229, 231, 235, 0.5);
    }

    .chart-header h3 {
      margin: 0;
      color: #1e293b;
      font-size: 18px;
      font-weight: 600;
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
        gap: 20px;
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
  @ViewChild('stackedBarChart') stackedBarChartRef!: ElementRef;
  @ViewChild('demandPerformanceChart') demandPerformanceChartRef!: ElementRef;
  @ViewChild('interviewPieChart') interviewPieChartRef!: ElementRef;
  @ViewChild('heatmapChart') heatmapChartRef!: ElementRef;

  dashboardData: DashboardData | null = null;
  loading = false;
  error: string | null = null;
  trendView: string = 'monthly';
  trendMonth: string = 'all';
  interviewData: { scheduled: number; completed: number; cancelled: number } = { scheduled: 0, completed: 0, cancelled: 0 };
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

  refreshData() {
    this.loadDashboardData();
  }


  // Method to validate data structure (no hardcoded values)
  private validateDataStructure() {
    if (!this.dashboardData) {
      console.warn('validateDataStructure: No dashboard data available');
      return;
    }
    
    // Ensure summary exists with default zeros if missing
    if (!this.dashboardData.summary) {
      this.dashboardData.summary = {
        total_demands: 0,
        total_cvs_uploaded: 0,
        total_cvs: 0,
        approved_cvs_count: 0,
        approved: 0,
        under_verification: 0,
        rejected: 0,
        approval_rate: 0
      };
    }
    
    // Ensure activities is an array (empty if missing)
    if (!this.dashboardData.activities || !Array.isArray(this.dashboardData.activities)) {
      this.dashboardData.activities = [];
    }
    
    // Ensure trend_data is an array (empty if missing)
    if (!this.dashboardData.trend_data || !Array.isArray(this.dashboardData.trend_data)) {
      this.dashboardData.trend_data = [];
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
          console.log('Summary data:', data.summary);
          console.log('Activities count:', data.activities?.length);
          console.log('Activities data:', data.activities);
          
          // Ensure we have the required data structure
          if (!data.summary) {
            data.summary = {
              total_demands: 0,
              total_cvs_uploaded: 0,
              total_cvs: 0,
              approved_cvs_count: 0,
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
          
          // Log for debugging
          console.log('Total Demands from API:', data.summary.total_demands);
          console.log('Total CVs Uploaded from API:', data.summary.total_cvs_uploaded || data.summary.total_cvs);
          console.log('Approved CVs Count from API:', data.summary.approved_cvs_count || data.summary.approved);
          
          // Verify activities data
          if (data.activities && data.activities.length > 0) {
            console.log('First activity required_cv_count:', data.activities[0].required_cv_count);
            console.log('First activity uploaded_cv_count:', data.activities[0].uploaded_cv_count);
          }
          
          this.dashboardData = data;
          this.loading = false;
          
          // Load interview data and create charts after data is loaded
          console.log('Data loaded, loading interview data...');
          this.loadInterviewData().then(() => {
          setTimeout(() => {
            console.log('Creating charts with data:', this.dashboardData);
            this.createCharts();
          }, 200);
          });
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
          
          // Set error message instead of fallback data
          this.error = error.error?.detail || error.message || 'Failed to load dashboard data. Please try again.';
          this.loading = false;
          this.dashboardData = null;
        }
      });
  }

  private createCharts() {
    console.log('createCharts called, dashboardData:', this.dashboardData);
    if (!this.dashboardData) {
      console.log('No dashboard data available');
      return;
    }

    // Validate data structure (no hardcoded values)
    this.validateDataStructure();

    // Check if ViewChild references are available
    if (!this.barChartRef || !this.lineChartRef || !this.stackedBarChartRef || 
        !this.demandPerformanceChartRef || !this.interviewPieChartRef ||
        !this.heatmapChartRef) {
      console.log('ViewChild references not available, retrying in 100ms...');
      setTimeout(() => this.createCharts(), 100);
      return;
    }

    try {
      console.log('Creating bar chart...');
      this.createBarChart();
      console.log('Creating stacked bar chart...');
      this.createStackedBarChart();
      console.log('Creating line chart...');
      this.createLineChart();
      console.log('Creating demand performance chart...');
      this.createDemandPerformanceChart();
      console.log('Creating interview pie chart...');
      this.createInterviewPieChart();
      console.log('Creating heatmap chart...');
      this.createHeatmapChart();
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
    
    // If no activities, show empty chart
    if (!data || data.length === 0) {
      console.log('No activities data available for bar chart');
      // Show empty state message
      d3.select(this.barChartRef.nativeElement).selectAll('*').remove();
      d3.select(this.barChartRef.nativeElement)
        .append('div')
        .style('text-align', 'center')
        .style('padding', '40px')
        .style('color', '#6b7280')
        .html('<p>No data available</p>');
      return;
    }

    const margin = { top: 20, right: 30, bottom: 20, left: 40 };
    const width = Math.max(this.barChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
    const height = 250 - margin.top - margin.bottom;

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
          { key: 'required', value: d.required_cv_count || 0, label: 'Required CVs' },
          { key: 'uploaded', value: d.uploaded_cv_count || 0, label: 'Uploaded CVs' },
          { key: 'approved', value: (d.cv_stats && d.cv_stats.approved) || 0, label: 'Approved CVs' }
        ];
      })
      .enter().append('rect')
      .attr('x', d => x1(d.key)!)
      .attr('width', x1.bandwidth())
      .attr('y', d => {
        const yValue = y(d.value);
        return Math.min(yValue, height - 2);
      })
      .attr('height', d => {
        const barHeight = height - y(d.value);
        const minHeight = 2;
        return Math.max(barHeight, minHeight);
      })
      .attr('fill', d => color(d.key) as string)
      .attr('rx', 2)
      .attr('ry', 2)
      .on('mouseover', function(event, d: any) {
        d3.select(this).attr('opacity', 0.8);
        const tooltip = d3.select('body').append('div')
          .attr('class', 'chart-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.9)')
          .style('color', 'white')
          .style('padding', '10px 12px')
          .style('border-radius', '6px')
          .style('font-size', '13px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)')
          .style('opacity', 0);
        
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`<strong>${d.label}</strong><br/>Count: ${d.value}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('opacity', 1);
        d3.selectAll('.chart-tooltip').remove();
      });

    // Show x-axis labels
    const xAxis = d3.axisBottom(x0);
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

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
      
      // If no activities, show empty chart
      if (!data || data.length === 0) {
        console.log('No activities data available for stacked bar chart');
        // Show empty state message
        d3.select(this.stackedBarChartRef.nativeElement).selectAll('*').remove();
        d3.select(this.stackedBarChartRef.nativeElement)
          .append('div')
          .style('text-align', 'center')
          .style('padding', '40px')
          .style('color', '#6b7280')
          .html('<p>No data available</p>');
        return;
      }

      const margin = { top: 20, right: 30, bottom: 20, left: 40 };
      const width = Math.max(this.stackedBarChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
      const height = 250 - margin.top - margin.bottom;

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
          const tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', 'white')
            .style('padding', '10px 12px')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)')
            .style('opacity', 0);
          
          tooltip.transition().duration(200).style('opacity', 1);
          const progress = d.required_cv_count > 0 ? ((d.uploaded_cv_count || 0) / d.required_cv_count * 100).toFixed(1) : '0';
          tooltip.html(`<strong>${d.job_title || d.skill || 'Demand'}</strong><br/>Required: ${d.required_cv_count || 0}<br/>Uploaded: ${d.uploaded_cv_count || 0}<br/>Progress: ${progress}%`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          d3.selectAll('.chart-tooltip').remove();
        });

      // Show x-axis labels
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '11px')
        .style('fill', '#6b7280');

      g.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .style('font-size', '12px');

      // Add value labels on bars
      bars.selectAll('text')
        .data(d => [
          { key: 'required', value: d.required_cv_count || 0, y: y(d.required_cv_count || 0) - 5, label: 'Required' },
          { key: 'uploaded', value: d.uploaded_cv_count || 0, y: y(d.uploaded_cv_count || 0) - 5, label: 'Uploaded' }
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
    
    // If no trend data, show empty chart
    if (!data || data.length === 0) {
      console.log('No trend data available for line chart');
      // Show empty state message
      d3.select(this.lineChartRef.nativeElement).selectAll('*').remove();
      d3.select(this.lineChartRef.nativeElement)
        .append('div')
        .style('text-align', 'center')
        .style('padding', '40px')
        .style('color', '#6b7280')
        .html('<p>No trend data available</p>');
      return;
    }
    console.log('Line chart final data:', data);

    const margin = { top: 20, right: 30, bottom: 20, left: 40 };
    const width = Math.max(this.lineChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
    const height = 250 - margin.top - margin.bottom;

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

    // Show x-axis labels
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d: any) => d3.timeFormat('%m/%d')(new Date(d))))
      .selectAll('text')
      .style('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

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

  onTrendFilterChange() {
    this.loadDashboardData();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    const tokenType = localStorage.getItem('token_type') || 'Bearer';
    return new HttpHeaders({
      'Authorization': `${tokenType} ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private loadInterviewData(): Promise<void> {
    return new Promise((resolve) => {
      const recruiterId = this.authService.getCurrentUserId();
      if (!recruiterId) {
        resolve();
        return;
      }

      this.http.get<any>(`${this.apiUrl}/api/interview-schedule?size=1000`, {
        headers: this.getHeaders()
      }).subscribe({
        next: (response) => {
          const interviews = response.items || [];
          this.interviewData = {
            scheduled: interviews.filter((i: any) => i.status === 'scheduled').length,
            completed: interviews.filter((i: any) => i.status === 'completed').length,
            cancelled: interviews.filter((i: any) => i.status === 'cancelled').length
          };
          resolve();
        },
        error: (error) => {
          console.error('Error loading interview data:', error);
          // Set to zeros on error
          this.interviewData = { scheduled: 0, completed: 0, cancelled: 0 };
          resolve();
        }
      });
    });
  }

  getDateRange(view: string, month: string = 'all'): { startDate?: string; endDate?: string } {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (month !== 'all') {
      const monthIndex = parseInt(month);
      const currentYear = now.getFullYear();
      const monthStart = new Date(currentYear, monthIndex, 1);
      const monthEnd = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);

      switch (view) {
        case 'daily':
          startDate = monthStart;
          endDate = monthEnd;
          break;
        case 'weekly':
          startDate = monthStart;
          endDate = monthEnd;
          break;
        case 'monthly':
          startDate = monthStart;
          endDate = monthEnd;
          break;
        default:
          return {};
      }
    } else {
      switch (view) {
        case 'daily':
          startDate.setDate(now.getDate() - 30);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          startDate.setDate(now.getDate() - (12 * 7));
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'monthly':
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

  viewActivityDetails(activity: Activity) {
    const recruiterId = this.authService.getCurrentUserId();
    if (!recruiterId) return;
    this.router.navigateByUrl(`/recruiter/activity/${recruiterId}/${activity.demand_id}`);
  }

  private createDemandPerformanceChart() {
    try {
      if (!this.demandPerformanceChartRef || !this.dashboardData) return;

      let activities = this.dashboardData.activities || [];
      const top5 = activities
        .sort((a, b) => (b.progress_percentage || 0) - (a.progress_percentage || 0))
        .slice(0, 5)
        .map(a => ({
          name: a.job_title || a.skill || 'Unknown',
          progress: a.progress_percentage || 0,
          uploaded: a.uploaded_cv_count || 0,
          required: a.required_cv_count || 0
        }));

      if (top5.length === 0) {
        d3.select(this.demandPerformanceChartRef.nativeElement).selectAll('*').remove();
        d3.select(this.demandPerformanceChartRef.nativeElement)
          .append('div')
          .style('text-align', 'center')
          .style('padding', '40px')
          .style('color', '#6b7280')
          .html('<p>No data available</p>');
        return;
      }

      const margin = { top: 20, right: 30, bottom: 20, left: 40 };
      const width = Math.max(this.demandPerformanceChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
      const height = 250 - margin.top - margin.bottom;

      d3.select(this.demandPerformanceChartRef.nativeElement).selectAll('*').remove();

      const svg = d3.select(this.demandPerformanceChartRef.nativeElement)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand()
        .domain(top5.map(d => d.name.substring(0, 20)))
        .rangeRound([0, width])
        .padding(0.2);

      const y = d3.scaleLinear()
        .domain([0, 100])
        .rangeRound([height, 0]);

      g.selectAll('rect')
        .data(top5)
        .enter().append('rect')
        .attr('x', d => x(d.name.substring(0, 20))!)
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.progress))
        .attr('height', d => height - y(d.progress))
        .attr('fill', '#3b82f6')
        .attr('rx', 4)
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          const tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', 'white')
            .style('padding', '10px 12px')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)')
            .style('opacity', 0);
          
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`<strong>${d.name}</strong><br/>Progress: ${d.progress.toFixed(1)}%<br/>Uploaded: ${d.uploaded}<br/>Required: ${d.required}`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          d3.selectAll('.chart-tooltip').remove();
        });

      g.selectAll('text')
        .data(top5)
        .enter().append('text')
        .attr('x', d => x(d.name.substring(0, 20))! + x.bandwidth() / 2)
        .attr('y', d => y(d.progress) - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#1e293b')
        .text(d => `${d.progress.toFixed(1)}%`);

      // Show x-axis labels
      g.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)')
        .style('font-size', '11px')
        .style('fill', '#6b7280');

      g.append('g')
        .call(d3.axisLeft(y).ticks(5));
    } catch (error) {
      console.error('Error creating demand performance chart:', error);
    }
  }

  private createInterviewPieChart() {
    try {
      if (!this.interviewPieChartRef || !this.dashboardData) return;

      // Get data from database
      const data = [
        { label: 'Scheduled', value: this.interviewData.scheduled, color: '#3b82f6' },
        { label: 'Completed', value: this.interviewData.completed, color: '#22c55e' },
        { label: 'Cancelled', value: this.interviewData.cancelled, color: '#ef4444' }
      ].filter(d => d.value > 0);

      if (data.length === 0) {
        d3.select(this.interviewPieChartRef.nativeElement).selectAll('*').remove();
        d3.select(this.interviewPieChartRef.nativeElement)
          .append('div')
          .style('text-align', 'center')
          .style('padding', '40px')
          .style('color', '#6b7280')
          .html('<p>No interview data available</p>');
        return;
      }

      const margin = { top: 20, right: 30, bottom: 20, left: 40 };
      const width = Math.max(this.interviewPieChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
      const height = 250 - margin.top - margin.bottom;
      const radius = Math.min(width, height) / 2 - 20;

      d3.select(this.interviewPieChartRef.nativeElement).selectAll('*').remove();

      const svg = d3.select(this.interviewPieChartRef.nativeElement)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

      const g = svg.append('g')
        .attr('transform', `translate(${(width + margin.left + margin.right) / 2},${(height + margin.top + margin.bottom) / 2})`);

      const pie = d3.pie<any>()
        .value(d => d.value)
        .sort(null);

      const arc = d3.arc<any>()
        .innerRadius(0)
        .outerRadius(radius);

      const arcs = g.selectAll('arc')
        .data(pie(data))
        .enter().append('g')
        .attr('class', 'arc');

      arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 0.8);
          const tooltip = d3.select('body').append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.9)')
            .style('color', 'white')
            .style('padding', '10px 12px')
            .style('border-radius', '6px')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)')
            .style('opacity', 0);
          
          tooltip.transition().duration(200).style('opacity', 1);
          const percentage = ((d.data.value / d3.sum(data, d => d.value)) * 100).toFixed(1);
          tooltip.html(`<strong>${d.data.label}</strong><br/>Count: ${d.data.value}<br/>Percentage: ${percentage}%`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 1);
          d3.selectAll('.chart-tooltip').remove();
        });

      arcs.append('text')
        .attr('transform', d => `translate(${arc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#1e293b')
        .attr('font-weight', '600')
        .text(d => d.data.value > 0 ? d.data.value : '');

      // Legend
      const legend = svg.append('g')
        .attr('transform', `translate(${width - 100},${margin.top})`);

      data.forEach((d, i) => {
        const legendRow = legend.append('g')
          .attr('transform', `translate(0,${i * 25})`);

        legendRow.append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', d.color);

        legendRow.append('text')
          .attr('x', 20)
          .attr('y', 12)
          .attr('font-size', '12px')
          .text(d.label);
      });
    } catch (error) {
      console.error('Error creating interview pie chart:', error);
    }
  }

  private createHeatmapChart() {
    try {
      if (!this.heatmapChartRef || !this.dashboardData) return;

      // Use trend_data from dashboard
      let data: { date: Date; value: number }[] = [];
      const trendData = this.dashboardData.trend_data || [];
      
      if (trendData.length > 0) {
        // Use actual trend data
        data = trendData.map(d => ({
          date: new Date(d.date),
          value: d.daily_uploads || 0
        }));
      } else {
        // If no trend data, generate empty data for last 30 days
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          data.push({ date, value: 0 });
        }
      }

      // Ensure we have exactly 30 days of data
      if (data.length < 30) {
        const now = new Date();
        const existingDates = new Set(data.map(d => d.date.toDateString()));
        for (let i = 29; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          if (!existingDates.has(date.toDateString())) {
            data.push({ date, value: 0 });
          }
        }
        data.sort((a, b) => a.date.getTime() - b.date.getTime());
        data = data.slice(-30);
      }

      const margin = { top: 20, right: 30, bottom: 20, left: 40 };
      const width = Math.max(this.heatmapChartRef.nativeElement.offsetWidth - margin.left - margin.right, 400);
      const height = 250 - margin.top - margin.bottom;

      d3.select(this.heatmapChartRef.nativeElement).selectAll('*').remove();

      const svg = d3.select(this.heatmapChartRef.nativeElement)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

      const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const cellWidth = width / 7;
      const cellHeight = height / 5;

      const maxValue = d3.max(data, d => d.value) || 1;
      // Use a more visible color scale - from light blue to dark blue with better contrast
      const colorScale = d3.scaleSequential()
        .domain([0, maxValue])
        .interpolator(d3.interpolateRgb('#e0f2fe', '#0369a1')); // Light blue to dark blue

      data.forEach((d, i) => {
        const row = Math.floor(i / 7);
        const col = i % 7;
        const x = col * cellWidth;
        const y = row * cellHeight;

        // Use a more visible color - ensure minimum visibility even for zero values
        const cellColor = d.value === 0 ? '#f1f5f9' : colorScale(d.value);
        const cellStroke = d.value === 0 ? '#cbd5e1' : '#fff';
        
        g.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', cellWidth - 2)
          .attr('height', cellHeight - 2)
          .attr('fill', cellColor)
          .attr('rx', 2)
          .attr('stroke', cellStroke)
          .attr('stroke-width', d.value === 0 ? 1.5 : 1)
          .on('mouseover', function(event) {
            d3.select(this).attr('opacity', 0.8);
            const tooltip = d3.select('body').append('div')
              .attr('class', 'chart-tooltip')
              .style('position', 'absolute')
              .style('background', 'rgba(0,0,0,0.9)')
              .style('color', 'white')
              .style('padding', '10px 12px')
              .style('border-radius', '6px')
              .style('font-size', '13px')
              .style('pointer-events', 'none')
              .style('z-index', '1000')
              .style('box-shadow', '0 4px 6px rgba(0,0,0,0.3)')
              .style('opacity', 0);
            
            tooltip.transition().duration(200).style('opacity', 1);
            const dateStr = d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            tooltip.html(`<strong>Date: ${dateStr}</strong><br/>CVs Uploaded: ${d.value}`)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 10) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).attr('opacity', 1);
            d3.selectAll('.chart-tooltip').remove();
          });
      });
    } catch (error) {
      console.error('Error creating heatmap chart:', error);
    }
  }
}
