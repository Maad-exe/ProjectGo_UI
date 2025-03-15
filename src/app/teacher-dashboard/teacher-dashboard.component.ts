import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notifications.service';
import { SupervisionService, SupervisionRequest, SupervisionResponseDto } from '../services/supervision.service';
import { GroupDetails } from '../services/group.service';
import { GroupChatComponent } from '../group-chat/group-chat.component';

interface TeacherInfo {
  fullName: string;
  email: string;
  qualification: string;
  areaOfSpecialization: string;
  officeLocation: string;
}

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, GroupChatComponent],
  templateUrl: './teacher-dashboard.component.html',
  styleUrls: ['./teacher-dashboard.component.scss']
})
export class TeacherDashboardComponent implements OnInit {
  currentView = 'dashboard';
  isLoading = false;
  teacherInfo: TeacherInfo = {
    fullName: '',
    email: '',
    qualification: '',
    areaOfSpecialization: '',
    officeLocation: ''
  };
  
  supervisionRequests: SupervisionRequest[] = [];
  processingRequestIds: Set<number> = new Set();
  teacherGroups: GroupDetails[] = [];
  selectedGroupForChat: GroupDetails | null = null;
  showGroupChat: boolean = false;
  
  constructor(
    private authService: AuthService,
    private router: Router,
    private supervisionService: SupervisionService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    if (!this.authService.isTeacher()) {
      this.notificationService.showError('Access denied: Teacher role required');
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadTeacherInfo();
    //this.setView('dashboard');
  }

  loadTeacherInfo() {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.authService.decodeToken(token);
      this.teacherInfo = {
        fullName: payload.name || 'Teacher Name',
        email: payload.email || payload.sub || '',
        qualification: payload.qualification || 'Not Available',
        areaOfSpecialization: payload.areaOfSpecialization || 'Not Available',
        officeLocation: payload.officeLocation || 'Not Available'
      };
    }
  }
  
  setView(view: string) {
    this.currentView = view;
    this.showGroupChat = false;
    
    if (view === 'requests') {
      this.loadSupervisionRequests();
    } else if (view === 'groups') {
      this.loadTeacherGroups();
    }
  }
  
  loadSupervisionRequests() {
    this.isLoading = true;
    this.supervisionService.getSupervisionRequests().subscribe({
      next: (requests) => {
        this.supervisionRequests = requests;
        this.isLoading = false;
      },
      error: (error) => {
        this.notificationService.showError('Failed to load supervision requests');
        this.isLoading = false;
      }
    });
  }
  
  // Enhance the loadTeacherGroups method to improve reliability
  loadTeacherGroups() {
    this.isLoading = true;
    this.supervisionService.getTeacherGroups().subscribe({
      next: (groups) => {
        console.log('Teacher groups loaded:', groups);
        this.teacherGroups = groups;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading groups:', error);
        this.notificationService.showError('Failed to load your groups');
        this.isLoading = false;
      }
    });
  }
  
  // Enhance the respondToRequest method to better handle the response
  respondToRequest(requestId: number, groupId: number, isApproved: boolean) {
    this.processingRequestIds.add(requestId);
    
    const response: SupervisionResponseDto = {
      groupId: groupId,
      isApproved: isApproved,
      message: isApproved ? 'Approved' : 'Rejected'
    };
    
    console.log('Sending response:', response); 
  
    this.supervisionService.respondToRequest(response).subscribe({
      next: (result) => {
        console.log('Response success:', result);
        const action = isApproved ? 'approved' : 'rejected';
        this.notificationService.showSuccess(`Successfully ${action} the supervision request`);
        
        // Remove the processed request from the list
        this.supervisionRequests = this.supervisionRequests.filter(r => r.id !== requestId);
        this.processingRequestIds.delete(requestId);

        // If approved, update the teacher's groups
        if (isApproved) {
          this.loadTeacherGroups();
          
          // Show a special notification about group cleanup
          this.notificationService.showInfo('All other groups for these students have been automatically cleaned up');
        }

        // Optional: Reload the requests to ensure UI is in sync
        this.loadSupervisionRequests();
      },
      error: (error) => {
        console.error('Response error:', error); 
        this.notificationService.showError(`Failed to ${isApproved ? 'approve' : 'reject'} the request`);
        this.processingRequestIds.delete(requestId);
      }
    });
  }
  
  openGroupChat(group: GroupDetails) {
    this.selectedGroupForChat = group;
    this.showGroupChat = true;
    this.currentView = 'chat';
  }
  
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
