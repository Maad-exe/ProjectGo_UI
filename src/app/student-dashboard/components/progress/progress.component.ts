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
          
          // Create a Map to ensure we have unique evaluators
          const uniqueEvaluators = new Map<number, EvaluatorDto>();
          
          // First add any evaluators directly from the backend
          (evaluation.evaluators || []).forEach(evaluator => {
            if (evaluator && evaluator.id) {
              uniqueEvaluators.set(evaluator.id, {
                ...evaluator,
                // Ensure hasEvaluated is a boolean and score is correctly set
                hasEvaluated: !!evaluator.hasEvaluated,
                score: evaluator.score || 0
              });
            }
          });
          
          // For rubric-based evaluations, we might need to extract additional evaluator data
          if (evaluation.categoryScores && evaluation.categoryScores.length > 0) {
            evaluation.categoryScores.forEach(category => {
              if (category.evaluatorDetails?.length > 0) {
                category.evaluatorDetails.forEach(evalDetail => {
                  if (evalDetail.evaluatorId && !uniqueEvaluators.has(evalDetail.evaluatorId)) {
                    uniqueEvaluators.set(evalDetail.evaluatorId, {
                      id: evalDetail.evaluatorId,
                      name: evalDetail.evaluatorName || `Evaluator ${evalDetail.evaluatorId}`,
                      hasEvaluated: true,
                      score: evalDetail.score
                    });
                  }
                });
              }
            });
          }
          
          // Extract the unique evaluators into an array
          const processedEvaluators = Array.from(uniqueEvaluators.values());
          
          // Process feedback to remove duplicate teacher names
          let processedFeedback = evaluation.feedback;
          if (processedFeedback) {
            // Split by "Feedback from" sections
            const feedbackSections = processedFeedback.split(/Feedback from\s+/i).filter(Boolean);
            
            if (feedbackSections.length > 1) {
              // Handle multi-evaluator feedback
              processedFeedback = feedbackSections.map((section, index) => {
                if (index === 0 && !section.includes(':')) {
                  return section.trim();  // This is not a section header
                }
                
                // For proper sections, keep the "Feedback from" prefix
                return index === 0 ? section.trim() : `Feedback from ${section.trim()}`;
              }).join('\n\n');
            }
          }
          
          // Process category scores as before
          const processedCategoryScores = evaluation.categoryScores?.map(category => {
            let feedback = category.feedback || '';
            
            if (feedback.includes('FROM') || feedback.includes('from')) {
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
            eventWeight: evaluation.eventWeight || 0,
            feedback: processedFeedback
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

  // Updated parseFeedback method 
  parseFeedback(feedbackString: string): {teacher: string, feedback: string}[] {
    if (!feedbackString) return [];
    
    // Split by "Feedback from" but keep the prefix
    const sections = feedbackString.split(/(?=Feedback from)/i).filter(Boolean);
    const results: {teacher: string, feedback: string}[] = [];

    // Keep track of matched evaluators to handle potential duplicates
    const processedTeachers = new Set<string>();
    
    for (const section of sections) {
      // Try to match "Feedback from X:" pattern
      const match = section.match(/Feedback from\s+([^:]+):(.*)/is);
      
      if (match) {
        const teacherName = match[1].trim();
        const feedbackText = match[2].trim();
        
        // Skip duplicates (sometimes feedback gets compiled with duplicates)
        if (!processedTeachers.has(teacherName.toLowerCase())) {
          processedTeachers.add(teacherName.toLowerCase());
          results.push({
            teacher: teacherName,
            feedback: feedbackText
          });
        }
      } else {
        // Try to extract teacher name from the feedback content
        const fromMatch = section.match(/[-\s]+(FROM|from|From)\s+([A-Za-z\s\.]+)/);
        
        if (fromMatch && fromMatch[2]) {
          const extractedName = fromMatch[2].trim();
          const cleanedFeedback = section.replace(/[-\s]+(FROM|from|From)\s+[A-Za-z\s\.]+/, '').trim();
          
          if (!processedTeachers.has(extractedName.toLowerCase())) {
            processedTeachers.add(extractedName.toLowerCase());
            results.push({
              teacher: extractedName,
              feedback: cleanedFeedback
            });
          }
        } else {
          // If no clear teacher name can be found, check if we can find a name in the evaluators list
          // based on any part of the feedback
          if (this.evaluations && this.evaluations.length > 0) {
            let foundTeacher = false;
            
            for (const evaluation of this.evaluations) {
              if (evaluation.evaluators && evaluation.evaluators.length > 0) {
                for (const evaluator of evaluation.evaluators) {
                  if (evaluator && evaluator.name && 
                      section.toLowerCase().includes(evaluator.name.toLowerCase())) {
                    if (!processedTeachers.has(evaluator.name.toLowerCase())) {
                      processedTeachers.add(evaluator.name.toLowerCase());
                      results.push({
                        teacher: evaluator.name,
                        feedback: section
                      });
                      foundTeacher = true;
                      break;
                    }
                  }
                }
                if (foundTeacher) break;
              }
            }
            
            // If we still couldn't identify the teacher, use the general label
            if (!foundTeacher) {
              results.push({
                teacher: 'Feedback',
                feedback: section.trim()
              });
            }
          } else {
            // Fallback if no evaluations data is available
            results.push({
              teacher: 'Feedback',
              feedback: section.trim()
            });
          }
        }
      }
    }
    
    return results;
  }

  // Helper method to find matching evaluator based on feedback text
  findMatchingEvaluator(feedback: string, evaluators: EvaluatorDto[]): EvaluatorDto | null {
    if (!evaluators || !feedback) return null;
    
    // Try to find by score mention in feedback
    const scoreMatch = feedback.match(/(\d+)\s+FROM/i);
    if (scoreMatch && scoreMatch[1]) {
      const score = parseInt(scoreMatch[1]);
      const matchingEvaluator = evaluators.find(e => e.score === score);
      if (matchingEvaluator) return matchingEvaluator;
    }
    
    // Try to find by name mention in feedback
    for (const evaluator of evaluators) {
      if (evaluator.name && feedback.toLowerCase().includes(evaluator.name.toLowerCase())) {
        return evaluator;
      }
    }
    
    return null;
  }
}
