import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';

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
  constructor(private http: HttpClient) {}

  getAllTeachers(): Observable<TeacherDetails[]> {
    return this.http.get<TeacherDetails[]>(`${environment.authApiUrl}/teachers`);
  }
}