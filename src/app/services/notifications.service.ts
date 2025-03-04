import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}

  showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 2000, // Set duration explicitly
      panelClass: ['mat-snack-bar-success']
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 2000, // Set duration explicitly
      panelClass: ['mat-snack-bar-error']
    });
  }

  showWarning(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 2000, // Set duration explicitly
      panelClass: ['mat-snack-bar-warning']
    });
  }

  showInfo(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 2000, // Set duration explicitly
      panelClass: ['mat-snack-bar-info']
    });
  }
}
