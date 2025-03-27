import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private apiUrl = `${environment.apiBaseUrl}/students`;

  constructor(private http: HttpClient) { }

  getAllStudents(): Observable<Student[]> {
    return this.http.get<Student[]>(this.apiUrl);
  }

  getStudentById(id: number): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/${id}`);
  }

  getStudentByUserId(userId: number): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/user/${userId}`);
  }

  getStudentByEmail(email: string): Observable<Student> {
    return this.http.get<Student>(`${this.apiUrl}/email/${email}`);
  }
  
  getStudentProgress(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${studentId}/progress`);
  }
}