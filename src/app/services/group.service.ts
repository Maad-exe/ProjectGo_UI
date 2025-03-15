import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../env/env';
import { map, catchError, tap } from 'rxjs/operators'; 


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
  teacherId?: number | null;
  teacherName?: string; 
  supervisionStatus?: string;
  requestedTeacherId?: number | null; 
  requestedTeacherName?: string;
}

export interface CreateGroupRequest {
  groupName: string;
  memberEmails: string[];
}

export interface GroupSupervisionStatus {
  status: string;
  teacherId: number | null;
}

export interface GroupStatusMap {
  [groupId: string]: GroupSupervisionStatus;
}

export interface StudentSupervisionStatus {
  isInSupervisedGroup: boolean;
  groupName?: string;
  supervisorName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private apiUrl = `${environment.apiBaseUrl}/groups`; 

  constructor(private http: HttpClient) {}

  getStudentGroups(studentId: number): Observable<GroupDetails[]> {
    return this.http.get<any[]>(`${this.apiUrl}/student/${studentId}`).pipe(
      map(groups => {
        return groups.map(group => {
          // Process each group to ensure it has the required fields
          const processedGroup: GroupDetails = {
            ...group,
            // For groups with "Requested" or "Rejected" status, set the requestedTeacherId to be the same as teacherId
            requestedTeacherId: (group.supervisionStatus === 'Requested' || group.supervisionStatus === 'Rejected') 
              ? group.teacherId 
              : null
          };
          return processedGroup;
        });
      })
    );
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

  // Properly implemented checkGroupsSupervisionStatus method
  checkGroupsSupervisionStatus(groupIds: number[]): Observable<GroupStatusMap> {
    // Create a comma-separated list of IDs for the query parameter
    const idsParam = groupIds.join(',');
    return this.http.get<GroupStatusMap>(`${this.apiUrl}/supervision-status?ids=${idsParam}`);
  }

  cleanupOtherGroups(acceptedGroupId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cleanup/${acceptedGroupId}`, {}).pipe(
      tap(response => {
        console.log('Cleanup response:', response);
      }),
      catchError(error => {
        console.error('Error cleaning up groups:', error);
        throw error;
      })
    );
  }

  checkStudentSupervisionStatus(studentId: number): Observable<StudentSupervisionStatus> {
    return this.http.get<StudentSupervisionStatus>(`${this.apiUrl}/student/${studentId}/supervision-status`).pipe(
      catchError(error => {
        console.error('Error checking student supervision status:', error);
        // Return a default value if API fails
        return of({ isInSupervisedGroup: false });
      })
    );
  }
}