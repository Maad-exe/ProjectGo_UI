import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RubricService } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { Rubric } from '../../../models/rubric.model';
import { CreateRubricDialogComponent } from '../create-rubric-dialog/create-rubric-dialog.component';

@Component({
  selector: 'app-rubric-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  templateUrl: './rubric-list.component.html',
  styleUrls: ['./rubric-list.component.scss']
})
export class RubricListComponent implements OnInit {
  rubrics: Rubric[] = [];
  loading = true;
  
  constructor(
    private rubricService: RubricService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}
  
  ngOnInit(): void {
    this.loadRubrics();
  }
  
  loadRubrics(): void {
    this.loading = true;
    this.rubricService.getAllRubrics().subscribe({
      next: (rubrics) => {
        this.rubrics = rubrics;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Failed to load rubrics');
        this.loading = false;
      }
    });
  }

  openCreateRubricDialog(): void {
    const dialogRef = this.dialog.open(CreateRubricDialogComponent, {
      maxWidth: 'calc(100% - 50px)', // Match with CSS (changed from 80px)
      width: '1400px', // Increased from 1200px
      height: '90vh', // Added height to match CSS
      panelClass: 'rubric-dialog-container'
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadRubrics();
      }
    });
  }
  
  editRubric(rubric: Rubric): void {
    const dialogRef = this.dialog.open(CreateRubricDialogComponent, {
      maxWidth: 'calc(100% - 50px)', // Match with CSS (changed from 80px)
      width: '1400px', // Increased from 1200px
      height: '90vh', // Added height to match CSS
      panelClass: 'rubric-dialog-container',
      data: { rubric }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadRubrics();
      }
    });
  }
  
  deleteRubric(rubric: Rubric): void {
    if (confirm(`Are you sure you want to delete the rubric "${rubric.name}"?`)) {
      this.rubricService.deleteRubric(rubric.id!).subscribe({
        next: () => {
          this.notificationService.showSuccess('Rubric deleted successfully');
          this.loadRubrics();
        },
        error: () => {
          this.notificationService.showError('Failed to delete rubric');
        }
      });
    }
  }

  // Add this utility method to handle both decimal and percentage displays
  formatWeight(weight: number): string {
    // If weight is already in decimal form (0-1), convert to percentage
    if (weight <= 1) {
      return (weight * 100).toFixed(0);
    }
    // Otherwise assume it's already a percentage
    return weight.toFixed(0);
  }
}