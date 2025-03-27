import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TeacherService, TeacherDetails } from '../../../services/teacher.service';
import { PanelService } from '../../../services/panel.service';
import { NotificationService } from '../../../services/notifications.service';
import { Component, Inject, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

// Fix: Define properties as non-optional or make a new interface that doesn't extend TeacherDetails
interface TeacherWithWorkload {
  // Include all TeacherDetails properties
  id: number;
  fullName: string;
  email: string;
  qualification: string;
  areaOfSpecialization: string;
  officeLocation: string;
  // Add new workload properties
  assignedGroups: number;
  assignedPanels: number;
  workloadStatus: 'available' | 'active' | 'busy';
}

@Component({
  selector: 'app-create-panel-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule],
  templateUrl: './create-panel-dialog.component.html',
  styleUrls: ['./create-panel-dialog.component.scss']
})
export class CreatePanelDialogComponent implements OnInit, AfterViewInit {
  panelForm: FormGroup;
  teachers: TeacherWithWorkload[] = [];
  filteredTeachers: TeacherWithWorkload[] = [];
  loading = false;
  searchQuery = '';
  
  // For search input with debounce
  @ViewChild('searchInput') searchInput!: ElementRef;
  private searchTerms = new Subject<string>();
  
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreatePanelDialogComponent>,
    private teacherService: TeacherService,
    private panelService: PanelService,
    private notificationService: NotificationService,
    @Inject(MAT_DIALOG_DATA) public data: { eventId?: number, panel?: any } = {}
  ) {
    this.panelForm = this.fb.group({
      name: ['', Validators.required],
      teacherIds: [[], [Validators.required, Validators.minLength(3)]] // Changed from 2 to 3
    });
  }
  
  ngOnInit(): void {
    this.loadTeachers();
    
    // If editing, populate form
    if (this.data?.panel) {
      this.panelForm.patchValue({
        name: this.data.panel.name,
        teacherIds: this.data.panel.members.map((m: any) => m.teacherId)
      });
    }
    
    // Set up search with debounce
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => {
      this.filterTeachersByTerm(term);
    });
  }
  
  ngAfterViewInit() {
    // Focus the search input after view initialization
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    }, 300);
  }
  
  loadTeachers(): void {
    this.loading = true;
    
    // Load all teachers and panels in parallel to calculate proper workload
    Promise.all([
      this.teacherService.getAllTeachers().toPromise(),
      this.panelService.getAllPanels().toPromise()
    ]).then(([teachers, panels]) => {
      // Calculate teacher workload based on assigned panels and groups
      const teacherWorkloadMap = new Map<number, {panels: number, groups: number}>();
      
      // Initialize all teachers with 0 workload
      if (teachers) {
        teachers.forEach(teacher => {
          teacherWorkloadMap.set(teacher.id, {panels: 0, groups: 0});
        });
      }
      
      // Count panels per teacher
      if (panels) {
        panels.forEach(panel => {
          panel.members.forEach((member: any) => {
            const teacherId = member.teacherId;
            const currentWorkload = teacherWorkloadMap.get(teacherId) || {panels: 0, groups: 0};
            teacherWorkloadMap.set(teacherId, {
              ...currentWorkload, 
              panels: currentWorkload.panels + 1
            });
          });
        });
      }
      
      // Process teacher list with workload data
      this.teachers = (teachers || []).map(teacher => {
        const workload = teacherWorkloadMap.get(teacher.id) || {panels: 0, groups: 0};
        
        // Calculate groups from panels (simplified, 3 groups per panel on average)
        const estimatedGroups = workload.panels * 3;
        
        // Determine workload status
        let status: 'available' | 'active' | 'busy';
        if (workload.panels === 0) {
          status = 'available';
        } else if (workload.panels <= 2) {
          status = 'active';
        } else {
          status = 'busy';
        }
        
        return {
          ...teacher,
          assignedPanels: workload.panels,
          assignedGroups: estimatedGroups,
          workloadStatus: status
        };
      });
      
      // Sort teachers by workload (available first, then active, then busy)
      this.teachers.sort((a, b) => {
        const statusOrder = {
          'available': 0,
          'active': 1,
          'busy': 2
        };
        return statusOrder[a.workloadStatus!] - statusOrder[b.workloadStatus!];
      });
      
      this.filteredTeachers = [...this.teachers];
      this.loading = false;
    }).catch(error => {
      console.error('Error loading teacher data:', error);
      this.notificationService.showError('Failed to load teachers');
      this.loading = false;
    });
  }
  
  // Get count of selected teachers
  get selectedTeachersCount(): number {
    return this.panelForm.get('teacherIds')?.value?.length || 0;
  }
  
  // Check if minimum required teachers are selected
  get hasMinimumTeachers(): boolean {
    return this.selectedTeachersCount >= 3;
  }
  
  // Check if a teacher is selected
  isTeacherSelected(teacherId: number): boolean {
    const selectedIds = this.panelForm.get('teacherIds')?.value || [];
    return selectedIds.includes(teacherId);
  }
  
  // Toggle teacher selection
  toggleTeacherSelection(teacherId: number): void {
    const selectedIds = [...(this.panelForm.get('teacherIds')?.value || [])];
    const index = selectedIds.indexOf(teacherId);
    
    if (index > -1) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(teacherId);
    }
    
    this.panelForm.get('teacherIds')?.setValue(selectedIds);
    // Mark as touched to trigger validation
    this.panelForm.get('teacherIds')?.markAsTouched();
  }
  
  // Handle search input
  search(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerms.next(term);
  }
  
  // Clear search
  clearSearch(): void {
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
      this.filterTeachersByTerm('');
    }
  }
  
  // Filter teachers based on search term
  private filterTeachersByTerm(term: string): void {
    this.searchQuery = term.toLowerCase();
    
    if (!this.searchQuery) {
      this.filteredTeachers = [...this.teachers];
      return;
    }
    
    this.filteredTeachers = this.teachers.filter(teacher => 
      teacher.fullName.toLowerCase().includes(this.searchQuery) || 
      (teacher.areaOfSpecialization && teacher.areaOfSpecialization.toLowerCase().includes(this.searchQuery)) ||
      (teacher.qualification && teacher.qualification.toLowerCase().includes(this.searchQuery)) ||
      (teacher.officeLocation && teacher.officeLocation.toLowerCase().includes(this.searchQuery))
    );
  }
  
  onSubmit(): void {
    if (this.panelForm.invalid) return;
    
    // Check minimum teachers requirement
    if (this.selectedTeachersCount < 3) {
      this.notificationService.showError('Please select at least 3 teachers for the panel');
      return;
    }
    
    this.loading = true;
    const panelData = this.panelForm.value;
    
    if (this.data?.panel) {
      // Update panel
      this.panelService.updatePanel(this.data.panel.id, panelData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Panel updated successfully');
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Failed to update panel:', error);
          this.notificationService.showError('Failed to update panel');
          this.loading = false;
        }
      });
    } else {
      // Create panel
      this.panelService.createPanel(panelData).subscribe({
        next: () => {
          this.notificationService.showSuccess('Panel created successfully');
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Failed to create panel:', error);
          this.notificationService.showError('Failed to create panel');
          this.loading = false;
        }
      });
    }
  }
  
  // Get teacher's initials for avatar
  getInitials(name: string): string {
    if (!name) return '';
    
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }
  
  // Get workload display status
  getWorkloadClass(teacher: TeacherWithWorkload): string {
    switch (teacher.workloadStatus) {
      case 'available': return 'badge-available';
      case 'active': return 'badge-active';
      case 'busy': return 'badge-busy';
      default: return 'badge-available';
    }
  }
  
  // Get workload display text
  getWorkloadText(teacher: TeacherWithWorkload): string {
    switch (teacher.workloadStatus) {
      case 'available': return 'Available';
      case 'active': return 'Active';
      case 'busy': return 'Busy';
      default: return 'Available';
    }
  }
  
  // Get a list of panels the teacher is assigned to
  getWorkloadDetails(teacher: TeacherWithWorkload): string {
    if (teacher.assignedPanels === 0) {
      return 'No current assignments';
    }
    
    return `${teacher.assignedPanels} panels, ~${teacher.assignedGroups} groups`;
  }
  
  // Get a safe version of data object
  get panelData(): any {
    return this.data || {};
  }

  // Get all selected teachers as objects (not just IDs)
  getSelectedTeachers(): TeacherWithWorkload[] {
    const selectedIds = this.panelForm.get('teacherIds')?.value || [];
    return this.teachers.filter(teacher => selectedIds.includes(teacher.id));
  }

  // Sort teachers by different criteria
  sortTeachers(criteria: 'availability' | 'name' | 'specialization'): void {
    switch (criteria) {
      case 'availability':
        this.filteredTeachers = [...this.filteredTeachers].sort((a, b) => {
          const statusOrder = {
            'available': 0,
            'active': 1,
            'busy': 2
          };
          return statusOrder[a.workloadStatus] - statusOrder[b.workloadStatus];
        });
        break;
        
      case 'name':
        this.filteredTeachers = [...this.filteredTeachers].sort((a, b) => 
          a.fullName.localeCompare(b.fullName));
        break;
        
      case 'specialization':
        this.filteredTeachers = [...this.filteredTeachers].sort((a, b) => {
          const specA = a.areaOfSpecialization || 'zzz'; // Put empty specializations at the end
          const specB = b.areaOfSpecialization || 'zzz';
          return specA.localeCompare(specB);
        });
        break;
    }
  }
}