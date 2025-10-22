import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, Observable, map, of } from 'rxjs';
import * as d3 from 'd3-dsv';
import { RecruiterPerformanceData } from '../components/recruiter-performance-tracker/recruiter-performance-tracker.component';
import { environment } from '../environments/environment';

export interface SubmissionData {
  sno: number;
  date: string;
  week: string;
  skills: string;
  spoc: string;
  recruiter: string;
  submissions: number;
}

export interface DemandData {
  skill: string;
  date: string;
  positions: number;
  recruiter: string;
  status: string;
  client: string;
  spoc: string;
  supplyRequired: number;
}

export interface DashboardData {
  submissions: SubmissionData[];
  demands: DemandData[];
  totalSubmissions: number;
  currentDemand: number;
  statusCounts: { [key: string]: number };
  spocSubmissions: { [key: string]: number };
  skillDemands: { [key: string]: number };
  weeklySubmissions: { [key: string]: number };
  dailySubmissions: { [key: string]: number };
  recruiterPerformance: RecruiterPerformanceData[];
}

@Injectable({ providedIn: 'root' })
export class DataService {
private SUBMISSION_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSOAQJWd7Pm_7pTn04ONGLY_xA69cq2ZHP9wf7Hb5VlFBJLFdGjL9ocdgnHo5fxeA6Dtjq5dPzGDs7/pub?gid=0&single=true&output=csv';

private DEMAND_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSOAQJWd7Pm_7pTn04ONGLY_xA69cq2ZHP9wf7Hb5VlFBJLFdGjL9ocdgnHo5fxeA6Dtjq5dPzGDs7/pub?gid=1637620106&single=true&output=csv';

private RECRUITER_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSOAQJWd7Pm_7pTn04ONGLY_xA69cq2ZHP9wf7Hb5VlFBJLFdGjL9ocdgnHo5fxeA6Dtjq5dPzGDs7/pub?gid=364112528&single=true&output=csv';

  apiBase = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  getProtectedDashboard(): Observable<any> {
    // Mocked dashboard response
    return of({ status: 'ok' });
  }

  getDashboardData(): Observable<DashboardData> {
    return forkJoin({
      submissionsCsv: this.http.get(this.SUBMISSION_CSV, { responseType: 'text' }),
      demandsCsv: this.http.get(this.DEMAND_CSV, { responseType: 'text' }),
      recruiterCsv: this.http.get(this.RECRUITER_CSV, { responseType: 'text' })
    }).pipe(
      map(({ submissionsCsv, demandsCsv, recruiterCsv }) => {
        console.log('Raw Submissions CSV:', submissionsCsv);
        console.log('Raw Recruiter CSV:', recruiterCsv);
        
        const submissions = this.parseSubmissions(submissionsCsv);
        const demands = this.parseDemands(demandsCsv);
     
        const recruiterPerformance = this.parseRecruiterPerformance(recruiterCsv);
        
        console.log('Parsed Submissions:', submissions);
        console.log('Parsed Demands:', demands);
      
        console.log('Parsed Recruiter Performance:', recruiterPerformance);
        
        return this.processDashboardData(submissions, demands, recruiterPerformance);
      })
    );
  }

  private parseSubmissions(csv: string): SubmissionData[] {
    try {
      const rows = d3.csvParse(csv);
      console.log('CSV Headers:', rows.columns);
      console.log('First few rows:', rows.slice(0, 3));
      
      return rows.map((r, index) => ({
        sno: parseInt(r['S.No'] || r['S.No.'] || r['SNo'] || r['sno'] || (index + 1).toString(), 10) || (index + 1),
        date: this.parseDate(r['Date'] || r['date'] || ''),
        week: r['week'] || r['Week'] || r['WEEK'] || '',
        skills: r['Skills'] || r['skills'] || r['SKILLS'] || '',
        spoc: r['SPOC'] || r['spoc'] || r['Spoc'] || '',
        recruiter: r['Recruiter'] || r['recruiter'] || r['RECRUITER'] || '',
        submissions: 1 // Each row represents one submission
      })).filter(r => r.date && r.spoc && r.skills); // Filter out empty rows
    } catch (error) {
      console.error('Error parsing submissions CSV:', error);
      return [];
    }
  }

  private parseDemands(csv: string): DemandData[] {
    try {
      const rows = d3.csvParse(csv);
      console.log('Demand CSV Headers:', rows.columns);
      console.log('First few demand rows:', rows.slice(0, 3));
      
      return rows.map(r => ({
        skill: r['Skill'] || r['skill'] || r['SKILL'] || '',
        date: this.parseDate(r['Date'] || r['date'] || ''),
        positions: parseInt(r['No. of Positions'] || r['No of Positions'] || r['Positions'] || r['positions'] || '0', 10) || 0,
        recruiter: r['Recruiter'] || r['recruiter'] || r['RECRUITER'] || '',
        status: r['Status'] || r['status'] || r['STATUS'] || 'Open',
        client: r['Client'] || r['client'] || r['CLIENT'] || '',
        spoc: r['SPOC'] || r['spoc'] || r['Spoc'] || '',
        supplyRequired: parseInt(r['Supply Required'] || r['supply required'] || r['SUPPLY REQUIRED'] || r['Supply_Required'] || '0', 10) || 0
      })).filter(r => r.skill && r.positions > 0); // Filter out empty rows
    } catch (error) {
      console.error('Error parsing demands CSV:', error);
      return [];
    }
  }



