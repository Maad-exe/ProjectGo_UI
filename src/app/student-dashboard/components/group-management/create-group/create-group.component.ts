import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormControl, NonNullableFormBuilder } from '@angular/forms';
import { GroupService, StudentDetails, CreateGroupRequest } from '../../../../services/group.service';
import { NotificationService } from '../../../../services/notifications.service';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-group.component.html',
  styleUrls: ['./create-group.component.scss']
})
export class CreateGroupComponent implements OnInit {
  @Input() hasApprovedGroup: boolean = false;
  @Input() hasAnyGroups: boolean = false; // New input property
  @Output() groupCreated = new EventEmitter<void>();
  
  createGroupForm: FormGroup;
  showGroupForm = false;
  memberCount = 2;
  isSearchingStudent = false;
  studentSearchResults: { [email: string]: StudentDetails | null } = {};
  isCreatingGroup = false;
  groupCreationError: string | null = null;
  searchErrors: { [email: string]: string } = {};
  
  // Add properties for success state
  groupCreationSuccess = false;
  createdGroupName: string = '';

  formErrors: string[] = [];
  isSearchingMember: boolean[] = [];
  searchTimers: any[] = [];
  emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  constructor(
    private fb: NonNullableFormBuilder,
    private groupService: GroupService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {
    this.createGroupForm = this.fb.group({
      groupName: ['', Validators.required],
      memberCount: [2, [Validators.required, Validators.min(2), Validators.max(4)]],
      memberEmails: this.fb.array<string>([])
    });
  }

  ngOnInit() {
    this.resetForm();
    
    // Subscribe to group changes to update hasAnyGroups
    this.groupService.groupsRefresh$.subscribe(() => {
      console.log('Groups refresh event received, checking for groups...');
      this.checkForGroups();
    });
    
    // Initial check for groups
    this.checkForGroups();
  }
  
  // Method to check if user has any groups
  private checkForGroups() {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = this.authService.decodeToken(token);
      const studentId = payload.UserId;
      
      this.groupService.getStudentGroups(studentId).subscribe({
        next: (groups) => {
          this.hasAnyGroups = groups.length > 0;
          console.log('Create Group Component - Has any groups:', this.hasAnyGroups, 'Groups count:', groups.length);
        },
        error: (error) => {
          console.error('Failed to check for student groups:', error);
        }
      });
    }
  }

  get memberEmails(): FormArray<FormControl<string>> {
    return this.createGroupForm.get('memberEmails') as FormArray<FormControl<string>>;
  }

  showCreateGroupForm() {
    // Check if the student already has an approved group
    if (this.hasApprovedGroup) {
      this.notificationService.showInfo('You already have a group with approved supervision. You cannot create more groups.');
      return;
    }
    
    this.showGroupForm = true;
    this.groupCreationSuccess = false;
    this.resetForm();
  }

  resetForm() {
    this.createGroupForm.reset({
      groupName: '',
      memberCount: 2
    });
    this.memberEmails.clear();
    this.formErrors = [];
    this.isSearchingMember = [];
    this.searchTimers.forEach(timer => clearTimeout(timer));
    this.searchTimers = [];
    
    for (let i = 0; i < this.memberCount; i++) {
      this.memberEmails.push(this.fb.control('', [Validators.required, Validators.email]));
      this.isSearchingMember.push(false);
      this.searchTimers.push(null);
    }
    
    this.studentSearchResults = {};
    this.searchErrors = {};
    this.groupCreationError = null;
  }

  onMemberCountChange() {
    this.memberCount = this.createGroupForm.get('memberCount')?.value || 2;
    this.memberEmails.clear();
    this.isSearchingMember = [];
    this.searchTimers.forEach(timer => clearTimeout(timer));
    this.searchTimers = [];
    
    for (let i = 0; i < this.memberCount; i++) {
      this.memberEmails.push(this.fb.control('', [Validators.required, Validators.email]));
      this.isSearchingMember.push(false);
      this.searchTimers.push(null);
    }
  }

  autoSearchStudent(email: string, index: number) {
    // Clear any existing timer for this index
    if (this.searchTimers[index]) {
      clearTimeout(this.searchTimers[index]);
    }
    
    if (!email || !email.trim() || !this.emailPattern.test(email)) {
      return;
    }
    
    // Set a new timer to search after 500ms
    this.searchTimers[index] = setTimeout(() => {
      this.searchStudent(email, index);
    }, 500);
  }

  async searchStudent(email: string, index: number) {
    if (!email || !email.trim()) {
      this.searchErrors[email] = 'Please enter an email address';
      return;
    }
    
    if (!this.emailPattern.test(email)) {
      this.searchErrors[email] = 'Please enter a valid email address';
      return;
    }
  
    this.isSearchingStudent = true;
    this.isSearchingMember[index] = true;
    this.searchErrors[email] = '';
    
    try {
      const student = await this.groupService.searchStudentByEmail(email).toPromise();
      
      // If student is found, check if they're already in a supervised group
      if (student) {
        const isInSupervisedGroup = await this.checkIfStudentInSupervisedGroup(student.id);
        
        if (isInSupervisedGroup) {
          this.studentSearchResults[email] = null;
          this.searchErrors[email] = `${student.fullName} is already part of an approved group and cannot join your group.`;
          return;
        }
      }
      
      this.studentSearchResults[email] = student || null;
      
      if (!student) {
        this.searchErrors[email] = 'Student not found with this email address.';
      }
    } catch (error: any) {
      this.studentSearchResults[email] = null;
      this.searchErrors[email] = error.error?.message || 'Student not found. Please check the email and try again.';
    } finally {
      this.isSearchingStudent = false;
      this.isSearchingMember[index] = false;
    }
  }

