import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EventService } from '../../../services/event.service';
import { NotificationService } from '../../../services/notifications.service';
import { EvaluationEvent, EventType, getEventTypeString } from '../../../models/event.model';
import { CreateEventDialogComponent } from '../events/create-event-dialog/create-event-dialog.component';

@Component({
  selector: 'app-evaluation-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatDialogModule],
  templateUrl: './evaluation-list.component.html',
  styleUrls: ['./evaluation-list.component.scss']
})
export class EvaluationListComponent implements OnInit {
  events: EvaluationEvent[] = [];
  loading = true;
  searchTerm = '';
  
  constructor(
    private eventService: EventService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}
  
  ngOnInit(): void {
    this.loadEvents();
  }
  
  get filteredEvents(): EvaluationEvent[] {
    return this.events.filter(event => 
      event.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      getEventTypeString(event.type).toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }
  
  loadEvents(): void {
    this.loading = true;
    this.eventService.getAllEvents().subscribe({
      next: (events) => {
        this.events = events;
        this.loading = false;
      },
      error: (error) => {
        this.notificationService.showError('Failed to load evaluation events');
        this.loading = false;
      }
    });
  }
  
  getEventTypeString(type: EventType): string {
    return getEventTypeString(type);
  }

  openCreateEventDialog(): void {
    const dialogRef = this.dialog.open(CreateEventDialogComponent, {
      width: '600px'
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadEvents();
      }
    });
  }
  
  editEvent(event: EvaluationEvent): void {
    const dialogRef = this.dialog.open(CreateEventDialogComponent, {
      width: '600px',
      data: { event }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadEvents();
      }
    });
  }
  
  deleteEvent(event: EvaluationEvent): void {
    if (confirm(`Are you sure you want to delete the evaluation event "${event.name}"?`)) {
      this.eventService.deleteEvent(event.id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Evaluation event deleted successfully');
          this.loadEvents();
        },
        error: () => {
          this.notificationService.showError('Failed to delete evaluation event');
        }
      });
    }
  }
}