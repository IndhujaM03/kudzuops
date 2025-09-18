import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';

export interface RecruiterPerformanceData {
  date: string;
  recruiterName: string;
  callsMade: number;
  submissions: number;
  cvsSourced: number;   // ✅ Added new metric
  skill?: string;
}

@Component({
  selector: 'app-recruiter-performance-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyValuePipe],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📊 Daily Recruiter Activity</h3>
        
        
        <!-- Filter Controls -->
        <div class="filter-controls">
          <div class="filter-group">
            <label class="filter-label">Time Range:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="timeRange" value="daily" [(ngModel)]="selectedTimeRange" (ngModelChange)="onTimeRangeChange()">
                <span>Daily</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="timeRange" value="weekly" [(ngModel)]="selectedTimeRange" (ngModelChange)="onTimeRangeChange()">
                <span>Weekly</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="timeRange" value="monthly" [(ngModel)]="selectedTimeRange" (ngModelChange)="onTimeRangeChange()">
                <span>Monthly</span>
              </label>
            </div>
          </div>
          
          <div class="filter-group">
            <label class="filter-label">Recruiter:</label>
            <select class="filter-select" [(ngModel)]="selectedRecruiter" (ngModelChange)="onRecruiterChange()">
              <option value="">All Recruiters</option>
              <option *ngFor="let recruiter of availableRecruiters" [value]="recruiter">
                {{ recruiter }}
              </option>
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Month:</label>
            <select class="filter-select" [(ngModel)]="selectedMonth" (ngModelChange)="onMonthChange()">
              <option value="">All Months</option>
              <option *ngFor="let month of availableMonths | keyvalue" [value]="month.key">
                {{ month.value }}
              </option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="card-content">
        <!-- Performance Chart -->
        <div class="chart-section">
          <h4 class="chart-section-title">📞 Calls Made vs 📤 Submissions</h4>
          <div class="chart-container">
            <svg #performanceChartRef></svg>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📞</div>
            <div class="stat-value">{{ getTotalCalls() }}</div>
            <div class="stat-label">Total Calls</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📤</div>
            <div class="stat-value">{{ getTotalSubmissions() }}</div>
            <div class="stat-label">Recommended Profiles</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">📈</div>
            <div class="stat-value">{{ getConversionRate() }}%</div>
            <div class="stat-label">Conversion Rate</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⭐</div>
            <div class="stat-value">{{ getTopPerformer() }}</div>
            <div class="stat-label">Top Performer</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎯</div>
            <div class="stat-value">{{ getUniqueSkills() }}</div>
            <div class="stat-label">Skills Covered</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-section {
      margin-bottom: 2rem;
    }
    
    .chart-section-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--border-color);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }

    .stat-card {
      background: var(--primary-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    .stat-icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--primary-blue);
      margin-bottom: 0.25rem;
    }

    .stat-label {
      font-size: 0.875rem;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .tooltip {
      position: fixed;
      pointer-events: none;
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.3;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 9999;
    }
  `]})
export class RecruiterPerformanceTrackerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() data: RecruiterPerformanceData[] = [];
  @ViewChild('performanceChartRef') performanceChartRef!: ElementRef;

  selectedTimeRange: 'daily' | 'weekly' | 'monthly' = 'daily';
  selectedRecruiter: string = '';
  selectedMonth: string = '';
  availableMonths: { [key: string]: string } = {};
  availableRecruiters: string[] = [];
  filteredData: RecruiterPerformanceData[] = [];
  private redrawTimer: any;
  private onResize = () => this.scheduleCreateChart();

  ngOnInit() {
    this.initializeFilters();
    this.scheduleCreateChart();
    window.addEventListener('resize', this.onResize);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.data.length > 0) {
      this.initializeFilters();
      this.filterData();
      this.scheduleCreateChart();
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.onResize);
    if (this.redrawTimer) {
      clearTimeout(this.redrawTimer);
    }
  }

  private scheduleCreateChart(delay: number = 100) {
    if (this.redrawTimer) clearTimeout(this.redrawTimer);
    this.redrawTimer = setTimeout(() => this.createPerformanceChart(), delay);
  }

  private initializeFilters() {
    if (this.data.length === 0) return;
    const months = new Set<string>();
    const recruiters = new Set<string>();

    this.data.forEach(d => {
      if (d.date) {
        const date = new Date(d.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
      if (d.recruiterName) recruiters.add(d.recruiterName);
    });

    this.availableMonths = {};
    Array.from(months).sort().forEach(monthKey => {
      const [year, month] = monthKey.split('-');
      const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });
      this.availableMonths[monthKey] = monthName;
    });

    this.availableRecruiters = Array.from(recruiters).sort();

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (this.availableMonths[currentMonthKey]) {
      this.selectedMonth = currentMonthKey;
    }

    this.filterData();
  }

  onTimeRangeChange() { this.filterData(); this.scheduleCreateChart(); }
  onRecruiterChange() { this.filterData(); this.scheduleCreateChart(); }
  onMonthChange() { this.filterData(); this.scheduleCreateChart(); }

  private filterData() {
    this.filteredData = this.data.filter(d => {
      const matchesMonth = this.selectedMonth ? d.date.slice(0, 7) === this.selectedMonth : true;
      const matchesRecruiter = this.selectedRecruiter ? d.recruiterName === this.selectedRecruiter : true;
      return matchesMonth && matchesRecruiter;
    });
  }

  private createPerformanceChart() {
    const element = this.performanceChartRef.nativeElement;
    const margin = { top: 20, right: 80, bottom: 100, left: 60 };
    const containerWidth = element.parentElement?.clientWidth || 900;
    const width = containerWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    d3.select(element).selectAll("*").remove();
    d3.select("body").selectAll(".tooltip").remove();

    const svg = d3.select(element)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare aggregated chart data
    let chartData: { date: Date; callsMade: number; submissions: number; cvsSourced: number; label: string; skillBreakdown?: string }[] = [];

    if (this.selectedTimeRange === 'daily') {
      const grouped = d3.rollup(
        this.filteredData,
        v => ({
          callsMade: d3.sum(v, d => d.callsMade),
          submissions: d3.sum(v, d => d.submissions),
          cvsSourced: d3.sum(v, d => d.cvsSourced),
          skillBreakdown: this.getSkillBreakdown(v)
        }),
        d => d.date
      );
      chartData = Array.from(grouped, ([date, metrics]) => ({
        date: new Date(date), ...metrics,
        label: d3.timeFormat("%m/%d")(new Date(date))
      }));
    } else if (this.selectedTimeRange === 'weekly') {
      const grouped = d3.rollup(
        this.filteredData,
        v => ({
          callsMade: d3.sum(v, d => d.callsMade),
          submissions: d3.sum(v, d => d.submissions),
          cvsSourced: d3.sum(v, d => d.cvsSourced),
          skillBreakdown: this.getSkillBreakdown(v)
        }),
        d => d3.timeWeek.floor(new Date(d.date)).toISOString().split('T')[0]
      );
      chartData = Array.from(grouped, ([date, metrics]) => ({
        date: new Date(date), ...metrics,
        label: `Week ${d3.timeFormat("%U")(new Date(date))}`
      }));
    } else {
      const grouped = d3.rollup(
        this.filteredData,
        v => ({
          callsMade: d3.sum(v, d => d.callsMade),
          submissions: d3.sum(v, d => d.submissions),
          cvsSourced: d3.sum(v, d => d.cvsSourced),
          skillBreakdown: this.getSkillBreakdown(v)
        }),
        d => d.date.slice(0, 7) + '-01'
      );
      chartData = Array.from(grouped, ([date, metrics]) => ({
        date: new Date(date), ...metrics,
        label: d3.timeFormat("%b %Y")(new Date(date))
      }));
    }

    chartData = chartData.filter(d => !isNaN(d.date.getTime()))
                         .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (chartData.length === 0) {
      g.append("text")
        .attr("x", width / 2).attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-secondary)")
        .style("font-size", "16px")
        .text("No performance data available");
      return;
    }

    // Scales
    const xScale = d3.scalePoint()
      .domain(chartData.map(d => d.label))
      .range([0, width])
      .padding(0.5);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => Math.max(d.callsMade, d.submissions, d.cvsSourced)) || 0])
      .nice()
      .range([height, 0]);

    // Colors
    const metrics = [
      { key: 'callsMade', label: '📞 Calls Made', color: '#4A90E2' },
      { key: 'submissions', label: '📤 Recommended Profiles', color: '#1B365D' },
      { key: 'cvsSourced', label: '📑 CVs Sourced', color: '#E67E22' }
    ];

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.5em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", "10px");

    g.append("g").call(d3.axisLeft(yScale).ticks(6));

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat(() => ""))
      .selectAll("line")
      .attr("stroke", "var(--border-color)")
      .attr("stroke-opacity", 0.3);

    // Line generator
    const line = d3.line<any>()
      .x(d => xScale(d.label)!)
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Draw lines
    metrics.forEach(metric => {
      const series = chartData.map(d => ({ label: d.label, value: d[metric.key as keyof typeof d] as number }));

      g.append("path")
        .datum(series)
        .attr("fill", "none")
        .attr("stroke", metric.color)
        .attr("stroke-width", 2)
        .attr("d", line);

      // Add circles
      g.selectAll(`.dot-${metric.key}`)
        .data(series).enter().append("circle")
        .attr("class", `dot-${metric.key}`)
        .attr("cx", d => xScale(d.label)!)
        .attr("cy", d => yScale(d.value))
        .attr("r", 4)
        .attr("fill", metric.color);
    });

    // Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${height + margin.top + 60})`);

    const legendItems = legend.selectAll(".legend-item")
      .data(metrics)
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(${i * 200}, 0)`);

    legendItems.append("rect")
      .attr("width", 14).attr("height", 14)
      .attr("fill", d => d.color).attr("rx", 3);

    legendItems.append("text")
      .attr("x", 20).attr("y", 10)
      .attr("dy", ".35em")
      .style("font-size", "12px")
      .style("fill", "var(--text-primary)")
      .text(d => d.label);

    // Tooltip
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    metrics.forEach(metric => {
      g.selectAll(`.dot-${metric.key}`)
        .on("mouseover", (event, d: any) => {
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip.html(`${d.label}<br/>📊 ${metric.label}: ${d.value}`)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
    });
  }

  private getSkillBreakdown(data: RecruiterPerformanceData[]): string {
    const skillCounts: { [key: string]: number } = {};
    if (this.data.length > 0 && 'skill' in this.data[0]) {
      data.forEach(d => {
        if (d.skill) {
          skillCounts[d.skill] = (skillCounts[d.skill] || 0) + d.submissions;
        }
      });
    }
    const skillEntries = Object.entries(skillCounts);
    if (skillEntries.length === 0) return 'Multiple Skills';
    return skillEntries.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => `${s} (${c})`).join(', ');
  }

  // ✅ Summary stats
  getTotalCalls(): number { return this.filteredData.reduce((sum, d) => sum + d.callsMade, 0); }
  getTotalSubmissions(): number { return this.filteredData.reduce((sum, d) => sum + d.submissions, 0); }
  getTotalCVs(): number { return this.filteredData.reduce((sum, d) => sum + d.cvsSourced, 0); }
  getConversionRate(): number {
    const calls = this.getTotalCalls(), subs = this.getTotalSubmissions();
    return calls > 0 ? Math.round((subs / calls) * 100) : 0;
  }
  getTopPerformer(): string {
    if (this.filteredData.length === 0) return 'N/A';
    const recruiterStats = d3.rollup(this.filteredData, v => d3.sum(v, d => d.submissions), d => d.recruiterName);
    const topRecruiter = Array.from(recruiterStats.entries()).reduce((a, b) => a[1] > b[1] ? a : b, ['N/A', 0]);
    return topRecruiter[0];
  }
  getUniqueSkills(): number {
    const skills = new Set(this.filteredData.filter(d => d.skill && d.skill.trim() !== '').map(d => d.skill));
    return skills.size;
  }
}
