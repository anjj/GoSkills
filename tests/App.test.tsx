import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    onAuthStateChanged: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithMicrosoft: vi.fn(),
    logout: vi.fn(),
    fetchMock: vi.fn(),
  },
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: any[]) => mocks.onAuthStateChanged(...args),
}));

vi.mock('../src/lib/firebase', () => ({
  auth: {},
  signInWithGoogle: (...args: any[]) => mocks.signInWithGoogle(...args),
  signInWithMicrosoft: (...args: any[]) => mocks.signInWithMicrosoft(...args),
  logout: (...args: any[]) => mocks.logout(...args),
}));

vi.mock('../src/components/Dashboard', () => ({
  default: ({ onPlay }: any) => (
    <div data-testid="dashboard">
      Dashboard
      <button onClick={() => onPlay({ id: 'cx', title: 'X', chapters: [] })}>play</button>
    </div>
  ),
}));

vi.mock('../src/components/ProfileView', () => ({
  default: ({ userId }: any) => <div data-testid="profile">Profile {userId}</div>,
}));

vi.mock('../src/components/AdminPanel', () => ({
  default: ({ isAdmin, view }: any) => (
    <div data-testid="admin">Admin isAdmin={String(isAdmin)} view={view}</div>
  ),
}));

vi.mock('../src/components/VideoPlayer', () => ({
  default: ({ course, onBack }: any) => (
    <div data-testid="player">
      Player {course.title}
      <button onClick={onBack}>back</button>
    </div>
  ),
}));

import App from '../src/App';

beforeEach(() => {
  Object.values(mocks).forEach((m: any) => m.mockReset?.());
  // @ts-ignore
  global.fetch = mocks.fetchMock;
});

describe('App authentication flow', () => {
  it('renders the loading spinner initially', () => {
    mocks.onAuthStateChanged.mockImplementation((_auth: any, _cb: any) => {
      return () => {};
    });
    const { container } = render(<App />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders the login screen when no user', async () => {
    mocks.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb(null);
      return () => {};
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Acceso con Google/)).toBeInTheDocument());
    expect(screen.getByText(/Acceso con Microsoft/)).toBeInTheDocument();
  });

  it('triggers signIn on click', async () => {
    mocks.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb(null);
      return () => {};
    });
    render(<App />);
    await waitFor(() => screen.getByText(/Acceso con Google/));
    fireEvent.click(screen.getByRole('button', { name: /Acceso con Google/i }));
    expect(mocks.signInWithGoogle).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Acceso con Microsoft/i }));
    expect(mocks.signInWithMicrosoft).toHaveBeenCalled();
  });

  it('renders dashboard when user is allowed', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      json: async () => ({ allowed: true }),
    });
    mocks.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb({ uid: '1', email: 'a@b.com', displayName: 'A B', photoURL: '' });
      return () => {};
    });
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('dashboard')).toBeInTheDocument());
  });

  it('shows error when user domain is rejected', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      json: async () => ({ allowed: false }),
    });
    mocks.logout.mockResolvedValueOnce(undefined);
    mocks.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb({ uid: '1', email: 'a@evil.com' });
      return () => {};
    });
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/dominio de correo no tiene acceso/)).toBeInTheDocument()
    );
    expect(mocks.logout).toHaveBeenCalled();
  });

  it('falls through to dashboard when domain check throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.fetchMock.mockRejectedValueOnce(new Error('boom'));
    mocks.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb({ uid: '1', email: 'a@b.com', displayName: 'A B' });
      return () => {};
    });
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('dashboard')).toBeInTheDocument());
    errorSpy.mockRestore();
  });
});

describe('App navigation', () => {
  beforeEach(() => {
    mocks.fetchMock.mockResolvedValue({ json: async () => ({ allowed: true }) });
    mocks.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      cb({ uid: '1', email: 'a@b.com', displayName: 'A B', photoURL: 'https://x.com/img.png' });
      return () => {};
    });
  });

  it('navigates to profile from sidebar', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('dashboard'));
    fireEvent.click(screen.getByText('Mi Perfil'));
    await waitFor(() => expect(screen.getByTestId('profile')).toBeInTheDocument());
  });

  it('navigates to admin from sidebar', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('dashboard'));
    fireEvent.click(screen.getByText('Administración'));
    await waitFor(() => expect(screen.getByTestId('admin')).toBeInTheDocument());
  });

  it('plays a course and returns via back', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('dashboard'));
    fireEvent.click(screen.getByText('play'));
    await waitFor(() => expect(screen.getByTestId('player')).toBeInTheDocument());

    fireEvent.click(screen.getByText('back'));
    await waitFor(() => expect(screen.getByTestId('dashboard')).toBeInTheDocument());
  });

  it('logout from sidebar', async () => {
    mocks.logout.mockResolvedValueOnce(undefined);
    render(<App />);
    await waitFor(() => screen.getByTestId('dashboard'));
    fireEvent.click(screen.getByText('Cerrar Sesión'));
    expect(mocks.logout).toHaveBeenCalled();
  });

  it('opens and closes the mobile drawer', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('dashboard'));

    const buttons = document.querySelectorAll('button');
    const menuBtn = Array.from(buttons).find((b) => b.querySelector('svg.lucide-menu'));
    expect(menuBtn).toBeTruthy();
    fireEvent.click(menuBtn!);
    // Drawer adds Cerrar Sesión button - clicking close
    const closeBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.querySelector('svg.lucide-x')
    );
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn!);
  });

  it('clicking the header admin button navigates to admin view', async () => {
    render(<App />);
    await waitFor(() => screen.getByTestId('dashboard'));
    fireEvent.click(screen.getByRole('button', { name: /Acceso Admin/i }));
    await waitFor(() => expect(screen.getByTestId('admin')).toBeInTheDocument());
  });
});
