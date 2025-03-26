import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
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
    return this.http.get<Panel[]>(`${this.baseUrl}/by-event/${eventId}`);
  }
  
  updatePanel(id: number, panel: UpdatePanelDto): Observable<Panel> {
    return this.http.put<Panel>(`${this.baseUrl}/${id}`, panel);
  }
  
  deletePanel(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
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
}
