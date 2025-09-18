import { Component, Input, OnInit, ElementRef, ViewChild, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container" style="min-height: 420px; overflow: visible;">
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
  private renderTimer: any;
  private lastDataHash: string = '';

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.scheduleRender();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['statusCounts']) return;
    const next = changes['statusCounts'].currentValue as { [key: string]: number };
    const nextHash = this.computeStableHash(next);
    if (nextHash === this.lastDataHash) {
      return; // no meaningful data change; skip re-render
    }
    this.lastDataHash = nextHash;
    if (this.viewInitialized) this.scheduleRender();
  }

  private scheduleRender(delay: number = 50) {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.createChart(), delay);
  }

  private computeStableHash(obj: { [key: string]: number }): string {
    if (!obj) return '';
    const entries = Object.keys(obj).sort().map(k => `${k}:${obj[k] ?? 0}`);
    return entries.join('|');
  }

  private createChart() {
    const element = this.chartRef.nativeElement;
    const containerWidth = element.parentElement?.clientWidth || 500;
    const width = Math.min(containerWidth, 520);
    const height = Math.min(420, Math.max(320, Math.round(containerWidth * 0.7)));
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

    const arcPaths = arcs.append("path")
      .attr("d", arc)
      .attr("fill", (d, i) => color(i.toString()))
      .attr("stroke", "var(--secondary-bg)")
      .style("stroke-width", "3px")
      .style("pointer-events", "visiblePainted");

    arcPaths
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
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    const positionTooltip = (event: MouseEvent) => {
      const offsetX = 12, offsetY = 14;
      const maxX = window.innerWidth - 200;
      const maxY = window.innerHeight - 80;
      const x = Math.min(event.pageX + offsetX, maxX);
      const y = Math.min(event.pageY - offsetY, maxY);
      tooltip.style("left", x + "px").style("top", y + "px");
    };

    arcPaths.on("mouseover", function(event: MouseEvent, d: d3.PieArcDatum<any>) {
      d3.select(this as SVGPathElement)
        .transition()
        .duration(200)
        .attr("d", arcHover);
        
      tooltip.transition().duration(150).style("opacity", .95);
      const percent = Math.round((d.data.count / total) * 100);
      tooltip.html(`<strong>${d.data.status}</strong><br/>Count: ${d.data.count} (${percent}%)`);
      positionTooltip(event);
    })
    .on("mousemove", function(event: MouseEvent) {
      positionTooltip(event);
    })
    .on("mouseout", function() {
      d3.select(this as SVGPathElement)
        .transition()
        .duration(200)
        .attr("d", arc);
        
      tooltip.transition().duration(500).style("opacity", 0);
    });

    // Cursor affordance
    g.selectAll(".arc path").style("cursor", "pointer");

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