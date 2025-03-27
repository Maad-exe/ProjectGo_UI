import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluationService } from '../../../services/evaluation.service';
import { EventService, EvaluationEvent } from '../../../services/event.service';
import { RubricService, Rubric } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { StudentService } from '../../../services/student.service';
import { StudentEvaluation } from '../../../models/evaluation.model';

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
  
  event: EvaluationEvent | null = null;
  rubric: Rubric | null = null;
  studentInfo: any = null;
  existingEvaluation: StudentEvaluation | null = null;
  
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
    private notificationService: NotificationService
  ) {
    this.eventId = +this.route.snapshot.params['eventId'];
    this.groupId = +this.route.snapshot.params['groupId'];
    this.studentId = +this.route.snapshot.params['studentId'];
    
    // Initialize the form with default values
    this.evaluationForm = this.fb.group({
      simpleScore: [0, [Validators.required, Validators.min(0)]],
      comments: [''],
      rubricScores: this.fb.array([])
    });
    
    // Get teacher ID from auth service or token
    const token = localStorage.getItem('token');
    if (token) {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      this.teacherId = tokenData.UserId || tokenData.uid;
    }
  }
  
  ngOnInit(): void {
    this.loadData();
  }
  
  get rubricScores(): FormArray {
    return this.evaluationForm.get('rubricScores') as FormArray;
  }
  
  loadData(): void {
    this.loading = true;
    
    // Load event details
    this.eventService.getEventById(this.eventId).subscribe({
      next: (event) => {
        this.event = event;
        this.isSimpleEvaluation = !event.rubricId;
        
        // If using a rubric, load it
        if (event.rubricId) {
          this.rubricService.getRubricById(event.rubricId).subscribe({
            next: (rubric) => {
              this.rubric = rubric;
              
              // Initialize form controls for each rubric category
              this.rubric.categories.forEach(category => {
                this.rubricScores.push(
                  this.fb.group({
                    categoryId: [category.id],
                    score: [0, [Validators.required, Validators.min(0), Validators.max(category.maxScore)]],
                    comments: ['']
                  })
                );
              });
              
              this.loadStudentAndExistingEvaluation();
            },
            error: (error) => {
              console.error('Error loading rubric:', error);
              this.notificationService.showError('Failed to load rubric details');
              this.loading = false;
            }
          });
        } else {
          // Simple evaluation
          this.evaluationForm.get('simpleScore')?.setValidators([
            Validators.required, 
            Validators.min(0), 
            Validators.max(event.totalMarks)
          ]);
          this.evaluationForm.get('simpleScore')?.updateValueAndValidity();
          
          this.loadStudentAndExistingEvaluation();
        }
      },
      error: (error) => {
        console.error('Error loading event:', error);
        this.notificationService.showError('Failed to load event details');
        this.loading = false;
      }
    });
  }
  
  loadStudentAndExistingEvaluation(): void {
    // Load student details
    this.studentService.getStudentById(this.studentId).subscribe({
      next: (student) => {
        this.studentInfo = student;
        
        // Check for existing evaluation
        this.evaluationService.getStudentEvaluation(this.eventId, this.studentId, this.teacherId).subscribe({
          next: (evaluation) => {
            this.existingEvaluation = evaluation;
            
            // Fill form with existing evaluation data
            if (this.existingEvaluation) {
              if (this.isSimpleEvaluation) {
                this.evaluationForm.patchValue({
                  simpleScore: this.existingEvaluation.totalScore,
                  comments: this.existingEvaluation.comments
                });
              } else {
                // For rubric-based evaluation
                this.evaluationForm.patchValue({
                  comments: this.existingEvaluation.comments
                });
                
                // Fill each category's score if available
                if (this.existingEvaluation.scores && this.existingEvaluation.scores.length > 0) {
                  this.existingEvaluation.scores.forEach(score => {
                    const index = this.rubric?.categories.findIndex(c => c.id === score.categoryId);
                    if (index !== undefined && index >= 0) {
                      this.rubricScores.at(index).patchValue({
                        score: score.score,
                        comments: score.comments
                      });
                    }
                  });
                }
              }
            }
            
            this.loading = false;
          },
          error: (error) => {
            console.error('No existing evaluation found:', error);
            // This is not a critical error - just means no previous evaluation exists
            this.loading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error loading student details:', error);
        this.notificationService.showError('Failed to load student details');
        this.loading = false;
      }
    });
  }
  
  calculateTotalScore(): number {
    if (!this.rubric) return 0;
    
    let totalScore = 0;
    let totalWeight = 0;
    
    this.rubric.categories.forEach((category, index) => {
      const scoreControl = this.rubricScores.at(index).get('score');
      if (scoreControl && scoreControl.value !== null) {
        const percentage = (scoreControl.value / category.maxScore) * 100;
        totalScore += (percentage * category.weight) / 100;
        totalWeight += category.weight;
      }
    });
    
    // If weights don't add up to 100%, adjust the calculation
    if (totalWeight > 0 && totalWeight !== 100) {
      totalScore = (totalScore * 100) / totalWeight;
    }
    
    // Convert to event's total marks
    return (totalScore / 100) * (this.event?.totalMarks || 100);
  }
  
  onSubmit(): void {
    if (this.evaluationForm.invalid) {
      this.evaluationForm.markAllAsTouched();
      this.notificationService.showError('Please correct all errors before submitting.');
      return;
    }
    
    this.submitting = true;
    
    if (this.isSimpleEvaluation) {
      // Simple evaluation
      const evaluationData = {
        eventId: this.eventId,
        studentId: this.studentId,
        teacherId: this.teacherId,
        score: this.evaluationForm.value.simpleScore,
        comments: this.evaluationForm.value.comments || ''
      };
      
      this.evaluationService.submitSimpleEvaluation(evaluationData).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Evaluation submitted successfully');
          this.navigateBack();
        },
        error: (error) => {
          console.error('Error submitting evaluation:', error);
          this.notificationService.showError('Failed to submit evaluation');
          this.submitting = false;
        }
      });
    } else {
      // Rubric-based evaluation
      const evaluationData = {
        eventId: this.eventId,
        studentId: this.studentId,
        teacherId: this.teacherId,
        scores: this.evaluationForm.value.rubricScores,
        comments: this.evaluationForm.value.comments || ''
      };
      
      this.evaluationService.submitRubricEvaluation(evaluationData).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Evaluation submitted successfully');
          this.navigateBack();
        },
        error: (error) => {
          console.error('Error submitting rubric evaluation:', error);
          this.notificationService.showError('Failed to submit evaluation');
          this.submitting = false;
        }
      });
    }
  }
  
  navigateBack(): void {
    this.router.navigate(['/admin-dashboard/events', this.eventId, 'groups', this.groupId]);
  }
}
