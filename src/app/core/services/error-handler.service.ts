// src/app/core/services/error-handler.service.ts
import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  handleError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Network error occurred. Please check your connection.';
    }
    return error.error?.message || 'An unexpected error occurred.';
  }
}

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  handleHttpError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    if (error.status === 401) {
      errorMessage = 'Unauthorized - Please login again';
    }
    console.error('API Error:', errorMessage, error);
    return throwError(() => errorMessage);
  }
}