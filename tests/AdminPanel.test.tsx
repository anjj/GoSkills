import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    onSnapshot: vi.fn(),
    addDoc: vi.fn(),
    setDoc: vi.fn(),
    deleteDoc: vi.fn(),
    handleFirestoreError: vi.fn(),
    fetchMock: vi.fn(),
    confirmMock: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((..._args: any[]) => ({})),
  query: vi.fn((c: any) => c),
  orderBy: vi.fn(),
  onSnapshot: (...args: any[]) => mocks.onSnapshot(...args),
  addDoc: (...args: any[]) => mocks.addDoc(...args),
  setDoc: (...args: any[]) => mocks.setDoc(...args),
  deleteDoc: (...args: any[]) => mocks.deleteDoc(...args),
  doc: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => 'now'),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  db: {},
  storage: {},
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    }
  },
  handleFirestoreError: (...args: any[]) => mocks.handleFirestoreError(...args),
  OperationType: { CREATE: 'create', WRITE: 'write', DELETE: 'delete' },
}));

import AdminPanel from '../src/components/AdminPanel';

const sampleCourses = [
  {
    id: 'c1',
    title: 'Existing course',
    description: 'desc',
    thumbnailUrl: 'https://x.com/img.png',
    duration: '1h',
    category: 'Ventas',
    published: true,
    chapters: [{ id: 'ch1', title: 'Intro', text: 'hello', videoUrl: 'https://video.com/a' }],
  },
];

function makeCoursesSnap(arr: any[]) {
  return {
    docs: arr.map((c) => {
      const { id, ...rest } = c;
      return { id, data: () => rest };
    }),
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((m: any) => m.mockReset?.());
  mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
    onNext(makeCoursesSnap(sampleCourses));
    return () => {};
  });
  // @ts-ignore
  global.fetch = mocks.fetchMock;
  // @ts-ignore
  global.confirm = mocks.confirmMock;
  window.confirm = mocks.confirmMock as any;
});

describe('AdminPanel - locked (non-admin) view', () => {
  it('shows password prompt when isAdmin is false and view=list', () => {
    render(
      <AdminPanel isAdmin={false} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );
    expect(screen.getByText('Gestión de Cursos')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
  });

  it('successfully verifies admin password', async () => {
    const setIsAdmin = vi.fn();
    mocks.fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <AdminPanel isAdmin={false} setIsAdmin={setIsAdmin} view="list" onViewChange={vi.fn()} />
    );

    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /Acceder a Gestión/i }));

    await waitFor(() => expect(setIsAdmin).toHaveBeenCalledWith(true));
  });

  it('shows error when password is wrong', async () => {
    mocks.fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, message: 'wrong pw' }),
    });

    render(
      <AdminPanel isAdmin={false} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );

    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /Acceder a Gestión/i }));

    await waitFor(() => expect(screen.getByText('wrong pw')).toBeInTheDocument());
  });

  it('shows generic error when network fails', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new Error('network fail'));

    render(
      <AdminPanel isAdmin={false} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );

    fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Acceder a Gestión/i }));

    await waitFor(() =>
      expect(screen.getByText('Error al conectar con el servidor')).toBeInTheDocument()
    );
  });

  it('triggers onViewChange when clicking the create-without-login link', () => {
    const onViewChange = vi.fn();
    render(
      <AdminPanel isAdmin={false} setIsAdmin={vi.fn()} view="list" onViewChange={onViewChange} />
    );
    fireEvent.click(screen.getByText(/simplemente crea un nuevo curso/));
    expect(onViewChange).toHaveBeenCalledWith('create');
  });
});

