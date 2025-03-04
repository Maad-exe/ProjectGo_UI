import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { NotificationService } from '../services/notifications.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule 
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})


export class RegisterComponent {
  fullName: string = '';
  email: string = '';
  password: string = '';
  role: string = 'Student';
  qualification: string = '';
  areaOfSpecialization: string = '';
  officeLocation: string = '';
  enrollmentNumber: string = '';
  department: string = '';

  constructor(private router: Router, private http: HttpClient, private notificationService: NotificationService) { }
  onRoleChange(event: any) {
    this.role = event.target.value;
  }
 
  
  onSubmit() {

    let registerData: any = {
      fullName: this.fullName,
      email: this.email,
      password: this.password,
      role: this.role
    };
     
    if (!this.fullName || !this.email || !this.password) {
      this.notificationService.showError('Please fill in all required fields');
      return;
    }
    if (this.role === 'Teacher') {
      registerData = {
        ...registerData,
        
        qualification: this.qualification,
        areaOfSpecialization: this.areaOfSpecialization,
        officeLocation: this.officeLocation,
     
        
      };

      if (!this.qualification || !this.areaOfSpecialization || !this.officeLocation) {
        this.notificationService.showError('Please fill in all teacher-specific fields');
        return;
      }
      else {
        this.notificationService.showSuccess('Registration successful')
      }
    } else if (this.role === 'Student') {
      registerData = {
        ...registerData,
        enrollmentNumber: this.enrollmentNumber,
        department: this.department
      };
      if (!this.enrollmentNumber || !this.department) {
        this.notificationService.showError('Please fill in all student-specific fields');
        return;
      }
      else{
        this.notificationService.showSuccess('Registration successful')
      }
    }  const endpoint = this.role === 'Admin' ? 'register/admin'
     : this.role === 'Teacher' ? 'register/teacher' 
     : 'register/student';

    this.http.post(`http://localhost:5114/api/auth/${endpoint}`, registerData).subscribe(
      (response: any) => {
        console.log('User registered successfully');
        this.router.navigate(['/admin-dashboard']);
      },
      error => {
        console.error('Registration failed', error);
      }
    );
    this.notificationService.showSuccess('Registration successful');
  }
}
