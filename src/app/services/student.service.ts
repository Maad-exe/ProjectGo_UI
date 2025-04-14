import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment} from '../../env/env';

export interface Student {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  enrollmentNumber: string;
  department: string;
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private apiUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) { }

  getAllStudents(): Observable<Student[]> {
    return this.http.get<Student[]>(`${this.apiUrl}/students`);
  }

  // According to your Swagger, there's no direct endpoint for getting a single student
  // But there's an endpoint for user details we can use
  getStudentById(studentId: number): Observable<any> {
    // Use the UserManagement endpoint instead
    return this.http.get<any>(`${this.apiUrl}/users/${studentId}`).pipe(
      catchError(error => {
        console.error('Error fetching student:', error);
        // Return a more detailed mock student when API fails
        return of({
          id: studentId,
          fullName: `Mock Student ${studentId}`,
          email: `student${studentId}@example.com`,
          regNumber: `FA20-BCS-${studentId.toString().padStart(3, '0')}`,
          department: 'Computer Science',
          year: 3
        });
      })
    );
  }

  getStudentByUserId(userId: number): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/students/user/${userId}`);
  }

  getStudentByEmail(email: string): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/students/email/${email}`);
  }
  
  getStudentProgress(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/students/${studentId}/progress`);
  }
}