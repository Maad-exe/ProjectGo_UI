import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../env/env';
import { catchError, tap } from 'rxjs/operators';
import { Observable, BehaviorSubject } from 'rxjs';
import { NotificationService } from './notifications.service';
import { MatSnackBarModule } from '@angular/material/snack-bar';
interface LoginResponse {
  token: string;
  message?: string;
}

interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  role: string;  // Add this line
  qualification?: string;
  areaOfSpecialization?: string;
  officeLocation?: string;
  enrollmentNumber?: string;
  department?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.authApiUrl;
  private authStatusSubject = new BehaviorSubject<boolean>(this.isLoggedIn());
  authStatusChange = this.authStatusSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationService: NotificationService
  ) { }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap((response: LoginResponse) => {
          if (response.token) {
            localStorage.setItem('token', response.token);
            const decodedToken = this.decodeToken(response.token);
            console.log('Token stored, role:', decodedToken?.role);
            // Navigate after successful token storage
            const role = decodedToken?.role?.toLowerCase();
            const targetRoute = role === 'admin' ? '/admin-dashboard' :
                              role === 'student' ? '/student-dashboard' :
                              role === 'teacher' ? '/teacher-dashboard' :
                              '/login';
            this.router.navigate([targetRoute]);
            this.notificationService.showSuccess (`Welcome ${decodedToken?.name}`);
            this.authStatusSubject.next(true);  // <-- Add this line
          }
        })
      );
  }
  
  

  isTokenValid(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
  
    try {
      const payload = this.decodeToken(token);
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
    this.notificationService.showInfo('User logged out');
    localStorage.removeItem('token');
    this.authStatusSubject.next(false);  // <-- Add this line
    void this.router.navigate(['/login']);
    
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
      const payload = this.decodeToken(token);
      const expiry = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < expiry;
    } catch {
      return false;
    }
  }

  register(userData: RegisterRequest): Observable<any> {
    const endpoint = `/register/${userData.role?.toLowerCase()}`;
    return this.http.post(`${this.apiUrl}${endpoint}`, userData)
      .pipe(
        catchError(error => {
          console.error('Registration error:', error);
          throw error;
        })
      );
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
  
  hasRole(role: string): boolean {
    const userRole = this.getUserRole();
    return userRole.toLowerCase() === role.toLowerCase();
  }
  
  isStudent(): boolean {
    return this.hasRole('student');
  }
  
  isTeacher(): boolean {
    return this.hasRole('teacher');
  }
  
  isAdmin(): boolean {
    return this.hasRole('admin');
  }
  
  getUserId(): number | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const payload = this.decodeToken(token);
    // Return UserId as number if available, null otherwise
    return payload?.UserId ? Number(payload.UserId) : null;
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
  
}