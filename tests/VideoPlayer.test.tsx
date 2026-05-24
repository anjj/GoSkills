import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getDocs: vi.fn(),
    fetchMock: vi.fn(),
    getIdToken: vi.fn(),
    currentUser: { uid: 'user-1' } as any,
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((c: any) => c),
  where: vi.fn(() => ({})),
  getDocs: (...args: any[]) => mocks.getDocs(...args),
}));

vi.mock('../src/lib/firebase', () => ({
  db: {},
  auth: {
    get currentUser() {
      return mocks.currentUser;
    },
  },
}));

import VideoPlayer from '../src/components/VideoPlayer';

const sampleCourse = {
  id: 'course-1',
  title: 'Sample',
  description: 'desc',
  thumbnailUrl: 'https://x.com/thumb.png',
  duration: '1h 0min',
  category: 'Ventas',
  published: true,
  createdAt: 0 as any,
  chapters: [
    { id: 'c1', title: 'Intro', text: 'first chapter', videoUrl: 'https://example.com/video1.mp4' },
    { id: 'c2', title: 'Second', text: 'second chapter', videoUrl: 'https://www.youtube.com/watch?v=abc&t=10' },
    { id: 'c3', title: 'Third', text: '', videoUrl: '' },
  ],
};

beforeEach(() => {
  mocks.getDocs.mockReset();
  mocks.fetchMock.mockReset();
  mocks.getIdToken.mockReset();
  mocks.getIdToken.mockResolvedValue('token-abc');
  mocks.currentUser = { uid: 'user-1', getIdToken: mocks.getIdToken };
  mocks.getDocs.mockResolvedValue({ docs: [] });
  // @ts-ignore
  global.fetch = mocks.fetchMock;
  mocks.fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ presignedUrl: 'https://signed.example.com/video' }),
  });
});

describe('VideoPlayer', () => {
  it('renders the first chapter and back button', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    expect(screen.getByText('Volver al Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('Intro').length).toBeGreaterThan(0);
    expect(screen.getByText(/Capítulo 1 de 3/)).toBeInTheDocument();
    expect(screen.getByText('first chapter')).toBeInTheDocument();
  });

  it('calls onBack when clicking back', () => {
    const onBack = vi.fn();
    render(<VideoPlayer course={sampleCourse} onBack={onBack} />);
    fireEvent.click(screen.getByText('Volver al Dashboard'));
    expect(onBack).toHaveBeenCalled();
  });

  it('switches chapters when clicking on the sidebar items', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Second'));
    await waitFor(() => expect(screen.getByText(/Capítulo 2 de 3/)).toBeInTheDocument());
    expect(screen.getByText('second chapter')).toBeInTheDocument();
  });

  it('renders the YouTube iframe for YouTube URLs', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Second'));
    await waitFor(() => {
      const iframe = document.querySelector('iframe');
      expect(iframe).toBeTruthy();
      expect(iframe?.getAttribute('src')).toContain('youtube.com/embed/abc');
    });
  });

  it('renders the empty placeholder for chapters without a video', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Third'));
    await waitFor(() =>
      expect(screen.getByText(/Contenido solo de lectura/)).toBeInTheDocument()
    );
  });

  it('auto-marks a chapter when its video ends', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);
    fireEvent.ended(video);

    await waitFor(() =>
      expect(
        mocks.fetchMock.mock.calls.find((c) => c[0] === '/api/progress/chapter-completed')
      ).toBeTruthy()
    );
    const call = mocks.fetchMock.mock.calls.find((c) => c[0] === '/api/progress/chapter-completed')!;
    const body = JSON.parse(call[1].body);
    expect(body.courseId).toBe('course-1');
    expect(body.chapterId).toBe('c1');
    expect(call[1].headers.Authorization).toBe('Bearer token-abc');
  });

  it('logs an error when the completion request is rejected', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    fireEvent.ended(video);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });

  it('reflects already-completed progress on mount', async () => {
    mocks.getDocs.mockResolvedValueOnce({
      docs: sampleCourse.chapters.map((c) => ({
        data: () => ({ chapterId: c.id, courseId: 'course-1' }),
      })),
    });
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Curso Completado/)).toBeInTheDocument());
  });

  it('does not record completion when there is no current user', async () => {
    mocks.currentUser = null;
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);
    fireEvent.ended(video);
    expect(
      mocks.fetchMock.mock.calls.find((c) => c[0] === '/api/progress/chapter-completed')
    ).toBeUndefined();
  });

  it('handles progress-load errors silently', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getDocs.mockRejectedValueOnce(new Error('blocked'));
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });

  it('handles a course with no chapters', () => {
    const empty = { ...sampleCourse, chapters: [] };
    render(<VideoPlayer course={empty} onBack={vi.fn()} />);
    expect(screen.getByText('Volver al Dashboard')).toBeInTheDocument();
  });
});

