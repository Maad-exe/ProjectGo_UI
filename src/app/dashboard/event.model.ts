// models/event.model.ts

export enum EventType {
  Proposal = 0,
  Midterm = 1,
  Final = 2
}

// Add this helper function
export function getEventTypeString(type: EventType): string {
  return EventType[type];
}

export interface EvaluationEvent {
  id: number;
  name: string;
  description: string;
  date: string; // ISO format
  totalMarks: number;
  isActive: boolean;
  createdAt: string; // ISO format
  weight: number;
  type: EventType;
  rubricId?: number;
  rubricName?: string;
}

export interface CreateEventDto {
  name: string;
  description: string;
  date: string; // ISO format
  totalMarks: number;
  weight: number;
  type: EventType;
  rubricId?: number;
}

export interface UpdateEventDto {
  name: string;
  description: string;
  date: string; // ISO format
  totalMarks: number;
  isActive: boolean;
  type: EventType;
  weight: number;
  rubricId?: number;
}
