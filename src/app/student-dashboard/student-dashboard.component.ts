import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TeacherService, TeacherDetails } from '../services/teacher.service';
import { AuthService } from '../services/auth.service';
import { GroupService, StudentDetails, GroupDetails, CreateGroupRequest } from '../services/group.service';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl, NonNullableFormBuilder } from '@angular/forms';
import { NotificationService } from '../services/notifications.service';
import { SupervisionService, SupervisionRequestDto } from '../services/supervision.service';
import { FormsModule } from '@angular/forms'; // Add this import
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
interface StudentInfo {
  fullName: string;
  enrollmentNumber: string;
  department: string;
  email: string;
 
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.scss']
})
export class StudentDashboardComponent implements OnInit {
  teachers: TeacherDetails[] = [];
  isLoading = false;
  error: string | null = null;
  currentView = 'dashboard';
  unreadMessages = 3; // Dummy data
  hasNewAnnouncements = true; // Dummy data
  studentInfo: StudentInfo = {
    fullName: '',
    enrollmentNumber: '',
    department: '',
    email: '',
 
  };

  // Dummy data for different views
  announcements = [
    {
      title: 'Project Proposal Deadline',
      content: 'Submit your project proposals by March 15th, 2024',
      date: '2024-02-25'
    }
  ];

  projectProgress = {
    currentPhase: 'Proposal',
    completion: 25,
    nextMilestone: 'Initial Design Review'
  };

  // New properties for group management
  createGroupForm: FormGroup;
  showGroupForm = false;
  groups: GroupDetails[] = [];
  memberCount = 2;
  isSearchingStudent = false;
  studentSearchResults: { [email: string]: StudentDetails | null } = {};
  isCreatingGroup = false;
  groupCreationError: string | null = null;
  searchErrors: { [email: string]: string } = {};

  showTeachersList = false;
  selectedGroupId: number | null = null;
  supervisionMessage: string = '';
  isRequestingSupervision = false;
  hasApprovedGroup: boolean = false;
  approvedGroup: GroupDetails | null = null;
  groupSupervisor: TeacherDetails | null = null;

