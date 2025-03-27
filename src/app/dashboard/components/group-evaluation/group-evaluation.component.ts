import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StudentDashboardComponent } from './student-dashboard/student-dashboard.component';
import { TeacherDashboardComponent } from './teacher-dashboard/teacher-dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './services/auth.service';
import { studentGuard } from './core/guards/student.guard';
import { UserManagementComponent } from './dashboard/user-management/user-management.component';
import { GroupChatComponent } from './group-chat/group-chat.component';
import { TeacherListComponent } from './student-dashboard/components/teacher-list/teacher-list.component';
import { adminGuard } from './core/guards/admin.guard'; // Fixed path
import { EventListComponent } from './dashboard/components/events/event-list/event-list.component';
import { EventDetailsComponent } from './dashboard/components/events/event-details/event-details.component';
import { PanelListComponent } from '../app/dashboard/components/panel-list/panel-list.component';
import { PanelDetailsComponent } from '../app/dashboard/components/panel-details/panel-details.component';
import { RubricListComponent } from '../app/dashboard/components/rubric-list/rubric-list.component';
import { EvaluationListComponent } from '../app/dashboard/components/evaluation-list/evaluation-list.component';
import { GroupEvaluationComponent } from './dashboard/components/group-evaluation/group-evaluation.component';
import { ConductEvaluationComponent } from './dashboard/components/conduct-evaluation/conduct-evaluation.component';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { EventService } from '../../../services/event.service';
import { PanelService } from '../../../services/panel.service';
import { GroupService } from '../../../services/group.service';
import { NotificationService } from '../../../services/notifications.service';
import { EvaluationService } from '../../../services/evaluation.service';

@Component({
  selector: 'app-group-evaluation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './group-evaluation.component.html',
  styleUrls: ['./group-evaluation.component.scss']
})
export class GroupEvaluationComponent implements OnInit {
  eventId: number;
  groupId: number;
  event: any;
  group: any;
  evaluations: any[] = [];
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private panelService: PanelService,
    private groupService: GroupService,
    private evaluationService: EvaluationService,
    private notificationService: NotificationService
  ) {
    this.eventId = +this.route.snapshot.paramMap.get('eventId')!;
    this.groupId = +this.route.snapshot.paramMap.get('groupId')!;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    // Load event details
    this.eventService.getEventById(this.eventId).subscribe({
      next: (event) => {
        this.event = event;
        
        // Load group details
        this.groupService.getGroupById(this.groupId).subscribe({
          next: (group) => {
            this.group = group;
            
            // Load evaluations for this group
            this.loadEvaluations();
          },
          error: () => {
            this.notificationService.showError('Failed to load group details');
            this.loading = false;
          }
        });
      },
      error: () => {
        this.notificationService.showError('Failed to load event details');
        this.loading = false;
      }
    });
  }

  loadEvaluations(): void {
    // Get the evaluations for this group in this event
    this.panelService.getGroupEvaluationById(this.eventId, this.groupId).subscribe({
      next: (data) => {
        this.evaluations = data;
        this.loading = false;
      },
      error: () => {
        this.notificationService.showError('Failed to load evaluations');
        this.loading = false;
      }
    });
  }

  // Add the missing methods referenced in the template
  memberEvaluated(studentId: number): boolean {
    if (!this.evaluations) return false;
    return this.evaluations.some(eval => 
      eval.studentId === studentId && eval.status === 'Completed'
    );
  }

  evaluateStudent(studentId: number): void {
    this.router.navigate([
      '/admin-dashboard/events', 
      this.eventId, 
      'groups', 
      this.groupId,
      'evaluate',
      studentId
    ]);
  }

  getCompletionStatus(): number {
    if (!this.group || !this.evaluations || this.evaluations.length === 0) {
      return 0;
    }

    const totalEvaluations = this.group.members.length;
    const completedEvaluations = this.evaluations.filter(e => e.status === 'Completed').length;
    
    return Math.round((completedEvaluations / totalEvaluations) * 100);
  }

  markAsComplete(): void {
    if (this.getCompletionStatus() < 100) {
      this.notificationService.showError('All students must be evaluated before marking as complete');
      return;
    }

    this.evaluationService.completeGroupEvaluation(this.eventId, this.groupId).subscribe({
      next: () => {
        this.notificationService.showSuccess('Group evaluation marked as complete');
        // Reload evaluations to update status
        this.loadEvaluations();
      },
      error: () => {
        this.notificationService.showError('Failed to complete group evaluation');
      }
    });
  }

  getScoreClass(score: number): string {
    if (!this.event) return '';
    
    const percentage = (score / this.event.totalMarks) * 100;
    
    if (percentage >= 85) return 'bg-success';
    if (percentage >= 70) return 'bg-primary';
    if (percentage >= 55) return 'bg-info';
    if (percentage >= 40) return 'bg-warning';
    return 'bg-danger';
  }

  viewEvaluation(evaluationId: number): void {
    // Navigate to evaluation details or open a dialog to show details
    this.notificationService.showInfo('Evaluation details view not implemented yet');
    // Future implementation could be:
    // this.router.navigate(['/admin-dashboard/evaluations', evaluationId]);
    // Or open a modal dialog with evaluation details
  }
}

export const routes: Routes = [
  { 
    path: '', 
    redirectTo: '/login', 
    pathMatch: 'full'
  },
  { 
    path: 'login', 
    component: LoginComponent,
    canActivate: [() => {
      const auth = inject(AuthService);
      const router = inject(Router);
      if (auth.isLoggedIn()) {
        const role = auth.getUserRole().toLowerCase();
        router.navigate([`/${role}-dashboard`]);
        return false;
      }
      return true;
    }]
  },
  { 
    path: 'register', 
    component: RegisterComponent
  },
  { 
    path: 'admin-dashboard', 
    component: DashboardComponent, 
    canActivate: [authGuard, adminGuard],
    children: [
      {
        path: 'users', 
        component: UserManagementComponent
      },
      { 
        path: 'events',     
        component: EventListComponent
      },
      { 
        path: 'events/:id', 
        component: EventDetailsComponent
      },
      { 
        path: 'panels', 
        component: PanelListComponent
      },
      { 
        path: 'panels/:id', 
        component: PanelDetailsComponent
      },
      { 
        path: 'rubrics', 
        component: RubricListComponent
      },
      { 
        path: 'evaluations', 
        component: EvaluationListComponent
      },
      {
        path: 'events/:eventId/groups/:groupId',
        component: GroupEvaluationComponent
      },
      { 
        path: 'events/:eventId/groups/:groupId/evaluate/:studentId', 
        component: ConductEvaluationComponent
      },
      { 
        path: '', 
        redirectTo: 'users', 
        pathMatch: 'full'
      }
    ]
  },
  { 
    path: 'student-dashboard', 
    component: StudentDashboardComponent, 
    canActivate: [authGuard, studentGuard],
    children: [
      { path: 'teachers', component: TeacherListComponent }
    ]
  },
  { path: '**', redirectTo: '/login' },
  { path: 'group-chat/:groupId', component: GroupChatComponent },
  { path: 'teacher-dashboard', component: TeacherDashboardComponent, canActivate: [authGuard] }
];
