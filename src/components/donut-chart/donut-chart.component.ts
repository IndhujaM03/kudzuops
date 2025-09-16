import { Component, Input, OnInit, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container" style="height: 450px;">
      <svg #chartRef></svg>
      <div class="legend" #legendRef></div>
      <div *ngIf="(statusCounts | keyvalue).length === 0" class="no-data-message">
  <p>No distribution data available</p>
</div>

    </div>
  `
})
export class DonutChartComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() statusCounts: { [key: string]: number } = {};
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @ViewChild('chartRef') chartRef!: ElementRef;
  @ViewChild('legendRef') legendRef!: ElementRef;
  private viewInitialized = false;

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewInitialized && (changes['statusCounts'])) {
      this.createChart();
    }
  }

  private createChart() {
    const element = this.chartRef.nativeElement;
    const containerWidth = element.parentElement?.clientWidth || 500;
    const width = Math.min(containerWidth, 500);
    const height = 350;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.5;

    d3.select(element).selectAll("*").remove();

    const svg = d3.select(element)
      .attr("width", width)
      .attr("height", height);

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const data = Object.entries(this.statusCounts).map(([status, count]) => ({ status, count }));
    
    console.log('Donut Chart Data:', data);

    if (data.length === 0) {
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.5em")
        .style("fill", "var(--text-secondary)")
        .style("font-size", "14px")
        .text("No distribution data available");
        
      g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1em")
        .style("fill", "var(--text-muted)")
        .style("font-size", "12px")
        .text("Chart will display when data is loaded");
      return;
    }

    // const colors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];
    // // Updated colors to match reference image
    const colors = ['#4A90E2', '#87CEEB', '#1B365D', '#40E0D0', '#32CD32', '#98FB98', '#FFA500', '#FF7F50'];

    const color = d3.scaleOrdinal(colors);

    const pie = d3.pie<any>()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcHover = d3.arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(radius + 15);

    // Add arcs
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
    return arc(interpolate(t))!; // add "!" to tell TS it won't be null
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
      .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.7)")
      .text(d => `${Math.round((d.data.count / d3.sum(data, d => d.count)) * 100)}%`);

    // Add center text
    const total = d3.sum(data, d => d.count);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.5em")
      .style("font-size", "28px")
      .style("font-weight", "bold")
      .style("fill", "var(--text-primary)")
      .text(total);

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .style("font-size", "12px")
      .style("fill", "var(--text-secondary)")
      .text("Total");

    // Add hover effects
    // Ensure single tooltip instance
    d3.selectAll("body > div.tooltip").remove();
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip");

    arcs.on("mouseover", function(event, d) {
      d3.select(this).select("path")
        .transition()
        .duration(200)
        .attr("d", arcHover);
        
      tooltip.transition().duration(200).style("opacity", .9);
      tooltip.html(`${d.data.status}: ${d.data.count}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).select("path")
        .transition()
        .duration(200)
        .attr("d", arc);
        
      tooltip.transition().duration(500).style("opacity", 0);
    });

    // Create legend in separate container
    const legendContainer = d3.select(this.legendRef.nativeElement);
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
      .text(d => `${d.status}: ${d.count}`);
  }
}