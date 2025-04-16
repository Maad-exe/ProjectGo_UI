import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeacherService } from '../../services/teacher.service';
import { SupervisionService, SupervisionRequest, SupervisionResponseDto } from '../../services/supervision.service';
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
  requests: SupervisionRequest[] = [];
  isLoading = false;
  error: string | null = null;
  respondingToRequestId: number | null = null;
  responseMessage = '';

  constructor(
    private teacherService: TeacherService,
    private supervisionService: SupervisionService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.error = null;
    
    this.supervisionService.getSupervisionRequests().subscribe({
      next: (data: SupervisionRequest[]) => {
        this.requests = data;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading supervision requests:', error);
        this.error = 'Failed to load supervision requests';
        this.isLoading = false;
      }
    });
  }

  respondToRequest(requestId: number, groupId: number, approve: boolean): void {
    this.respondingToRequestId = requestId;
    
    const response: SupervisionResponseDto = {
      groupId: groupId,
      isApproved: approve,
      message: this.responseMessage || (approve ? 'Request approved' : 'Request declined')
    };
    
    this.supervisionService.respondToRequest(response).subscribe({
      next: () => {
        this.notificationService.showSuccess(`Request ${approve ? 'approved' : 'declined'} successfully`);
        this.respondingToRequestId = null;
        this.responseMessage = '';
        // Refresh requests list
        this.loadRequests();
      },
      error: (error: any) => {
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
