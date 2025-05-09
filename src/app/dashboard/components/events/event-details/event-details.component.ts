import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EventService } from '../../../../services/event.service';
import { PanelService } from '../../../../services/panel.service';
import { GroupService } from '../../../../services/group.service';
import { NotificationService } from '../../../../services/notifications.service';
import { EvaluationEvent, EventType, getEventTypeString } from '../../../../models/event.model';
import { Panel } from '../../../../models/panel.model';
import { GroupDetails } from '../../../../services/group.service';
import { CreatePanelDialogComponent } from '../../create-panel-dialog/create-panel-dialog.component';
import { AssignGroupDialogComponent } from '../../assign-group-dialog/assign-group-dialog.component';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule],
  templateUrl: './event-details.component.html',
  styleUrls: ['./event-details.component.scss']
})
export class EventDetailsComponent implements OnInit {
  eventId: number;
  event: EvaluationEvent | null = null;
  panels: Panel[] = [];
  assignedGroups: any[] = [];
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    private panelService: PanelService,
    private groupService: GroupService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {
    this.eventId = +this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.loadEventDetails();
  }

  loadEventDetails(): void {
    this.loading = true;
    this.eventService.getEventById(this.eventId).subscribe({
      next: (eventData) => {
        // Convert the API response to match our expected EvaluationEvent model type
        this.event = {
          id: eventData.id,
          name: eventData.name,
          description: eventData.description || '', // Ensure description is never undefined
          date: eventData.date,
          totalMarks: eventData.totalMarks,
          isActive: eventData.isActive,
          createdAt: eventData.createdAt,
          weight: eventData.weight,
          type: eventData.type,
          rubricId: eventData.rubricId,
          rubricName: eventData.rubricName,
          evaluationMethod: eventData.evaluationMethod
        };
        this.loadPanels();
        this.loadAssignedGroups();
      },
      error: () => {
        this.notificationService.showError('Failed to load event details');
        this.loading = false;
      }
    });
  }

  loadPanels(): void {
    this.panelService.getAllPanels().subscribe({
      next: (panels) => {
        console.log("API response panels:", panels);
        
        // Store all panels (later when API supports filtering by event, you can filter here)
        this.panels = panels || [];
        
        this.loading = false;
        console.log("Processed panels:", this.panels);
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

  loadAssignedGroups(): void {
    this.panelService.getGroupEvaluationsByEventId(this.eventId).subscribe({
      next: (evaluations) => {
        this.assignedGroups = evaluations;
        console.log("Successfully loaded evaluations:", evaluations);
      },
      error: (error) => {
        console.error("Error loading assigned groups:", error);
        this.notificationService.showError('Failed to load assigned groups');
        
        // Optionally, use mock data while developing
        this.assignedGroups = this.panelService.getMockGroupEvaluations()
          .filter(e => e.eventId === this.eventId);
      }
    });
  }

  openCreatePanelDialog(): void {
    const dialogRef = this.dialog.open(CreatePanelDialogComponent, {
      width: 'calc(100% - 80px)', // Almost full screen width except for sidebar
      maxWidth: '1600px', // Set a maximum width
      height: '85vh', // Set a percentage of viewport height
      panelClass: 'panel-dialog-container',
      data: { eventId: this.eventId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPanels();
      }
    });
  }

  // Combined method that handles both with and without panelId
  openAssignGroupDialog(panelId?: number): void {
    const dialogData = {
      eventId: this.eventId,
      assignedGroups: this.assignedGroups
    };

    // If panelId is provided, add it to the dialog data
    if (panelId !== undefined) {
      Object.assign(dialogData, { panelId });
    } else {
      // If no panelId, add the panels list
      Object.assign(dialogData, { panels: this.panels });
    }

    const dialogRef = this.dialog.open(AssignGroupDialogComponent, {
      width: '600px',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadAssignedGroups();
      }
    });
  }

  getEventTypeString(type: EventType): string {
    return getEventTypeString(type);
  }
}