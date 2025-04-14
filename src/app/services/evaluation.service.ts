import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../env/env';

// Basic DTOs for evaluation
export interface StudentDto {
  id: number;
  fullName: string;
  email: string;
  department?: string;
  enrollmentNumber?: string;
  isEvaluated: boolean;
}

export interface EventEvaluationTypeDto {
  groupEvaluationId: number;
  eventId: number;
  eventName: string;
  hasRubric: boolean;
  rubricId?: number;
  totalMarks: number;
}

export interface CategoryScoreDto {
  categoryId: number;
  score: number;
  feedback?: string;
}

export interface EvaluateStudentDto {
  groupEvaluationId: number;
  studentId: number;
  evaluationId?: number;  // Add this for updates
  obtainedMarks?: number;  // For simple evaluation
  feedback?: string;       // Overall feedback
  categoryScores?: CategoryScoreDto[];  // For rubric evaluation
}

export interface StudentEvaluationDto {
  id: number;
  studentId: number;
  studentName?: string;
  obtainedMarks: number;
  feedback: string;
  eventName?: string;
  totalMarks?: number;
  percentageObtained?: number;
  isComplete?: boolean; // Add this field to track completion status
  evaluatedAt?: string; // Add this to track evaluation date
}

export interface EnhancedStudentEvaluationDto extends StudentEvaluationDto {
  categoryScores: {
    categoryId: number;
    categoryName?: string;
    score: number;
    maxScore?: number;
    feedback?: string;
  }[];
  weightedScore?: number;
}

export interface RubricCategory {
  id: number;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
}

export interface EvaluationRubric {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  categories: RubricCategory[];
}

export interface GroupEvaluationDto {
  id: number;
  eventId: number;
  eventName: string;
  groupId: number;
  groupName: string;
  studentEvaluations: StudentEvaluationDto[];
}

@Injectable({
  providedIn: 'root'
})
export class EvaluationService {
  private apiUrl = environment.apiBaseUrl;
  private studentEvaluationUrl = `${this.apiUrl}/student/evaluations`;
  private teacherEvaluationUrl = `${this.apiUrl}/teacher/evaluations`;
  private adminEvaluationUrl = `${this.apiUrl}/admin/evaluations`;
  
  constructor(private http: HttpClient) { }
  
