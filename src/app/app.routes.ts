// src/app/app.routes.ts
import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { StudentDashboardComponent } from './student-dashboard/student-dashboard.component';
import { TeacherDashboardComponent } from './teacher-dashboard/teacher-dashboard.component';
import { authGuard } from './core/guards/auth.guard';
import { AuthService } from './services/auth.service';
import { studentGuard } from './core/guards/student.guard';

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
    path: 'admin-dashboard', 
    component: DashboardComponent, 
    canActivate: [authGuard]
  },
  { 
    path: 'student-dashboard', 
    component: StudentDashboardComponent, 
    canActivate: [authGuard,studentGuard]
  },
  { 
    path: 'teacher-dashboard', 
    component: TeacherDashboardComponent, 
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/login' } // Added forward slash
];