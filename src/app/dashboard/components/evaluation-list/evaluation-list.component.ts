import { CommonModule } from '@angular/common';
import { PanelService } from '../../../services/panel.service';
import { NotificationService } from '../../../services/notifications.service';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-evaluation-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './evaluation-list.component.html',
  styleUrls: ['./evaluation-list.component.scss']
})
export class EvaluationListComponent implements OnInit {
  evaluations: any[] = [];
  loading = true;
  
  constructor(
    private panelService: PanelService,
    private notificationService: NotificationService
  ) {}
  
  ngOnInit(): void {
    // This will be implemented later
    this.loading = false;
  }
}