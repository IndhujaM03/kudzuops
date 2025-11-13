# Team Leader Dashboard - Documentation

## Overview

The Team Leader Dashboard is a comprehensive analytics and management interface designed for team leaders to monitor recruitment performance, manage demands, and review CV submissions. It provides real-time insights through interactive charts and data visualizations.

## Table of Contents

1. [Dashboard Features](#dashboard-features)
2. [Key Highlights Section](#key-highlights-section)
3. [Charts and Visualizations](#charts-and-visualizations)
4. [Data Flow](#data-flow)
5. [API Endpoints](#api-endpoints)
6. [User Interactions](#user-interactions)
7. [Technical Implementation](#technical-implementation)
8. [Component Structure](#component-structure)

---

## Dashboard Features

### 1. Key Highlights Cards

Three prominent metric cards displayed at the top of the dashboard:

- **Total Submissions**: Total number of CV submissions across all recruiters
- **Current Demand**: Number of active/open demands
- **Number of Recruiters**: Count of recruiters reporting to the team leader

**Location**: Top section of the dashboard
**Update Frequency**: Loaded on component initialization
**Data Source**: `/teamleader/dashboard/key-highlights`

### 2. Interactive Charts Grid

The dashboard displays 6 interactive charts with filtering capabilities:

#### Chart 1: Daily Submissions Trend
- **Type**: Line Chart (D3.js)
- **Purpose**: Shows submission trends over time
- **Filters**: 
  - View: Daily, Weekly, Monthly
  - Month: All months or specific month selection
- **Data Points**: Date, submission count, recruiter breakdown (on hover)
- **Visualization**: Line graph with data points, grid lines, and tooltips

#### Chart 2: Distribution of Demand by Recruiters
- **Type**: Pie Chart (D3.js)
- **Purpose**: Shows how demands are distributed among recruiters
- **Filters**: View (Daily/Weekly/Monthly) and Month selection
- **Data Points**: Recruiter name, count, percentage
- **Visualization**: Pie chart with legend showing recruiter names and counts

#### Chart 3: Distribution of Demand by SPOCs
- **Type**: Pie Chart (D3.js)
- **Purpose**: Shows demand distribution by SPOC (Single Point of Contact)
- **Filters**: View (Daily/Weekly/Monthly) and Month selection
- **Data Points**: SPOC name, count, percentage
- **Visualization**: Pie chart with color-coded segments

#### Chart 4: Demand by Status
- **Type**: Bar Chart (D3.js)
- **Purpose**: Shows count of demands by their status
- **Filters**: View (Daily/Weekly/Monthly) and Month selection
- **Data Points**: Status (Open, Hold, Closed, etc.), count
- **Visualization**: Horizontal bar chart with status-specific colors
- **Color Mapping**:
  - Open: Green (#10b981)
  - Closed: Red (#ef4444)
  - Processing: Blue (#3b82f6)
  - Assigned: Amber (#f59e0b)
  - Idle: Gray (#6b7280)
  - Pending: Orange (#f97316)

#### Chart 5: Demand by Skill
- **Type**: Donut Chart (D3.js)
- **Purpose**: Shows demand distribution by required skills
- **Filters**: View (Daily/Weekly/Monthly) and Month selection
- **Data Points**: Skill name, count, percentage
- **Visualization**: Donut chart with center showing total count

#### Chart 6: Submissions by Recruiters
- **Type**: Bar Chart (D3.js)
- **Purpose**: Shows submission count per recruiter
- **Filters**: View (Daily/Weekly/Monthly) and Month selection
- **Data Points**: Recruiter name, submission count
- **Visualization**: Full-width bar chart with recruiter names on X-axis

#### Chart 7: SPOC-wise Submissions
- **Type**: Bar Chart (D3.js)
- **Purpose**: Shows submission count per SPOC
- **Filters**: View (Daily/Weekly/Monthly) and Month selection
- **Data Points**: SPOC name, submission count
- **Visualization**: Full-width bar chart with SPOC names on X-axis

---

## Key Highlights Section

### Implementation Details

```typescript
// Component: TeamLeaderDashboardComponent
totalSubmissions = signal<number>(0);
currentDemand = signal<number>(0);
numberOfRecruiters = signal<number>(0);
```

### Data Loading

```typescript
loadDashboardData(): void {
  // Load key highlights (no filters)
  this.teamLeaderService.getKeyHighlights().subscribe({
    next: (data) => {
      this.totalSubmissions.set(data.total_submissions || 0);
      this.currentDemand.set(data.current_demand || 0);
      this.numberOfRecruiters.set(data.number_of_recruiters || 0);
    }
  });
}
```

### API Response Structure

```json
{
  "total_submissions": 150,
  "current_demand": 25,
  "number_of_recruiters": 8
}
```

---

## Charts and Visualizations

### Chart Filtering System

Each chart has independent filtering controls:

1. **View Filter**: Radio buttons for Daily, Weekly, Monthly
2. **Month Filter**: Dropdown to select specific month or "All"

### Date Range Calculation

The system calculates date ranges based on view and month selection:

```typescript
getDateRange(view: string, month: string = 'all'): { startDate?: string; endDate?: string } {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (month !== 'all') {
    // Filter by specific month
    const monthIndex = parseInt(month);
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, monthIndex, 1);
    const monthEnd = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
    // ... date range logic
  } else {
    // Default ranges based on view
    switch (view) {
      case 'daily': startDate.setDate(now.getDate() - 30); break;
      case 'weekly': startDate.setDate(now.getDate() - (12 * 7)); break;
      case 'monthly': startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1); break;
    }
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}
```

### Chart Rendering

All charts use D3.js for rendering:

- **Line Chart**: Uses `d3.scaleTime()` for X-axis, `d3.scaleLinear()` for Y-axis
- **Pie Chart**: Uses `d3.pie()` and `d3.arc()` for segments
- **Donut Chart**: Similar to pie but with inner radius
- **Bar Chart**: Uses `d3.scaleBand()` for X-axis, `d3.scaleLinear()` for Y-axis

### Interactive Features

- **Tooltips**: Hover over chart elements to see detailed information
- **Hover Effects**: Visual feedback on chart elements (scale, color changes)
- **Responsive Design**: Charts adapt to container size
- **Empty States**: Shows "No data available" when no data exists

---

## Data Flow

### 1. Component Initialization

```
User navigates to /teamleader/dashboard
  ↓
TeamLeaderDashboardComponent.ngAfterViewInit()
  ↓
loadDashboardData() called
  ↓
Multiple API calls initiated in parallel
```

### 2. Data Loading Sequence

```
1. getKeyHighlights() → Updates metric cards
2. loadDailyTrendChart() → Renders line chart
3. loadDemandByRecruitersChart() → Renders pie chart
4. loadDemandBySpocsChart() → Renders pie chart
5. loadDemandByStatusChart() → Renders bar chart
6. loadDemandBySkillChart() → Renders donut chart
7. loadSubmissionsByRecruitersChart() → Renders bar chart
8. loadSubmissionsBySpocsChart() → Renders bar chart
```

### 3. Filter Change Flow

```
User changes filter (View or Month)
  ↓
Filter change handler called (e.g., onDailyTrendFilterChange())
  ↓
getDateRange() calculates new date range
  ↓
API call with new date parameters
  ↓
Chart re-rendered with new data
```

### 4. Chart Update Process

```
API response received
  ↓
Data validation and processing
  ↓
D3.js chart rendering
  ↓
SVG elements created and styled
  ↓
Interactive event handlers attached
```

---

## API Endpoints

### Base URL
All endpoints use: `${environment.apiBase}/teamleader/dashboard/...`

### Authentication
All requests include JWT token in Authorization header:
```
Authorization: Bearer <token>
```

### Endpoints

#### 1. Key Highlights
- **Endpoint**: `GET /teamleader/dashboard/key-highlights`
- **Response**:
```json
{
  "total_submissions": 150,
  "current_demand": 25,
  "number_of_recruiters": 8
}
```

#### 2. Daily Submissions Trend
- **Endpoint**: `GET /teamleader/dashboard/daily-submissions-trend?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "daily_trend": [
    {
      "date": "2024-01-15",
      "count": 5,
      "recruiters": [
        {"recruiter_name": "John Doe", "count": 2},
        {"recruiter_name": "Jane Smith", "count": 3}
      ]
    }
  ]
}
```

#### 3. Demand by Recruiters
- **Endpoint**: `GET /teamleader/dashboard/demand-by-recruiters?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "distribution": [
    {
      "recruiter_id": 1,
      "recruiter_name": "John Doe",
      "count": 10,
      "percentage": 25.5
    }
  ]
}
```

#### 4. Demand by SPOCs
- **Endpoint**: `GET /teamleader/dashboard/demand-by-spocs?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "distribution": [
    {
      "spoc_id": 1,
      "spoc_name": "Client A",
      "count": 15,
      "percentage": 30.0
    }
  ]
}
```

#### 5. Demand by Status
- **Endpoint**: `GET /teamleader/dashboard/demand-by-status?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "status_counts": [
    {"status": "open", "count": 20},
    {"status": "closed", "count": 5},
    {"status": "on_hold", "count": 3}
  ]
}
```

#### 6. Demand by Skill
- **Endpoint**: `GET /teamleader/dashboard/demand-by-skill?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "skill_distribution": [
    {
      "skill": "Python",
      "count": 12,
      "percentage": 30.0
    }
  ]
}
```

#### 7. Submissions by Recruiters
- **Endpoint**: `GET /teamleader/dashboard/submissions-by-recruiters?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "recruiter_submissions": [
    {
      "recruiter_id": 1,
      "recruiter_name": "John Doe",
      "count": 25
    }
  ]
}
```

#### 8. Submissions by SPOCs
- **Endpoint**: `GET /teamleader/dashboard/submissions-by-spocs?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- **Response**:
```json
{
  "spoc_submissions": [
    {
      "spoc_id": 1,
      "spoc_name": "Client A",
      "count": 30
    }
  ]
}
```

---

## User Interactions

### 1. Filter Selection

**Action**: User selects a different view (Daily/Weekly/Monthly) or month
**Result**: 
- Date range recalculated
- New API request sent
- Chart re-rendered with filtered data

### 2. Chart Hover

**Action**: User hovers over chart element (bar, pie segment, line point)
**Result**:
- Tooltip appears showing detailed information
- Chart element highlights (scale/color change)
- Additional context displayed (recruiter breakdown, percentages)

### 3. Chart Interaction

**Action**: User interacts with chart elements
**Result**:
- Visual feedback (hover effects)
- Tooltip positioning follows cursor
- Smooth transitions and animations

---

## Technical Implementation

### Component Architecture

```
TeamLeaderDashboardComponent
├── Key Highlights Section
│   ├── Total Submissions Card
│   ├── Current Demand Card
│   └── Number of Recruiters Card
└── Charts Grid
    ├── Daily Trend Chart (Line)
    ├── Demand by Recruiters (Pie)
    ├── Demand by SPOCs (Pie)
    ├── Demand by Status (Bar)
    ├── Demand by Skill (Donut)
    ├── Submissions by Recruiters (Bar)
    └── SPOC-wise Submissions (Bar)
```

### State Management

Uses Angular Signals for reactive state:

```typescript
totalSubmissions = signal<number>(0);
currentDemand = signal<number>(0);
numberOfRecruiters = signal<number>(0);
```

### Service Integration

```typescript
// TeamLeaderService methods
getKeyHighlights(): Observable<{...}>
getDailySubmissionsTrend(startDate?, endDate?): Observable<{...}>
getDemandByRecruiters(startDate?, endDate?): Observable<{...}>
getDemandBySpocs(startDate?, endDate?): Observable<{...}>
getDemandByStatus(startDate?, endDate?): Observable<{...}>
getDemandBySkill(startDate?, endDate?): Observable<{...}>
getSubmissionsByRecruiters(startDate?, endDate?): Observable<{...}>
getSubmissionsBySpocs(startDate?, endDate?): Observable<{...}>
```

### Chart Rendering Methods

```typescript
renderLineChart(containerId, data): void
renderPieChart(containerId, data, labelKey, valueKey, percentageKey?): void
renderDonutChart(containerId, data, labelKey, valueKey, percentageKey?): void
renderBarChart(containerId, data, xKey, yKey, xLabel, yLabel): void
showEmptyState(containerId, message): void
```

### Color Schemes

**Kudzu Primary Colors**:
```typescript
kudzuColors = [
  '#182D17', // kudzu-primary
  '#122314', // kudzu-primary-dark
  '#10b981', // green
  '#6366f1', // indigo
  '#8b5cf6', // purple
  // ... more colors
]
```

**Status-Specific Colors**:
```typescript
statusColors = {
  'open': '#10b981',      // emerald green
  'closed': '#ef4444',     // red
  'processing': '#3b82f6', // blue
  'assigned': '#f59e0b',   // amber
  'idle': '#6b7280',       // gray
  'pending': '#f97316',     // orange
}
```

### Error Handling

```typescript
.subscribe({
  next: (data) => {
    // Process and render data
  },
  error: (error) => {
    console.error('Error loading chart:', error);
    this.showEmptyState('chart-id', 'No data available');
  }
});
```

### Lifecycle Management

```typescript
ngAfterViewInit(): void {
  this.tooltip = d3.select('#chart-tooltip');
  setTimeout(() => {
    this.loadDashboardData();
  }, 100);
}

ngOnDestroy(): void {
  // Clean up D3.js SVG elements
  this.chartSvgs.forEach((svg) => {
    if (svg) svg.remove();
  });
  this.chartSvgs.clear();
}
```

---

## Component Structure

### File Location
`src/components/teamleader/teamleader-dashboard.component.ts`

### Dependencies

```typescript
import { Component, OnInit, OnDestroy, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeamLeaderService } from '../../services/teamleader.service';
import * as d3 from 'd3';
```

### Template Structure

```html
<div class="dashboard-container">
  <!-- Dashboard Header -->
  <div class="dashboard-header">...</div>
  
  <!-- Key Highlights Cards -->
  <div class="key-highlights">...</div>
  
  <!-- Charts Grid -->
  <div class="charts-grid">
    <!-- Each chart card with filters and container -->
  </div>
</div>

<!-- Tooltip -->
<div id="chart-tooltip" class="chart-tooltip"></div>
```

### Styling

- Uses CSS-in-JS (component styles)
- Responsive design with media queries
- Gradient backgrounds and modern UI elements
- Custom color scheme matching Kudzu brand

---

## Navigation Flow

### Accessing the Dashboard

1. User logs in with Team Leader credentials
2. Role guard validates `team_leader` role
3. Router navigates to `/teamleader/dashboard`
4. `TeamLeaderLayoutComponent` wraps the dashboard
5. `TeamLeaderDashboardComponent` loads and initializes

### Route Configuration

```typescript
{
  path: 'teamleader',
  component: TeamLeaderLayoutComponent,
  canActivate: [roleGuard('team_leader')],
  children: [
    { path: 'dashboard', component: TeamLeaderDashboardComponent },
    // ... other routes
  ]
}
```

---

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Charts load after view initialization
2. **Debouncing**: Filter changes trigger API calls (consider debouncing for rapid changes)
3. **Caching**: Consider implementing response caching for frequently accessed data
4. **SVG Cleanup**: Proper cleanup of D3.js elements on component destroy
5. **Error Boundaries**: Graceful error handling with empty states

### Best Practices

- All API calls include error handling
- Empty states provide user feedback
- Responsive design works on all screen sizes
- Accessible tooltips and labels
- Smooth animations and transitions

---

## Future Enhancements

Potential improvements:

1. **Export Functionality**: Export charts as images or PDFs
2. **Real-time Updates**: WebSocket integration for live data
3. **Custom Date Ranges**: User-defined date range picker
4. **Chart Comparison**: Compare data across different time periods
5. **Drill-down**: Click chart elements to see detailed breakdowns
6. **Saved Views**: Save and restore filter configurations
7. **Notifications**: Alert system for important metrics

---

## Troubleshooting

### Common Issues

1. **Charts not rendering**: Check browser console for D3.js errors
2. **No data displayed**: Verify API endpoints are returning data
3. **Filter not working**: Check date range calculation logic
4. **Tooltip not showing**: Verify tooltip element exists in DOM
5. **Authentication errors**: Ensure JWT token is valid and included in headers

### Debug Tips

- Check browser console for API responses
- Verify date range parameters in network tab
- Inspect D3.js SVG elements in DOM
- Check signal values in Angular DevTools
- Verify service method calls and responses

---

## Related Documentation

- [Team Leader Service API](./src/services/teamleader.service.ts)
- [Team Leader Layout Component](./src/components/teamleader/teamleader-layout.component.ts)
- [Demand Sheet Component](./src/components/teamleader/teamleader-demand-sheet.component.ts)
- [Routing Configuration](./src/main.ts)

---

**Last Updated**: 2025-01-30
**Version**: 1.0.0
**Author**: Development Team




