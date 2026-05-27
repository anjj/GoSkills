import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

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
    { id: 'c2', title: 'Second', text: 'second chapter', videoUrl: 'https://example.com/video2.mp4' },
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

describe('VideoPlayer Enhancements', () => {
  it('auto-marks a chapter when its video is near the end (fallback logic)', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);

    // Mock duration and currentTime to be > 99.5%
    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
    Object.defineProperty(video, 'currentTime', { value: 99.6, configurable: true });

    fireEvent.timeUpdate(video);

    await waitFor(() =>
      expect(
        mocks.fetchMock.mock.calls.find((c) => c[0] === '/api/progress/chapter-completed')
      ).toBeTruthy()
    );

    const call = mocks.fetchMock.mock.calls.find((c) => c[0] === '/api/progress/chapter-completed')!;
    const body = JSON.parse(call[1].body);
    expect(body.chapterId).toBe('c1');
  });

  it('shows CheckCircle for completed chapters in the sidebar', async () => {
    mocks.getDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ chapterId: 'c1', courseId: 'course-1' }) }
      ],
    });
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);

    await waitFor(() => {
        // The CheckCircle icon should be present for chapter 1
        const completedIcon = document.querySelector('svg.lucide-check-circle, svg.lucide-circle-check-big');
        expect(completedIcon).toBeTruthy();
    });
  });

  it('resets hasCalledEnded when switching chapters', async () => {
    render(<VideoPlayer course={sampleCourse} onBack={vi.fn()} />);
    const video = await waitFor(() => document.querySelector('video')!);

    // Finish first chapter
    fireEvent.ended(video);
    await waitFor(() =>
      expect(
        mocks.fetchMock.mock.calls.find((c) => c[0] === '/api/progress/chapter-completed')
      ).toBeTruthy()
    );

    // Switch to another chapter via the sidebar
    const sidebar = screen.getByText('Contenido').closest('div')!;
    const secondBtn = within(sidebar).getAllByRole('button').find(b => b.textContent?.includes('Second'))!;
    fireEvent.click(secondBtn);

    // Wait for the new chapter title to appear in the main player area
    await waitFor(() => expect(screen.getAllByText('Second')[0]).toBeInTheDocument());

    // In our tests, VideoPlayer might take a moment to update the video element
    await waitFor(async () => {
        const nextVideo = document.querySelector('video');
        expect(nextVideo).toBeTruthy();
        // Since both have same videoUrl mock, we trust the chapter switch happened
        fireEvent.ended(nextVideo!);

        const completionCalls = mocks.fetchMock.mock.calls.filter((c) => c[0] === '/api/progress/chapter-completed');
        // Filter out calls that were for c1
        const c2Calls = completionCalls.filter(c => JSON.parse(c[1].body).chapterId === 'c2');
        expect(c2Calls.length).toBe(1);
    }, { timeout: 3000 });
  });
});
