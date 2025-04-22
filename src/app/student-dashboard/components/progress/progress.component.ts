import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { NotificationService } from '../../../services/notifications.service';
import { EnhancedStudentEvaluationDto, CategoryScoreDetailDto, EvaluatorDto } from '../../../models/evaluation.model';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss']
})
export class ProgressComponent implements OnInit {
  isLoading: boolean = false;
  evaluations: EnhancedStudentEvaluationDto[] = [];
  upcomingEvaluations: EnhancedStudentEvaluationDto[] = [];
  completedEvaluations: EnhancedStudentEvaluationDto[] = [];
  error: string | null = null;
  finalGrade: number = 0;
  
  constructor(
    private authService: AuthService,
    private evaluationService: EvaluationService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadEvaluations();
  }

  loadEvaluations(): void {
    this.isLoading = true;
    this.error = null;
    
    this.evaluationService.getEnhancedStudentEvaluations().subscribe({
      next: (data) => {
        // Cast the data to match the comprehensive interface from models
        this.evaluations = data as unknown as EnhancedStudentEvaluationDto[];
        
        // Separate completed from pending evaluations
        this.completedEvaluations = this.evaluations.filter(e => e.isComplete);
        this.upcomingEvaluations = this.evaluations.filter(e => !e.isComplete);
        
        // Get final grade from backend instead of calculating in frontend
        this.loadFinalGrade();
        
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Failed to load evaluations:', err);
        this.error = 'Failed to load evaluations';
        this.isLoading = false;
        this.notificationService.showError('Failed to load your evaluations');
      }
    });
  }
  
  loadFinalGrade(): void {
    this.evaluationService.getFinalGrade().subscribe({
      next: (grade: number) => {
        this.finalGrade = grade;
      },
      error: (err: any) => {
        console.error('Failed to load final grade:', err);
      }
    });
  }
  
  getGradeColor(score: number): string {
    if (!score && score !== 0) return 'average';
    
    const percentage = typeof score === 'number' ? score : 0;
    
    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 55) return 'average';
    return 'needs-improvement';
  }
  
  getProgressBarWidth(percentage: number): string {
    if (!percentage && percentage !== 0) return '0%';
    const validPercentage = Math.max(0, Math.min(100, percentage));
    return `${validPercentage}%`;
  }
}
