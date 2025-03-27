import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { GroupService } from '../services/group.service';
import { NotificationService } from '../services/notifications.service';
import { ChatService } from '../services/chat.service';
import { Subscription, forkJoin, Observable, of, timer } from 'rxjs';
import { StudentInfo } from './models/student.interface';
import { Announcement, ProjectProgress } from './models/dashboard.types';
import { map, take } from 'rxjs/operators';

// Import the smaller components
import { DashboardHeaderComponent } from './components/dashboard-header/dashboard-header.component';
import { DashboardSidebarComponent } from './components/dashboard-sidebar/dashboard-sidebar.component';
import { WelcomeSectionComponent } from './components/welcome-section/welcome-section.component';
import { CreateGroupComponent } from './components/group-management/create-group/create-group.component';
import { GroupListComponent } from './components/group-management/group-list/group-list.component';
import { ApprovedGroupComponent } from './components/group-management/approved-group/approved-group.component';
import { TeacherListComponent } from './components/teacher-list/teacher-list.component';
import { GroupChatComponent } from '../group-chat/group-chat.component';
import { FormsModule } from '@angular/forms';
import { ProgressComponent } from './components/progress/progress.component';

interface DashboardData {
  studentInfo: StudentInfo;
  groupStatus: { hasApprovedGroup: boolean };
  unreadMessages: number;
}

