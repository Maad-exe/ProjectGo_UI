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
  availableGroups: GroupDetails[] = [];
  loading = false;
  alreadyAssignedGroups: number[] = [];
  selectedPanel: any;
  
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AssignGroupDialogComponent>,
    private groupService: GroupService,
    private panelService: PanelService,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: { 
      panelId?: number, 
      eventId: number,
      assignedGroups: any[],
      panels?: any[]
    }
  ) {
    this.assignForm = this.fb.group({
      groupId: [null, Validators.required],
      scheduledDate: [new Date(), Validators.required],
      panelId: [this.data.panelId || null, Validators.required]
    });
  }
  
  ngOnInit(): void {
    // Get all already assigned group IDs for this event
    if (this.data.assignedGroups && this.data.assignedGroups.length > 0) {
      this.alreadyAssignedGroups = this.data.assignedGroups.map(g => g.groupId);
    }
    
    // If a panel is already selected, store it
    if (this.data.panelId && this.data.panels) {
      this.selectedPanel = this.data.panels.find(p => p.id === this.data.panelId);
    }
    
    // Format the current date for the datetime-local input
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    // Update the form with the formatted date
    this.assignForm.get('scheduledDate')?.setValue(formattedDate);
    
    this.loadGroups();
  }
  
  loadGroups(): void {
    this.loading = true;
    this.groupService.getGroupsWithSupervisors().subscribe({
      next: (data: GroupDetails[]) => {
        // Get all groups that have supervisors
        this.groups = data.filter((g: GroupDetails) => g.teacherId != null);
        
        // Filter out already assigned groups
        this.availableGroups = this.groups.filter(
          group => !this.alreadyAssignedGroups.includes(group.id)
        );
        
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
    
    // Convert the scheduledDate string to a proper Date object if it's not already one
    let scheduledDate: string;
    if (formValue.scheduledDate instanceof Date) {
      scheduledDate = formValue.scheduledDate.toISOString();
    } else if (typeof formValue.scheduledDate === 'string') {
      // If it's a string (from datetime-local input), ensure it's properly formatted
      // The input might return a string like "2023-06-20T14:30"
      scheduledDate = new Date(formValue.scheduledDate).toISOString();
    } else {
      // Default to current time if there's an issue
      scheduledDate = new Date().toISOString();
    }
    
    const assignment = {
      groupId: formValue.groupId,
      panelId: formValue.panelId || this.data.panelId,
      eventId: this.data.eventId,
      scheduledDate: scheduledDate
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