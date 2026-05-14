import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';

const { sendMock, getSignedUrlMock, firestoreMock } = vi.hoisted(() => {
  const sendMock = vi.fn();
  const getSignedUrlMock = vi.fn();

  const makeCountResult = (count: number) => ({ data: () => ({ count }) });

  const firestoreMock = {
    collection: vi.fn(),
    collectionGroup: vi.fn(),
    _makeCountResult: makeCountResult,
  };

  return { sendMock, getSignedUrlMock, firestoreMock };
});

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

vi.mock('firebase-admin', () => ({
  default: {
    get apps() { return []; },
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn().mockReturnValue({}),
      applicationDefault: vi.fn().mockReturnValue({}),
    },
    firestore: vi.fn(() => firestoreMock),
  },
}));

import { createApp } from '../server';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  sendMock.mockReset();
  getSignedUrlMock.mockReset();
  process.env = { ...ORIGINAL_ENV };
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

// Helper: set up firestoreMock for stats tests
function mockFirestoreForStats() {
  const makeCountSnap = (count: number) => ({ data: () => ({ count }) });

  const courseDocs: Record<string, any> = {
    course1: { id: 'course1', exists: true, data: () => ({ title: 'React Basics', category: 'Tecnología', published: true }) },
    course2: { id: 'course2', exists: true, data: () => ({ title: 'Sales 101', category: 'Ventas', published: false }) },
  };
  const courseStatsDocs: Record<string, any> = {
    course1: { id: 'course1', exists: true, data: () => ({ views: 42, uniqueViewers: 10, chapterViews: { ch1: 30, ch2: 12 } }) },
  };
  const completions = [
    { data: () => ({ courseId: 'course1', completed: true }) },
    { data: () => ({ courseId: 'course1', completed: true }) },
    { data: () => ({ courseId: 'course2', completed: true }) },
  ];

  const makeCollectionMock = (docs: any[]) => {
    const col: any = {
      get: vi.fn().mockResolvedValue({ docs, size: docs.length }),
      where: vi.fn(),
      count: vi.fn(),
      doc: vi.fn(),
    };
    col.where.mockReturnValue(col);
    col.count.mockReturnValue({ get: vi.fn().mockResolvedValue(makeCountSnap(docs.length)) });
    return col;
  };

  firestoreMock.collection.mockImplementation((name: string) => {
    if (name === 'courses') {
      const col = makeCollectionMock(Object.values(courseDocs));
      col.doc.mockImplementation((id: string) => ({
        get: vi.fn().mockResolvedValue(courseDocs[id] ?? { exists: false }),
      }));
      return col;
    }
    if (name === 'course_stats') {
      const col = makeCollectionMock([courseStatsDocs.course1]);
      col.doc.mockImplementation((id: string) => ({
        get: vi.fn().mockResolvedValue(courseStatsDocs[id] ?? { exists: false }),
        collection: vi.fn(() => ({
          count: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(makeCountSnap(10)) }),
        })),
      }));
      return col;
    }
    if (name === 'users') {
      const col = makeCollectionMock([{}, {}]);
      col.count.mockReturnValue({ get: vi.fn().mockResolvedValue(makeCountSnap(50)) });
      return col;
    }
    return makeCollectionMock([]);
  });

  firestoreMock.collectionGroup.mockImplementation((_name: string) => {
    const activeFilters: { field: string; value: any }[] = [];
    const groupMock: any = {
      where: vi.fn((field: string, _op: string, value: any) => {
        activeFilters.push({ field, value });
        return groupMock;
      }),
      get: vi.fn(() => {
        const filtered = completions.filter(doc =>
          activeFilters.every(f => doc.data()[f.field] === f.value)
        );
        return Promise.resolve({ docs: filtered, size: filtered.length });
      }),
    };
    return groupMock;
  });
}

describe('GET /api/stats', () => {
  beforeEach(() => {
    process.env.ADMIN_ACCESS = 'secret';
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
  });

  it('returns 401 when X-Admin-Password header is missing', async () => {
    const app = createApp();
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when X-Admin-Password is wrong', async () => {
    const app = createApp();
    const res = await request(app).get('/api/stats').set('x-admin-password', 'wrong');
    expect(res.status).toBe(401);
  });

  it('returns 500 when ADMIN_ACCESS is not configured', async () => {
    delete process.env.ADMIN_ACCESS;
    const app = createApp();
    const res = await request(app).get('/api/stats').set('x-admin-password', 'anything');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/ADMIN_ACCESS/);
  });

  it('returns 500 when Firebase Admin is not configured', async () => {
    delete process.env.VITE_FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    const app = createApp();
    const res = await request(app).get('/api/stats').set('x-admin-password', 'secret');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Firebase Admin not configured/);
  });

  it('returns platform stats with course breakdown sorted by views', async () => {
    mockFirestoreForStats();
    const app = createApp();
    const res = await request(app).get('/api/stats').set('x-admin-password', 'secret');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalUsers: 50,
      totalCourses: 2,
      publishedCourses: 1,
      totalCompletions: 3,
    });
    expect(res.body.courses).toHaveLength(2);
    // Most viewed course first
    expect(res.body.courses[0].courseId).toBe('course1');
    expect(res.body.courses[0].views).toBe(42);
    expect(res.body.courses[0].completions).toBe(2);
  });
});

describe('GET /api/stats/courses/:courseId', () => {
  beforeEach(() => {
    process.env.ADMIN_ACCESS = 'secret';
    process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
  });

  it('returns 401 when unauthenticated', async () => {
    const app = createApp();
    const res = await request(app).get('/api/stats/courses/course1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when course does not exist', async () => {
    mockFirestoreForStats();
    const app = createApp();
    const res = await request(app)
      .get('/api/stats/courses/nonexistent')
      .set('x-admin-password', 'secret');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Course not found');
  });

  it('returns detailed course stats with chapter breakdown', async () => {
    mockFirestoreForStats();
    const app = createApp();
    const res = await request(app)
      .get('/api/stats/courses/course1')
      .set('x-admin-password', 'secret');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      courseId: 'course1',
      title: 'React Basics',
      views: 42,
      uniqueViewers: 10,
      completions: 2,
      completionRate: 20,
    });
    expect(res.body.chapterViews).toEqual({ ch1: 30, ch2: 12 });
  });
});
