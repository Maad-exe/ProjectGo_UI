// services/event.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../env/env';
// Import from models
import { EvaluationEvent as EventModel, EventType, CreateEventDto, UpdateEventDto } from '../models/event.model';

// Don't define EvaluationEvent here to avoid conflict
@Injectable({
  providedIn: 'root'
})
export class EventService {
  private apiUrl = `${environment.apiBaseUrl}`;
  
  constructor(private http: HttpClient) { }

  getAllEvents(): Observable<EventModel[]> {
    return this.http.get<EventModel[]>(`${this.apiUrl}/admin/evaluations/events`);
  }

  getEventById(id: number): Observable<EventModel> {
    return this.http.get<EventModel>(`${this.apiUrl}/admin/evaluations/events/${id}`);
  }

  createEvent(event: CreateEventDto): Observable<EventModel> {
    return this.http.post<EventModel>(`${this.apiUrl}/admin/evaluations/events`, event);
  }

  updateEvent(id: number, event: UpdateEventDto): Observable<EventModel> {
    return this.http.put<EventModel>(`${this.apiUrl}/admin/evaluations/events/${id}`, event);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/admin/evaluations/events/${id}`);
  }

  getEvaluationsByEventId(eventId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/evaluations/events/${eventId}/evaluations`);
  }
}