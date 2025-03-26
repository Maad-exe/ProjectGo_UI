import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TeacherService, TeacherDetails } from '../../../services/teacher.service';
import { PanelService } from '../../../services/panel.service';
import { NotificationService } from '../../../services/notifications.service';
import { Component, Inject, OnInit } from '@angular/core';

@Component({
  selector: 'app-create-panel-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './create-panel-dialog.component.html',
  styleUrls: ['./create-panel-dialog.component.scss']
})
export class CreatePanelDialogComponent implements OnInit {
  panelForm: FormGroup;
  teachers: TeacherDetails[] = [];
  loading = false;
  
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreatePanelDialogComponent>,
    private teacherService: TeacherService,
    private panelService: PanelService,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: { eventId?: number, panel?: any } = {}
  ) {
    this.panelForm = this.fb.group({
      name: ['', Validators.required],
      teacherIds: [[], [Validators.required, Validators.minLength(2)]]
    });
  }
  
  ngOnInit(): void {
    this.loadTeachers();
    
    // If editing, populate form
    if (this.data?.panel) {
      this.panelForm.patchValue({
        name: this.data.panel.name,
        teacherIds: this.data.panel.members.map((m: any) => m.teacherId)
      });
    }
  }
  
  loadTeachers(): void {
    this.loading = true;
    this.teacherService.getAllTeachers().subscribe({
      next: (data) => {
        this.teachers = data;
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load teachers');
        this.loading = false;
      }
    });
  }
  
  onSubmit(): void {
    if (this.panelForm.invalid) return;
    
    this.loading = true;
    const panelData = this.panelForm.value;
    
    if (this.data?.panel) {
      // Update panel
      this.panelService.updatePanel(this.data.panel.id, panelData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Panel updated successfully');
          this.dialogRef.close(true);
        },
        error: () => {
          this.notificationService.showError('Failed to update panel');
          this.loading = false;
        }
      });
    } else {
      // Create panel
      this.panelService.createPanel(panelData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Panel created successfully');
          this.dialogRef.close(true);
        },
        error: () => {
          this.notificationService.showError('Failed to create panel');
          this.loading = false;
        }
      });
    }
  }
  
  // Add a safe getter for data object
  get panelData(): any {
    return this.data || {};
  }
}