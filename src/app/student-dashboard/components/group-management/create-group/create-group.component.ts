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
  @Output() groupCreated = new EventEmitter<void>();
  
  createGroupForm: FormGroup;
  showGroupForm = false;
  memberCount = 2;
  isSearchingStudent = false;
  studentSearchResults: { [email: string]: StudentDetails | null } = {};
  isCreatingGroup = false;
  groupCreationError: string | null = null;
  searchErrors: { [email: string]: string } = {};

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
    this.resetForm();
  }

  resetForm() {
    this.createGroupForm.reset({
      groupName: '',
      memberCount: 2
    });
    this.memberEmails.clear();
    for (let i = 0; i < this.memberCount; i++) {
      this.memberEmails.push(this.fb.control('', [Validators.required, Validators.email]));
    }
    this.studentSearchResults = {};
    this.searchErrors = {};
    this.groupCreationError = null;
  }

  onMemberCountChange() {
    this.memberCount = this.createGroupForm.get('memberCount')?.value || 2;
    this.memberEmails.clear();
    for (let i = 0; i < this.memberCount; i++) {
      this.memberEmails.push(this.fb.control('', [Validators.required, Validators.email]));
    }
  }

  async searchStudent(email: string, index: number) {
    if (!email || !email.trim()) {
      this.searchErrors[email] = 'Please enter an email address';
      return;
    }
  
    this.isSearchingStudent = true;
    this.searchErrors[email] = '';
    try {
      const student = await this.groupService.searchStudentByEmail(email).toPromise();
      
      // If student is found, check if they're already in a supervised group
      if (student) {
        const isInSupervisedGroup = await this.checkIfStudentInSupervisedGroup(student.id);
        
        if (isInSupervisedGroup) {
          this.studentSearchResults[email] = null;
          this.searchErrors[email] = `${student.fullName} is already part of an approved group and cannot join another group`;
          return;
        }
      }
      
      this.studentSearchResults[email] = student || null;
    } catch (error: any) {
      this.studentSearchResults[email] = null;
      this.searchErrors[email] = error.error?.message || 'Student not found';
    } finally {
      this.isSearchingStudent = false;
    }
  }

  async createGroup() {
    if (this.createGroupForm.valid) {
      // First check if all student searches were successful and none are in supervised groups
      const memberEmails = this.memberEmails.value.filter((email): email is string => email !== null);
      
       // Check specifically which members have errors
      const membersWithErrors = memberEmails.filter(email => 
        !this.studentSearchResults[email] || this.searchErrors[email]
      );
      
      if (membersWithErrors.length > 0) {
        // Create a more informative error message listing problematic members
        const errorMessages = membersWithErrors.map(email => {
          const error = this.searchErrors[email];
          if (error && error.includes('already part of an approved group')) {
            return `${email} is already part of an approved group and cannot join another group.`;
          }
          return `${email}: ${this.searchErrors[email] || 'Unknown error'}`;
        });
        
        this.groupCreationError = `Please resolve the following issues:\n${errorMessages.join('\n')}`;
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
        this.showGroupForm = false;
        this.resetForm();
        this.notificationService.showSuccess('Group created successfully');
        this.groupCreated.emit();
      } catch (error: any) {
        console.error('Group creation failed:', error);
        this.groupCreationError = error.error?.message || 'Failed to create group';
      } finally {
        this.isCreatingGroup = false;
      }
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
}