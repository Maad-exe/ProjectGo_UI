import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluationService } from '../../../services/evaluation.service';
import { EventService } from '../../../services/event.service';
import { RubricService } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { StudentService } from '../../../services/student.service';
import { AuthService } from '../../../services/auth.service';

// Define interfaces locally to match what we need in this component
interface RubricCriterion {
  id: number;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
}

interface LocalRubric {
  id: number;
  name: string;
  description: string;
  categories: RubricCriterion[];
}

@Component({
  selector: 'app-conduct-evaluation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './conduct-evaluation.component.html',
  styleUrls: ['./conduct-evaluation.component.scss']
})
export class ConductEvaluationComponent implements OnInit {
  eventId: number;
  groupId: number;
  studentId: number;
  teacherId: number;
  
  event: any = null;
  rubric: LocalRubric | null = null;
  studentInfo: any = null;
  existingEvaluation: any = null;
  
  evaluationForm: FormGroup;
  isSimpleEvaluation: boolean = true;
  
  loading = true;
  submitting = false;
  
  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private rubricService: RubricService,
    private evaluationService: EvaluationService,
    private studentService: StudentService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    this.eventId = +this.route.snapshot.paramMap.get('eventId')!;
    this.groupId = +this.route.snapshot.paramMap.get('groupId')!;
    this.studentId = +this.route.snapshot.paramMap.get('studentId')!;
    this.teacherId = this.authService.getUserId() || 0;

    this.evaluationForm = this.fb.group({
      score: [null, [Validators.required, Validators.min(0), Validators.max(100)]],
      comments: ['', Validators.maxLength(1000)]
    });
  }

  ngOnInit(): void {
    this.loadEventDetails();
  }
  
  loadEventDetails(): void {
    this.loading = true;
    this.eventService.getEventById(this.eventId).subscribe({
      next: (event) => {
        this.event = event;
        
        // If the event uses a rubric, load it
        if (event.rubricId) {
          this.isSimpleEvaluation = false;
          this.loadRubric(event.rubricId);
        } else {
          // Simple evaluation, no need for rubric
          this.loadStudentAndExistingEvaluation();
        }
      },
      error: (error: any) => {
        console.error('Error loading event details:', error);
        this.notificationService.showError('Failed to load evaluation details');
        this.loading = false;
      }
    });
  }
  
  loadRubric(rubricId: number): void {
    this.rubricService.getRubricById(rubricId).subscribe({
      next: (rubric) => {
        // Map the rubric to our local structure, ensuring description is present
        this.rubric = {
          id: rubric.id,
          name: rubric.name,
          description: rubric.description,
          categories: rubric.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            weight: cat.weight,
            maxScore: cat.maxScore,
            // Check if description exists on the category object, otherwise provide an empty string
            description: (cat as any).description || '' // Type assertion to avoid compile-time errors
          }))
        };
        
        // Add form controls for each criterion
        if (this.rubric.categories && this.rubric.categories.length > 0) {
          const criteriaControls: any = {};
          
          this.rubric.categories.forEach((criterion: any) => {
            criteriaControls[`criterion_${criterion.id}`] = [null, [
              Validators.required, 
              Validators.min(0), 
              Validators.max(criterion.maxScore)
            ]];
          });
          
          // Add criteria controls to form
          Object.keys(criteriaControls).forEach(key => {
            this.evaluationForm.addControl(key, criteriaControls[key]);
          });
        }
        
        this.loadStudentAndExistingEvaluation();
      },
      error: (error: any) => {
        console.error('Error loading rubric:', error);
        this.notificationService.showError('Failed to load evaluation rubric');
        this.loading = false;
      }
    });
  }
  
  loadStudentAndExistingEvaluation(): void {
    // Load student details
    this.studentService.getStudentById(this.studentId).subscribe({
      next: (student) => {
        this.studentInfo = student;
        
        // Check if there's an existing evaluation
        this.evaluationService.getStudentEvaluation(
          this.eventId, 
          this.studentId,
          this.teacherId
        ).subscribe({
          next: (evaluation: any) => {
            this.existingEvaluation = evaluation;
            
            // Populate form with existing evaluation data
            if (this.isSimpleEvaluation) {
              this.evaluationForm.patchValue({
                score: evaluation.score,
                comments: evaluation.comments
              });
            } else if (this.rubric) {
              // Populate rubric criteria scores
              evaluation.criteriaScores?.forEach((criteriaScore: any) => {
                this.evaluationForm.patchValue({
                  [`criterion_${criteriaScore.criterionId}`]: criteriaScore.score
                });
              });
              
              this.evaluationForm.patchValue({
                comments: evaluation.comments
              });
            }
            
            this.loading = false;
          },
          error: (error: any) => {
            console.error('No existing evaluation found:', error);
            // This is not a critical error - just means no previous evaluation exists
            this.loading = false;
          }
        });
      },
      error: (error: any) => {
        console.error('Error loading student details:', error);
        this.notificationService.showError('Failed to load student details');
        this.loading = false;
      }
    });
  }
  
  onSubmit(): void {
    if (this.evaluationForm.invalid) {
      this.notificationService.showWarning('Please complete all required fields');
      return;
    }
    
    this.submitting = true;
    
    // Prepare evaluation data
    let evaluationData: any = {
      eventId: this.eventId,
      groupId: this.groupId,
      studentId: this.studentId,
      teacherId: this.teacherId,
      comments: this.evaluationForm.value.comments || ''
    };
    
    if (this.isSimpleEvaluation) {
      // Simple score-based evaluation
      evaluationData.score = this.evaluationForm.value.score;
    } else if (this.rubric) {
      // Rubric-based evaluation
      const criteriaScores: any[] = [];
      
      this.rubric.categories.forEach((criterion: any) => {
        criteriaScores.push({
          criterionId: criterion.id,
          score: this.evaluationForm.value[`criterion_${criterion.id}`]
        });
      });
      
      evaluationData.criteriaScores = criteriaScores;
    }
    
    // Submit the evaluation
    this.evaluationService.submitEvaluation(evaluationData).subscribe({
      next: (result: any) => {
        this.notificationService.showSuccess('Evaluation submitted successfully');
        this.submitting = false;
        this.navigateBack();
      },
      error: (error: any) => {
        console.error('Error creating evaluation:', error);
        this.notificationService.showError('Failed to submit evaluation');
        this.submitting = false;
      }
    });
  }
  
  navigateBack(): void {
    this.router.navigate(['/teacher-dashboard'], { queryParams: { view: 'evaluations' } });
  }
  
  calculateTotalScore(): number {
    if (this.isSimpleEvaluation) {
      return this.evaluationForm.value.score || 0;
    }
    
    if (!this.rubric) return 0;
    
    let total = 0;
    this.rubric.categories.forEach((criterion: any) => {
      const score = this.evaluationForm.value[`criterion_${criterion.id}`] || 0;
      total += score;
    });
    
    return total;
  }
  
  calculateMaxScore(): number {
    if (this.isSimpleEvaluation) {
      return 100;
    }
    
    if (!this.rubric) return 0;
    
    let max = 0;
    this.rubric.categories.forEach((criterion: any) => {
      max += criterion.maxScore;
    });
    
    return max;
  }
}
