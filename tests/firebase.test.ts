import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockedAuth, mockTransaction } = vi.hoisted(() => ({
  mockedAuth: { currentUser: null as any },
  mockTransaction: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockedAuth),
  GoogleAuthProvider: vi.fn().mockImplementation(function (this: any) {
    this.providerId = 'google.com';
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((_db: any, ...segments: string[]) => ({ path: segments.join('/') })),
  getDocFromServer: vi.fn(() => Promise.resolve({})),
  runTransaction: vi.fn((_db: any, fn: (tx: any) => Promise<any>) => fn(mockTransaction)),
  setDoc: vi.fn(() => Promise.resolve()),
  increment: vi.fn((n: number) => ({ __increment: n })),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
}));

import {
  OperationType,
  handleFirestoreError,
  signIn,
  logout,
  db,
  auth,
  storage,
  googleProvider,
  trackCourseView,
  trackChapterView,
  trackCourseCompletion,
} from '../src/lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { runTransaction as firestoreRunTransaction, setDoc as firestoreSetDoc } from 'firebase/firestore';

beforeEach(() => {
  mockedAuth.currentUser = null;
  vi.clearAllMocks();
});

describe('OperationType enum', () => {
  it('exposes the expected operations', () => {
    expect(OperationType.CREATE).toBe('create');
    expect(OperationType.UPDATE).toBe('update');
    expect(OperationType.DELETE).toBe('delete');
    expect(OperationType.LIST).toBe('list');
    expect(OperationType.GET).toBe('get');
    expect(OperationType.WRITE).toBe('write');
  });
});

describe('module exports', () => {
  it('exports firebase singletons and provider', () => {
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
    expect(storage).toBeDefined();
    expect(googleProvider).toBeDefined();
  });
});

describe('handleFirestoreError', () => {
  it('throws an Error wrapping the original message and metadata', () => {
    expect(() => handleFirestoreError(new Error('boom'), OperationType.GET, 'courses/abc')).toThrow();

    try {
      handleFirestoreError(new Error('boom'), OperationType.GET, 'courses/abc');
    } catch (e: any) {
      const parsed = JSON.parse(e.message);
      expect(parsed.error).toBe('boom');
      expect(parsed.operationType).toBe('get');
      expect(parsed.path).toBe('courses/abc');
      expect(parsed.authInfo).toBeDefined();
      expect(parsed.authInfo.providerInfo).toEqual([]);
    }
  });

  it('includes auth info from current user', () => {
    mockedAuth.currentUser = {
      uid: 'user-1',
      email: 'a@b.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [{ providerId: 'google.com', email: 'a@b.com' }],
    };

    try {
      handleFirestoreError(new Error('nope'), OperationType.WRITE, 'docs/1');
    } catch (e: any) {
      const parsed = JSON.parse(e.message);
      expect(parsed.authInfo.userId).toBe('user-1');
      expect(parsed.authInfo.email).toBe('a@b.com');
      expect(parsed.authInfo.providerInfo).toEqual([{ providerId: 'google.com', email: 'a@b.com' }]);
    }
  });

  it('handles non-Error thrown values', () => {
    try {
      handleFirestoreError('string error', OperationType.LIST, null);
    } catch (e: any) {
      const parsed = JSON.parse(e.message);
      expect(parsed.error).toBe('string error');
      expect(parsed.path).toBeNull();
    }
  });
});

describe('signIn', () => {
  it('returns the user on success', async () => {
    (signInWithPopup as any).mockResolvedValueOnce({ user: { uid: 'abc' } });
    const user = await signIn();
    expect(user).toEqual({ uid: 'abc' });
  });

  it('rethrows on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signInWithPopup as any).mockRejectedValueOnce(new Error('popup blocked'));
    await expect(signIn()).rejects.toThrow('popup blocked');
    errorSpy.mockRestore();
  });
});

