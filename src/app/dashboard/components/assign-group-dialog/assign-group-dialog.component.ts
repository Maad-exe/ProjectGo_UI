import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { GroupService, GroupDetails } from '../../../services/group.service';
import { PanelService } from '../../../services/panel.service';
import { NotificationService } from '../../../services/notifications.service';
import { Component, OnInit, Inject } from '@angular/core';

@Component({
  selector: 'app-assign-group-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './assign-group-dialog.component.html',
  styleUrls: ['./assign-group-dialog.component.scss']
})
export class AssignGroupDialogComponent implements OnInit {
  assignForm: FormGroup;
  groups: GroupDetails[] = [];
  loading = false;
  
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AssignGroupDialogComponent>, // Changed to public
    private groupService: GroupService,
    private panelService: PanelService,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: { panelId: number, eventId: number }
  ) {
    this.assignForm = this.fb.group({
      groupId: [null, Validators.required],
      scheduledDate: [new Date(), Validators.required]
    });
  }
  
  ngOnInit(): void {
    this.loadGroups();
  }
  
  loadGroups(): void {
    this.loading = true;
    this.groupService.getGroupsWithSupervisors().subscribe({
      next: (data: GroupDetails[]) => {
        // Filter groups that already have supervisors
        this.groups = data.filter((g: GroupDetails) => g.teacherId != null);
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load groups');
        this.loading = false;
      }
    });
  }
  
  onSubmit(): void {
    if (this.assignForm.invalid) return;
    
    this.loading = true;
    const formValue = this.assignForm.value;
    
    const assignment = {
      groupId: formValue.groupId,
      panelId: this.data.panelId,
      eventId: this.data.eventId,
      scheduledDate: formValue.scheduledDate.toISOString()
    };
    
    this.panelService.assignPanelToGroup(assignment).subscribe({
      next: () => {
        this.notificationService.showSuccess('Group assigned successfully');
        this.dialogRef.close(true);
      },
      error: (error) => {
        const message = error?.error || 'Failed to assign group';
        this.notificationService.showError(message);
        this.loading = false;
      }
    });
  }
}