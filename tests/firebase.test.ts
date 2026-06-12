import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockedAuth } = vi.hoisted(() => ({
  mockedAuth: { currentUser: null as any },
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => mockedAuth),
  OAuthProvider: vi.fn().mockImplementation(function (this: any, providerId: string) {
    this.providerId = providerId;
    this.setCustomParameters = vi.fn();
  }),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
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
  signInWithMicrosoft,
  getMicrosoftRedirectResult,
  logout,
  db,
  auth,
  storage,
} from '../src/lib/firebase';
import { signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';

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
  it('exports firebase singletons', () => {
    expect(db).toBeDefined();
    expect(auth).toBeDefined();
    expect(storage).toBeDefined();
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

describe('signInWithMicrosoft', () => {
  it('triggers a redirect sign-in', async () => {
    (signInWithRedirect as any).mockResolvedValueOnce(undefined);
    await signInWithMicrosoft();
    expect(signInWithRedirect).toHaveBeenCalled();
  });

  it('rethrows on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (signInWithRedirect as any).mockRejectedValueOnce(new Error('redirect failed'));
    await expect(signInWithMicrosoft()).rejects.toThrow('redirect failed');
    errorSpy.mockRestore();
  });
});

describe('getMicrosoftRedirectResult', () => {
  it('delegates to firebase getRedirectResult', async () => {
    (getRedirectResult as any).mockResolvedValueOnce({ user: { uid: 'ghi' } });
    const result = await getMicrosoftRedirectResult();
    expect(getRedirectResult).toHaveBeenCalledWith(auth);
    expect(result).toEqual({ user: { uid: 'ghi' } });
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
