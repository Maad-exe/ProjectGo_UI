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
  @Input() hasAnyGroups: boolean = false;
  @Output() groupCreated = new EventEmitter<void>();
  
  createGroupForm: FormGroup;
  showGroupForm = false;
  memberCount = 2;
  isSearchingStudent = false;
  studentSearchResults: { [email: string]: StudentDetails | null } = {};
  isCreatingGroup = false;
  groupCreationError: string | null = null;
  searchErrors: { [email: string]: string } = {};
  
  // Success state properties
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
    
    // Clear errors and search results when user starts typing
    this.clearErrorsForIndex(index);
    
    if (!email || !email.trim() || !this.emailPattern.test(email)) {
      return;
    }
    
    // Set a new timer to search after 500ms
    this.searchTimers[index] = setTimeout(() => {
      this.searchStudent(email, index);
    }, 500);
  }

  // Add new method to clear errors for a specific index
  private clearErrorsForIndex(index: number): void {
    const email = this.memberEmails.at(index).value;
    if (email) {
      delete this.searchErrors[email];
      delete this.studentSearchResults[email];
    }
  }

  async searchStudent(email: string, index: number) {
    if (!email || !email.trim()) {
      this.clearErrorsForIndex(index);
      return;
    }
    
    if (!this.emailPattern.test(email)) {
      this.clearErrorsForIndex(index);
      return;
    }

    this.isSearchingStudent = true;
    this.isSearchingMember[index] = true;
    
    // Clear previous errors for this email
    this.clearErrorsForIndex(index);
    
    try {
      console.log(`Searching for student with email: ${email}`);
      const student = await this.groupService.searchStudentByEmail(email).toPromise();
      console.log(`Search result for ${email}:`, student);
      
      if (student) {
        try {
          const isInSupervisedGroup = await this.checkIfStudentInSupervisedGroup(student.id);
          
          if (isInSupervisedGroup) {
            this.studentSearchResults[email] = null;
            this.searchErrors[email] = `${student.fullName} is already part of an approved group and cannot join your group.`;
          } else {
            // Student is valid - set the data and clear any errors
            this.studentSearchResults[email] = student;
            delete this.searchErrors[email];
          }
        } catch (supervisionError) {
          this.clearErrorsForIndex(index);
          this.searchErrors[email] = `Could not verify student's group status. Please try again.`;
        }
      } else {
        this.clearErrorsForIndex(index);
        this.searchErrors[email] = 'Student not found with this email address.';
      }
    } catch (error: any) {
      this.clearErrorsForIndex(index);
      if (error.error?.message) {
        this.searchErrors[email] = error.error.message;
      } else {
        this.searchErrors[email] = 'Failed to verify student. Please try again.';
      }
    } finally {
      this.isSearchingStudent = false;
      this.isSearchingMember[index] = false;
    }
  }

  // Clear the error for a specific email
  clearErrorForEmail(email: string): void {
    delete this.searchErrors[email];
  }

  hasSearchErrors(): boolean {
    // Only consider current form values
    const currentEmails = this.memberEmails.controls.map(control => control.value);
    return currentEmails.some(email => !!this.searchErrors[email]);
  }

  isAnyMemberSearching(): boolean {
    return this.isSearchingMember.some(status => status === true);
  }

  // Improved method to check if a student is in a supervised group
  async checkIfStudentInSupervisedGroup(studentId: number): Promise<boolean> {
    console.log(`Checking if student ${studentId} is in a supervised group...`);
    try {
      const response = await this.groupService.checkStudentSupervisionStatus(studentId).toPromise();
      console.log(`Supervision check response for student ${studentId}:`, response);
      
      // Explicit check for supervised status
      if (response && response.isInSupervisedGroup === true) {
        console.log(`Student ${studentId} is in supervised group: ${response.groupName || 'Unknown group'}`);
        return true;
      }
      
      // Even if the API returns false, let's do an additional check using the getStudentGroups API
      // This helps us overcome the 403 issue with the supervision status endpoint
      try {
        const groups = await this.groupService.getStudentGroups(studentId).toPromise();
        
        // Check if any of the student's groups is approved
        // Fix: Only call .some() if groups is defined and is an array
        const hasApprovedGroup = groups && Array.isArray(groups) && groups.some(group => 
          group.supervisionStatus === 'Approved' && group.teacherId != null
        );
        
        if (hasApprovedGroup) {
          console.log(`Student ${studentId} has an approved group based on groups check`);
          return true;
        }
      } catch (groupError) {
        console.error(`Cannot check student ${studentId} groups:`, groupError);
        // If we can't check groups, we'll rely on the original response
      }
      
      console.log(`Student ${studentId} is NOT in any supervised group`);
      return false;
    } catch (error: unknown) {
      console.error(`Error checking if student ${studentId} is in supervised group:`, error);
      
      // If we get a 403 error, we need to use an alternative approach
      if (typeof error === 'object' && error !== null) {
        const err = error as any;
        
        // Check for 403 Forbidden status
        if (err.status === 403) {
          console.log(`Got 403 when checking student ${studentId}, trying alternative approach...`);
          
          try {
            // Try to get the student's groups directly, which might have different permissions
            const groups = await this.groupService.getStudentGroups(studentId).toPromise();
            
            // Check if any of the groups is already approved
            // Fix: Only call .some() if groups is defined and is an array
            const hasApprovedGroup = groups && Array.isArray(groups) && groups.some(group => 
              group.supervisionStatus === 'Approved' && group.teacherId != null
            );
            
            if (hasApprovedGroup) {
              console.log(`Student ${studentId} has an approved group (alt check)`);
              return true;
            }
            
            console.log(`Student ${studentId} does not have an approved group (alt check)`);
            return false;
          } catch (altError) {
            console.error(`Alternative check failed for student ${studentId}:`, altError);
            // We couldn't determine either way, assume not in supervised group
            return false;
          }
        }
        
        // Check error messages for clues
        const errorMessage = err.message || (err.error && err.error.message);
        
        if (typeof errorMessage === 'string' && 
           (errorMessage.toLowerCase().includes('already in a supervised group') || 
            errorMessage.toLowerCase().includes('already has an approved group'))) {
          console.log(`Student ${studentId} appears to be in a supervised group based on error message`);
          return true; // Treat specific error messages as confirmation of supervised status
        }
      }
      
      // If we can't determine the status from the error, assume not in a supervised group
      // This will allow group creation, and the backend will provide the final validation
      return false;
    }
  }

  async createGroup() {
    // Reset form-level errors
    this.formErrors = [];
    this.groupCreationError = null;
    
    if (this.createGroupForm.valid) {
      // Get valid member emails
      const memberEmails = this.memberEmails.value.filter((email): email is string => 
        email !== null && email.trim() !== ''
      );
      
      console.log('Starting group creation with members:', memberEmails);
      console.log('Current student search results:', this.studentSearchResults);
      console.log('Current search errors:', this.searchErrors);
      
      // Check for duplicate emails
      const uniqueEmails = new Set(memberEmails);
      if (uniqueEmails.size < memberEmails.length) {
        this.formErrors.push('Duplicate email addresses found. Each member must have a unique email.');
        return;
      }
      
      // Check if all members have been verified
      const unverifiedMembers = memberEmails.filter(email => 
        !this.studentSearchResults[email] && !this.searchErrors[email]
      );
      
      // Force verification of any unverified members
      if (unverifiedMembers.length > 0) {
        this.formErrors.push('Some members have not been verified. Please wait for verification to complete.');
        
        // Trigger search for unverified members
        for (let i = 0; i < unverifiedMembers.length; i++) {
          const email = unverifiedMembers[i];
          const controlIndex = memberEmails.findIndex(e => e === email);
          if (controlIndex >= 0) {
            await this.searchStudent(email, controlIndex);
          }
        }
        
        return;
      }
      
      // FIX: More thorough check for members with errors or in supervised groups
      const invalidMembers = memberEmails.filter(email => 
        !this.studentSearchResults[email] || this.searchErrors[email]
      );
      
      if (invalidMembers.length > 0) {
        console.log('Invalid members found:', invalidMembers);
        console.log('Student search results for invalid members:', 
          invalidMembers.map(email => ({ email, result: this.studentSearchResults[email] })));
        console.log('Search errors for invalid members:', 
          invalidMembers.map(email => ({ email, error: this.searchErrors[email] })));
        
        for (const email of invalidMembers) {
          if (this.searchErrors[email]) {
            this.formErrors.push(this.searchErrors[email]);
          } else {
            this.formErrors.push(`Verification failed for ${email}`);
          }
        }
        return;
      }
      
      // FIX: Re-verify all students immediately before creating the group
      console.log('Re-checking supervised status for all members before creating group...');
      try {
        // Use Promise.all but with better error handling
        const supervisionCheckPromises = memberEmails.map(async (email) => {
          const student = this.studentSearchResults[email];
          if (!student) {
            // This shouldn't happen at this point, but just in case
            return { email, error: 'Student data not found' };
          }
          
          try {
            const isInSupervisedGroup = await this.checkIfStudentInSupervisedGroup(student.id);
            return { 
              email, 
              studentId: student.id,
              name: student.fullName,
              isInSupervisedGroup 
            };
          } catch (error) {
            return { 
              email, 
              studentId: student.id,
              name: student.fullName,
              error 
            };
          }
        });
        
        const supervisionResults = await Promise.all(supervisionCheckPromises);
        console.log('Final supervision check results:', supervisionResults);
        
        // Check for students in supervised groups or errors
        const problematicStudents = supervisionResults.filter(result => 
          result.isInSupervisedGroup === true || result.error
        );
        
        if (problematicStudents.length > 0) {
          console.log('Found problematic students during final check:', problematicStudents);
          
          // Update search results and errors based on re-verification
          for (const result of problematicStudents) {
            if (result.isInSupervisedGroup) {
              this.studentSearchResults[result.email] = null;
              this.searchErrors[result.email] = `${result.name} is already part of an approved group and cannot join your group.`;
              this.formErrors.push(this.searchErrors[result.email]);
            } else if (result.error) {
              this.studentSearchResults[result.email] = null;
              this.searchErrors[result.email] = `Could not verify if ${result.name} is in another group. Please try again.`;
              this.formErrors.push(this.searchErrors[result.email]);
            }
          }
          
          return; // Stop the group creation
        }
      } catch (error) {
        console.error('Error in final supervision check:', error);
        this.formErrors.push('Error verifying student supervision status. Please try again.');
        return;
      }
      
      // If we get here, all members have been verified and are not in supervised groups
      console.log('All members verified successfully, creating group...');
      this.isCreatingGroup = true;
  
      const createGroupRequest: CreateGroupRequest = {
        groupName: this.createGroupForm.value.groupName || '',
        memberEmails: memberEmails
      };
  
      try {
        const createdGroup = await this.groupService.createGroup(createGroupRequest).toPromise();
        console.log('Group created successfully:', createdGroup);
        
        // Set success state
        this.groupCreationSuccess = true;
        this.createdGroupName = createGroupRequest.groupName;
        this.hasAnyGroups = true;
        
        // Allow time for the success message to be shown
        setTimeout(() => {
          this.showGroupForm = false;
          this.resetForm();
          // Emit event for parent component to refresh groups
          this.groupCreated.emit();
        }, 2000);
        
        this.notificationService.showSuccess('Group created successfully');
      } catch (error: any) {
        // Handle API errors
        console.error('Group creation failed:', error);
        
        // FIX: Better error extraction and handling
        if (error.error?.message) {
          const errorMessage = error.error.message.toLowerCase();
          
          // Check for supervised group errors
          if (errorMessage.includes('supervised group') || 
              errorMessage.includes('approved group')) {
            
            this.groupCreationError = 'One or more students are already in approved groups and cannot join this group.';
            
            // Try to extract student information from the error
            const emailMatch = error.error.message.match(/email:\s*([^\s]+@[^\s]+)/i);
            if (emailMatch && emailMatch[1]) {
              const email = emailMatch[1];
              if (memberEmails.includes(email)) {
                this.studentSearchResults[email] = null;
                this.searchErrors[email] = 'This student is already part of an approved group.';
                this.formErrors.push(this.searchErrors[email]);
              }
            }
          } else {
            this.groupCreationError = error.error.message;
          }
        } else {
          this.groupCreationError = 'Failed to create group. Please try again.';
        }
        
        // Handle validation errors
        if (error.error?.errors) {
          const errorDetails = error.error.errors;
          if (Array.isArray(errorDetails)) {
            this.formErrors = errorDetails;
          } else {
            this.formErrors = [];
            Object.values(errorDetails).forEach(item => {
              if (Array.isArray(item)) {
                this.formErrors.push(...item);
              } else if (item) {
                this.formErrors.push(String(item));
              }
            });
          }
        }
      } finally {
        this.isCreatingGroup = false;
      }
    } else {
      // Handle form validation errors
      if (!this.createGroupForm.get('groupName')?.valid) {
        this.formErrors.push('Group name is required');
      }
      
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