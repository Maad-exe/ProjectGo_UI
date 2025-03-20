import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeacherService, TeacherDetails } from '../../../services/teacher.service';
import { GroupService, GroupDetails } from '../../../services/group.service';
import { NotificationService } from '../../../services/notifications.service';
import { AuthService } from '../../../services/auth.service';
import { SupervisionRequestDto } from '../../../services/supervision.service';

@Component({
  selector: 'app-teacher-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
  ],
  templateUrl: './teacher-list.component.html',
  styleUrls: ['./teacher-list.component.scss']
})
export class TeacherListComponent implements OnInit {
  @Input() selectedGroupId: number | null = null;
  @Output() teacherSelected = new EventEmitter<void>();
  teachers: TeacherDetails[] = [];
  groups: GroupDetails[] = [];
  isLoading = false;
  isLoadingGroups = false;
  isRequestingSupervision = false;
  error: string | null = null;
  groupError: string | null = null;
  requestMessage = '';
  studentId: number | null = null;
  showTeachersList = false;
  supervisionMessage: string = '';
  showMessageInputForTeacher: number | null = null;

  constructor(
    private teacherService: TeacherService,
    private groupService: GroupService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadTeachers();
  }

  loadStudentInfo(): void {
    this.studentId = this.authService.getUserId();
    if (!this.studentId) {
      this.router.navigate(['/login']);
    }
  }

  loadTeachers(): void {
    this.isLoading = true;
    this.error = null;
    
    this.teacherService.getAllTeachers().subscribe({
      next: (data) => {
        this.teachers = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading teachers:', error);
        this.error = 'Failed to load teachers';
        this.isLoading = false;
      }
    });
  }

  loadStudentGroups(): void {
    if (!this.studentId) return;
    
    this.isLoadingGroups = true;
    this.groupError = null;
    
    this.groupService.getStudentGroups(this.studentId).subscribe({
      next: (data) => {
        // Only show groups that need supervision
        this.groups = data.filter(group => 
          !group.teacherId && 
          (group.supervisionStatus === 'None' || 
           group.supervisionStatus === 'Rejected')
        );
        this.isLoadingGroups = false;
      },
      error: (error) => {
        console.error('Error loading groups:', error);
        this.groupError = 'Failed to load your groups';
        this.isLoadingGroups = false;
      }
    });
  }

  selectGroup(groupId: number): void {
    this.selectedGroupId = groupId;
  }

  getGroupById(groupId: number | null): GroupDetails | undefined {
    if (!groupId) return undefined;
    return this.groups.find(g => g.id === groupId);
  }

  requestSupervision(teacherId: number): void {
    if (!this.selectedGroupId) {
      this.notificationService.showError('Please select a group first');
      return;
    }
    
    this.isRequestingSupervision = true;
    const request: SupervisionRequestDto = {
      groupId: this.selectedGroupId,
      teacherId: teacherId,
      message: this.requestMessage || 'Please supervise our group project'
    };
    
    // Find the teacher object to get the name
    const teacher = this.teachers.find(t => t.id === teacherId);
    const teacherName = teacher ? teacher.fullName : 'Unknown Teacher';
    
    this.teacherService.requestSupervision(request).subscribe({
      next: () => {
        this.notificationService.showSuccess('Supervision request sent successfully');
        this.isRequestingSupervision = false;
        
        // Update the selected group with the requested teacher info
        const selectedGroup = this.groups.find(g => g.id === this.selectedGroupId);
        if (selectedGroup) {
          selectedGroup.requestedTeacherId = teacherId;
          selectedGroup.requestedTeacherName = teacherName;
          selectedGroup.supervisionStatus = 'Requested';
        }
        
        // Reload groups to update status
        this.loadStudentGroups();
      },
      error: (error: any) => {
        console.error('Error requesting supervision:', error);
        this.notificationService.showError('Failed to send supervision request');
        this.isRequestingSupervision = false;
      }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/student-dashboard']);
  }

  showMessageInput(teacherId: number): void {
    this.showMessageInputForTeacher = teacherId;
    this.supervisionMessage = ''; 
  }

  cancelMessageInput(): void {
    this.showMessageInputForTeacher = null;
    this.supervisionMessage = '';
  }

  getTeacherName(teacherId: number | null): string {
    if (!teacherId) return '';
    const teacher = this.teachers.find(t => t.id === teacherId);
    return teacher ? teacher.fullName : '';
  }
}
