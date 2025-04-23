import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  EvaluationService, 
  EventEvaluationTypeDto,
  EvaluateStudentDto,
  CategoryScoreDto,
  RubricCategory,
  EvaluationRubric,
  StudentEvaluationDto,
  EnhancedStudentEvaluationDto,
  StudentDto
} from '../../../services/evaluation.service';
import { EventService } from '../../../services/event.service';
import { RubricService } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { StudentService } from '../../../services/student.service';
import { AuthService } from '../../../services/auth.service';

interface EnhancedCategoryScore {
  categoryId: number;
  categoryName?: string;
  score: number;
  maxScore?: number;
  feedback?: string;
  evaluatorDetails?: EvaluatorDetail[];
}

interface EvaluatorDetail {
  evaluatorId: number;
  evaluatorName?: string;
  score: number;
  feedback?: string;
  evaluatedAt?: string;
}

@Component({
  selector: 'app-conduct-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './conduct-evaluation.component.html',
  styleUrls: ['./conduct-evaluation.component.scss']
})
export class ConductEvaluationComponent implements OnInit {
  eventId!: number;
  groupId!: number;
  studentId!: number;
  teacherId!: number;
  groupEvaluationId!: number; // Add this new property
  
  eventDetails: any = null;
  rubric: EvaluationRubric | null = null;
  studentInfo: any = null;
  existingEvaluation: StudentEvaluationDto | null = null;
  evaluationStatistics: any = null; // Add this new property
  
  isRubricEvaluation: boolean = false;
  totalMarks: number = 100;
  
  evaluationForm!: FormGroup;
  loading: boolean = true;
  submitting: boolean = false;
  hasTeacherEvaluated: boolean = false; // Add this new property
  hasEvaluated = false; // Add property to track if this is a new or updating evaluation
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private evaluationService: EvaluationService,
    private eventService: EventService,
    private rubricService: RubricService,
    private studentService: StudentService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    // Initialize the form with basic fields
    this.evaluationForm = this.fb.group({
      obtainedMarks: [null, [Validators.required, Validators.min(0)]],
      feedback: ['', Validators.required]
    });
    
