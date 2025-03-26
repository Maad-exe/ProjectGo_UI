import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RubricListComponent } from './rubric-list.component';

describe('RubricListComponent', () => {
  let component: RubricListComponent;
  let fixture: ComponentFixture<RubricListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RubricListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RubricListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