describe('AdminPanel - admin list view', () => {
  it('renders list of courses', async () => {
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('Existing course')).toBeInTheDocument());
    expect(screen.getByText('Ventas')).toBeInTheDocument();
  });

  it('navigates to create view when clicking the new course button', async () => {
    const onViewChange = vi.fn();
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={onViewChange} />
    );
    await waitFor(() => screen.getByText('Existing course'));
    fireEvent.click(screen.getByRole('button', { name: /Crear Nuevo Curso/i }));
    expect(onViewChange).toHaveBeenCalledWith('create');
  });

  it('deletes a course after confirmation', async () => {
    mocks.confirmMock.mockReturnValue(true);
    mocks.deleteDoc.mockResolvedValueOnce(undefined);

    const { container } = render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Existing course'));

    const buttons = container.querySelectorAll('button');
    const trashBtn = Array.from(buttons).find((b) =>
      b.querySelector('svg.lucide-trash2')
    );
    expect(trashBtn).toBeTruthy();
    fireEvent.click(trashBtn!);
    expect(mocks.confirmMock).toHaveBeenCalled();
    await waitFor(() => expect(mocks.deleteDoc).toHaveBeenCalled());
  });

  it('does not delete when user cancels confirmation', async () => {
    mocks.confirmMock.mockReturnValue(false);
    const { container } = render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Existing course'));

    const buttons = container.querySelectorAll('button');
    const trashBtn = Array.from(buttons).find((b) =>
      b.querySelector('svg.lucide-trash2')
    );
    fireEvent.click(trashBtn!);
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it('handles delete error', async () => {
    mocks.confirmMock.mockReturnValue(true);
    mocks.deleteDoc.mockRejectedValueOnce(new Error('forbidden'));
    mocks.handleFirestoreError.mockImplementation(() => {});

    const { container } = render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );
    await waitFor(() => screen.getByText('Existing course'));

    const trashBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.querySelector('svg.lucide-trash2')
    );
    fireEvent.click(trashBtn!);
    await waitFor(() => expect(mocks.handleFirestoreError).toHaveBeenCalled());
  });

  it('shows empty state when no courses', async () => {
    mocks.onSnapshot.mockImplementation((_q, _opts, onNext) => {
      onNext(makeCoursesSnap([]));
      return () => {};
    });
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText(/No hay cursos publicados/)).toBeInTheDocument());
  });
});

describe('AdminPanel - create view validation', () => {
  it('shows validation errors on empty submit', async () => {
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Crear Curso Completo/i }));
    await waitFor(() => expect(screen.getByText('El título es obligatorio')).toBeInTheDocument());
    expect(screen.getByText('La categoría es obligatoria')).toBeInTheDocument();
    expect(screen.getByText(/título del capítulo/i)).toBeInTheDocument();
    expect(screen.getByText(/vídeo es obligatorio/i)).toBeInTheDocument();
  });

  it('rejects non-http video URLs', async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );

    await user.type(screen.getByPlaceholderText(/Ej. Ventas, Tecnología/), 'Ventas');

    const inputs = document.querySelectorAll('input[type="text"]');
    // First text input is title, then category, then chapter title, then video URL
    const titleInput = inputs[0] as HTMLInputElement;
    await user.type(titleInput, 'My title');

    const chapterTitleInput = document.querySelector('input[placeholder*="Introducción al concepto"]') as HTMLInputElement;
    await user.type(chapterTitleInput, 'Chapter');

    const videoInput = document.querySelector('input[placeholder*="URL del vídeo"]') as HTMLInputElement;
    await user.type(videoInput, 'not-a-url');

    fireEvent.click(screen.getByRole('button', { name: /Crear Curso Completo/i }));
    await waitFor(() =>
      expect(screen.getByText(/URL de vídeo válida/)).toBeInTheDocument()
    );
  });

  it('adds and removes chapters', async () => {
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Nuevo Capítulo/i }));
    expect(screen.getByText(/Título del Capítulo 2/)).toBeInTheDocument();
  });

  it('toggles published state', () => {
    const { container } = render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );

    const toggleButton = container.querySelector(
      'button.relative.inline-flex.h-6.w-11'
    ) as HTMLButtonElement;
    expect(toggleButton.className).toContain('bg-brand');
    fireEvent.click(toggleButton);
    expect(toggleButton.className).toContain('bg-gray-200');
  });

  it('cancels and resets form', () => {
    const onViewChange = vi.fn();
    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={onViewChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onViewChange).toHaveBeenCalledWith('list');
  });

  it('submits a new course successfully', async () => {
    mocks.addDoc.mockResolvedValueOnce({ id: 'newId' });
    const user = userEvent.setup();

    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );

    const inputs = document.querySelectorAll('input[type="text"]');
    await user.type(inputs[0] as HTMLInputElement, 'My Course');
    await user.type(inputs[1] as HTMLInputElement, 'Tecnología');

    const chapterTitleInput = document.querySelector('input[placeholder*="Introducción al concepto"]') as HTMLInputElement;
    await user.type(chapterTitleInput, 'Chapter 1');

    const videoInput = document.querySelector('input[placeholder*="URL del vídeo"]') as HTMLInputElement;
    await user.type(videoInput, 'https://video.example/a.mp4');

    fireEvent.click(screen.getByRole('button', { name: /Crear Curso Completo/i }));

    await waitFor(() => expect(mocks.addDoc).toHaveBeenCalled());
    const dataPassed = mocks.addDoc.mock.calls[0][1];
    expect(dataPassed.title).toBe('My Course');
    expect(dataPassed.category).toBe('Tecnología');
    expect(dataPassed.chapters[0].videoUrl).toBe('https://video.example/a.mp4');
  });
});

