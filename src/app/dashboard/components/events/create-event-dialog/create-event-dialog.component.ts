import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { EventService } from '../../../../services/event.service';
import { EvaluationEvent, EventType } from '../../../event.model';

interface DialogData {
  event?: EvaluationEvent;
}

@Component({
  selector: 'app-create-event-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './create-event-dialog.component.html',
  styleUrls: ['./create-event-dialog.component.scss']
})
export class CreateEventDialogComponent implements OnInit {
  eventForm!: FormGroup;
  isLoading = false;
  submitted = false;
  isEdit = false;
  EventType = EventType; // Make enum available to template

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    public dialogRef: MatDialogRef<CreateEventDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData = {}
  ) {
    this.isEdit = !!data?.event;
    this.initForm();
  }

  // Add this method to close the dialog
  close(): void {
    this.dialogRef.close();
  }

  ngOnInit() {
    if (this.data?.event) {
      // Format the date to YYYY-MM-DD for the date input
      const eventDate = this.data.event.date ? new Date(this.data.event.date) : new Date();
      const formattedDate = eventDate.toISOString().split('T')[0];
      
      this.eventForm.patchValue({
        name: this.data.event.name,
        description: this.data.event.description,
        date: formattedDate,
        totalMarks: this.data.event.totalMarks,
        isActive: this.data.event.isActive,
        type: this.data.event.type,
        weight: this.data.event.weight,
        rubricId: this.data.event.rubricId
      });
    }
  }

  private initForm(): void {
    this.eventForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      date: ['', Validators.required],
      totalMarks: [100, [Validators.required, Validators.min(0)]],
      type: [EventType.Final, Validators.required],
      weight: [1.0, [Validators.required, Validators.min(0.1)]],
      rubricId: [null],
      isActive: [true]
    });
  }

  onSubmit() {
    this.submitted = true;
    if (this.eventForm.valid) {
      this.isLoading = true;
      const eventData = this.eventForm.value;
      
      const request$ = this.isEdit && this.data?.event 
        ? this.eventService.updateEvent(this.data.event.id, eventData)
        : this.eventService.createEvent(eventData);

      request$.subscribe({
        next: (result) => {
          this.dialogRef.close(result);
        },
        error: (error) => {
          console.error('Error:', error);
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    }
  }
}