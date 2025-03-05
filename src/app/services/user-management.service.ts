import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';

export interface UserDetails {
  id: number;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  additionalInfo?: any;
}

export interface UserUpdateRequest {
  id: number;
  fullName: string;
  email: string;
  additionalInfo?: { [key: string]: any };
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private apiUrl = `${environment.apiBaseUrl}/users`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<UserDetails[]> {
    return this.http.get<UserDetails[]>(this.apiUrl);
  }

  getUserById(userId: number): Observable<UserDetails> {
    return this.http.get<UserDetails>(`${this.apiUrl}/${userId}`);
  }

  updateUser(user: UserUpdateRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${user.id}`, user);
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}`);
  }
}