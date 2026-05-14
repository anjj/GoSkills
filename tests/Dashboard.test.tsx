import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    onSnapshot: vi.fn(),
    handleFirestoreError: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: any, name: string) => ({ name })),
  query: vi.fn((c: any, ..._args: any[]) => c),
  orderBy: vi.fn(),
  onSnapshot: (...args: any[]) => mocks.onSnapshot(...args),
}));

vi.mock('../src/lib/firebase', () => ({
  db: {},
  handleFirestoreError: (...args: any[]) => mocks.handleFirestoreError(...args),
  OperationType: {
    LIST: 'list',
  },
  trackCourseView: vi.fn().mockResolvedValue(undefined),
}));

import Dashboard from '../src/components/Dashboard';

const sampleCourses = [
  {
    id: '1',
    title: 'React Basics',
    description: 'Learn React',
    thumbnailUrl: 'https://example.com/thumb1.jpg',
    duration: '2h',
    category: 'Tecnología',
    published: true,
    createdAt: { seconds: 0 },
    chapters: [],
  },
  {
    id: '2',
    title: 'Sales 101',
    description: 'How to sell',
    thumbnailUrl: '',
    duration: '1h',
    category: 'Ventas',
    published: false,
    createdAt: { seconds: 0 },
    chapters: [],
  },
];

function makeSnapshot(courses: any[]) {
  return {
    docs: courses.map((c) => {
      const { id, ...rest } = c;
      return { id, data: () => rest };
    }),
  };
}

beforeEach(() => {
  mocks.onSnapshot.mockReset();
  mocks.handleFirestoreError.mockReset();
});

describe('Dashboard', () => {
  it('renders the loading skeleton initially', () => {
    mocks.onSnapshot.mockReturnValue(() => {});
    const { container } = render(<Dashboard onPlay={vi.fn()} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders fetched courses', async () => {
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeSnapshot(sampleCourses));
      return () => {};
    });

    render(<Dashboard onPlay={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('React Basics')).toBeInTheDocument());
    expect(screen.getByText('Sales 101')).toBeInTheDocument();
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
  });

  it('calls onPlay when clicking a published course', async () => {
    const onPlay = vi.fn();
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeSnapshot(sampleCourses));
      return () => {};
    });
    render(<Dashboard onPlay={onPlay} />);
    await waitFor(() => screen.getByText('React Basics'));
    fireEvent.click(screen.getByText('React Basics'));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay.mock.calls[0][0].id).toBe('1');
  });

  it('does not call onPlay when clicking an unpublished course', async () => {
    const onPlay = vi.fn();
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeSnapshot(sampleCourses));
      return () => {};
    });
    render(<Dashboard onPlay={onPlay} />);
    await waitFor(() => screen.getByText('Sales 101'));
    fireEvent.click(screen.getByText('Sales 101'));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('filters courses by title', async () => {
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeSnapshot(sampleCourses));
      return () => {};
    });
    render(<Dashboard onPlay={vi.fn()} />);
    await waitFor(() => screen.getByText('React Basics'));
    fireEvent.change(screen.getByPlaceholderText(/Busca cursos/i), { target: { value: 'react' } });
    expect(screen.getByText('React Basics')).toBeInTheDocument();
    expect(screen.queryByText('Sales 101')).toBeNull();
  });

  it('filters courses by category', async () => {
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeSnapshot(sampleCourses));
      return () => {};
    });
    render(<Dashboard onPlay={vi.fn()} />);
    await waitFor(() => screen.getByText('React Basics'));
    fireEvent.change(screen.getByPlaceholderText(/Busca cursos/i), { target: { value: 'ventas' } });
    expect(screen.queryByText('React Basics')).toBeNull();
    expect(screen.getByText('Sales 101')).toBeInTheDocument();
  });

  it('shows empty state when no courses match the search', async () => {
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeSnapshot(sampleCourses));
      return () => {};
    });
    render(<Dashboard onPlay={vi.fn()} />);
    await waitFor(() => screen.getByText('React Basics'));
    fireEvent.change(screen.getByPlaceholderText(/Busca cursos/i), { target: { value: 'noresult' } });
    expect(screen.getByText('No encontramos resultados')).toBeInTheDocument();
  });

  it('handles snapshot errors', async () => {
    mocks.handleFirestoreError.mockImplementation(() => {});
    mocks.onSnapshot.mockImplementation((_q, _opts, _onNext, onError) => {
      onError(new Error('forbidden'));
      return () => {};
    });
    render(<Dashboard onPlay={vi.fn()} />);
    await waitFor(() => expect(mocks.handleFirestoreError).toHaveBeenCalled());
    const callArgs = mocks.handleFirestoreError.mock.calls[0];
    expect(callArgs[1]).toBe('list');
    expect(callArgs[2]).toBe('courses');
  });
});
