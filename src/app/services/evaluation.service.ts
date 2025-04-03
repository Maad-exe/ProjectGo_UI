import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
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

  // Add this method to your existing EvaluationService
  getPerformanceData(): Observable<{labels: string[], averageScores: number[]}> {
    // This would typically fetch from an API endpoint
    return of({
      labels: ['Proposal', 'Design', 'Implementation', 'Testing', 'Presentation'],
      averageScores: [78, 82, 75, 89, 91]
    }).pipe(
      delay(500) // Simulate network delay
    );
  }

  getAllEvaluations(): Observable<any[]> {
    // This would typically fetch from your API
    return of([
      {
        id: 1, 
        name: 'Project Proposal', 
        date: new Date(2023, 9, 15), 
        isCompleted: true,
        averageScore: 85.5
      },
      {
        id: 2, 
        name: 'Design Document', 
        date: new Date(2023, 10, 5), 
        isCompleted: true,
        averageScore: 78.2
      },
      {
        id: 3, 
        name: 'Midterm Presentation', 
        date: new Date(2023, 11, 10), 
        isCompleted: true,
        averageScore: 82.7
      },
      {
        id: 4, 
        name: 'Implementation Review', 
        date: new Date(2023, 12, 1), 
        isCompleted: true,
        averageScore: 88.3
      },
      {
        id: 5, 
        name: 'Final Presentation', 
        date: new Date(2024, 0, 15), 
        isCompleted: true,
        averageScore: 90.1
      },
      {
        id: 6, 
        name: 'Code Review', 
        date: new Date(2024, 1, 5), 
        isCompleted: false
      },
      {
        id: 7, 
        name: 'System Testing', 
        date: new Date(2024, 1, 20), 
        isCompleted: false
      },
      {
        id: 8, 
        name: 'Final Demonstration', 
        date: new Date(2024, 2, 10), 
        isCompleted: false
      }
    ]).pipe(delay(600));
  }
}
