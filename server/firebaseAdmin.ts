import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// Service-account JSON is stored in the project root.
const serviceAccountPath = path.resolve(
  currentDir,
  "../attendai-service-account.json",
);

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

const firebaseAdminApp =
  getApps().find((app) => app.name === "attendai-server") ??
  initializeApp(
    {
      credential: cert(serviceAccount),
      projectId: "attendai-3d43f",
    },
    "attendai-server",
  );

export const firestore = getFirestore(firebaseAdminApp);
