import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupEvaluationComponent } from './group-evaluation.component';

describe('GroupEvaluationComponent', () => {
  let component: GroupEvaluationComponent;
  let fixture: ComponentFixture<GroupEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupEvaluationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupEvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
