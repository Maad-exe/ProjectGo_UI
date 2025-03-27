import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PanelService } from '../../../services/panel.service';
import { NotificationService } from '../../../services/notifications.service';
import { Panel } from '../../../models/panel.model'
import { CreatePanelDialogComponent } from '../create-panel-dialog/create-panel-dialog.component';

@Component({
  selector: 'app-panel-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  templateUrl: './panel-list.component.html',
  styleUrls: ['./panel-list.component.scss']
})
export class PanelListComponent implements OnInit {
  panels: Panel[] = [];
  loading = true;
  
  constructor(
    private panelService: PanelService,
    private router: Router,
    private dialog: MatDialog,
    private notificationService: NotificationService
  ) {}
  
  ngOnInit(): void {
    this.loadPanels();
  }
  
  loadPanels(): void {
    this.loading = true;
    this.panelService.getAllPanels().subscribe({
      next: (panels) => {
        this.panels = panels;
        this.loading = false;
        console.log("Successfully loaded panels:", panels);
      },
      error: (error) => {
        console.error("Error loading panels:", error);
        this.notificationService.showError('Failed to load panels');
        this.loading = false;
        
        // Optionally, use mock data while developing
        this.panels = this.panelService.getMockPanels();
      }
    });
  }
  
  openCreatePanelDialog(): void {
    const dialogRef = this.dialog.open(CreatePanelDialogComponent, {
      width: '950px', // Back to a fixed width (not full screen)
      panelClass: 'panel-dialog-container',
      disableClose: true
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPanels();
      }
    });
  }
  
  viewPanelDetails(panel: Panel): void {
    this.router.navigate(['/admin-dashboard/panels', panel.id]);
  }
  
  editPanel(panel: Panel): void {
    const dialogRef = this.dialog.open(CreatePanelDialogComponent, {
      width: '950px', // Back to a fixed width (not full screen)
      panelClass: 'panel-dialog-container',
      disableClose: true,
      data: { panel }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPanels();
      }
    });
  }
  
  deletePanel(panel: Panel): void {
    if (confirm(`Are you sure you want to delete panel ${panel.name}?`)) {
      this.panelService.deletePanel(panel.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Panel deleted successfully');
          this.loadPanels();
        },
        error: (error) => {
          this.notificationService.showError('Failed to delete panel');
        }
      });
    }
  }
}
