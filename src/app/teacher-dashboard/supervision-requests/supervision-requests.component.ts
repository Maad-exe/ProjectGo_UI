import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeacherService, TeacherSupervisionRequestDetails, SupervisionResponse } from '../../services/teacher.service';
import { NotificationService } from '../../services/notifications.service';

@Component({
  selector: 'app-supervision-requests',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule
  ],
  templateUrl: './supervision-requests.component.html',
  styleUrls: ['./supervision-requests.component.scss']
})
export class SupervisionRequestsComponent implements OnInit {
  requests: TeacherSupervisionRequestDetails[] = [];
  isLoading = false;
  error: string | null = null;
  respondingToRequestId: number | null = null;
  responseMessage = '';

  constructor(
    private teacherService: TeacherService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.error = null;
    
    this.teacherService.getSupervisionRequests().subscribe({
      next: (data) => {
        this.requests = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading supervision requests:', error);
        this.error = 'Failed to load supervision requests';
        this.isLoading = false;
      }
    });
  }

  respondToRequest(requestId: number, groupId: number, approve: boolean): void {
    this.respondingToRequestId = requestId;
    
    const response: SupervisionResponse = {
      groupId: groupId,
      isApproved: approve,
      message: this.responseMessage || (approve ? 'Request approved' : 'Request declined')
    };
    
    this.teacherService.respondToSupervisionRequest(response).subscribe({
      next: () => {
        this.notificationService.showSuccess(`Request ${approve ? 'approved' : 'declined'} successfully`);
        this.respondingToRequestId = null;
        this.responseMessage = '';
        // Refresh requests list
        this.loadRequests();
      },
      error: (error) => {
        console.error('Error responding to request:', error);
        this.notificationService.showError(`Failed to ${approve ? 'approve' : 'decline'} request`);
        this.respondingToRequestId = null;
      }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/teacher-dashboard']);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  }
}
