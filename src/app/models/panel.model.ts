export interface Panel {
  id: number;
  name: string;
  createdAt: string;
  members: PanelMember[];
  eventId?: number;
}

export interface PanelMember {
  teacherId: number;
  teacherName: string;
  isHead: boolean;
}

export interface CreatePanelDto {
  name: string;
  teacherIds: number[];
  eventId?: number;
}

export interface UpdatePanelDto {
  name: string;
  teacherIds: number[];
}

// For evaluation assignment
export interface AssignPanelDto {
  groupId: number;
  panelId: number;
  eventId: number;
  scheduledDate: string;
}

export interface GroupEvaluation {
  id: number;
  groupId: number;
  groupName: string;
  panelId: number;
  panelName: string;
  eventId: number;
  eventName: string;
  scheduledDate: string;
  isCompleted: boolean;
  comments: string;
  studentEvaluations: StudentEvaluation[];
}

export interface StudentEvaluation {
  id: number;
  studentId: number;
  studentName: string;
  obtainedMarks: number;
  feedback: string;
  evaluatedAt: string;
}