describe('logout', () => {
  it('calls firebase signOut', async () => {
    (signOut as any).mockResolvedValueOnce(undefined);
    await logout();
    expect(signOut).toHaveBeenCalled();
  });

  it('rethrows on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signOut as any).mockRejectedValueOnce(new Error('network'));
    await expect(logout()).rejects.toThrow('network');
    errorSpy.mockRestore();
  });
});

describe('trackCourseView', () => {
  beforeEach(() => {
    mockTransaction.get.mockReset();
    mockTransaction.set.mockReset();
    (firestoreRunTransaction as any).mockClear();
  });

  it('does nothing when no user is logged in', async () => {
    mockedAuth.currentUser = null;
    await trackCourseView('course1');
    expect(firestoreRunTransaction).not.toHaveBeenCalled();
  });

  it('runs a transaction and increments views and uniqueViewers on first view', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    mockTransaction.get.mockResolvedValueOnce({ exists: () => false });

    await trackCourseView('course1');

    expect(firestoreRunTransaction).toHaveBeenCalledOnce();
    // First set creates the viewer doc
    expect(mockTransaction.set).toHaveBeenCalledTimes(2);
    const statsCall = mockTransaction.set.mock.calls.find(
      (c: any[]) => c[1]?.uniqueViewers !== undefined
    );
    expect(statsCall).toBeTruthy();
    expect(statsCall[1].views).toMatchObject({ __increment: 1 });
    expect(statsCall[1].uniqueViewers).toMatchObject({ __increment: 1 });
  });

  it('only increments views (not uniqueViewers) on repeat view', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    mockTransaction.get.mockResolvedValueOnce({ exists: () => true });

    await trackCourseView('course1');

    const statsCall = mockTransaction.set.mock.calls.find(
      (c: any[]) => c[1]?.views !== undefined
    );
    expect(statsCall).toBeTruthy();
    expect(statsCall[1].views).toMatchObject({ __increment: 1 });
    expect(statsCall[1].uniqueViewers).toBeUndefined();
  });

  it('fails silently when the transaction throws', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    (firestoreRunTransaction as any).mockRejectedValueOnce(new Error('tx fail'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(trackCourseView('course1')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('trackChapterView', () => {
  beforeEach(() => {
    (firestoreSetDoc as any).mockClear();
  });

  it('does nothing when no user is logged in', async () => {
    mockedAuth.currentUser = null;
    await trackChapterView('course1', 'ch1');
    expect(firestoreSetDoc).not.toHaveBeenCalled();
  });

  it('calls setDoc with an increment for the chapter', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    await trackChapterView('course1', 'ch1');
    expect(firestoreSetDoc).toHaveBeenCalledOnce();
    const [, data, opts] = (firestoreSetDoc as any).mock.calls[0];
    expect(data['chapterViews.ch1']).toMatchObject({ __increment: 1 });
    expect(opts).toEqual({ merge: true });
  });

  it('fails silently when setDoc throws', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    (firestoreSetDoc as any).mockRejectedValueOnce(new Error('write fail'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(trackChapterView('course1', 'ch1')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('trackCourseCompletion', () => {
  beforeEach(() => {
    (firestoreSetDoc as any).mockClear();
  });

  it('does nothing when no user is logged in', async () => {
    mockedAuth.currentUser = null;
    await trackCourseCompletion('course1', true);
    expect(firestoreSetDoc).not.toHaveBeenCalled();
  });

  it('increments completions when completed=true', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    await trackCourseCompletion('course1', true);
    const [, data] = (firestoreSetDoc as any).mock.calls[0];
    expect(data.completions).toMatchObject({ __increment: 1 });
  });

  it('decrements completions when completed=false', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    await trackCourseCompletion('course1', false);
    const [, data] = (firestoreSetDoc as any).mock.calls[0];
    expect(data.completions).toMatchObject({ __increment: -1 });
  });

  it('fails silently when setDoc throws', async () => {
    mockedAuth.currentUser = { uid: 'user-1' };
    (firestoreSetDoc as any).mockRejectedValueOnce(new Error('fail'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(trackCourseCompletion('course1', true)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
