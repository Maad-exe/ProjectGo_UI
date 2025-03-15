import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupCleanupInfoDialogComponent } from './group-cleanup-info-dialog.component';

describe('GroupCleanupInfoDialogComponent', () => {
  let component: GroupCleanupInfoDialogComponent;
  let fixture: ComponentFixture<GroupCleanupInfoDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupCleanupInfoDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupCleanupInfoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