describe('CustomVideoPlayer (via VideoPlayer)', () => {
  it('fetches a presigned URL for S3 videos', async () => {
    const courseS3 = {
      ...sampleCourse,
      chapters: [
        {
          id: 'c1',
          title: 'Intro',
          text: '',
          videoUrl: 'https://my-bucket.s3.amazonaws.com/video.mp4',
        },
      ],
    };
    render(<VideoPlayer course={courseS3} onBack={vi.fn()} />);
    await waitFor(() => expect(mocks.fetchMock).toHaveBeenCalled());
    expect(mocks.fetchMock.mock.calls[0][0]).toBe('/api/video/presign');
  });

  it('falls back to original src when presign fetch fails', async () => {
    mocks.fetchMock.mockRejectedValueOnce(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const courseS3 = {
      ...sampleCourse,
      chapters: [
        {
          id: 'c1',
          title: 'Intro',
          text: '',
          videoUrl: 'https://my-bucket.s3.amazonaws.com/video.mp4',
        },
      ],
    };
    render(<VideoPlayer course={courseS3} onBack={vi.fn()} />);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });

  it('falls back to original src when presign returns non-OK', async () => {
    mocks.fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const courseS3 = {
      ...sampleCourse,
      chapters: [
        {
          id: 'c1',
          title: 'Intro',
          text: '',
          videoUrl: 'https://my-bucket.s3.amazonaws.com/video.mp4',
        },
      ],
    };
    render(<VideoPlayer course={courseS3} onBack={vi.fn()} />);
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
  });

  it('plays and pauses the video', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => {
      const v = document.querySelector('video');
      expect(v).toBeTruthy();
      return v!;
    });
    const playSpy = vi.spyOn(video, 'play');
    const pauseSpy = vi.spyOn(video, 'pause');

    fireEvent.click(video);
    expect(playSpy).toHaveBeenCalled();

    fireEvent.play(video);
    fireEvent.click(video);
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('shows the error overlay when video errors', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);
    fireEvent.error(video);
    await waitFor(() =>
      expect(screen.getByText('Error al cargar el video')).toBeInTheDocument()
    );
  });

  it('handles time and progress updates', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);
    let _currentTime = 50;
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => _currentTime,
      set: (v) => { _currentTime = v; },
    });
    Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
    fireEvent.timeUpdate(video);

    const progressInput = document.querySelector('input[type="range"]') as HTMLInputElement;
    expect(progressInput).toBeTruthy();
    fireEvent.change(progressInput, { target: { value: '25' } });
    expect(_currentTime).toBe(25);
  });

  it('toggles fullscreen', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    await waitFor(() => document.querySelector('video'));
    const buttons = document.querySelectorAll('button');
    const fullscreenBtn = Array.from(buttons).find((b) =>
      b.querySelector('svg.lucide-maximize')
    );
    expect(fullscreenBtn).toBeTruthy();
    fireEvent.click(fullscreenBtn!);
    expect(Element.prototype.requestFullscreen).toHaveBeenCalled();
  });

  it('toggles mute', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    await waitFor(() => document.querySelector('video'));
    const buttons = document.querySelectorAll('button');
    const muteBtn = Array.from(buttons).find((b) =>
      b.querySelector('svg.lucide-volume2')
    );
    expect(muteBtn).toBeTruthy();
    fireEvent.click(muteBtn!);
  });
});