describe('AdminPanel - file upload', () => {
  it('rejects non-video file types', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fakeFile = new File(['x'], 'bad.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('vídeo válidos'));
    alertSpy.mockRestore();
  });

  it('uploads a valid video and updates the chapter URL', async () => {
    // 1. Mock fetch for the pre-signed URL step
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === '/api/upload/presign') {
        return {
          ok: true,
          json: async () => ({
            presignedUrl: 'https://fake-s3-presigned-url.com',
            fileUrl: 'https://uploaded.example/x.mp4'
          })
        };
      }
      return originalFetch(url);
    });

    type XhrInstance = {
      upload: { onprogress: ((e: any) => void) | null };
      onload: ((this: any) => void) | null;
      onerror: ((this: any) => void) | null;
      open: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      setRequestHeader: ReturnType<typeof vi.fn>;
      status: number;
      responseText: string;
      statusText: string;
    };
    const xhrInstances: XhrInstance[] = [];
    function xhrMock(this: any) {
      this.upload = { onprogress: null };
      this.onload = null;
      this.onerror = null;
      this.open = vi.fn();
      this.send = vi.fn();
      this.setRequestHeader = vi.fn();
      this.status = 200;
      this.responseText = '';
      this.statusText = 'OK';
      xhrInstances.push(this);
    }
    const originalXhr = window.XMLHttpRequest;
    (window as any).XMLHttpRequest = xhrMock;

    render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['abc'], 'video.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(xhrInstances.length).toBe(1));
    const inst = xhrInstances[0];
    inst.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    inst.onload?.call(inst as any);

    await waitFor(() => {
      const videoInput = document.querySelector('input[placeholder*="URL del vídeo"]') as HTMLInputElement;
      expect(videoInput.value).toBe('https://uploaded.example/x.mp4');
    });

    (window as any).XMLHttpRequest = originalXhr;
    global.fetch = originalFetch;
  });

});

describe('AdminPanel - edit existing course', () => {
  it('populates the form when edit button is clicked and saves with setDoc', async () => {
    mocks.setDoc.mockResolvedValueOnce(undefined);
    const onViewChange = vi.fn();

    const { rerender } = render(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="list" onViewChange={onViewChange} />
    );
    await waitFor(() => screen.getByText('Existing course'));

    const settingsBtns = Array.from(document.querySelectorAll('button')).filter((b) =>
      b.querySelector('svg.lucide-settings')
    );
    fireEvent.click(settingsBtns[0]);
    expect(onViewChange).toHaveBeenCalledWith('create');

    rerender(
      <AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={onViewChange} />
    );

    expect(screen.getByText('Editar Curso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Guardar Cambios/i }));
    await waitFor(() => expect(mocks.setDoc).toHaveBeenCalled());
  });

  it('rejects videos larger than 100MB', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = userEvent.setup();
    render(<AdminPanel isAdmin={true} setIsAdmin={vi.fn()} view="create" onViewChange={vi.fn()} />);

    // Create a mock file with size > 100MB
    const largeFile = new File(['a'.repeat(1024)], 'large.webm', { type: 'video/webm' });
    Object.defineProperty(largeFile, 'size', { value: 101 * 1024 * 1024 });

    const fileInput = screen.getByText(/Vídeo del Capítulo/i).parentElement?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    await user.upload(fileInput, largeFile);

    expect(alertMock).toHaveBeenCalledWith('El archivo es demasiado grande. El tamaño máximo permitido es 100MB.');
    alertMock.mockRestore();
  });
});