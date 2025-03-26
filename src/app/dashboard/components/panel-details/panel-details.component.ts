import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PanelService } from '../../../services/panel.service';
import { NotificationService } from '../../../services/notifications.service';
import { Panel, GroupEvaluation } from '../../../models/panel.model';
import { AssignGroupDialogComponent } from '../assign-group-dialog/assign-group-dialog.component';

@Component({
  selector: 'app-panel-details',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './panel-details.component.html',
  styleUrls: ['./panel-details.component.scss']
})
export class PanelDetailsComponent implements OnInit {
  panelId!: number;
  panel: Panel | null = null;
  evaluations: GroupEvaluation[] = [];
  loading = true;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private panelService: PanelService,
    private dialog: MatDialog,
    private notificationService: NotificationService
  ) {}
  
  ngOnInit(): void {
    this.panelId = +this.route.snapshot.paramMap.get('id')!;
    this.loadPanelDetails();
    this.loadPanelEvaluations();
  }
  
  loadPanelDetails(): void {
    this.loading = true;
    this.panelService.getPanelById(this.panelId).subscribe({
      next: (panel) => {
        this.panel = panel;
        this.loading = false;
        console.log("Successfully loaded panel details:", panel);
      },
      error: (error) => {
        console.error("Error loading panel details:", error);
        this.notificationService.showError('Failed to load panel details');
        this.loading = false;
      }
    });
  }
  
  loadPanelEvaluations(): void {
    this.panelService.getGroupEvaluationsByPanelId(this.panelId).subscribe({
      next: (evaluations) => {
        this.evaluations = evaluations;
      },
      error: (error) => {
        this.notificationService.showError('Failed to load panel evaluations');
      }
    });
  }
  
  goBack(): void {
    this.router.navigate(['/admin-dashboard/panels']);
  }
}
