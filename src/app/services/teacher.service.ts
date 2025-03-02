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
}

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  getAllTeachers(): Observable<TeacherDetails[]> {
    console.log('Token when fetching teachers:', localStorage.getItem('token'));
    return this.http.get<TeacherDetails[]>(`${environment.authApiUrl}/teachers`)
      .pipe(
        catchError(error => {
          console.error('Teacher service error:', error);
          throw error;
        })
      );
  }

}