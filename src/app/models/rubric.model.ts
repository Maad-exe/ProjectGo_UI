export interface RubricCategory {
  id?: number;
  name: string;
  description?: string;
  weight: number; // Weight as decimal (0.0-1.0)
  maxScore: number;
}

export interface Rubric {
  id?: number;
  name: string;
  description: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  categories: RubricCategory[];
}

export interface CreateRubricDto {
  name: string;
  description: string;
  categories: Omit<RubricCategory, 'id'>[];
}

export interface UpdateRubricDto {
  id: number;
  name: string;
  description: string;
  isActive?: boolean;
  categories: RubricCategory[];
}