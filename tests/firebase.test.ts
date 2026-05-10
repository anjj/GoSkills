import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockedAuth } = vi.hoisted(() => ({
  mockedAuth: { currentUser: null as any },
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
  doc: vi.fn(() => ({})),
  getDocFromServer: vi.fn(() => Promise.resolve({})),
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
} from '../src/lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

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
