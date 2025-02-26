import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../env/env';
import { catchError, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

interface LoginResponse {
  token: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.authApiUrl;

  constructor(
    private http: HttpClient,
    private router: Router  // Add Router to constructor
  ) { }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response: LoginResponse) => {
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
      })
    );
  }
  
  private async navigateBasedOnRole(role: string): Promise<boolean> {
    console.log('Navigating based on role:', role);
    const targetRoute = role.toLowerCase() === 'admin' ? '/admin-dashboard' 
                     : role.toLowerCase() === 'student' ? '/student-dashboard'
                     : role.toLowerCase() === 'teacher' ? '/teacher-dashboard'
                     : '/login';
    
    console.log('Target route:', targetRoute);
    try {
      const success = await this.router.navigate([targetRoute]);
      console.log('Navigation result:', success);
      return success;
    } catch (error: unknown) {
      console.error('Navigation error:', error);
      return false;
    }
  }

  isTokenValid(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
  
    try {
      const payload = this.decodeTokenPayload(token);
      const expiry = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      return now < expiry;
    } catch (error) {
      return false;
    }
  }
  
  getUserRole(): string {
    const token = localStorage.getItem('token');
    if (!token) return '';
    
    try {
      const payload = this.decodeToken(token);
      console.log('Token payload:', payload);
      return payload?.role || '';
    } catch (error) {
      console.error('Error getting user role:', error);
      return '';
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    void this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      const payload = this.decodeTokenPayload(token);
      const expiry = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  register(userData: any): Observable<any> {
    console.log('Registration data:', userData);
    
    // Determine the endpoint based on role
    const endpoint = userData.role === 'Admin' 
      ? '/register/admin'
      : userData.role === 'Teacher' 
        ? '/register/teacher' 
        : '/register/student';

    // Prepare request data based on role
    let requestData: any = {
      fullName: userData.fullName,
      email: userData.email,
      password: userData.password
    };

    // Add role-specific fields
    if (userData.role === 'Teacher') {
      requestData = {
        ...requestData,
        qualification: userData.qualification || '',
        areaOfSpecialization: userData.areaOfSpecialization || '',
        officeLocation: userData.officeLocation || ''
      };
    }else if (userData.role === 'Student') {
        requestData = {
          ...requestData,
          enrollmentNumber: userData.enrollmentNumber || '',
          department: userData.department || ''
        };
      }
  
      console.log('Sending registration request to:', `${this.apiUrl}${endpoint}`);
      console.log('Request data:', requestData);
    
      return this.http.post(`${this.apiUrl}${endpoint}`, requestData)
      .pipe(
        tap(response => console.log('Registration response:', response)),
        catchError(error => {
          console.error('Registration error:', error);
          throw error;
        })
      );
  }
  private transformRole(roleString: string): number {
    // Map string roles to numbers based on your API expectations
    switch (roleString) {
      case 'Admin': return 0;
      case 'Teacher': return 1;
      case 'Student': return 2;
      default: return 2; // Default to Student
    }
  }
  
  public decodeToken(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
  
  private decodeTokenPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
  
}