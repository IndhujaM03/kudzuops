import { Component, OnInit, OnDestroy, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HrService } from '../../services/hr.service';
import * as d3 from 'd3';

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dashboard-container">
      <!-- Dashboard Header -->
      <div class="dashboard-header">
        <h1 class="dashboard-title">HR Report – Comprehensive Analysis of Recruitment Performance</h1>
      </div>
      
      <!-- Key Highlights Cards -->
      <div class="key-highlights">
        <div class="highlight-card" *ngIf="totalCandidates() > 0">
          <div class="card-icon candidates-icon">👤</div>
          <div class="card-content">
            <div class="card-label">Total Candidates</div>
            <div class="card-value">{{ totalCandidates() }}</div>
          </div>
        </div>
        <div class="highlight-card" *ngIf="onboardingPending() > 0">
          <div class="card-icon pending-icon">⏳</div>
          <div class="card-content">
            <div class="card-label">Onboarding Pending</div>
            <div class="card-value">{{ onboardingPending() }}</div>
          </div>
        </div>
        <div class="highlight-card" *ngIf="onboardingCompleted() > 0">
          <div class="card-icon completed-icon">✅</div>
          <div class="card-content">
            <div class="card-label">Onboarding Completed</div>
            <div class="card-value">{{ onboardingCompleted() }}</div>
          </div>
        </div>
        <div class="highlight-card" *ngIf="totalInterviewsScheduled() > 0">
          <div class="card-icon interviews-icon">📅</div>
          <div class="card-content">
            <div class="card-label">Total Interviews Scheduled</div>
            <div class="card-value">{{ totalInterviewsScheduled() }}</div>
          </div>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="charts-grid">
        <!-- Daily Candidate Registration Count -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Daily Candidate Registration Count</h3>
            <div class="chart-filters">
              <div class="filter-container">
                <div class="filter-group-view">
                  <label class="filter-label">View:</label>
                  <div class="radio-group">
                    <label class="radio-label">
                      <input type="radio" name="registrationView" value="daily" [(ngModel)]="registrationView" (ngModelChange)="onRegistrationFilterChange()">
                      <span>Daily</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="registrationView" value="weekly" [(ngModel)]="registrationView" (ngModelChange)="onRegistrationFilterChange()">
                      <span>Weekly</span>
                    </label>
                    <label class="radio-label">
                      <input type="radio" name="registrationView" value="monthly" [(ngModel)]="registrationView" (ngModelChange)="onRegistrationFilterChange()">
                      <span>Monthly</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div id="registration-chart" class="chart-container"></div>
        </div>

        <!-- Interview Status Overview -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Interview Status Overview</h3>
          </div>
          <div id="interview-status-chart" class="chart-container"></div>
        </div>

        <!-- Onboarding Status Graph -->
        <div class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Onboarding Status Graph</h3>
          </div>
          <div id="onboarding-status-chart" class="chart-container"></div>
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

    @media (max-width: 1200px) {
      .key-highlights {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .key-highlights {
        grid-template-columns: 1fr;
      }
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

    .candidates-icon {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    }

    .pending-icon {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    }

    .completed-icon {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }

    .interviews-icon {
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
export class HrDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  private hrService = inject(HrService);
  totalCandidates = signal<number>(0);
  onboardingPending = signal<number>(0);
  onboardingCompleted = signal<number>(0);
  totalInterviewsScheduled = signal<number>(0);
  
  // View filters for charts
  registrationView: string = 'monthly';

  
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

  // Helper method to calculate date range from view
  getDateRange(view: string): { startDate?: string; endDate?: string } {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

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
        // Last 12 months for monthly view
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      
      default:
        return {};
    }

    startDate.setHours(0, 0, 0, 0);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  loadDashboardData(): void {
    // Load HR key highlights
    this.hrService.getHrKeyHighlights().subscribe({
      next: (data) => {
        this.totalCandidates.set(data.total_candidates || 0);
        this.onboardingPending.set(data.onboarding_pending || 0);
        this.onboardingCompleted.set(data.onboarding_completed || 0);
        this.totalInterviewsScheduled.set(data.total_interviews_scheduled || 0);
      },
      error: (error) => console.error('Error loading HR key highlights:', error)
    });

    // Load and render all charts
    this.loadRegistrationChart();
    this.loadInterviewStatusChart();
    this.loadOnboardingStatusChart();
  }

  loadRegistrationChart(): void {
    const dateRange = this.getDateRange(this.registrationView);
    this.hrService.getDailyCandidateRegistration(
      dateRange.startDate,
      dateRange.endDate,
      this.registrationView
    ).subscribe({
      next: (response) => {
        const data = response.daily_trend || [];
        if (data && data.length > 0) {
          this.renderLineChart('registration-chart', data);
        } else {
          this.showEmptyState('registration-chart', 'No registration data available');
        }
      },
      error: (error) => {
        console.error('Error loading registration chart:', error);
        this.showEmptyState('registration-chart', 'No registration data available');
      }
    });
  }

  loadInterviewStatusChart(): void {
    this.hrService.getInterviewStatusOverview().subscribe({
      next: (response) => {
        const data = response.status_overview || [];
        if (data && data.length > 0) {
          this.renderBarChart('interview-status-chart', data, 'status', 'count', 'Status', 'Count');
        } else {
          this.showEmptyState('interview-status-chart', 'No interview data available');
        }
      },
      error: (error) => {
        console.error('Error loading interview status:', error);
        this.showEmptyState('interview-status-chart', 'No interview data available');
      }
    });
  }

  loadOnboardingStatusChart(): void {
    this.hrService.getOnboardingStatusGraph().subscribe({
      next: (response) => {
        const data = response.status_distribution || [];
        if (data && data.length > 0) {
          this.renderDonutChart('onboarding-status-chart', data, 'status', 'count', 'percentage');
        } else {
          this.showEmptyState('onboarding-status-chart', 'No onboarding data available');
        }
      },
      error: (error) => {
        console.error('Error loading onboarding status:', error);
        this.showEmptyState('onboarding-status-chart', 'No onboarding data available');
      }
    });
  }

  // Filter change handlers
  onRegistrationFilterChange(): void {
    this.loadRegistrationChart();
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

  renderLineChart(containerId: string, data: Array<{ date: string; count: number; team_leaders?: Array<{ team_leader_name: string; count: number }> }>): void {
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
          <div class="tooltip-item">Candidates: ${d.count}</div>
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
      .text('Count');

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
      
      // Use recruiterChartColors for submissions by team leaders chart
      if (containerId === 'submissions-team-leaders-chart') {
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
