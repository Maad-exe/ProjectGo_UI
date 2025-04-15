import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../env/env';
import { TeacherDetails } from './teacher.service';
import { StudentDetails, GroupDetails } from './group.service';

export interface SupervisionRequest {
  id: number;
  groupId: number;
  groupName: string;
  requestedAt: string;
  groupMembers: StudentDetails[];
  message: string;
}

// Change this to match the lowercase property names as shown in Swagger
export interface SupervisionRequestDto {
  groupId: number;     // Change to lowercase
  teacherId: number;   // Change to lowercase
  message: string;     // Change to lowercase
}

export interface SupervisionResponseDto {
  groupId: number;     // Change to lowercase
  isApproved: boolean; // Change to lowercase
  message?: string;    // Change to lowercase
}

@Injectable({
  providedIn: 'root'
})
export class SupervisionService {
  private apiUrlTeachers = `${environment.apiBaseUrl}/teachers`;
  private apiUrlTeacherDashboard = `${environment.apiBaseUrl}/teacher-dashboard`;

  constructor(private http: HttpClient) {}

  // Student functions
  requestSupervision(request: SupervisionRequestDto): Observable<any> {
    console.log('Sending supervision request with message:', request.message);
    
    return this.http.post(`${environment.apiBaseUrl}/api/supervision/request`, request).pipe(
      catchError(error => {
        console.error('Error in supervision request:', error);
        throw error;
      })
    );
  }

  // Teacher functions
  getSupervisionRequests(): Observable<SupervisionRequest[]> {
    return this.http.get<SupervisionRequest[]>(`${this.apiUrlTeacherDashboard}/supervision-requests`);
  }

  respondToRequest(response: SupervisionResponseDto): Observable<GroupDetails> {
    return this.http.post<GroupDetails>(`${this.apiUrlTeacherDashboard}/respond-to-request`, response);
  }

  getTeacherGroups(): Observable<GroupDetails[]> {
    return this.http.get<GroupDetails[]>(`${this.apiUrlTeacherDashboard}/my-groups`);
  }
}