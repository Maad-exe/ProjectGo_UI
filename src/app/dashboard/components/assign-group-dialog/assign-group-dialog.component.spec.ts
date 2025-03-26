import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssignGroupDialogComponent } from './assign-group-dialog.component';

describe('AssignGroupDialogComponent', () => {
  let component: AssignGroupDialogComponent;
  let fixture: ComponentFixture<AssignGroupDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignGroupDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssignGroupDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
