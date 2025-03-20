export interface Announcement {
    title: string;
    content: string;
    date: string;
  }
  
  export interface ProjectProgress {
    currentPhase: string;
    completion: number;
    nextMilestone: string;
  }