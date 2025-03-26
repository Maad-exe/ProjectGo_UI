import { CommonModule } from '@angular/common';
import { RubricService } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-rubric-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rubric-list.component.html',
  styleUrls: ['./rubric-list.component.scss']
})
export class RubricListComponent implements OnInit {
  rubrics: any[] = [];
  loading = true;
  
  constructor(
    private rubricService: RubricService,
    private notificationService: NotificationService
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
}