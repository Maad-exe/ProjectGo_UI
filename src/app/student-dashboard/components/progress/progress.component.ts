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
  isLoading: boolean = false;
  evaluations: any[] = [];
  upcomingEvaluations: any[] = [];
  completedEvaluations: any[] = [];
  error: string | null = null;
  finalGrade: number = 0; // Add property for overall grade
  
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
    const userId = this.authService.getUserId();
    
    if (!userId) {
      this.error = 'User authentication error';
      this.isLoading = false;
      return;
    }

    // Fix: The issue is that getStudentEvaluations expects no arguments according to the error
    this.evaluationService.getStudentEvaluations().subscribe({
      next: (data) => {
        this.evaluations = data || []; // Ensure we have an array even if data is null
        
        // Make sure each evaluation has required properties for the template
        this.evaluations.forEach(evaluation => {
          // Add default values for any potentially undefined properties
          evaluation.panel = evaluation.panel || { name: 'Unnamed Panel', members: [] };
          evaluation.eventName = evaluation.eventName || 'Unnamed Event';
          evaluation.date = evaluation.date || new Date().toISOString();
          evaluation.score = evaluation.score || 0;
          evaluation.feedback = evaluation.feedback || '';
          evaluation.status = evaluation.status || 'Pending';
          
          // Create event object structure for template
          evaluation.event = {
            name: evaluation.eventName,
            type: evaluation.eventType || 'Assessment',
            date: evaluation.date,
            weight: evaluation.weight || 1,
            totalMarks: evaluation.totalMarks || 100
          };
          
          // Set completed status based on evaluation status
          evaluation.completed = evaluation.status === 'Completed';
        });
        
        this.upcomingEvaluations = this.evaluations.filter(e => e.status !== 'Completed');
        this.completedEvaluations = this.evaluations.filter(e => e.status === 'Completed');
        
        // Calculate final grade if we have completed evaluations
        this.calculateFinalGrade();
        
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load evaluations:', err);
        this.error = 'Failed to load evaluations';
        this.isLoading = false;
        this.notificationService.showError('Failed to load your evaluations');
      }
    });
  }
  
  // Add missing getGradeColor function
  getGradeColor(score: number): string {
    if (!score && score !== 0) return 'average';
    
    const percentage = typeof score === 'number' ? score : 0;
    
    if (percentage >= 85) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 55) return 'average';
    return 'needs-improvement';
  }
  
  // Add missing getProgressBarWidth function
  getProgressBarWidth(percentage: number): string {
    if (!percentage && percentage !== 0) return '0%';
    const validPercentage = Math.max(0, Math.min(100, percentage));
    return `${validPercentage}%`;
  }
  
  // Calculate overall final grade
  private calculateFinalGrade(): void {
    if (!this.completedEvaluations || this.completedEvaluations.length === 0) {
      this.finalGrade = 0;
      return;
    }
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    this.completedEvaluations.forEach(evaluation => {
      const weight = evaluation.weight || 1;
      const scorePercentage = (evaluation.score / (evaluation.totalMarks || 100)) * 100;
      
      totalWeightedScore += scorePercentage * weight;
      totalWeight += weight;
    });
    
    this.finalGrade = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }
}
