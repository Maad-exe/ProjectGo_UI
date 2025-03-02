import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TeacherService, TeacherDetails } from '../services/teacher.service';
import { AuthService } from '../services/auth.service';

interface StudentInfo {
  fullName: string;
  enrollmentNumber: string;
  department: string;
  email: string;
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
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
    email: ''
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

  constructor(
    private teacherService: TeacherService,
    private authService: AuthService,
    private router: Router
  ) {}

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
    this.setView('dashboard');
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
        enrollmentNumber: payload.enrollmentNumber || 'Not Available'
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
    }
  }

  loadTeachers() {
    if (!this.teachers.length) {
      this.isLoading = true;
      this.error = null;
      
      const currentRole = this.authService.getUserRole();
      console.log('Loading teachers - Current user role:', currentRole);

      this.teacherService.getAllTeachers().subscribe({
        next: (data) => {
          console.log('Teachers loaded:', data);
          this.teachers = data;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading teachers:', error);
          console.log('Error occurred with role:', currentRole);
          this.error = 'Failed to load teachers';
          this.isLoading = false;
        }
      });
    }
  }
}