 private parseRecruiterPerformance(csv: string): RecruiterPerformanceData[] {
  try {
    const rows = d3.csvParse(csv);
    console.log('Recruiter Performance CSV Headers:', rows.columns);

    return rows.map(r => ({
      date: this.parseDate(r['Date'] || r['date'] || ''),
      recruiterName: r['Recruiter Name'] || r['Recruiter'] || r['recruiter'] || r['RECRUITER'] || '',
      callsMade: parseInt(
        r['Calls Made'] || r['Calls Connected'] || r['calls_made'] || r['Calls'] || '0',
        10
      ) || 0,
      submissions: parseInt(
        r['Recommended Profiles'] || r['Recommended'] || r['recommended'] || r['Submissions'] || r['submissions'] || '0',
        10
      ) || 0,
      cvsSourced: parseInt(
        r['CVs Sourced'] || r['CV Sourced'] || r['cvs_sourced'] || r['CVs'] || '0',
        10
      ) || 0, // ✅ Added CVs sourced parsing
      skill: r['Skill'] || r['skill'] || r['SKILL'] || ''
    }))
    .filter(r => r.date && r.recruiterName); // Remove empty rows
  } catch (error) {
    console.error('Error parsing recruiter performance CSV:', error);
    return [];
  }
}


  private parseDate(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      // Handle various date formats
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        // Try parsing DD/MM/YYYY or MM/DD/YYYY format
        const parts = dateStr.split(/[\/\-\.]/);
        if (parts.length === 3) {
          // Assume DD/MM/YYYY format first
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          
          if (day <= 12 && month > 12) {
            // Likely MM/DD/YYYY format
            return new Date(year, day - 1, month).toISOString().split('T')[0];
          } else {
            // DD/MM/YYYY format
            return new Date(year, month - 1, day).toISOString().split('T')[0];
          }
        }
        return dateStr; // Return as-is if can't parse
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error parsing date:', dateStr, error);
      return dateStr;
    }
  }

  private processDashboardData(submissions: SubmissionData[], demands: DemandData[], recruiterPerformance: RecruiterPerformanceData[]): DashboardData {
    const totalSubmissions = submissions.length;
    // Current demand is count of entries with supply required > 0
    const currentDemand = demands.filter(d => (d.supplyRequired || d.positions) > 0).length;

    // Status counts from demands
    const statusCounts = demands.reduce((acc, d) => {
      const status = d.status || 'Unknown';
      acc[status] = (acc[status] || 0) + (d.supplyRequired || d.positions);
      return acc;
    }, {} as { [key: string]: number });

    // SPOC-wise submissions
    const spocSubmissions = submissions.reduce((acc, s) => {
      const spoc = s.spoc || 'Unknown';
      acc[spoc] = (acc[spoc] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Skill-wise demands (supply required)
    const skillDemands = demands.reduce((acc, d) => {
      const skill = d.skill || 'Unknown';
      acc[skill] = (acc[skill] || 0) + (d.supplyRequired || d.positions);
      return acc;
    }, {} as { [key: string]: number });

    // Weekly submissions
    const weeklySubmissions = submissions.reduce((acc, s) => {
      const week = s.week || 'Unknown';
      acc[week] = (acc[week] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    // Daily submissions
    const dailySubmissions = submissions.reduce((acc, s) => {
      const date = s.date || 'Unknown';
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const processedData = {
      submissions,
      demands,
      recruiterPerformance,
      totalSubmissions,
      currentDemand,
      statusCounts,
      spocSubmissions,
      skillDemands,
      weeklySubmissions,
      dailySubmissions
    };

    console.log('Processed Dashboard Data:', processedData);
    return processedData;
  }

  getRecruiterSubmitted(recruiterId: number): Observable<any> {
    return this.http.get(`${this.apiBase}/recruiter/${recruiterId}/submitted`);
  }

  moveExistingResumes(recruiterId: number, demandId: number): Observable<any> {
    return this.http.post(`${this.apiBase}/recruiter/${recruiterId}/demand/${demandId}/move-resumes`, {});
  }

  updateCvEvent(recruiterId: number, demandId: number, filename: string, timestamp: string, eventType: string): Observable<any> {
    return this.http.post(`${this.apiBase}/activity/update_cv`, {
      recruiter_id: recruiterId,
      demand_id: demandId,
      filename: filename,
      timestamp: timestamp,
      event_type: eventType
    });
  }
}