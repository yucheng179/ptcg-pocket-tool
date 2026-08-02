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

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const batchSize = 450;
const catalogJsonPath = "crawler/raenonx-cards.json";
const legacyRarityMap = {
  "1彩星": "1閃",
  "2彩星": "2閃"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const cardsCollection = collection(db, "ptcg_cards");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeCardId(id = "") {
  return String(id)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

function normalizeCardName(name = "") {
  return String(name)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function normalizeCardImageUrl(imageUrl = "") {
  const cleanedUrl = String(imageUrl)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/&amp;/g, "&")
    .trim();
  if (!cleanedUrl) return "";

  const decodeLoose = value => {
    let decoded = value;
    for (let i = 0; i < 2; i += 1) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        break;
      }
    }
    return decoded;
  };

  const normalizePath = path => decodeLoose(path)
    .replace(/\\/g, "/")
    .replace(/\/show$/i, "")
    .replace(/\/+$/g, "")
    .toLocaleLowerCase();

  const buildIdentity = (host, path, searchParams = null) => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) return "";
    if (normalizedPath.includes("/images/game/card/")) {
      return `ptcgp-card:${normalizedPath}`;
    }

    const ignoredParams = new Set([
      "w", "width", "h", "height", "q", "quality", "format", "fit", "crop", "auto", "dpr"
    ]);
    const keptParams = [];
    searchParams?.forEach((value, key) => {
      const normalizedKey = key.toLocaleLowerCase();
      if (ignoredParams.has(normalizedKey)) return;
      keptParams.push(`${normalizedKey}=${decodeLoose(value).trim().toLocaleLowerCase()}`);
    });
    keptParams.sort();

    return `${host.toLocaleLowerCase()}${normalizedPath}${keptParams.length ? `?${keptParams.join("&")}` : ""}`;
  };

  try {
    const url = new URL(cleanedUrl, "https://local.invalid");
    const proxiedImageUrl = url.searchParams.get("url")
      || url.searchParams.get("src")
      || url.searchParams.get("image");
    if (proxiedImageUrl) return normalizeCardImageUrl(proxiedImageUrl);
    return buildIdentity(url.hostname, url.pathname, url.searchParams);
  } catch {
    const withoutHash = cleanedUrl.split("#")[0];
    const [pathOnly] = withoutHash.split("?");
    return normalizePath(pathOnly);
  }
}

function normalizeRarity(rarity) {
  return legacyRarityMap[rarity] || rarity;
}

function setIfChanged(updates, key, currentValue, nextValue) {
  if (nextValue === undefined || nextValue === null || nextValue === "") return false;
  if ((currentValue || "") === nextValue) return false;
  updates[key] = nextValue;
  return true;
}

function getCatalogById(catalogDocs) {
  const map = new Map();

  catalogDocs.forEach(card => {
    const normalizedId = normalizeCardId(card.id);
    if (!normalizedId || map.has(normalizedId)) return;
    map.set(normalizedId, card);
  });

  return map;
}

function getCatalogByCardId(catalogDocs) {
  const groupedMap = new Map();

  catalogDocs.forEach(card => {
    const cardId = normalizeCardId(card.cardId);
    if (!cardId) return;
    if (!groupedMap.has(cardId)) groupedMap.set(cardId, []);
    groupedMap.get(cardId).push(card);
  });

  const uniqueMap = new Map();
  const ambiguousMap = new Map();

  groupedMap.forEach((cards, cardId) => {
    const signatures = new Set(cards.map(card => JSON.stringify({
      name: card.name || "",
      imageUrl: normalizeCardImageUrl(card.imageUrl || ""),
      rarity: card.rarity || ""
    })));

    if (signatures.size === 1) {
      uniqueMap.set(cardId, cards[0]);
    } else {
      ambiguousMap.set(cardId, cards);
    }
  });

  return { uniqueMap, ambiguousMap };
}

function getCardImageValue(card = {}) {
  return card.imageUrl || card.img || card.imageURL || "";
}

function getCardIdFromImageUrl(imageUrl = "") {
  const normalizedImageUrl = normalizeCardImageUrl(imageUrl);
  const match = normalizedImageUrl.match(/\/((?:pk|tr)_[0-9a-z_]+)\.png$/i);
  return match ? normalizeCardId(match[1]) : "";
}

function getNameImageKey(card = {}) {
  const normalizedName = normalizeCardName(card.name);
  const normalizedImageUrl = normalizeCardImageUrl(getCardImageValue(card));
  if (!normalizedName || !normalizedImageUrl) return "";
  return `${normalizedName}__${normalizedImageUrl}`;
}

