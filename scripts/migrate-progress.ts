/**
 * One-off migration: convert users/{userId}/progress/{courseId} documents from
 * the old `{ completed: boolean }` shape to the status-based CourseProgress model.
 *
 *   status      = completed ? 'completed' : 'in_progress'
 *   completedAt = string -> Timestamp (when present, for completed courses)
 *   startedAt   = completedAt ?? now
 *
 * Run after the new code is deployed:
 *   tsx scripts/migrate-progress.ts
 *
 * Set DROP_COMPLETED=true to also remove the legacy `completed` boolean.
 */
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  initializeApp(
    serviceAccount
      ? { credential: cert(JSON.parse(serviceAccount)) }
      : { credential: applicationDefault() }
  );
}

async function migrate() {
  initAdmin();
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID;
  const db = databaseId ? getFirestore(getApps()[0], databaseId) : getFirestore();
  const dropCompleted = process.env.DROP_COMPLETED === "true";

  const snap = await db.collectionGroup("progress").get();
  console.log(`Found ${snap.size} progress documents.`);

  let batch = db.batch();
  let pending = 0;
  let migrated = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    // Skip documents that already use the new model.
    if (typeof data.status === "string" && !("completed" in data)) continue;

    const completed = data.completed === true;

    let completedAt: Timestamp | undefined;
    const raw = data.completedAt;
    if (raw instanceof Timestamp) {
      completedAt = raw;
    } else if (typeof raw === "string" && raw) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) completedAt = Timestamp.fromDate(parsed);
    }

    const update: Record<string, unknown> = {
      status: completed ? "completed" : "in_progress",
      startedAt: completedAt ?? Timestamp.now(),
    };
    if (completed) {
      update.completedAt = completedAt ?? Timestamp.now();
    }
    if (dropCompleted) {
      update.completed = FieldValue.delete();
    }

    batch.set(docSnap.ref, update, { merge: true });
    pending++;
    migrated++;

    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
  console.log(`Migrated ${migrated} documents.${dropCompleted ? " (dropped legacy `completed` field)" : ""}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
