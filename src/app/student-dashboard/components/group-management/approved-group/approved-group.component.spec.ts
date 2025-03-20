import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovedGroupComponent } from './approved-group.component';

describe('ApprovedGroupComponent', () => {
  let component: ApprovedGroupComponent;
  let fixture: ComponentFixture<ApprovedGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovedGroupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApprovedGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
