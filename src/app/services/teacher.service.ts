import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../env/env';
import { AuthService } from './auth.service';
export interface TeacherDetails {
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

}