import express, { Express } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import { initializeApp, cert, applicationDefault, getApps, type App } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminApp: App | null = null;

// Lazily initialise firebase-admin so importing this module (e.g. in tests, or
// before credentials are configured) has no side effects.
function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0];
    console.log('[firebase-admin] Reusing existing app');
    return adminApp;
  }
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    if (serviceAccount) {
      // The value in .env may be stored as a JSON-encoded string (i.e. wrapped in outer quotes),
      // so we may need to parse twice to get the actual service account object.
      let parsed = JSON.parse(serviceAccount);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      // dotenv may store newlines as literal \n sequences; the private key requires real newlines
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      console.log('[firebase-admin] Initializing with service account for project:', parsed.project_id);
      adminApp = initializeApp({ credential: cert(parsed) });
      console.log('[firebase-admin] Initialized successfully with service account credentials');
    } else {
      console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT not set — falling back to Application Default Credentials');
      adminApp = initializeApp({ credential: applicationDefault() });
    }
  } catch (err) {
    console.error('[firebase-admin] INITIALIZATION FAILED:', err instanceof Error ? err.message : err);
    throw err;
  }
  return adminApp;
}

function getAdminDb(): Firestore {
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID;
  return databaseId ? getFirestore(getAdminApp(), databaseId) : getFirestore(getAdminApp());
}

function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // API Route for Admin Verification
  app.post("/api/admin/verify", (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_ACCESS;

    if (!adminPassword) {
      return res.status(500).json({ error: "ADMIN_ACCESS not configured in server" });
    }

    if (password === adminPassword) {
      // In a production app, we would return a JWT here.
      // For this MVP, we return a simple success flag.
      res.json({ success: true, message: "Acceso concedido" });
    } else {
      res.status(401).json({ success: false, message: "Contraseña incorrecta" });
    }
  });

  // API Route for Domain Verification
  app.post("/api/auth/verify-domain", (req, res) => {
    const { email } = req.body;
    const allowedDomains = process.env.ALLOW_DOMAINS;

    // If no domains are configured, allow all
    if (!allowedDomains || allowedDomains.trim() === "") {
      return res.json({ allowed: true });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ allowed: false, error: "Invalid email" });
    }

    const userDomain = email.split("@")[1].toLowerCase();
    const domainsList = allowedDomains.split(",").map(d => d.trim().toLowerCase());

    const isAllowed = domainsList.includes(userDomain);
    res.json({ allowed: isAllowed });
  });

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // API Route to Upload using Node.js proxy to avoid S3 browser CORS
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    const courseName = req.body.courseName;

    if (!file || !courseName) {
      return res.status(400).json({ error: "Missing required fields (file or courseName)" });
    }

    const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET } = process.env;

    if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
      return res.status(500).json({ error: "AWS credentials not configured on the server" });
    }

    try {
      const s3Client = new S3Client({
        region: AWS_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
      });

      const safeCourseName = courseName.replace(/[^a-zA-Z0-9-_\.]/g, "-").toLowerCase();
      const safeFileName = file.originalname.replace(/[^a-zA-Z0-9-_\.]/g, "-");
      const key = `${safeCourseName}/${Date.now()}-${safeFileName}`;

      const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);
      
      const fileUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

      res.json({ fileUrl, key });
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // API Route to generate a presigned URL for reading from S3
  app.post("/api/video/presign", async (req, res) => {
    const { videoUrl } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: "Missing videoUrl" });
    }

    const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET } = process.env;

    if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
      return res.status(500).json({ error: "AWS credentials not configured on the server" });
    }

    // Check if it's an S3 url for our bucket
    const s3Prefix = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`;
    if (!videoUrl.startsWith(s3Prefix)) {
      // If it's not an S3 URL from our bucket, just return the original URL
      return res.json({ presignedUrl: videoUrl });
    }

    const key = videoUrl.replace(s3Prefix, "");

    try {
      const s3Client = new S3Client({
        region: AWS_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
      });

      const command = new GetObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
      });

      // Pre-signed URL valid for 3 hours (10800 seconds)
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 10800 });
      res.json({ presignedUrl });
    } catch (error) {
      console.error("Error generating read presigned URL:", error);
      res.status(500).json({ error: "Failed to generate presigned URL for video" });
    }
  });

  // API Route to record that a user finished a chapter's video.
  // The userId is taken from the verified Firebase ID token, never from the body.
  app.post("/api/progress/chapter-completed", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: "missing_token" });
    }
    const idToken = match[1];

    const { courseId, chapterId } = req.body ?? {};
    if (typeof courseId !== "string" || !courseId || typeof chapterId !== "string" || !chapterId) {
      return res.status(400).json({ error: "invalid_body" });
    }

    let userId: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      userId = decoded.uid;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as any)?.code ?? 'unknown';
      console.error('[auth] verifyIdToken failed — code:', code, '| message:', msg);
      return res.status(401).json({ error: "invalid_token", detail: msg });
    }

    try {
      const db = getAdminDb();
      const result = await db.runTransaction(async (tx) => {
        const courseRef = db.doc(`courses/${courseId}`);
        const progressRef = db.doc(`users/${userId}/progress/${courseId}`);
        const chapterRef = db.doc(`users/${userId}/chapterCompletions/${chapterId}`);

        const [courseSnap, progressSnap, chapterSnap] = await Promise.all([
          tx.get(courseRef),
          tx.get(progressRef),
          tx.get(chapterRef),
        ]);
        if (!courseSnap.exists) throw new Error("course_not_found");

        const chapters: { id: string }[] = courseSnap.get("chapters") ?? [];
        if (!chapters.some((c) => c.id === chapterId)) throw new Error("chapter_not_in_course");

        // Firestore transactions require all reads before any writes, so the
        // count query runs here while the state is still pre-write. The
        // `+ (chapterSnap.exists ? 0 : 1)` adjustment accounts for the chapter
        // we are about to add (which the query cannot see yet).
        const completedSnap = await tx.get(
          db.collection(`users/${userId}/chapterCompletions`).where("courseId", "==", courseId)
        );
        const completedCount = completedSnap.size + (chapterSnap.exists ? 0 : 1);
        const isCourseDone = completedCount >= chapters.length;

        const now = FieldValue.serverTimestamp();

        // 1. Idempotent leaf write
        if (!chapterSnap.exists) {
          tx.set(chapterRef, { chapterId, courseId, completedAt: now });
        }

        // 2. Upsert progress
        if (!progressSnap.exists) {
          tx.set(progressRef, {
            courseId,
            status: isCourseDone ? "completed" : "in_progress",
            startedAt: now,
            ...(isCourseDone ? { completedAt: now } : {}),
          });
        } else if (isCourseDone && progressSnap.get("status") !== "completed") {
          tx.update(progressRef, { status: "completed", completedAt: now });
        }

        return {
          status: isCourseDone ? "completed" : "in_progress",
          completedCount,
          totalChapters: chapters.length,
        };
      });

      res.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      if (message === "course_not_found" || message === "chapter_not_in_course") {
        return res.status(404).json({ error: message });
      }
      console.error("Error recording chapter completion:", error);
      res.status(500).json({ error: "Failed to record chapter completion" });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT || "3000";

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  startServer();
}