function getCatalogByNameImage(catalogDocs) {
  const groupedMap = new Map();

  catalogDocs.forEach(card => {
    const key = getNameImageKey(card);
    if (!key) return;
    if (!groupedMap.has(key)) groupedMap.set(key, []);
    groupedMap.get(key).push(card);
  });

  const uniqueMap = new Map();
  const ambiguousKeys = new Set();
  groupedMap.forEach((cards, key) => {
    if (cards.length === 1) uniqueMap.set(key, cards[0]);
    else ambiguousKeys.add(key);
  });

  return { uniqueMap, ambiguousKeys };
}

function findCatalogCard(card, catalogById, catalogByCardId, catalogByNameImage) {
  const normalizedId = normalizeCardId(card?.id);
  if (normalizedId) {
    const byId = catalogById.get(normalizedId);
    if (byId) return { card: byId, matchType: "id" };
  }

  const normalizedCardId = normalizeCardId(card?.cardId) || getCardIdFromImageUrl(getCardImageValue(card));
  if (normalizedCardId) {
    const byCardId = catalogByCardId.uniqueMap.get(normalizedCardId);
    if (byCardId) return { card: byCardId, matchType: "cardId" };
    if (catalogByCardId.ambiguousMap.has(normalizedCardId)) return { card: null, matchType: "ambiguous-cardId" };
  }

  const nameImageKey = getNameImageKey(card);
  if (nameImageKey) {
    const byNameImage = catalogByNameImage.uniqueMap.get(nameImageKey);
    if (byNameImage) return { card: byNameImage, matchType: "name+image" };
    if (catalogByNameImage.ambiguousKeys.has(nameImageKey)) return { card: null, matchType: "ambiguous-name+image" };
  }

  return { card: null, matchType: "none" };
}

function applyCatalogToInlineCard(card, catalogById, catalogByCardId, catalogByNameImage, preferredImageField = "imageUrl") {
  if (!card || typeof card !== "object") return { card, changed: false };

  const updatedCard = { ...card };
  let changed = false;
  const { card: catalogCard } = findCatalogCard(updatedCard, catalogById, catalogByCardId, catalogByNameImage);

  if (catalogCard) {
    if (catalogCard.name && updatedCard.name !== catalogCard.name) {
      updatedCard.name = catalogCard.name;
      changed = true;
    }

    if (catalogCard.imageUrl) {
      const imageFields = new Set([preferredImageField]);
      if ("imageUrl" in updatedCard || preferredImageField === "imageUrl") imageFields.add("imageUrl");
      if ("img" in updatedCard || preferredImageField === "img") imageFields.add("img");
      if ("imageURL" in updatedCard || preferredImageField === "imageURL") imageFields.add("imageURL");

      imageFields.forEach(field => {
        if ((updatedCard[field] || "") !== catalogCard.imageUrl) {
          updatedCard[field] = catalogCard.imageUrl;
          changed = true;
        }
      });
    }

    if (catalogCard.rarity && updatedCard.rarity !== catalogCard.rarity) {
      updatedCard.rarity = catalogCard.rarity;
      changed = true;
    }

    if (catalogCard.cardId && updatedCard.cardId !== catalogCard.cardId) {
      updatedCard.cardId = catalogCard.cardId;
      changed = true;
    }
  }

  const normalizedRarity = normalizeRarity(updatedCard.rarity);
  if (normalizedRarity !== updatedCard.rarity) {
    updatedCard.rarity = normalizedRarity;
    changed = true;
  }

  return { card: updatedCard, changed };
}

function updateArrayCards(cards, catalogById, catalogByCardId, catalogByNameImage, preferredImageField = "img") {
  if (!Array.isArray(cards)) return { cards, changed: false };

  let changed = false;
  const updatedCards = cards.map(card => {
    const result = applyCatalogToInlineCard(card, catalogById, catalogByCardId, catalogByNameImage, preferredImageField);
    if (result.changed) changed = true;
    return result.card;
  });

  return { cards: updatedCards, changed };
}

