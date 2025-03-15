import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../env/env';
import { AuthService } from './auth.service';
import { map } from 'rxjs/operators';
import { SupervisionRequestDto } from './supervision.service';

export interface TeacherDetails {
  id: number;
  fullName: string;
  email: string;
  qualification: string;
  areaOfSpecialization: string;
  officeLocation: string;
  assignedGroups: number;
 
}

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  getAllTeachers(): Observable<TeacherDetails[]> {
    console.log('Requesting teachers with token:', localStorage.getItem('token')?.substring(0, 20) + '...');
    return this.http.get<TeacherDetails[]>(`${environment.authApiUrl}/teachers`)
      .pipe(
        catchError(error => {
          if (error.status === 403) {
            console.error('Access forbidden: User does not have Student role');
            
          } else {
            console.error('Error fetching teachers:', error);
          }
          throw error;
        })
      );
  }

  getTeacherById(teacherId: number): Observable<TeacherDetails> {

    const url = `${environment.apiBaseUrl}/teachers/${teacherId}`;
    console.log('Fetching teacher details from:', url);
    return this.http.get<TeacherDetails>(url)
      .pipe(
        // Map the response to handle potential property name differences
        map((response: any) => {
          // Create a normalized teacher object that matches our interface
          const teacher: TeacherDetails = {
            id: response.id,
            fullName: response.fullName || response.FullName, 
            email: response.email || response.Email,
            qualification: response.qualification || response.Qualification,
            areaOfSpecialization: response.areaOfSpecialization || response.AreaOfSpecialization,
            officeLocation: response.officeLocation || response.OfficeLocation,
            assignedGroups: response.assignedGroups || response.AssignedGroups
          };
          console.log('Normalized teacher object:', teacher);
          return teacher;
        }),
        catchError(error => {
          console.error(`Error fetching teacher with ID ${teacherId}:`, error);
          throw error;
        })
      );
  }

  requestSupervision(request: SupervisionRequestDto): Observable<any> {
    // Store the requestedTeacherId in local storage to retrieve it later if needed
    localStorage.setItem(`group_${request.groupId}_requestedTeacher`, request.teacherId.toString());
    
    return this.http.post(`${environment.apiBaseUrl}/teachers/request-supervision`, request).pipe(
      map(response => {
        console.log('Supervision request sent successfully:', response);
        return response;
      }),
      catchError(error => {
        console.error('Error sending supervision request:', error);
        throw error;
      })
    );
  }

}