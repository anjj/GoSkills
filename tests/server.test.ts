import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';

const { sendMock, getSignedUrlMock, adminMocks } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
  adminMocks: {
    verifyIdToken: vi.fn(),
    chapters: [] as { id: string }[],
    txSet: vi.fn(),
    txUpdate: vi.fn(),
  },
}));

vi.mock('@aws-sdk/client-s3', () => {
  function S3Client(this: any) {
    this.send = sendMock;
  }
  function PutObjectCommand(this: any, input: any) {
    this.__type = 'Put';
    this.input = input;
  }
  function GetObjectCommand(this: any, input: any) {
    this.__type = 'Get';
    this.input = input;
  }
  return { S3Client, PutObjectCommand, GetObjectCommand };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: any[]) => getSignedUrlMock(...args),
}));

vi.mock('vite', () => ({
  createServer: vi.fn(),
}));

vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(() => ({})),
  cert: vi.fn(() => ({})),
  applicationDefault: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: (...a: any[]) => adminMocks.verifyIdToken(...a) })),
}));

// A minimal fake transaction that exercises the real endpoint logic: the course
// has `adminMocks.chapters`, and neither the chapter nor the progress doc exists
// yet (the count query reports 0 pre-write completions).
const runTransaction = async (cb: (tx: any) => any) => {
  const tx = {
    get: async (ref: any) => {
      const p: string = ref?.path || '';
      if (p === 'courses/course-1') {
        return { exists: true, get: (f: string) => (f === 'chapters' ? adminMocks.chapters : undefined) };
      }
      if (p.includes('/chapterCompletions/')) return { exists: false };
      if (p.includes('/progress/')) return { exists: false, get: () => undefined };
      return { size: 0 }; // the where() count query
    },
    set: (...a: any[]) => adminMocks.txSet(...a),
    update: (...a: any[]) => adminMocks.txUpdate(...a),
  };
  return cb(tx);
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    doc: vi.fn((p: string) => ({ path: p })),
    collection: vi.fn((p: string) => ({ path: p, where: vi.fn(() => ({ path: p })) })),
    runTransaction: (cb: any) => runTransaction(cb),
  })),
  FieldValue: { serverTimestamp: vi.fn(() => 'TS') },
}));

