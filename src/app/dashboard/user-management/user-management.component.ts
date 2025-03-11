import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { UserManagementService, UserDetails } from '../../services/user-management.service';
import { NotificationService } from '../../services/notifications.service';
import { EditUserDialogComponent } from './edit-user-dialog/edit-user-dialog.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    RouterModule
  ],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  displayedColumns: string[] = ['fullName', 'email', 'role', 'createdAt', 'actions'];
  dataSource!: MatTableDataSource<UserDetails>;
  // Add originalData property to store the unfiltered data
  originalData: UserDetails[] = [];
  isLoading = false;
  showAdvancedFilters = false;
  activeFilters = 0;
  roleFilter = 'all';
  sortOption = 'date';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private userManagementService: UserManagementService,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadUsers();
    
  }

  loadUsers() {
    this.isLoading = true;
    this.userManagementService.getAllUsers().subscribe({
      next: (users) => {
        // Store the original data
        this.originalData = [...users];
        this.dataSource = new MatTableDataSource(users);
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.isLoading = false;
        this.applySorting(this.sortOption= 'date');
      },
      error: (error) => {
        this.notificationService.showError('Failed to load users');
        this.isLoading = false;
      }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  clearSearch(input: HTMLInputElement) {
    input.value = '';
    this.applyFilter({ target: input } as unknown as Event);
  }

  filterByRole(role: string) {
    this.roleFilter = role;
    this.activeFilters = role === 'all' ? 0 : 1;
    
    if (role === 'all') {
      // Reset to original data
      this.dataSource.data = [...this.originalData];
    } else {
      // Apply role filter to original data
      this.dataSource.data = this.originalData.filter(user => 
        user.role.toLowerCase() === role.toLowerCase()
      );
    }
    
    // Maintain any applied sort
    this.applySorting(this.sortOption);
    
    // Make sure paginator goes back to first page
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  sortBy(option: string) {
    this.sortOption = option;
    this.applySorting(option);
  }

  private applySorting(option: string) {
    // Get current filtered data
    const data = [...this.dataSource.data];
    
    // Apply sorting based on option
    switch (option) {
      case 'name':
        data.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
      case 'date':
        data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'role':
        data.sort((a, b) => a.role.localeCompare(b.role));
        break;
    }
    
    // Update the datasource
    this.dataSource.data = data;
  }

  resetFilters() {
    this.roleFilter = 'all';
    this.sortOption = 'date';
    this.activeFilters = 0;
    
    // Reset search input if any
    const searchInput = document.querySelector('.search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      this.dataSource.filter = '';
    }
    
    // Reset to original data
    this.dataSource.data = [...this.originalData];
    // Apply default sort
    this.applySorting(this.sortOption= 'date');
    
    // Reset paginator
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  addNewUser() {
    // Navigate back to admin dashboard and trigger the user registration modal
    this.router.navigate(['/admin-dashboard']).then(() => {
      // Find the dashboard component and access its method
      const dashboardComponent = this.router.routerState.root.children
        .find(route => route.component?.name === 'DashboardComponent')?.component;
      
      // If we can't access the component directly through the router, use a shared service approach
      if (dashboardComponent) {
       
        (dashboardComponent as any).showAddUserModal();
      } else {
       
        this.notificationService.triggerAction('openAddUserModal');
      }
    });
  }

  editUser(user: UserDetails) {
    const dialogRef = this.dialog.open(EditUserDialogComponent, {
      width: '600px',
      data: { ...user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.userManagementService.updateUser(result).subscribe({
          next: () => {
            this.notificationService.showSuccess('User updated successfully');
            this.loadUsers();
          },
          error: () => this.notificationService.showError('Failed to update user')
        });
      }
    });
  }

  deleteUser(userId: number) {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userManagementService.deleteUser(userId).subscribe({
        next: () => {
          this.notificationService.showSuccess('User deleted successfully');
          this.loadUsers();
        },
        error: () => this.notificationService.showError('Failed to delete user')
      });
    }
  }

  navigateBack() {
    this.router.navigate(['/admin-dashboard']);
  }
}