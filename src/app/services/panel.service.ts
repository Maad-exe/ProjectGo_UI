import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../env/env';
import { Panel, CreatePanelDto, UpdatePanelDto, AssignPanelDto, GroupEvaluation } from '../models/panel.model';

// Define an interface for the API response that might contain a data property
interface ApiResponse<T> {
  data?: T;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class PanelService {
  private baseUrl = `${environment.apiBaseUrl}/admin/panels`;
  private evaluationUrl = `${environment.apiBaseUrl}/admin/evaluations`;
  
  constructor(private http: HttpClient) {}
  
  // Panel CRUD operations
  createPanel(panel: CreatePanelDto): Observable<Panel> {
    return this.http.post<Panel>(this.baseUrl, panel);
  }
  
  getAllPanels(): Observable<Panel[]> {
    return this.http.get<Panel[]>(this.baseUrl);
  }
  
  getPanelById(id: number): Observable<Panel> {
    return this.http.get<Panel>(`${this.baseUrl}/${id}`);
  }
  
  getPanelsByEventId(eventId: number): Observable<Panel[]> {
    return this.http.get<Panel[]>(`${this.baseUrl}/byEvent/${eventId}`).pipe(
      tap(response => console.log('Raw panel response:', response)),
      catchError(error => {
        console.error('Error fetching panels:', error);
        return throwError(() => error);
      })
    );
  }
  
  updatePanel(id: number, panel: UpdatePanelDto): Observable<Panel> {
    return this.http.put<Panel>(`${this.baseUrl}/${id}`, panel);
  }
  
  deletePanel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
  
  // Group evaluation assignments
  assignPanelToGroup(assign: AssignPanelDto): Observable<GroupEvaluation> {
    return this.http.post<GroupEvaluation>(`${this.evaluationUrl}/assign-panel`, assign);
  }
  
  getGroupEvaluationsByEventId(eventId: number): Observable<GroupEvaluation[]> {
    return this.http.get<GroupEvaluation[]>(`${this.evaluationUrl}/events/${eventId}/evaluations`);
  }
  
  getGroupEvaluationsByPanelId(panelId: number): Observable<GroupEvaluation[]> {
    return this.http.get<GroupEvaluation[]>(`${this.evaluationUrl}/panels/${panelId}/evaluations`);
  }
  
  assignGroupToPanel(panelId: number, groupId: number, eventId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${panelId}/groups/${groupId}/events/${eventId}`, {});
  }

  getGroupEvaluationById(eventId: number, groupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.evaluationUrl}/events/${eventId}/groups/${groupId}/evaluations`);
  }

  getTeacherPanels(teacherId?: number): Observable<Panel[]> {
    // Change the API endpoint to match your backend controller
    return this.http.get<Panel[]>(`${environment.apiBaseUrl}/teacher/evaluations/panels`).pipe(
      catchError(error => {
        console.error('Error fetching teacher panels:', error);
        // Return mock data for now
        if (teacherId) {
          return of(this.getMockPanels().filter(p => 
            p.members.some(m => m.teacherId === teacherId)
          ));
        } else {
          return of(this.getMockPanels());
        }
      })
    );
  }

  getAllGroupEvaluations(): Observable<GroupEvaluation[]> {
    return this.http.get<GroupEvaluation[]>(`${this.evaluationUrl}/all`).pipe(
      catchError(error => {
        console.error('Error fetching all evaluations:', error);
        return of(this.getMockGroupEvaluations());
      })
    );
  }

  getTeacherPanelAssignments(): Observable<GroupEvaluation[]> {
    return this.http.get<GroupEvaluation[]>(`${environment.apiBaseUrl}/teacher/evaluations/panel-assignments`).pipe(
      catchError(error => {
        console.error('Error fetching teacher panel assignments:', error);
        return of(this.getMockGroupEvaluations());
      })
    );
  }

  getMockPanels(): Panel[] {
    return [
      {
        id: 1,
        name: 'Final Project Evaluation Panel',
        createdAt: new Date().toISOString(),
        members: [
          { teacherId: 101, teacherName: 'Dr. Sarah Johnson', isHead: true },
          { teacherId: 102, teacherName: 'Prof. Michael Smith', isHead: false },
          { teacherId: 103, teacherName: 'Dr. Emily Brown', isHead: false }
        ]
      },
      {
        id: 2,
        name: 'Mid-term Review Panel',
        createdAt: new Date().toISOString(),
        members: [
          { teacherId: 104, teacherName: 'Dr. Robert Wilson', isHead: true },
          { teacherId: 105, teacherName: 'Prof. Jennifer Davis', isHead: false },
          { teacherId: 106, teacherName: 'Dr. Thomas Miller', isHead: false }
        ]
      }
    ];
  }
  
  getMockGroupEvaluations(): GroupEvaluation[] {
    return [
      {
        id: 1,
        groupId: 101,
        groupName: 'Team Alpha',
        panelId: 1,
        panelName: 'Final Project Evaluation Panel',
        eventId: 1,
        eventName: 'Final Presentation',
        scheduledDate: new Date().toISOString(),
        isCompleted: false,
        comments: '',
        studentEvaluations: []
      },
      {
        id: 2,
        groupId: 102,
        groupName: 'Team Beta',
        panelId: 1,
        panelName: 'Final Project Evaluation Panel',
        eventId: 1,
        eventName: 'Final Presentation',
        scheduledDate: new Date(Date.now() + 86400000).toISOString(),
        isCompleted: false,
        comments: '',
        studentEvaluations: []
      }
    ];
  }
}
