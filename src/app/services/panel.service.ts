import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../env/env';
import { Panel, CreatePanelDto, UpdatePanelDto, AssignPanelDto, GroupEvaluation } from '../models/panel.model';

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
    // Based on available endpoints, we need to implement a way to get panels by event ID
    // Since there's no direct endpoint, we might need to get all panels and filter them
    // or modify the backend to add this endpoint
    return this.getAllPanels().pipe(
      map(panels => panels.filter(panel => panel.eventId === eventId))
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
    // This matches your Swagger endpoint
    return this.http.post<GroupEvaluation>(`${this.evaluationUrl}/assign-panel`, assign);
  }
  
  getGroupEvaluationsByEventId(eventId: number): Observable<GroupEvaluation[]> {
    // This matches your Swagger endpoint
    return this.http.get<GroupEvaluation[]>(`${this.evaluationUrl}/events/${eventId}/evaluations`);
  }
  
  getGroupEvaluationsByPanelId(panelId: number): Observable<GroupEvaluation[]> {
    // This matches your Swagger endpoint - fix the URL
    return this.http.get<GroupEvaluation[]>(`${this.evaluationUrl}/panels/${panelId}/evaluations`);
  }
  
  assignGroupToPanel(panelId: number, groupId: number, eventId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/${panelId}/groups/${groupId}/events/${eventId}`, {});
  }

  // Add this method to your existing PanelService
  getGroupEvaluationById(eventId: number, groupId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.evaluationUrl}/events/${eventId}/groups/${groupId}/evaluations`);
  }

  // Add this method to mock data when backend is being developed
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
