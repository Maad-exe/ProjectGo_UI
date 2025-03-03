import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const studentGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
  
    if (!authService.isLoggedIn()) {
      router.navigate(['/login']);
      return false;
    }
  
    const userRole = authService.getUserRole().toLowerCase();
    if (userRole !== 'student') {
      router.navigate([`/${userRole}-dashboard`]);
      return false;
    }
  
    return true;
  };