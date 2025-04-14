// models/event.model.ts

export enum EventType {
  Proposal,
  Midterm,
  Final
}

// Add this helper function
export function getEventTypeString(type: EventType): string {
  return EventType[type];
}

export interface EvaluationEvent {
  id: number;
  name: string;
  type: number;
  date: string;
  totalMarks: number;
  rubricId?: number;
  description?: string; // Make description optional here too
  isActive: boolean;
  createdAt: string;
  weight: number;
  rubricName?: string;
  evaluationMethod?: 'simple' | 'rubric';
}

export interface CreateEventDto {
  name: string;
  type: number;
  date: string; // ISO format
  totalMarks: number;
  description: string;
  rubricId?: number;
  weight: number;
}

export interface UpdateEventDto {
  name?: string;
  type?: number;
  date?: string; // ISO format
  totalMarks?: number;
  description?: string;
  rubricId?: number;
  weight?: number;
  isActive?: boolean;
}
