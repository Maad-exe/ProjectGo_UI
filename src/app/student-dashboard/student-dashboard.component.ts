import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TeacherService, TeacherDetails } from '../services/teacher.service';
import { AuthService } from '../services/auth.service';
import { GroupService, StudentDetails, GroupDetails, CreateGroupRequest } from '../services/group.service';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl, NonNullableFormBuilder } from '@angular/forms';
import { NotificationService } from '../services/notifications.service';
interface StudentInfo {
  fullName: string;
  enrollmentNumber: string;
  department: string;
  email: string;
 
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
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

  constructor(
    private teacherService: TeacherService,
    private authService: AuthService,
    private groupService: GroupService,
    private fb: NonNullableFormBuilder, 
    private router: Router,
    private notificationService: NotificationService
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

  loadStudentGroups() {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.authService.decodeToken(token);
      const studentId = payload.UserId;

      this.groupService.getStudentGroups(studentId).subscribe({
        next: (groups) => {
          this.groups = groups;
        },
        error: (error) => {
          console.error('Failed to load student groups:', error);
        }
      });
    }
  }
}