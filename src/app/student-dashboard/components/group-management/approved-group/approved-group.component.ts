import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GroupService, GroupDetails } from '../../../../services/group.service';
import { TeacherDetails } from '../../../../services/teacher.service';

@Component({
  selector: 'app-approved-group',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './approved-group.component.html',
  styleUrls: ['./approved-group.component.scss']
})
export class ApprovedGroupComponent implements OnInit {
  approvedGroup: GroupDetails | null = null;
  groupSupervisor: TeacherDetails | null = null;
  hasApprovedGroup: boolean = false;

  constructor(private groupService: GroupService) {}

  ngOnInit() {
    // Get initial values
    this.updateGroupData();

    // Subscribe to changes
    this.groupService.approvedGroupChanged.subscribe(group => {
      this.approvedGroup = group;
      this.hasApprovedGroup = !!group;
    });
    
    this.groupService.supervisorChanged.subscribe(teacher => {
      this.groupSupervisor = teacher;
    });
  }

  private updateGroupData() {
    this.approvedGroup = this.groupService.getApprovedGroup();
    this.hasApprovedGroup = !!this.approvedGroup;
    this.groupSupervisor = this.groupService.getSupervisor();
  }
}