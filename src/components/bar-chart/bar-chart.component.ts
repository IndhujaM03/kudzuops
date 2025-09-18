import { Component, Input, OnInit, ElementRef, ViewChild,OnDestroy  } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';
import { SubmissionData } from '../../services/data.service';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, KeyValuePipe],
  template: `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">{{ title || 'Submissions by Recruiters' }}</h3>
        <p class="card-subtitle">{{ subtitle || 'Average submissions during this period' }}</p>
        
        <!-- Filter Controls -->
        <div class="filter-controls">
          <div class="filter-group">
            <label class="filter-label">Trend:</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="trendType" value="daily" [(ngModel)]="selectedTrend" (ngModelChange)="onTrendChange()">
                <span>Daily</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="trendType" value="weekly" [(ngModel)]="selectedTrend" (ngModelChange)="onTrendChange()">
                <span>Weekly</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="trendType" value="monthly" [(ngModel)]="selectedTrend" (ngModelChange)="onTrendChange()">
                <span>Monthly</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="trendType" value="quarterly" [(ngModel)]="selectedTrend" (ngModelChange)="onTrendChange()">
                <span>Quarterly</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="trendType" value="yearly" [(ngModel)]="selectedTrend" (ngModelChange)="onTrendChange()">
                <span>Yearly</span>
              </label>
            </div>
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
export class BarChartComponent implements OnInit, OnDestroy {
  @Input() data: SubmissionData[] = [];
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @ViewChild('chartRef') chartRef!: ElementRef;

  selectedTrend: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';

  ngOnInit() {
    setTimeout(() => this.createChart(), 200);
    
    // Handle window resize
    window.addEventListener('resize', () => this.createChart());
  }

  ngOnChanges() {
    if (this.data.length > 0) {
      setTimeout(() => this.createChart(), 200);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('resize', () => this.createChart());
  }

  onTrendChange() {
    this.createChart();
  }
spocDemandCounts: { [key: string]: number } = {};
  private createChart() {
    const element = this.chartRef.nativeElement;
    const margin = { top: 20, right: 30, bottom: 80, left: 50 };
    const containerWidth = element.parentElement?.clientWidth || 900;
    const width = containerWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    // ✅ Clear previous chart and tooltips
    d3.select(element).selectAll("*").remove();
    d3.select("body").selectAll(".tooltip").remove();

    const svg = d3.select(element)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate average submissions per recruiter based on selected trend
    const recruiterData = this.calculateAverageSubmissions();
    
    const chartData = Object.entries(recruiterData)
      .map(([recruiter, avgSubmissions]) => ({ 
        recruiter: recruiter.length > 12 ? recruiter.substring(0, 12) + '...' : recruiter,
        fullRecruiter: recruiter,
        submissions: Math.round(avgSubmissions * 100) / 100 // Round to 2 decimal places
      }))
      .sort((a, b) => b.submissions - a.submissions)
      .slice(0, 8); // Top 8 recruiters

    console.log('Bar Chart Data:', chartData);

    if (chartData.length === 0) {
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 - 10)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-secondary)")
        .style("font-size", "14px")
        .text("No recruiter data available");
        
      g.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 + 20)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-muted)")
        .style("font-size", "12px")
        .text("Recruiter performance will be shown here");
      return;
    }

    const xScale = d3.scaleBand()
      .domain(chartData.map(d => d.recruiter))
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(chartData, d => d.submissions) || 0])
      .range([height, 0]);

    // Add grid lines
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => "")
      )
      .style("stroke-dasharray", "2,2")
      .style("opacity", 0.1);

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .style("color", "var(--text-secondary)")
      .selectAll("text")
      .style("text-anchor", "middle")
      .style("font-size", "10px")
      .call(this.wrapText, xScale.bandwidth());

    g.append("g")
      .call(d3.axisLeft(yScale))
      .style("color", "var(--text-secondary)")
      .selectAll("text")
      .style("font-size", "10px");

    // Add bars
    g.selectAll(".bar")
      .data(chartData)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", d => xScale(d.recruiter) || 0)
      .attr("width", xScale.bandwidth())
      .attr("y", height)
      .attr("height", 0)
      .attr("fill", "#4A90E2")
      .attr("rx", 3)
      .transition()
      .delay((d, i) => i * 100)
      .duration(800)
      .attr("y", d => yScale(d.submissions))
      .attr("height", d => height - yScale(d.submissions));

    // Add value labels on top of bars
    g.selectAll(".label")
      .data(chartData)
      .enter().append("text")
      .attr("class", "label")
      .attr("x", d => (xScale(d.recruiter) || 0) + xScale.bandwidth() / 2)
      .attr("y", d => yScale(d.submissions) - 5)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .style("fill", "var(--text-primary)")
      .style("opacity", 0)
      .text(d => d.submissions)
      .transition()
      .delay((d, i) => i * 100 + 400)
      .duration(500)
      .style("opacity", 1);

    // Add tooltip
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip");

g.selectAll(".bar")
  .on("mouseover", (event, d) => {
    const dataPoint = d as { recruiter: string; fullRecruiter: string; submissions: number };

    tooltip.transition().duration(200).style("opacity", 0.9);
    tooltip.html(`Recruiter: ${dataPoint.fullRecruiter || dataPoint.recruiter}<br/>Submissions: ${dataPoint.submissions}`)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
  })
  .on("mouseout", () => {
    tooltip.transition().duration(500).style("opacity", 0);
  });

  }

 private wrapText(text: any, width: number) {
  text.each(function (this: SVGTextElement) {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    let word;
    let line: string[] = [];
    let lineNumber = 0;
    const lineHeight = 1.1;
    const y = text.attr("y");
    const dy = parseFloat(text.attr("dy")) || 0;
    let tspan = text.text(null)
      .append("tspan")
      .attr("x", 0)
      .attr("y", y)
      .attr("dy", dy + "em");

    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node()!.getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = text.append("tspan")
          .attr("x", 0)
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}


  private calculateAverageSubmissions(): { [key: string]: number } {
    if (this.data.length === 0) return {};

    // Group submissions by recruiter and time period
    const recruiterPeriods: { [recruiter: string]: Set<string> } = {};
    const recruiterSubmissions: { [recruiter: string]: number } = {};

    this.data.forEach(d => {
      const recruiter = d.recruiter || 'Unknown';
      const date = new Date(d.date);
      let periodKey = '';

      switch (this.selectedTrend) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const week = d3.timeWeek.floor(date);
          periodKey = week.toISOString().split('T')[0];
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarterly':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'yearly':
          periodKey = date.getFullYear().toString();
          break;
      }
      if (!recruiterPeriods[recruiter]) {
        recruiterPeriods[recruiter] = new Set();
      }
      recruiterPeriods[recruiter].add(periodKey);
      
      recruiterSubmissions[recruiter] = (recruiterSubmissions[recruiter] || 0) + 1;
    });

    // Calculate averages
    const averages: { [recruiter: string]: number } = {};
    Object.keys(recruiterSubmissions).forEach(recruiter => {
      const totalSubmissions = recruiterSubmissions[recruiter];
      const totalPeriods = recruiterPeriods[recruiter].size;
      averages[recruiter] = totalSubmissions / Math.max(totalPeriods, 1);
    });

    return averages;
  }
}