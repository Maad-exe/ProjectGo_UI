export interface Rubric {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  categories: RubricCategory[];
}

export interface RubricCategory {
  id: number;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

export interface CreateRubricDto {
  name: string;
  description: string;
  categories: CreateRubricCategoryDto[];
}

export interface CreateRubricCategoryDto {
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}