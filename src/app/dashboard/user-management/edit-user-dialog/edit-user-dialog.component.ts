// src/app/admin-dashboard/user-management/edit-user-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
// Fix the import path
import { UserManagementService, UserDetails } from '../../../services/user-management.service';

@Component({
  selector: 'app-edit-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Edit User</h2>
    <form [formGroup]="editForm" (ngSubmit)="onSubmit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline">
          <mat-label>Full Name</mat-label>
          <input matInput formControlName="fullName" placeholder="Enter full name">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" placeholder="Enter email">
        </mat-form-field>

        <!-- Add additional fields based on user role -->
        <ng-container [ngSwitch]="data.role.toLowerCase()">
          <ng-container *ngSwitchCase="'student'">
            <mat-form-field appearance="outline">
              <mat-label>Department</mat-label>
              <input matInput formControlName="department" placeholder="Enter department">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Enrollment Number</mat-label>
              <input matInput formControlName="enrollmentNumber" placeholder="Enter enrollment number">
            </mat-form-field>
          </ng-container>

          <ng-container *ngSwitchCase="'teacher'">
            <mat-form-field appearance="outline">
              <mat-label>Qualification</mat-label>
              <input matInput formControlName="qualification" placeholder="Enter qualification">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Area of Specialization</mat-label>
              <input matInput formControlName="areaOfSpecialization" placeholder="Enter specialization">
            </mat-form-field>
          </ng-container>
        </ng-container>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" type="submit" [disabled]="editForm.invalid">
          Save Changes
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    mat-form-field {
      width: 100%;
      margin-bottom: 1rem;
    }

    mat-dialog-content {
      min-width: 400px;
    }
  `]
})
export class EditUserDialogComponent {
  editForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<EditUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserDetails
  ) {
    this.editForm = this.fb.group({
      id: [data.id],
      fullName: [data.fullName, Validators.required],
      email: [data.email, [Validators.required, Validators.email]],
      // Add form controls for additional info based on role
      ...(data.role.toLowerCase() === 'student' ? {
        department: [data.additionalInfo?.department],
        enrollmentNumber: [data.additionalInfo?.enrollmentNumber]
      } : {}),
      ...(data.role.toLowerCase() === 'teacher' ? {
        qualification: [data.additionalInfo?.qualification],
        areaOfSpecialization: [data.additionalInfo?.areaOfSpecialization]
      } : {})
    });
  }

  onSubmit() {
    if (this.editForm.valid) {
      const formValue = this.editForm.value;
      const updateRequest = {
        id: formValue.id,
        fullName: formValue.fullName,
        email: formValue.email,
        additionalInfo: {}
      };

      // Add role-specific fields to additionalInfo
      if (this.data.role.toLowerCase() === 'student') {
        updateRequest.additionalInfo = {
          department: formValue.department,
          enrollmentNumber: formValue.enrollmentNumber
        };
      } else if (this.data.role.toLowerCase() === 'teacher') {
        updateRequest.additionalInfo = {
          qualification: formValue.qualification,
          areaOfSpecialization: formValue.areaOfSpecialization
        };
      }

      this.dialogRef.close(updateRequest);
    }
  }
}