// services/event.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EvaluationEvent, CreateEventDto, UpdateEventDto } from '../dashboard/event.model';
import { environment } from '../../env/env';



@Injectable({
  providedIn: 'root'
})
export class EventService {
  private baseUrl = `${environment.apiBaseUrl}/admin/evaluations`;

  constructor(private http: HttpClient) { }

  createEvent(event: CreateEventDto): Observable<EvaluationEvent> {
    return this.http.post<EvaluationEvent>(`${this.baseUrl}/events`, event);
  }

  getAllEvents(): Observable<EvaluationEvent[]> {
    return this.http.get<EvaluationEvent[]>(`${this.baseUrl}/events`);
  }

  getEventById(id: number): Observable<EvaluationEvent> {
    return this.http.get<EvaluationEvent>(`${this.baseUrl}/events/${id}`);
  }

  updateEvent(id: number, event: UpdateEventDto): Observable<EvaluationEvent> {
    return this.http.put<EvaluationEvent>(`${this.baseUrl}/events/${id}`, event);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/events/${id}`);
  }
}