// services/event.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';
import { EvaluationEvent, EventType, CreateEventDto, UpdateEventDto } from '../models/event.model';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  
  private baseUrl = `${environment.apiBaseUrl}/admin/evaluations/events`;

  constructor(private http: HttpClient) { }

  getAllEvents(): Observable<EvaluationEvent[]> {
    return this.http.get<EvaluationEvent[]>(this.baseUrl);
  }

  getEventById(id: number): Observable<EvaluationEvent> {
    return this.http.get<EvaluationEvent>(`${this.baseUrl}/${id}`);
  }

  createEvent(event: CreateEventDto): Observable<EvaluationEvent> {
    return this.http.post<EvaluationEvent>(this.baseUrl, event);
  }

  updateEvent(id: number, event: UpdateEventDto): Observable<EvaluationEvent> {
    return this.http.put<EvaluationEvent>(`${this.baseUrl}/${id}`, event);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getEvaluationsByEventId(eventId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/${eventId}/evaluations`);
  }
}