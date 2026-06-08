import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getDocs: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: any, name: string) => ({ name })),
  collectionGroup: vi.fn((_db: any, name: string) => ({ name, isGroup: true })),
  query: vi.fn((c: any, ..._args: any[]) => c),
  getDocs: (...args: any[]) => mocks.getDocs(...args),
}));

vi.mock('../src/lib/firebase', () => ({
  db: {},
}));

import AdminStats from '../src/components/AdminStats';

const sampleCourses = [
  {
    id: '1',
    title: 'React Basics',
    category: 'Tecnología',
    thumbnailUrl: 'https://example.com/thumb1.jpg',
  },
  {
    id: '2',
    title: 'Sales 101',
    category: 'Ventas',
    thumbnailUrl: '', // To test the fallback
  },
];

const sampleProgress = [
  {
    courseId: '1',
    status: 'completed',
  },
  {
    courseId: '1',
    status: 'in_progress', // acts as active
  },
  {
    courseId: '1',
    status: 'completed',
  },
  {
    courseId: '2',
    status: 'in_progress', // acts as active
  },
];

function makeSnapshot(data: any[]) {
  return {
    docs: data.map((item) => {
      if (item.id) {
         const { id, ...rest } = item;
         return { id, data: () => rest };
      }
      return { data: () => item };
    }),
  };
}

beforeEach(() => {
  mocks.getDocs.mockReset();
});

describe('AdminStats', () => {
  it('renders the loading spinner initially', () => {
    // Return a never-resolving promise to keep it in loading state
    mocks.getDocs.mockReturnValue(new Promise(() => {}));

    const { container } = render(<AdminStats />);
    expect(container.querySelectorAll('.animate-spin').length).toBeGreaterThan(0);
  });

  it('renders empty state when there is no data', async () => {
    mocks.getDocs.mockResolvedValue(makeSnapshot([]));

    render(<AdminStats />);

    await waitFor(() => {
      expect(screen.getByText('Estadísticas')).toBeInTheDocument();
    });

    // Check empty table message
    expect(screen.getByText('No hay datos disponibles.')).toBeInTheDocument();

    // Check that top level metrics are 0
    const values = screen.getAllByText('0');
    expect(values.length).toBeGreaterThanOrEqual(3);
    const percentage = screen.getAllByText('0%');
    expect(percentage.length).toBeGreaterThanOrEqual(1);
  });

  it('renders stats correctly with data', async () => {
    // getDocs is called twice: first for courses, then for progress
    mocks.getDocs.mockImplementation((queryObj: any) => {
      if (queryObj.name === 'courses') {
        return Promise.resolve(makeSnapshot(sampleCourses));
      }
      if (queryObj.name === 'progress') {
        return Promise.resolve(makeSnapshot(sampleProgress));
      }
      return Promise.resolve(makeSnapshot([]));
    });

    render(<AdminStats />);

    await waitFor(() => {
      expect(screen.getByText('React Basics')).toBeInTheDocument();
    });

    expect(screen.getByText('Sales 101')).toBeInTheDocument();

    // Top Level Stats Verification
    // Total Enrollments = 4 (from sampleProgress)
    expect(screen.getByText('4')).toBeInTheDocument();
    // Completed Courses = 2 (React Basics has 2 completed)
    // Active Courses = Total(4) - Completed(2) = 2
    // There will be multiple '2's because top stats have them and table rows have them
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);

    // Completion Rate = (2 / 4) * 100 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();


    // React Basics row
    // Course 1: Enrollments=3, Active=1, Completed=2, Rate=67%
    expect(screen.getByText('67%')).toBeInTheDocument();

    // Sales 101 row
    // Course 2: Enrollments=1, Active=1, Completed=0, Rate=0%
    // (Already checking for 0 and percentages)
  });

  it('handles error while fetching stats gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Force getDocs to throw
    mocks.getDocs.mockRejectedValueOnce(new Error('Firebase error'));

    render(<AdminStats />);

    // Should wait for loading to finish and show the UI (even if empty)
    await waitFor(() => {
      expect(screen.getByText('Estadísticas')).toBeInTheDocument();
    });

    // Check that error was logged
    expect(errorSpy).toHaveBeenCalled();

    // Clean up
    errorSpy.mockRestore();
  });
});
