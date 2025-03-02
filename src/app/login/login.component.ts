import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { RouterLink, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
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
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
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
              
              // Navigate based on role
              const role = decodedToken?.role?.toLowerCase();
              const targetRoute = role === 'admin' ? '/admin-dashboard' :
                                role === 'student' ? '/student-dashboard' :
                                role === 'teacher' ? '/teacher-dashboard' :
                                '/login';
              
              this.router.navigate([targetRoute]);
            }
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Login failed:', error);
            this.errorMessage = error.error?.message || 'Login failed';
            this.isLoading = false;
          }
        });
    }
  }
}
