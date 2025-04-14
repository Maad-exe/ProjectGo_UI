import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { NotificationService } from '../../../services/notifications.service';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss']
})
export class ProgressComponent implements OnInit {
  studentId: number;
  evaluations: any[] = [];
  finalGrade: number = 0;
  loading = true;
  
  constructor(
    private authService: AuthService,
    private evaluationService: EvaluationService,
    private notificationService: NotificationService
  ) {
    this.studentId = this.authService.getUserId() || 0;
  }
  
  ngOnInit(): void {
    this.loadStudentEvaluations();
  }
  
  loadStudentEvaluations(): void {
    if (!this.studentId) {
      this.notificationService.showError('User ID not found');
      this.loading = false;
      return;
    }
    
    // Use the getStudentEvaluations method we added to the service
    this.evaluationService.getStudentEvaluations().subscribe({
      next: (evaluations: any[]) => {
        this.evaluations = evaluations;
        this.calculateFinalGrade();
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load evaluations');
        this.loading = false;
      }
    });
  }
  
  calculateFinalGrade(): void {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    // Change 'eval' to 'evaluation' to avoid using reserved keyword
    this.evaluations.forEach(evaluation => {
      if (evaluation.completed) {
        totalWeightedScore += (evaluation.score * evaluation.event.weight);
        totalWeight += evaluation.event.weight;
      }
    });
    
    this.finalGrade = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }
  
  getProgressBarWidth(score: number): string {
    return `${score}%`;
  }
  
  getGradeColor(score: number): string {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 60) return 'average';
    return 'needs-improvement';
  }
}
