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
  
  isRubricEvaluation: boolean = false;
  totalMarks: number = 100;
  
  evaluationForm!: FormGroup;
  loading: boolean = true;
  submitting: boolean = false;
  
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
  
  loadExistingEvaluation(): void {
    this.evaluationService.getStudentEvaluation(this.groupEvaluationId, this.studentId).subscribe({
      next: (evaluation) => {
        this.existingEvaluation = evaluation;
        
        if (evaluation && evaluation.id) {
          // Check if the evaluation is complete and should not be editable
          if (evaluation.isComplete) {
            // Make form read-only if evaluation is complete
            this.evaluationForm.disable();
            this.notificationService.showInfo('This evaluation is complete and cannot be modified');
          } else {
            // Populate the form with the existing evaluation data
            if (!this.isRubricEvaluation) {
              this.evaluationForm.patchValue({
                obtainedMarks: evaluation.obtainedMarks,
                feedback: evaluation.feedback
              });
            } else if (this.rubric && (evaluation as EnhancedStudentEvaluationDto).categoryScores) {
              // Handle rubric evaluation if the response includes category scores
              const enhancedEval = evaluation as EnhancedStudentEvaluationDto;
              if (enhancedEval.categoryScores) {
                enhancedEval.categoryScores.forEach(score => {
                  this.evaluationForm.patchValue({
                    [`category_${score.categoryId}`]: score.score,
                    [`feedback_${score.categoryId}`]: score.feedback || ''
                  });
                });
              }
              
              this.evaluationForm.patchValue({
                feedback: evaluation.feedback
              });
            }
            this.notificationService.showInfo(evaluation.isComplete ? 'Viewing completed evaluation' : 'Updating existing evaluation');
          }
          this.loading = false;
        } else {
          this.notificationService.showInfo('Starting new evaluation');
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Error loading existing evaluation:', error);
        this.notificationService.showInfo('Starting new evaluation');
        this.loading = false;
      }
    });
  }
  
  onSubmit(): void {
    if (this.evaluationForm.invalid) {
      // Show specific validation errors
      let errorMessage = 'Please fix the following issues:';
      if (this.evaluationForm.get('feedback')?.invalid) {
        errorMessage += '\n- Feedback is required';
      }
      
      if (!this.isRubricEvaluation && this.evaluationForm.get('obtainedMarks')?.invalid) {
        errorMessage += '\n- Valid score is required';
      }
      
      if (this.isRubricEvaluation && this.rubric) {
        let missingCategories: string[] = [];
        
        this.rubric.categories.forEach((category: RubricCategory) => {
          if (this.evaluationForm.get(`category_${category.id}`)?.invalid) {
            missingCategories.push(category.name);
          }
        });
        
        if (missingCategories.length > 0) {
          errorMessage += `\n- Missing scores for: ${missingCategories.join(', ')}`;
        }
      }
      
      this.notificationService.showWarning(errorMessage);
      return;
    }
    
    this.submitting = true;
    
    // Prepare evaluation data based on evaluation type
    const evaluationDto: EvaluateStudentDto = {
      groupEvaluationId: this.groupEvaluationId, // Use groupEvaluationId instead of groupId
      studentId: this.studentId,
      feedback: this.evaluationForm.value.feedback
    };
    
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
    } else {
      // For simple evaluation, just use the obtainedMarks
      evaluationDto.obtainedMarks = this.evaluationForm.value.obtainedMarks;
      
      console.log("Submitting simple evaluation:", evaluationDto);
      
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
    if (!this.rubric || !this.rubric.categories) return [];
    
    return this.rubric.categories.map((category: RubricCategory) => ({
      categoryId: category.id,
      score: this.evaluationForm.value[`category_${category.id}`],
      feedback: this.evaluationForm.value[`feedback_${category.id}`] || ''
    }));
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
