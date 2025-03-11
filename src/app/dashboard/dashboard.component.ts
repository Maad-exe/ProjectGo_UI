import { Component, OnInit, ViewEncapsulation, OnDestroy } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationService } from '../services/notifications.service';
import { Subscription } from 'rxjs';
import { UserManagementComponent } from './user-management/user-management.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ReactiveFormsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  encapsulation: ViewEncapsulation.None

})
export class DashboardComponent implements OnInit, OnDestroy {
  //private fb = inject(FormBuilder);
  isSidebarCollapsed = false;
  isAddUserModalOpen = false;
  showPassword: boolean = false; 
  addUserForm: FormGroup;
  isLoading = false;
  currentTime = new Date();
  private subscription: Subscription = new Subscription();

  get isMainDashboard(): boolean {
    return this.router.url === '/admin-dashboard';
  }

  userData = {
    name: 'Hammad Abbas',
    role: 'Admin',
    department: 'Computer Science'
  };
  
  statistics = {
    totalStudents: 450,
    totalTeachers: 32,
    activeProjects: 85,
  };

  // recentActivities = [
  //   { action: 'New Project Assigned', user: 'Dr. Sarah Smith', project: 'AI Healthcare System', time: '5 min ago' },
  //   { action: 'Evaluation Scheduled', user: 'Prof. Mike Johnson', project: 'Smart IoT Platform', time: '15 min ago' },
  //   { action: 'Deadline Updated', user: 'System', project: 'Mid-Term Evaluation', time: '1 hour ago' }
  // ];

  // upcomingEvaluations = [
  //   { title: 'Project Proposal Defense', date: '2025-03-01', venue: 'Lab 1', panels: ['Dr. Smith', 'Dr. Johnson'] },
  //   { title: 'Mid-Term Evaluation', date: '2025-04-15', venue: 'Conference Room', panels: ['Dr. Wilson', 'Dr. Brown'] }
  // ];

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.addUserForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      role: ['Student', Validators.required],
        // Optional fields initially
    qualification: [null],
    areaOfSpecialization: [null],
    officeLocation: [null],
    enrollmentNumber: [null],
    department: [null]

    });
      // Update validations when role changes
  this.addUserForm.get('role')?.valueChanges.subscribe(role => {
    const qualificationControl = this.addUserForm.get('qualification');
    const areaControl = this.addUserForm.get('areaOfSpecialization');
    const officeControl = this.addUserForm.get('officeLocation');
    const enrollmentControl = this.addUserForm.get('enrollmentNumber');
    const departmentControl = this.addUserForm.get('department');

    // Reset all field validations
    [qualificationControl, areaControl, officeControl, enrollmentControl, departmentControl]
      .forEach(control => {
        control?.clearValidators();
        control?.updateValueAndValidity();
      });
      // Set new validations based on role
    if (role === 'Teacher') {
      [qualificationControl, areaControl, officeControl].forEach(control => {
        control?.setValidators([Validators.required]);
        control?.updateValueAndValidity();
      });
    } else if (role === 'Student') {
      [enrollmentControl, departmentControl].forEach(control => {
        control?.setValidators([Validators.required]);
        control?.updateValueAndValidity();
      });
    }
    
   
  });
    }


  ngOnInit() {
    this.updateTime();
     // Subscribe to notification service actions with proper subscription management
    this.subscription.add(
      this.notificationService.action$.subscribe(action => {
        if (action === 'openAddUserModal') {
          this.showAddUserModal();
        }
      })
    );
  }

  ngOnDestroy() {
    // Clean up subscriptions when component is destroyed
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  updateTime() {
    setInterval(() => {
      this.currentTime = new Date();
    }, 1000);
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  showAddUserModal() {
    this.isAddUserModalOpen = true;
  }

  closeAddUserModal() {
    this.isAddUserModalOpen = false;
    this.addUserForm.reset({ role: 'Student' });
  }

  onAddUser() {
    if (this.addUserForm.valid) {
      this.isLoading = true;
      const userData = this.addUserForm.value;
      
      console.log('Form data before submission:', userData);

      this.authService.register(userData).subscribe({
        next: (response) => {
          console.log('Registration successful:', response);
          this.isLoading = false;
          this.closeAddUserModal();
          this.notificationService.showSuccess(`User registered successfully`);
        },
        error: (error) => {
          console.error('Registration error:', error);
          this.isLoading = false;
          this.notificationService.showError('Failed to register user');
        }
      });
    } else {
      console.error('Form validation errors:', this.addUserForm.errors);
      this.notificationService.showWarning('Failed to register user');
    }
  }
      
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

}