  hasSearchErrors(): boolean {
    return Object.keys(this.searchErrors).some(key => this.searchErrors[key]);
  }

  isAnyMemberSearching(): boolean {
    return this.isSearchingMember.some(status => status === true);
  }

  async createGroup() {
    // Reset form-level errors
    this.formErrors = [];
    
    if (this.createGroupForm.valid) {
      // Get valid member emails
      const memberEmails = this.memberEmails.value.filter((email): email is string => 
        email !== null && email.trim() !== ''
      );
      
      // Check if all members have been verified
      const unverifiedMembers = memberEmails.filter(email => 
        !this.studentSearchResults[email]
      );
      
      // Check for duplicate emails
      const uniqueEmails = new Set(memberEmails);
      if (uniqueEmails.size < memberEmails.length) {
        this.formErrors.push('Duplicate email addresses found. Each member must have a unique email.');
        return;
      }
      
      // Auto-search any unverified members
      if (unverifiedMembers.length > 0) {
        this.formErrors.push('Some members have not been verified. Please wait for verification to complete.');
        
        // Trigger search for unverified members
        unverifiedMembers.forEach((email, arrayIndex) => {
          const controlIndex = memberEmails.findIndex(e => e === email);
          if (controlIndex >= 0 && !this.isSearchingMember[controlIndex]) {
            this.searchStudent(email, controlIndex);
          }
        });
        
        return;
      }
      
      // Check for members with errors
      const membersWithErrors = memberEmails.filter(email => this.searchErrors[email]);
      
      if (membersWithErrors.length > 0) {
        // Create a more detailed error message
        membersWithErrors.forEach(email => {
          const error = this.searchErrors[email];
          this.formErrors.push(error);
        });
        
        return;
      }
      
      this.isCreatingGroup = true;
      this.groupCreationError = null;
  
      const createGroupRequest: CreateGroupRequest = {
        groupName: this.createGroupForm.value.groupName || '',
        memberEmails: memberEmails
      };
  
      try {
        const createdGroup = await this.groupService.createGroup(createGroupRequest).toPromise();
        console.log('Group created successfully:', createdGroup);
        
        // Set success state instead of hiding form immediately
        this.groupCreationSuccess = true;
        this.createdGroupName = createGroupRequest.groupName;
        this.hasAnyGroups = true; // Important - set this to true now
        
        // Allow time for the success message to be shown
        setTimeout(() => {
          this.showGroupForm = false;
          this.resetForm();
          // Emit event for parent component to refresh groups
          this.groupCreated.emit();
        }, 2000);
        
        this.notificationService.showSuccess('Group created successfully');
      } catch (error: any) {
        console.error('Group creation failed:', error);
        this.groupCreationError = error.error?.message || 'Failed to create group';
        
        // If there are validation errors in the response
        if (error.error?.errors) {
          const errorDetails = error.error.errors;
          if (Array.isArray(errorDetails)) {
            this.formErrors = errorDetails;
          } else {
            // Create a flattened array without using flat()
            this.formErrors = [];
            const values = Object.values(errorDetails);
            for (const item of values) {
              if (Array.isArray(item)) {
                this.formErrors.push(...item);
              } else {
                this.formErrors.push(String(item));
              }
            }
          }
        }
      } finally {
        this.isCreatingGroup = false;
      }
    } else {
      // Handle validation errors
      Object.keys(this.createGroupForm.controls).forEach(key => {
        const control = this.createGroupForm.get(key);
        if (control?.invalid) {
          if (key === 'groupName' && control.errors?.['required']) {
            this.formErrors.push('Group name is required');
          }
        }
      });
      
      // Check member email validation
      this.memberEmails.controls.forEach((control, i) => {
        if (control.invalid) {
          if (control.errors?.['required']) {
            this.formErrors.push(`Member ${i + 1} email is required`);
          } else if (control.errors?.['email']) {
            this.formErrors.push(`Member ${i + 1} email is invalid`);
          }
        }
      });
      
      // Mark all fields as touched to trigger validation visuals
      this.createGroupForm.markAllAsTouched();
    }
  }

  async checkIfStudentInSupervisedGroup(studentId: number): Promise<boolean> {
    try {
      const response = await this.groupService.checkStudentSupervisionStatus(studentId).toPromise();
      return response?.isInSupervisedGroup ?? false; // Use nullish coalescing
    } catch (error) {
      console.error('Error checking if student is in supervised group:', error);
      return false; // Assume not in a supervised group if there's an error
    }
  }

  cancelGroupCreation() {
    this.showGroupForm = false;
    this.resetForm();
  }
  
  // Method to create a new group after success message
  createAnotherGroup() {
    this.groupCreationSuccess = false;
    this.resetForm();
  }
}