// At the top of the file with other interfaces
interface DashboardDataSources {
  [key: string]: Observable<any>;
  studentInfo: Observable<StudentInfo>;
  groupStatus: Observable<{hasApprovedGroup: boolean}>;
  unreadMessages: Observable<number>;
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule,
    DashboardHeaderComponent,
    DashboardSidebarComponent,
    WelcomeSectionComponent,
    CreateGroupComponent,
    GroupListComponent,
    TeacherListComponent,
    GroupChatComponent,
    ProgressComponent  // Add this line
  ],
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.scss'],
  // encapsulation: ViewEncapsulation.None // Add this line
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  currentView = 'dashboard';
  unreadMessages: number = 0;
  hasNewAnnouncements = true; // Dummy data
  showTeachersList: boolean = false; // Add this line
  studentInfo: StudentInfo = {
    fullName: '',
    enrollmentNumber: '',
    department: '',
    email: ''
  };
  
  showGroupChat: boolean = false;
  private subscriptions: Subscription[] = [];
  
  // Shared data for child components
  announcements: Announcement[] = [
    {
      title: 'Project Proposal Deadline',
      content: 'Submit your project proposals by March 15th, 2025',
      date: '2025-02-25'
    }
  ];

  projectProgress: ProjectProgress = {
    currentPhase: 'Proposal',
    completion: 25,
    nextMilestone: 'Initial Design Review'
  };

  // Add new properties
  selectedGroupId: number | null = null;
  hasApprovedGroup: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
    private chatService: ChatService,
    private groupService: GroupService
  ) {}

  private setupUnreadMessagesRefresh(): void {
    // Subscribe to unread messages updates
    const unreadSubscription = this.chatService.unreadMessages$.subscribe(
      count => {
        this.unreadMessages = count;
      }
    );
    this.subscriptions.push(unreadSubscription);

    // Set up periodic refresh
    const refreshSubscription = timer(0, 30000).subscribe(() => {
      if (this.hasApprovedGroup) {
        this.chatService.updateUnreadCount();
      }
    });
    this.subscriptions.push(refreshSubscription);
  }

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    // Load everything in parallel with proper typing
    const sources: DashboardDataSources = {
      studentInfo: this.loadStudentInfo(),
      groupStatus: this.loadInitialGroupStatus(),
      unreadMessages: this.getInitialUnreadCount()
    };

    forkJoin(sources).subscribe({
      next: (results) => {
        this.studentInfo = results.studentInfo;
        this.hasApprovedGroup = results.groupStatus.hasApprovedGroup;
        this.unreadMessages = results.unreadMessages;
        
        // Enable chat if user has approved group
        if (this.hasApprovedGroup) {
          // Use public method instead of private
          this.initializeChat();
        }
      },
      error: (error) => {
        console.error('Error loading initial data:', error);
        this.notificationService.showError('Failed to load dashboard data');
      }
    });

    this.setupUnreadMessagesRefresh();
  }

  // Add a new method to handle chat initialization
  private initializeChat(): void {
    // Call the public method from ChatService that will handle initialization
    this.chatService.ensureChatConnection();
  }

  private loadInitialGroupStatus(): Observable<{hasApprovedGroup: boolean}> {
    const userId = this.authService.getUserId();
    if (!userId) {
      return of({ hasApprovedGroup: false });
    }

    return this.groupService.getStudentGroups(userId).pipe(
      map(groups => {
        const approvedGroup = groups.find(g => 
          g.supervisionStatus === 'Approved' && g.teacherId != null
        );
        
        if (approvedGroup) {
          this.groupService.setApprovedGroup(approvedGroup);
        }
        
        return { hasApprovedGroup: !!approvedGroup };
      })
    );
  }

  private loadStudentInfo(): Observable<StudentInfo> {
    const token = localStorage.getItem('token');
    if (!token) {
      return of({
        fullName: '',
        email: '',
        department: '',
        enrollmentNumber: ''
      });
    }

    const payload = this.authService.decodeToken(token);
    const studentInfo: StudentInfo = {
      fullName: payload.name || 'Student Name',
      email: payload.email || payload.sub || '',
      department: payload.department || 'Not Available',
      enrollmentNumber: payload.enrollmentNumber || 'Not Available'
    };
    return of(studentInfo);
  }

  private getInitialUnreadCount(): Observable<number> {
    return new Observable<number>(observer => {
      this.chatService.unreadMessages$.pipe(take(1)).subscribe({
        next: (count) => {
          observer.next(count);
          // Update local state
          this.unreadMessages = count;
        },
        error: () => observer.next(0),
        complete: () => observer.complete()
      });

      // Trigger an initial update
      this.chatService.updateUnreadCount();
    });
  }

  setView(view: string): void {
    const previousView = this.currentView;
    this.currentView = view;
    
    // Update teacher list visibility logic
    if (view === 'teachers') {
      this.showTeachersList = true;
    } else {
      this.showTeachersList = false;
    }
    
    // Reset selectedGroupId when switching away from teachers view
    if (previousView === 'teachers' && view !== 'teachers') {
      this.selectedGroupId = null;
    }

    if (view === 'chat') {
      const approvedGroup = this.groupService.getApprovedGroup();
      if (!approvedGroup) {
        this.notificationService.showInfo('You need to have an approved group to access the chat feature.');
        this.currentView = previousView;
        return;
      }
      this.showGroupChat = true;
      
      // Mark messages as read when opening chat
      if (approvedGroup.id) {
        this.chatService.markMessagesAsRead(approvedGroup.id).subscribe({
          next: () => {
            console.log(`Marked messages as read for group ${approvedGroup.id}`);
            this.chatService.updateUnreadCount();
          },
          error: (err) => console.error('Error marking messages as read:', err)
        });
      }
    } else {
      this.showGroupChat = false;
    }
  }

  // Method for handling supervision requests from group list
  requestSupervision(groupId: number): void {
    this.selectedGroupId = groupId;
    this.showTeachersList = true;
    this.setView('teachers');
  }

  // Method to update approved group status
  updateHasApprovedGroup(hasApproved: boolean): void {
    this.hasApprovedGroup = hasApproved;
    // Update sidebar visibility for chat based on approval status
    if (!hasApproved && this.currentView === 'chat') {
      this.setView('dashboard');
    }
  }

  // Method to refresh groups after creation
  refreshGroups(): void {
    // Emit an event to tell GroupListComponent to refresh
    if (this.currentView === 'groups') {
      this.setView('groups'); // This will trigger a reload
    }
  }

  // Helper method to get approved group ID for chat
  getApprovedGroupId(): number {
    const group = this.groupService.getApprovedGroup();
    return group?.id || 0;
  }

  // Helper method to get approved group name for chat
  getApprovedGroupName(): string {
    const group = this.groupService.getApprovedGroup();
    return group?.name || '';
  }

  // Enhanced logout method
  logout(): void {
    // Clean up any subscriptions or state
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Clear any stored state
    this.groupService.setApprovedGroup(null);
    // Perform logout
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}