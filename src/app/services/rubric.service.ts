import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../env/env';

export interface RubricCategory {
  id: number;
  name: string;
  weight: number; // Percentage weight within rubric
  maxScore: number;
}

export interface Rubric {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  categories: RubricCategory[];
}

export interface CreateRubricDto {
  name: string;
  description: string;
  categories: {
    name: string;
    weight: number;
    maxScore: number;
  }[];
}

export interface UpdateRubricDto {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  categories: {
    id?: number;
    name: string;
    weight: number;
    maxScore: number;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class RubricService {
  private apiUrl = `${environment.apiBaseUrl}/admin/rubrics`;

  constructor(private http: HttpClient) { }

  getAllRubrics(): Observable<Rubric[]> {
    return this.http.get<Rubric[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  getRubricById(id: number): Observable<Rubric> {
    return this.http.get<Rubric>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  createRubric(rubric: CreateRubricDto): Observable<Rubric> {
    // Ensure weights are in decimal format (0-1 range)
    const formattedRubric = this.formatRubricWeights(rubric);
    
    return this.http.post<Rubric>(this.apiUrl, formattedRubric).pipe(
      tap(response => console.log('Created rubric response:', response)),
      catchError(this.handleError)
    );
  }

  updateRubric(rubric: UpdateRubricDto): Observable<Rubric> {
    // Ensure weights are in decimal format (0-1 range)
    const formattedRubric = this.formatRubricWeights(rubric);
    
    return this.http.put<Rubric>(`${this.apiUrl}/${rubric.id}`, formattedRubric).pipe(
      tap(response => console.log('Updated rubric response:', response)),
      catchError(this.handleError)
    );
  }

  deleteRubric(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }
  
  getNormalizedGrades(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/normalized-grades`).pipe(
      catchError(this.handleError)
    );
  }

  // Helper to format weights from percentage (0-100) to decimal (0-1)
  private formatRubricWeights(rubric: CreateRubricDto | UpdateRubricDto): any {
    // Create a deep copy to avoid modifying the original
    const formattedRubric = JSON.parse(JSON.stringify(rubric));
    
    formattedRubric.categories = formattedRubric.categories.map((category: { weight: number }) => ({
      ...category,
      // Convert from percentage to decimal if needed
      weight: category.weight > 1 ? category.weight / 100 : category.weight
    }));
    
    return formattedRubric;
  }

  // Centralized error handler
  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 400) {
        // Try to extract validation errors
        if (typeof error.error === 'string') {
          errorMessage = error.error;
        } else if (error.error?.message) {
          errorMessage = Array.isArray(error.error.message) 
            ? error.error.message.join(', ')
            : error.error.message;
        } else {
          errorMessage = 'Invalid data. Please check your inputs.';
        }
      } else if (error.status === 404) {
        errorMessage = 'Resource not found.';
      } else if (error.status === 409) {
        errorMessage = 'This rubric is in use by evaluation events and cannot be deleted.';
      } else {
        errorMessage = `Server error: ${error.status}. Please try again later.`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }

  // Validate if rubric weights sum to 1.0 (100%)
  validateRubricWeightSum(categories: any[]): boolean {
    if (!categories || categories.length === 0) return false;
    
    const sum = categories.reduce((total, cat) => {
      // Handle weights stored as decimals or percentages
      const weight = cat.weight > 1 ? cat.weight / 100 : cat.weight;
      return total + weight;
    }, 0);
    
    // Allow small rounding errors (0.01 or 1%)
    return Math.abs(sum - 1.0) <= 0.01;
  }
}