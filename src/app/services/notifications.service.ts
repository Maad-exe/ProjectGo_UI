import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private actionSubject = new Subject<string>();
  
  action$ = this.actionSubject.asObservable();

  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3000, 
      panelClass: ['mat-snack-bar-success'],
      //  horizontalPosition: 'left',
      //   verticalPosition: 'top'
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3000, 
      panelClass: ['mat-snack-bar-error']
    });
  }

  showWarning(message: string) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3000, 
      panelClass: ['mat-snack-bar-warning']
    });
  }

  showInfo(message: string) {
    this.snackBar.open(message, 'Dismiss', {
      duration: 3000, 
      panelClass: ['mat-snack-bar-info'],
      
    });
  }

  triggerAction(action: string) {
    this.actionSubject.next(action);
  }
}
