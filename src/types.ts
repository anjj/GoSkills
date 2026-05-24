import type { Timestamp } from 'firebase/firestore';

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

export type ChapterCompletion = {
  chapterId: string;
  courseId: string; // denormalized for queries
  completedAt: Timestamp;
};

export type CourseProgressStatus = 'in_progress' | 'completed';

export type CourseProgress = {
  courseId: string;
  status: CourseProgressStatus; // replaces `completed: boolean`
  startedAt: Timestamp; // new
  completedAt?: Timestamp; // tightened from string
};

export type Category = 'Ventas' | 'Operaciones' | 'Onboarding' | 'Tecnología' | 'RRHH';
export const CATEGORIES: Category[] = ['Ventas', 'Operaciones', 'Onboarding', 'Tecnología', 'RRHH'];
