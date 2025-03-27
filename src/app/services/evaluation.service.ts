import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';
import { 
  StudentEvaluation, 
  GroupEvaluation, 
  SimpleEvaluationDto, 
  RubricEvaluationDto,
  FinalGrade
} from '../models/evaluation.model';

@Injectable({
  providedIn: 'root'
})
export class EvaluationService {
  // Fix: Using the correct base URL without duplicating '/api'
  private apiUrl = `${environment.apiBaseUrl}`;
  private baseUrl = `${environment.apiBaseUrl}/admin/evaluations`;

  constructor(private http: HttpClient) { }

  // Get all group evaluations for an event
  getEventEvaluations(eventId: number): Observable<GroupEvaluation[]> {
    return this.http.get<GroupEvaluation[]>(`${this.apiUrl}/evaluation/events/${eventId}`);
  }

  // Get evaluations for a specific group in an event
  getGroupEvaluation(eventId: number, groupId: number): Observable<GroupEvaluation> {
    return this.http.get<GroupEvaluation>(`${this.apiUrl}/evaluation/events/${eventId}/groups/${groupId}`);
  }

  // Get a student's evaluation by a specific teacher
  getStudentEvaluation(eventId: number, studentId: number, teacherId: number): Observable<StudentEvaluation> {
    return this.http.get<StudentEvaluation>(`${this.apiUrl}/teacher/evaluations/events/${eventId}/students/${studentId}/teacher/${teacherId}`);
  }

  // Submit a simple evaluation (no rubric)
  submitSimpleEvaluation(evaluation: SimpleEvaluationDto): Observable<StudentEvaluation> {
    return this.http.post<StudentEvaluation>(`${this.apiUrl}/teacher/evaluations/evaluate-student`, evaluation);
  }

  // Submit a rubric-based evaluation
  submitRubricEvaluation(evaluation: RubricEvaluationDto): Observable<StudentEvaluation> {
    return this.http.post<StudentEvaluation>(`${this.apiUrl}/teacher/evaluations/evaluate-student-with-rubric`, evaluation);
  }

  // Get all evaluations for a group in an event
  getGroupEvaluations(eventId: number, groupId: number): Observable<GroupEvaluation> {
    return this.http.get<GroupEvaluation>(`${this.apiUrl}/admin/evaluations/group-evaluations/${groupId}`);
  }

  // Mark a group evaluation as complete
  completeGroupEvaluation(eventId: number, groupId: number): Observable<GroupEvaluation> {
    return this.http.put<GroupEvaluation>(`${this.apiUrl}/admin/evaluations/group-evaluations/${groupId}/complete`, {});
  }

  // Get a student's evaluations across all events
  getStudentEvaluations(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/student/evaluations/progress`);
  }

  // Calculate final grades for a student based on evaluation weights
  calculateFinalGrade(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/student/evaluations/final-grade`);
  }

  // Get student dashboard data
  getStudentDashboard(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/student/evaluations/dashboard`);
  }

  // Get normalized grades across all students (admin only)
  getNormalizedGrades(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/rubrics/normalized-grades`);
  }

  // Rubric Management
  getRubricById(id: number): Observable<any> {
    return this.http.get<any>(`${environment.apiBaseUrl}/admin/rubrics/${id}`);
  }
  
  // Student Evaluations
  getStudentEvaluationsById(studentId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/students/${studentId}/evaluations`);
  }
  
  submitStudentEvaluation(evaluationData: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/submit`, evaluationData);
  }
  
  // For teacher/admin views
  getGroupEvaluationById(eventId: number, groupId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/events/${eventId}/groups/${groupId}`);
  }
  
  calculateFinalGradeById(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/students/${studentId}/final-grade`);
  }
  
  completeGroupEvaluationById(eventId: number, groupId: number): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/events/${eventId}/groups/${groupId}/complete`, {});
  }
}
