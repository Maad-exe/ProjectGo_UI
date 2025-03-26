import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../env/env';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RubricService {
  private baseUrl = `${environment.apiBaseUrl}/admin/rubrics`;
  
  constructor(private http: HttpClient) {}
  
  getAllRubrics(): Observable<any[]> {
    return this.http.get<any[]>(this.baseUrl);
  }
  
  getRubricById(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }
  
  createRubric(rubric: any): Observable<any> {
    return this.http.post<any>(this.baseUrl, rubric);
  }
  
  updateRubric(id: number, rubric: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, rubric);
  }
  
  deleteRubric(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}