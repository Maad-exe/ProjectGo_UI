import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../env/env';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiBaseUrl}/users`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  // Method for dashboard visualization - monthly signups
  getMonthlySignups(): Observable<{labels: string[], students: number[], teachers: number[]}> {
    // This would typically fetch from an API endpoint
    return of({
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      students: [30, 45, 55, 60, 75, 65],
      teachers: [5, 3, 6, 4, 8, 6]
    }).pipe(
      delay(500) // Simulate network delay
    );
  }
}