import express, { Express, Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import admin from "firebase-admin";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAdminDb(): admin.firestore.Firestore | null {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

  if (!serviceAccount && !projectId) return null;

  try {
    if (!admin.apps.length) {
      const credential = serviceAccount
        ? admin.credential.cert(JSON.parse(serviceAccount))
        : admin.credential.applicationDefault();
      admin.initializeApp({ credential, projectId: projectId || undefined });
    }
    return admin.firestore();
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
    return null;
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const password = req.headers["x-admin-password"] as string | undefined;
  const adminPassword = process.env.ADMIN_ACCESS;

  if (!adminPassword) {
    return res.status(500).json({ error: "ADMIN_ACCESS not configured in server" });
  }
  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
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

  // Stats API — admin-only
  app.get("/api/stats", requireAdmin, async (req, res) => {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT or VITE_FIREBASE_PROJECT_ID with Application Default Credentials." });
    }

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [coursesSnap, courseStatsSnap, totalUsersSnap, active7dSnap, active30dSnap, completionsSnap] = await Promise.all([
        db.collection("courses").get(),
        db.collection("course_stats").get(),
        db.collection("users").count().get(),
        db.collection("users").where("lastSeen", ">=", sevenDaysAgo).count().get(),
        db.collection("users").where("lastSeen", ">=", thirtyDaysAgo).count().get(),
        db.collectionGroup("progress").where("completed", "==", true).get(),
      ]);

      const completionsByCourse: Record<string, number> = {};
      for (const doc of completionsSnap.docs) {
        const courseId = doc.data().courseId as string;
        completionsByCourse[courseId] = (completionsByCourse[courseId] || 0) + 1;
      }

      const statsMap = new Map(courseStatsSnap.docs.map(d => [d.id, d.data()]));

      const courses = coursesSnap.docs.map(d => {
        const data = d.data();
        const stats = statsMap.get(d.id) || {};
        const views = (stats.views as number) || 0;
        const uniqueViewers = (stats.uniqueViewers as number) || 0;
        const completions = completionsByCourse[d.id] || 0;
        return {
          courseId: d.id,
          title: data.title as string,
          category: data.category as string,
          published: data.published !== false,
          views,
          uniqueViewers,
          completions,
          completionRate: uniqueViewers > 0 ? Math.round((completions / uniqueViewers) * 100) : 0,
        };
      });

      courses.sort((a, b) => b.views - a.views);

      res.json({
        totalUsers: totalUsersSnap.data().count,
        activeUsers7d: active7dSnap.data().count,
        activeUsers30d: active30dSnap.data().count,
        totalCourses: coursesSnap.size,
        publishedCourses: courses.filter(c => c.published).length,
        totalViews: courses.reduce((sum, c) => sum + c.views, 0),
        totalCompletions: completionsSnap.size,
        courses,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.get("/api/stats/courses/:courseId", requireAdmin, async (req, res) => {
    const db = getAdminDb();
    if (!db) {
      return res.status(500).json({ error: "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT or VITE_FIREBASE_PROJECT_ID with Application Default Credentials." });
    }

    const { courseId } = req.params;

    try {
      const [courseDoc, statsDoc, viewersSnap] = await Promise.all([
        db.collection("courses").doc(courseId).get(),
        db.collection("course_stats").doc(courseId).get(),
        db.collection("course_stats").doc(courseId).collection("viewers").count().get(),
      ]);

      // Count completions for this course via collection group
      const courseCompletionsSnap = await db.collectionGroup("progress")
        .where("courseId", "==", courseId)
        .where("completed", "==", true)
        .get();

      if (!courseDoc.exists) {
        return res.status(404).json({ error: "Course not found" });
      }

      const courseData = courseDoc.data()!;
      const statsData = statsDoc.exists ? statsDoc.data()! : {};
      const uniqueViewers = viewersSnap.data().count;
      const completions = courseCompletionsSnap.size;

      res.json({
        courseId,
        title: courseData.title,
        category: courseData.category,
        published: courseData.published !== false,
        views: (statsData.views as number) || 0,
        uniqueViewers,
        completions,
        completionRate: uniqueViewers > 0 ? Math.round((completions / uniqueViewers) * 100) : 0,
        chapterViews: (statsData.chapterViews as Record<string, number>) || {},
      });
    } catch (error) {
      console.error("Error fetching course stats:", error);
      res.status(500).json({ error: "Failed to fetch course statistics" });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = 3000;

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  startServer();
}
