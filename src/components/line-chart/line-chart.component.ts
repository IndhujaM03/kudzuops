import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { SubmissionData } from '../../services/data.service';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyValuePipe],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">{{ title || 'Daily Submissions Trend' }}</h3>
        <p class="card-subtitle">{{ subtitle || 'Track submission patterns over time' }}</p>
        
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
              <option value="">All</option>
              <option *ngFor="let month of availableMonths | keyvalue" [value]="month.key">
                {{ month.value }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="card-content">
        <div class="chart-container">
          <svg #chartRef></svg>
        </div>
      </div>
    </div>
  `
})
export class LineChartComponent implements OnInit, OnDestroy, OnChanges {
  @Input() data: SubmissionData[] = [];
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @ViewChild('chartRef') chartRef!: ElementRef;

  selectedViewType: 'daily' | 'weekly' | 'monthly' = 'daily';
  selectedMonth: string = ''; // empty = show all months
  availableMonths: { [key: string]: string } = {};
  filteredData: SubmissionData[] = [];

  ngOnInit() {
    this.initializeFilters();
    setTimeout(() => this.createChart(), 200);
    window.addEventListener('resize', () => this.createChart());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.data.length > 0) {
      this.initializeFilters();
      this.filterData();
      setTimeout(() => this.createChart(), 200);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', () => this.createChart());
  }

  private initializeFilters() {
    if (this.data.length === 0) return;

    const months = new Set<string>();
    this.data.forEach(d => {
      if (d.date) {
        const date = new Date(d.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthKey);
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

    // Default: no month filter selected
    this.selectedMonth = '';
    this.filterData();
  }

  onViewTypeChange() {
    // Keep month selection active for all view types
    this.filterData();
    this.createChart();
  }

  onMonthChange() {
    this.filterData();
    this.createChart();
  }

  private filterData() {
    if (!this.selectedMonth) {
      // No month selected → show all data
      this.filteredData = this.data;
      return;
    }

    // Filter based on selected month (applies to all view types)
    const [year, month] = this.selectedMonth.split('-');
    this.filteredData = this.data.filter(d => {
      if (!d.date) return false;
      const date = new Date(d.date);
      return date.getFullYear() === parseInt(year) &&
             date.getMonth() === parseInt(month) - 1;
    });
  }

  private createChart() {
    const element = this.chartRef.nativeElement;
    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const containerWidth = element.parentElement?.clientWidth || 900;
    const width = containerWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    d3.select(element).selectAll("*").remove();
    d3.select("body").selectAll(".tooltip").remove();

    const svg = d3.select(element)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare chart data
    let chartData: { date: Date; submissions: number }[] = [];

    if (this.selectedViewType === 'daily') {
      const grouped = d3.rollup(this.filteredData, v => v.length, d => d.date);
      chartData = Array.from(grouped, ([date, submissions]) => ({ date: new Date(date), submissions }));
    } else if (this.selectedViewType === 'weekly') {
      const grouped = d3.rollup(
        this.filteredData,
        v => v.length,
        d => d3.timeWeek.floor(new Date(d.date)).toISOString().split('T')[0]
      );
      chartData = Array.from(grouped, ([date, submissions]) => ({ date: new Date(date), submissions }));
    } else if (this.selectedViewType === 'monthly') {
      const grouped = d3.rollup(
        this.filteredData,
        v => v.length,
        d => {
          const date = new Date(d.date);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        }
      );
      chartData = Array.from(grouped, ([date, submissions]) => ({ date: new Date(date), submissions }));
    }

    chartData = chartData.filter(d => !isNaN(d.date.getTime()))
                         .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (chartData.length === 0) {
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 - 10)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-secondary)")
        .style("font-size", "14px")
        .text("No submission trend data available");
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 + 20)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-muted)")
        .style("font-size", "12px")
        .text("Daily trends will appear as data is collected");
      return;
    }

    const xScale = d3.scaleTime().domain(d3.extent(chartData, d => d.date) as [Date, Date]).range([0, width]);
    const yScale = d3.scaleLinear().domain([0, d3.max(chartData, d => d.submissions) || 0]).range([height, 0]);

    const line = d3.line<any>().x(d => xScale(d.date)).y(d => yScale(d.submissions)).curve(d3.curveMonotoneX);

    // Axis
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(Math.min(chartData.length, 8))
          .tickFormat((d) => {
            const date = d as Date;
            if (this.selectedViewType === 'daily') return d3.timeFormat("%m/%d")(date);
            if (this.selectedViewType === 'weekly') return d3.timeFormat("Week %U")(date);
            return d3.timeFormat("%b %Y")(date);
          })
      )
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", "10px")
      .style("color", "var(--text-secondary)");

    g.append("g").call(d3.axisLeft(yScale)).style("color", "var(--text-secondary)").selectAll("text").style("font-size", "10px");

    // Grid
    g.append("g").attr("class", "grid").attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(() => "")).style("stroke-dasharray", "3,3").style("opacity", 0.3);
    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(() => "")).style("stroke-dasharray", "3,3").style("opacity", 0.3);

    // Line path
    const path = g.append("path").datum(chartData)
      .attr("fill", "none")
      .attr("stroke", "#4A90E2")
      .attr("stroke-width", 2)
      .attr("d", line);

    const totalLength = path.node()?.getTotalLength() || 0;
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(1500).ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // Circles & tooltip
    g.selectAll(".dot").data(chartData).enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(d.date))
      .attr("cy", d => yScale(d.submissions))
      .attr("r", 0)
      .attr("fill", "#4A90E2")
      .transition().delay((d, i) => i * 100).duration(500)
      .attr("r", 3);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    g.selectAll(".dot")
      .on("mouseover", (event, d) => {
        const dataPoint = d as { date: Date; submissions: number };
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip.html(`Date: ${d3.timeFormat("%Y-%m-%d")(dataPoint.date)}<br/>Submissions: ${dataPoint.submissions}`)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));
  }
}