import { createApp } from '../server';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sendMock.mockReset();
  getSignedUrlMock.mockReset();
  adminMocks.verifyIdToken.mockReset();
  adminMocks.txSet.mockReset();
  adminMocks.txUpdate.mockReset();
  adminMocks.chapters = [];
  process.env = { ...ORIGINAL_ENV };
  // Ensure the real service account JSON is not used in tests;
  // the firebase-admin modules are fully mocked via vi.mock above.
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('POST /api/admin/verify', () => {
  it('returns 500 when ADMIN_ACCESS is not configured', async () => {
    delete process.env.ADMIN_ACCESS;
    const app = createApp();
    const res = await request(app).post('/api/admin/verify').send({ password: 'whatever' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/ADMIN_ACCESS/);
  });

  it('returns success when password matches ADMIN_ACCESS', async () => {
    process.env.ADMIN_ACCESS = 'secret123';
    const app = createApp();
    const res = await request(app).post('/api/admin/verify').send({ password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Acceso concedido' });
  });

  it('returns 401 when password is wrong', async () => {
    process.env.ADMIN_ACCESS = 'secret123';
    const app = createApp();
    const res = await request(app).post('/api/admin/verify').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Contraseña incorrecta');
  });

  it('returns 401 when password is missing', async () => {
    process.env.ADMIN_ACCESS = 'secret123';
    const app = createApp();
    const res = await request(app).post('/api/admin/verify').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/verify-domain', () => {
  it('allows everyone if ALLOW_DOMAINS is empty', async () => {
    process.env.ALLOW_DOMAINS = '';
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('allows everyone if ALLOW_DOMAINS is unset', async () => {
    delete process.env.ALLOW_DOMAINS;
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({ email: 'a@b.com' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('returns 400 if email is missing', async () => {
    process.env.ALLOW_DOMAINS = 'gmail.com';
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({});
    expect(res.status).toBe(400);
    expect(res.body.allowed).toBe(false);
    expect(res.body.error).toBe('Invalid email');
  });

  it('returns 400 if email lacks @', async () => {
    process.env.ALLOW_DOMAINS = 'gmail.com';
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({ email: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('allows email matching configured domain (case-insensitive)', async () => {
    process.env.ALLOW_DOMAINS = 'GMAIL.com,company.io';
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({ email: 'user@gmail.com' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(true);
  });

  it('rejects email outside of allowed domains', async () => {
    process.env.ALLOW_DOMAINS = 'gmail.com,company.io';
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({ email: 'user@evil.com' });
    expect(res.status).toBe(200);
    expect(res.body.allowed).toBe(false);
  });

  it('handles whitespace and case in domains list', async () => {
    process.env.ALLOW_DOMAINS = ' Gmail.com , Company.IO ';
    const app = createApp();
    const res = await request(app).post('/api/auth/verify-domain').send({ email: 'user@COMPANY.io' });
    expect(res.body.allowed).toBe(true);
  });
});

describe('POST /api/upload', () => {
  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_S3_BUCKET = 'my-bucket';
  });

  it('returns 400 when file is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/upload')
      .field('courseName', 'My Course');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required fields/);
  });

  it('returns 400 when courseName is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('hello'), { filename: 'test.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when AWS env vars are missing', async () => {
    delete process.env.AWS_REGION;
    const app = createApp();
    const res = await request(app)
      .post('/api/upload')
      .field('courseName', 'My Course')
      .attach('file', Buffer.from('hello'), { filename: 'test.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/AWS credentials/);
  });

  it('uploads file to S3 and returns the file URL', async () => {
    sendMock.mockResolvedValueOnce({});
    const app = createApp();
    const res = await request(app)
      .post('/api/upload')
      .field('courseName', 'My Cool Course!')
      .attach('file', Buffer.from('video bytes'), { filename: 'My Video.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(res.body.fileUrl).toMatch(
      /^https:\/\/my-bucket\.s3\.us-east-1\.amazonaws\.com\/my-cool-course-\/\d+-My-Video\.mp4$/
    );
    expect(res.body.key).toMatch(/^my-cool-course-\/\d+-My-Video\.mp4$/);
  });

  it('returns 500 when S3 send throws', async () => {
    sendMock.mockRejectedValueOnce(new Error('S3 down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    const res = await request(app)
      .post('/api/upload')
      .field('courseName', 'X')
      .attach('file', Buffer.from('x'), { filename: 'a.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to upload file');
    errorSpy.mockRestore();
  });
});

describe('POST /api/video/presign', () => {
  beforeEach(() => {
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret';
    process.env.AWS_S3_BUCKET = 'my-bucket';
  });

  it('returns 400 when videoUrl is missing', async () => {
    const app = createApp();
    const res = await request(app).post('/api/video/presign').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing videoUrl');
  });

  it('returns 500 when AWS env vars are missing', async () => {
    delete process.env.AWS_S3_BUCKET;
    const app = createApp();
    const res = await request(app)
      .post('/api/video/presign')
      .send({ videoUrl: 'https://example.com/video.mp4' });
    expect(res.status).toBe(500);
  });

  it('returns the original URL untouched if it is not on our S3 bucket', async () => {
    const app = createApp();
    const externalUrl = 'https://youtube.com/watch?v=abc';
    const res = await request(app)
      .post('/api/video/presign')
      .send({ videoUrl: externalUrl });
    expect(res.status).toBe(200);
    expect(res.body.presignedUrl).toBe(externalUrl);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });

  it('signs S3 URLs from our configured bucket', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example.com/abc');
    const app = createApp();
    const res = await request(app)
      .post('/api/video/presign')
      .send({ videoUrl: 'https://my-bucket.s3.us-east-1.amazonaws.com/path/to/video.mp4' });
    expect(res.status).toBe(200);
    expect(res.body.presignedUrl).toBe('https://signed.example.com/abc');
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    const expiresArg = getSignedUrlMock.mock.calls[0][2];
    expect(expiresArg).toEqual({ expiresIn: 10800 });
  });

  it('returns 500 when getSignedUrl throws', async () => {
    getSignedUrlMock.mockRejectedValueOnce(new Error('signer fail'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = createApp();
    const res = await request(app)
      .post('/api/video/presign')
      .send({ videoUrl: 'https://my-bucket.s3.us-east-1.amazonaws.com/file.mp4' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to generate presigned URL/);
    errorSpy.mockRestore();
  });
});

describe('POST /api/progress/chapter-completed', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/progress/chapter-completed')
      .send({ courseId: 'course-1', chapterId: 'c1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_token');
  });

  it('returns 400 when the body is invalid', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/progress/chapter-completed')
      .set('Authorization', 'Bearer tok')
      .send({ courseId: 'course-1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('returns 401 when the token cannot be verified', async () => {
    adminMocks.verifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    const app = createApp();
    const res = await request(app)
      .post('/api/progress/chapter-completed')
      .set('Authorization', 'Bearer tok')
      .send({ courseId: 'course-1', chapterId: 'c1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('records a completion and leaves the course in_progress when chapters remain', async () => {
    adminMocks.verifyIdToken.mockResolvedValueOnce({ uid: 'user-1' });
    adminMocks.chapters = [{ id: 'c1' }, { id: 'c2' }];
    const app = createApp();
    const res = await request(app)
      .post('/api/progress/chapter-completed')
      .set('Authorization', 'Bearer tok')
      .send({ courseId: 'course-1', chapterId: 'c1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'in_progress', completedCount: 1, totalChapters: 2 });
    // Wrote the chapter leaf and created the progress doc.
    expect(adminMocks.txSet).toHaveBeenCalledTimes(2);
    const progressWrite = adminMocks.txSet.mock.calls.find((c) => c[1]?.status);
    expect(progressWrite?.[1].status).toBe('in_progress');
  });

  it('marks the course completed when the final chapter is finished', async () => {
    adminMocks.verifyIdToken.mockResolvedValueOnce({ uid: 'user-1' });
    adminMocks.chapters = [{ id: 'c1' }];
    const app = createApp();
    const res = await request(app)
      .post('/api/progress/chapter-completed')
      .set('Authorization', 'Bearer tok')
      .send({ courseId: 'course-1', chapterId: 'c1' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'completed', completedCount: 1, totalChapters: 1 });
    const progressWrite = adminMocks.txSet.mock.calls.find((c) => c[1]?.status);
    expect(progressWrite?.[1].status).toBe('completed');
    expect(progressWrite?.[1].completedAt).toBe('TS');
  });

  it('returns 404 when the chapter is not part of the course', async () => {
    adminMocks.verifyIdToken.mockResolvedValueOnce({ uid: 'user-1' });
    adminMocks.chapters = [{ id: 'c1' }];
    const app = createApp();
    const res = await request(app)
      .post('/api/progress/chapter-completed')
      .set('Authorization', 'Bearer tok')
      .send({ courseId: 'course-1', chapterId: 'does-not-exist' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('chapter_not_in_course');
  });
});
