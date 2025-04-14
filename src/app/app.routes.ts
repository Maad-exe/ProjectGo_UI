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
import { ConductEvaluationComponent } from './teacher-dashboard/components/conduct-evaluation/conduct-evaluation.component';
import { teacherGuard } from './core/guards/teacher.guard';

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
        path: '', 
        component: DashboardComponent 
      },
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
  { 
    path: 'teacher-dashboard', 
    component: TeacherDashboardComponent, 
    canActivate: [authGuard]
  },
  { 
    path: 'teacher-dashboard/evaluate/:eventId/:groupId/:studentId/:groupEvaluationId', 
    component: ConductEvaluationComponent,
    canActivate: [authGuard]
  },
  { path: 'group-chat/:groupId', component: GroupChatComponent },
  { path: '**', redirectTo: '/login' } 
];
