import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreatePanelDialogComponent } from './create-panel-dialog.component';

describe('CreatePanelDialogComponent', () => {
  let component: CreatePanelDialogComponent;
  let fixture: ComponentFixture<CreatePanelDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePanelDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePanelDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
