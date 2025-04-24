import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notifications.service';
import { SupervisionService, SupervisionRequest, SupervisionResponseDto } from '../services/supervision.service';
import { GroupService, GroupDetails } from '../services/group.service'; // Make sure to import GroupService
import { GroupChatComponent } from '../group-chat/group-chat.component';
import { ChatService } from '../services/chat.service';
import { Subscription } from 'rxjs';
import { PanelService } from '../services/panel.service';
import { EvaluationService, StudentDto } from '../services/evaluation.service';
import { EventService } from '../services/event.service';
import { filter } from 'rxjs/operators';

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
    private chatService: ChatService,
    private panelService: PanelService,
    private evaluationService: EvaluationService,
    private eventService: EventService,
    private groupService: GroupService
  ) {}

  ngOnInit() {
    this.loadTeacherInfo();
    this.loadSupervisionRequests();
    this.loadTeacherGroups();
    this.loadTeacherPanels();
    
    this.setupChatSubscriptions();

    this.subscriptions.push(
      this.evaluationService.onEvaluationUpdated.subscribe(update => {
        this.handleEvaluationUpdate(update);
      })
    );

    // Add subscription to router events to detect returns from evaluation page
    this.subscriptions.push(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        filter((event: NavigationEnd) => event.url === '/teacher-dashboard' || event.url.startsWith('/teacher-dashboard?'))
      ).subscribe(() => {
        // If returning to dashboard from evaluation, refresh student lists
        if (this.currentView === 'evaluations' && this.upcomingEvaluations.length > 0) {
          console.log('Refreshing student evaluations after navigation');
          this.refreshAllStudentEvaluations();
        }
      })
    );
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
        
        this.supervisionRequests = this.supervisionRequests.filter(r => r.id !== requestId);
        this.processingRequestIds.delete(requestId);

        if (isApproved) {
          this.loadTeacherGroups();
          this.groupService.refreshGroups();
          this.notificationService.showInfo('All other groups for these students have been automatically cleaned up');
        }

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

  loadTeacherPanels() {
    this.isLoading = true;
    const teacherId = this.authService.getUserId();
    
    this.panelService.getTeacherPanels().subscribe({
      next: (panels) => {
        this.assignedPanels = panels;
        console.log('Teacher panels loaded:', panels);
        
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

  loadPanelEvaluations() {
    this.isLoading = true;
  
    this.panelService.getTeacherPanelAssignments().subscribe({
      next: (evaluations) => {
        this.panelEvaluations = evaluations;
        console.log('Panel evaluations loaded:', this.panelEvaluations);
        
        this.upcomingEvaluations = this.panelEvaluations.filter(e => !e.isCompleted)
          .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
        
        this.completedEvaluations = this.panelEvaluations.filter(e => e.isCompleted);
        
        this.pendingEvaluations = this.upcomingEvaluations.length;
        
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
        // Store the last evaluation we navigated to so we can refresh it when returning
        localStorage.setItem('last_evaluation_id', groupEvaluationId.toString());
        
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

  viewEvaluationDetails(evaluation: any) {
    this.router.navigate([
      '/teacher-dashboard/evaluation-details',
      evaluation.id
    ]);
  }

  private setupChatSubscriptions() {
    const unreadSubscription = this.chatService.getUnreadMessagesByGroup().subscribe(
      counts => {
        this.unreadMessagesByGroup = counts;
      }
    );
    this.subscriptions.push(unreadSubscription);
  }

  loadStudentsForEvaluation(evaluationId: number, forceRefresh: boolean = true) {
    this.panelService.getStudentsForEvaluation(evaluationId, forceRefresh).subscribe({
      next: (students) => {
        const evaluation = this.upcomingEvaluations.find(e => e.id === evaluationId);
        if (evaluation) {
          evaluation.students = students;
          this.upcomingEvaluations = [...this.upcomingEvaluations]; // Force Angular change detection
          
          this.updatePendingEvaluationsCount();
        }
      },
      error: (error) => {
        console.error('Error loading students for evaluation:', error);
        this.notificationService.showError('Failed to load students for this evaluation');
        
        const evaluation = this.upcomingEvaluations.find(e => e.id === evaluationId);
        if (evaluation) {
          evaluation.loadError = true;
          this.upcomingEvaluations = [...this.upcomingEvaluations];
        }
      }
    });
  }

  private handleEvaluationUpdate(update: any): void {
    // Find and update the specific student
    const evaluation = this.upcomingEvaluations.find(e => e.id === update.groupEvaluationId);
    if (evaluation && evaluation.students) {
      const student = evaluation.students.find((s: StudentDto) => s.id === update.studentId);
      if (student) {
        student.isEvaluated = true;
        
        // Explicitly refresh the student list from server to ensure consistency
        this.loadStudentsForEvaluation(update.groupEvaluationId);
        
        // Update counters
        this.updatePendingEvaluationsCount();
      }
    }
  }

  private updatePendingEvaluationsCount(): void {
    let pendingCount = 0;
    
    this.upcomingEvaluations.forEach(evaluation => {
      if (evaluation.students && evaluation.students.length > 0) {
        const pendingStudents = evaluation.students.filter((s: StudentDto) => !s.isEvaluated);
        pendingCount += pendingStudents.length;
      }
    });
    
    this.pendingEvaluations = pendingCount;
  }

  refreshAllStudentEvaluations() {
    this.upcomingEvaluations.forEach(evaluation => {
      this.loadStudentsForEvaluation(evaluation.id);
    });
  }
}
