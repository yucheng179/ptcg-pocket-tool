import fs from "node:fs/promises";
import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  terminate,
  writeBatch
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdT8oG7bjqOIZlnjEvkoxBz1GTlTx4s-k",
  authDomain: "ptcg-pocket-dex-1ac80.firebaseapp.com",
  projectId: "ptcg-pocket-dex-1ac80",
  storageBucket: "ptcg-pocket-dex-1ac80.firebasestorage.app",
  messagingSenderId: "104827060691",
  appId: "1:104827060691:web:5de9e363eb31d7e4822f26"
};

const inputPath = "crawler/raenonx-cards.json";
const collectionName = "ptcg_card_catalog";
const batchSize = 500;
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const prune = args.has("--prune");

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const catalogCollection = collection(db, collectionName);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDocumentId(card, index) {
  const stableKey = `${card.id || "no-id"}__${card.cardId || card.name || index}`;
  return stableKey
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 240) || `card_${index}`;
}

async function getExistingDocumentIds() {
  const snapshot = await getDocs(catalogCollection);
  return snapshot.docs.map(documentSnapshot => documentSnapshot.id);
}

async function commitOperations(operations) {
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + batchSize);

    chunk.forEach(operation => {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else {
        batch.set(operation.ref, operation.data);
      }
    });

    await batch.commit();
    console.log(`Committed ${Math.min(i + chunk.length, operations.length)} / ${operations.length}`);
    await sleep(150);
  }
}

const rawCards = JSON.parse(await fs.readFile(inputPath, "utf8"));
const now = new Date().toISOString();
const cards = rawCards
  .filter(card => card.name && (card.id || card.imageUrl))
  .map((card, index) => ({
    ...card,
    source: "raenonx",
    updatedAt: now,
    importIndex: index
  }));

const setOperations = cards.map((card, index) => {
  const documentId = getDocumentId(card, index);
  return {
    type: "set",
    documentId,
    ref: doc(catalogCollection, documentId),
    data: card
  };
});

const importedIds = new Set(setOperations.map(operation => operation.documentId));
const deleteOperations = [];

if (prune) {
  const existingIds = await getExistingDocumentIds();
  existingIds
    .filter(documentId => !importedIds.has(documentId))
    .forEach(documentId => {
      deleteOperations.push({
        type: "delete",
        documentId,
        ref: doc(catalogCollection, documentId)
      });
    });
}

const operations = [...setOperations, ...deleteOperations];

console.log(`${dryRun ? "[dry-run] " : ""}Ready to write ${cards.length} catalog cards${prune ? ` and prune stale docs (${deleteOperations.length} deletes)` : ""}.`);

if (!dryRun) {
  await commitOperations(operations);
}

console.log("Done.");
await terminate(db);
