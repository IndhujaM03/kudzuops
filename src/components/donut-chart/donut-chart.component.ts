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
  @ViewChild('chartRef') chartRef!: ElementRef;
  @ViewChild('legendRef') legendRef!: ElementRef;

  private viewInitialized = false;
  private lastData: string = ''; // keep previous data snapshot
  private tooltip: any;

  ngOnInit() {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.renderIfNeeded();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewInitialized && changes['statusCounts']) {
      this.renderIfNeeded();
    }
  }

  private renderIfNeeded() {
    const current = JSON.stringify(this.statusCounts);
    if (current === this.lastData) return; // no data change → skip redraw
    this.lastData = current;
    this.createChart();
  }

  private createChart() {
    const element = this.chartRef.nativeElement;
    const containerWidth = element.parentElement?.clientWidth || 500;
    const width = Math.min(containerWidth, 500);
    const height = 320;
    const radius = Math.min(width, height) / 2;
    const innerRadius = radius * 0.5;
  
    d3.select(element).selectAll('*').remove();
  
    const svg = d3.select(element)
      .attr('width', width)
      .attr('height', height);
  
    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);
  
    const data = Object.entries(this.statusCounts).map(([status, count]) => ({ status, count }));
  
    if (data.length === 0) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .style('fill', 'var(--text-secondary)')
        .text('No data');
      return;
    }
  
    const colors = ['#4A90E2', '#87CEEB', '#1B365D', '#40E0D0', '#32CD32', '#98FB98', '#FF7F50', '#FFA500'];
    const color = d3.scaleOrdinal(colors);
  
    const pie = d3.pie<any>().value(d => d.count).sort(null);
    const arc = d3.arc<any>().innerRadius(innerRadius).outerRadius(radius);
    const arcHover = d3.arc<any>().innerRadius(innerRadius).outerRadius(radius + 15);
  
    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter().append('g')
      .attr('class', 'arc');
  
    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => color(i.toString()))
      .attr('stroke', 'var(--secondary-bg)')
      .style('stroke-width', '3px');
  
    // Labels
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('dy', '.35em')
      .style('text-anchor', 'middle')
      .style('fill', 'white')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text(d => `${Math.round((d.data.count / d3.sum(data, d => d.count)) * 100)}%`);
  
    // Center text
    const total = d3.sum(data, d => d.count);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .style('font-size', '22px')
      .style('font-weight', 'bold')
      .text(total);
  
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .style('font-size', '12px')
      .style('fill', 'var(--text-secondary)')
      .text('Total');
  
    // Tooltip group inside SVG (horizontal like line chart)
    const tooltipGroup = g.append("g").style("display", "none");
  
    tooltipGroup.append("rect")
      .attr("width", 140)
      .attr("height", 40)
      .attr("rx", 6).attr("ry", 6)
      .attr("fill", "#fff")
      .attr("stroke", "#4A90E2")
      .attr("stroke-width", 1.5);
  
    const tooltipStatus = tooltipGroup.append("text")
      .attr("x", 10)
      .attr("y", 15)
      .style("font-weight", "bold")
      .style("fill", "#000")
      .style("font-size", "12px");
  
    const tooltipCount = tooltipGroup.append("text")
      .attr("x", 10)
      .attr("y", 30)
      .style("font-weight", "bold")
      .style("fill", "#000")
      .style("font-size", "12px");
  
    // Hover behavior
    arcs.on('mouseover', function(event, d) {
        d3.select(this).select('path').transition().duration(200).attr('d', arcHover);
  
        tooltipGroup.style("display", null)
          .attr("transform", `translate(${arc.centroid(d)[0] - 70}, ${arc.centroid(d)[1] - 50})`);
  
        tooltipStatus.text(`${d.data.status}`);
        tooltipCount.text(`Count: ${d.data.count}`);
    })
    .on('mousemove', function(event, d) {
        // keep tooltip horizontal near slice
        tooltipGroup.attr("transform", `translate(${arc.centroid(d)[0] - 70}, ${arc.centroid(d)[1] - 50})`);
    })
    .on('mouseout', function() {
        d3.select(this).select('path').transition().duration(200).attr('d', arc);
        tooltipGroup.style("display", "none");
    });
  
    // Legend
    const legendContainer = d3.select(this.legendRef.nativeElement);
    legendContainer.selectAll('*').remove();
  
    const legendItems = legendContainer.selectAll('.legend-item')
      .data(data)
      .enter().append('div')
      .attr('class', 'legend-item')
      .style('display', 'flex')
      .style('align-items', 'center')
      .style('gap', '0.5rem')
      .style('margin-bottom', '0.5rem');
  
    legendItems.append('div')
      .style('width', '16px')
      .style('height', '16px')
      .style('border-radius', '3px')
      .style('background-color', (d, i) => color(i.toString()));
  
    legendItems.append('span')
      .style('font-size', '12px')
      .text(d => `${d.status}: ${d.count}`);
  }
  
}
