import { Component, EventEmitter, Input, Output, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentInfo } from '../../models/student.interface';
import { Announcement, ProjectProgress } from '../../models/dashboard.types';

@Component({
  selector: 'app-welcome-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome-section.component.html',
  styleUrls: ['./welcome-section.component.scss'],
  encapsulation: ViewEncapsulation.None // This allows styles to affect child components

})
export class WelcomeSectionComponent implements OnInit {
  @Output() viewChange = new EventEmitter<string>();

  
  @Input() studentInfo!: StudentInfo;
  @Input() hasApprovedGroup: boolean = false;
  @Input() announcements: Announcement[] = [];
  @Input() projectProgress!: ProjectProgress;
  @Input() unreadMessages: number = 0;

  ngOnInit(): void {
    // Initialize component if needed
  }

  navigateToTeachers(): void {
    this.viewChange.emit('teachers');
  }

  navigateToChat(): void {
    if (this.hasApprovedGroup) {
      this.viewChange.emit('chat');
    }
  }
}