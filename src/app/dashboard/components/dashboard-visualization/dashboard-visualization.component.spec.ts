import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardVisualizationComponent } from './dashboard-visualization.component';

describe('DashboardVisualizationComponent', () => {
  let component: DashboardVisualizationComponent;
  let fixture: ComponentFixture<DashboardVisualizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardVisualizationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardVisualizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
