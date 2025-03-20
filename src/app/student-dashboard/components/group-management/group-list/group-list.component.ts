import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { GroupService, GroupDetails } from '../../../../services/group.service';
import { TeacherService, TeacherDetails } from '../../../../services/teacher.service';
import { AuthService } from '../../../../services/auth.service';
import { NotificationService } from '../../../../services/notifications.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApprovedGroupComponent } from '../approved-group/approved-group.component';
import { GroupCleanupInfoDialogComponent } from '../../../../shared/group-cleanup-info-dialog/group-cleanup-info-dialog.component';
@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    ApprovedGroupComponent,
   // GroupCleanupInfoDialogComponent
  ],
  templateUrl: './group-list.component.html',
  styleUrls: ['./group-list.component.scss']
})
export class GroupListComponent implements OnInit {
  groups: GroupDetails[] = [];
  isLoading: boolean = false;
  hasApprovedGroup: boolean = false;
  approvedGroup: GroupDetails | null = null;
  groupSupervisor: TeacherDetails | null = null;

  @Output() requestSupervision = new EventEmitter<number>();
  @Output() hasApprovedGroupChange = new EventEmitter<boolean>();

  constructor(
    private groupService: GroupService,
    private teacherService: TeacherService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.loadStudentGroups();
    this.groupService.supervisorChanged.subscribe(teacher => {
      this.groupSupervisor = teacher;
    });
  }