function updateReplacements(replacements, catalogById, catalogByCardId, catalogByNameImage) {
  if (!Array.isArray(replacements)) return { replacements, changed: false };

  let changed = false;
  const updatedReplacements = replacements.map(group => {
    const updatedGroup = { ...group };

    if (group.source) {
      const result = applyCatalogToInlineCard(group.source, catalogById, catalogByCardId, catalogByNameImage, "img");
      if (result.changed) {
        updatedGroup.source = result.card;
        changed = true;
      }
    }

    const sourcesResult = updateArrayCards(group.sources, catalogById, catalogByCardId, catalogByNameImage, "img");
    if (sourcesResult.changed) {
      updatedGroup.sources = sourcesResult.cards;
      changed = true;
    }

    const alternativesResult = updateArrayCards(group.alternatives, catalogById, catalogByCardId, catalogByNameImage, "img");
    if (alternativesResult.changed) {
      updatedGroup.alternatives = alternativesResult.cards;
      changed = true;
    }

    return updatedGroup;
  });

  return { replacements: updatedReplacements, changed };
}

function updateDeckData(deckData, catalogById, catalogByCardId, catalogByNameImage) {
  if (!deckData || typeof deckData !== "object") return { deckData, changed: false };

  const updatedDeckData = { ...deckData };
  let changed = false;

  const legacyCardsResult = updateArrayCards(deckData.cards, catalogById, catalogByCardId, catalogByNameImage, "img");
  if (legacyCardsResult.changed) {
    updatedDeckData.cards = legacyCardsResult.cards;
    changed = true;
  }

  if (Array.isArray(deckData.tabs)) {
    const updatedTabs = deckData.tabs.map(tab => {
      const updatedTab = { ...tab };
      let tabChanged = false;

      if (tab.coverCard) {
        const coverResult = applyCatalogToInlineCard(tab.coverCard, catalogById, catalogByCardId, catalogByNameImage, "img");
        if (coverResult.changed) {
          updatedTab.coverCard = coverResult.card;
          if (coverResult.card.img) updatedTab.coverImg = coverResult.card.img;
          tabChanged = true;
        }
      }

      const cardsResult = updateArrayCards(tab.cards, catalogById, catalogByCardId, catalogByNameImage, "img");
      if (cardsResult.changed) {
        updatedTab.cards = cardsResult.cards;
        tabChanged = true;
      }

      const replacementsResult = updateReplacements(tab.replacements, catalogById, catalogByCardId, catalogByNameImage);
      if (replacementsResult.changed) {
        updatedTab.replacements = replacementsResult.replacements;
        tabChanged = true;
      }

      if (tabChanged) changed = true;
      return updatedTab;
    });

    if (changed) updatedDeckData.tabs = updatedTabs;
  }

  return { deckData: updatedDeckData, changed };
}

function getTopLevelUpdates(data, catalogById, catalogByCardId, catalogByNameImage) {
  const updates = {};
  const { card: catalogCard, matchType } = findCatalogCard(data, catalogById, catalogByCardId, catalogByNameImage);

  if (catalogCard) {
    setIfChanged(updates, "name", data.name, catalogCard.name);
    setIfChanged(updates, "imageUrl", data.imageUrl, catalogCard.imageUrl);
    if ("img" in data) setIfChanged(updates, "img", data.img, catalogCard.imageUrl);
    if ("imageURL" in data) setIfChanged(updates, "imageURL", data.imageURL, catalogCard.imageUrl);
    setIfChanged(updates, "rarity", data.rarity, catalogCard.rarity);
  }

  const normalizedRarity = normalizeRarity(updates.rarity || data.rarity);
  if (normalizedRarity !== data.rarity) updates.rarity = normalizedRarity;

  return {
    updates,
    matchedCatalog: Boolean(catalogCard),
    matchType
  };
}

async function commitOperations(operations) {
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + batchSize);

    chunk.forEach(operation => {
      batch.update(operation.ref, operation.updates);
    });

    await batch.commit();
    console.log(`Committed ${Math.min(i + chunk.length, operations.length)} / ${operations.length}`);
    await sleep(150);
  }
}

const catalogCards = JSON.parse(await fs.readFile(catalogJsonPath, "utf8"))
  .filter(card => card?.name && (card.id || card.imageUrl))
  .map((card, index) => ({
    docId: card.docId || card.id || card.cardId || `catalog-${index}`,
    ...card,
    imageUrl: card.imageUrl || card.img || "",
    img: card.img || card.imageUrl || ""
  }));
const catalogById = getCatalogById(catalogCards);
const catalogByCardId = getCatalogByCardId(catalogCards);
const catalogByNameImage = getCatalogByNameImage(catalogCards);

if (catalogById.size === 0) {
  console.log(`No catalog cards found in ${catalogJsonPath}. Run: node crawler\\raenonx-cards.mjs`);
  await terminate(db);
  process.exit(1);
}

