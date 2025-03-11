import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupervisionRequestsComponent } from './supervision-requests.component';

describe('SupervisionRequestsComponent', () => {
  let component: SupervisionRequestsComponent;
  let fixture: ComponentFixture<SupervisionRequestsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupervisionRequestsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupervisionRequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
