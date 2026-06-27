import express, { Express } from "express";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

  // Reverse-proxy the Firebase Auth helper endpoints to the project's
  // firebaseapp.com domain so they are served same-origin as the app. This is
  // Firebase's recommended fix for signInWithRedirect on browsers that block
  // third-party storage: with VITE_FIREBASE_AUTH_DOMAIN set to the app's own
  // origin, the auth iframe/handler load here and the credential carries back.
  // Mounted before express.json() so request bodies are streamed untouched, and
  // before the Vite/static middleware so /__/auth/* is never treated as an app
  // route. Transparent (no 302) — the handler's own redirects pass through.
  const authProxyTarget = process.env.FIREBASE_AUTH_PROXY_TARGET;
  if (authProxyTarget) {
    app.use(
      createProxyMiddleware({
        pathFilter: ["/__/auth/**", "/__/firebase/**"],
        target: authProxyTarget,
        changeOrigin: true,
        secure: true,
        on: {
          proxyRes: (proxyRes) => {
            // Firebase serves HSTS on these endpoints. Forwarding it from a
            // self-signed-cert localhost would pin HSTS and remove the browser's
            // "proceed anyway" bypass — bricking dev after the first load.
            delete proxyRes.headers["strict-transport-security"];
          },
        },
      })
    );
  }

  app.use(express.json());

  // API Route for Admin Verification
  app.post("/api/admin/verify", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: "missing_token" });
    }
    const idToken = match[1];

    const { password } = req.body;
    const adminPassword = process.env.ADMIN_ACCESS;

    if (!adminPassword) {
      return res.status(500).json({ error: "ADMIN_ACCESS not configured in server" });
    }

    const providedHash = crypto.createHash('sha256').update(password || '').digest();
    const adminHash = crypto.createHash('sha256').update(adminPassword).digest();

    if (crypto.timingSafeEqual(providedHash, adminHash)) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        // Set the custom claim to true to allow Firestore rule checks
        await getAdminAuth().setCustomUserClaims(decoded.uid, { admin: true });
        res.json({ success: true, message: "Acceso concedido" });
      } catch (err) {
        return res.status(401).json({ success: false, message: "Token inválido" });
      }
    } else {
      res.status(401).json({ success: false, message: "Contraseña incorrecta" });
    }
  });

  // API Route for Domain Verification
  app.post("/api/auth/verify-domain", (req, res) => {
    const { email, providerId } = req.body;
    const allowedDomains = process.env.ALLOW_DOMAINS;

    // If no domains are configured, allow all
    if (!allowedDomains || allowedDomains.trim() === "") {
      return res.json({ allowed: true });
    }

    if (!email || !email.includes("@")) {
      // Some federated identity providers are already restricted to the org at
      // the IdP level (e.g. a single-tenant Microsoft Entra app only issues
      // tokens to members of that tenant) and may not return an email claim.
      // For those, the tenant restriction is equivalent to the domain check, so
      // allow the sign-in when no email is available.
      const TRUSTED_FEDERATED_PROVIDERS = ["microsoft.com"];
      if (providerId && TRUSTED_FEDERATED_PROVIDERS.includes(providerId)) {
        return res.json({ allowed: true });
      }
      return res.status(400).json({ allowed: false, error: "Invalid email" });
    }

    const userDomain = email.split("@")[1].toLowerCase();
    const domainsList = allowedDomains.split(",").map(d => d.trim().toLowerCase());

    const isAllowed = domainsList.includes(userDomain);
    res.json({ allowed: isAllowed });
  });

  // API Route to get an S3 pre-signed URL for direct client upload
  app.post("/api/upload/presign", async (req, res) => {
    const { courseName, fileName, fileType } = req.body;

    if (!courseName || !fileName || !fileType) {
      return res.status(400).json({ error: "Missing required fields (courseName, fileName, or fileType)" });
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
      const safeFileName = fileName.replace(/[^a-zA-Z0-9-_\.]/g, "-");
      const key = `${safeCourseName}/${Date.now()}-${safeFileName}`;

      const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: key,
        ContentType: fileType,
      });

      // Pre-signed URL valid for 1 hour
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      const fileUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;

      res.json({ presignedUrl, fileUrl, key });
    } catch (error) {
      console.error("Error generating write presigned URL:", error);
      res.status(500).json({ error: "Failed to generate presigned URL for upload" });
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

  app.post("/api/progress/course-started", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: "missing_token" });
    }
    const idToken = match[1];

    const { courseId } = req.body ?? {};
    if (typeof courseId !== "string" || !courseId) {
      return res.status(400).json({ error: "invalid_body" });
    }

    let userId: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      userId = decoded.uid;
    } catch (err) {
      return res.status(401).json({ error: "invalid_token" });
    }

    try {
      const db = getAdminDb();
      await db.runTransaction(async (tx) => {
        const progressRef = db.doc(`users/${userId}/progress/${courseId}`);
        const progressSnap = await tx.get(progressRef);
        
        if (!progressSnap.exists) {
          tx.set(progressRef, {
            courseId,
            status: "in_progress",
            startedAt: FieldValue.serverTimestamp(),
          });
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting course progress:", error);
      res.status(500).json({ error: "Failed to record course start" });
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

  if (process.env.NODE_ENV === "production") {
    // Production: serve the built SPA over HTTP; TLS is terminated upstream
    // (e.g. Cloud Run). The /__/auth proxy above still applies.
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
    return;
  }

  // Local dev. Serve over HTTPS when a self-signed cert is present so the
  // Firebase signInWithRedirect handler (hard-coded to HTTPS for a localhost
  // authDomain) works through the /__/auth proxy. Run `npm run gen-cert` to
  // create the cert (the predev script does this automatically).
  const keyPath = path.join(process.cwd(), "certs", "localhost-key.pem");
  const certPath = path.join(process.cwd(), "certs", "localhost-cert.pem");
  const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);

  if (useHttps) {
    const httpsServer = https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
      app
    );
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpsServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
    httpsServer.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on https://localhost:${PORT}`);
    });
  } else {
    console.warn(
      "[server] No TLS cert found in certs/ — serving HTTP. Microsoft signInWithRedirect needs HTTPS locally; run `npm run gen-cert`."
    );
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  startServer();
}
