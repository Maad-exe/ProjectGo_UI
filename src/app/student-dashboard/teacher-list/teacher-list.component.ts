import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeacherService, TeacherDetails } from '../../services/teacher.service';
import { GroupService, GroupDetails } from '../../services/group.service';
import { NotificationService } from '../../services/notifications.service';
import { AuthService } from '../../services/auth.service';

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
  teachers: TeacherDetails[] = [];
  groups: GroupDetails[] = [];
  isLoading = false;
  isLoadingGroups = false;
  isRequestingSupervision = false;
  error: string | null = null;
  groupError: string | null = null;
  selectedGroupId: number | null = null;
  requestMessage = '';
  studentId: number | null = null;

  constructor(
    private teacherService: TeacherService,
    private groupService: GroupService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadStudentInfo();
    this.loadTeachers();
    this.loadStudentGroups();
    
    // Check for group ID in query params
    this.route.queryParams.subscribe(params => {
      if (params['groupId']) {
        this.selectedGroupId = +params['groupId'];
      }
    });
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
        this.error = error.status === 403 
          ? 'You do not have permission to view the teacher list' 
          : 'Failed to load teachers';
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
        // Filter for groups without a supervisor
        this.groups = data.filter(group => 
          group.supervisionStatus === 'None' || 
          group.supervisionStatus === 'Rejected'
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
    const request = {
      groupId: this.selectedGroupId,
      teacherId: teacherId,
      message: this.requestMessage || 'Please supervise our group project'
    };
    
    this.teacherService.requestSupervision(request).subscribe({
      next: () => {
        this.notificationService.showSuccess('Supervision request sent successfully');
        this.isRequestingSupervision = false;
        
        // Reload groups to update status
        this.loadStudentGroups();
      },
      error: (error) => {
        console.error('Error requesting supervision:', error);
        this.notificationService.showError('Failed to send supervision request');
        this.isRequestingSupervision = false;
      }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/student-dashboard']);
  }
}
