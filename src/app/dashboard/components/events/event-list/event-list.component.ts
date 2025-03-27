import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { EventService } from '../../../../services/event.service';
import { EvaluationEvent, EventType } from '../../../../models/event.model';
import { CreateEventDialogComponent } from '../create-event-dialog/create-event-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/confirm-dialog/confirm-dialog.component';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

// Update the SortableColumn type to include type
type SortableColumn = keyof Pick<EvaluationEvent, 'name' | 'description' | 'date' | 'createdAt' | 'type'>;

@Component({
  selector: 'app-event-list',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './event-list.component.html',
  styleUrls: ['./event-list.component.scss']
})
export class EventListComponent implements OnInit {
  events: EvaluationEvent[] = [];
  filteredEvents: EvaluationEvent[] = [];
  private searchSubject = new Subject<string>();
  private originalEvents: EvaluationEvent[] = [];
  
  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalEvents = 0;
  totalPages = 0;
  pages: number[] = [];
  startIndex = 0;
  endIndex = 0;

  // Sorting
  currentSort = { 
    column: 'date' as SortableColumn, 
    direction: 'desc' as 'asc' | 'desc' 
  };

  loading = true;

  constructor(
    private eventService: EventService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    // Setup search debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.filterEvents(searchTerm);
    });
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  // Modify loadEvents to store original data
  loadEvents(): void {
    this.loading = true;
    this.eventService.getAllEvents().subscribe({
      next: (data) => {
        this.originalEvents = [...data];
        this.filteredEvents = [...data];
        this.sortData(this.currentSort.column); // Apply initial sorting
        this.updatePagination();
        this.loading = false;
      },
      error: (error) => {
        this.snackBar.open('Failed to load events: ' + error.message, 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateEventDialogComponent, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadEvents();
      }
    });
  }

  editEvent(event: EvaluationEvent): void {
    const dialogRef = this.dialog.open(CreateEventDialogComponent, {
      width: '500px',
      data: { event }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadEvents();
      }
    });
  }

  confirmDelete(event: EvaluationEvent): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Confirm Delete',
        message: `Are you sure you want to delete the event "${event.name}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deleteEvent(event);
      }
    });
  }

  deleteEvent(event: EvaluationEvent): void {
    if (event && event.id) {
      this.eventService.deleteEvent(event.id).subscribe({
        next: () => {
          this.snackBar.open('Event deleted successfully', 'Close', { duration: 3000 });
          this.loadEvents();
        },
        error: (error) => {
          this.snackBar.open('Failed to delete event: ' + error.message, 'Close', { duration: 3000 });
        }
      });
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  viewEvent(event: EvaluationEvent): void {
    this.router.navigate(['/events', event.id]);
  }

  // Modified applyFilter method
  applyFilter(event: Event): void {
    const searchTerm = (event.target as HTMLInputElement)?.value || '';
    this.searchSubject.next(searchTerm);
  }

  clearSearch(input: HTMLInputElement): void {
    input.value = '';
    this.searchSubject.next('');
  }

  sortData(column: SortableColumn) {
    if (this.currentSort.column === column) {
      this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.currentSort = { column, direction: 'asc' };
    }

    this.filteredEvents.sort((a, b) => {
      const direction = this.currentSort.direction === 'asc' ? 1 : -1;
      const valueA = a[column];
      const valueB = b[column];

      if (column === 'date') {
        return (new Date(valueA).getTime() - new Date(valueB).getTime()) * direction;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB) * direction;
      }

      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });

    this.updatePagination();
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getEventTypeString(type: EventType): string {
    return EventType[type];
  }

  // Add this helper method
  getEventTypeClass(type: EventType): string {
    return this.getEventTypeString(type).toLowerCase();
  }

  // New method for filtering
  private filterEvents(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredEvents = [...this.originalEvents];
    } else {
      searchTerm = searchTerm.toLowerCase();
      this.filteredEvents = this.originalEvents.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        this.getEventTypeString(item.type).toLowerCase().includes(searchTerm)
      );
    }
    this.currentPage = 1;
    this.updatePagination();
  }

  private updatePagination() {
    this.totalEvents = this.filteredEvents.length;
    this.totalPages = Math.ceil(this.totalEvents / this.pageSize);
    this.pages = Array.from({length: this.totalPages}, (_, i) => i + 1);
    
    this.startIndex = (this.currentPage - 1) * this.pageSize;
    this.endIndex = Math.min(this.startIndex + this.pageSize, this.totalEvents);
    
    this.events = this.filteredEvents.slice(this.startIndex, this.endIndex);
  }

  getSortIcon(column: SortableColumn): string {
    if (this.currentSort.column !== column) {
      return 'fa-sort';
    }
    return this.currentSort.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }
}