  loadStudentGroups() {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.authService.decodeToken(token);
      const studentId = payload.UserId;
  
      this.groupService.getStudentGroups(studentId).subscribe({
        next: (groups) => {
          console.log('Student groups loaded:', groups);
          
          // If we have an approved group, we should only have one group
          const approvedGroup = groups.find(g => 
            g.supervisionStatus === 'Approved' && 
            g.teacherId !== null && g.teacherId !== undefined
          );
          
          if (approvedGroup) {
            // If there's an approved group but somehow other groups still exist,
            // we could trigger a cleanup
            if (groups.length > 1) {
              console.warn('Found multiple groups when there should only be one approved group');
              this.groupService.cleanupOtherGroups(approvedGroup.id).subscribe({
                next: () => {
                  console.log('Cleanup successful');
                  // Refresh groups after cleanup
                  this.loadStudentGroups();
                },
                error: (err) => console.error('Failed to clean up other groups:', err)
              });
              return;
            }
          }
          
          // Ensure we have all teacher names for groups with teacherIds
          const teacherIdsToFetch = new Set<number>();
          
          groups.forEach(group => {
            // Add teacherId for approved groups
            if (group.teacherId && !group.teacherName) {
              teacherIdsToFetch.add(group.teacherId);
            }
            
            // Also add requestedTeacherId for requested/rejected groups
            if ((group.supervisionStatus === 'Requested' || group.supervisionStatus === 'Rejected') && 
                group.requestedTeacherId && !group.requestedTeacherName) {
              teacherIdsToFetch.add(group.requestedTeacherId);
            }
          });
          
          // If we have teacher IDs that need names, fetch them
          if (teacherIdsToFetch.size > 0) {
            this.fetchMissingTeacherNames(Array.from(teacherIdsToFetch), groups);
          } else {
            // Process groups immediately if no names to fetch
            this.processLoadedGroups(groups);
          }
        },
        error: (error) => {
          console.error('Failed to load student groups:', error);
          this.notificationService.showError('Failed to load your groups');
        }
      });
    }
  }

  fetchMissingTeacherNames(teacherIds: number[], groups: GroupDetails[]) {
    // Create an array of observables for each teacher ID
    const teacherObservables = teacherIds.map(id => 
      this.teacherService.getTeacherById(id).pipe(
        catchError((error: any) => {
          console.error(`Error fetching teacher with ID ${id}:`, error);
          // Return null teacher on error
          return of(null);
        })
      )
    );
    
    // Use forkJoin to wait for all requests to complete
    forkJoin(teacherObservables).subscribe((teachers: any[]) => {
      // Create a map of teacher IDs to names
      const teacherMap = new Map<number, string>();
      teachers.forEach(teacher => {
        if (teacher) {
          teacherMap.set(teacher.id, teacher.fullName);
        }
      });
      
      // Update group teacher names for different statuses
      groups.forEach(group => {
        // For approved groups
        if (group.teacherId && !group.teacherName && teacherMap.has(group.teacherId)) {
          group.teacherName = teacherMap.get(group.teacherId)!;
        }
        
        // For requested/rejected groups
        if ((group.supervisionStatus === 'Requested' || group.supervisionStatus === 'Rejected') && 
            group.requestedTeacherId && !group.requestedTeacherName && 
            teacherMap.has(group.requestedTeacherId)) {
          group.requestedTeacherName = teacherMap.get(group.requestedTeacherId)!;
        }
      });
      
      // Process groups with updated teacher names
      this.processLoadedGroups(groups);
    });
  }

  processLoadedGroups(groups: GroupDetails[]) {
    // Check if we had no approved group before but now we do
    const hadApprovedGroupBefore = this.hasApprovedGroup;
    
    // Update groups
    this.groups = groups;
    
    // Look for any group that has approved supervision status
    const approvedGroup = groups.find(group => 
      group.supervisionStatus === 'Approved' || 
      (group.teacherId !== null && group.teacherId !== undefined && group.teacherId > 0)
    );
    
    console.log('Approved group found:', approvedGroup);
    
    // Set properties and update service
    this.hasApprovedGroup = !!approvedGroup;
    this.approvedGroup = approvedGroup || null;
    
    // Store approved group in service
    if (this.approvedGroup) {
      this.groupService.setApprovedGroup(this.approvedGroup);
    }
    
    // Emit the change to parent components
    this.hasApprovedGroupChange.emit(this.hasApprovedGroup);
    
    // If we now have an approved group but didn't before, show the dialog
    if (this.hasApprovedGroup && !hadApprovedGroupBefore) {
      this.showGroupCleanupInfo();
    }
    
    // If there's an approved group, load the supervisor details
    if (this.approvedGroup && this.approvedGroup.teacherId) {
      console.log(`Loading supervisor details for teacher ID: ${this.approvedGroup.teacherId}`);
      this.loadSupervisorDetails(this.approvedGroup.teacherId);
    }
  }

  showGroupCleanupInfo(): void {
    // Get the current user ID from the token
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const payload = this.authService.decodeToken(token);
    const userId = payload.UserId || payload.sub;
    
    if (!userId) return;
    
    // Use a user-specific key in localStorage
    const dontShowAgainKey = `dontShowGroupCleanupInfo_${userId}`;
    
    // Check if the current user has chosen not to show this dialog again
    const dontShowAgain = localStorage.getItem(dontShowAgainKey) === 'true';
    
    if (dontShowAgain) {
      return; // Don't show the dialog for this specific user
    }
    
    const dialogRef = this.dialog.open(GroupCleanupInfoDialogComponent, {
      width: '500px',
      disableClose: true
    });
    
    dialogRef.afterClosed().subscribe(result => {
      // If user checked "don't show again" box, save this preference for this specific user
      if (result === true) {
        localStorage.setItem(dontShowAgainKey, 'true');
      }
    });
  }

  showRequestSupervisionForm(groupId: number) {
    const group = this.groups.find(g => g.id === groupId);
    
    if (!group) {
      this.notificationService.showError('Group not found');
      return;
    }
    
    if (!this.isGroupCreator(group)) {
      this.notificationService.showInfo('Only the group creator can request supervision');
      return;
    }
    
    this.requestSupervision.emit(groupId);
  }

  isGroupCreator(group: GroupDetails): boolean {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.authService.decodeToken(token);
      const studentEmail = payload.email || payload.sub;
      
      return group.members.some(member => 
        member.isCreator && member.email === studentEmail
      );
    }
    return false;
  }

  loadSupervisorDetails(teacherId: number) {
    console.log('Loading supervisor details for ID:', teacherId);
    this.teacherService.getTeacherById(teacherId).subscribe({
      next: (teacher) => {
        console.log('Supervisor details loaded:', teacher);
        // Store teacher in service for other components
        this.groupService.setSupervisor(teacher);
      },
      error: (error) => {
        console.error('Failed to load supervisor details:', error);
        this.notificationService.showError('Failed to load supervisor details');
      }
    });
  }

  checkGroupSupervisionStatus(groupIds: number[]): void {
    this.groupService.checkGroupsSupervisionStatus(groupIds).subscribe({
      next: (statusMap) => {
        console.log('Group supervision statuses:', statusMap);
        
        // Update local group objects with the correct status
        this.groups = this.groups.map(group => {
          const status = statusMap[group.id.toString()];
          return {
            ...group,
            supervisionStatus: status?.status || group.supervisionStatus || 'Pending',
            teacherId: status?.teacherId !== undefined ? status.teacherId : group.teacherId
          };
        });
        
        // Find approved group with a teacher
        const approvedGroup = this.groups.find(group => 
          group.supervisionStatus === 'Approved' && group.teacherId != null
        );
        
        this.hasApprovedGroup = !!approvedGroup;
        this.approvedGroup = approvedGroup || null;
        
        // Update service
        if (this.approvedGroup) {
          this.groupService.setApprovedGroup(this.approvedGroup);
        }
        
        // Emit the change
        this.hasApprovedGroupChange.emit(this.hasApprovedGroup);
        
        // If there's an approved group, load the supervisor details
        if (this.approvedGroup && this.approvedGroup.teacherId) {
          console.log(`Loading supervisor details for teacher ID: ${this.approvedGroup.teacherId}`);
          this.loadSupervisorDetails(this.approvedGroup.teacherId);
        }
      },
      error: (error) => {
        console.error('Failed to check group supervision status:', error);
      }
    });
  }

  refreshGroups() {
    this.loadStudentGroups();
  }

  async checkIfStudentInSupervisedGroup(studentId: number): Promise<boolean> {
    try {
      const response = await this.groupService.checkStudentSupervisionStatus(studentId).toPromise();
      return response?.isInSupervisedGroup ?? false;
    } catch (error) {
      console.error('Error checking student supervision status:', error);
      return false;
    }
  }

  get hasOtherGroups(): boolean {
    if (!this.hasApprovedGroup) {
      return this.groups.length > 0;
    }
    
    // Count groups that are either not approved or are different from the approved group
    return this.groups.filter(g => 
      !g.teacherId || 
      g.supervisionStatus !== 'Approved' || 
      (this.approvedGroup && g.id !== this.approvedGroup.id)
    ).length > 0;
  }
}