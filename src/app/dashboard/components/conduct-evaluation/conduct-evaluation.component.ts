import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { EvaluationService } from '../../../services/evaluation.service';
import { EventService } from '../../../services/event.service';
import { RubricService, Rubric } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { StudentService } from '../../../services/student.service';
import { StudentEvaluation } from '../../../models/evaluation.model';
// Import EvaluationEvent directly from the model
import { EvaluationEvent } from '../../../models/event.model';

// Add this interface near the top of the file
interface EvaluateStudentDto {
  groupEvaluationId: number;
  studentId: number;
  score?: number;
  criteriaScores?: any[];
  comments: string;
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
  teacherId: number = 0; // Initialize with a default value
  
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
        
        // Check for existing evaluation - change this line to match your service
        // Instead of:
        // this.evaluationService.getStudentEvaluation(this.eventId, this.studentId, this.teacherId)
        // Use:
        this.evaluationService.getStudentEvaluation(this.groupId, this.studentId).subscribe({
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
                // Handle rubric evaluation
                // ...
              }
            }
            
            this.loading = false;
          },
          error: (error) => {
            console.log('No existing evaluation found:', error);
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
      this.notificationService.showWarning('Please complete all required fields');
      return;
    }
    
    this.submitting = true;
    
    // Prepare evaluation data
    const evaluationDto: EvaluateStudentDto = {
      groupEvaluationId: this.groupId,
      studentId: this.studentId,
      score: this.isSimpleEvaluation ? this.evaluationForm.value.simpleScore : undefined,
      criteriaScores: !this.isSimpleEvaluation ? this.prepareCriteriaScores() : undefined,
      comments: this.evaluationForm.value.comments || ''
    };
    
    // Create the specific DTOs that the service methods expect
    if (this.isSimpleEvaluation) {
      const simpleDto = {
        eventId: this.eventId,
        studentId: this.studentId,
        teacherId: this.teacherId,
        score: evaluationDto.score || 0,
        comments: evaluationDto.comments
      };
      
      // Use submitEvaluation instead of submitSimpleEvaluation
      this.evaluationService.submitEvaluation(simpleDto).subscribe({
        next: (result: any) => { // Add explicit type
          this.notificationService.showSuccess('Evaluation submitted successfully');
          this.submitting = false;
          this.navigateBack();
        },
        error: (error: any) => { // Add explicit type
          console.error('Error submitting evaluation:', error);
          this.notificationService.showError('Failed to submit evaluation');
          this.submitting = false;
        }
      });
    } else {
      const rubricDto = {
        eventId: this.eventId,
        studentId: this.studentId,
        teacherId: this.teacherId,
        scores: this.prepareCriteriaScores().map(c => ({
          categoryId: c.criterionId,
          score: c.score,
          comments: c.comments || ''
        })),
        comments: evaluationDto.comments
      };
      
      this.evaluationService.submitRubricEvaluation(rubricDto).subscribe({
        next: (result: any) => { // Add explicit type
          this.notificationService.showSuccess('Evaluation submitted successfully');
          this.submitting = false;
          this.navigateBack();
        },
        error: (error: any) => { // Add explicit type
          console.error('Error submitting evaluation:', error);
          this.notificationService.showError('Failed to submit evaluation');
          this.submitting = false;
        }
      });
    }
  }
  
  // Helper method to format criteria scores 
  private prepareCriteriaScores(): any[] {
    if (!this.rubric) return [];
    
    return this.rubric.categories.map(criterion => ({
      criterionId: criterion.id,
      score: this.evaluationForm.value[`criterion_${criterion.id}`],
      comments: '' // Optional comments per criterion
    }));
  }
  
  navigateBack(): void {
    this.router.navigate(['/admin-dashboard/events', this.eventId, 'groups', this.groupId]);
  }
}
