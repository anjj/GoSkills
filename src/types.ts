export interface Chapter {
  id: string;
  title: string;
  text: string;
  videoUrl: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  category: string;
  published: boolean;
  createdAt: any;
  chapters: Chapter[];
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  lastSeen: string;
}

export interface UserProgress {
  courseId: string;
  completed: boolean;
  completedAt?: string;
}

export type Category = 'Ventas' | 'Operaciones' | 'Onboarding' | 'Tecnología' | 'RRHH';
export const CATEGORIES: Category[] = ['Ventas', 'Operaciones', 'Onboarding', 'Tecnología', 'RRHH'];

export interface CourseStats {
  courseId: string;
  views: number;
  uniqueViewers: number;
  chapterViews: Record<string, number>;
  updatedAt: any;
}

export interface CourseStatsSummary {
  courseId: string;
  title: string;
  category: string;
  published: boolean;
  views: number;
  uniqueViewers: number;
  completions: number;
  completionRate: number;
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers7d: number;
  activeUsers30d: number;
  totalCourses: number;
  publishedCourses: number;
  totalViews: number;
  totalCompletions: number;
  courses: CourseStatsSummary[];
}
