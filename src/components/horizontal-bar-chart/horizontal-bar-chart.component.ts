import { Component, Input, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

@Component({
  selector: 'app-horizontal-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <svg #chartRef></svg>
 <div *ngIf="(data | keyvalue).length === 0" class="no-data-message">
  <p>No data available</p>
</div>

    </div>
  `
})
export class HorizontalBarChartComponent implements OnInit {
  @Input() data: { [key: string]: number } = {};
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @ViewChild('chartRef') chartRef!: ElementRef;

  ngOnInit() {
    // draw once when initialized
    setTimeout(() => this.createChart(), 100);
  }

  ngOnChanges() {
    // re-draw whenever input data changes
    if (this.chartRef) {
      this.createChart();
    }
  }

  private createChart() {
    const element = this.chartRef.nativeElement;
    const margin = { top: 20, right: 60, bottom: 60, left: 150 };
    const containerWidth = element.parentElement?.clientWidth || 800;
  
    const chartData = Object.entries(this.data)
      .map(([key, value]) => ({
        label: key.length > 20 ? key.substring(0, 20) + '...' : key,
        fullLabel: key,
        value: value
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  
    const barCount = chartData.length;
    const minHeight = 400; // ensure chart is never too short
    const height = Math.max(minHeight, barCount * 25) - margin.top - margin.bottom;
    const width = containerWidth - margin.left - margin.right;
  
    d3.select(element).selectAll('*').remove();
  
    const svg = d3
      .select(element)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);
  
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
    if (chartData.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', 'var(--text-secondary)')
        .text('No data available');
      return;
    }
  
    // Scale fills available height
    const yScale = d3
      .scaleBand()
      .domain(chartData.map(d => d.label))
      .range([0, height])
      .paddingInner(0.4) // control spacing
      .paddingOuter(0.5);
  
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(chartData, d => d.value) || 0])
      .range([0, width]);
  
    const barHeight = 5; // always thin
  
    // Axes
    g.append('g')
      .call(d3.axisLeft(yScale))
      .style('color', 'var(--text-secondary)')
      .selectAll('text')
      .style('font-size', '11px');
  
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .style('color', 'var(--text-secondary)');
  
    // Bars
    g.selectAll('.bar')
      .data(chartData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', d => (yScale(d.label) || 0) + (yScale.bandwidth() - barHeight) / 2) // center the thin bar
      .attr('height', barHeight)
      .attr('x', 0)
      .attr('width', d => xScale(d.value))
      .attr('fill', '#4A90E2')
      .attr('rx', 2.5);
  
    // Labels
    g.selectAll('.label')
      .data(chartData)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => xScale(d.value) + 5)
      .attr('y', d => (yScale(d.label) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '.35em')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('fill', 'var(--text-primary)')
      .text(d => d.value);
  
    // Tooltip
    let tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> = d3.select('.tooltip');
    if (tooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('cursor', 'pointer')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('z-index', '10000')
        .style('opacity', '0')
        .style('padding', '4px 8px')
        .style('border-radius', '4px')
        .style('background', '#333')
        .style('color', '#fff')
        .style('font-size', '12px');
    }
  
    g.selectAll('.bar')
      .on('mouseover', (event: MouseEvent, d: any) => {
        tooltip.transition().duration(120).style('opacity', '0.95');
        tooltip
          .html(`<strong>${d.fullLabel}</strong><br/>Count: ${d.value}`)
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mousemove', (event: MouseEvent) => {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(160).style('opacity', '0');
      });
  }
  
  
}
