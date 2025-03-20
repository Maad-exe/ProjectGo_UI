// src/app/app.routes.ts
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
    canActivate: [authGuard],
    children: [
      {
        path: 'users',
        component: UserManagementComponent
      }
    ]
  },
  { 
    path: 'student-dashboard', 
    component: StudentDashboardComponent, 
    canActivate: [authGuard,studentGuard],
    children: [
      { path: 'teachers', component: TeacherListComponent }
    ]
  },
  { 
    path: 'teacher-dashboard', 
    component: TeacherDashboardComponent, 
    canActivate: [authGuard]
  },

  { path: 'group-chat/:groupId', component: GroupChatComponent },
  { path: '**', redirectTo: '/login' } 
];