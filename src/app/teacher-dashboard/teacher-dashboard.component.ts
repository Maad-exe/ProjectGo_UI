import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notifications.service';
import { SupervisionService, SupervisionRequest, SupervisionResponseDto } from '../services/supervision.service';
import { GroupDetails } from '../services/group.service';
import { GroupChatComponent } from '../group-chat/group-chat.component';
import { ChatService } from '../services/chat.service';
import { Subscription } from 'rxjs';
import { PanelService } from '../services/panel.service';
import { EvaluationService } from '../services/evaluation.service';
import { EventService } from '../services/event.service';

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
export class TeacherDashboardComponent implements OnInit, OnDestroy {
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

  // Add new properties
  private subscriptions: Subscription[] = [];
  unreadMessagesByGroup: { [groupId: number]: number } = {};
  assignedPanels: any[] = [];
  panelEvaluations: any[] = [];
  pendingEvaluations: number = 0;
  upcomingEvaluations: any[] = [];
  completedEvaluations: any[] = [];
  
  constructor(
    private authService: AuthService,
    private router: Router,
    private supervisionService: SupervisionService,
    private notificationService: NotificationService,
    private chatService: ChatService,  // Add ChatService
    private panelService: PanelService,
    private evaluationService: EvaluationService,
    private eventService: EventService
  ) {}

  ngOnInit() {
    this.loadTeacherInfo();
    this.loadSupervisionRequests();
    this.loadTeacherGroups();
    this.loadTeacherPanels(); // Add this new method call
    
    // Set up chat subscriptions
    this.setupChatSubscriptions();
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

  private updateUnreadCounts(): void {
    this.chatService.getUnreadMessagesByGroup().subscribe({
      next: (counts) => {
        this.unreadMessagesByGroup = counts;
      },
      error: (err) => console.error('Error getting unread counts:', err)
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Update loadTeacherPanels method
  loadTeacherPanels() {
    this.isLoading = true;
  
    // Get the teacher ID if needed, but make the call without it since the API doesn't require it
    // The server will identify the teacher from the auth token
    const teacherId = this.authService.getUserId();
    
    this.panelService.getTeacherPanels().subscribe({
      next: (panels) => {
        this.assignedPanels = panels;
        console.log('Teacher panels loaded:', panels);
        
        // Load evaluations for each panel
        if (this.assignedPanels.length > 0) {
          this.loadPanelEvaluations();
        } else {
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading panels:', error);
        this.notificationService.showError('Failed to load your evaluation panels');
        this.isLoading = false;
      }
    });
  }

  // Change this in loadPanelEvaluations method
  loadPanelEvaluations() {
    this.isLoading = true;
  
    // Use the panel-assignments endpoint from your TeacherEvaluationController
    this.panelService.getTeacherPanelAssignments().subscribe({
      next: (evaluations) => {
        this.panelEvaluations = evaluations;
        console.log('Panel evaluations loaded:', this.panelEvaluations);
        
        // Sort evaluations by status and date
        this.upcomingEvaluations = this.panelEvaluations.filter(e => !e.isCompleted)
          .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
        
        this.completedEvaluations = this.panelEvaluations.filter(e => e.isCompleted);
        
        this.pendingEvaluations = this.upcomingEvaluations.length;
        
        // Load students for each upcoming evaluation
        this.upcomingEvaluations.forEach(evaluation => {
          this.loadStudentsForEvaluation(evaluation.id);
        });
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading evaluations:', error);
        this.notificationService.showError('Failed to load evaluations');
        this.isLoading = false;
      }
    });
  }

  conductEvaluation(evaluation: any, studentId: number) {
    console.log(`Finding evaluation for student ${studentId} in event ${evaluation.eventId}, group ${evaluation.groupId}`);
    
    this.evaluationService.getGroupEvaluationId(evaluation.eventId, evaluation.groupId).subscribe({
      next: (groupEvaluationId) => {
        console.log(`Found group evaluation ID: ${groupEvaluationId}`);
        this.router.navigate([
          '/teacher-dashboard/evaluate',
          evaluation.eventId,
          evaluation.groupId,
          studentId,
          groupEvaluationId
        ]);
      },
      error: (error) => {
        console.error('Error finding group evaluation ID:', error);
        this.notificationService.showError('Could not find evaluation for this group');
      }
    });
  }

  // Add the viewEvaluationDetails method
  viewEvaluationDetails(evaluation: any) {
    // You could navigate to a details page or open a modal
    this.router.navigate([
      '/teacher-dashboard/evaluation-details',
      evaluation.id
    ]);
  }

  // Add this method to your TeacherDashboardComponent class
  private setupChatSubscriptions() {
    // Subscribe to unread messages updates
    const unreadSubscription = this.chatService.getUnreadMessagesByGroup().subscribe(
      counts => {
        this.unreadMessagesByGroup = counts;
      }
    );
    this.subscriptions.push(unreadSubscription);
  }

  // Add these methods to your TeacherDashboardComponent class

  loadStudentsForEvaluation(evaluationId: number) {
    this.panelService.getStudentsForEvaluation(evaluationId).subscribe({
      next: (students) => {
        // Find the evaluation and update its students
        const evaluation = this.upcomingEvaluations.find(e => e.id === evaluationId);
        if (evaluation) {
          // Make sure to properly mark students as evaluated based on their evaluation status
          evaluation.students = students.map(student => ({
            ...student,
            // Set isCompleted properly based on the data from the API
            isEvaluated: student.isEvaluated // Make sure your API returns this field
          }));
          
          // Force change detection
          this.upcomingEvaluations = [...this.upcomingEvaluations];
        }
      },
      error: (error) => {
        console.error('Error loading students for evaluation:', error);
        this.notificationService.showError('Failed to load students for this evaluation');
        
        // Update the UI to show the error state for this evaluation
        const evaluation = this.upcomingEvaluations.find(e => e.id === evaluationId);
        if (evaluation) {
          evaluation.loadError = true;
          this.upcomingEvaluations = [...this.upcomingEvaluations];
        }
      }
    });
  }
}
