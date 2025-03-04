import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../services/notifications.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule, MatSnackBarModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  private notificationService: NotificationService
) {
  this.loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });
}

  showPassword = false;

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  private async navigateToDashboard(role: string) {
    console.log('Attempting navigation with role:', role);
    let targetRoute = '';
    
    switch(role.toLowerCase()) {
      case 'admin':
        targetRoute = '/admin-dashboard';
        break;
      case 'student':
        targetRoute = '/student-dashboard';
        break;
      case 'teacher':
        targetRoute = '/teacher-dashboard';
        break;
      default:
        targetRoute = '/login';
    }
    
    console.log('Navigating to:', targetRoute);
    try {
      const result = await this.router.navigate([targetRoute]);
      console.log('Navigation result:', result);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  onSubmit() {
    
    if (this.loginForm.invalid) {
      this.notificationService.showError('Please fill in all required fields correctly');
      return;
    } 
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.authService.login(this.loginForm.value.email, this.loginForm.value.password)
        .subscribe({
          next: (response) => {
            if (response.token) {
              localStorage.setItem('token', response.token);
              console.log('Login - Token stored:', response.token); // Add this line
              const decodedToken = this.authService.decodeToken(response.token);
              console.log('Login successful - Role:', decodedToken?.role);
             // this.notificationService.showSuccess('Login successful');
              // Navigate based on role
              const role = decodedToken?.role?.toLowerCase();
              const targetRoute = role === 'admin' ? '/admin-dashboard' :
                                role === 'student' ? '/student-dashboard' :
                                role === 'teacher' ? '/teacher-dashboard' :
                                '/login';
              
              this.router.navigate([targetRoute]);
            //  this.notificationService.showInfo(`Navigating to ${targetRoute}`);
            }
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Login failed:', error);
            this.notificationService.showError('An error occurred during login');
            this.errorMessage = error.error?.message || 'Login failed';
            this.isLoading = false;
          }
        });
    }
  }
}
