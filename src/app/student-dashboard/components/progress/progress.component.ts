import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { EvaluationService } from '../../../services/evaluation.service';
import { NotificationService } from '../../../services/notifications.service';
import { EnhancedStudentEvaluationDto, CategoryScoreDetailDto, EvaluatorDto } from '../../../models/evaluation.model';

// Extend the interface to include the properties we need
interface ExtendedStudentEvaluationDto extends EnhancedStudentEvaluationDto {
  weightedScore?: number;
  isComplete?: boolean;
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss']
})
export class ProgressComponent implements OnInit {
  isLoading: boolean = false;
  evaluations: ExtendedStudentEvaluationDto[] = [];
  upcomingEvaluations: ExtendedStudentEvaluationDto[] = [];
  completedEvaluations: ExtendedStudentEvaluationDto[] = [];
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
    
    console.log('Loading student evaluations...');
    
    this.evaluationService.getEnhancedStudentEvaluations().subscribe({
      next: (data) => {
        console.log('Evaluations received:', data);
        
        this.evaluations = data as unknown as ExtendedStudentEvaluationDto[];
        
        this.evaluations = this.evaluations.map(evaluation => {
          const weightedScore = evaluation.weightedScore || 
            (evaluation.obtainedMarks / (evaluation.totalMarks || 100)) * 100;
          
          const hasScoreData = 
            (evaluation.obtainedMarks !== undefined && evaluation.obtainedMarks !== null) || 
            (weightedScore !== undefined && weightedScore > 0);
          
          const hasCategoryScores = !!evaluation.categoryScores && evaluation.categoryScores.length > 0 && 
            evaluation.categoryScores.some(cs => cs.score > 0);
          
          const isComplete: boolean = hasScoreData || !!hasCategoryScores || false;
          
          const evaluators = evaluation.evaluators || [];
          
          let processedEvaluators = [...evaluators];
          if (processedEvaluators.length === 0 && !!evaluation.categoryScores && evaluation.categoryScores.length > 0) {
            const extractedEvaluators = new Map();
            
            // Debug: log what we're working with
            console.log('Category scores to extract evaluators from:', evaluation.categoryScores);
            
            evaluation.categoryScores.forEach(category => {
              if (category.evaluatorDetails?.length > 0) {
                category.evaluatorDetails.forEach(evalDetail => {
                  // Debug: log each evaluator detail
                  console.log('Processing evaluator detail:', evalDetail);
                  
                  if (!extractedEvaluators.has(evalDetail.evaluatorId)) {
                    // Use the full name from the evaluatorName property if it exists
                    // Otherwise use the abbreviation that appears in the feedback
                    const evaluatorName = evalDetail.evaluatorName || 
                                         (category.feedback && category.feedback.includes('from') ? 
                                          category.feedback.split('from')[1]?.trim() : 
                                          `Evaluator ${evalDetail.evaluatorId}`);
                    
                    extractedEvaluators.set(evalDetail.evaluatorId, {
                      id: evalDetail.evaluatorId,
                      name: evaluatorName,
                      hasEvaluated: true,
                      score: evalDetail.score
                    });
                  }
                });
              }
            });
            processedEvaluators = Array.from(extractedEvaluators.values());
            
            // Debug: log the processed evaluators
            console.log('Processed evaluators:', processedEvaluators);
          }
          
          const processedCategoryScores = evaluation.categoryScores?.map(category => {
            // Extract evaluator names from feedback field if present
            let feedback = category.feedback || '';
            
            // Modified to make the feedback more readable by extracting evaluator info
            if (feedback.includes('FROM') || feedback.includes('from')) {
              // Try to clean up the feedback format
              const parts = feedback.split(/FROM|from/);
              if (parts.length > 1) {
                const scoreWithEvaluator = parts.map(part => part.trim()).filter(p => p);
                feedback = scoreWithEvaluator.join(' | ');
              }
            }
            
            return {
              ...category,
              categoryName: category.categoryName || 'Unnamed Category',
              categoryWeight: category.categoryWeight || 0,
              score: category.score || 0,
              maxScore: category.maxScore || 100,
              feedback: feedback,
              evaluatorDetails: category.evaluatorDetails?.map(detail => ({
                ...detail,
                evaluatorName: detail.evaluatorName || 
                              (category.feedback && category.feedback.includes(detail.evaluatorId.toString()) ? 
                               category.feedback.split(detail.evaluatorId.toString())[1]?.trim() : 
                               '')
              })) || []
            };
          }) || [];

          return {
            ...evaluation,
            isComplete: isComplete,
            obtainedMarks: evaluation.obtainedMarks || 0,
            totalMarks: evaluation.totalMarks || 100,
            weightedScore: weightedScore,
            evaluators: processedEvaluators,
            categoryScores: processedCategoryScores,
            eventWeight: evaluation.eventWeight || 0
          };
        });
        
        console.log('Processed evaluations:', this.evaluations);
        
        this.completedEvaluations = this.evaluations.filter(e => e.isComplete);
        this.upcomingEvaluations = this.evaluations.filter(e => !e.isComplete);
        
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
        console.log('Final grade received:', grade);
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
    return `${Math.min(Math.max(percentage, 0), 100)}%`;
  }
  
  calculatePercentage(score: number, total: number): number {
    if (!total) return 0;
    return (score / total) * 100;
  }
  
  hasEvaluationDetails(evaluation: ExtendedStudentEvaluationDto): boolean {
    const hasMarks: boolean = !!evaluation.obtainedMarks && evaluation.obtainedMarks > 0;
    const hasCategories: boolean = !!evaluation.categoryScores && evaluation.categoryScores.length > 0;
    const hasFeedback: boolean = !!evaluation.feedback && evaluation.feedback.trim() !== '';
    
    return hasMarks || hasCategories || hasFeedback;
  }
  
  getEvaluatorStatus(evaluator: EvaluatorDto): string {
    return evaluator?.hasEvaluated ? 'Completed' : 'Pending';
  }
  
  getPanelCompletionPercentage(evaluation: ExtendedStudentEvaluationDto): number {
    if (!evaluation.evaluators || evaluation.evaluators.length === 0) return 0;
    
    const completedCount = evaluation.evaluators.filter(e => e?.hasEvaluated).length;
    return (completedCount / evaluation.evaluators.length) * 100;
  }
  
  areAllEvaluationsCompleted(evaluation: ExtendedStudentEvaluationDto): boolean {
    if (!evaluation.evaluators || evaluation.evaluators.length === 0) return false;
    return evaluation.evaluators.every(e => e && e.hasEvaluated === true);
  }
}
