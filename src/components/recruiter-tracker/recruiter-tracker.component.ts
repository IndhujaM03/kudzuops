import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';

export interface RecruiterActivityData {
  date: string;
  recruiterName: string;
  skill: string;
  cvsSourced: number;
  callsConnected: number;
  recommended: number;
  resubmittal: number;
}

@Component({
  selector: 'app-recruiter-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyValuePipe],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Recruiter Case Tracker</h3>
        <p class="card-subtitle">Track daily recruiter performance and activity metrics</p>
        
        <!-- Filter Controls -->
        <div class="filter-controls">
          <div class="filter-group">
            <label class="filter-label">View:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="viewType" value="daily" [(ngModel)]="selectedViewType" (ngModelChange)="onViewTypeChange()">
                <span>Daily</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="viewType" value="weekly" [(ngModel)]="selectedViewType" (ngModelChange)="onViewTypeChange()">
                <span>Weekly</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="viewType" value="monthly" [(ngModel)]="selectedViewType" (ngModelChange)="onViewTypeChange()">
                <span>Monthly</span>
              </label>
            </div>
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

          <div class="filter-group">
            <label class="filter-label">Recruiter:</label>
            <select class="filter-select" [(ngModel)]="selectedRecruiter" (ngModelChange)="onRecruiterChange()">
              <option value="">All Recruiters</option>
              <option *ngFor="let recruiter of availableRecruiters" [value]="recruiter">
                {{ recruiter }}
              </option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="card-content">
        <!-- Stacked Bar Chart -->
        <div class="chart-section">
          <h4 class="chart-section-title">Recruiter Activity Overview</h4>
          <div class="chart-container">
            <svg #stackedBarRef></svg>
          </div>
        </div>

        <!-- Skill Distribution Pie Chart -->
        <div class="chart-section">
          <h4 class="chart-section-title">Skill Distribution</h4>
          <div class="chart-container" style="height: 400px;">
            <svg #pieChartRef></svg>
            <div class="legend" #pieLegendRef></div>
          </div>
        </div>

        <!-- Trend Line Chart -->
        <div class="chart-section">
          <h4 class="chart-section-title">Activity Trends Over Time</h4>
          <div class="chart-container">
            <svg #trendChartRef></svg>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chart-section {
      margin-bottom: 3rem;
    }
    
    .chart-section-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--border-color);
    }
    
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: center;
      margin-top: 1rem;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
  `]
})
export class RecruiterTrackerComponent implements OnInit, OnDestroy, OnChanges {
  @Input() data: RecruiterActivityData[] = [];
  @ViewChild('stackedBarRef') stackedBarRef!: ElementRef;
  @ViewChild('pieChartRef') pieChartRef!: ElementRef;
  @ViewChild('pieLegendRef') pieLegendRef!: ElementRef;
  @ViewChild('trendChartRef') trendChartRef!: ElementRef;

  selectedViewType: 'daily' | 'weekly' | 'monthly' = 'daily';
  selectedMonth: string = '';
  selectedRecruiter: string = '';
  availableMonths: { [key: string]: string } = {};
  availableRecruiters: string[] = [];
  filteredData: RecruiterActivityData[] = [];

  ngOnInit() {
    this.initializeFilters();
    setTimeout(() => this.createCharts(), 200);
    window.addEventListener('resize', () => this.createCharts());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.data.length > 0) {
      this.initializeFilters();
      this.filterData();
      setTimeout(() => this.createCharts(), 200);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', () => this.createCharts());
  }

  private initializeFilters() {
    if (this.data.length === 0) return;

    // Extract available months
    const months = new Set<string>();
    const recruiters = new Set<string>();
    
    this.data.forEach(d => {
      if (d.date) {
        const date = new Date(d.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
      }
      if (d.recruiterName) {
        recruiters.add(d.recruiterName);
      }
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
    this.filterData();
  }

  onViewTypeChange() {
    this.filterData();
    this.createCharts();
  }

  onMonthChange() {
    this.filterData();
    this.createCharts();
  }

  onRecruiterChange() {
    this.filterData();
    this.createCharts();
  }

  private filterData() {
    this.filteredData = this.data.filter(d => {
      const matchesMonth = this.selectedMonth ? 
        d.date.slice(0, 7) === this.selectedMonth : true;
      const matchesRecruiter = this.selectedRecruiter ? 
        d.recruiterName === this.selectedRecruiter : true;
      return matchesMonth && matchesRecruiter;
    });
  }

  private createCharts() {
    this.createStackedBarChart();
    this.createPieChart();
    this.createTrendChart();
  }

  private createStackedBarChart() {
    const element = this.stackedBarRef.nativeElement;
    const margin = { top: 20, right: 80, bottom: 80, left: 60 };
    const containerWidth = element.parentElement?.clientWidth || 900;
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    d3.select(element).selectAll("*").remove();
    d3.select("body").selectAll(".tooltip").remove();

    const svg = d3.select(element)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Aggregate data by recruiter
    const recruiterData = d3.rollup(
      this.filteredData,
      v => ({
        cvsSourced: d3.sum(v, d => d.cvsSourced),
        callsConnected: d3.sum(v, d => d.callsConnected),
        recommended: d3.sum(v, d => d.recommended),
        resubmittal: d3.sum(v, d => d.resubmittal)
      }),
      d => d.recruiterName
    );

    const chartData = Array.from(recruiterData, ([recruiter, metrics]) => ({
      recruiter,
      ...metrics
    })).sort((a, b) => (b.cvsSourced + b.callsConnected + b.recommended) - (a.cvsSourced + a.callsConnected + a.recommended))
      .slice(0, 10);

    if (chartData.length === 0) {
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-secondary)")
        .text("No recruiter activity data available");
      return;
    }

    const keys = ['cvsSourced', 'callsConnected', 'recommended', 'resubmittal'];
    const colors = ['#4A90E2', '#87CEEB', '#1B365D', '#40E0D0'];
    const color = d3.scaleOrdinal(colors);

    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.recruiter))
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.cvsSourced + d.callsConnected + d.recommended + d.resubmittal) || 0])
      .range([height, 0]);

    // Stack the data
    const stack = d3.stack<any>().keys(keys);
    const stackedData = stack(chartData);

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", "10px")
      .style("color", "var(--text-secondary)");

    g.append("g")
      .call(d3.axisLeft(yScale))
      .style("color", "var(--text-secondary)");

    // Add stacked bars
    g.selectAll(".stack")
      .data(stackedData)
      .enter().append("g")
      .attr("class", "stack")
      .attr("fill", (d, i) => color(keys[i]))
      .selectAll("rect")
      .data(d => d)
      .enter().append("rect")
      .attr("x", d => xScale(d.data.recruiter) || 0)
      .attr("y", height)
      .attr("height", 0)
      .attr("width", xScale.bandwidth())
      .transition()
      .delay((d, i) => i * 100)
      .duration(800)
      .attr("y", d => yScale(d[1]))
      .attr("height", d => yScale(d[0]) - yScale(d[1]));

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width + margin.left + 10}, 20)`);

    const legendLabels = ['CVs Sourced', 'Calls Connected', 'Recommended', 'Resubmittal'];
    const legendItems = legend.selectAll(".legend-item")
      .data(keys)
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendItems.append("rect")
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", (d, i) => color(d));

    legendItems.append("text")
      .attr("x", 18)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("font-size", "12px")
      .style("fill", "var(--text-primary)")
      .text((d, i) => legendLabels[i]);

    // Add tooltip
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    g.selectAll(".stack rect")
      .on("mouseover", function(event, d: any) {
        const key = d3.select(this.parentNode).datum() as any;
        const keyIndex = keys.indexOf(key.key);
        const value = d[1] - d[0];
        
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`${d.data.recruiter}<br/>${legendLabels[keyIndex]}: ${value}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.transition().duration(500).style("opacity", 0);
      });
  }

  private createPieChart() {
    const element = this.pieChartRef.nativeElement;
    const width = 400;
    const height = 350;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.5;

    d3.select(element).selectAll("*").remove();

    const svg = d3.select(element)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // Aggregate data by skill
    const skillData = d3.rollup(
      this.filteredData,
      v => d3.sum(v, d => d.cvsSourced),
      d => d.skill
    );

    const data = Array.from(skillData, ([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    if (data.length === 0) {
      g.append("text")
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-secondary)")
        .text("No skill distribution data available");
      return;
    }

    const colors = ['#4A90E2', '#87CEEB', '#1B365D', '#40E0D0', '#32CD32', '#98FB98', '#FFA500', '#FF7F50'];
    const color = d3.scaleOrdinal(colors);

    const pie = d3.pie<any>()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcs = g.selectAll(".arc")
      .data(pie(data))
      .enter().append("g")
      .attr("class", "arc");

    arcs.append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => color(i.toString()))
      .attr("stroke", "var(--secondary-bg)")
      .style("stroke-width", "3px")
      .transition()
      .delay((d, i) => i * 200)
      .duration(1000)
      .attrTween("d", function(d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function(t) {
          return arc(interpolate(t))!;
        };
      });

    // Add percentage labels
    arcs.append("text")
      .attr("transform", d => `translate(${arc.centroid(d)})`)
      .attr("dy", ".35em")
      .style("text-anchor", "middle")
      .style("fill", "white")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .text(d => `${Math.round((d.data.count / d3.sum(data, d => d.count)) * 100)}%`);

    // Create legend
    const legendContainer = d3.select(this.pieLegendRef.nativeElement);
    legendContainer.selectAll("*").remove();
    
    const legendItems = legendContainer.selectAll(".legend-item")
      .data(data)
      .enter().append("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "0.5rem")
      .style("margin-bottom", "0.5rem");

    legendItems.append("div")
      .style("width", "16px")
      .style("height", "16px")
      .style("border-radius", "3px")
      .style("background-color", (d, i) => color(i.toString()));

    legendItems.append("span")
      .style("font-size", "12px")
      .style("color", "var(--text-secondary)")
      .text(d => `${d.skill}: ${d.count}`);

    // Add tooltip
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    arcs.on("mouseover", function(event, d) {
      tooltip.transition().duration(200).style("opacity", .9);
      tooltip.html(`${d.data.skill}: ${d.data.count} CVs`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.transition().duration(500).style("opacity", 0);
    });
  }

  private createTrendChart() {
    const element = this.trendChartRef.nativeElement;
    const margin = { top: 20, right: 80, bottom: 40, left: 60 };
    const containerWidth = element.parentElement?.clientWidth || 900;
    const width = containerWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    d3.select(element).selectAll("*").remove();

    const svg = d3.select(element)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare trend data based on view type
    let trendData: { date: Date; cvsSourced: number; callsConnected: number; recommended: number }[] = [];

    if (this.selectedViewType === 'daily') {
      const grouped = d3.rollup(
        this.filteredData,
        v => ({
          cvsSourced: d3.sum(v, d => d.cvsSourced),
          callsConnected: d3.sum(v, d => d.callsConnected),
          recommended: d3.sum(v, d => d.recommended)
        }),
        d => d.date
      );
      trendData = Array.from(grouped, ([date, metrics]) => ({ 
        date: new Date(date), 
        ...metrics 
      }));
    } else if (this.selectedViewType === 'weekly') {
      const grouped = d3.rollup(
        this.filteredData,
        v => ({
          cvsSourced: d3.sum(v, d => d.cvsSourced),
          callsConnected: d3.sum(v, d => d.callsConnected),
          recommended: d3.sum(v, d => d.recommended)
        }),
        d => d3.timeWeek.floor(new Date(d.date)).toISOString().split('T')[0]
      );
      trendData = Array.from(grouped, ([date, metrics]) => ({ 
        date: new Date(date), 
        ...metrics 
      }));
    } else {
      const grouped = d3.rollup(
        this.filteredData,
        v => ({
          cvsSourced: d3.sum(v, d => d.cvsSourced),
          callsConnected: d3.sum(v, d => d.callsConnected),
          recommended: d3.sum(v, d => d.recommended)
        }),
        d => d.date.slice(0, 7) + '-01'
      );
      trendData = Array.from(grouped, ([date, metrics]) => ({ 
        date: new Date(date), 
        ...metrics 
      }));
    }

    trendData = trendData.filter(d => !isNaN(d.date.getTime()))
                         .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (trendData.length === 0) {
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-secondary)")
        .text("No trend data available");
      return;
    }

    const xScale = d3.scaleTime()
      .domain(d3.extent(trendData, d => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(trendData, d => Math.max(d.cvsSourced, d.callsConnected, d.recommended)) || 0])
      .range([height, 0]);

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .style("color", "var(--text-secondary)");

    g.append("g")
      .call(d3.axisLeft(yScale))
      .style("color", "var(--text-secondary)");

    // Line generators
    const lineCV = d3.line<any>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.cvsSourced))
      .curve(d3.curveMonotoneX);

    const lineCalls = d3.line<any>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.callsConnected))
      .curve(d3.curveMonotoneX);

    const lineRecommended = d3.line<any>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.recommended))
      .curve(d3.curveMonotoneX);

    // Add lines
    const colors = ['#4A90E2', '#87CEEB', '#1B365D'];
    const lines = [
      { data: trendData, line: lineCV, color: colors[0], label: 'CVs Sourced' },
      { data: trendData, line: lineCalls, color: colors[1], label: 'Calls Connected' },
      { data: trendData, line: lineRecommended, color: colors[2], label: 'Recommended' }
    ];

    lines.forEach((lineConfig, index) => {
      const path = g.append("path")
        .datum(lineConfig.data)
        .attr("fill", "none")
        .attr("stroke", lineConfig.color)
        .attr("stroke-width", 2)
        .attr("d", lineConfig.line);

      const totalLength = path.node()?.getTotalLength() || 0;
      path.attr("stroke-dasharray", totalLength + " " + totalLength)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .delay(index * 500)
          .duration(1500)
          .ease(d3.easeLinear)
          .attr("stroke-dashoffset", 0);
    });

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width + margin.left + 10}, 20)`);

    const legendItems = legend.selectAll(".legend-item")
      .data(lines)
      .enter().append("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(0, ${i * 20})`);

    legendItems.append("line")
      .attr("x1", 0)
      .attr("x2", 15)
      .attr("y1", 6)
      .attr("y2", 6)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2);

    legendItems.append("text")
      .attr("x", 20)
      .attr("y", 9)
      .attr("dy", ".35em")
      .style("font-size", "12px")
      .style("fill", "var(--text-primary)")
      .text(d => d.label);
  }
}