  constructor(
    private teacherService: TeacherService,
    private authService: AuthService,
    private groupService: GroupService,
    private fb: NonNullableFormBuilder, 
    private router: Router,
    private notificationService: NotificationService,
    private supervisionService: SupervisionService
  ) {
    this.createGroupForm = this.fb.group({
      groupName: ['', Validators.required],
      memberCount: [2, [Validators.required, Validators.min(2), Validators.max(4)]],
      memberEmails: this.fb.array<string>([])
    });
  }

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      
      console.log('Full token payload:', this.authService.decodeToken(token));
    }
   
    this.loadStudentInfo();
    this.notificationService.showSuccess(`Welcome ${this.studentInfo.fullName}`);
    this.setView('dashboard');
  }

  get memberEmails(): FormArray<FormControl<string>> {
    return this.createGroupForm.get('memberEmails') as FormArray<FormControl<string>>;
  }

  loadStudentInfo() {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.authService.decodeToken(token);
      console.log('Student token payload:', payload); // For debugging
      
      this.studentInfo = {
        fullName: payload.name || 'Student Name',
        email: payload.email || payload.sub || '', // Try email first, fallback to sub
        department: payload.department || 'Not Available',
        enrollmentNumber: payload.enrollmentNumber || 'Not Available',
        
      };
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  setView(view: string) {
    console.log('Setting view to:', view);
    this.currentView = view;
    if (view === 'teachers') {
      this.loadTeachers();
    } else if (view === 'groups') {
      this.loadStudentGroups();
    }
  }

  loadTeachers() {
    if (!this.teachers.length) {
      this.isLoading = true;
      this.error = null;
      
      const currentRole = this.authService.getUserRole();
      console.log('Loading teachers - Current user role:', currentRole);
  
      // Check if user has the required role before making the request
      if (currentRole.toLowerCase() !== 'student') {
        this.error = 'Access denied: Only students can view teacher list';
        this.isLoading = false;
        return;
      }
  
      this.teacherService.getAllTeachers().subscribe({
        next: (data) => {
          console.log('Teachers loaded:', data);
          console.log('First teacher object properties:', Object.keys(data[0])); // Check actual property names
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
  }

  // Group Management Functions
  showCreateGroupForm() {
    // Check if the student already has an approved group
    if (this.hasApprovedGroup) {
      this.notificationService.showInfo('You already have a group with approved supervision. You cannot create more groups.');
      return;
    }
    
    this.showGroupForm = true;
    this.createGroupForm.reset();
    this.memberEmails.clear();
    for (let i = 0; i < this.memberCount; i++) {
      this.memberEmails.push(this.fb.control('', [Validators.required, Validators.email]));
    }
  }

  onMemberCountChange() {
    this.memberCount = this.createGroupForm.get('memberCount')?.value || 2;
    this.memberEmails.clear();
    for (let i = 0; i < this.memberCount; i++) {
      this.memberEmails.push(this.fb.control('', [Validators.required, Validators.email]));
    }
  }

  async searchStudent(email: string, index: number) {
    this.isSearchingStudent = true;
    this.searchErrors[email] = '';
    try {
      const student = await this.groupService.searchStudentByEmail(email).toPromise();
      this.studentSearchResults[email] = student || null; // Handle undefined case
    } catch (error: any) {
      this.studentSearchResults[email] = null;
      this.searchErrors[email] = error.error?.message || 'Student not found';
    } finally {
      this.isSearchingStudent = false;
    }
  }

  async createGroup() {
    if (this.createGroupForm.valid) {
      this.isCreatingGroup = true;
      this.groupCreationError = null;

      const memberEmails = this.memberEmails.value.filter((email): email is string => email !== null);
      const createGroupRequest: CreateGroupRequest = {
        groupName: this.createGroupForm.value.groupName || '',
        memberEmails: memberEmails
      };

      try {
        const createdGroup = await this.groupService.createGroup(createGroupRequest).toPromise();
        console.log('Group created successfully:', createdGroup);
        if (createdGroup) { // Add this check
          this.groups.push(createdGroup);
        }
        this.showGroupForm = false;
        this.createGroupForm.reset();
        this.memberEmails.clear();
        this.loadStudentGroups();
      } catch (error: any) {
        console.error('Group creation failed:', error);
        this.groupCreationError = error.error?.message || 'Failed to create group';
      } finally {
        this.isCreatingGroup = false;
      }
    }
  }

 // Update the loadStudentGroups method to handle everything without the separate checkGroupSupervisionStatus call
// src/app/student-dashboard/student-dashboard.component.ts
loadStudentGroups() {
  const token = localStorage.getItem('token');
  if (token) {
    const payload = this.authService.decodeToken(token);
    const studentId = payload.UserId;

    this.groupService.getStudentGroups(studentId).subscribe({
      next: (groups) => {
        console.log('Student groups loaded:', groups);
        
        // Ensure we have all teacher names for groups with teacherIds
        const teacherIdsToFetch = new Set<number>();
        groups.forEach(group => {
          if (group.teacherId && !group.teacherName) {
            teacherIdsToFetch.add(group.teacherId);
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

// Add this helper method to fetch missing teacher names
fetchMissingTeacherNames(teacherIds: number[], groups: GroupDetails[]) {
  // Create an array of observables for each teacher ID
  const teacherObservables = teacherIds.map(id => 
    this.teacherService.getTeacherById(id).pipe(
      catchError(error => {
        console.error(`Error fetching teacher with ID ${id}:`, error);
        // Return null teacher on error
        return of(null);
      })
    )
  );
  
  // Use forkJoin to wait for all requests to complete
  forkJoin(teacherObservables).subscribe(teachers => {
    // Create a map of teacher IDs to names
    const teacherMap = new Map<number, string>();
    teachers.forEach(teacher => {
      if (teacher) {
        teacherMap.set(teacher.id, teacher.fullName);
      }
    });
    
    // Update group teacher names
    groups.forEach(group => {
      if (group.teacherId && !group.teacherName && teacherMap.has(group.teacherId)) {
        group.teacherName = teacherMap.get(group.teacherId)!;
      }
    });
    
    // Process groups with updated teacher names
    this.processLoadedGroups(groups);
  });
}

// Add this helper method to process groups after loading
processLoadedGroups(groups: GroupDetails[]) {
  this.groups = groups;
  
  // Look for any group that has approved supervision status
  const approvedGroup = groups.find(group => 
    group.supervisionStatus === 'Approved' || 
    (group.teacherId !== null && group.teacherId !== undefined && group.teacherId > 0)
  );
  
  console.log('Approved group found:', approvedGroup);
  
  this.hasApprovedGroup = !!approvedGroup;
  this.approvedGroup = approvedGroup || null;
  
  // If there's an approved group, load the supervisor details
  if (this.approvedGroup && this.approvedGroup.teacherId) {
    console.log(`Loading supervisor details for teacher ID: ${this.approvedGroup.teacherId}`);
    this.loadSupervisorDetails(this.approvedGroup.teacherId);
  }
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
    
    this.selectedGroupId = groupId;
    this.showTeachersList = true;
    this.setView('teachers'); // Switch to teachers view to select a supervisor
  }

  requestSupervision(teacherId: number) {
    console.log('Teacher ID received:', teacherId);
    console.log('Teacher ID type:', typeof teacherId);
    
    if (!this.selectedGroupId) {
      this.notificationService.showError('No group selected');
      return;
    }

    this.isRequestingSupervision = true;
    
    // Use lowercase property names to match what Swagger shows
    const request: SupervisionRequestDto = {
      groupId: this.selectedGroupId,
      teacherId: teacherId,
      message: this.supervisionMessage || 'Request for supervision'
    };
    console.log('Full request object:', request);
    console.log('Request stringified:', JSON.stringify(request));
  
    console.log('Sending supervision request:', request);

    this.supervisionService.requestSupervision(request).subscribe({
      next: (response) => {
        this.notificationService.showSuccess('Supervision request sent successfully');
        this.isRequestingSupervision = false;
        this.showTeachersList = false;
        this.loadStudentGroups(); // Refresh groups to show updated status
      },
      error: (error) => {
        console.error('Supervision request error:', error);
        this.notificationService.showError('Failed to send supervision request: ' + 
          (error.error?.message || error.message || 'Unknown error'));
        this.isRequestingSupervision = false;
      }
    });
  }

  // Add a method to check if user is the group creator
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

  // Add a new method to load supervisor details
  loadSupervisorDetails(teacherId: number) {
    console.log('Loading supervisor details for ID:', teacherId);
    this.teacherService.getTeacherById(teacherId).subscribe({
      next: (teacher) => {
        console.log('Supervisor details loaded:', teacher);
        this.groupSupervisor = teacher;
      },
      error: (error) => {
        console.error('Failed to load supervisor details:', error);
        this.notificationService.showError('Failed to load supervisor details');
      }
    });
  }

  // Add this method to the StudentDashboardComponent class
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
}