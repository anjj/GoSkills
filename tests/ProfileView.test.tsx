import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getDocs: vi.fn(),
    onSnapshot: vi.fn(),
    handleFirestoreError: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((..._args: any[]) => ({})),
  query: vi.fn((c: any) => c),
  getDocs: (...args: any[]) => mocks.getDocs(...args),
  onSnapshot: (...args: any[]) => mocks.onSnapshot(...args),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: {},
  handleFirestoreError: (...args: any[]) => mocks.handleFirestoreError(...args),
  OperationType: { LIST: 'list' },
}));

import ProfileView from '../src/components/ProfileView';

const sampleCourses = [
  { id: 'a', title: 'Course A', category: 'Tecnología', duration: '1h' },
  { id: 'b', title: 'Course B', category: 'Ventas', duration: '2h' },
  { id: 'c', title: 'Course C', category: 'RRHH', duration: '30min' },
];

function makeCoursesSnap(arr: any[]) {
  return {
    docs: arr.map((c) => {
      const { id, ...rest } = c;
      return { id, data: () => rest };
    }),
  };
}

function makeProgressSnap(progress: { id: string; completed: boolean }[]) {
  return {
    docs: progress.map((p) => ({ id: p.id, data: () => ({ completed: p.completed }) })),
  };
}

beforeEach(() => {
  mocks.getDocs.mockReset();
  mocks.onSnapshot.mockReset();
  mocks.handleFirestoreError.mockReset();
});

describe('ProfileView', () => {
  it('shows the loading state', () => {
    mocks.getDocs.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ProfileView userId="u1" />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders stats and course lists', async () => {
    mocks.getDocs.mockResolvedValue(makeCoursesSnap(sampleCourses));
    mocks.onSnapshot.mockImplementation((_q, onNext) => {
      onNext(makeProgressSnap([{ id: 'a', completed: true }, { id: 'b', completed: false }]));
      return () => {};
    });

    render(<ProfileView userId="u1" />);

    await waitFor(() => expect(screen.getByText('Course A')).toBeInTheDocument());

    expect(screen.getByText('Cursos Disponibles')).toBeInTheDocument();
    expect(screen.getByText('Cursos Completados')).toBeInTheDocument();
    expect(screen.getByText('Progreso Total')).toBeInTheDocument();

    expect(screen.getByText('3')).toBeInTheDocument();
    const ones = screen.getAllByText('1');
    expect(ones.length).toBeGreaterThan(0);
    expect(screen.getByText('33%')).toBeInTheDocument();

    expect(screen.getByText('Course B')).toBeInTheDocument();
    expect(screen.getByText('Course C')).toBeInTheDocument();
    expect(screen.getByText('Finalizado')).toBeInTheDocument();
  });

  it('handles 0 courses gracefully (0% progress, empty messages)', async () => {
    mocks.getDocs.mockResolvedValue(makeCoursesSnap([]));
    mocks.onSnapshot.mockImplementation((_q, onNext) => {
      onNext(makeProgressSnap([]));
      return () => {};
    });

    render(<ProfileView userId="u1" />);
    await waitFor(() => expect(screen.getByText(/Enhorabuena/)).toBeInTheDocument());
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText(/Aún no has finalizado/)).toBeInTheDocument();
  });

  it('handles getDocs failures gracefully', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getDocs.mockRejectedValueOnce(new Error('forbidden'));

    render(<ProfileView userId="u1" />);
    await waitFor(() => expect(screen.queryByText(/Cursos Disponibles/)).toBeInTheDocument());
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('forwards snapshot errors to handleFirestoreError', async () => {
    mocks.getDocs.mockResolvedValue(makeCoursesSnap(sampleCourses));
    mocks.handleFirestoreError.mockImplementation(() => {});
    mocks.onSnapshot.mockImplementation((_q, _onNext, onError) => {
      onError(new Error('blocked'));
      return () => {};
    });

    render(<ProfileView userId="u1" />);
    await waitFor(() => expect(mocks.handleFirestoreError).toHaveBeenCalled());
    expect(mocks.handleFirestoreError.mock.calls[0][1]).toBe('list');
  });
});