const cardsSnapshot = await getDocs(cardsCollection);
const operations = [];
const samples = [];
const unmatchedTopLevelCards = [];
let matchedDocs = 0;
let matchedByIdDocs = 0;
let matchedByCardIdDocs = 0;
let matchedByNameImageDocs = 0;
let ambiguousCardIdDocs = 0;
let ambiguousNameImageDocs = 0;
let unmatchedDocsWithId = 0;
let unmatchedDocsWithoutId = 0;
let legacyRarityOnlyDocs = 0;
let nestedDeckDocs = 0;

cardsSnapshot.docs.forEach(documentSnapshot => {
  const data = documentSnapshot.data();
  const isTopLevelCardCandidate = Boolean(data.id || data.name || getCardImageValue(data) || data.rarity);
  const { updates, matchedCatalog, matchType } = getTopLevelUpdates(data, catalogById, catalogByCardId, catalogByNameImage);

  if (matchedCatalog && isTopLevelCardCandidate) {
    matchedDocs += 1;
    if (matchType === "id") matchedByIdDocs += 1;
    if (matchType === "cardId") matchedByCardIdDocs += 1;
    if (matchType === "name+image") matchedByNameImageDocs += 1;
  } else if (isTopLevelCardCandidate) {
    if (matchType === "ambiguous-cardId") ambiguousCardIdDocs += 1;
    if (matchType === "ambiguous-name+image") ambiguousNameImageDocs += 1;
    if (data.id) unmatchedDocsWithId += 1;
    else unmatchedDocsWithoutId += 1;

    unmatchedTopLevelCards.push({
      docId: documentSnapshot.id,
      section: data.section || "alt_acc",
      id: data.id || "",
      name: data.name || "",
      imageUrl: getCardImageValue(data),
      normalizedImageUrl: normalizeCardImageUrl(getCardImageValue(data)),
      rarity: data.rarity || "",
      matchType
    });
  }

  if (Object.keys(updates).length > 0 && !matchedCatalog) {
    legacyRarityOnlyDocs += 1;
  }

  const deckResult = updateDeckData(data.deckData, catalogById, catalogByCardId, catalogByNameImage);
  if (deckResult.changed) {
    updates.deckData = deckResult.deckData;
    nestedDeckDocs += 1;
  }

  if (Object.keys(updates).length === 0) return;

  operations.push({
    ref: doc(cardsCollection, documentSnapshot.id),
    updates
  });

  if (samples.length < 12) {
    samples.push({
      docId: documentSnapshot.id,
      section: data.section || "alt_acc",
      id: data.id || "",
      before: {
        name: data.name,
        imageUrl: data.imageUrl || data.img || data.imageURL || "",
        rarity: data.rarity
      },
      updates: Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [
          key,
          key === "deckData" ? "[deckData updated]" : value
        ])
      )
    });
  }
});

console.log(`${dryRun ? "[dry-run] " : ""}Catalog cards by id: ${catalogById.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}Catalog unique cardId keys: ${catalogByCardId.uniqueMap.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}Catalog ambiguous cardId keys: ${catalogByCardId.ambiguousMap.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}Catalog unique name+image keys: ${catalogByNameImage.uniqueMap.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}Catalog ambiguous name+image keys: ${catalogByNameImage.ambiguousKeys.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}ptcg_cards docs: ${cardsSnapshot.size}`);
console.log(`${dryRun ? "[dry-run] " : ""}Matched top-level docs: ${matchedDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}  - by id: ${matchedByIdDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}  - by cardId: ${matchedByCardIdDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}  - by name+image: ${matchedByNameImageDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}Unmatched top-level docs with id: ${unmatchedDocsWithId}`);
console.log(`${dryRun ? "[dry-run] " : ""}Unmatched top-level docs without id: ${unmatchedDocsWithoutId}`);
console.log(`${dryRun ? "[dry-run] " : ""}Ambiguous cardId docs: ${ambiguousCardIdDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}Ambiguous name+image docs: ${ambiguousNameImageDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}Legacy rarity-only docs: ${legacyRarityOnlyDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}Meta deck docs with nested updates: ${nestedDeckDocs}`);
console.log(`${dryRun ? "[dry-run] " : ""}Docs to update: ${operations.length}`);

if (samples.length > 0) {
  console.log("Samples:");
  console.log(JSON.stringify(samples, null, 2));
}

if (unmatchedTopLevelCards.length > 0) {
  console.log("Unmatched top-level cards:");
  console.log(JSON.stringify(unmatchedTopLevelCards, null, 2));
}

if (!dryRun) {
  await commitOperations(operations);
}

console.log("Done.");
await terminate(db);
