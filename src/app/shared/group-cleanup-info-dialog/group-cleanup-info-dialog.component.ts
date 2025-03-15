import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-group-cleanup-info-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cleanup-dialog">
      <div class="dialog-header">
        <h2>Group Management Information</h2>
      </div>
      <div class="dialog-content">
        <p>
          <strong>Congratulations!</strong> Your group has been approved for supervision.
        </p>
        <p>
          As per system policy, when a group gets approved for supervision, any other groups
          you were a part of are automatically cleaned up. This ensures you can focus on your
          approved project.
        </p>
        <p>
          All your other groups and pending supervision requests have been removed from the system.
        </p>
      </div>
      <div class="dialog-footer">
        <div class="dont-show-again">
          <input type="checkbox" id="dontShowAgain" [(ngModel)]="dontShowAgain">
          <label for="dontShowAgain">Don't show this message again</label>
        </div>
        <div class="dialog-actions">
          <button (click)="closeDialog()">OK, I understand</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cleanup-dialog {
      padding: 20px;
      max-width: 500px;
    }
    
    .dialog-header {
      margin-bottom: 20px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 10px;
    }
    
    .dialog-header h2 {
      margin: 0;
      color: #1e293b;
      font-size: 1.5rem;
    }
    
    .dialog-content {
      margin-bottom: 20px;
    }
    
    .dialog-content p {
      margin-bottom: 10px;
      line-height: 1.6;
      color: #334155;
    }
    
    .dialog-footer {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .dont-show-again {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .dont-show-again input {
      margin: 0;
    }
    
    .dont-show-again label {
      font-size: 0.9rem;
      color: #64748b;
    }
    
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
    }
    
    .dialog-actions button {
      background-color: #3b82f6;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
    
    .dialog-actions button:hover {
      background-color: #2563eb;
    }
  `]
})
export class GroupCleanupInfoDialogComponent {
  dontShowAgain = false;
  
  constructor(private dialogRef: MatDialogRef<GroupCleanupInfoDialogComponent>) {}
  
  closeDialog(): void {
    this.dialogRef.close(this.dontShowAgain);
  }
}
