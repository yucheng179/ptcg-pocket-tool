import fs from "node:fs/promises";

const locale = "zh";
const masterUrl = "https://ptcgp.raenonx.cc/api/data/global-master";
const cardPageUrl = `https://ptcgp.raenonx.cc/${locale}/card`;
const outputPath = "crawler/raenonx-cards.json";

const rarityMap = {
  C: "1菱",
  U: "2菱",
  R: "3菱",
  RR: "4菱",
  AR: "1星",
  SR: "2星",
  SAR: "2星",
  IM: "3星",
  S: "1閃",
  SSR: "2閃",
  UR: "皇冠"
};

function imageUrl(path) {
  return `https://cdn.raenonx.cc/api/image/ptcgp?format=webp&url=/images/${path}`;
}

function getCardImageUrl(cardId) {
  return imageUrl(`game/card/full/${locale}/${cardId}.png`);
}

function getCollectionId(collectionNum) {
  if (!collectionNum) return "";
  return `${collectionNum.expansion.id}-${String(collectionNum.num).padStart(3, "0")}`;
}

function extractNextFlightText(html) {
  const chunks = [];
  const scriptPattern = /<script>([\s\S]*?)<\/script>/g;

  for (const match of html.matchAll(scriptPattern)) {
    const script = match[1].trim();
    const prefix = "self.__next_f.push(";
    if (!script.startsWith(prefix)) continue;

    try {
      const payload = script.slice(prefix.length, -1);
      const nextChunk = Function(`"use strict"; return (${payload});`)();
      if (Array.isArray(nextChunk) && typeof nextChunk[1] === "string") {
        chunks.push(nextChunk[1]);
      }
    } catch {
      // Ignore non-data script chunks.
    }
  }

  return chunks.join("\n");
}

function extractNextMessages(html) {
  const text = extractNextFlightText(html) || html;
  const marker = '"messages":';
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) throw new Error("找不到 Next.js messages payload");

  const start = markerIndex + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1));
      }
    }
  }

  throw new Error("messages payload 解析失敗");
}

function getCardName(cardEntry, messages) {
  const nameId = cardEntry.play?.characterI18nId;
  return messages?.Game?.Master?.Card?.Name?.[nameId] || "";
}

const regionalFormPrefixes = ["\u963f\u7f85\u62c9", "\u4f3d\u52d2\u723e", "\u6d17\u7fe0", "\u5e15\u5e95\u4e9e"];

function normalizeRegionalFormSpacing(name) {
  let normalizedName = name;
  regionalFormPrefixes.forEach(prefix => {
    normalizedName = normalizedName.replace(new RegExp(`^(${prefix})(?!\\s)`), "$1 ");
    normalizedName = normalizedName.replace(new RegExp(`^(\u8d85\u7d1a${prefix})(?!\\s)`), "$1 ");
  });
  return normalizedName;
}

function formatDisplayCardName(name) {
  let trimmedName = (name || "").trim();
  trimmedName = normalizeRegionalFormSpacing(trimmedName);
  trimmedName = trimmedName.replace(/^厄鬼椪(碧草面具|火灶面具|水井面具|礎石面具)/, "厄鬼椪 $1");
  const megaMatch = trimmedName.match(/^超級(.+)ex$/);
  if (megaMatch) return `Mega${megaMatch[1]}`;
  if (trimmedName.endsWith("ex")) return `${trimmedName.slice(0, -2)}EX`;
  return trimmedName;
}

function getCatalogCardType(cardEntry) {
  if (cardEntry.cardType === "trainer" && cardEntry.play?.cardType) {
    return cardEntry.play.cardType;
  }
  return cardEntry.cardType || "";
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

console.log("Fetching global master...");
const master = await fetchJson(masterUrl);

console.log("Fetching zh messages...");
const html = await fetchText(cardPageUrl);
const messages = extractNextMessages(html);

const cards = Object.values(master.cardEntryMap)
  .flatMap(cardEntry => {
    const collectionNums = cardEntry.collectionNums?.length ? cardEntry.collectionNums : [null];
    return collectionNums.map(collectionNum => ({
      name: formatDisplayCardName(getCardName(cardEntry, messages)),
      id: getCollectionId(collectionNum),
      expansion: collectionNum?.expansion?.id || "",
      imageUrl: getCardImageUrl(cardEntry.cardId),
      rarity: rarityMap[cardEntry.rarity] || cardEntry.rarity || "",
      sourceRarity: cardEntry.rarity || "",
      cardId: cardEntry.cardId,
      cardType: getCatalogCardType(cardEntry),
      sourceCardType: cardEntry.cardType || "",
      trainerType: cardEntry.cardType === "trainer" ? cardEntry.play?.cardType || "" : ""
    }));
  })
  .filter(card => card.name && card.id)
  .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));

await fs.writeFile(outputPath, JSON.stringify(cards, null, 2), "utf8");
console.log(`Saved ${cards.length} cards to ${outputPath}`);
console.log(cards.slice(0, 5));
