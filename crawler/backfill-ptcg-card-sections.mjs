import fs from "node:fs/promises";
import { applicationDefault, cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = "ptcg-pocket-dex-1ac80";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const batchSize = 450;
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  || "crawler/service-account-key.json";

async function getFirebaseAdminCredential() {
  if (process.env.FIREBASE_USE_APPLICATION_DEFAULT === "true") {
    console.log("Using Firebase Admin Application Default Credentials.");
    return applicationDefault();
  }

  try {
    const rawKey = await fs.readFile(serviceAccountPath, "utf8");
    console.log(`Using Firebase Admin service account: ${serviceAccountPath}`);
    return cert(JSON.parse(rawKey));
  } catch (error) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      throw new Error(`Unable to read Firebase service account key at ${serviceAccountPath}: ${error.message}`);
    }

    throw new Error(
      `Missing Firebase Admin credentials. Download a service account key from Firebase Console and save it as ${serviceAccountPath}, or set GOOGLE_APPLICATION_CREDENTIALS to the key path.`
    );
  }
}

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function inferSection(data) {
  if (data.lobbyTabs) return { section: "meta_deck_lobby_config", reason: "lobbyTabs" };
  if (data.versionTabs) return { section: "challenge_24h_version_config", reason: "versionTabs" };
  if (data.deckData) return { section: "meta_deck", reason: "deckData" };
  if (data.challenge24hData || hasOwn(data, "ownership")) return { section: "24h", reason: "challenge24hData/ownership" };
  if (data.neededCardsData) return { section: "needed_cards", reason: "neededCardsData" };
  if (data.generalData) return { section: "general_cards", reason: "generalData" };
  if (data.altAccData || hasOwn(data, "accountType")) return { section: "alt_acc", reason: "altAccData/accountType" };
  if (data.twoStarData || hasOwn(data, "tier") || hasOwn(data, "status")) return { section: "two_star_cards", reason: "twoStarData/tier/status" };

  // The earliest card documents in this app behaved as alt account/resource cards
  // when no section marker existed.
  return { section: "alt_acc", reason: "legacy fallback" };
}

async function commitOperations(db, operations) {
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = db.batch();
    const chunk = operations.slice(i, i + batchSize);

    chunk.forEach(operation => {
      batch.update(operation.ref, operation.updates);
    });

    await batch.commit();
    console.log(`Committed ${Math.min(i + chunk.length, operations.length)} / ${operations.length}`);
  }
}

const app = initializeApp({
  credential: await getFirebaseAdminCredential(),
  projectId
});
const db = getFirestore(app);
const cardsCollection = db.collection("ptcg_cards");

const snapshot = await cardsCollection.get();
const operations = [];
const counts = new Map();
const reasonCounts = new Map();
const samples = [];
let existingSectionDocs = 0;

snapshot.docs.forEach(documentSnapshot => {
  const data = documentSnapshot.data();
  if (!isBlank(data.section)) {
    existingSectionDocs += 1;
    return;
  }

  const { section, reason } = inferSection(data);
  counts.set(section, (counts.get(section) || 0) + 1);
  reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);

  operations.push({
    ref: cardsCollection.doc(documentSnapshot.id),
    updates: { section }
  });

  if (samples.length < 20) {
    samples.push({
      docId: documentSnapshot.id,
      inferredSection: section,
      reason,
      name: data.name || data.deckData?.name || "",
      id: data.id || "",
      rarity: data.rarity || "",
      keys: Object.keys(data).sort()
    });
  }
});

console.log(`${dryRun ? "[dry-run] " : ""}ptcg_cards docs: ${snapshot.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}Docs already having section: ${existingSectionDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}Docs missing section to update: ${operations.length}`);
console.log("Inferred sections:");
console.log(JSON.stringify(Object.fromEntries([...counts.entries()].sort()), null, 2));
console.log("Inference reasons:");
console.log(JSON.stringify(Object.fromEntries([...reasonCounts.entries()].sort()), null, 2));

if (samples.length > 0) {
  console.log("Samples:");
  console.log(JSON.stringify(samples, null, 2));
}

if (!dryRun && operations.length > 0) {
  await commitOperations(db, operations);
}

console.log("Done.");
await deleteApp(app);
