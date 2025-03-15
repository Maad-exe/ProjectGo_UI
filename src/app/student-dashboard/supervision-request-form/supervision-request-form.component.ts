import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeacherDetails, TeacherService } from '../../services/teacher.service';
import { GroupDetails } from '../../services/group.service';
import { NotificationService } from '../../services/notifications.service';
import { SupervisionRequestDto } from '../../services/supervision.service';

@Component({
  selector: 'app-supervision-request-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supervision-request-form.component.html',
  styleUrls: ['./supervision-request-form.component.scss']
})
export class SupervisionRequestFormComponent {
  @Input() teacher!: TeacherDetails;
  @Input() group!: GroupDetails;
  @Output() requestSubmitted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  requestMessage = '';
  isSubmitting = false;
  error: string | null = null;

  constructor(
    private teacherService: TeacherService,
    private notificationService: NotificationService
  ) {}

  submitRequest() {
    if (!this.requestMessage.trim()) {
      this.error = 'Please enter a message for your supervision request';
      return;
    }

    this.isSubmitting = true;
    const request: SupervisionRequestDto = {
      groupId: this.group.id,
      teacherId: this.teacher.id,
      message: this.requestMessage
    };

    this.teacherService.requestSupervision(request).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.requestSubmitted.emit();
      },
      error: (error: any) => {
        console.error('Error submitting request:', error);
        this.error = error.error?.message || 'Failed to submit request';
        this.isSubmitting = false;
      }
    });
  }

  cancel() {
    this.cancelled.emit();
  }
}
