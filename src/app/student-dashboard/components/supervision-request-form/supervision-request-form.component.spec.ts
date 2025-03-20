import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisionRequestFormComponent } from './supervision-request-form.component';

describe('SupervisionRequestFormComponent', () => {
  let component: SupervisionRequestFormComponent;
  let fixture: ComponentFixture<SupervisionRequestFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisionRequestFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupervisionRequestFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
