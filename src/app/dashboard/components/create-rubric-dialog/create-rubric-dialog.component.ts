import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  FormBuilder, 
  FormGroup, 
  FormArray, 
  ReactiveFormsModule, 
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { RubricService } from '../../../services/rubric.service';
import { NotificationService } from '../../../services/notifications.service';
import { Rubric } from '../../../models/rubric.model';

@Component({
  selector: 'app-create-rubric-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './create-rubric-dialog.component.html',
  styleUrls: ['./create-rubric-dialog.component.scss']
})
export class CreateRubricDialogComponent implements OnInit {
  rubricForm!: FormGroup;
  isEditing = false;
  loading = false;
  weightSumError = false;
  weightSum = 0;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreateRubricDialogComponent>,
    private rubricService: RubricService,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: { rubric: Rubric } = { rubric: null as any }
  ) { }

  ngOnInit(): void {
    this.initForm();
    
    if (this.data?.rubric) {
      this.isEditing = true;
      this.populateForm(this.data.rubric);
    } else {
      // Add default first category
      this.addCategory();
    }
    
    // Monitor weight changes to validate sum
    this.categories.valueChanges.subscribe(() => {
      this.updateWeightSum();
    });
  }

  initForm(): void {
    this.rubricForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      categories: this.fb.array([], [this.validateCategoriesLength])
    });
  }

  populateForm(rubric: Rubric): void {
    this.rubricForm.patchValue({
      name: rubric.name,
      description: rubric.description,
    });
    
    // Clear any existing categories
    while (this.categories.length) {
      this.categories.removeAt(0);
    }
    
    // Add existing categories
    rubric.categories.forEach(category => {
      // Convert weight to percentage for display if stored as decimal
      const displayWeight = category.weight <= 1 ? category.weight * 100 : category.weight;
      
      this.categories.push(this.fb.group({
        id: [category.id],
        name: [category.name, [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
        description: [category.description || ''],
        weight: [displayWeight, [Validators.required, Validators.min(1), Validators.max(100)]],
        maxScore: [category.maxScore, [Validators.required, Validators.min(1), Validators.max(100)]]
      }));
    });
    
    this.updateWeightSum();
  }

  // Getter for categories FormArray
  get categories(): FormArray {
    return this.rubricForm.get('categories') as FormArray;
  }
  
  addCategory(): void {
    const newCategory = this.fb.group({
      id: [null],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      description: [''],
      weight: [0, [Validators.required, Validators.min(1), Validators.max(100)]],
      maxScore: [10, [Validators.required, Validators.min(1), Validators.max(100)]]
    });
    
    this.categories.push(newCategory);
    this.updateWeightSum();
  }
  
  removeCategory(index: number): void {
    // Don't allow removing if there's only one category
    if (this.categories.length > 1) {
      this.categories.removeAt(index);
      this.updateWeightSum();
    }
  }
  
  updateWeightSum(): void {
    if (this.categories.length === 0) {
      this.weightSum = 0;
      this.weightSumError = true;
      return;
    }
    
    this.weightSum = 0;
    const values = this.categories.getRawValue();
    
    values.forEach(category => {
      if (category.weight) {
        this.weightSum += Number(category.weight);
      }
    });
    
    // Round to handle floating point precision issues
    this.weightSum = Math.round(this.weightSum * 100) / 100;
    this.weightSumError = Math.abs(this.weightSum - 100) > 1;
  }
  
  validateCategoriesLength(control: AbstractControl): ValidationErrors | null {
    const categories = control as FormArray;
    return categories.length >= 1 ? null : { noCategoriesError: true };
  }

  onSubmit(): void {
    if (this.rubricForm.invalid) {
      // Mark all fields as touched to trigger validation UI
      this.markFormGroupTouched(this.rubricForm);
      this.notificationService.showError('Please fix the errors in the form');
      return;
    }
    
    if (this.weightSumError) {
      this.notificationService.showError('Category weights must sum to 100%');
      return;
    }
    
    this.loading = true;
    const formValue = this.rubricForm.value;
    
    if (this.isEditing && this.data?.rubric?.id) { // Add a check for id existence
      const updateDto = {
        id: this.data.rubric.id, // This is now guaranteed to be a number
        name: formValue.name,
        description: formValue.description,
        categories: formValue.categories,
        // Provide a default value of false if isActive is undefined
        isActive: this.data.rubric.isActive !== undefined ? this.data.rubric.isActive : false
      };
      
      this.rubricService.updateRubric(updateDto).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Rubric updated successfully');
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.loading = false;
          this.notificationService.showError(error.message);
        }
      });
    } else {
      const createDto = {
        name: formValue.name,
        description: formValue.description,
        categories: formValue.categories
      };
      
      this.rubricService.createRubric(createDto).subscribe({
        next: (response) => {
          this.notificationService.showSuccess('Rubric created successfully');
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.loading = false;
          this.notificationService.showError(error.message);
        }
      });
    }
  }
  
  // Helper method to mark all controls as touched
  private markFormGroupTouched(formGroup: FormGroup | FormArray) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      
      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      } else {
        control?.markAsTouched();
      }
    });
  }
}
