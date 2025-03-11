import { TestBed } from '@angular/core/testing';

import { SupervisionRequestService } from './supervision-request.service';

describe('SupervisionRequestService', () => {
  let service: SupervisionRequestService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupervisionRequestService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
