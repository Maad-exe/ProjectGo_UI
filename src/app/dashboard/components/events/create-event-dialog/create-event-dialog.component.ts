import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { EventService } from '../../../../services/event.service';
import { RubricService } from '../../../../services/rubric.service';
import { NotificationService } from '../../../../services/notifications.service';
import { EvaluationEvent, EventType, CreateEventDto, UpdateEventDto } from '../../../../models/event.model';
import { Rubric } from '../../../../models/rubric.model';

@Component({
  selector: 'app-create-event-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './create-event-dialog.component.html',
  styleUrls: ['./create-event-dialog.component.scss']
})
export class CreateEventDialogComponent implements OnInit {
  eventForm: FormGroup;
  loading = false;
  isEditing = false;
  rubrics: Rubric[] = [];
  eventTypes = Object.keys(EventType).filter(key => !isNaN(Number(EventType[key as any])));
  // Add this property to expose the enum to the template
  eventTypeEnum = EventType;
  
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreateEventDialogComponent>,
    private eventService: EventService,
    private rubricService: RubricService,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: { event?: EvaluationEvent } = {}
  ) {
    this.eventForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]],
      date: ['', [Validators.required]],
      totalMarks: [100, [Validators.required, Validators.min(1)]],
      weight: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      type: [EventType.Proposal, [Validators.required]],
      isActive: [true],
      rubricId: [null]
    });

    this.isEditing = !!data?.event;
  }
  
  ngOnInit(): void {
    this.loadRubrics();
    
    if (this.isEditing && this.data.event) {
      // Format the date to YYYY-MM-DD for the input field
      const date = new Date(this.data.event.date);
      const formattedDate = date.toISOString().split('T')[0];
      
      this.eventForm.patchValue({
        name: this.data.event.name,
        description: this.data.event.description,
        date: formattedDate,
        totalMarks: this.data.event.totalMarks,
        weight: this.data.event.weight,
        type: this.data.event.type,
        isActive: this.data.event.isActive,
        rubricId: this.data.event.rubricId
      });
    }
  }
  
  loadRubrics(): void {
    this.rubricService.getAllRubrics().subscribe({
      next: (rubrics) => {
        this.rubrics = rubrics;
      },
      error: () => {
        this.notificationService.showError('Failed to load rubrics');
      }
    });
  }
  
  onSubmit(): void {
    if (this.eventForm.invalid) {
      this.notificationService.showError('Please fill in all required fields');
      return;
    }
    
    this.loading = true;
    
    if (this.isEditing && this.data.event) {
      const updateEvent: UpdateEventDto = {
        name: this.eventForm.value.name,
        description: this.eventForm.value.description,
        date: this.eventForm.value.date,
        totalMarks: this.eventForm.value.totalMarks,
        isActive: this.eventForm.value.isActive,
        type: this.eventForm.value.type,
        weight: this.eventForm.value.weight,
        rubricId: this.eventForm.value.rubricId || undefined
      };
      
      this.eventService.updateEvent(this.data.event.id, updateEvent).subscribe({
        next: () => {
          this.notificationService.showSuccess('Evaluation event updated successfully');
          this.dialogRef.close(true);
        },
        error: () => {
          this.notificationService.showError('Failed to update evaluation event');
          this.loading = false;
        }
      });
    } else {
      const createEvent: CreateEventDto = {
        name: this.eventForm.value.name,
        description: this.eventForm.value.description,
        date: this.eventForm.value.date,
        totalMarks: this.eventForm.value.totalMarks,
        weight: this.eventForm.value.weight,
        type: this.eventForm.value.type,
        rubricId: this.eventForm.value.rubricId || undefined
      };
      
      this.eventService.createEvent(createEvent).subscribe({
        next: () => {
          this.notificationService.showSuccess('Evaluation event created successfully');
          this.dialogRef.close(true);
        },
        error: () => {
          this.notificationService.showError('Failed to create evaluation event');
          this.loading = false;
        }
      });
    }
  }

  // Add this helper method to your component class
  getEventTypeValue(typeString: string): EventType {
    // Convert string representation to enum value
    return EventType[typeString as keyof typeof EventType];
  }
}