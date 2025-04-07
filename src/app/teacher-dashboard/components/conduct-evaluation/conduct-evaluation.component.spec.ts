import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConductEvaluationComponent } from './conduct-evaluation.component';

describe('ConductEvaluationComponent', () => {
  let component: ConductEvaluationComponent;
  let fixture: ComponentFixture<ConductEvaluationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConductEvaluationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConductEvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
