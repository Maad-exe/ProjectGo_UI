import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupService } from '../../../services/group.service';

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-sidebar.component.html',
  styleUrls: ['./dashboard-sidebar.component.scss']
})
export class DashboardSidebarComponent {
  @Input() currentView: string = 'dashboard';
  @Input() unreadMessages: number = 0;
  @Input() hasNewAnnouncements: boolean = false;
  @Input() hasApprovedGroup: boolean = false;
  
  @Output() viewChange = new EventEmitter<string>();
  
  constructor(private groupService: GroupService) {}
  
  setView(view: string) {
    // Add validation to ensure correct view is emitted
    if (['dashboard', 'teachers', 'groups', 'chat'].includes(view)) {
      this.viewChange.emit(view);
    }
  }
}