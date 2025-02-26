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
      this.errorMessage = '';
      
      const { email, password } = this.loginForm.value;
      
      this.authService.login(email, password).subscribe({
        next: async (response: any) => {
          console.log('Login successful:', response);
          if (response.token) {
            localStorage.setItem('token', response.token);
            const userRole = this.authService.getUserRole();
            console.log('Extracted user role:', userRole);
            
            if (!userRole) {
              this.errorMessage = 'Authorization error: No role found';
              return;
            }
            
            await this.navigateToDashboard(userRole);
          } else {
            this.errorMessage = 'Invalid response from server';
          }
          this.isLoading = false;
        },
        error: (err: any) => {
          console.error('Login error:', err);
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Login failed';
        }
      });
    }
  }
}
