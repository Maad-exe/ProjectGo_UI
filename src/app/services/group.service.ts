
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';

export interface StudentDetails {
  id: number;
  fullName: string;
  email: string;
  enrollmentNumber: string;
  department: string;
  isCreator: boolean;
}

export interface GroupDetails {
  id: number;
  name: string;
  createdAt: string;
  members: StudentDetails[];
}

export interface CreateGroupRequest {
  groupName: string;
  memberEmails: string[];
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private apiUrl = `${environment.apiBaseUrl}/groups`; 

  constructor(private http: HttpClient) {}

  getStudentGroups(studentId: number): Observable<GroupDetails[]> {
    return this.http.get<GroupDetails[]>(`${this.apiUrl}/student/${studentId}`);
  }

  getGroupById(groupId: number): Observable<GroupDetails> {
    return this.http.get<GroupDetails>(`${this.apiUrl}/${groupId}`);
  }

  createGroup(request: CreateGroupRequest): Observable<GroupDetails> {
    return this.http.post<GroupDetails>(this.apiUrl, request);
  }

  searchStudentByEmail(email: string): Observable<StudentDetails> {
    return this.http.get<StudentDetails>(`${this.apiUrl}/student/search?email=${email}`);
  }
}