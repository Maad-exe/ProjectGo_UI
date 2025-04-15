import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupService } from '../../../services/group.service';
import { NotificationService } from '../../../services/notifications.service';

@Component({
  selector: 'app-dashboard-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-sidebar.component.html',
  styleUrls: ['./dashboard-sidebar.component.scss']
})
export class DashboardSidebarComponent implements OnInit {
  @Input() currentView: string = 'dashboard';
  @Input() unreadMessages: number = 0;
  @Input() hasNewAnnouncements: boolean = false;
  @Input() hasApprovedGroup: boolean = false;
  
  @Output() viewChange = new EventEmitter<string>();
  
  constructor(private groupService: GroupService, private notificationService: NotificationService) {}
  
  ngOnInit() {
    // Subscribe to approved group changes to immediately update the sidebar state
    this.groupService.approvedGroup$.subscribe(group => {
      // This ensures the chat button enables as soon as an approved group is detected
      this.hasApprovedGroup = !!group;
      console.log('Sidebar updated hasApprovedGroup state:', this.hasApprovedGroup);
    });
  }
  
  setView(view: string): void {
    // Don't navigate to chat if not allowed
    if (view === 'chat' && !this.hasApprovedGroup) {
      console.log('Chat navigation blocked - no approved group');
      this.notificationService.showInfo('You need an approved group to access the chat');
      return;
    }
    
    console.log('Sidebar requesting view change to:', view, 'Has approved group:', this.hasApprovedGroup); 
    this.viewChange.emit(view);
  }
}