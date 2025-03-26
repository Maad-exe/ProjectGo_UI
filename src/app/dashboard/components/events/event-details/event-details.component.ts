import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EventService } from '../../../../services/event.service';
import { PanelService } from '../../../../services/panel.service';
import { NotificationService } from '../../../../services/notifications.service';
import { EvaluationEvent } from '../../../event.model';
import { Panel } from '../../../../models/panel.model';
import { CreatePanelDialogComponent } from '../../create-panel-dialog/create-panel-dialog.component';
import { AssignGroupDialogComponent } from '../../assign-group-dialog/assign-group-dialog.component';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule
  ],
  templateUrl: './event-details.component.html',
  styleUrls: ['./event-details.component.scss']
})
export class EventDetailsComponent implements OnInit {
  eventId!: number;
  event: EvaluationEvent | null = null;
  panels: Panel[] = [];
  loading = true;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private panelService: PanelService,
    private dialog: MatDialog,
    private notificationService: NotificationService
  ) {}
  
  ngOnInit(): void {
    this.eventId = +this.route.snapshot.paramMap.get('id')!;
    this.loadEventDetails();
    this.loadEventPanels();
  }
  
  loadEventDetails(): void {
    this.eventService.getEventById(this.eventId).subscribe({
      next: (event) => {
        this.event = event;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Failed to load event details');
        this.loading = false;
      }
    });
  }
  
  loadEventPanels(): void {
    this.panelService.getPanelsByEventId(this.eventId).subscribe({
      next: (panels) => {
        this.panels = panels;
      },
      error: (error) => {
        this.notificationService.showError('Failed to load panels');
      }
    });
  }
  
  // Update this method to correctly handle panel creation
  openCreatePanelDialog(): void {
    const dialogRef = this.dialog.open(CreatePanelDialogComponent, {
      width: '600px',
      data: { eventId: this.eventId }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notificationService.showSuccess('Panel created successfully');
        this.loadEventPanels();
      }
    });
  }
  
  // Update this method to handle group assignment to panel
  assignGroupToPanel(panel: Panel): void {
    const dialogRef = this.dialog.open(AssignGroupDialogComponent, {
      width: '600px',
      data: { 
        panelId: panel.id, 
        eventId: this.eventId 
      }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notificationService.showSuccess('Group assigned successfully');
      }
    });
  }
}