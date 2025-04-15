import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, of, BehaviorSubject } from 'rxjs';
import { environment } from '../../env/env';
import { map, catchError, tap, delay } from 'rxjs/operators';
import { TeacherService, TeacherDetails } from './teacher.service'; // Fixed import

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
  
  // State management
  private _approvedGroup: GroupDetails | null = null;
  private groupSupervisor: TeacherDetails | null = null;
  
  // Subjects for state changes
  private approvedGroupSubject = new BehaviorSubject<GroupDetails | null>(null);
  private supervisorSubject = new Subject<TeacherDetails | null>();
  
  // Observable streams
  approvedGroup$ = this.approvedGroupSubject.asObservable();
  supervisorChanged = this.supervisorSubject.asObservable();

  // Add this property and method
  private groupsRefreshSubject = new Subject<void>();
  groupsRefresh$ = this.groupsRefreshSubject.asObservable();

  constructor(private http: HttpClient, private teacherService: TeacherService) {}

  // State management methods
  getApprovedGroup(): GroupDetails | null {
    return this._approvedGroup;
  }

  setApprovedGroup(group: GroupDetails | null): void {
    console.log('Setting approved group in service:', group?.name || 'null');
    this._approvedGroup = group;
    // This triggers the sidebar component to enable the chat button
    this.approvedGroupSubject.next(group);
    
    // If group is cleared, also clear supervisor
    if (!group) {
      this.setSupervisor(null);
    } else if (group.teacherId) {
      // Load supervisor details if teacher ID exists but supervisor isn't set
      this.loadSupervisorIfNeeded(group.teacherId);
    }
  }

  private loadSupervisorIfNeeded(teacherId: number): void {
    if (!this.groupSupervisor || this.groupSupervisor.id !== teacherId) {
      this.teacherService.getTeacherById(teacherId).subscribe({
        next: (teacher: TeacherDetails) => this.setSupervisor(teacher),
        error: (err: any) => console.error('Failed to load supervisor:', err)
      });
    }
  }

  getSupervisor(): TeacherDetails | null {
    return this.groupSupervisor;
  }

  setSupervisor(teacher: TeacherDetails | null): void {
    this.groupSupervisor = teacher;
    this.supervisorSubject.next(teacher);
  }

  // API methods
  getStudentGroups(studentId: number): Observable<GroupDetails[]> {
    return this.http.get<GroupDetails[]>(`${this.apiUrl}/student/${studentId}`).pipe(
      map(groups => {
        // Find approved group automatically
        const approvedGroup = groups.find(g => 
          g.supervisionStatus === 'Approved' && g.teacherId != null
        );
        
        if (approvedGroup) {
          console.log('Found approved group in getStudentGroups:', approvedGroup.name);
          this.setApprovedGroup(approvedGroup);
        }
        
        return groups;
      }),
      catchError(error => {
        console.error('Error fetching student groups:', error);
        throw error;
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

  checkGroupsSupervisionStatus(groupIds: number[]): Observable<GroupStatusMap> {
    const idsParam = groupIds.join(',');
    return this.http.get<GroupStatusMap>(`${this.apiUrl}/supervision-status?ids=${idsParam}`);
  }

  cleanupOtherGroups(acceptedGroupId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cleanup/${acceptedGroupId}`, {}).pipe(
      tap(() => {
        // Refresh groups after cleanup
        this.groupsRefreshSubject.next(); // Trigger refresh across components
      }),
      catchError(error => {
        console.error('Error cleaning up groups:', error);
        throw error;
      })
    );
  }

  checkStudentSupervisionStatus(studentId: number): Observable<StudentSupervisionStatus> {
    return this.http.get<StudentSupervisionStatus>(
      `${this.apiUrl}/student/${studentId}/supervision-status`
    ).pipe(
      catchError(() => of({ isInSupervisedGroup: false }))
    );
  }

  // Add this method to your GroupService class
  getGroupsWithSupervisors(): Observable<GroupDetails[]> {
    return this.http.get<GroupDetails[]>(`${this.apiUrl}/with-supervisors`);
  }

  // Method to trigger a group refresh
  refreshGroups(): void {
    this.groupsRefreshSubject.next();
  }

  // Add this method to your GroupService
  getAllGroups(): Observable<any[]> {
    // Replace with the actual API endpoint if available
    const url = `${this.apiUrl}/groups`;
    
    // For now, return mock data
    return of([
      {
        id: 1,
        name: 'Project Group 1',
        supervisionStatus: 'Approved',
        members: [/* members here */],
        createdAt: '2023-05-10'
      },
      {
        id: 2,
        name: 'Project Group 2',
        supervisionStatus: 'Pending',
        members: [/* members here */],
        createdAt: '2023-05-15'
      },
      {
        id: 3,
        name: 'Project Group 3',
        supervisionStatus: 'Rejected',
        members: [/* members here */],
        createdAt: '2023-05-20'
      }
      // Add more mock groups as needed
    ]).pipe(delay(500));
  }
}