    // Get all parameters from the route
    this.eventId = +this.route.snapshot.paramMap.get('eventId')!;
    this.groupId = +this.route.snapshot.paramMap.get('groupId')!;
    this.studentId = +this.route.snapshot.paramMap.get('studentId')!;
    this.groupEvaluationId = +this.route.snapshot.paramMap.get('groupEvaluationId')!;
    this.teacherId = this.authService.getUserId() || 0;
  }
  
  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.eventId = +params['eventId'];
      this.groupId = +params['groupId'];
      this.studentId = +params['studentId'];
      this.groupEvaluationId = +params['groupEvaluationId']; // Get the new parameter
      
      // Use the groupEvaluationId for the API call instead of groupId
      this.evaluationService.getEventEvaluationType(this.groupEvaluationId).subscribe({
        next: (typeData) => {
          this.eventDetails = {
            id: typeData.eventId,
            name: typeData.eventName,
            totalMarks: typeData.totalMarks
          };
          
          this.totalMarks = typeData.totalMarks;
          this.isRubricEvaluation = typeData.hasRubric;
          
          // Update validators for obtainedMarks
          if (!this.isRubricEvaluation) {
            this.evaluationForm.get('obtainedMarks')?.setValidators([
              Validators.required, 
              Validators.min(0), 
              Validators.max(this.totalMarks)
            ]);
            this.evaluationForm.get('obtainedMarks')?.updateValueAndValidity();
          }
          
          // If it has a rubric, load it
          if (this.isRubricEvaluation && typeData.rubricId) {
            this.loadRubric(typeData.rubricId);
          } else {
            this.loadStudentDetails();
          }
        },
        error: (error) => {
          console.error('Error loading evaluation type:', error);
          this.notificationService.showError('Failed to load evaluation configuration');
          this.loading = false;
        }
      });
    });
  }
  
  loadRubric(rubricId: number): void {
    this.rubricService.getRubricById(rubricId).subscribe({
      next: (rubric) => {
        // Transform the rubric to match the EvaluationRubric interface
        this.rubric = {
          id: rubric.id,
          name: rubric.name,
          description: rubric.description,
          isActive: rubric.isActive || false,
          categories: rubric.categories.map(category => ({
            id: category.id,
            name: category.name,
            description:  '',  // Provide empty string if missing
            maxScore: category.maxScore,
            weight: category.weight
          }))
        };
        
        console.log("Loaded rubric:", this.rubric);
        
        // Create dynamic form fields for each category
        const formConfig: any = {
          feedback: ['', Validators.required]
        };
        
        // Add form controls for each rubric category
        if (this.rubric && this.rubric.categories) {
          this.rubric.categories.forEach((category: RubricCategory) => {
            formConfig[`category_${category.id}`] = [null, [
              Validators.required,
              Validators.min(0),
              Validators.max(category.maxScore)
            ]];
            formConfig[`feedback_${category.id}`] = [''];
          });
        }
        
        this.evaluationForm = this.fb.group(formConfig);
        this.loadStudentDetails();
      },
      error: (error) => {
        console.error('Error loading rubric:', error);
        this.notificationService.showError('Failed to load evaluation rubric');
        this.isRubricEvaluation = false;
        
        // Fallback to simple evaluation
        this.evaluationForm = this.fb.group({
          obtainedMarks: [null, [Validators.required, Validators.min(0), Validators.max(this.totalMarks)]],
          feedback: ['', Validators.required]
        });
        
        this.loadStudentDetails();
      }
    });
  }
  
  loadStudentDetails(): void {
    // Load student details - use groupEvaluationId instead of groupId
    this.evaluationService.getStudentsForGroupEvaluation(this.groupEvaluationId).subscribe({
      next: (students) => {
        const student = students.find(s => s.id === this.studentId);
        if (student) {
          this.studentInfo = {
            id: student.id,
            fullName: student.fullName,
            email: student.email,
            department: student.department || 'Not specified',
            enrollmentNumber: student.enrollmentNumber || 'Not available'
          };
          
          // Try to load existing evaluation
          this.loadExistingEvaluation();
        } else {
          this.notificationService.showWarning('Student not found in this group');
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Error loading student details:', error);
        this.notificationService.showError('Failed to load student information');
        this.loading = false;
      }
    });
  }
  
  // Update the loadExistingEvaluation method
  loadExistingEvaluation(): void {
    console.log(`Loading evaluation for teacher ${this.teacherId}, student ${this.studentId}, group evaluation ${this.groupEvaluationId}`);
    
    // Load statistics first to know the overall status
    this.evaluationService.getEvaluationStatistics(this.groupEvaluationId, this.studentId).subscribe({
      next: (statistics) => {
        this.evaluationStatistics = statistics;
        
        // Then load this specific teacher's evaluation
        this.evaluationService.getTeacherEvaluationForStudent(this.groupEvaluationId, this.studentId).subscribe({
          next: (evaluation) => {
            console.log('Teacher evaluation data:', evaluation);
            this.existingEvaluation = evaluation;
            
            // Check if this specific teacher has evaluated - look for populated category scores
            const hasScores = evaluation.categoryScores?.some(
              cs => cs.score > 0 && cs.evaluatorDetails?.some(ed => ed.evaluatorId === this.teacherId)
            );
            this.hasEvaluated = !!hasScores;
            
            const hasTeacherEvaluated = evaluation.categoryScores?.some(
              (cs: any) => (cs.evaluatorDetails || []).some((ed: any) => ed.evaluatorId === this.teacherId)
            );
            
            // Create a new property to track if this teacher specifically has evaluated
            this.hasTeacherEvaluated = !!hasTeacherEvaluated;
            
            if (hasTeacherEvaluated) {
              // This teacher has already evaluated - populate form with their data
              if (this.isRubricEvaluation && evaluation.categoryScores) {
                evaluation.categoryScores.forEach(score => {
                  // Only use the score from this teacher's evaluation
                  this.evaluationForm.patchValue({
                    [`category_${score.categoryId}`]: score.score,
                    [`feedback_${score.categoryId}`]: score.feedback || ''
                  });
                });
                
                this.evaluationForm.patchValue({
                  feedback: evaluation.feedback || ''
                });
              } else if (!this.isRubricEvaluation) {
                this.evaluationForm.patchValue({
                  obtainedMarks: evaluation.obtainedMarks,
                  feedback: evaluation.feedback || ''
                });
              }
              
              // If the overall evaluation is complete, make it read-only
              if (evaluation.isComplete) {
                this.evaluationForm.disable();
                this.notificationService.showInfo('This evaluation is complete and cannot be modified');
              }
            } else {
              // This teacher hasn't evaluated yet - form should be empty/default
              this.notificationService.showInfo('You are submitting a new evaluation for this student');
            }
            
            this.loading = false;
          },
          error: (error) => {
            console.log('No existing evaluation found for this teacher:', error);
            this.loading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error loading evaluation statistics:', error);
        this.notificationService.showError('Failed to load evaluation statistics');
        this.loading = false;
      }
    });
  }
  
  onSubmit(): void {
    this.submitting = true;
    
    const evaluationDto: EvaluateStudentDto = {
      groupEvaluationId: this.groupEvaluationId,
      studentId: this.studentId,
      feedback: this.evaluationForm.value.feedback
    };
    
    // Add the existing evaluation ID if we're updating
    if (this.existingEvaluation && this.existingEvaluation.id) {
      evaluationDto.evaluationId = this.existingEvaluation.id;
    }
    
    if (this.isRubricEvaluation && this.rubric) {
      // For rubric-based evaluation, collect category scores
      evaluationDto.categoryScores = this.prepareCategoryScores();
      
      console.log("Submitting rubric evaluation:", evaluationDto);
      
      this.evaluationService.submitRubricEvaluation(evaluationDto).subscribe({
        next: (result) => {
          console.log("Rubric evaluation submitted successfully:", result);
          this.notificationService.showSuccess('Evaluation submitted successfully');
          this.submitting = false;
          this.navigateBack();
        },
        error: (error) => {
          console.error('Error submitting evaluation:', error);
          
          // Check if this is a duplicate category error
          if (error.status === 500 && error.error && 
              typeof error.error === 'string' && 
              error.error.includes('duplicate key')) {
            
            // This is a duplicate key error - likely this teacher already evaluated this category
            this.notificationService.showError('You have already evaluated some of these categories. Refreshing the form to update your existing evaluation.');
            
            // Reload the existing evaluation
            this.loadExistingEvaluation();
          } else {
            this.notificationService.showError('Failed to submit evaluation. Please try again.');
          }
          
          this.submitting = false;
        }
      });
    } else {
      // Simple evaluation handling remains unchanged
      evaluationDto.obtainedMarks = this.evaluationForm.value.obtainedMarks;
      
      this.evaluationService.submitEvaluation(evaluationDto).subscribe({
        next: (result) => {
          console.log("Evaluation submitted successfully:", result);
          this.notificationService.showSuccess('Evaluation submitted successfully');
          this.submitting = false;
          this.navigateBack();
        },
        error: (error) => {
          console.error('Error submitting evaluation:', error);
          
          let errorMessage = 'Failed to submit evaluation';
          if (error.error && typeof error.error === 'string') {
            errorMessage += `: ${error.error}`;
          } else if (error.status === 404) {
            errorMessage += ': API endpoint not found';
          }
          
          this.notificationService.showError(errorMessage);
          this.submitting = false;
        }
      });
    }
  }
  
  // Prepare category scores from form values
  private prepareCategoryScores(): CategoryScoreDto[] {
    const scores: CategoryScoreDto[] = [];
    
    if (this.rubric) {
      this.rubric.categories.forEach(category => {
        const scoreValue = this.evaluationForm.get(`category_${category.id}`)?.value;
        const feedback = this.evaluationForm.get(`feedback_${category.id}`)?.value || '';
        
        // Only include categories that actually have a score
        if (scoreValue !== null && scoreValue !== undefined) {
          scores.push({
            categoryId: category.id,
            score: parseInt(scoreValue) || 0,
            feedback: feedback
          });
        }
      });
    }
    
    return scores;
  }
  
  navigateBack(): void {
    this.router.navigate(['/teacher-dashboard'], { queryParams: { view: 'evaluations' } });
  }
  
  calculateTotalScore(): number {
    if (!this.isRubricEvaluation) {
      return this.evaluationForm.value.obtainedMarks || 0;
    }
    
    if (!this.rubric || !this.rubric.categories) return 0;
    
    let totalScore = 0;
    let totalWeight = 0;
    
    this.rubric.categories.forEach((category: RubricCategory) => {
      const score = this.evaluationForm.value[`category_${category.id}`];
      if (score !== null && score !== undefined) {
        const percentage = (score / category.maxScore) * 100;
        totalScore += (percentage * category.weight) / 100;
        totalWeight += category.weight;
      }
    });
    
    // Normalize if weights don't add up to 100%
    if (totalWeight > 0 && totalWeight !== 100) {
      totalScore = (totalScore * 100) / totalWeight;
    }
    
    return Math.round((totalScore / 100) * this.totalMarks);
  }
  
  calculateMaxScore(): number {
    if (!this.isRubricEvaluation) {
      return this.totalMarks;
    }
    
    if (!this.rubric) return 0;
    
    return this.totalMarks;
  }
}