  // Get evaluation type to determine if it uses a rubric
  getEventEvaluationType(groupEvaluationId: number): Observable<EventEvaluationTypeDto> {
    return this.http.get<EventEvaluationTypeDto>(
      `${this.teacherEvaluationUrl}/event-evaluation-type/${groupEvaluationId}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching evaluation type:', error);
        if (environment.useMockData) {
          return of({
            groupEvaluationId: groupEvaluationId,
            eventId: 1,
            eventName: 'Mock Evaluation Event',
            hasRubric: false,
            totalMarks: 100
          });
        }
        return throwError(() => error);
      })
    );
  }
  
  // Find groupEvaluationId by eventId and groupId
  getGroupEvaluationId(eventId: number, groupId: number): Observable<number> {
    return this.http.get<GroupEvaluationDto[]>(`${this.teacherEvaluationUrl}/panel-assignments`)
      .pipe(
        map(evaluations => {
          const found = evaluations.find(e => e.groupId === groupId && e.eventId === eventId);
          if (found) return found.id;
          throw new Error(`No evaluation found for group ${groupId} and event ${eventId}`);
        }),
        catchError(error => {
          console.error('Error finding group evaluation ID:', error);
          if (environment.useMockData) {
            // Return a mock ID for development
            return of(999);
          }
          return throwError(() => error);
        })
      );
  }
  
  // Get students for a group evaluation
  getStudentsForGroupEvaluation(groupEvaluationId: number): Observable<StudentDto[]> {
    return this.http.get<StudentDto[]>(
      `${this.teacherEvaluationUrl}/group-evaluations/${groupEvaluationId}/students`
    ).pipe(
      catchError(error => {
        console.error('Error fetching students:', error);
        if (environment.useMockData) {
          return of([
            {
              id: 1,
              fullName: 'John Smith',
              email: 'john.smith@example.com',
              department: 'Computer Science',
              enrollmentNumber: 'CS1001',
              isEvaluated: false
            }
          ]);
        }
        return throwError(() => error);
      })
    );
  }
  
  // Get evaluation for a specific student in a group
  getStudentEvaluation(groupId: number, studentId: number): Observable<StudentEvaluationDto> {
    // This endpoint doesn't exist in your controller
    // You would need to add it in TeacherEvaluationController
    // For now, use group-evaluations endpoint
    return this.http.get<GroupEvaluationDto>(`${this.teacherEvaluationUrl}/group-evaluations/${groupId}`)
      .pipe(
        map(groupEval => {
          const studentEval = groupEval.studentEvaluations?.find(e => e.studentId === studentId);
          if (studentEval) return studentEval;
          // Return empty evaluation if not found
          return {
            id: 0,
            studentId: studentId,
            studentName: '',
            obtainedMarks: 0,
            feedback: ''
          };
        }),
        catchError(error => {
          console.error('Error fetching student evaluation:', error);
          if (environment.useMockData) {
            return of(this.getMockStudentEvaluation(studentId));
          }
          return throwError(() => error);
        })
      );
  }
  
  // Submit simple evaluation - Fix DTO to match backend
  submitEvaluation(evaluationDto: EvaluateStudentDto): Observable<StudentEvaluationDto> {
    return this.http.post<StudentEvaluationDto>(
      `${this.teacherEvaluationUrl}/evaluate-student`, 
      evaluationDto
    ).pipe(
      catchError(error => {
        console.error('Error submitting evaluation:', error);
        if (environment.useMockData) {
          return of({ 
            id: 1, 
            studentId: evaluationDto.studentId, 
            obtainedMarks: evaluationDto.obtainedMarks || 0, 
            feedback: evaluationDto.feedback || '' 
          });
        }
        return throwError(() => error);
      })
    );
  }
  
  // Submit rubric-based evaluation - Fix endpoint name and DTO
  submitRubricEvaluation(evaluationDto: EvaluateStudentDto): Observable<EnhancedStudentEvaluationDto> {
    return this.http.post<EnhancedStudentEvaluationDto>(
      `${this.teacherEvaluationUrl}/evaluate-student-with-rubric`, 
      evaluationDto
    ).pipe(
      catchError(error => {
        console.error('Error submitting rubric evaluation:', error);
        if (environment.useMockData) {
          return of({ 
            id: 1, 
            studentId: evaluationDto.studentId, 
            obtainedMarks: 0, 
            feedback: evaluationDto.feedback || '',
            categoryScores: evaluationDto.categoryScores?.map(cs => ({
              categoryId: cs.categoryId,
              score: cs.score,
              feedback: cs.feedback || ''
            })) || []
          } as EnhancedStudentEvaluationDto);
        }
        return throwError(() => error);
      })
    );
  }
  
  // Get student's evaluations for their progress page
  getStudentEvaluations(): Observable<StudentEvaluationDto[]> {
    return this.http.get<StudentEvaluationDto[]>(`${this.studentEvaluationUrl}/progress`).pipe(
      catchError(error => {
        console.error('Error fetching student evaluations:', error);
        if (environment.useMockData) {
          return of(this.getMockStudentEvaluationList());
        }
        return throwError(() => error);
      })
    );
  }
  
  // Get all evaluations (admin)
  getAllEvaluations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.adminEvaluationUrl}/all`).pipe(
      catchError(error => {
        console.error('Error fetching all evaluations:', error);
        return of([]);
      })
    );
  }
  
  // Mark a group evaluation as complete
  completeGroupEvaluation(eventId: number, groupId: number): Observable<any> {
    const completeData = {
      eventId: eventId,
      groupId: groupId,
      isCompleted: true
    };
    return this.http.put<any>(`${this.adminEvaluationUrl}/groups/${groupId}/complete`, completeData);
  }
  
  // Get performance data for charts
  getPerformanceData(): Observable<{labels: string[], averageScores: number[]}> {
    return this.http.get<{labels: string[], averageScores: number[]}>(`${this.adminEvaluationUrl}/performance-data`).pipe(
      catchError(error => {
        console.error('Error fetching performance data:', error);
        return of(this.getMockPerformanceData());
      })
    );
  }
  
  // Mock data methods
  private getMockStudentEvaluation(studentId: number): StudentEvaluationDto {
    return {
      id: 0,
      studentId: studentId,
      obtainedMarks: 0,
      feedback: '',
      totalMarks: 100,
      percentageObtained: 0
    };
  }
  
  private getMockStudentEvaluationList(): StudentEvaluationDto[] {
    return [
      {
        id: 101,
        studentId: 1,
        studentName: 'John Smith',
        obtainedMarks: 85,
        feedback: 'Good presentation skills, work on content depth.',
        eventName: 'Mid-term Presentation',
        totalMarks: 100,
        percentageObtained: 85
      },
      {
        id: 102,
        studentId: 1,
        studentName: 'John Smith',
        obtainedMarks: 42,
        feedback: 'Well-structured report with comprehensive analysis.',
        eventName: 'Progress Report',
        totalMarks: 50,
        percentageObtained: 84
      },
      {
        id: 103,
        studentId: 1,
        studentName: 'John Smith',
        obtainedMarks: 0,
        feedback: '',
        eventName: 'Final Defense',
        totalMarks: 100,
        percentageObtained: 0
      }
    ];
  }
  
  private getMockPerformanceData(): {labels: string[], averageScores: number[]} {
    return {
      labels: ['Mid-term', 'Progress Report', 'Final Defense', 'Documentation', 'Code Quality'],
      averageScores: [78.5, 82.3, 76.9, 85.2, 79.8]
    };
  }
}
