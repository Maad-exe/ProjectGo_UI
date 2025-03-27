export interface StudentEvaluation {
  id: number;
  eventId: number;
  eventName?: string;
  studentId: number;
  studentName?: string;
  teacherId: number;
  teacherName?: string;
  totalScore: number;
  comments: string;
  createdAt: string;
  updatedAt: string;
  scores: CategoryScore[];
}

export interface CategoryScore {
  categoryId: number;
  categoryName?: string;
  score: number;
  comments: string;
  weight?: number;
  maxScore?: number;
}

export interface SimpleEvaluationDto {
  eventId: number;
  studentId: number;
  teacherId: number;
  score: number;
  comments: string;
}

export interface RubricEvaluationDto {
  eventId: number;
  studentId: number;
  teacherId: number;
  scores: {
    categoryId: number;
    score: number;
    comments: string;
  }[];
  comments: string;
}

export interface GroupEvaluation {
  id: number;
  eventId: number;
  eventName: string;
  groupId: number;
  groupName: string;
  panelId: number;
  isCompleted: boolean;
  comments: string;
  studentEvaluations: StudentEvaluation[];
}

export interface FinalGrade {
  studentId: number;
  studentName: string;
  eventScores: {
    eventId: number;
    eventName: string;
    score: number;
    weight: number;
  }[];
  finalGrade: number;
  normalizedGrade?: number;
}

export interface StudentPerformanceDashboardDto {
  studentId: number;
  studentName: string;
  averagePerformance: number;
  completedEvents: number;
  totalEvents: number;
  events: {
    eventId: number;
    eventName: string;
    eventType: string;
    score: number;
    totalMarks: number;
    weight: number;
    date: string;
  }[];
}