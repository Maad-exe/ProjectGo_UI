import { Component, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { GroupService, GroupDetails } from '../services/group.service'; // Make sure to import GroupDetails
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
  
  // Add the missing groups property
  groups: GroupDetails[] = [];
  
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

    // CRITICAL FIX: Immediately check for groups to enable chat button at startup
    this.loadGroupsAndEnableChat();

    // Then load everything else in parallel with proper typing
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
        
        // Load groups for the student
        this.loadGroups();
        
        // Enable chat if user has approved group
        if (this.hasApprovedGroup) {
          this.initializeChat();
          
          // If the current view is chat, show chat component
          if (this.currentView === 'chat') {
            this.showGroupChat = true;
          }
        }
      },
      error: (error) => {
        console.error('Error loading initial data:', error);
        this.notificationService.showError('Failed to load dashboard data');
      }
    });

    this.setupUnreadMessagesRefresh();
  }

  // Add this new method to explicitly load groups and set approved status
  private loadGroupsAndEnableChat(): void {
    const userId = this.authService.getUserId();
    if (!userId) return;

    console.log('Explicitly loading groups to enable chat...');
    
    // This is the critical call that will eventually set approvedGroup in the service
    this.groupService.getStudentGroups(userId).subscribe({
      next: (groups) => {
        console.log('Groups loaded for chat button initialization:', groups.length);
        
        // Find any approved group
        const approvedGroup = groups.find(g => 
          g.supervisionStatus === 'Approved' && g.teacherId !== null
        );
        
        if (approvedGroup) {
          console.log('Found approved group during initialization:', approvedGroup.name);
          
          // This local state is important for the template
          this.hasApprovedGroup = true;
          
          // Initialize chat since we have an approved group
          this.showGroupChat = this.currentView === 'chat';
          this.initializeChat();
        } else {
          console.log('No approved group found during initialization');
          this.hasApprovedGroup = false;
        }
        
        // Store all groups
        this.groups = groups;
      },
      error: (error) => {
        console.error('Error loading groups for chat initialization:', error);
      }
    });
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

  // Add a method to load groups
  private loadGroups(): void {
    const userId = this.authService.getUserId();
    if (userId) {
      this.groupService.getStudentGroups(userId).subscribe({
        next: (groupsData) => {
          this.groups = groupsData;
          console.log('Student Dashboard - Groups loaded:', groupsData.length);
        },
        error: (error) => {
          console.error('Failed to load groups:', error);
        }
      });
    }
  }

  setView(view: string): void {
    const previousView = this.currentView;
    this.currentView = view;
    
    console.log(`View changed from ${previousView} to ${view}, hasApprovedGroup:`, this.hasApprovedGroup);
    
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

    // Handle chat view
    if (view === 'chat') {
      if (this.hasApprovedGroup) {
        const groupId = this.getApprovedGroupId();
        if (groupId) {
          console.log('Opening chat for approved group ID:', groupId);
          this.showGroupChat = true;
          
          // Ensure chat connection is established
          this.chatService.ensureChatConnection();
        } else {
          console.error('No approved group ID found for chat');
          this.notificationService.showError('Cannot find your group for chat');
          this.currentView = previousView;
          this.showGroupChat = false;
        }
      } else {
        this.notificationService.showInfo('You need an approved group to access the chat');
        this.currentView = previousView;
        this.showGroupChat = false;
      }
    } else {
      this.showGroupChat = false;
    }

    // Check specifically for progress view
    if (view === 'progress') {
      console.log('Loading progress view...');
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
    // This will immediately trigger a reload in the GroupListComponent
    if (this.currentView === 'groups') {
      this.groupService.refreshGroups(); // Add a new method in GroupService
      
      // Also refresh the local groups array
      this.loadGroups();
      
      // Debug log
      console.log('Student Dashboard - Refreshing groups, current groups count:', this.groups?.length || 0);
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

  // Make sure you have this method to initialize chat
  private initializeChat(): void {
    console.log('Initializing chat...');
    
    // Initialize chat connection
    this.chatService.ensureChatConnection();
    
    // Get the approved group ID for chat
    const approvedGroup = this.groupService.getApprovedGroup();
    if (approvedGroup && approvedGroup.id) {
      console.log('Joining chat group:', approvedGroup.id);
      
      // Join the chat group
      this.chatService.joinGroup(approvedGroup.id).subscribe({
        next: (success) => {
          console.log('Joined chat group:', success);
        },
        error: (err) => {
          console.error('Failed to join chat group:', err);
        }
      });
    }
  }
}