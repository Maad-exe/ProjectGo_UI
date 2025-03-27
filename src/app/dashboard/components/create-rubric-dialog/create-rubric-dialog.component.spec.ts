import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRubricDialogComponent } from './create-rubric-dialog.component';

describe('CreateRubricDialogComponent', () => {
  let component: CreateRubricDialogComponent;
  let fixture: ComponentFixture<CreateRubricDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRubricDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateRubricDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
