import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { browserLocalPersistence, getAuth, GoogleAuthProvider, getRedirectResult, onAuthStateChanged, setPersistence, signInWithPopup, signInWithRedirect, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBdT8oG7bjqOIZlnjEvkoxBz1GTlTx4s-k",
  authDomain: "ptcg-pocket-dex-1ac80.firebaseapp.com",
  projectId: "ptcg-pocket-dex-1ac80",
  storageBucket: "ptcg-pocket-dex-1ac80.firebasestorage.app",
  messagingSenderId: "104827060691",
  appId: "1:104827060691:web:5de9e363eb31d7e4822f26"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const authReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Firebase Auth persistence setup failed:", error);
});
const cardsCollection = collection(db, "ptcg_cards"); 
const cardCatalogJsonUrl = "crawler/raenonx-cards.json";

let cardsData = [];
let uniqueCardsDict = {}; 
let catalogCardsData = [];
let activeCatalogExpansionId = null;
let activeCatalogSeries = "B";
let catalogGroupByCardType = false;
let catalogCollapsedTypeGroups = new Set();
let catalogGlobalSearchQuery = "";
let catalogDetailSearchQuery = "";
let catalogSelectedTypeFilters = new Set();
let catalogSelectedRarityFilters = new Set();
let cardAutocompleteContext = null;
let deckCardAutocompleteContext = null;
const collapsedRarityBlocks = new Set();

let currentSection = "alt_acc"; 
let currentAccountTab = "小帳";
let currentNeededTab = "缺少的卡"; 
let currentTwoStarTab = "擁有的卡"; 
let editingCardDocId = null; 
let draggedCardDocId = null; 
let editingDeckDocId = null;
let draggedDeckDocId = null;
let draggedDeckCardIndex = null;
let draggedDeckTabId = null;
let editingDeckCardIndex = null;
let editingReplacementContext = null;
let activeMetaDeckId = null; 
let activeDeckTabId = null;
let deckTabClickTimer = null;
let activeMetaLobbyTabId = null;
let draggedMetaLobbyTabId = null;
let metaLobbyTabClickTimer = null;
let draggedGeneralTagName = null;
const AUTO_TEAM_LOBBY_TAB_ID = "auto-team";
const DEFAULT_24H_VERSION_TAB_ID = "b4";
let active24hVersionTabId = DEFAULT_24H_VERSION_TAB_ID;
let challenge24hTabClickTimer = null;
let draggedChallenge24hTabId = null;
let currentAuthUser = null;
let unsubscribeCardsSnapshot = null;

// --- 常數定義 ---
const catalogExpansionIds = [
    "A1", "A1a", "A2", "A2a", "A2b", "A3", "A3a", "A3b", "A4", "A4a", "A4b",
    "B1", "B1a", "B2", "B2a", "B2b", "B3", "B3a", "B3b", "B4"
];
const catalogPromoExpansionIds = ["PROMO-A", "PROMO-B"];

const raritiesAlt = [
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" },
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" },
    { name: "3星", icon: "https://img.game8.co/3995619/a0d611ce374e3070c530ee8d3fd81efa.png/show" },
    { name: "1閃", icon: "https://img.game8.co/4137129/6510d1633ee489b2e8fcba939d7e99cb.png/show" }, 
    { name: "2閃", icon: "https://img.game8.co/4137130/6eb953da81d509f5f6fde8f63ded90f6.png/show" },
    { name: "皇冠", icon: "https://img.game8.co/3997607/303598e292a532bcde37ab527a0ac263.png/show" }
];

const rarities24h = [
    { name: "3菱", icon: "https://img.game8.co/3995616/740cd3cbff061c16c8e5d8eea939bb59.png/show" }, 
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" },
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" }
];
const challenge24hImportRarities = new Set(rarities24h.map(rarity => rarity.name));

const raritiesNeededMissing = [
    { name: "2菱", icon: "https://img.game8.co/3995615/ef7758a60d9c9d1871eca629c203b81e.png/show" },
    { name: "3菱", icon: "https://img.game8.co/3995616/740cd3cbff061c16c8e5d8eea939bb59.png/show" }, 
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" },
    { name: "1閃", icon: "https://img.game8.co/4137129/6510d1633ee489b2e8fcba939d7e99cb.png/show" }
];

const raritiesNeededGold = [
    { name: "1菱", icon: "https://img.game8.co/3994728/d0cbe26800d9abdfccddbbfd5aeab3e5.png/show" }, 
    { name: "2菱", icon: "https://img.game8.co/3995615/ef7758a60d9c9d1871eca629c203b81e.png/show" },
    { name: "3菱", icon: "https://img.game8.co/3995616/740cd3cbff061c16c8e5d8eea939bb59.png/show" }
];

const raritiesTwoStar = [
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" },
    { name: "2閃", icon: "https://img.game8.co/4137130/6eb953da81d509f5f6fde8f63ded90f6.png/show" },
    { name: "3星", icon: "https://img.game8.co/3995619/a0d611ce374e3070c530ee8d3fd81efa.png/show" },
    { name: "皇冠", icon: "https://img.game8.co/3997607/303598e292a532bcde37ab527a0ac263.png/show" }
];
const highRarityNames = new Set(raritiesTwoStar.map(rarity => rarity.name));

const typesGeneral = [
    { name: "支援者" },
    { name: "物品" },
    { name: "道具" },
    { name: "競技場" },
    { name: "寶可夢" }
];

const generalTagColors = [
    { name: "預設", value: "#6c5ce7", bg: "#ece7ff" },
    { name: "灰色", value: "#787774", bg: "#eeeeec" },
    { name: "棕色", value: "#9f6b53", bg: "#f4e6dc" },
    { name: "橘色", value: "#d9730d", bg: "#fae3d0" },
    { name: "黃色", value: "#cb912f", bg: "#fdecc8" },
    { name: "綠色", value: "#448361", bg: "#dbeddb" },
    { name: "藍色", value: "#337ea9", bg: "#d3e5ef" },
    { name: "紫色", value: "#9065b0", bg: "#e8deee" },
    { name: "粉色", value: "#c14c8a", bg: "#f5e0e9" },
    { name: "紅色", value: "#d44c47", bg: "#ffe2dd" }
];
const GENERAL_TAG_ORDER_STORAGE_KEY = "ptcg-general-tag-order";
const AUTOCOMPLETE_MAX_MATCHES = 120;

const tierWeights = { "SS": 8, "S": 7, "A": 6, "B": 5, "C": 4, "D": 3, "E": 2, "無": 1 };
const deckRowTypes = [
    { key: "寶可夢", label: "寶可夢", aliases: ["寶可夢"] },
    { key: "支援者", label: "支援者", aliases: ["支援者"] },
    { key: "物品、道具、競技場", label: "物品、道具、競技場", aliases: ["物品、道具、競技場", "物品與道具"] }
];
const defaultNewDeckCards = [
    { name: "博士的研究", id: "A4b-373", type: "支援者", qty: 2 },
    { name: "娜姿", id: "A1-272", type: "支援者", qty: 1 },
    { name: "赤日", id: "A2-190", type: "支援者", qty: 1 },
    { name: "模仿少女", id: "B1-270", type: "支援者", qty: 1 },
    { name: "精靈球", id: "PROMO-A-005", type: "物品、道具、競技場", qty: 2 }
];
const deckAttributeMeta = {
    "草": { icon: "https://img.game8.co/4018726/c2d96eaebb6cd06d6a53dfd48da5341c.png/show", className: "attr-grass" },
    "火": { icon: "https://img.game8.co/4018725/13914d1a973822da2863205cffe8d814.png/show", className: "attr-fire" },
    "水": { icon: "https://img.game8.co/4018730/0eaf098686c55dd62893b16d190c80b5.png/show", className: "attr-water" },
    "雷": { icon: "https://img.game8.co/4018727/9851d3f597a114b1ab6ef669071cda7c.png/show", className: "attr-lightning" },
    "電": { icon: "https://img.game8.co/4018727/9851d3f597a114b1ab6ef669071cda7c.png/show", className: "attr-lightning" },
    "超": { icon: "https://img.game8.co/4018729/5d54ec566203717af2c7b7a14f69e0d7.png/show", className: "attr-psychic" },
    "鬥": { icon: "https://img.game8.co/4018724/e22e7f39587352fc048b3821da0ceea4.png/show", className: "attr-fighting" },
    "惡": { icon: "https://img.game8.co/4018722/3488b79c0d788fbcb381c92ce97b750d.png/show", className: "attr-dark" },
    "鋼": { icon: "https://img.game8.co/4018728/fdfe7a7dc4753da40de9c04aa96ccc25.png/show", className: "attr-metal" },
    "龍": { icon: "https://img.game8.co/4018723/65faf7d97c4fc59e1bf4bb67bc37af16.png/show", className: "attr-dragon" },
    "無": { icon: "https://img.game8.co/4018721/a654c44596214b3bf38769c180602a16.png/show", className: "attr-colorless" }
};

function renderDeckAttributeIcon(icon, attrName) {
    if (!icon) return "•";
    if (/^https?:\/\//i.test(icon)) {
        return `<img class="deck-attr-icon" src="${icon}" alt="${attrName}" onerror="this.style.display='none'">`;
    }
    return icon;
}

function normalizeCardName(name = "") {
    return name
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase();
}

function normalizeCardImageUrl(imageUrl = "") {
    const cleanedUrl = imageUrl
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/&amp;/g, "&")
        .trim();
    if (!cleanedUrl) return "";

    const decodeLoose = (value) => {
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

    const normalizePath = (path) => decodeLoose(path)
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

function normalizeCardId(id = "") {
    return id
        .normalize("NFKC")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, "")
        .trim()
        .toLocaleLowerCase();
}

function isSameAutocompleteCard(existing, normalizedImageUrl, normalizedId) {
    const hasSameId = Boolean(normalizedId)
        && Boolean(existing.normalizedId)
        && existing.normalizedId === normalizedId;
    const hasSameImage = Boolean(normalizedImageUrl)
        && Boolean(existing.normalizedImageUrl)
        && existing.normalizedImageUrl === normalizedImageUrl;
    return hasSameId || hasSameImage;
}

function getGeneralTypeCatalogKeys(typeName = "") {
    const normalized = String(typeName || "").trim();
    if (normalized === "寶可夢") return ["pokemon"];
    if (normalized === "支援者") return ["support"];
    if (normalized === "物品") return ["item"];
    if (normalized === "道具") return ["pokemonTool"];
    if (normalized === "競技場") return ["stadium"];
    if (normalized === "物品、道具、競技場" || normalized === "物品與道具") return ["item", "pokemonTool", "stadium"];
    return [];
}

function getAutocompleteCardTypeKey(card = {}) {
    if (card.cardType) return getCatalogCardTypeKey(card.cardType);
    const typeName = card.generalData?.type || card.type || card.twoStarData?.type || "";
    const mappedTypes = getGeneralTypeCatalogKeys(typeName);
    return mappedTypes.length === 1 ? getCatalogCardTypeKey(mappedTypes[0]) : "";
}

function getAutocompleteContextForCardForm(rarityName = null, typeName = null) {
    if (["alt_acc", "24h", "needed_cards", "two_star_cards"].includes(currentSection) && rarityName) {
        return { rarities: [rarityName] };
    }
    if (currentSection === "general_cards" && typeName) {
        const cardTypes = getGeneralTypeCatalogKeys(typeName).map(type => getCatalogCardTypeKey(type));
        return cardTypes.length ? { cardTypes } : null;
    }
    return null;
}

function getAutocompleteContextForExistingCard(card = {}) {
    if (card.section === "general_cards") {
        const cardTypes = getGeneralTypeCatalogKeys(card.generalData?.type).map(type => getCatalogCardTypeKey(type));
        return cardTypes.length ? { cardTypes } : null;
    }
    if (["alt_acc", "24h", "needed_cards", "two_star_cards"].includes(card.section) && card.rarity) {
        return { rarities: [card.rarity] };
    }
    return null;
}

function getDeckRowCatalogTypeKeys(rowType = "") {
    return getGeneralTypeCatalogKeys(getDeckCardType(rowType)).map(type => getCatalogCardTypeKey(type));
}

function autocompleteCardMatchesContext(card = {}, context = null) {
    if (!context) return true;

    if (Array.isArray(context.rarities) && context.rarities.length) {
        const rarity = String(card.rarity || "").trim();
        if (!context.rarities.includes(rarity)) return false;
    }

    if (Array.isArray(context.cardTypes) && context.cardTypes.length) {
        const cardType = getAutocompleteCardTypeKey(card);
        if (!cardType || !context.cardTypes.includes(cardType)) return false;
    }

    return true;
}

function addUniqueCardToDict(card = {}) {
    const name = (card.name || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
    const normalizedName = normalizeCardName(name);
    if (!normalizedName) return;

    const imageUrl = (card.imageUrl || card.img || "").trim();
    const normalizedImageUrl = normalizeCardImageUrl(imageUrl);
    const id = (card.id || "").trim();
    const normalizedId = normalizeCardId(id);
    const rarity = card.rarity || "1星";
    const sourceRarity = card.sourceRarity || "";
    const cardType = getAutocompleteCardTypeKey(card);
    const bgColor = card.bgColor || "#ffffff";

    if (!uniqueCardsDict[normalizedName]) {
        uniqueCardsDict[normalizedName] = [];
    }

    const existing = uniqueCardsDict[normalizedName].find(item =>
        isSameAutocompleteCard(item, normalizedImageUrl, normalizedId)
    );
    if (!existing) {
        uniqueCardsDict[normalizedName].push({ name, id, normalizedId, imageUrl, normalizedImageUrl, rarity, sourceRarity, cardType, bgColor });
        return;
    }

    if (!existing.name && name) existing.name = name;
    if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
    if (!existing.id && id) {
        existing.id = id;
        existing.normalizedId = normalizedId;
    }
    if (!existing.rarity && rarity) existing.rarity = rarity;
    if (!existing.sourceRarity && sourceRarity) existing.sourceRarity = sourceRarity;
    if (!existing.cardType && cardType) existing.cardType = cardType;
    if ((!existing.bgColor || existing.bgColor === "#ffffff") && bgColor) {
        existing.bgColor = bgColor;
    }
}

function getAutocompleteMatches(filterText = "", context = null, limit = AUTOCOMPLETE_MAX_MATCHES) {
    const normalizedFilter = normalizeCardName(filterText);
    const matches = [];

    for (const [normalizedName, variants] of Object.entries(uniqueCardsDict)) {
        if (!normalizedName.includes(normalizedFilter)) continue;

        for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
            const data = variants[variantIndex];
            if (!autocompleteCardMatchesContext(data, context)) continue;
            matches.push({ name: data.name, data, variantIndex });
            if (matches.length >= limit) return matches;
        }
    }

    return matches;
}

function addCardRecordToAutocompleteDict(card = {}) {
    addUniqueCardToDict(card);

    if (card.twoStarData?.tradedCard) {
        addUniqueCardToDict(card.twoStarData.tradedCard);
    }

    if (card.section !== "meta_deck" || !card.deckData) return;

    if (card.deckData.coverCard) {
        addUniqueCardToDict({ name: card.deckData.coverCard.name, img: card.deckData.coverCard.img || card.deckData.coverImg });
    }
    if (card.deckData.coverName || card.deckData.coverImg) {
        addUniqueCardToDict({ name: card.deckData.coverName, img: card.deckData.coverImg });
    }

    const deckCards = Array.isArray(card.deckData.cards) ? card.deckData.cards : [];
    deckCards.forEach(deckCard => addUniqueCardToDict(deckCard));

    const deckTabs = Array.isArray(card.deckData.tabs) ? card.deckData.tabs : [];
    deckTabs.forEach(tab => {
        if (tab.coverCard) addUniqueCardToDict({ name: tab.coverCard.name, img: tab.coverCard.img || tab.coverImg });
        if (tab.coverName || tab.coverImg) addUniqueCardToDict({ name: tab.coverName, img: tab.coverImg });
        if (Array.isArray(tab.cards)) tab.cards.forEach(deckCard => addUniqueCardToDict(deckCard));
        if (Array.isArray(tab.replacements)) {
            tab.replacements.forEach(group => {
                getReplacementSources(group).forEach(deckCard => addUniqueCardToDict(deckCard));
                if (Array.isArray(group.alternatives)) group.alternatives.forEach(deckCard => addUniqueCardToDict(deckCard));
            });
        }
    });
}

function rebuildUniqueCardsDict(cardRecords = cardsData) {
    uniqueCardsDict = {};
    catalogCardsData.forEach(card => addUniqueCardToDict(card));
    cardRecords.forEach(card => addCardRecordToAutocompleteDict(card));
}

function getCardQuantity(card) {
    return card.neededCardsData?.quantity || card.twoStarData?.quantity || card.altAccData?.quantity || 1;
}

function getChallenge24hVersionTabs() {
    const config = cardsData.find(card => card.section === "challenge_24h_version_config");
    const tabs = config?.versionTabs;
    return Array.isArray(tabs) && tabs.length > 0
        ? tabs
        : [{ id: DEFAULT_24H_VERSION_TAB_ID, name: "B4" }];
}

function getChallenge24hCardVersionTabId(card) {
    return card.challenge24hData?.versionTabId || DEFAULT_24H_VERSION_TAB_ID;
}

function getChallenge24hVersionTabName(tabId = active24hVersionTabId) {
    return getChallenge24hVersionTabs().find(tab => tab.id === tabId)?.name || "B4";
}

function getChallenge24hImportExpansionOptions() {
    const existingIds = Array.from(new Set(catalogCardsData.map(card => card.expansion).filter(Boolean)));
    return existingIds.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function getDefaultChallenge24hImportExpansion() {
    const options = getChallenge24hImportExpansionOptions();
    const activeTabName = getChallenge24hVersionTabName();
    return options.find(id => activeTabName.toLowerCase().startsWith(id.toLowerCase()))
        || options[0]
        || "";
}

async function saveChallenge24hVersionTabs(tabs) {
    const normalizedTabs = tabs.length > 0 ? tabs : [{ id: DEFAULT_24H_VERSION_TAB_ID, name: "B4" }];
    const config = cardsData.find(card => card.section === "challenge_24h_version_config");
    if (config) {
        await updateDoc(doc(db, "ptcg_cards", config.docId), { versionTabs: normalizedTabs });
    } else {
        await addDoc(cardsCollection, { section: "challenge_24h_version_config", versionTabs: normalizedTabs });
    }
}

function normalizeTagName(name = "") {
    return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function isValidHexColor(color = "") {
    return /^#[0-9a-f]{6}$/i.test(color);
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getGeneralTagLibrary(typeName = getSelectedGeneralTagType()) {
    const tagMap = new Map();
    const normalizedType = normalizeTagName(typeName);
    cardsData.forEach(card => {
        if (card.section !== "general_cards") return;
        if (normalizeTagName(card.generalData?.type || "") !== normalizedType) return;
        const tagName = (card.generalData?.tagName || "").trim();
        if (!tagName) return;
        const key = normalizeTagName(tagName);
        if (!key || tagMap.has(key)) return;
        const tagColor = isValidHexColor(card.generalData?.tagColor) ? card.generalData.tagColor : "#787774";
        tagMap.set(key, { name: tagName, color: tagColor });
    });
    return tagMap;
}

function getGeneralTagColorMeta(color) {
    return generalTagColors.find(item => item.value.toLocaleLowerCase() === color?.toLocaleLowerCase())
        || generalTagColors.find(item => item.name === "灰色")
        || generalTagColors[0];
}

function getSelectedGeneralTagType() {
    return document.getElementById("card-general-type")?.value || "支援者";
}

function getGeneralTagOrderStorageKey(typeName = getSelectedGeneralTagType()) {
    return `${GENERAL_TAG_ORDER_STORAGE_KEY}:${normalizeTagName(typeName)}`;
}

function getGeneralTagOrder(typeName = getSelectedGeneralTagType()) {
    try {
        const savedOrder = JSON.parse(localStorage.getItem(getGeneralTagOrderStorageKey(typeName)) || "[]");
        return Array.isArray(savedOrder) ? savedOrder : [];
    } catch {
        return [];
    }
}

function saveGeneralTagOrder(tagNames, typeName = getSelectedGeneralTagType()) {
    localStorage.setItem(getGeneralTagOrderStorageKey(typeName), JSON.stringify(tagNames.map(normalizeTagName).filter(Boolean)));
}

function sortGeneralTags(tags, typeName = getSelectedGeneralTagType()) {
    const order = getGeneralTagOrder(typeName);
    const orderMap = new Map(order.map((name, index) => [name, index]));
    return [...tags].sort((a, b) => {
        const indexA = orderMap.has(normalizeTagName(a.name)) ? orderMap.get(normalizeTagName(a.name)) : Number.MAX_SAFE_INTEGER;
        const indexB = orderMap.has(normalizeTagName(b.name)) ? orderMap.get(normalizeTagName(b.name)) : Number.MAX_SAFE_INTEGER;
        if (indexA !== indexB) return indexA - indexB;
        return a.name.localeCompare(b.name);
    });
}

function showGeneralTagOptions() {
    renderGeneralTagList();
    generalTagList.classList.add("show");
}

function hideGeneralTagOptions() {
    generalTagList.classList.remove("show");
    hideGeneralTagColorPopover();
}

function hideGeneralTagColorPopover() {
    generalTagColorPopover.classList.remove("show");
    generalTagColorPopover.innerHTML = "";
}

function openGeneralTagColorPopover(anchorEl, targetTagName = generalTagNameInput.value) {
    const selectedColor = generalTagColorInput.value || getGeneralTagColorMeta().value;
    const selectedType = getSelectedGeneralTagType();
    generalTagColorPopover.innerHTML = `<div class="general-tag-color-title">顏色</div>`;
    generalTagColors.forEach(color => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "general-tag-color-option";
        button.classList.toggle("selected", color.value.toLocaleLowerCase() === selectedColor.toLocaleLowerCase());
        button.innerHTML = `
            <span class="general-tag-color-swatch" style="background:${color.bg}; border-color:${color.value};"></span>
            <span>${color.name}</span>
            <span class="general-tag-color-check">✓</span>
        `;
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            generalTagNameInput.value = targetTagName;
            generalTagColorInput.value = color.value;
            renderGeneralTagList();
            generalTagList.classList.add("show");
            hideGeneralTagColorPopover();
        });
        generalTagColorPopover.appendChild(button);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "general-tag-delete-option";
    deleteButton.innerHTML = `<span>刪除標籤</span>`;
    deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteGeneralTag(targetTagName, selectedType);
    });
    generalTagColorPopover.appendChild(deleteButton);

    generalTagColorPopover.classList.add("show");

    const rect = anchorEl.getBoundingClientRect();
    const popoverRect = generalTagColorPopover.getBoundingClientRect();
    const margin = 12;
    const left = Math.max(margin, Math.min(rect.right + 8, window.innerWidth - popoverRect.width - margin));
    const preferredTop = rect.bottom - popoverRect.height + 8;
    const top = Math.max(margin, Math.min(preferredTop, window.innerHeight - popoverRect.height - margin));
    generalTagColorPopover.style.left = `${left}px`;
    generalTagColorPopover.style.top = `${top}px`;
}

function renderGeneralTagList(openColorTagName = null) {
    const selectedType = getSelectedGeneralTagType();
    const tags = sortGeneralTags(Array.from(getGeneralTagLibrary(selectedType).values()), selectedType);
    generalTagList.innerHTML = "";
    if (tags.length === 0) {
        generalTagList.innerHTML = `<div class="general-tag-empty">尚未建立標籤，輸入名稱即可建立</div>`;
        return;
    }

    tags.forEach(tag => {
        const colorMeta = getGeneralTagColorMeta(tag.color);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "general-tag-option";
        button.draggable = true;
        button.dataset.tagName = tag.name;
        button.style.setProperty("--tag-color", colorMeta.value);
        button.style.setProperty("--tag-bg", colorMeta.bg);
        button.innerHTML = `
            <span class="general-tag-drag" title="拖曳排序">⋮⋮</span>
            <span class="general-tag-pill">${escapeHtml(tag.name)}</span>
            <span class="general-tag-spacer"></span>
            <span class="general-tag-more">•••</span>
        `;
        button.addEventListener("click", () => {
            generalTagNameInput.value = tag.name;
            generalTagColorInput.value = colorMeta.value;
        });
        button.querySelector(".general-tag-more").addEventListener("click", (event) => {
            event.stopPropagation();
            generalTagNameInput.value = tag.name;
            generalTagColorInput.value = colorMeta.value;
            openGeneralTagColorPopover(event.currentTarget, tag.name);
        });
        button.addEventListener("dragstart", (event) => {
            draggedGeneralTagName = tag.name;
            event.dataTransfer.effectAllowed = "move";
            setTimeout(() => button.classList.add("dragging"), 0);
        });
        button.addEventListener("dragend", () => {
            draggedGeneralTagName = null;
            button.classList.remove("dragging");
        });
        button.addEventListener("dragover", (event) => {
            if (!draggedGeneralTagName || draggedGeneralTagName === tag.name) return;
            event.preventDefault();
            button.classList.add("drag-over");
        });
        button.addEventListener("dragleave", () => button.classList.remove("drag-over"));
        button.addEventListener("drop", (event) => {
            event.preventDefault();
            button.classList.remove("drag-over");
            if (!draggedGeneralTagName || draggedGeneralTagName === tag.name) return;
            const nextOrder = sortGeneralTags(Array.from(getGeneralTagLibrary(selectedType).values()), selectedType).map(item => item.name);
            const fromIndex = nextOrder.findIndex(name => normalizeTagName(name) === normalizeTagName(draggedGeneralTagName));
            const toIndex = nextOrder.findIndex(name => normalizeTagName(name) === normalizeTagName(tag.name));
            if (fromIndex === -1 || toIndex === -1) return;
            const [movedTag] = nextOrder.splice(fromIndex, 1);
            nextOrder.splice(toIndex, 0, movedTag);
            saveGeneralTagOrder(nextOrder, selectedType);
            renderGeneralTagList(openColorTagName);
            generalTagList.classList.add("show");
        });
        generalTagList.appendChild(button);

    });
}

function syncGeneralTagColorFromName() {
    const tag = getGeneralTagLibrary().get(normalizeTagName(generalTagNameInput.value));
    if (tag) {
        generalTagColorInput.value = getGeneralTagColorMeta(tag.color).value;
    }
}

function renderGeneralCardTag(card) {
    const tagName = (card.generalData?.tagName || "").trim();
    if (!tagName) return "";
    const colorMeta = getGeneralTagColorMeta(card.generalData?.tagColor);
    return `<div class="general-card-tag-line"><div class="general-card-tag" style="--tag-color:${colorMeta.value}; --tag-bg:${colorMeta.bg};">${escapeHtml(tagName)}</div></div>`;
}

async function syncSharedGeneralTagColor(tagName, tagColor, typeName, skipDocId = null) {
    if (!tagName || !isValidHexColor(tagColor)) return;
    const normalizedTagName = normalizeTagName(tagName);
    const normalizedTypeName = normalizeTagName(typeName);
    const cardsToUpdate = cardsData.filter(card =>
        card.section === "general_cards"
        && card.docId !== skipDocId
        && normalizeTagName(card.generalData?.type || "") === normalizedTypeName
        && normalizeTagName(card.generalData?.tagName || "") === normalizedTagName
        && card.generalData?.tagColor !== tagColor
    );

    for (let i = 0; i < cardsToUpdate.length; i += 450) {
        const batch = writeBatch(db);
        cardsToUpdate.slice(i, i + 450).forEach(card => {
            batch.update(doc(db, "ptcg_cards", card.docId), { "generalData.tagColor": tagColor });
        });
        await batch.commit();
    }
}

async function deleteGeneralTag(tagName, typeName) {
    if (!tagName) return;
    const confirmed = confirm(`確定要刪除「${tagName}」標籤嗎？\n\n這會清空「${typeName}」區塊中所有使用此標籤的卡片。`);
    if (!confirmed) return;

    const normalizedTagName = normalizeTagName(tagName);
    const normalizedTypeName = normalizeTagName(typeName);
    const cardsToUpdate = cardsData.filter(card =>
        card.section === "general_cards"
        && normalizeTagName(card.generalData?.type || "") === normalizedTypeName
        && normalizeTagName(card.generalData?.tagName || "") === normalizedTagName
    );

    for (let i = 0; i < cardsToUpdate.length; i += 450) {
        const batch = writeBatch(db);
        cardsToUpdate.slice(i, i + 450).forEach(card => {
            batch.update(doc(db, "ptcg_cards", card.docId), {
                "generalData.tagName": "",
                "generalData.tagColor": ""
            });
        });
        await batch.commit();
    }

    const nextOrder = sortGeneralTags(Array.from(getGeneralTagLibrary(typeName).values()), typeName)
        .map(item => item.name)
        .filter(name => normalizeTagName(name) !== normalizedTagName);
    saveGeneralTagOrder(nextOrder, typeName);

    if (normalizeTagName(generalTagNameInput.value) === normalizedTagName) {
        generalTagNameInput.value = "";
        generalTagColorInput.value = "#787774";
    }
    hideGeneralTagColorPopover();
    renderGeneralTagList();
    generalTagList.classList.add("show");
}

function getCardsQuantityTotal(cards = []) {
    return cards.reduce((sum, card) => sum + getCardQuantity(card), 0);
}

function isSameCardIdentity(a = {}, b = {}) {
    const idA = normalizeCardId(a.id || "");
    const idB = normalizeCardId(b.id || "");
    if (idA && idB) return idA === idB;

    const nameA = normalizeCardName(a.name || "");
    const nameB = normalizeCardName(b.name || "");
    const imageA = normalizeCardImageUrl(a.imageUrl || a.img || "");
    const imageB = normalizeCardImageUrl(b.imageUrl || b.img || "");
    return Boolean(nameA && nameB && imageA && imageB && nameA === nameB && imageA === imageB);
}

function getCardIdentityKeys(card = {}) {
    const keys = [];
    const normalizedId = normalizeCardId(card.id || "");
    if (normalizedId) keys.push(`id:${normalizedId}`);

    const normalizedName = normalizeCardName(card.name || "");
    const normalizedImage = normalizeCardImageUrl(card.imageUrl || card.img || "");
    if (normalizedName && normalizedImage) keys.push(`name-img:${normalizedName}|${normalizedImage}`);

    return keys;
}

function findMatchingAltAccHighRarityCard(cardObj, accountType, excludeDocId = null) {
    return cardsData.find(card =>
        card.docId !== excludeDocId
        && card.section === "alt_acc"
        && highRarityNames.has(card.rarity)
        && card.altAccData?.accountType === accountType
        && isSameCardIdentity(card, cardObj)
    );
}

function buildAltAccPayloadFromHighRarity(cardObj, twoStarData, existingAltCard = null) {
    const accountType = twoStarData.status;
    const quantity = twoStarData.quantity || getCardQuantity(existingAltCard || {}) || 1;
    return {
        ...cardObj,
        section: "alt_acc",
        altAccData: {
            ...(existingAltCard?.altAccData || {}),
            accountType,
            hasOnMain: existingAltCard?.altAccData?.hasOnMain || "false",
            quantity
        },
        twoStarData: {
            ...(existingAltCard?.twoStarData || {}),
            ...twoStarData,
            tab: "擁有的卡",
            status: accountType,
            quantity,
            order: existingAltCard?.twoStarData?.order || twoStarData.order || Date.now()
        }
    };
}

function shouldSyncHighRarityToAltAcc(saveSection, rarityInput) {
    if (saveSection !== "two_star_cards") return false;
    if (!highRarityNames.has(rarityInput)) return false;
    if (document.getElementById("card-two-star-tab").value !== "擁有的卡") return false;
    return ["小帳", "資源帳"].includes(document.getElementById("card-two-star-status").value);
}

function isTwoStarCardInRow(card, filterVal) {
    if (currentTwoStarTab !== "擁有的卡") {
        if (filterVal === null) return true;
        return card.twoStarData?.type === filterVal;
    }

    const status = card.twoStarData?.status;
    if (filterVal === "主帳") {
        return status === "主帳" || status === "本帳";
    }
    return status === filterVal;
}

async function updateCardQuantity(card, fieldPath, newQty) {
    const quantity = Math.max(1, newQty);
    const payload = { [fieldPath]: quantity };

    if (card.section === "alt_acc") {
        payload.altAccData = {
            ...(card.altAccData || {}),
            accountType: card.altAccData?.accountType || card.accountType || currentAccountTab || "小帳",
            hasOnMain: card.altAccData?.hasOnMain ?? card.hasOnMain ?? "false",
            quantity
        };
        delete payload["altAccData.quantity"];
    }

    if (card.section === "alt_acc" && highRarityNames.has(card.rarity)) {
        payload["twoStarData.quantity"] = quantity;
    }

    await updateDoc(doc(db, "ptcg_cards", card.docId), payload);
}

function renderQtyControl(qty) {
    return `
        <div class="qty-control">
            <button class="qty-btn qty-minus" title="減少數量">-</button>
            <span class="qty-number">${qty}</span>
            <button class="qty-btn qty-plus" title="增加數量">+</button>
        </div>
    `;
}

function getTradedCardFromForm() {
    return {
        name: document.getElementById("card-traded-name")?.value.trim() || "",
        id: document.getElementById("card-traded-id")?.value.trim() || "",
        imageUrl: document.getElementById("card-traded-img")?.value.trim() || ""
    };
}

function renderTradedCardPreview(tradedCard = {}) {
    const name = tradedCard.name || "";
    const id = tradedCard.id || "";
    const imageUrl = tradedCard.imageUrl || tradedCard.img || "";
    if (!name && !id && !imageUrl) return "";

    const displayName = name || "(未命名)";
    const displayImg = imageUrl || "https://placehold.co/60x84/eaeaea/999999?text=X";

    return `
        <div class="traded-card-chip" title="交換的卡">
            <img src="${displayImg}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div>
                <span>交換的卡</span>
                <strong>${displayName}</strong>
            </div>
        </div>
    `;
}

function bindQtyControl(cardEl, card, fieldPath, qty) {
    cardEl.querySelector('.qty-minus')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newQty = Math.max(1, qty - 1);
        if (newQty !== qty) await updateCardQuantity(card, fieldPath, newQty);
    });
    cardEl.querySelector('.qty-plus')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await updateCardQuantity(card, fieldPath, qty + 1);
    });
}

function getDeckCardType(cardType) {
    return deckRowTypes.find(row => row.aliases.includes(cardType))?.key || cardType || "寶可夢";
}

function getDeckCardTypeFromCatalogCard(card = {}) {
    const cardType = getCatalogCardTypeKey(card.cardType);
    if (cardType === "pokemon") return "寶可夢";
    if (cardType === "support") return "支援者";
    if (["item", "pokemontool", "stadium"].includes(cardType)) return "物品、道具、競技場";
    return getDeckCardType(card.cardType || "寶可夢");
}

function normalizeDeckImportExpansion(expansion = "") {
    const value = String(expansion || "").trim();
    const promoMatch = value.match(/^P-?([A-Z])$/i);
    if (promoMatch) return `PROMO-${promoMatch[1].toUpperCase()}`;
    return value;
}

function buildDeckImportCardId(expansion = "", number = "") {
    const normalizedExpansion = normalizeDeckImportExpansion(expansion);
    const normalizedNumber = String(number || "").trim().padStart(3, "0");
    return `${normalizedExpansion}-${normalizedNumber}`;
}

function findCatalogCardForDeckImport(expansion = "", number = "", englishName = "") {
    const targetId = normalizeCardId(buildDeckImportCardId(expansion, number));
    const idMatch = catalogCardsData.find(card => normalizeCardId(card.id) === targetId);
    if (idMatch) return idMatch;

    const fallbackName = normalizeCardName(englishName);
    if (!fallbackName) return null;
    return catalogCardsData.find(card => normalizeCardName(card.name).includes(fallbackName)) || null;
}

function parseDeckImportLine(line = "") {
    const trimmed = line.trim();
    if (!trimmed || /^energy\s*:/i.test(trimmed)) return null;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) return { error: "格式不足", raw: line };

    const qty = Number(parts[0]);
    const number = parts.at(-1);
    const expansion = parts.at(-2);
    const englishName = parts.slice(1, -2).join(" ");

    if (!Number.isFinite(qty) || qty <= 0) return { error: "數量錯誤", raw: line };
    if (!/^\d+$/.test(number)) return { error: "卡號錯誤", raw: line };

    return { qty, expansion, number, englishName, raw: line };
}

function parseDeckImportText(text = "") {
    const importedCards = [];
    const unmatchedLines = [];

    text.split(/\r?\n/).forEach(line => {
        const parsed = parseDeckImportLine(line);
        if (!parsed) return;
        if (parsed.error) {
            unmatchedLines.push(`${parsed.raw} (${parsed.error})`);
            return;
        }

        const catalogCard = findCatalogCardForDeckImport(parsed.expansion, parsed.number, parsed.englishName);
        if (!catalogCard) {
            unmatchedLines.push(`${parsed.raw} (找不到 ${buildDeckImportCardId(parsed.expansion, parsed.number)})`);
            return;
        }

        importedCards.push({
            name: catalogCard.name || parsed.englishName,
            id: catalogCard.id || buildDeckImportCardId(parsed.expansion, parsed.number),
            img: catalogCard.imageUrl || "",
            rarity: catalogCard.rarity || "",
            type: getDeckCardTypeFromCatalogCard(catalogCard),
            qty: Math.max(1, parsed.qty),
            bgColor: "#ffffff"
        });
    });

    return { importedCards, unmatchedLines };
}

function getMetaLobbyTabs() {
    const config = cardsData.find(card => card.section === "meta_deck_lobby_config");
    const tabs = config?.lobbyTabs;
    const savedNormalTabs = Array.isArray(tabs) && tabs.length > 0
        ? tabs.filter(tab => tab.id !== AUTO_TEAM_LOBBY_TAB_ID)
        : [];
    const normalTabs = savedNormalTabs.length > 0 ? savedNormalTabs : [{ id: "b3", name: "B3" }];
    return [{ id: AUTO_TEAM_LOBBY_TAB_ID, name: "自動隊伍", fixed: true }, ...normalTabs];
}

function getLatestMetaLobbyTabId(tabs = getMetaLobbyTabs()) {
    const normalTabs = tabs.filter(tab => tab.id !== AUTO_TEAM_LOBBY_TAB_ID);
    return normalTabs.at(-1)?.id || tabs[0]?.id || "b3";
}

function getDefaultMetaLobbyTabId(tabs = getMetaLobbyTabs()) {
    const normalTabs = tabs.filter(tab => tab.id !== AUTO_TEAM_LOBBY_TAB_ID);
    return normalTabs[0]?.id || "b3";
}

function getMetaLobbyTabName(tabId = activeMetaLobbyTabId) {
    return getMetaLobbyTabs().find(tab => tab.id === tabId)?.name || "";
}

function populateDeckVersionSelect(selectedTabId = activeMetaLobbyTabId) {
    const select = document.getElementById("deck-version");
    if (!select) return;
    const tabs = getMetaLobbyTabs();
    const fallbackTabId = tabs.some(tab => tab.id === selectedTabId) ? selectedTabId : getDefaultMetaLobbyTabId(tabs);
    select.innerHTML = tabs
        .map(tab => `<option value="${tab.id}" ${tab.id === fallbackTabId ? "selected" : ""}>${tab.name}</option>`)
        .join("");
}

function updateDeckTierFieldVisibility(selectedTabId = document.getElementById("deck-version")?.value) {
    const tierGroup = document.getElementById("deck-tier")?.closest(".input-group");
    if (tierGroup) tierGroup.style.display = selectedTabId === AUTO_TEAM_LOBBY_TAB_ID ? "none" : "flex";
}

function getDeckLobbyTabId(deck) {
    return deck.deckData?.lobbyTabId || getDefaultMetaLobbyTabId();
}

async function saveMetaLobbyTabs(tabs) {
    const normalizedTabs = [
        { id: AUTO_TEAM_LOBBY_TAB_ID, name: "自動隊伍", fixed: true },
        ...tabs.filter(tab => tab.id !== AUTO_TEAM_LOBBY_TAB_ID)
    ];
    const config = cardsData.find(card => card.section === "meta_deck_lobby_config");
    if (config) {
        await updateDoc(doc(db, "ptcg_cards", config.docId), { lobbyTabs: normalizedTabs });
    } else {
        await addDoc(cardsCollection, { section: "meta_deck_lobby_config", lobbyTabs: normalizedTabs });
    }
}

function cloneDeckCards(cards = []) {
    return cards.map(card => ({ ...card }));
}

function cloneDeckReplacements(replacements = []) {
    return replacements.map(group => ({
        ...group,
        sources: getReplacementSources(group).map(card => ({ ...card })),
        alternatives: Array.isArray(group.alternatives)
            ? group.alternatives.slice(0, 3).map(card => ({ ...card }))
            : []
    }));
}

function cloneDeckTabs(tabs = []) {
    return tabs.map(tab => {
        const clonedTab = {
            ...tab,
            cards: cloneDeckCards(tab.cards || []),
            replacements: cloneDeckReplacements(tab.replacements || [])
        };
        if (tab.coverCard) clonedTab.coverCard = { ...tab.coverCard };
        return clonedTab;
    });
}

function cloneMetaDeckDataForCopy(deckData = {}, overrides = {}) {
    const clonedTabs = Array.isArray(deckData.tabs) ? cloneDeckTabs(deckData.tabs) : undefined;
    return {
        ...deckData,
        cards: cloneDeckCards(deckData.cards || []),
        ...(clonedTabs ? { tabs: clonedTabs } : {}),
        ...overrides
    };
}

function findDeckDefaultCardInfo(defaultCard = {}) {
    const normalizedId = normalizeCardId(defaultCard.id);
    if (normalizedId) {
        for (const variants of Object.values(uniqueCardsDict)) {
            const match = variants.find(item => item.normalizedId === normalizedId);
            if (match) return match;
        }
    }

    const variants = uniqueCardsDict[normalizeCardName(defaultCard.name)] || [];
    return variants.find(item => item.imageUrl) || variants[0] || null;
}

function buildDefaultNewDeckCards() {
    return defaultNewDeckCards.map(card => {
        const dictCard = findDeckDefaultCardInfo(card);
        return {
            name: dictCard?.name || card.name,
            id: dictCard?.id || card.id || "",
            img: dictCard?.imageUrl || "",
            type: card.type,
            qty: card.qty,
            bgColor: "#FFFFFF"
        };
    });
}

function buildDefaultNewDeckTabs(deckData) {
    const defaultCards = buildDefaultNewDeckCards();
    const coverCard = getDeckMainCoverCard(deckData);
    return [{
        id: "default",
        name: "預設牌組",
        coverCard,
        coverImg: coverCard.img,
        cards: cloneDeckCards(defaultCards),
        replacements: []
    }];
}

function getReplacementSources(group = {}) {
    if (Array.isArray(group.sources) && group.sources.length > 0) return group.sources.slice(0, 3);
    if (group.source && (group.source.name || group.source.img)) return [group.source];
    return [];
}

function getDeckTabCoverCard(tab, deck) {
    if (tab?.coverCard) {
        return {
            name: tab.coverCard.name || "",
            img: tab.coverCard.img || tab.coverImg || deck?.deckData?.coverImg || ""
        };
    }
    return {
        name: tab?.coverName || "",
        img: tab?.coverImg || deck?.deckData?.coverImg || ""
    };
}

function getDeckMainCoverCard(deckData = {}) {
    return {
        name: deckData.coverCard?.name || deckData.coverName || "",
        img: deckData.coverCard?.img || deckData.coverImg || ""
    };
}

function getDeckTabs(deck) {
    const tabs = deck?.deckData?.tabs;
    if (Array.isArray(tabs) && tabs.length > 0) {
        return tabs.map((tab, index) => {
            const coverCard = getDeckTabCoverCard(tab, deck);
            return {
                id: tab.id || `tab-${index}`,
                name: tab.name || `牌組 ${index + 1}`,
                coverCard,
                coverImg: coverCard.img,
                cards: Array.isArray(tab.cards) ? tab.cards : [],
                replacements: Array.isArray(tab.replacements) ? tab.replacements : []
            };
        });
    }

    const coverCard = { name: "", img: deck?.deckData?.coverImg || "" };
    return [{
        id: "default",
        name: "預設牌組",
        coverCard,
        coverImg: coverCard.img,
        cards: Array.isArray(deck?.deckData?.cards) ? deck.deckData.cards : [],
        replacements: []
    }];
}

function getActiveDeckTab(deck) {
    const tabs = getDeckTabs(deck);
    let activeTab = tabs.find(tab => tab.id === activeDeckTabId);
    if (!activeTab) {
        activeTab = tabs[0];
        activeDeckTabId = activeTab.id;
    }
    return { tabs, activeTab };
}

async function saveDeckTabs(deck, tabs) {
    const activeTab = tabs.find(tab => tab.id === activeDeckTabId) || tabs[0];
    await updateDoc(doc(db, "ptcg_cards", deck.docId), {
        "deckData.tabs": tabs,
        "deckData.cards": activeTab?.cards || []
    });
}

function openDeckCardModal(rowType, card = null, index = null) {
    deckCardForm.reset();
    editingDeckCardIndex = index;
    const deckCardTypes = getDeckRowCatalogTypeKeys(card?.type || rowType);
    deckCardAutocompleteContext = deckCardTypes.length ? { cardTypes: deckCardTypes } : null;
    document.querySelector("#deck-card-form-modal h2").innerText = index === null ? "➕ 放入卡牌至牌組" : "✏️ 編輯牌組卡片";
    deckCardForm.querySelector('button[type="submit"]').innerText = index === null ? "加入牌組" : "儲存卡片";
    document.getElementById("deck-card-name").value = card?.name || "";
    document.getElementById("deck-card-id").value = card?.id || "";
    document.getElementById("deck-card-rarity").value = card?.rarity || "";
    document.getElementById("deck-card-img").value = card?.img || "";
    document.getElementById("deck-card-type").value = getDeckCardType(card?.type || rowType);
    setDeckCardQuantity(card?.qty || 2);
    setDeckCardBgColor(card?.bgColor || (card?.colorMode === "light-gray" ? "#f1f3f5" : "#ffffff"));
    deckCardFormModal.classList.add("show");
}

function setDeckCardBgColor(color = "#ffffff") {
    if (!deckColorInput) return;
    deckColorInput.value = color;
    deckColorSwatches.forEach(s => s.classList.remove("selected"));
    const matchSwatch = Array.from(deckColorSwatches).find(s =>
        s.getAttribute("data-color").toUpperCase() === color.toUpperCase()
    );
    if (matchSwatch) matchSwatch.classList.add("selected");
}

function normalizeDeckCardBgColor(color = "") {
    const value = String(color || "").trim().toLowerCase();
    if (value === "#fff") return "#ffffff";
    return value;
}

function getDeckCardBgColor(card = {}) {
    return normalizeDeckCardBgColor(card.bgColor || (card.colorMode === "light-gray" ? "#f1f3f5" : "#ffffff"));
}

function isDeckCardWhiteBg(color) {
    return getDeckCardBgColor({ bgColor: color }) === "#ffffff";
}

function isDeckCardLightGrayBg(color) {
    return ["#d3d3d3", "#f1f3f5"].includes(getDeckCardBgColor({ bgColor: color }));
}

function setDeckCardQuantity(quantity) {
    const selectedQty = Number(quantity) === 1 ? 1 : 2;
    document.querySelectorAll(".deck-qty-option").forEach(button => {
        const isActive = Number(button.dataset.qty) === selectedQty;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-checked", String(isActive));
    });
}

function getDeckCardQuantity() {
    return Number(document.querySelector(".deck-qty-option.active")?.dataset.qty) || 2;
}

document.querySelectorAll(".deck-qty-option").forEach(button => {
    button.addEventListener("click", () => setDeckCardQuantity(button.dataset.qty));
});

function setDeckReplacementQuantity(quantity) {
    const selectedQty = Number(quantity) === 2 ? 2 : 1;
    document.querySelectorAll(".deck-replacement-qty-option").forEach(button => {
        const isActive = Number(button.dataset.qty) === selectedQty;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-checked", String(isActive));
    });
}

function getDeckReplacementQuantity() {
    return Number(document.querySelector(".deck-replacement-qty-option.active")?.dataset.qty) || 1;
}

document.querySelectorAll(".deck-replacement-qty-option").forEach(button => {
    button.addEventListener("click", () => setDeckReplacementQuantity(button.dataset.qty));
});

function openDeckCoverModal(deck, activeTab) {
    deckCoverForm.reset();
    document.getElementById("deck-cover-name").value = activeTab.coverCard?.name || "";
    document.getElementById("deck-cover-img").value = activeTab.coverCard?.img || activeTab.coverImg || deck.deckData?.coverImg || "";
    deckCoverFormModal.classList.add("show");
}

function openDeckReplacementModal(groupId, role, alternativeIndex = null, card = {}) {
    editingReplacementContext = { groupId, role, alternativeIndex };
    deckReplacementForm.reset();
    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    const activeTab = deck ? getActiveDeckTab(deck).activeTab : null;
    const group = activeTab?.replacements?.find(item => item.id === groupId);
    const canAddSource = role === "source"
        && alternativeIndex !== null
        && getReplacementSources(group).length < 3;
    document.getElementById("deck-replacement-modal-title").innerText =
        role === "source"
            ? (alternativeIndex === null ? "➕ 新增基準卡" : "✏️ 編輯基準卡")
            : (alternativeIndex === null ? "➕ 新增替換卡" : "✏️ 編輯替換卡");
    document.getElementById("add-second-source-card").style.display = canAddSource ? "block" : "none";
    document.getElementById("deck-replacement-name").value = card?.name || "";
    document.getElementById("deck-replacement-img").value = card?.img || "";
    setDeckReplacementQuantity(card?.qty || 1);
    deckReplacementFormModal.classList.add("show");
    document.getElementById("deck-replacement-name").focus();
}

function openDeckModal(deck = null, tierName = "Tier 3") {
    deckForm.reset();
    editingDeckDocId = deck?.docId || null;
    const coverCard = getDeckMainCoverCard(deck?.deckData || {});
    document.getElementById("deck-modal-title").innerText = editingDeckDocId ? "✏️ 編輯 Meta 牌組" : "➕ 新增 Meta 牌組";
    document.getElementById("deck-name").value = deck?.deckData?.name || "";
    document.getElementById("deck-cover-card-name").value = coverCard.name || "";
    populateDeckVersionSelect(deck ? getDeckLobbyTabId(deck) : activeMetaLobbyTabId);
    document.getElementById("deck-img").value = coverCard.img || "";
    document.getElementById("deck-tier").value = deck?.deckData?.tier || tierName;
    updateDeckTierFieldVisibility();
    document.getElementById("deck-attribute").value = deck?.deckData?.attribute || "草";
    deckFormModal.classList.add("show");
}

// --- DOM 綁定 ---
const rarityRowsContainerAlt = document.getElementById("rarity-rows-container");
const rarityRowsContainer24h = document.getElementById("rarity-rows-24h-container");
const rarityRowsContainerNeeded = document.getElementById("rarity-rows-needed-container");
const rarityRowsContainerGeneral = document.getElementById("rarity-rows-general-container");
const rarityRowsContainerTwoStar = document.getElementById("rarity-rows-two-star-container");
const catalogExpansionListView = document.getElementById("catalog-expansion-list-view");
const catalogExpansionDetailView = document.getElementById("catalog-expansion-detail-view");
const catalogExpansionsGrid = document.getElementById("catalog-expansions-grid");
const catalogCardsGrid = document.getElementById("catalog-cards-grid");
const catalogDetailLogo = document.getElementById("catalog-detail-logo");
const catalogDetailName = document.getElementById("catalog-detail-name");
const btnBackCatalogExpansions = document.getElementById("btn-back-catalog-expansions");
const btnToggleCatalogCardType = document.getElementById("btn-toggle-catalog-cardtype");
const catalogSeriesTabs = document.querySelectorAll(".catalog-series-tab-btn");
const catalogGlobalSearchInput = document.getElementById("catalog-global-search");
const catalogDetailSearchInput = document.getElementById("catalog-detail-search");
const catalogGlobalFilters = document.getElementById("catalog-global-filters");
const catalogDetailFilters = document.getElementById("catalog-detail-filters");

const formModal = document.getElementById("form-modal");
const cardForm = document.getElementById("card-form");
const modalTitle = document.getElementById("modal-title");
const colorSwatches = document.querySelectorAll("#color-palette .color-swatch");
const colorInput = document.getElementById("card-bgcolor");
const deckColorSwatches = document.querySelectorAll("#deck-card-color-palette .deck-color-swatch");
const deckColorInput = document.getElementById("deck-card-bgcolor");
const generalTagNameInput = document.getElementById("card-general-tag-name");
const generalTagColorInput = document.getElementById("card-general-tag-color");
const generalTagList = document.getElementById("general-tag-list");
let generalTagColorPopover = document.getElementById("general-tag-color-popover");
if (!generalTagColorPopover) {
    generalTagColorPopover = document.createElement("div");
    generalTagColorPopover.id = "general-tag-color-popover";
    generalTagColorPopover.className = "general-tag-color-popover";
    document.body.appendChild(generalTagColorPopover);
}

const navAltAcc = document.getElementById("nav-alt-acc");
const nav24h = document.getElementById("nav-24h-challenge");
const navNeeded = document.getElementById("nav-needed-cards");
const navGeneral = document.getElementById("nav-general-cards");
const navTwoStar = document.getElementById("nav-two-star-cards");
const navMetaDecks = document.getElementById("nav-meta-decks");
const navCardCatalog = document.getElementById("nav-card-catalog");

const viewAltAcc = document.getElementById("view-alt-acc");
const view24h = document.getElementById("view-24h-challenge");
const viewNeeded = document.getElementById("view-needed-cards");
const viewGeneral = document.getElementById("view-general-cards");
const viewTwoStar = document.getElementById("view-two-star-cards");
const viewMetaDecks = document.getElementById("view-meta-decks");
const viewCardCatalog = document.getElementById("view-card-catalog");

const pageTitle = document.getElementById("page-title");
const authUserInfo = document.getElementById("auth-user-info");
const btnGoogleLogin = document.getElementById("btn-google-login");
const btnGoogleLogout = document.getElementById("btn-google-logout");
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

function getGoogleSignInErrorMessage(error) {
    const code = error?.code || "";
    if (code === "auth/unauthorized-domain") {
        return "目前網址尚未加入 Firebase Authentication 的 Authorized domains。請到 Firebase Console > Authentication > Settings > Authorized domains 加入目前使用的網域，例如 localhost、127.0.0.1 或你的 web.app 網域。";
    }
    if (code === "auth/popup-blocked") return "登入彈出視窗被瀏覽器阻擋，將改用重新導向登入。";
    if (code === "auth/popup-closed-by-user") return "登入視窗已關閉，請再試一次。";
    if (code === "auth/cancelled-popup-request") return "已有另一個登入視窗正在處理，請稍等後再試。";
    return error?.message || "未知錯誤";
}

async function handleGoogleLogin() {
    if (!btnGoogleLogin) return;
    const originalText = btnGoogleLogin.textContent;
    btnGoogleLogin.disabled = true;
    btnGoogleLogin.textContent = "登入中...";

    try {
        await authReady;
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Google sign-in failed:", error);
        const code = error?.code || "";
        const shouldUseRedirect = ["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(code);
        if (shouldUseRedirect) {
            await signInWithRedirect(auth, googleProvider);
            return;
        }
        alert(`Google 登入失敗：${getGoogleSignInErrorMessage(error)}`);
    } finally {
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.textContent = originalText;
    }
}

btnGoogleLogin?.addEventListener("click", handleGoogleLogin);

getRedirectResult(auth).catch((error) => {
    console.error("Google redirect sign-in failed:", error);
    alert(`Google 登入失敗：${getGoogleSignInErrorMessage(error)}`);
});

btnGoogleLogout?.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Google sign-out failed:", error);
        alert(`登出失敗：${error?.message || "未知錯誤"}`);
    }
});

// Meta 牌組 DOM
const metaDecksListView = document.getElementById("meta-decks-list-view");
const gridTier0 = document.getElementById("tier-0-grid");
const gridTier1 = document.getElementById("tier-1-grid");
const gridTier2 = document.getElementById("tier-2-grid");
const gridTier3 = document.getElementById("tier-3-grid");
const autoTeamGrid = document.getElementById("auto-team-grid");
const autoTeamBlock = document.getElementById("auto-team-block");
const tier0Block = document.getElementById("tier-0-block");
const tier1Block = document.getElementById("tier-1-block");
const tier2Block = document.getElementById("tier-2-block");
const tier3Block = document.getElementById("tier-3-block");
const metaDeckDetailView = document.getElementById("meta-deck-detail-view");
const btnBackDecks = document.getElementById("btn-back-decks");
const btnImportDeckList = document.getElementById("btn-import-deck-list");
const detailDeckTitle = document.getElementById("detail-deck-title");
const detailDeckCover = document.getElementById("detail-deck-cover");
const detailDeckRows = document.getElementById("detail-deck-rows");
const deckFormModal = document.getElementById("deck-form-modal");
const deckForm = document.getElementById("deck-form");
document.getElementById("deck-version")?.addEventListener("change", (e) => {
    updateDeckTierFieldVisibility(e.target.value);
});
const deckCardFormModal = document.getElementById("deck-card-form-modal");
const deckCardForm = document.getElementById("deck-card-form");
const deckCoverFormModal = document.getElementById("deck-cover-form-modal");
const deckCoverForm = document.getElementById("deck-cover-form");
const deckReplacementFormModal = document.getElementById("deck-replacement-form-modal");
const deckReplacementForm = document.getElementById("deck-replacement-form");
const deckImportFormModal = document.getElementById("deck-import-modal");
const deckImportForm = document.getElementById("deck-import-form");

// ==========================================
// 視圖切換邏輯
// ==========================================
function switchSection(sectionName, titleText, navEl, viewEl) {
    currentSection = sectionName;
    [navAltAcc, nav24h, navNeeded, navGeneral, navTwoStar, navMetaDecks, navCardCatalog].forEach(el => el?.classList.remove("active"));
    [viewAltAcc, view24h, viewNeeded, viewGeneral, viewTwoStar, viewMetaDecks, viewCardCatalog].forEach(el => {
        if (el) el.style.display = "none";
    });
    
    navEl.classList.add("active");
    viewEl.style.display = "block";
    pageTitle.innerText = titleText;
    
    if (sectionName === "meta_decks") {
        activeMetaDeckId = null;
        activeDeckTabId = null;
        metaDecksListView.style.display = "block";
        metaDeckDetailView.style.display = "none";
        scrollMainToTop();
    }
    if (sectionName === "card_catalog") {
        activeCatalogSeries = "B";
        activeCatalogExpansionId = null;
        catalogGroupByCardType = false;
        catalogGlobalSearchQuery = "";
        catalogDetailSearchQuery = "";
        catalogSelectedTypeFilters.clear();
        catalogSelectedRarityFilters.clear();
        if (catalogGlobalSearchInput) catalogGlobalSearchInput.value = "";
        if (catalogDetailSearchInput) catalogDetailSearchInput.value = "";
        catalogSeriesTabs.forEach(tab => tab.classList.toggle("active", tab.dataset.series === activeCatalogSeries));
        catalogExpansionListView.style.display = "block";
        catalogExpansionDetailView.style.display = "none";
        scrollMainToTop();
    }

    renderAllViews();
}

navAltAcc.addEventListener("click", () => switchSection("alt_acc", "小帳資源", navAltAcc, viewAltAcc));
nav24h.addEventListener("click", () => switchSection("24h", "24H得卡挑戰", nav24h, view24h));
navNeeded.addEventListener("click", () => switchSection("needed_cards", "需要卡", navNeeded, viewNeeded));
navGeneral.addEventListener("click", () => switchSection("general_cards", "泛用卡", navGeneral, viewGeneral));
navTwoStar.addEventListener("click", () => switchSection("two_star_cards", "高罕卡", navTwoStar, viewTwoStar));
navMetaDecks.addEventListener("click", () => switchSection("meta_decks", "Meta牌組", navMetaDecks, viewMetaDecks));
navCardCatalog.addEventListener("click", () => switchSection("card_catalog", "卡片圖鑑", navCardCatalog, viewCardCatalog));

function scrollMainToTop() {
    document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" });
}

function getCdnImageUrl(path) {
    return `https://cdn.raenonx.cc/api/image/ptcgp?format=webp&url=/images/${path}`;
}

function getCatalogExpansionLogoUrl(expansionId) {
    return getCdnImageUrl(`game/card/expansion/logo/zh/${expansionId}.png`);
}

function getCatalogExpansionBadgeUrl(expansionId) {
    return getCdnImageUrl(`game/card/expansion/badge/${expansionId}.png`);
}

function getCatalogCardTypeLabel(cardType = "") {
    const normalized = getCatalogCardTypeKey(cardType);
    if (normalized === "pokemon") return "寶可夢";
    if (normalized === "trainer") return "訓練家";
    if (normalized === "support") return "支援者";
    if (normalized === "item") return "物品";
    if (normalized === "pokemontool") return "寶可夢道具";
    if (normalized === "stadium") return "競技場";
    if (normalized === "energy") return "能量";
    return cardType || "其他";
}

function getCatalogCardTypeKey(cardType = "") {
    const normalized = String(cardType || "").trim().toLowerCase();
    if (normalized === "supporter") return "support";
    if (normalized === "pokemon_tool" || normalized === "pokemon-tool") return "pokemontool";
    return normalized || "other";
}

function getCatalogCardTypeSortIndex(cardType = "") {
    const order = ["pokemon", "support", "item", "pokemontool", "stadium"];
    const index = order.indexOf(getCatalogCardTypeKey(cardType));
    return index === -1 ? order.length : index;
}

function getCatalogRarityKey(card = {}) {
    return String(card.sourceRarity || card.rarity || "").trim();
}

function getCatalogRarityLabel(card = {}) {
    return card.rarity || card.sourceRarity || "其他";
}

function getCatalogRaritySortIndex(rarityKey = "") {
    const order = ["C", "U", "R", "RR", "AR", "SR", "SAR", "IM", "S", "SSR", "UR"];
    const index = order.indexOf(rarityKey);
    return index === -1 ? order.length : index;
}

function getCatalogExpansionCards(expansionId) {
    return catalogCardsData
        .filter(card => card.expansion === expansionId)
        .sort((a, b) => (a.id || "").localeCompare(b.id || "", "en", { numeric: true }));
}

function cardMatchesCatalogSearch(card, query) {
    const keyword = String(query || "").trim().toLowerCase();
    const matchesKeyword = !keyword || [
        card.name,
        card.id,
        card.expansion,
        card.rarity,
        card.sourceRarity,
        getCatalogCardTypeLabel(card.cardType),
        card.cardType
    ].some(value => String(value || "").toLowerCase().includes(keyword));

    if (!matchesKeyword) return false;

    const typeKey = getCatalogCardTypeKey(card.cardType);
    if (catalogSelectedTypeFilters.size && !catalogSelectedTypeFilters.has(typeKey)) return false;

    const rarityKey = getCatalogRarityKey(card);
    if (catalogSelectedRarityFilters.size && !catalogSelectedRarityFilters.has(rarityKey)) return false;

    return true;
}

function getCatalogSearchResults(query, cards = catalogCardsData) {
    return cards
        .filter(card => cardMatchesCatalogSearch(card, query))
        .sort((a, b) => (a.id || "").localeCompare(b.id || "", "en", { numeric: true }));
}

function getCatalogFilterOptions() {
    const typeMap = new Map();
    const rarityMap = new Map();

    catalogCardsData.forEach(card => {
        const typeKey = getCatalogCardTypeKey(card.cardType);
        typeMap.set(typeKey, getCatalogCardTypeLabel(typeKey));

        const rarityKey = getCatalogRarityKey(card);
        if (rarityKey) rarityMap.set(rarityKey, getCatalogRarityLabel(card));
    });

    const typeOptions = Array.from(typeMap.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => {
            const orderDiff = getCatalogCardTypeSortIndex(a.key) - getCatalogCardTypeSortIndex(b.key);
            if (orderDiff !== 0) return orderDiff;
            return a.label.localeCompare(b.label, "zh-Hant");
        });

    const rarityOptions = Array.from(rarityMap.entries())
        .map(([key, label]) => ({ key, label }))
        .sort((a, b) => {
            const orderDiff = getCatalogRaritySortIndex(a.key) - getCatalogRaritySortIndex(b.key);
            if (orderDiff !== 0) return orderDiff;
            return a.label.localeCompare(b.label, "zh-Hant", { numeric: true });
        });

    return { typeOptions, rarityOptions };
}

function toggleCatalogFilter(filterSet, key) {
    if (filterSet.has(key)) filterSet.delete(key);
    else filterSet.add(key);
    renderCatalogFilters();
    renderCardCatalog();
}

function renderCatalogFilterGroup(title, options, selectedSet, type) {
    if (!options.length) return "";
    const chips = options.map(option => `
        <button class="catalog-filter-chip ${selectedSet.has(option.key) ? "active" : ""}" type="button" data-filter-type="${type}" data-filter-key="${option.key}">
            ${option.label}
        </button>
    `).join("");
    return `
        <div class="catalog-filter-row">
            <span class="catalog-filter-label">${title}</span>
            <div class="catalog-filter-options">${chips}</div>
        </div>
    `;
}

function renderCatalogFilters() {
    const { typeOptions, rarityOptions } = getCatalogFilterOptions();
    const filterHtml = [
        renderCatalogFilterGroup("卡片種類", typeOptions, catalogSelectedTypeFilters, "type"),
        renderCatalogFilterGroup("稀有度", rarityOptions, catalogSelectedRarityFilters, "rarity")
    ].join("");

    [catalogGlobalFilters, catalogDetailFilters].forEach(panel => {
        if (!panel) return;
        panel.innerHTML = filterHtml;
        panel.querySelectorAll(".catalog-filter-chip").forEach(button => {
            button.addEventListener("click", () => {
                const targetSet = button.dataset.filterType === "rarity" ? catalogSelectedRarityFilters : catalogSelectedTypeFilters;
                toggleCatalogFilter(targetSet, button.dataset.filterKey || "");
            });
        });
    });
}

function getVisibleCatalogExpansionIds() {
    const existingIds = new Set(catalogCardsData.map(card => card.expansion).filter(Boolean));
    if (activeCatalogSeries === "PROMO") {
        const promoIds = Array.from(existingIds)
            .filter(id => /^PROMO/i.test(id))
            .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
        return Array.from(new Set([...catalogPromoExpansionIds, ...promoIds]));
    }

    const baseIds = catalogExpansionIds.filter(id => id.startsWith(activeCatalogSeries));
    const extraIds = Array.from(existingIds)
        .filter(id => !catalogExpansionIds.includes(id) && id.startsWith(activeCatalogSeries) && /^[AB]\d[a-z]?$/i.test(id))
        .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    return [...baseIds, ...extraIds];
}

function renderCardCatalog() {
    if (!catalogExpansionListView || !catalogExpansionDetailView) return;
    renderCatalogFilters();

    if (activeCatalogExpansionId) {
        renderCatalogExpansionDetail(activeCatalogExpansionId);
        return;
    }

    catalogExpansionListView.style.display = "block";
    catalogExpansionDetailView.style.display = "none";

    if (!catalogCardsData.length) {
        catalogExpansionsGrid.innerHTML = `
            <div class="catalog-empty-state">
                <strong>尚未載入卡片圖鑑資料</strong>
                <span>請確認 crawler/raenonx-cards.json 是否存在，或稍等 JSON 載入完成。</span>
            </div>
        `;
        return;
    }

    const hasGlobalSearch = Boolean(catalogGlobalSearchQuery || catalogSelectedTypeFilters.size || catalogSelectedRarityFilters.size);
    catalogExpansionsGrid.innerHTML = "";
    catalogExpansionsGrid.classList.toggle("catalog-search-results", hasGlobalSearch);

    if (hasGlobalSearch) {
        const results = getCatalogSearchResults(catalogGlobalSearchQuery);
        if (!results.length) {
            catalogExpansionsGrid.innerHTML = `
                <div class="catalog-empty-state">
                    <strong>找不到符合的卡片</strong>
                    <span>請試試其他名稱、編號或版本。</span>
                </div>
            `;
            return;
        }
        results.forEach(card => catalogExpansionsGrid.appendChild(createCatalogCardElement(card, { showExpansion: true })));
        return;
    }

    getVisibleCatalogExpansionIds().forEach(expansionId => {
        const cards = getCatalogExpansionCards(expansionId);
        const expansionEl = document.createElement("button");
        expansionEl.type = "button";
        expansionEl.className = "catalog-expansion-card";
        expansionEl.innerHTML = `
            <div class="catalog-expansion-cover">
                <img class="catalog-expansion-logo" src="${getCatalogExpansionLogoUrl(expansionId)}" alt="${expansionId}" onerror="this.style.display='none'; this.closest('.catalog-expansion-cover').classList.add('no-logo');">
                <span class="catalog-expansion-fallback">${expansionId}</span>
            </div>
            <div class="catalog-expansion-info">
                <span class="catalog-expansion-id">${expansionId}</span>
                <span class="catalog-expansion-count">${cards.length} 張</span>
            </div>
        `;
        expansionEl.addEventListener("click", () => {
            activeCatalogExpansionId = expansionId;
            catalogDetailSearchQuery = "";
            if (catalogDetailSearchInput) catalogDetailSearchInput.value = "";
            renderCatalogExpansionDetail(expansionId);
            scrollMainToTop();
        });
        catalogExpansionsGrid.appendChild(expansionEl);
    });
}

function renderCatalogExpansionDetail(expansionId) {
    const cards = getCatalogExpansionCards(expansionId);
    const displayCards = getCatalogSearchResults(catalogDetailSearchQuery, cards);
    const hasDetailSearch = Boolean(catalogDetailSearchQuery || catalogSelectedTypeFilters.size || catalogSelectedRarityFilters.size);
    catalogExpansionListView.style.display = "none";
    catalogExpansionDetailView.style.display = "block";
    catalogDetailName.innerText = hasDetailSearch ? `${expansionId} (${displayCards.length}/${cards.length} 張)` : `${expansionId} (${cards.length} 張)`;
    catalogDetailLogo.src = getCatalogExpansionLogoUrl(expansionId);
    catalogDetailLogo.alt = expansionId;
    if (btnToggleCatalogCardType) {
        btnToggleCatalogCardType.innerText = catalogGroupByCardType ? "取消分群" : "依類型分群";
    }

    if (!cards.length) {
        catalogCardsGrid.innerHTML = `
            <div class="catalog-empty-state">
                <strong>${expansionId} 目前沒有卡片資料</strong>
                <span>請確認 crawler/raenonx-cards.json 是否已更新並部署。</span>
            </div>
        `;
        return;
    }

    catalogCardsGrid.innerHTML = "";
    if (hasDetailSearch && !displayCards.length) {
        catalogCardsGrid.innerHTML = `
            <div class="catalog-empty-state">
                <strong>此擴充包找不到符合的卡片</strong>
                <span>請試試其他名稱或編號。</span>
            </div>
        `;
        return;
    }

    if (catalogGroupByCardType) {
        const groupedCards = new Map();
        displayCards.forEach(card => {
            const typeKey = getCatalogCardTypeKey(card.cardType);
            if (!groupedCards.has(typeKey)) groupedCards.set(typeKey, []);
            groupedCards.get(typeKey).push(card);
        });

        const sortedGroups = Array.from(groupedCards.entries()).sort(([typeA], [typeB]) => {
            const orderDiff = getCatalogCardTypeSortIndex(typeA) - getCatalogCardTypeSortIndex(typeB);
            if (orderDiff !== 0) return orderDiff;
            return getCatalogCardTypeLabel(typeA).localeCompare(getCatalogCardTypeLabel(typeB), "zh-Hant");
        });

        sortedGroups.forEach(([typeKey, groupCards]) => {
            const label = getCatalogCardTypeLabel(typeKey);
            const isCollapsed = catalogCollapsedTypeGroups.has(typeKey);
            const groupEl = document.createElement("section");
            groupEl.className = `catalog-card-type-group ${isCollapsed ? "collapsed" : ""}`;
            groupEl.innerHTML = `
                <button class="catalog-card-type-heading" type="button" aria-expanded="${!isCollapsed}">
                    <span class="catalog-card-type-title">${label}</span>
                    <span class="catalog-card-type-count">${groupCards.length}</span>
                    <span class="catalog-card-type-indicator" aria-hidden="true"></span>
                </button>
                <div class="catalog-card-type-grid"></div>
            `;
            const groupGrid = groupEl.querySelector(".catalog-card-type-grid");
            groupCards.forEach(card => groupGrid.appendChild(createCatalogCardElement(card)));
            groupEl.querySelector(".catalog-card-type-heading").addEventListener("click", () => {
                const collapsed = groupEl.classList.toggle("collapsed");
                groupEl.querySelector(".catalog-card-type-heading").setAttribute("aria-expanded", String(!collapsed));
                if (collapsed) catalogCollapsedTypeGroups.add(typeKey);
                else catalogCollapsedTypeGroups.delete(typeKey);
            });
            catalogCardsGrid.appendChild(groupEl);
        });
        return;
    }

    displayCards.forEach(card => {
        catalogCardsGrid.appendChild(createCatalogCardElement(card));
    });
}

function createCatalogCardElement(card, options = {}) {
        const cardEl = document.createElement("div");
        cardEl.className = "catalog-card";
        const displayImg = card.imageUrl || "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
        const subText = card.id || "(無編號)";
        cardEl.innerHTML = `
            <div class="catalog-card-image-wrap">
                <img src="${displayImg}" alt="${card.name || card.id || ''}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            </div>
            <div class="catalog-card-info">
                <strong>${card.name || "(未命名)"}</strong>
                <span>${subText}</span>
            </div>
        `;
        cardEl.addEventListener("click", () => {
            document.getElementById("lightbox-img").src = displayImg;
            document.getElementById("lightbox-modal").classList.add("show");
        });
        return cardEl;
}

btnBackCatalogExpansions?.addEventListener("click", () => {
    activeCatalogExpansionId = null;
    catalogDetailSearchQuery = "";
    if (catalogDetailSearchInput) catalogDetailSearchInput.value = "";
    catalogGroupByCardType = false;
    renderCardCatalog();
    scrollMainToTop();
});

btnToggleCatalogCardType?.addEventListener("click", () => {
    catalogGroupByCardType = !catalogGroupByCardType;
    if (activeCatalogExpansionId) renderCatalogExpansionDetail(activeCatalogExpansionId);
});

catalogSeriesTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        catalogSeriesTabs.forEach(item => item.classList.remove("active"));
        tab.classList.add("active");
        activeCatalogSeries = tab.dataset.series || "B";
        activeCatalogExpansionId = null;
        catalogGroupByCardType = false;
        catalogGlobalSearchQuery = "";
        catalogSelectedTypeFilters.clear();
        catalogSelectedRarityFilters.clear();
        if (catalogGlobalSearchInput) catalogGlobalSearchInput.value = "";
        renderCardCatalog();
    });
});

catalogGlobalSearchInput?.addEventListener("input", (event) => {
    catalogGlobalSearchQuery = event.target.value.trim();
    renderCardCatalog();
});

catalogDetailSearchInput?.addEventListener("input", (event) => {
    catalogDetailSearchQuery = event.target.value.trim();
    if (activeCatalogExpansionId) renderCatalogExpansionDetail(activeCatalogExpansionId);
});

function renderAllViews() {
    if (currentSection === "alt_acc") renderAltAccRows();
    else if (currentSection === "24h") render24hRows();
    else if (currentSection === "needed_cards") renderNeededCardsRows();
    else if (currentSection === "general_cards") renderGeneralCardsRows();
    else if (currentSection === "two_star_cards") renderTwoStarCardsRows();
    else if (currentSection === "card_catalog") renderCardCatalog();
    else if (currentSection === "meta_decks") {
        if (activeMetaDeckId) {
            renderMetaDeckDetail();
        } else {
            renderMetaDecksList();
        }
    }
}

function makeRarityBlockCollapsible(rowBlock, collapseKey = "") {
    const header = Array.from(rowBlock.children).find(child => child.classList.contains("rarity-header"));
    if (!header || rowBlock.classList.contains("toggle-row-block")) return;

    const content = document.createElement("div");
    content.className = "rarity-toggle-content";
    while (header.nextSibling) {
        content.appendChild(header.nextSibling);
    }

    const indicator = document.createElement("span");
    indicator.className = "toggle-row-indicator";
    indicator.setAttribute("aria-hidden", "true");
    header.appendChild(indicator);

    rowBlock.appendChild(content);
    rowBlock.classList.add("toggle-row-block");
    header.classList.add("toggle-row-header");
    header.setAttribute("role", "button");
    header.setAttribute("tabindex", "0");
    const shouldCollapse = collapseKey && collapsedRarityBlocks.has(collapseKey);
    if (shouldCollapse) rowBlock.classList.add("collapsed");
    header.setAttribute("aria-expanded", String(!shouldCollapse));

    const toggle = () => {
        const isCollapsed = rowBlock.classList.toggle("collapsed");
        header.setAttribute("aria-expanded", String(!isCollapsed));
        if (collapseKey) {
            if (isCollapsed) collapsedRarityBlocks.add(collapseKey);
            else collapsedRarityBlocks.delete(collapseKey);
        }
    };

    header.addEventListener("click", toggle);
    header.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle();
    });
}

async function handleSafeCopyCard(card) {
    const d = JSON.parse(JSON.stringify(card)); 
    delete d.docId; 
    delete d.computedOwnership;
    if (d.twoStarData) d.twoStarData.order = Date.now();
    if (d.neededCardsData) d.neededCardsData.order = Date.now();
    if (d.generalData) d.generalData.order = Date.now();
    await addDoc(cardsCollection, d);
}

// ==========================================
// 🪄 渲染：Meta 牌組
// ==========================================
function renderMetaDecksList() {
    gridTier0.innerHTML = "";
    gridTier1.innerHTML = "";
    gridTier2.innerHTML = "";
    gridTier3.innerHTML = "";
    autoTeamGrid.innerHTML = "";

    const lobbyTabs = getMetaLobbyTabs();
    if (!activeMetaLobbyTabId || !lobbyTabs.some(tab => tab.id === activeMetaLobbyTabId)) {
        activeMetaLobbyTabId = getLatestMetaLobbyTabId(lobbyTabs);
    }
    renderMetaLobbyTabs(lobbyTabs);
    const isAutoTeam = activeMetaLobbyTabId === AUTO_TEAM_LOBBY_TAB_ID;
    autoTeamBlock.style.display = isAutoTeam ? "block" : "none";
    tier0Block.style.display = "none";
    tier1Block.style.display = isAutoTeam ? "none" : "block";
    tier2Block.style.display = isAutoTeam ? "none" : "block";
    tier3Block.style.display = isAutoTeam ? "none" : "block";

    const decks = cardsData.filter(c => c.section === "meta_deck" && getDeckLobbyTabId(c) === activeMetaLobbyTabId);
    decks.sort((a, b) => (a.deckData?.order || 0) - (b.deckData?.order || 0));

    decks.forEach(deck => {
        const box = document.createElement("div");
        box.className = "deck-box-container";
        box.setAttribute("draggable", true);
        box.dataset.deckId = deck.docId;
        
        const deckName = deck.deckData?.name || "未命名牌組";
        const deckMainCover = getDeckMainCoverCard(deck.deckData || {});
        const deckImg = deckMainCover.img || "https://placehold.co/300x420/eaeaea/999999?text=Deck";
        const deckAttr = deck.deckData?.attribute || "無";
        const attrMeta = deckAttributeMeta[deckAttr] || { icon: "•", className: "attr-none" };
        box.classList.add(attrMeta.className);

        box.innerHTML = `
            <button class="deck-version-btn" title="更換版本">⇄</button>
            <button class="del-deck-btn" title="刪除牌組">✕</button>
            <button class="deck-tier-btn" title="更換 Tier">T</button>
            <button class="copy-deck-btn" title="複製牌組">📄</button>
            <div class="deck-box-cover-wrap">
                <img class="deck-box-cover" src="${deckImg}" onerror="this.src='https://placehold.co/300x420/eaeaea/999999?text=Error'">
            </div>
            <div class="deck-box-info">
                <div class="deck-box-name" title="${deckName}">${deckName}</div>
                <div class="deck-attr-tag" title="${deckAttr}">${renderDeckAttributeIcon(attrMeta.icon, deckAttr)}</div>
            </div>
        `;

        box.querySelector(".deck-box-cover-wrap").addEventListener("click", () => {
            activeMetaDeckId = deck.docId;
            activeDeckTabId = null;
            metaDecksListView.style.display = "none";
            metaDeckDetailView.style.display = "block";
            scrollMainToTop();
            renderMetaDeckDetail();
        });

        box.querySelector(".deck-box-info").addEventListener("click", (e) => {
            e.stopPropagation();
            openDeckModal(deck);
        });

        box.addEventListener("dragstart", (e) => {
            draggedDeckDocId = deck.docId;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => box.classList.add("dragging"), 0);
        });

        box.addEventListener("dragend", () => {
            box.classList.remove("dragging");
            draggedDeckDocId = null;
        });

        box.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            box.classList.add("drag-over");
        });

        box.addEventListener("dragleave", () => box.classList.remove("drag-over"));

        box.addEventListener("drop", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            box.classList.remove("drag-over");
            await reorderMetaDecks(deck.docId, deck.deckData?.tier || "Tier 3");
        });

        box.querySelector('.del-deck-btn').addEventListener("click", async (e) => {
            e.stopPropagation();
            if (confirm(`確定要刪除牌組「${deckName}」嗎？裡面的卡片也會一併消失喔！`)) {
                await deleteDoc(doc(db, "ptcg_cards", deck.docId));
            }
        });

        box.querySelector('.copy-deck-btn').addEventListener("click", async (e) => {
            e.stopPropagation();
            await duplicateMetaDeck(deck);
        });

        box.querySelector('.deck-version-btn').addEventListener("click", (e) => {
            e.stopPropagation();
            openDeckQuickSelect(e.currentTarget, deck, "version");
        });

        box.querySelector('.deck-tier-btn').addEventListener("click", (e) => {
            e.stopPropagation();
            openDeckQuickSelect(e.currentTarget, deck, "tier");
        });

        if (isAutoTeam) {
            autoTeamGrid.appendChild(box);
        } else {
            const tier = deck.deckData?.tier || "Tier 3";
            if (tier === "Tier 0") gridTier0.appendChild(box);
            else if (tier === "Tier 1") gridTier1.appendChild(box);
            else if (tier === "Tier 2") gridTier2.appendChild(box);
            else gridTier3.appendChild(box);
        }
    });

    if (isAutoTeam) {
        const addBtn = document.createElement("div");
        addBtn.className = "add-new-deck-box";
        addBtn.innerHTML = `<span style="font-size: 32px; margin-bottom: 10px;">+</span><span>新增牌組</span>`;
        addBtn.addEventListener("click", () => openDeckModal(null, "Tier 3"));
        autoTeamGrid.appendChild(addBtn);
        autoTeamGrid.ondragover = (e) => {
            if (!draggedDeckDocId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        };
        autoTeamGrid.ondrop = async (e) => {
            if (!draggedDeckDocId || e.target.closest(".deck-box-container")) return;
            e.preventDefault();
            await reorderMetaDecks(null, "Tier 3");
        };
        return;
    }

    const tiers = [
        { grid: gridTier0, block: tier0Block, name: "Tier 0" },
        { grid: gridTier1, block: tier1Block, name: "Tier 1" },
        { grid: gridTier2, block: tier2Block, name: "Tier 2" },
        { grid: gridTier3, block: tier3Block, name: "Tier 3" }
    ];

    tiers.forEach(t => {
        const deckCount = t.grid.querySelectorAll(".deck-box-container").length;
        t.block.style.display = t.name === "Tier 0" && deckCount === 0 ? "none" : "block";
        const addBtn = document.createElement("div");
        addBtn.className = "add-new-deck-box";
        addBtn.innerHTML = `<span style="font-size: 32px; margin-bottom: 10px;">+</span><span>新增牌組</span>`;
        addBtn.addEventListener("click", () => openDeckModal(null, t.name));
        t.grid.appendChild(addBtn);

        t.grid.ondragover = (e) => {
            if (!draggedDeckDocId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        };

        t.grid.ondrop = async (e) => {
            if (!draggedDeckDocId || e.target.closest(".deck-box-container")) return;
            e.preventDefault();
            await reorderMetaDecks(null, t.name);
        };
    });
}

async function reorderMetaDecks(targetDeckId, targetTier) {
    if (!draggedDeckDocId) return;
    if (targetDeckId === draggedDeckDocId) return;

    const draggedDeck = cardsData.find(c => c.docId === draggedDeckDocId);
    if (!draggedDeck) return;

    const isAutoTeam = activeMetaLobbyTabId === AUTO_TEAM_LOBBY_TAB_ID;
    const sortedTargetDecks = cardsData
        .filter(c => c.section === "meta_deck"
            && c.docId !== draggedDeckDocId
            && getDeckLobbyTabId(c) === activeMetaLobbyTabId
            && (isAutoTeam || (c.deckData?.tier || "Tier 3") === targetTier))
        .sort((a, b) => (a.deckData?.order || 0) - (b.deckData?.order || 0));

    const insertIndex = targetDeckId ? sortedTargetDecks.findIndex(c => c.docId === targetDeckId) : sortedTargetDecks.length;
    sortedTargetDecks.splice(insertIndex < 0 ? sortedTargetDecks.length : insertIndex, 0, draggedDeck);

    const batch = writeBatch(db);
    const now = Date.now();
    sortedTargetDecks.forEach((deck, idx) => {
        const deckRef = doc(db, "ptcg_cards", deck.docId);
        const updates = { "deckData.order": now + idx };
        if (!isAutoTeam) updates["deckData.tier"] = targetTier;
        batch.update(deckRef, updates);
    });
    await batch.commit();
}

async function duplicateMetaDeck(deck) {
    if (!deck?.deckData) return;
    const copiedDeckData = cloneMetaDeckDataForCopy(deck.deckData, {
        name: `${deck.deckData.name || "牌組"} 複製`,
        order: Date.now(),
        lobbyTabId: getDeckLobbyTabId(deck)
    });
    await addDoc(cardsCollection, {
        section: "meta_deck",
        deckData: copiedDeckData
    });
}

function closeDeckQuickSelect() {
    document.querySelector(".deck-quick-select-popover")?.remove();
}

function openDeckQuickSelect(anchorEl, deck, mode) {
    closeDeckQuickSelect();
    if (!deck?.docId) return;

    const popover = document.createElement("div");
    popover.className = "deck-quick-select-popover";
    const label = document.createElement("div");
    label.className = "deck-quick-select-label";
    label.innerText = mode === "version" ? "更換版本" : "更換 Tier";

    const select = document.createElement("select");
    if (mode === "version") {
        getMetaLobbyTabs().forEach(tab => {
            const option = document.createElement("option");
            option.value = tab.id;
            option.innerText = tab.name;
            select.appendChild(option);
        });
        select.value = getDeckLobbyTabId(deck);
    } else {
        ["Tier 0", "Tier 1", "Tier 2", "Tier 3"].forEach(tier => {
            const option = document.createElement("option");
            option.value = tier;
            option.innerText = tier;
            select.appendChild(option);
        });
        select.value = deck.deckData?.tier || "Tier 3";
    }

    select.addEventListener("click", e => e.stopPropagation());
    select.addEventListener("change", async () => {
        const updates = mode === "version"
            ? {
                "deckData.lobbyTabId": select.value,
                "deckData.version": getMetaLobbyTabName(select.value)
            }
            : { "deckData.tier": select.value };
        await updateDoc(doc(db, "ptcg_cards", deck.docId), updates);
        closeDeckQuickSelect();
    });

    popover.addEventListener("click", e => e.stopPropagation());
    popover.appendChild(label);
    popover.appendChild(select);
    document.body.appendChild(popover);

    const rect = anchorEl.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const margin = 10;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - popoverRect.width - margin));
    const top = Math.max(margin, Math.min(rect.bottom + 8, window.innerHeight - popoverRect.height - margin));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    select.focus();

    setTimeout(() => {
        document.addEventListener("click", closeDeckQuickSelect, { once: true });
    }, 0);
}

btnBackDecks.addEventListener("click", () => {
    activeMetaDeckId = null;
    activeDeckTabId = null;
    metaDeckDetailView.style.display = "none";
    metaDecksListView.style.display = "block";
    renderAllViews();
});

btnImportDeckList?.addEventListener("click", () => {
    document.getElementById("deck-import-text").value = "";
    document.getElementById("deck-import-replace").checked = true;
    deckImportFormModal.classList.add("show");
    document.getElementById("deck-import-text").focus();
});

function renderMetaDeckDetail() {
    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    if (!deck) {
        btnBackDecks.click();
        return;
    }

    detailDeckRows.innerHTML = "";
    
    const { tabs, activeTab } = getActiveDeckTab(deck);
    const currentCards = activeTab.cards || [];
    detailDeckTitle.innerText = deck.deckData?.name || "未命名牌組";
    detailDeckCover.src = activeTab.coverCard?.img || activeTab.coverImg || deck.deckData?.coverImg || "https://placehold.co/300x420/eaeaea/999999?text=Cover";
    renderDeckTabCoverEditor(deck, tabs, activeTab);
    renderDeckTabsBar(deck, tabs, activeTab);

    deckRowTypes.forEach(rowType => {
        const rowCards = currentCards
            .map((card, index) => ({ card, index }))
            .filter(item => getDeckCardType(item.card.type) === rowType.key);
        
        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";
        rowBlock.style.marginBottom = "15px";
        
        rowBlock.innerHTML = `
            <div class="status-row" style="background-color: #fafafa; border: 1px dashed #ccc; padding: 15px; flex-direction: column;">
                <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid #ddd;">
                    ${rowType.label} <span style="color:#888; font-size: 14px;">(${rowCards.reduce((sum, item) => sum + (item.card.qty||1), 0)})</span>
                </div>
                <div class="cards-horizontal-list deck-card-row" data-card-type="${rowType.key}"></div>
            </div>
        `;

        const listDiv = rowBlock.querySelector(".cards-horizontal-list");

        rowCards.forEach(({ card, index }) => {
            const cardEl = document.createElement("div");
            const colorMode = card.colorMode || "transparent";
            cardEl.className = `card-box deck-card-color-${colorMode}`;
            cardEl.style.backgroundColor = getDeckCardBgColor(card);
            cardEl.setAttribute("draggable", true);
            
            const displayImg = card.img || "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
            const displayName = card.name || "(未命名)";
            
            const qtyBadge = `<div class="deck-card-qty-badge">x${card.qty || 1}</div>`;

            cardEl.innerHTML = `
                <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
                <div class="card-info">
                    <strong>${displayName}</strong>
                </div>
                ${qtyBadge}
                <button class="toggle-main-btn deck-gray-btn" title="改為淺灰底色">◼</button>
                <button class="copy-card-btn" title="複製卡片">📄</button>
                <button class="del-card-btn" title="從牌組移除">✕</button>
                <button class="view-card-btn" title="放大預覽">🔍</button>
            `;

            cardEl.addEventListener("dragstart", (e) => {
                draggedDeckCardIndex = index;
                e.dataTransfer.effectAllowed = "move";
                setTimeout(() => cardEl.classList.add("dragging"), 0);
            });

            cardEl.addEventListener("dragend", () => {
                cardEl.classList.remove("dragging");
                draggedDeckCardIndex = null;
            });

            cardEl.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                cardEl.classList.add("drag-over");
            });

            cardEl.addEventListener("dragleave", () => cardEl.classList.remove("drag-over"));

            cardEl.addEventListener("drop", async (e) => {
                e.preventDefault();
                cardEl.classList.remove("drag-over");
                await reorderDeckCards(index, rowType.key);
            });

            cardEl.addEventListener("click", () => {
                openDeckCardModal(rowType.key, card, index);
            });

            cardEl.querySelector('.toggle-main-btn').addEventListener("click", async (e) => {
                e.stopPropagation();
                const currentBgColor = getDeckCardBgColor(card);
                if (!isDeckCardWhiteBg(currentBgColor) && !isDeckCardLightGrayBg(currentBgColor)) {
                    openDeckCardModal(rowType.key, card, index);
                    return;
                }
                const nextBgColor = isDeckCardLightGrayBg(currentBgColor) ? "#FFFFFF" : "#D3D3D3";
                const updatedTabs = tabs.map(tab => tab.id === activeTab.id
                    ? {
                        ...tab,
                        cards: tab.cards.map((item, cardIndex) => cardIndex === index
                            ? { ...item, bgColor: nextBgColor, colorMode: "transparent" }
                            : item
                        )
                    }
                    : tab
                );
                await saveDeckTabs(deck, updatedTabs);
            });

            cardEl.querySelector('.del-card-btn').addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`確定要從牌組移除「${displayName}」嗎？`)) {
                    const updatedTabs = tabs.map(tab => tab.id === activeTab.id
                        ? { ...tab, cards: tab.cards.filter((_, cardIndex) => cardIndex !== index) }
                        : tab
                    );
                    await saveDeckTabs(deck, updatedTabs);
                }
            });
            cardEl.querySelector('.copy-card-btn').addEventListener("click", async (e) => {
                e.stopPropagation();
                const updatedTabs = tabs.map(tab => {
                    if (tab.id !== activeTab.id) return tab;
                    const copiedCards = [...tab.cards];
                    copiedCards.splice(index + 1, 0, { ...card });
                    return { ...tab, cards: copiedCards };
                });
                await saveDeckTabs(deck, updatedTabs);
            });
            cardEl.querySelector('.view-card-btn').addEventListener("click", (e) => {
                e.stopPropagation();
                document.getElementById("lightbox-img").src = displayImg;
                document.getElementById("lightbox-modal").classList.add("show");
            });

            listDiv.appendChild(cardEl);
        });

        const addBtn = document.createElement("div");
        addBtn.className = "add-new-card-box";
        addBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
        addBtn.addEventListener("click", () => {
            openDeckCardModal(rowType.key);
        });
        listDiv.appendChild(addBtn);

        listDiv.addEventListener("dragover", (e) => {
            if (draggedDeckCardIndex === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        });

        listDiv.addEventListener("drop", async (e) => {
            if (draggedDeckCardIndex === null || e.target.closest(".card-box")) return;
            e.preventDefault();
            await reorderDeckCards(null, rowType.key);
        });

        detailDeckRows.appendChild(rowBlock);
    });

    renderDeckReplacementSection(deck, tabs, activeTab);
}

function createReplacementCardElement(card, onEdit, onDelete = null) {
    const cardEl = document.createElement("div");
    cardEl.className = "replacement-card";
    const displayImg = card?.img || "https://placehold.co/150x210/eaf5e5/729765?text=No+Image";
    const displayName = card?.name || "尚未設定";
    const qtyBadge = `<div class="deck-card-qty-badge replacement-qty-badge">x${card?.qty || 1}</div>`;
    cardEl.innerHTML = `
        <img src="${displayImg}" alt="${displayName}" onerror="this.src='https://placehold.co/150x210/eaf5e5/729765?text=Error'">
        <div class="replacement-card-name">${displayName}</div>
        ${qtyBadge}
        ${onDelete ? '<button type="button" class="replacement-card-delete" title="移除替換卡">&times;</button>' : ""}
        <button type="button" class="view-card-btn replacement-view-btn" title="放大預覽">🔍</button>
    `;
    cardEl.addEventListener("click", onEdit);
    cardEl.querySelector(".replacement-card-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        onDelete();
    });
    cardEl.querySelector(".replacement-view-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        document.getElementById("lightbox-img").src = displayImg;
        document.getElementById("lightbox-modal").classList.add("show");
    });
    return cardEl;
}

function renderDeckReplacementSection(deck, tabs, activeTab) {
    const replacements = activeTab.replacements || [];
    const section = document.createElement("section");
    section.className = "deck-replacement-section";
    section.innerHTML = `
        <div class="deck-replacement-header">
            <div>
                <h3>可替換</h3>
                <span>${replacements.length} 組</span>
            </div>
            <button type="button" class="btn-secondary add-replacement-group">＋ 新增替換組</button>
        </div>
        <div class="deck-replacement-groups"></div>
    `;

    const groupsHost = section.querySelector(".deck-replacement-groups");
    replacements.forEach(group => {
        const groupEl = document.createElement("div");
        groupEl.className = "deck-replacement-group";

        const sourceHost = document.createElement("div");
        sourceHost.className = "deck-replacement-source";
        const sources = getReplacementSources(group);
        sources.forEach((card, sourceIndex) => {
            sourceHost.appendChild(createReplacementCardElement(
                card,
                () => openDeckReplacementModal(group.id, "source", sourceIndex, card),
                async () => {
                    const updatedTabs = tabs.map(tab => tab.id === activeTab.id ? {
                        ...tab,
                        replacements: replacements.map(item => item.id === group.id ? {
                            ...item,
                            sources: getReplacementSources(item).filter((_, index) => index !== sourceIndex)
                        } : item)
                    } : tab);
                    await saveDeckTabs(deck, updatedTabs);
                }
            ));
        });
        if (sources.length === 0) {
            const firstSource = document.createElement("button");
            firstSource.type = "button";
            firstSource.className = "replacement-add-card replacement-first-source";
            firstSource.innerHTML = `<span>＋</span><strong>新增基準卡</strong>`;
            firstSource.addEventListener("click", () => openDeckReplacementModal(group.id, "source"));
            sourceHost.appendChild(firstSource);
        }

        const arrow = document.createElement("div");
        arrow.className = "deck-replacement-arrow";
        arrow.innerHTML = `<span>→</span><span>←</span>`;
        arrow.setAttribute("aria-label", "可互相替換");

        const alternativesHost = document.createElement("div");
        alternativesHost.className = "deck-replacement-alternatives";
        const alternatives = (group.alternatives || []).slice(0, 3);
        alternatives.forEach((card, alternativeIndex) => {
            alternativesHost.appendChild(createReplacementCardElement(
                card,
                () => openDeckReplacementModal(group.id, "alternative", alternativeIndex, card),
                async () => {
                    const updatedTabs = tabs.map(tab => tab.id === activeTab.id ? {
                        ...tab,
                        replacements: replacements.map(item => item.id === group.id ? {
                            ...item,
                            alternatives: (item.alternatives || []).filter((_, index) => index !== alternativeIndex)
                        } : item)
                    } : tab);
                    await saveDeckTabs(deck, updatedTabs);
                }
            ));
        });

        if (alternatives.length < 3) {
            const addAlternative = document.createElement("button");
            addAlternative.type = "button";
            addAlternative.className = "replacement-add-card";
            addAlternative.innerHTML = `<span>＋</span><strong>新增替換卡</strong>`;
            addAlternative.addEventListener("click", () => openDeckReplacementModal(group.id, "alternative"));
            alternativesHost.appendChild(addAlternative);
        }

        const deleteGroup = document.createElement("button");
        deleteGroup.type = "button";
        deleteGroup.className = "replacement-group-delete";
        deleteGroup.title = "刪除替換組";
        deleteGroup.innerHTML = "&times;";
        deleteGroup.addEventListener("click", async () => {
            if (!confirm("確定要刪除這組可替換卡片嗎？")) return;
            const updatedTabs = tabs.map(tab => tab.id === activeTab.id
                ? { ...tab, replacements: replacements.filter(item => item.id !== group.id) }
                : tab
            );
            await saveDeckTabs(deck, updatedTabs);
        });

        groupEl.append(sourceHost, arrow, alternativesHost, deleteGroup);
        groupsHost.appendChild(groupEl);
    });

    if (replacements.length === 0) {
        groupsHost.innerHTML = `<div class="deck-replacement-empty">尚未建立可替換卡片組</div>`;
    }

    section.querySelector(".add-replacement-group").addEventListener("click", async () => {
        const newGroup = {
            id: `replacement-${Date.now()}`,
            sources: [],
            alternatives: []
        };
        const updatedTabs = tabs.map(tab => tab.id === activeTab.id
            ? { ...tab, replacements: [...replacements, newGroup] }
            : tab
        );
        await saveDeckTabs(deck, updatedTabs);
        openDeckReplacementModal(newGroup.id, "source");
    });

    detailDeckRows.appendChild(section);
}

function renderDeckTabCoverEditor(deck, tabs, activeTab) {
    detailDeckCover.title = "雙擊編輯左側大卡";
    detailDeckCover.ondblclick = () => openDeckCoverModal(deck, activeTab);
}

function closeTabActionMenus() {
    document.querySelectorAll(".meta-lobby-tab-actions").forEach(menu => menu.remove());
}

function showTabActions(tabBtn, actions) {
    const wrapper = tabBtn.closest(".deck-tab-wrapper");
    if (!wrapper) return null;
    closeTabActionMenus();
    actions.addEventListener("click", (event) => event.stopPropagation());
    actions.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    wrapper.appendChild(actions);
    return wrapper;
}

function openDeckTabActions(tabBtn, deck, tab, tabs) {
    const actions = document.createElement("div");
    actions.className = "meta-lobby-tab-actions";
    actions.innerHTML = `
        <button type="button" class="meta-lobby-action rename">更名</button>
        <button type="button" class="meta-lobby-action delete">刪除</button>
        <button type="button" class="meta-lobby-action cancel">取消</button>
    `;

    actions.querySelector(".rename").addEventListener("click", (e) => {
        e.stopPropagation();
        openInlineDeckTabRename(actions, deck, tab, tabs);
    });
    actions.querySelector(".delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        if (tabs.length <= 1) {
            alert("至少需要保留一個分頁。");
            renderMetaDeckDetail();
            return;
        }
        if (!confirm(`確定要刪除「${tab.name}」分頁嗎？`)) {
            renderMetaDeckDetail();
            return;
        }
        const tabIndex = tabs.findIndex(item => item.id === tab.id);
        const updatedTabs = tabs.filter(item => item.id !== tab.id);
        if (activeDeckTabId === tab.id) {
            activeDeckTabId = updatedTabs[Math.max(0, tabIndex - 1)]?.id || updatedTabs[0].id;
        }
        await saveDeckTabs(deck, updatedTabs);
    });
    actions.querySelector(".cancel").addEventListener("click", (e) => {
        e.stopPropagation();
        actions.remove();
    });

    showTabActions(tabBtn, actions);
}

function openInlineDeckTabRename(targetEl, deck, tab, tabs) {
    const wrapper = targetEl.closest(".deck-tab-wrapper");
    const tabBtn = wrapper?.querySelector(".deck-tab-btn");
    if (!wrapper || !tabBtn) return;
    targetEl.remove();
    const input = document.createElement("input");
    input.type = "text";
    input.className = "deck-tab-rename-input";
    input.value = tab.name;
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("contextmenu", (event) => event.stopPropagation());

    let isFinished = false;
    const finishRename = async (shouldSave) => {
        if (isFinished) return;
        isFinished = true;
        const newName = input.value.trim();

        if (shouldSave && newName && newName !== tab.name) {
            const updatedTabs = tabs.map(item => item.id === tab.id ? { ...item, name: newName } : item);
            await saveDeckTabs(deck, updatedTabs);
        } else {
            renderMetaDeckDetail();
        }
    };

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") finishRename(true);
        if (event.key === "Escape") finishRename(false);
    });
    input.addEventListener("blur", () => finishRename(true));

    wrapper.replaceChild(input, tabBtn);
    input.focus();
    input.select();
}

function renderDeckTabsBar(deck, tabs, activeTab) {
    const detailLayout = document.querySelector("#meta-deck-detail-view .deck-detail-layout");
    metaDeckDetailView.querySelector(".deck-tabs-bar")?.remove();

    const tabsBar = document.createElement("div");
    tabsBar.className = "deck-tabs-bar";

    tabs.forEach(tab => {
        const tabBtn = document.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = `deck-tab-btn ${tab.id === activeTab.id ? "active" : ""}`;
        tabBtn.innerHTML = `<span class="deck-tab-name">${tab.name}</span>`;
        tabBtn.addEventListener("click", () => {
            clearTimeout(deckTabClickTimer);
            deckTabClickTimer = setTimeout(() => {
                activeDeckTabId = tab.id;
                renderMetaDeckDetail();
            }, 180);
        });
        tabBtn.addEventListener("contextmenu", (e) => {
            e.stopPropagation();
            e.preventDefault();
            clearTimeout(deckTabClickTimer);
            openDeckTabActions(e.currentTarget, deck, tab, tabs);
        });

        const wrapper = document.createElement("div");
        wrapper.className = "deck-tab-wrapper";
        wrapper.setAttribute("draggable", true);
        wrapper.addEventListener("dragstart", (e) => {
            draggedDeckTabId = tab.id;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => wrapper.classList.add("dragging"), 0);
        });
        wrapper.addEventListener("dragend", () => {
            wrapper.classList.remove("dragging");
            draggedDeckTabId = null;
        });
        wrapper.addEventListener("dragover", (e) => {
            if (!draggedDeckTabId || draggedDeckTabId === tab.id) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            wrapper.classList.add("drag-over");
        });
        wrapper.addEventListener("dragleave", () => wrapper.classList.remove("drag-over"));
        wrapper.addEventListener("drop", async (e) => {
            e.preventDefault();
            wrapper.classList.remove("drag-over");
            await reorderDeckTabs(deck, tabs, tab.id);
        });
        wrapper.appendChild(tabBtn);
        tabsBar.appendChild(wrapper);
    });

    const addTabBtn = document.createElement("button");
    addTabBtn.type = "button";
    addTabBtn.className = "deck-tab-add-btn";
    addTabBtn.innerText = "+";
    addTabBtn.title = "新增分頁";
    addTabBtn.addEventListener("click", async () => {
        const newName = prompt("請輸入新分頁名稱", `牌組 ${tabs.length + 1}`);
        if (!newName) return;
        const newTab = {
            id: `tab-${Date.now()}`,
            name: newName.trim() || `牌組 ${tabs.length + 1}`,
            coverCard: { ...(activeTab.coverCard || { name: "", img: activeTab.coverImg || deck.deckData?.coverImg || "" }) },
            coverImg: activeTab.coverCard?.img || activeTab.coverImg || deck.deckData?.coverImg || "",
            cards: cloneDeckCards(activeTab.cards || []),
            replacements: cloneDeckReplacements(activeTab.replacements || [])
        };
        activeDeckTabId = newTab.id;
        await saveDeckTabs(deck, [...tabs, newTab]);
    });
    tabsBar.appendChild(addTabBtn);

    metaDeckDetailView.insertBefore(tabsBar, detailLayout);
}

function renderMetaLobbyTabs(tabs) {
    const tabsHost = document.getElementById("meta-lobby-tabs");
    tabsHost.innerHTML = "";

    tabs.forEach(tab => {
        const isFixedTab = tab.id === AUTO_TEAM_LOBBY_TAB_ID;
        const wrapper = document.createElement("div");
        wrapper.className = `deck-tab-wrapper${isFixedTab ? " fixed-lobby-tab" : ""}`;
        wrapper.setAttribute("draggable", String(!isFixedTab));

        const tabBtn = document.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = `deck-tab-btn ${tab.id === activeMetaLobbyTabId ? "active" : ""}`;
        tabBtn.innerHTML = `<span class="deck-tab-name">${tab.name}</span>`;
        tabBtn.addEventListener("click", () => {
            clearTimeout(metaLobbyTabClickTimer);
            metaLobbyTabClickTimer = setTimeout(() => {
                activeMetaLobbyTabId = tab.id;
                renderMetaDecksList();
            }, 180);
        });
        if (!isFixedTab) {
            tabBtn.addEventListener("contextmenu", (e) => {
                e.stopPropagation();
                e.preventDefault();
                clearTimeout(metaLobbyTabClickTimer);
                openLobbyTabActions(e.currentTarget, tab, tabs);
            });
        }

        wrapper.addEventListener("dragstart", (e) => {
            if (isFixedTab) {
                e.preventDefault();
                return;
            }
            draggedMetaLobbyTabId = tab.id;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => wrapper.classList.add("dragging"), 0);
        });
        wrapper.addEventListener("dragend", () => {
            wrapper.classList.remove("dragging");
            draggedMetaLobbyTabId = null;
        });
        wrapper.addEventListener("dragover", (e) => {
            if (isFixedTab || !draggedMetaLobbyTabId || draggedMetaLobbyTabId === tab.id) return;
            e.preventDefault();
            wrapper.classList.add("drag-over");
        });
        wrapper.addEventListener("dragleave", () => wrapper.classList.remove("drag-over"));
        wrapper.addEventListener("drop", async (e) => {
            if (isFixedTab) return;
            e.preventDefault();
            wrapper.classList.remove("drag-over");
            const updatedTabs = [...tabs];
            const fromIndex = updatedTabs.findIndex(item => item.id === draggedMetaLobbyTabId);
            const toIndex = updatedTabs.findIndex(item => item.id === tab.id);
            if (fromIndex === -1 || toIndex === -1) return;
            const [movedTab] = updatedTabs.splice(fromIndex, 1);
            updatedTabs.splice(toIndex, 0, movedTab);
            await saveMetaLobbyTabs(updatedTabs);
        });

        wrapper.appendChild(tabBtn);
        tabsHost.appendChild(wrapper);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "deck-tab-add-btn";
    addBtn.title = "新增版本";
    addBtn.innerText = "+";
    addBtn.addEventListener("click", () => createMetaLobbyTab(tabs));
    tabsHost.appendChild(addBtn);
}

function renderChallenge24hTabs(tabs) {
    const tabsHost = document.getElementById("challenge-24h-tabs");
    if (!tabsHost) return;
    tabsHost.innerHTML = "";

    tabs.forEach(tab => {
        const wrapper = document.createElement("div");
        wrapper.className = "deck-tab-wrapper";
        wrapper.setAttribute("draggable", "true");

        const tabBtn = document.createElement("button");
        tabBtn.type = "button";
        tabBtn.className = `deck-tab-btn ${tab.id === active24hVersionTabId ? "active" : ""}`;
        tabBtn.innerHTML = `<span class="deck-tab-name">${tab.name}</span>`;
        tabBtn.addEventListener("click", () => {
            clearTimeout(challenge24hTabClickTimer);
            challenge24hTabClickTimer = setTimeout(() => {
                active24hVersionTabId = tab.id;
                render24hRows();
            }, 180);
        });
        tabBtn.addEventListener("contextmenu", (e) => {
            e.stopPropagation();
            e.preventDefault();
            clearTimeout(challenge24hTabClickTimer);
            openChallenge24hTabActions(e.currentTarget, tab, tabs);
        });

        wrapper.addEventListener("dragstart", (e) => {
            draggedChallenge24hTabId = tab.id;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => wrapper.classList.add("dragging"), 0);
        });

        wrapper.addEventListener("dragend", () => {
            wrapper.classList.remove("dragging");
            draggedChallenge24hTabId = null;
        });

        wrapper.addEventListener("dragover", (e) => {
            if (!draggedChallenge24hTabId || draggedChallenge24hTabId === tab.id) return;
            e.preventDefault();
            wrapper.classList.add("drag-over");
        });

        wrapper.addEventListener("dragleave", () => wrapper.classList.remove("drag-over"));

        wrapper.addEventListener("drop", async (e) => {
            e.preventDefault();
            wrapper.classList.remove("drag-over");
            if (!draggedChallenge24hTabId || draggedChallenge24hTabId === tab.id) return;

            const updatedTabs = [...tabs];
            const fromIndex = updatedTabs.findIndex(item => item.id === draggedChallenge24hTabId);
            const toIndex = updatedTabs.findIndex(item => item.id === tab.id);
            if (fromIndex === -1 || toIndex === -1) return;

            const [movedTab] = updatedTabs.splice(fromIndex, 1);
            updatedTabs.splice(toIndex, 0, movedTab);
            active24hVersionTabId = movedTab.id;
            await saveChallenge24hVersionTabs(updatedTabs);
        });

        wrapper.appendChild(tabBtn);
        tabsHost.appendChild(wrapper);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "deck-tab-add-btn";
    addBtn.title = "新增版本";
    addBtn.innerText = "+";
    addBtn.addEventListener("click", () => createChallenge24hVersionTab(tabs));
    tabsHost.appendChild(addBtn);

    renderChallenge24hImportTools(tabsHost);
}

function renderChallenge24hImportTools(tabsHost) {
    const expansionOptions = getChallenge24hImportExpansionOptions();
    const defaultExpansion = getDefaultChallenge24hImportExpansion();
    const toolEl = document.createElement("div");
    toolEl.className = "challenge-24h-import-tools";
    toolEl.innerHTML = `
        <select class="challenge-24h-import-select" ${expansionOptions.length ? "" : "disabled"}>
            ${expansionOptions.map(id => `<option value="${id}" ${id === defaultExpansion ? "selected" : ""}>${id}</option>`).join("")}
        </select>
        <button type="button" class="btn-secondary challenge-24h-import-btn" ${expansionOptions.length ? "" : "disabled"}>
            匯入版本
        </button>
    `;

    toolEl.querySelector(".challenge-24h-import-btn").addEventListener("click", async () => {
        const select = toolEl.querySelector(".challenge-24h-import-select");
        await importChallenge24hCardsFromCatalog(select.value, toolEl);
    });

    tabsHost.appendChild(toolEl);
}

async function importChallenge24hCardsFromCatalog(expansionId, toolEl = null) {
    if (!expansionId) {
        alert("目前沒有可匯入的圖鑑版本。");
        return;
    }

    const cardsToImport = catalogCardsData
        .filter(card => card.expansion === expansionId && challenge24hImportRarities.has(card.rarity))
        .sort((a, b) => (a.id || "").localeCompare(b.id || "", "en", { numeric: true }));

    if (!cardsToImport.length) {
        alert(`「${expansionId}」沒有 3菱、4菱、1星、2星卡片可匯入。`);
        return;
    }

    const existingIds = new Set(cardsData
        .filter(card => card.section === "24h" && getChallenge24hCardVersionTabId(card) === active24hVersionTabId)
        .map(card => normalizeCardId(card.id))
        .filter(Boolean));

    const uniqueCardsToImport = cardsToImport.filter(card => !existingIds.has(normalizeCardId(card.id)));
    if (!uniqueCardsToImport.length) {
        alert(`目前分頁已經有「${expansionId}」可匯入的卡片。`);
        return;
    }

    if (!confirm(`要將「${expansionId}」的 ${uniqueCardsToImport.length} 張卡片匯入目前 24H 分頁嗎？`)) return;

    const button = toolEl?.querySelector(".challenge-24h-import-btn");
    if (button) {
        button.disabled = true;
        button.textContent = "匯入中...";
    }

    try {
        for (let i = 0; i < uniqueCardsToImport.length; i += 450) {
            const batch = writeBatch(db);
            uniqueCardsToImport.slice(i, i + 450).forEach((card, index) => {
                const cardRef = doc(cardsCollection);
                batch.set(cardRef, {
                    section: "24h",
                    name: card.name || "",
                    id: card.id || "",
                    imageUrl: card.imageUrl || "",
                    rarity: card.rarity || "",
                    sourceRarity: card.sourceRarity || "",
                    cardType: card.cardType || "",
                    bgColor: "#ffffff",
                    challenge24hData: {
                        ownership: "無",
                        versionTabId: active24hVersionTabId,
                        order: Date.now() + i + index
                    }
                });
            });
            await batch.commit();
        }
        alert(`已匯入 ${uniqueCardsToImport.length} 張卡片。`);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "匯入版本";
        }
    }
}

function openChallenge24hTabActions(tabBtn, tab, tabs) {
    const actions = document.createElement("div");
    actions.className = "meta-lobby-tab-actions";
    actions.innerHTML = `
        <button type="button" class="meta-lobby-action rename">更名</button>
        <button type="button" class="meta-lobby-action delete">刪除</button>
        <button type="button" class="meta-lobby-action cancel">取消</button>
    `;

    actions.querySelector(".rename").addEventListener("click", (e) => {
        e.stopPropagation();
        openInlineChallenge24hTabRename(actions, tab, tabs);
    });
    actions.querySelector(".delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteChallenge24hVersionTab(tab, tabs);
    });
    actions.querySelector(".cancel").addEventListener("click", (e) => {
        e.stopPropagation();
        actions.remove();
    });

    showTabActions(tabBtn, actions);
}

function openInlineChallenge24hTabRename(targetEl, tab, tabs) {
    const wrapper = targetEl.closest(".deck-tab-wrapper");
    const tabBtn = wrapper?.querySelector(".deck-tab-btn");
    if (!wrapper || !tabBtn) return;
    targetEl.remove();
    const input = document.createElement("input");
    input.type = "text";
    input.className = "deck-tab-rename-input";
    input.value = tab.name;
    let finished = false;

    const finish = async (save) => {
        if (finished) return;
        finished = true;
        const newName = input.value.trim();
        if (save && newName && newName !== tab.name) {
            await saveChallenge24hVersionTabs(tabs.map(item => item.id === tab.id ? { ...item, name: newName } : item));
        } else {
            render24hRows();
        }
    };

    input.addEventListener("click", e => e.stopPropagation());
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    wrapper.replaceChild(input, tabBtn);
    input.focus();
    input.select();
}

async function createChallenge24hVersionTab(tabs) {
    const newName = prompt("請輸入新版本名稱", `版本 ${tabs.length + 1}`);
    if (!newName) return;
    const newTab = { id: `challenge-24h-${Date.now()}`, name: newName.trim() || `版本 ${tabs.length + 1}` };
    active24hVersionTabId = newTab.id;
    await saveChallenge24hVersionTabs([...tabs, newTab]);
}

async function deleteChallenge24hVersionTab(tab, tabs) {
    if (tabs.length <= 1) {
        alert("至少需要保留一個版本。");
        render24hRows();
        return;
    }
    const cardsInTab = cardsData.filter(card => card.section === "24h" && getChallenge24hCardVersionTabId(card) === tab.id);
    if (!confirm(`確定要刪除「${tab.name}」版本嗎？此版本中的 ${cardsInTab.length} 張 24H 卡片也會刪除。`)) {
        render24hRows();
        return;
    }

    for (let i = 0; i < cardsInTab.length; i += 450) {
        const batch = writeBatch(db);
        cardsInTab.slice(i, i + 450).forEach(card => batch.delete(doc(db, "ptcg_cards", card.docId)));
        await batch.commit();
    }

    const updatedTabs = tabs.filter(item => item.id !== tab.id);
    if (active24hVersionTabId === tab.id) active24hVersionTabId = updatedTabs[0]?.id || DEFAULT_24H_VERSION_TAB_ID;
    await saveChallenge24hVersionTabs(updatedTabs);
}

function openLobbyTabActions(tabBtn, tab, tabs) {
    if (tab.id === AUTO_TEAM_LOBBY_TAB_ID) return;
    const actions = document.createElement("div");
    actions.className = "meta-lobby-tab-actions";
    actions.innerHTML = `
        <button type="button" class="meta-lobby-action rename">更名</button>
        <button type="button" class="meta-lobby-action delete">刪除</button>
        <button type="button" class="meta-lobby-action cancel">取消</button>
    `;

    actions.querySelector(".rename").addEventListener("click", (e) => {
        e.stopPropagation();
        openInlineLobbyTabRename(actions, tab, tabs);
    });
    actions.querySelector(".delete").addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteMetaLobbyTab(tab, tabs);
    });
    actions.querySelector(".cancel").addEventListener("click", (e) => {
        e.stopPropagation();
        actions.remove();
    });

    showTabActions(tabBtn, actions);
}

async function deleteMetaLobbyTab(tab, tabs) {
    if (tab.id === AUTO_TEAM_LOBBY_TAB_ID) return;
    if (tabs.filter(item => item.id !== AUTO_TEAM_LOBBY_TAB_ID).length <= 1) {
        alert("至少需要保留一個版本。");
        renderMetaDecksList();
        return;
    }
    if (!confirm(`確定要刪除「${tab.name}」及其中所有牌組嗎？`)) {
        renderMetaDecksList();
        return;
    }

    const decksToDelete = cardsData.filter(card => card.section === "meta_deck" && getDeckLobbyTabId(card) === tab.id);
    await Promise.all(decksToDelete.map(deck => deleteDoc(doc(db, "ptcg_cards", deck.docId))));
    const updatedTabs = tabs.filter(item => item.id !== tab.id);
    if (activeMetaLobbyTabId === tab.id) activeMetaLobbyTabId = updatedTabs[0].id;
    await saveMetaLobbyTabs(updatedTabs);
}

function openInlineLobbyTabRename(targetEl, tab, tabs) {
    const wrapper = targetEl.closest(".deck-tab-wrapper");
    const tabBtn = wrapper?.querySelector(".deck-tab-btn");
    if (!wrapper || !tabBtn) return;
    targetEl.remove();
    const input = document.createElement("input");
    input.type = "text";
    input.className = "deck-tab-rename-input";
    input.value = tab.name;
    let finished = false;

    const finish = async (save) => {
        if (finished) return;
        finished = true;
        const newName = input.value.trim();
        if (save && newName && newName !== tab.name) {
            await saveMetaLobbyTabs(tabs.map(item => item.id === tab.id ? { ...item, name: newName } : item));
        } else {
            renderMetaDecksList();
        }
    };

    input.addEventListener("click", e => e.stopPropagation());
    input.addEventListener("keydown", e => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
    wrapper.replaceChild(input, tabBtn);
    input.focus();
    input.select();
}

async function createMetaLobbyTab(tabs) {
    const newName = prompt("請輸入新版本名稱", `版本 ${tabs.length + 1}`);
    if (!newName) return;

    const newTab = { id: `lobby-${Date.now()}`, name: newName.trim() || `版本 ${tabs.length + 1}` };
    const sourceDecks = cardsData.filter(card => card.section === "meta_deck" && getDeckLobbyTabId(card) === activeMetaLobbyTabId);
    activeMetaLobbyTabId = newTab.id;
    await saveMetaLobbyTabs([...tabs, newTab]);

    await Promise.all(sourceDecks.map((deck, index) => addDoc(cardsCollection, {
        section: "meta_deck",
        deckData: cloneMetaDeckDataForCopy(deck.deckData || {}, {
            lobbyTabId: newTab.id,
            version: newTab.name,
            order: Date.now() + index
        })
    })));
}

async function reorderDeckTabs(deck, tabs, targetTabId) {
    if (!draggedDeckTabId || draggedDeckTabId === targetTabId) return;

    const updatedTabs = [...tabs];
    const fromIndex = updatedTabs.findIndex(tab => tab.id === draggedDeckTabId);
    const toIndex = updatedTabs.findIndex(tab => tab.id === targetTabId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [movedTab] = updatedTabs.splice(fromIndex, 1);
    updatedTabs.splice(toIndex, 0, movedTab);
    activeDeckTabId = movedTab.id;
    await saveDeckTabs(deck, updatedTabs);
}

async function reorderDeckCards(targetIndex, targetType) {
    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    if (!deck || draggedDeckCardIndex === null) return;

    const { tabs, activeTab } = getActiveDeckTab(deck);
    const updatedCards = activeTab.cards ? [...activeTab.cards] : [];
    const [movedCard] = updatedCards.splice(draggedDeckCardIndex, 1);
    if (!movedCard) return;

    movedCard.type = targetType;

    let nextIndex = updatedCards.length;
    if (targetIndex !== null) {
        nextIndex = targetIndex;
        if (draggedDeckCardIndex < targetIndex) nextIndex -= 1;
    }

    updatedCards.splice(nextIndex, 0, movedCard);
    const updatedTabs = tabs.map(tab => tab.id === activeTab.id ? { ...tab, cards: updatedCards } : tab);
    await saveDeckTabs(deck, updatedTabs);
}

// ==========================================
// 🪄 渲染：高罕卡
// ==========================================
function renderTwoStarCardsRows() {
    rarityRowsContainerTwoStar.innerHTML = "";
    
    raritiesTwoStar.forEach(rarity => {
        const targetCards = cardsData.filter(c => {
            if (c.rarity !== rarity.name) return false;
            if (c.section === "two_star_cards" && c.twoStarData?.tab === currentTwoStarTab) return true;
            if (currentTwoStarTab === "擁有的卡" && c.section === "alt_acc") return true;
            return false;
        });

        targetCards.sort((a, b) => {
            const weightA = tierWeights[a.twoStarData?.tier || "無"] || 1;
            const weightB = tierWeights[b.twoStarData?.tier || "無"] || 1;
            if (weightB !== weightA) return weightB - weightA;
            return (a.twoStarData?.order || 0) - (b.twoStarData?.order || 0);
        });

        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";
        
        rowBlock.innerHTML = `
            <div class="rarity-header">
                <img src="${rarity.icon}" alt="${rarity.name}">
                <span>${rarity.name}</span>
            </div>
        `;

        if (currentTwoStarTab === "擁有的卡") {
            createTwoStarRow(rowBlock, targetCards, "主帳", "主帳", "two-star-main", rarity.name);
            createTwoStarRow(rowBlock, targetCards, "小帳", "小帳", "two-star-alt", rarity.name);
            createTwoStarRow(rowBlock, targetCards, "資源帳", "資源帳", "two-star-res", rarity.name);
        } else if (currentTwoStarTab === "想要的卡" || currentTwoStarTab === "被交換的") { 
            if (rarity.name === "2星") {
                createTwoStarRow(rowBlock, targetCards, "支援者", "支援者", "general-row-top", rarity.name);
                createTwoStarRow(rowBlock, targetCards, "寶可夢", "寶可夢", "general-row-bottom", rarity.name);
            } else {
                createTwoStarRow(rowBlock, targetCards, null, "", "general-row-bottom", rarity.name, true);
            }
        }
        
        makeRarityBlockCollapsible(rowBlock, `two_star_cards:${currentTwoStarTab}:${rarity.name}`);
        rarityRowsContainerTwoStar.appendChild(rowBlock);
    });
}

function createTwoStarRow(parentBlock, cards, filterVal, labelText, className, rarityName, hideLabel = false) {
    const statusRow = document.createElement("div");
    statusRow.className = `status-row ${className}`;
    statusRow.innerHTML = `<div class="status-label${hideLabel ? " status-label-count-only" : ""}">${labelText}</div>`;

    const cardsListDiv = document.createElement("div");
    cardsListDiv.className = "cards-horizontal-list";

    const filteredCards = cards.filter(c => {
        if (currentTwoStarTab === "擁有的卡") return isTwoStarCardInRow(c, filterVal);
        if (currentTwoStarTab === "想要的卡" || currentTwoStarTab === "被交換的") return isTwoStarCardInRow(c, filterVal);
        return false;
    });
    statusRow.querySelector(".status-label").innerHTML = hideLabel
        ? `<span class="rarity-count">${getCardsQuantityTotal(filteredCards)}</span>`
        : `${labelText} <span class="rarity-count">${getCardsQuantityTotal(filteredCards)}</span>`;

    filteredCards.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "card-box";
        cardEl.style.backgroundColor = card.bgColor || "#ffffff";

        cardEl.setAttribute('draggable', true);

        cardEl.addEventListener('dragstart', (e) => {
            draggedCardDocId = card.docId;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => cardEl.classList.add('dragging'), 0);
        });

        cardEl.addEventListener('dragend', () => {
            cardEl.classList.remove('dragging');
            draggedCardDocId = null;
        });

        cardEl.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
            cardEl.style.transform = 'scale(1.05)'; 
        });
        cardEl.addEventListener('dragleave', () => {
            cardEl.style.transform = '';
        });

        cardEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            cardEl.style.transform = '';
            if (!draggedCardDocId || draggedCardDocId === card.docId) return;

            const currentSorted = [...filteredCards];
            const fromIndex = currentSorted.findIndex(c => c.docId === draggedCardDocId);
            const toIndex = currentSorted.findIndex(c => c.docId === card.docId);

            if(fromIndex === -1) return;

            const [movedItem] = currentSorted.splice(fromIndex, 1);
            currentSorted.splice(toIndex, 0, movedItem);

            const batch = writeBatch(db);
            const now = Date.now();
            currentSorted.forEach((c, idx) => {
                const cardRef = doc(db, "ptcg_cards", c.docId);
                batch.update(cardRef, { "twoStarData.order": now + idx });
            });
            await batch.commit();
        });

        const displayImg = card.imageUrl ? card.imageUrl : "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
        const displayName = card.name ? card.name : "<span style='color:#ccc'>(未命名)</span>";
        const displayId = card.id ? `# ${card.id}` : "<span style='color:#ccc'>(無編號)</span>";
        const qty = getCardQuantity(card);
        const tradedCardHtml = currentTwoStarTab === "被交換的"
            ? renderTradedCardPreview(card.twoStarData?.tradedCard)
            : "";

        let quickTierBtnHtml = "";
        let tierBadgeHtml = "";
        
        if (rarityName === "2星") {
            const tier = card.twoStarData?.tier || "無";
            let badgeClass = "tier-default";
            if (tier === "SS") badgeClass = "tier-ss";
            else if (tier === "S") badgeClass = "tier-s";
            else if (tier === "A") badgeClass = "tier-a";
            else if (tier === "B") badgeClass = "tier-b";
            else if (tier === "C") badgeClass = "tier-c";
            else if (tier === "D" || tier === "E") badgeClass = "tier-de";

            if (tier !== "無") {
                tierBadgeHtml = `<div style="margin-top: 5px;"><div class="tier-badge ${badgeClass}">${tier}</div></div>`;
            } else {
                tierBadgeHtml = `<div style="margin-top: 5px;"><div class="tier-badge tier-default">未評級</div></div>`;
            }
            quickTierBtnHtml = `<button class="quick-tier-btn" title="快速修改評級">🏷️</button>`;
        }

        cardEl.innerHTML = `
            ${quickTierBtnHtml}
            <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            <div class="card-info">
                <strong>${displayName}</strong>
                ${displayId}
                ${tierBadgeHtml}
                ${renderQtyControl(qty)}
                ${tradedCardHtml}
            </div>
            <button class="del-card-btn" title="刪除卡片">✕</button>
            <button class="copy-card-btn" title="複製卡片">📄</button>
            <button class="view-card-btn" title="放大預覽">🔍</button>
        `;

        const quickBtn = cardEl.querySelector('.quick-tier-btn');
        if (quickBtn) {
            quickBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                quickTierCardDocId = card.docId;
                document.getElementById('quick-tier-modal').classList.add('show');
            });
        }

        bindQtyControl(cardEl, card, "twoStarData.quantity", qty);
        cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("確定要從雲端刪除這張卡片嗎？")) await deleteDoc(doc(db, "ptcg_cards", card.docId)); });
        cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); await handleSafeCopyCard(card); });
        cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
        cardEl.addEventListener('click', () => openEditModal(card.docId));
        cardsListDiv.appendChild(cardEl);
    });

    const inlineAddBtn = document.createElement("div");
    inlineAddBtn.className = "add-new-card-box";
    inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
    inlineAddBtn.addEventListener("click", () => openNewModal(rarityName, filterVal, null)); 
    cardsListDiv.appendChild(inlineAddBtn);

    statusRow.appendChild(cardsListDiv);
    parentBlock.appendChild(statusRow);
}

// --- 渲染：泛用卡 ---
function renderGeneralCardsRows() {
    rarityRowsContainerGeneral.innerHTML = "";
    
    typesGeneral.forEach(typeObj => {
        const targetCards = cardsData.filter(c => c.section === "general_cards" && c.generalData?.type === typeObj.name);
        
        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";
        
        rowBlock.innerHTML = `
            <div class="rarity-header" style="margin-bottom: 15px;">
                <span class="general-header-title">${typeObj.name}</span>
            </div>
        `;

        createHorizontalRowGeneral(rowBlock, targetCards, "false", "通用", "general-row-top", typeObj.name);
        createHorizontalRowGeneral(rowBlock, targetCards, "true", "特別屬性", "general-row-bottom", typeObj.name);

        makeRarityBlockCollapsible(rowBlock, `general_cards:${typeObj.name}`);
        rarityRowsContainerGeneral.appendChild(rowBlock);
    });
}

function createHorizontalRowGeneral(parentBlock, cards, hasMainVal, labelText, className, typeName) {
    const statusRow = document.createElement("div");
    statusRow.className = `status-row ${className}`;
    statusRow.innerHTML = `<div class="status-label">${labelText}</div>`;

    const cardsListDiv = document.createElement("div");
    cardsListDiv.className = "cards-horizontal-list";

    const filteredAndSorted = cards.filter(c => c.generalData?.hasOnMain === hasMainVal)
                                   .sort((a, b) => (a.generalData?.order || 0) - (b.generalData?.order || 0));

    filteredAndSorted.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "card-box";
        cardEl.style.backgroundColor = card.bgColor || "#ffffff";

        cardEl.setAttribute('draggable', true);

        cardEl.addEventListener('dragstart', (e) => {
            draggedCardDocId = card.docId;
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => cardEl.classList.add('dragging'), 0);
        });

        cardEl.addEventListener('dragend', () => {
            cardEl.classList.remove('dragging');
            draggedCardDocId = null;
        });

        cardEl.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
            cardEl.style.transform = 'scale(1.05)'; 
        });
        cardEl.addEventListener('dragleave', () => {
            cardEl.style.transform = '';
        });

        cardEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            cardEl.style.transform = '';
            if (!draggedCardDocId || draggedCardDocId === card.docId) return;

            const currentSorted = [...filteredAndSorted];
            const fromIndex = currentSorted.findIndex(c => c.docId === draggedCardDocId);
            const toIndex = currentSorted.findIndex(c => c.docId === card.docId);

            if(fromIndex === -1) return;

            const [movedItem] = currentSorted.splice(fromIndex, 1);
            currentSorted.splice(toIndex, 0, movedItem);

            const batch = writeBatch(db);
            const now = Date.now();
            currentSorted.forEach((c, idx) => {
                const cardRef = doc(db, "ptcg_cards", c.docId);
                batch.update(cardRef, { "generalData.order": now + idx });
            });
            await batch.commit();
        });

        const displayImg = card.imageUrl ? card.imageUrl : "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
        const displayName = card.name ? card.name : "<span style='color:#ccc'>(未命名)</span>";
        const displayId = card.id ? `# ${card.id}` : "<span style='color:#ccc'>(無編號)</span>";
        const tagHtml = renderGeneralCardTag(card);

        cardEl.innerHTML = `
            <button class="toggle-main-btn" title="切換分類狀態">🔄</button>
            <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            <div class="card-info">
                <strong>${displayName}</strong>
                ${displayId}
                ${tagHtml}
            </div>
            <button class="del-card-btn" title="刪除卡片">✕</button>
            <button class="copy-card-btn" title="複製卡片">📄</button>
            <button class="view-card-btn" title="放大預覽">🔍</button>
        `;

        cardEl.querySelector('.toggle-main-btn').addEventListener('click', async (e) => {
            e.stopPropagation(); 
            const newStatus = (card.generalData?.hasOnMain === "true") ? "false" : "true";
            await updateDoc(doc(db, "ptcg_cards", card.docId), { 
                "generalData.hasOnMain": newStatus,
                "section": "general_cards"
            });
        });

        cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("確定要從雲端刪除這張卡片嗎？")) await deleteDoc(doc(db, "ptcg_cards", card.docId)); });
        cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); await handleSafeCopyCard(card); });
        cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
        cardEl.addEventListener('click', () => openEditModal(card.docId));
        cardsListDiv.appendChild(cardEl);
    });

    const inlineAddBtn = document.createElement("div");
    inlineAddBtn.className = "add-new-card-box";
    inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
    inlineAddBtn.addEventListener("click", () => openNewModal(null, typeName, hasMainVal));
    cardsListDiv.appendChild(inlineAddBtn);

    statusRow.appendChild(cardsListDiv);
    parentBlock.appendChild(statusRow);
}

// --- 渲染：需要卡 ---
function renderNeededCardsRows() {
    rarityRowsContainerNeeded.innerHTML = "";
    const currentRarities = currentNeededTab === "缺少的卡" ? raritiesNeededMissing : raritiesNeededGold;

    currentRarities.forEach(rarity => {
        const targetCards = cardsData.filter(c => c.section === "needed_cards" && c.neededCardsData?.tab === currentNeededTab && c.rarity === rarity.name);
        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";
        rowBlock.innerHTML = `
            <div class="rarity-header">
                <img src="${rarity.icon}" alt="${rarity.name}">
                <span>${rarity.name}</span>
            </div>
        `;

        const cardsListDiv = document.createElement("div");
        cardsListDiv.className = "cards-horizontal-list";
        cardsListDiv.style.padding = "15px";
        cardsListDiv.style.backgroundColor = "#fafafa";
        cardsListDiv.style.borderRadius = "8px";
        cardsListDiv.style.border = "1px solid #e8e8e8";

        targetCards.sort((a, b) => (a.neededCardsData?.order || 0) - (b.neededCardsData?.order || 0)).forEach(card => {
            const cardEl = document.createElement("div");
            cardEl.className = "card-box";
            cardEl.style.backgroundColor = card.bgColor || "#ffffff";

            cardEl.setAttribute('draggable', true);

            cardEl.addEventListener('dragstart', (e) => {
                draggedCardDocId = card.docId;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => cardEl.classList.add('dragging'), 0);
            });

            cardEl.addEventListener('dragend', () => {
                cardEl.classList.remove('dragging');
                draggedCardDocId = null;
            });

            cardEl.addEventListener('dragover', (e) => {
                e.preventDefault(); 
                e.dataTransfer.dropEffect = 'move';
                cardEl.style.transform = 'scale(1.05)'; 
            });
            cardEl.addEventListener('dragleave', () => {
                cardEl.style.transform = '';
            });

            cardEl.addEventListener('drop', async (e) => {
                e.preventDefault();
                cardEl.style.transform = '';
                if (!draggedCardDocId || draggedCardDocId === card.docId) return;

                const currentSorted = [...targetCards].sort((a, b) => (a.neededCardsData?.order || 0) - (b.neededCardsData?.order || 0));
                const fromIndex = currentSorted.findIndex(c => c.docId === draggedCardDocId);
                const toIndex = currentSorted.findIndex(c => c.docId === card.docId);

                if(fromIndex === -1) return;

                const [movedItem] = currentSorted.splice(fromIndex, 1);
                currentSorted.splice(toIndex, 0, movedItem);

                const batch = writeBatch(db);
                const now = Date.now();
                currentSorted.forEach((c, idx) => {
                    const cardRef = doc(db, "ptcg_cards", c.docId);
                    batch.update(cardRef, { "neededCardsData.order": now + idx });
                });
                await batch.commit();
            });

            const displayImg = card.imageUrl ? card.imageUrl : "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
            const displayName = card.name ? card.name : "<span style='color:#ccc'>(未命名)</span>";
            const displayId = card.id ? `# ${card.id}` : "<span style='color:#ccc'>(無編號)</span>";
            const qty = card.neededCardsData?.quantity || 1;

            cardEl.innerHTML = `
                <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
                <div class="card-info">
                    <strong>${displayName}</strong>
                    ${displayId}
                    <div class="qty-control">
                        <button class="qty-btn qty-minus" title="減少數量">-</button>
                        <span class="qty-number">${qty}</span>
                        <button class="qty-btn qty-plus" title="增加數量">+</button>
                    </div>
                </div>
                <button class="del-card-btn" title="刪除卡片">✕</button>
                <button class="copy-card-btn" title="複製卡片">📄</button>
                <button class="view-card-btn" title="放大預覽">🔍</button>
            `;

            cardEl.querySelector('.qty-minus').addEventListener('click', async (e) => { e.stopPropagation(); const newQty = Math.max(1, qty - 1); if(newQty !== qty) { await updateDoc(doc(db, "ptcg_cards", card.docId), { "neededCardsData.quantity": newQty }); } });
            cardEl.querySelector('.qty-plus').addEventListener('click', async (e) => { e.stopPropagation(); await updateDoc(doc(db, "ptcg_cards", card.docId), { "neededCardsData.quantity": qty + 1 }); });
            cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("確定要從雲端刪除這張卡片嗎？")) await deleteDoc(doc(db, "ptcg_cards", card.docId)); });
            cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); await handleSafeCopyCard(card); });
            cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
            cardEl.addEventListener('click', () => openEditModal(card.docId));
            cardsListDiv.appendChild(cardEl);
        });

        const inlineAddBtn = document.createElement("div");
        inlineAddBtn.className = "add-new-card-box";
        inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
        inlineAddBtn.addEventListener("click", () => openNewModal(rarity.name, null));
        cardsListDiv.appendChild(inlineAddBtn);

        rowBlock.appendChild(cardsListDiv);
        makeRarityBlockCollapsible(rowBlock, `needed_cards:${currentNeededTab}:${rarity.name}`);
        rarityRowsContainerNeeded.appendChild(rowBlock);
    });
}

// --- 渲染：24H 得卡挑戰 ---
function render24hRows() {
    rarityRowsContainer24h.innerHTML = "";
    const versionTabs = getChallenge24hVersionTabs();
    if (!versionTabs.some(tab => tab.id === active24hVersionTabId)) {
        active24hVersionTabId = versionTabs[0]?.id || DEFAULT_24H_VERSION_TAB_ID;
    }
    renderChallenge24hTabs(versionTabs);
    rarities24h.forEach(rarity => {
        const targetCards = cardsData.filter(c =>
            c.section === "24h"
            && getChallenge24hCardVersionTabId(c) === active24hVersionTabId
            && c.rarity === rarity.name
        );
        const ownedCount = targetCards.filter(c => c.computedOwnership === "取得").length;
        
        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";
        rowBlock.innerHTML = `
            <div class="rarity-header">
                <img src="${rarity.icon}" alt="${rarity.name}">
                <span>${rarity.name} <span class="rarity-count">${ownedCount} / ${targetCards.length}</span></span>
            </div>
        `;

        const cardsListDiv = document.createElement("div");
        cardsListDiv.className = "cards-horizontal-list";
        cardsListDiv.style.padding = "15px";
        cardsListDiv.style.backgroundColor = "#fafafa";
        cardsListDiv.style.borderRadius = "8px";
        cardsListDiv.style.border = "1px solid #e8e8e8";

        targetCards.sort((a, b) => (a.id || "").localeCompare(b.id || "")).forEach(card => {
            const cardEl = document.createElement("div");
            cardEl.className = "card-box";
            
            let ownershipState = card.computedOwnership;
            let autoBgColor = "#FFB7B2"; 
            if (ownershipState === "取得") autoBgColor = "#D2EEA5"; 
            else if (ownershipState === "小帳" || ownershipState === "資源帳") autoBgColor = "#FFFFBE"; 
            cardEl.style.backgroundColor = autoBgColor;

            const displayImg = card.imageUrl ? card.imageUrl : "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
            const displayName = card.name ? card.name : "<span style='color:#ccc'>(未命名)</span>";
            const displayId = card.id ? `# ${card.id}` : "<span style='color:#ccc'>(無編號)</span>";

            cardEl.innerHTML = `
                <button class="toggle-main-btn" title="切換取得狀態">🔄</button>
                <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
                <div class="card-info">
                    <strong>${displayName}</strong>
                    ${displayId}
                    <div style="margin-top: 6px; font-weight: bold; color: #555; padding-top: 4px; border-top: 1px dashed #ccc;">
                        狀態: ${ownershipState}
                    </div>
                </div>
                <button class="del-card-btn" title="刪除卡片">✕</button>
                <button class="copy-card-btn" title="複製卡片">📄</button>
                <button class="view-card-btn" title="放大預覽">🔍</button>
            `;

            cardEl.querySelector('.toggle-main-btn').addEventListener('click', async (e) => { e.stopPropagation(); const newOwnership = (ownershipState === "取得") ? "無" : "取得"; await updateDoc(doc(db, "ptcg_cards", card.docId), { "challenge24hData.ownership": newOwnership, "section": "24h" }); });
            cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("確定要刪除？")) await deleteDoc(doc(db, "ptcg_cards", card.docId)); });
            cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); await handleSafeCopyCard(card); });
            cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
            cardEl.addEventListener('click', () => openEditModal(card.docId));
            cardsListDiv.appendChild(cardEl);
        });

        const inlineAddBtn = document.createElement("div");
        inlineAddBtn.className = "add-new-card-box";
        inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
        inlineAddBtn.addEventListener("click", () => openNewModal(rarity.name, null));
        cardsListDiv.appendChild(inlineAddBtn);

        rowBlock.appendChild(cardsListDiv);
        makeRarityBlockCollapsible(rowBlock, `24h:${active24hVersionTabId}:${rarity.name}`);
        rarityRowsContainer24h.appendChild(rowBlock);
    });
}

// --- 渲染：小帳資源 ---
function renderAltAccRows() {
    rarityRowsContainerAlt.innerHTML = "";
    raritiesAlt.forEach(rarity => {
        const targetCards = cardsData.filter(c => c.section === "alt_acc" && c.altAccData?.accountType === currentAccountTab && c.rarity === rarity.name);
        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";
        rowBlock.innerHTML = `<div class="rarity-header"><img src="${rarity.icon}"><span>${rarity.name} <span class="rarity-count">${getCardsQuantityTotal(targetCards)}</span></span></div>`;
        createHorizontalRowAlt(rowBlock, targetCards, "false", "主帳沒有的", "not-on-main", rarity.name);
        createHorizontalRowAlt(rowBlock, targetCards, "true", "主帳有的", "on-main", rarity.name);
        makeRarityBlockCollapsible(rowBlock, `alt_acc:${currentAccountTab}:${rarity.name}`);
        rarityRowsContainerAlt.appendChild(rowBlock);
    });
}

function createHorizontalRowAlt(parentBlock, cards, hasMainVal, labelText, className, rarityName) {
    const statusRow = document.createElement("div");
    statusRow.className = `status-row ${className}`;
    statusRow.innerHTML = `<div class="status-label">${labelText}</div>`;

    const cardsListDiv = document.createElement("div");
    cardsListDiv.className = "cards-horizontal-list";

    const filteredAndSorted = cards.filter(c => c.altAccData?.hasOnMain === hasMainVal).sort((a, b) => (a.id||"").localeCompare(b.id||""));

    filteredAndSorted.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "card-box";
        cardEl.style.backgroundColor = card.bgColor || "#ffffff";

        const displayImg = card.imageUrl ? card.imageUrl : "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
        const displayName = card.name ? card.name : "<span style='color:#ccc'>(未命名)</span>";
        const displayId = card.id ? `# ${card.id}` : "<span style='color:#ccc'>(無編號)</span>";
        const qty = getCardQuantity(card);

        cardEl.innerHTML = `
            <button class="toggle-main-btn" title="切換主帳狀態">🔄</button>
            <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            <div class="card-info">
                <strong>${displayName}</strong>
                ${displayId}
                ${renderQtyControl(qty)}
            </div>
            <button class="del-card-btn" title="刪除卡片">✕</button>
            <button class="copy-card-btn" title="複製卡片">📄</button>
            <button class="view-card-btn" title="放大預覽">🔍</button>
        `;

        bindQtyControl(cardEl, card, "altAccData.quantity", qty);
        cardEl.querySelector('.toggle-main-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const newStatus = (card.altAccData?.hasOnMain === "true") ? "false" : "true";
            await updateDoc(doc(db, "ptcg_cards", card.docId), {
                altAccData: {
                    ...(card.altAccData || {}),
                    accountType: card.altAccData?.accountType || "小帳",
                    hasOnMain: newStatus,
                    quantity: getCardQuantity(card)
                },
                section: "alt_acc"
            });
        });
        cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("確定要刪除？")) await deleteDoc(doc(db, "ptcg_cards", card.docId)); });
        cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); await handleSafeCopyCard(card); });
        cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
        cardEl.addEventListener('click', () => openEditModal(card.docId));
        cardsListDiv.appendChild(cardEl);
    });

    const inlineAddBtn = document.createElement("div");
    inlineAddBtn.className = "add-new-card-box";
    inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
    inlineAddBtn.addEventListener("click", () => openNewModal(rarityName, null, hasMainVal));
    cardsListDiv.appendChild(inlineAddBtn);

    statusRow.appendChild(cardsListDiv);
    parentBlock.appendChild(statusRow);
}

// ==========================================
// Modal 表單控制 (單卡)
// ==========================================
function updateTierFieldVisibility() {
    const rarityVal = document.getElementById("card-rarity").value;
    const groupTier = document.getElementById("group-two-star-tier");
    if ((currentSection === "alt_acc" || currentSection === "two_star_cards") && rarityVal === "2星") {
        groupTier.style.display = "flex";
    } else {
        groupTier.style.display = "none";
    }
}

function updateHighRarityTypeVisibility() {
    if (currentSection !== "two_star_cards") return;
    const selectedTab = document.getElementById("card-two-star-tab").value;
    const rarityVal = document.getElementById("card-rarity").value;
    document.getElementById("group-two-star-status").style.display = selectedTab === "擁有的卡" ? "flex" : "none";
    document.getElementById("group-two-star-type").style.display =
        selectedTab !== "擁有的卡" && rarityVal === "2星" ? "flex" : "none";
    document.getElementById("group-traded-card").style.display = selectedTab === "被交換的" ? "flex" : "none";
}

function setupModalFields() {
    const groupAccType = document.getElementById("group-acc-type");
    const groupHasMain = document.getElementById("group-has-main");
    const groupOwnership = document.getElementById("group-ownership");
    const groupNeededQty = document.getElementById("group-needed-qty");
    const groupNeededTab = document.getElementById("group-needed-tab");
    
    const groupRarity = document.getElementById("group-rarity");
    const groupGeneralType = document.getElementById("group-general-type");
    const groupGeneralSubtype = document.getElementById("group-general-subtype");
    const groupGeneralTag = document.getElementById("group-general-tag");

    const groupTwoStarTab = document.getElementById("group-two-star-tab");
    const groupTwoStarStatus = document.getElementById("group-two-star-status");
    const groupTwoStarType = document.getElementById("group-two-star-type");
    const groupTwoStarTier = document.getElementById("group-two-star-tier");
    const groupTradedCard = document.getElementById("group-traded-card");

    [groupAccType, groupHasMain, groupOwnership, groupNeededQty, groupNeededTab, groupGeneralType, groupGeneralSubtype, groupGeneralTag, groupTwoStarTab, groupTwoStarStatus, groupTwoStarType, groupTwoStarTier, groupTradedCard].forEach(g => g.style.display = "none");
    
    groupRarity.style.display = "flex"; 

    if (currentSection === "24h") {
        groupOwnership.style.display = "flex";
    } else if (currentSection === "needed_cards") {
        groupNeededQty.style.display = "flex";
        groupNeededTab.style.display = "flex";
    } else if (currentSection === "general_cards") {
        groupRarity.style.display = "none";
        groupGeneralType.style.display = "flex";
        groupGeneralSubtype.style.display = "flex"; 
        groupGeneralTag.style.display = "flex";
        renderGeneralTagList();
    } else if (currentSection === "two_star_cards") {
        groupTwoStarTab.style.display = "flex";
        updateHighRarityTypeVisibility();
    } else { 
        groupAccType.style.display = "flex";
        groupHasMain.style.display = "flex";
    }
}

document.getElementById("card-rarity").addEventListener("change", () => {
    updateTierFieldVisibility();
    updateHighRarityTypeVisibility();
    if (tradedCardAutocompleteList?.classList.contains("show")) {
        renderTradedCardAutocomplete(tradedCardNameInput?.value.trim() || "");
    }
});

generalTagNameInput.addEventListener("focus", showGeneralTagOptions);
generalTagNameInput.addEventListener("click", showGeneralTagOptions);
generalTagNameInput.addEventListener("input", () => {
    syncGeneralTagColorFromName();
    showGeneralTagOptions();
});
generalTagNameInput.addEventListener("change", syncGeneralTagColorFromName);
document.getElementById("card-general-type").addEventListener("change", () => {
    generalTagNameInput.value = "";
    generalTagColorInput.value = "#787774";
    hideGeneralTagColorPopover();
    renderGeneralTagList();
    if (generalTagList.classList.contains("show")) showGeneralTagOptions();
});
document.getElementById("group-general-tag").addEventListener("click", (event) => event.stopPropagation());
generalTagColorPopover.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", (event) => {
    if (!document.getElementById("group-general-tag").contains(event.target)
        && !generalTagColorPopover.contains(event.target)) {
        hideGeneralTagOptions();
    }
});

cardForm.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.isComposing) return;
    if (event.target.tagName === "TEXTAREA") return;
    if (autocompleteList.classList.contains("show")) return;
    if (tradedCardAutocompleteList?.classList.contains("show")) return;
    event.preventDefault();
    cardForm.requestSubmit();
});

function openNewModal(rarityName, typeName = null, hasMainVal = null) {
    editingCardDocId = null; 
    cardAutocompleteContext = getAutocompleteContextForCardForm(rarityName, typeName);
    modalTitle.innerText = "➕ 新增卡片資料";
    cardForm.reset(); 
    setupModalFields();

    document.getElementById("card-acc-type").value = currentAccountTab;
    if (rarityName) document.getElementById("card-rarity").value = rarityName;
    if (typeName) document.getElementById("card-general-type").value = typeName;
    if (hasMainVal !== null) {
        document.getElementById("card-has-main").value = hasMainVal;
        document.getElementById("card-general-subtype").value = hasMainVal; 
    }
    
    document.getElementById("card-ownership").value = "無"; 
    document.getElementById("card-needed-qty").value = "1"; 
    document.getElementById("card-needed-tab").value = currentNeededTab; 
    generalTagNameInput.value = "";
    generalTagColorInput.value = "#787774";
    renderGeneralTagList();
    clearTradedCardForm();
    
    document.getElementById("card-two-star-tab").value = currentTwoStarTab;
    document.getElementById("card-two-star-tier").value = "無"; 
    
    if (currentSection === "two_star_cards") {
        if (currentTwoStarTab === "擁有的卡" && typeName) document.getElementById("card-two-star-status").value = typeName;
        if ((currentTwoStarTab === "想要的卡" || currentTwoStarTab === "被交換的") && typeName) document.getElementById("card-two-star-type").value = typeName;
    }

    document.getElementById("card-bgcolor").value = "#ffffff";
    colorSwatches.forEach(s => s.classList.remove("selected"));
    colorSwatches[0].classList.add("selected");

    updateTierFieldVisibility();
    updateHighRarityTypeVisibility();
    formModal.classList.add("show");
}

function openEditModal(docId) {
    const card = cardsData.find(c => c.docId === docId);
    if (card) {
        editingCardDocId = docId; 
        cardAutocompleteContext = getAutocompleteContextForExistingCard(card);
        modalTitle.innerText = "✏️ 編輯卡片資料"; 
        
        document.getElementById("card-name").value = card.name || "";
        document.getElementById("card-id").value = card.id || "";
        document.getElementById("card-img").value = card.imageUrl || "";
        document.getElementById("card-rarity").value = card.rarity || "1星";
        
        document.getElementById("card-acc-type").value = card.altAccData?.accountType || "小帳";
        
        if (card.section === "general_cards") {
            document.getElementById("card-general-subtype").value = card.generalData?.hasOnMain || "false";
        } else {
            document.getElementById("card-has-main").value = card.altAccData?.hasOnMain || "false";
        }

        document.getElementById("card-ownership").value = card.challenge24hData?.ownership || "無";
        document.getElementById("card-needed-qty").value = card.neededCardsData?.quantity || "1";
        document.getElementById("card-needed-tab").value = card.neededCardsData?.tab || "缺少的卡";
        document.getElementById("card-general-type").value = card.generalData?.type || "支援者";
        generalTagNameInput.value = card.generalData?.tagName || "";
        generalTagColorInput.value = getGeneralTagColorMeta(card.generalData?.tagColor).value;
        renderGeneralTagList();
        
        document.getElementById("card-two-star-tab").value = card.twoStarData?.tab || "擁有的卡";
        document.getElementById("card-two-star-status").value = card.twoStarData?.status || "主帳";
        document.getElementById("card-two-star-type").value = card.twoStarData?.type || "支援者";
        document.getElementById("card-two-star-tier").value = card.twoStarData?.tier || "無";
        fillTradedCardForm(card.twoStarData?.tradedCard || {});

        const originalSection = currentSection; 
        currentSection = card.section || "alt_acc";
        setupModalFields();
        currentSection = originalSection; 

        const cardBg = card.bgColor || "#ffffff";
        colorInput.value = cardBg;
        colorSwatches.forEach(s => s.classList.remove("selected"));
        const matchSwatch = Array.from(colorSwatches).find(s => s.getAttribute("data-color").toUpperCase() === cardBg.toUpperCase());
        if (matchSwatch) matchSwatch.classList.add("selected");

        updateTierFieldVisibility();
        updateHighRarityTypeVisibility();
        formModal.classList.add("show");
    }
}

cardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = cardForm.querySelector('button[type="submit"]');
    submitBtn.innerText = "⏳ 儲存中...";
    submitBtn.disabled = true;

    let saveSection = currentSection;
    if (editingCardDocId) {
        const existingCard = cardsData.find(c => c.docId === editingCardDocId);
        if (existingCard) saveSection = existingCard.section || "alt_acc";
    }

    const rarityInput = document.getElementById("card-rarity").value;

    const cardObj = {
        name: document.getElementById("card-name").value.trim(),
        id: document.getElementById("card-id").value.trim(),
        imageUrl: document.getElementById("card-img").value.trim(),
        rarity: rarityInput,
        bgColor: document.getElementById("card-bgcolor").value,
        section: saveSection 
    };

    if (saveSection === "24h") {
        const existing24hCard = editingCardDocId ? cardsData.find(c => c.docId === editingCardDocId) : null;
        cardObj.challenge24hData = {
            ownership: document.getElementById("card-ownership").value,
            versionTabId: existing24hCard?.challenge24hData?.versionTabId || active24hVersionTabId
        };
    } else if (saveSection === "needed_cards") {
        const currentQty = parseInt(document.getElementById("card-needed-qty").value) || 1;
        cardObj.neededCardsData = { 
            quantity: currentQty,
            tab: document.getElementById("card-needed-tab").value,
            order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.neededCardsData?.order || Date.now()) : Date.now()
        };
    } else if (saveSection === "general_cards") {
        const tagName = generalTagNameInput.value.trim();
        cardObj.generalData = {
            type: document.getElementById("card-general-type").value,
            hasOnMain: document.getElementById("card-general-subtype").value,
            tagName,
            tagColor: tagName ? generalTagColorInput.value : "",
            order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.generalData?.order || Date.now()) : Date.now()
        };
        cardObj.rarity = ""; 
    } else if (saveSection === "two_star_cards") {
        const existingQty = editingCardDocId ? getCardQuantity(cardsData.find(c => c.docId === editingCardDocId) || {}) : 1;
        cardObj.twoStarData = {
            tab: document.getElementById("card-two-star-tab").value,
            status: document.getElementById("card-two-star-status").value,
            tier: rarityInput === "2星" ? document.getElementById("card-two-star-tier").value : "無", 
            quantity: existingQty,
            order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.twoStarData?.order || Date.now()) : Date.now()
        };
        if (cardObj.twoStarData.tab === "擁有的卡" || rarityInput === "2星") {
            cardObj.twoStarData.type = document.getElementById("card-two-star-type").value;
        }
        if (cardObj.twoStarData.tab === "被交換的") {
            const tradedCard = getTradedCardFromForm();
            if (tradedCard.name || tradedCard.id || tradedCard.imageUrl) {
                cardObj.twoStarData.tradedCard = tradedCard;
            }
        }
    } else {
        const existingQty = editingCardDocId ? getCardQuantity(cardsData.find(c => c.docId === editingCardDocId) || {}) : 1;
        cardObj.altAccData = {
            accountType: document.getElementById("card-acc-type").value,
            hasOnMain: document.getElementById("card-has-main").value,
            quantity: existingQty
        };
        if (highRarityNames.has(rarityInput)) {
            cardObj.twoStarData = {
                tab: "擁有的卡", 
                status: document.getElementById("card-acc-type").value,
                type: document.getElementById("card-two-star-type").value || "支援者",
                tier: rarityInput === "2星" ? document.getElementById("card-two-star-tier").value : "無",
                quantity: existingQty,
                order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.twoStarData?.order || Date.now()) : Date.now()
            };
        }
    }
    
    let savedDocId = editingCardDocId;
    const syncHighRarityToAltAcc = shouldSyncHighRarityToAltAcc(saveSection, rarityInput);
    if (syncHighRarityToAltAcc) {
        const existingAltCard = findMatchingAltAccHighRarityCard(
            cardObj,
            cardObj.twoStarData.status,
            editingCardDocId
        );
        const altAccPayload = buildAltAccPayloadFromHighRarity(cardObj, cardObj.twoStarData, existingAltCard);
        if (existingAltCard) {
            await updateDoc(doc(db, "ptcg_cards", existingAltCard.docId), altAccPayload);
            savedDocId = existingAltCard.docId;
        } else {
            const newDoc = await addDoc(cardsCollection, altAccPayload);
            savedDocId = newDoc.id;
        }

        if (editingCardDocId) {
            const existingCard = cardsData.find(c => c.docId === editingCardDocId);
            if (existingCard?.section === "two_star_cards") {
                await deleteDoc(doc(db, "ptcg_cards", editingCardDocId));
            }
        }
    } else if (editingCardDocId) {
        await updateDoc(doc(db, "ptcg_cards", editingCardDocId), cardObj);
    } else {
        const newDoc = await addDoc(cardsCollection, cardObj);
        savedDocId = newDoc.id;
    }

    if (saveSection === "general_cards" && cardObj.generalData?.tagName) {
        await syncSharedGeneralTagColor(cardObj.generalData.tagName, cardObj.generalData.tagColor, cardObj.generalData.type, savedDocId);
    }

    formModal.classList.remove("show");
    submitBtn.innerText = "儲存";
    submitBtn.disabled = false;
});

// ==========================================
// 🪄 建立/編輯牌組 (Deck Form) 邏輯
// ==========================================
deckForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = deckForm.querySelector('button[type="submit"]');
    submitBtn.innerText = "⏳ 儲存中...";
    submitBtn.disabled = true;

    const existingDeck = editingDeckDocId ? cardsData.find(c => c.docId === editingDeckDocId) : null;
    const selectedLobbyTabId = document.getElementById("deck-version").value || activeMetaLobbyTabId;
    const coverCard = {
        name: document.getElementById("deck-cover-card-name").value.trim(),
        img: document.getElementById("deck-img").value.trim()
    };
    const deckData = {
        name: document.getElementById("deck-name").value.trim(),
        version: getMetaLobbyTabName(selectedLobbyTabId),
        coverCard,
        coverName: coverCard.name,
        coverImg: coverCard.img,
        tier: document.getElementById("deck-tier").value,
        attribute: document.getElementById("deck-attribute").value,
        cards: cloneDeckCards(existingDeck?.deckData?.cards || []), 
        order: existingDeck?.deckData?.order || Date.now(),
        lobbyTabId: selectedLobbyTabId
    };
    if (existingDeck?.deckData?.tabs) {
        deckData.tabs = cloneDeckTabs(existingDeck.deckData.tabs);
    } else if (!editingDeckDocId) {
        deckData.cards = buildDefaultNewDeckCards();
        deckData.tabs = buildDefaultNewDeckTabs(deckData);
    }
    
    if (editingDeckDocId) {
        await updateDoc(doc(db, "ptcg_cards", editingDeckDocId), {
            section: "meta_deck",
            deckData
        });
    } else {
        await addDoc(cardsCollection, {
            section: "meta_deck",
            deckData
        });
    }
    
    deckFormModal.classList.remove("show");
    editingDeckDocId = null;
    document.getElementById("deck-modal-title").innerText = "➕ 新增 Meta 牌組";
    submitBtn.innerText = "儲存牌組";
    submitBtn.disabled = false;
});

// ==========================================
// 🪄 在牌組內加入單卡 (Deck Card Form) 邏輯
// ==========================================
deckCardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeMetaDeckId) return;

    const submitBtn = deckCardForm.querySelector('button[type="submit"]');
    submitBtn.innerText = "⏳ 儲存中...";
    submitBtn.disabled = true;

    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    if (deck) {
        const newCard = {
            name: document.getElementById("deck-card-name").value.trim(),
            id: document.getElementById("deck-card-id").value.trim(),
            img: document.getElementById("deck-card-img").value.trim(),
            rarity: document.getElementById("deck-card-rarity").value.trim(),
            type: getDeckCardType(document.getElementById("deck-card-type").value),
            qty: getDeckCardQuantity(),
            bgColor: deckColorInput?.value || "#ffffff"
        };

        const { tabs, activeTab } = getActiveDeckTab(deck);
        const updatedCards = activeTab.cards ? [...activeTab.cards] : [];
        if (editingDeckCardIndex === null) {
            updatedCards.push(newCard);
        } else {
            updatedCards[editingDeckCardIndex] = newCard;
        }

        const updatedTabs = tabs.map(tab => tab.id === activeTab.id ? { ...tab, cards: updatedCards } : tab);
        await saveDeckTabs(deck, updatedTabs);
    }

    deckCardFormModal.classList.remove("show");
    editingDeckCardIndex = null;
    document.querySelector("#deck-card-form-modal h2").innerText = "➕ 放入卡牌至牌組";
    submitBtn.innerText = "加入牌組";
    submitBtn.disabled = false;
});

deckImportForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    if (!deck) return;

    const { tabs, activeTab } = getActiveDeckTab(deck);
    const importText = document.getElementById("deck-import-text").value;
    const shouldReplace = document.getElementById("deck-import-replace").checked;
    const { importedCards, unmatchedLines } = parseDeckImportText(importText);

    if (!importedCards.length) {
        alert(`沒有成功解析到可匯入的卡片。${unmatchedLines.length ? `\n\n未匹配：\n${unmatchedLines.join("\n")}` : ""}`);
        return;
    }

    const nextCards = shouldReplace
        ? importedCards
        : [...cloneDeckCards(activeTab.cards || []), ...importedCards];
    const updatedTabs = tabs.map(tab => tab.id === activeTab.id ? { ...tab, cards: nextCards } : tab);
    await saveDeckTabs(deck, updatedTabs);

    deckImportFormModal.classList.remove("show");
    const message = [`已匯入 ${importedCards.length} 張卡片。`];
    if (unmatchedLines.length) {
        message.push(`\n以下 ${unmatchedLines.length} 行未匯入：`);
        message.push(unmatchedLines.join("\n"));
    }
    alert(message.join("\n"));
});

deckCoverForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    if (!deck) return;

    const { tabs, activeTab } = getActiveDeckTab(deck);
    const coverCard = {
        name: document.getElementById("deck-cover-name").value.trim(),
        img: document.getElementById("deck-cover-img").value.trim()
    };

    const updatedTabs = tabs.map(tab => tab.id === activeTab.id
        ? { ...tab, coverCard, coverImg: coverCard.img }
        : tab
    );
    await saveDeckTabs(deck, updatedTabs);
    deckCoverFormModal.classList.remove("show");
});

document.getElementById("add-second-source-card").addEventListener("click", () => {
    if (!editingReplacementContext) return;
    editingReplacementContext = {
        groupId: editingReplacementContext.groupId,
        role: "source",
        alternativeIndex: null
    };
    deckReplacementForm.reset();
    setDeckReplacementQuantity(1);
    document.getElementById("deck-replacement-modal-title").innerText = "➕ 新增基準卡";
    document.getElementById("add-second-source-card").style.display = "none";
    document.getElementById("deck-replacement-name").focus();
});

deckReplacementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const deck = cardsData.find(c => c.docId === activeMetaDeckId);
    if (!deck || !editingReplacementContext) return;

    const card = {
        name: document.getElementById("deck-replacement-name").value.trim(),
        img: document.getElementById("deck-replacement-img").value.trim(),
        qty: getDeckReplacementQuantity()
    };
    const { tabs, activeTab } = getActiveDeckTab(deck);
    const replacements = cloneDeckReplacements(activeTab.replacements || []);
    let group = replacements.find(item => item.id === editingReplacementContext.groupId);

    if (!group && editingReplacementContext.role === "source") {
        group = { id: editingReplacementContext.groupId, sources: [], alternatives: [] };
        replacements.push(group);
    }
    if (!group) return;

    if (editingReplacementContext.role === "source") {
        group.sources = getReplacementSources(group);
        if (editingReplacementContext.alternativeIndex === null) {
            if (group.sources.length < 3) group.sources.push(card);
        } else {
            group.sources[editingReplacementContext.alternativeIndex] = card;
        }
        delete group.source;
    } else if (editingReplacementContext.alternativeIndex === null) {
        if (group.alternatives.length < 3) group.alternatives.push(card);
    } else {
        group.alternatives[editingReplacementContext.alternativeIndex] = card;
    }

    const updatedTabs = tabs.map(tab => tab.id === activeTab.id ? { ...tab, replacements } : tab);
    await saveDeckTabs(deck, updatedTabs);
    editingReplacementContext = null;
    deckReplacementFormModal.classList.remove("show");
});

// ==========================================
// 快速修改評級 (Mini Modal) 邏輯
// ==========================================
let quickTierCardDocId = null;
const quickTierModal = document.getElementById('quick-tier-modal');
document.getElementById('close-quick-tier-modal').addEventListener('click', () => quickTierModal.classList.remove('show'));

document.querySelectorAll('.tier-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if (!quickTierCardDocId) return;
        const selectedTier = e.target.getAttribute('data-tier');
        const targetCard = cardsData.find(c => c.docId === quickTierCardDocId);
        
        if (targetCard) {
            let updatePayload = { "twoStarData.tier": selectedTier };
            
            if (targetCard.section === "alt_acc") {
                updatePayload = {
                    "twoStarData.tier": selectedTier,
                    "twoStarData.tab": targetCard.twoStarData?.tab || "擁有的卡",
                    "twoStarData.status": targetCard.altAccData?.accountType || "小帳",
                    "twoStarData.type": targetCard.twoStarData?.type || "支援者",
                    "twoStarData.quantity": getCardQuantity(targetCard),
                    "twoStarData.order": targetCard.twoStarData?.order || Date.now()
                };
            }
            await updateDoc(doc(db, "ptcg_cards", quickTierCardDocId), updatePayload);
        }
        quickTierModal.classList.remove('show');
        quickTierCardDocId = null;
    });
});

// ==========================================
// UI 元件事件綁定
// ==========================================
colorSwatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
        colorSwatches.forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
        colorInput.value = swatch.getAttribute("data-color");
    });
});

deckColorSwatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
        deckColorSwatches.forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
        deckColorInput.value = swatch.getAttribute("data-color");
    });
});

// 🪄 單卡建檔表單的智慧圖片選單
const cardNameInput = document.getElementById("card-name");
const autocompleteList = document.getElementById("custom-autocomplete-list");

function renderAutocomplete(filterText = "") {
    autocompleteList.innerHTML = "";
    const matchedCards = getAutocompleteMatches(filterText, cardAutocompleteContext);
    
    if (matchedCards.length === 0) {
        autocompleteList.classList.remove('show');
        return;
    }

    matchedCards.forEach(({ name, data: dictData }) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "autocomplete-item";
        
        const imgUrl = dictData.imageUrl ? dictData.imageUrl : "https://placehold.co/60x84/eaeaea/999999?text=X";
        const displayId = dictData.id ? `#${dictData.id}` : "(無編號)";

        itemDiv.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div class="ac-details">
                <span class="ac-name">${name}</span>
                <span class="ac-id">${displayId}</span>
            </div>
        `;

        itemDiv.addEventListener("click", () => {
            cardNameInput.value = name;
            
            const idInput = document.getElementById("card-id");
            const imgInput = document.getElementById("card-img");

            if (dictData.id && idInput.value === "") idInput.value = dictData.id;
            if (dictData.imageUrl && imgInput.value === "") imgInput.value = dictData.imageUrl;

            const rarityInput = document.getElementById("card-rarity");
            if (dictData.rarity && document.getElementById("group-rarity").style.display !== "none") {
                rarityInput.value = dictData.rarity;
                updateTierFieldVisibility(); 
            }

            const cardBg = dictData.bgColor || "#ffffff";
            document.getElementById("card-bgcolor").value = cardBg;
            colorSwatches.forEach(s => s.classList.remove("selected"));
            const matchSwatch = Array.from(colorSwatches).find(s => s.getAttribute("data-color").toUpperCase() === cardBg.toUpperCase());
            if (matchSwatch) matchSwatch.classList.add("selected");

            autocompleteList.classList.remove('show');
            cardForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        });

        autocompleteList.appendChild(itemDiv);
    });
    autocompleteList.classList.add('show');
}

cardNameInput.addEventListener("input", (e) => renderAutocomplete(e.target.value.trim()));
cardNameInput.addEventListener("focus", (e) => renderAutocomplete(e.target.value.trim()));

const tradedCardNameInput = document.getElementById("card-traded-name");
const tradedCardAutocompleteList = document.getElementById("traded-card-autocomplete-list");
const tradedCardPreview = document.getElementById("traded-card-preview");

function updateTradedCardPreview() {
    if (!tradedCardPreview) return;
    const tradedCard = getTradedCardFromForm();
    const imageUrl = tradedCard.imageUrl || "";

    if (!tradedCard.name && !tradedCard.id && !imageUrl) {
        tradedCardPreview.classList.remove("show");
        tradedCardPreview.innerHTML = "";
        return;
    }

    const displayImg = imageUrl || "https://placehold.co/60x84/eaeaea/999999?text=X";
    const displayName = tradedCard.name || "(未命名)";
    const displayId = tradedCard.id ? `#${tradedCard.id}` : "(無編號)";
    tradedCardPreview.innerHTML = `
        <img src="${displayImg}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
        <div>
            <strong>${displayName}</strong>
            <span>${displayId}</span>
        </div>
    `;
    tradedCardPreview.classList.add("show");
}

function clearTradedCardForm() {
    if (tradedCardNameInput) tradedCardNameInput.value = "";
    document.getElementById("card-traded-id").value = "";
    document.getElementById("card-traded-img").value = "";
    if (tradedCardAutocompleteList) {
        tradedCardAutocompleteList.classList.remove("show");
        tradedCardAutocompleteList.innerHTML = "";
    }
    updateTradedCardPreview();
}

function fillTradedCardForm(card = {}) {
    if (tradedCardNameInput) tradedCardNameInput.value = card.name || "";
    document.getElementById("card-traded-id").value = card.id || "";
    document.getElementById("card-traded-img").value = card.imageUrl || card.img || "";
    updateTradedCardPreview();
}

function getTradedCardAutocompleteContext() {
    const rarity = document.getElementById("card-rarity")?.value;
    return rarity ? { rarities: [rarity] } : null;
}

function renderTradedCardAutocomplete(filterText = "") {
    if (!tradedCardAutocompleteList || !tradedCardNameInput) return;
    tradedCardAutocompleteList.innerHTML = "";
    const matchedCards = getAutocompleteMatches(filterText, getTradedCardAutocompleteContext());

    if (matchedCards.length === 0) {
        tradedCardAutocompleteList.classList.remove("show");
        return;
    }

    matchedCards.forEach(({ name, data: dictData }) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "autocomplete-item";
        const imgUrl = dictData.imageUrl || "https://placehold.co/60x84/eaeaea/999999?text=X";
        const displayId = dictData.id ? `#${dictData.id}` : "(無編號)";
        itemDiv.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div class="ac-details">
                <span class="ac-name">${name}</span>
                <span class="ac-id">${displayId}</span>
            </div>
        `;
        itemDiv.addEventListener("mousedown", (event) => {
            event.preventDefault();
            fillTradedCardForm({
                name,
                id: dictData.id || "",
                imageUrl: dictData.imageUrl || ""
            });
            tradedCardAutocompleteList.classList.remove("show");
            tradedCardAutocompleteList.innerHTML = "";
        });
        tradedCardAutocompleteList.appendChild(itemDiv);
    });
    tradedCardAutocompleteList.classList.add("show");
}

tradedCardNameInput?.addEventListener("input", (event) => {
    document.getElementById("card-traded-id").value = "";
    document.getElementById("card-traded-img").value = "";
    updateTradedCardPreview();
    renderTradedCardAutocomplete(event.target.value.trim());
});
tradedCardNameInput?.addEventListener("focus", (event) => renderTradedCardAutocomplete(event.target.value.trim()));

// 🪄 牌組加卡表單的智慧選單
const deckCardNameInput = document.getElementById("deck-card-name");
const deckAutocompleteList = document.getElementById("deck-autocomplete-list");

function renderDeckCardAutocomplete(filterText = "") {
    deckAutocompleteList.innerHTML = "";
    const matchedCards = getAutocompleteMatches(filterText, deckCardAutocompleteContext);
    
    if (matchedCards.length === 0) {
        deckAutocompleteList.classList.remove('show');
        return;
    }

    matchedCards.forEach(({ name, data: dictData }) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "autocomplete-item";
        
        const imgUrl = dictData.imageUrl ? dictData.imageUrl : "https://placehold.co/60x84/eaeaea/999999?text=X";
        const displayId = dictData.id ? `#${dictData.id}` : "(無編號)";

        itemDiv.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div class="ac-details">
                <span class="ac-name">${name}</span>
                <span class="ac-id">${displayId}</span>
            </div>
        `;

        itemDiv.addEventListener("click", () => {
            deckCardNameInput.value = name;
            document.getElementById("deck-card-id").value = dictData.id || "";
            document.getElementById("deck-card-rarity").value = dictData.rarity || "";
            document.getElementById("deck-card-img").value = dictData.imageUrl || "";
            deckAutocompleteList.classList.remove('show');
            
            deckCardForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        });

        deckAutocompleteList.appendChild(itemDiv);
    });
    deckAutocompleteList.classList.add('show');
}

deckCardNameInput.addEventListener("input", (e) => {
    document.getElementById("deck-card-id").value = "";
    document.getElementById("deck-card-rarity").value = "";
    renderDeckCardAutocomplete(e.target.value.trim());
});
deckCardNameInput.addEventListener("focus", (e) => renderDeckCardAutocomplete(e.target.value.trim()));

const deckCoverNameInput = document.getElementById("deck-cover-name");
const deckCoverAutocompleteList = document.getElementById("deck-cover-autocomplete-list");
const deckMainCoverNameInput = document.getElementById("deck-cover-card-name");
const deckMainCoverAutocompleteList = document.getElementById("deck-main-cover-autocomplete-list");

function renderDeckMainCoverAutocomplete(filterText = "") {
    if (!deckMainCoverAutocompleteList || !deckMainCoverNameInput) return;
    deckMainCoverAutocompleteList.innerHTML = "";
    const matchedCards = getAutocompleteMatches(filterText);

    if (matchedCards.length === 0) {
        deckMainCoverAutocompleteList.classList.remove("show");
        return;
    }

    matchedCards.forEach(({ name, data: dictData }) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "autocomplete-item";
        const imgUrl = dictData.imageUrl || "https://placehold.co/60x84/eaeaea/999999?text=X";
        const displayId = dictData.id ? `#${dictData.id}` : "(無編號)";
        itemDiv.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div class="ac-details">
                <span class="ac-name">${name}</span>
                <span class="ac-id">${displayId}</span>
            </div>
        `;
        itemDiv.addEventListener("click", () => {
            deckMainCoverNameInput.value = name;
            document.getElementById("deck-img").value = dictData.imageUrl || "";
            const deckNameInput = document.getElementById("deck-name");
            if (!editingDeckDocId && deckNameInput && deckNameInput.value.trim() === "") {
                deckNameInput.value = name;
            }
            deckMainCoverAutocompleteList.classList.remove("show");
        });
        deckMainCoverAutocompleteList.appendChild(itemDiv);
    });
    deckMainCoverAutocompleteList.classList.add("show");
}

deckMainCoverNameInput?.addEventListener("input", (e) => renderDeckMainCoverAutocomplete(e.target.value.trim()));
deckMainCoverNameInput?.addEventListener("focus", (e) => renderDeckMainCoverAutocomplete(e.target.value.trim()));

function renderDeckCoverAutocomplete(filterText = "") {
    deckCoverAutocompleteList.innerHTML = "";
    const matchedCards = getAutocompleteMatches(filterText);

    if (matchedCards.length === 0) {
        deckCoverAutocompleteList.classList.remove('show');
        return;
    }

    matchedCards.forEach(({ name, data: dictData }) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "autocomplete-item";

        const imgUrl = dictData.imageUrl ? dictData.imageUrl : "https://placehold.co/60x84/eaeaea/999999?text=X";
        const displayId = dictData.id ? `#${dictData.id}` : "(無編號)";

        itemDiv.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div class="ac-details">
                <span class="ac-name">${name}</span>
                <span class="ac-id">${displayId}</span>
            </div>
        `;

        itemDiv.addEventListener("click", () => {
            deckCoverNameInput.value = name;
            document.getElementById("deck-cover-img").value = dictData.imageUrl || "";
            deckCoverAutocompleteList.classList.remove('show');
        });

        deckCoverAutocompleteList.appendChild(itemDiv);
    });
    deckCoverAutocompleteList.classList.add('show');
}

deckCoverNameInput.addEventListener("input", (e) => renderDeckCoverAutocomplete(e.target.value.trim()));
deckCoverNameInput.addEventListener("focus", (e) => renderDeckCoverAutocomplete(e.target.value.trim()));

const deckReplacementNameInput = document.getElementById("deck-replacement-name");
const deckReplacementAutocompleteList = document.getElementById("deck-replacement-autocomplete-list");

function renderDeckReplacementAutocomplete(filterText = "") {
    deckReplacementAutocompleteList.innerHTML = "";
    const matchedCards = getAutocompleteMatches(filterText);
    if (matchedCards.length === 0) {
        deckReplacementAutocompleteList.classList.remove("show");
        return;
    }

    matchedCards.forEach(({ name, data: dictData }) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "autocomplete-item";
        const imgUrl = dictData.imageUrl || "https://placehold.co/60x84/eaeaea/999999?text=X";
        const displayId = dictData.id ? `#${dictData.id}` : "(無編號)";
        itemDiv.innerHTML = `
            <img src="${imgUrl}" onerror="this.src='https://placehold.co/60x84/eaeaea/999999?text=X'">
            <div class="ac-details">
                <span class="ac-name">${name}</span>
                <span class="ac-id">${displayId}</span>
            </div>
        `;
        itemDiv.addEventListener("mousedown", (e) => {
            e.preventDefault();
            deckReplacementNameInput.value = name;
            document.getElementById("deck-replacement-img").value = dictData.imageUrl || "";
            deckReplacementAutocompleteList.classList.remove("show");
            deckReplacementAutocompleteList.innerHTML = "";
            deckReplacementNameInput.blur();
            deckReplacementForm.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        });
        deckReplacementAutocompleteList.appendChild(itemDiv);
    });
    deckReplacementAutocompleteList.classList.add("show");
}

deckReplacementNameInput.addEventListener("input", (e) => renderDeckReplacementAutocomplete(e.target.value.trim()));
deckReplacementNameInput.addEventListener("focus", (e) => renderDeckReplacementAutocomplete(e.target.value.trim()));

// 點擊外面時關閉選單
document.addEventListener("click", (e) => {
    if (!e.target.closest(".deck-tab-wrapper")) closeTabActionMenus();
    if (e.target !== cardNameInput && !autocompleteList.contains(e.target)) autocompleteList.classList.remove('show');
    if (e.target !== deckCardNameInput && !deckAutocompleteList.contains(e.target)) deckAutocompleteList.classList.remove('show');
    if (tradedCardNameInput && e.target !== tradedCardNameInput && !tradedCardAutocompleteList.contains(e.target)) tradedCardAutocompleteList.classList.remove("show");
    if (deckMainCoverNameInput && e.target !== deckMainCoverNameInput && !deckMainCoverAutocompleteList.contains(e.target)) deckMainCoverAutocompleteList.classList.remove('show');
    if (e.target !== deckCoverNameInput && !deckCoverAutocompleteList.contains(e.target)) deckCoverAutocompleteList.classList.remove('show');
    if (e.target !== deckReplacementNameInput && !deckReplacementAutocompleteList.contains(e.target)) deckReplacementAutocompleteList.classList.remove('show');
});

colorInput.addEventListener("input", () => colorSwatches.forEach(s => s.classList.remove("selected")));
deckColorInput?.addEventListener("input", () => deckColorSwatches.forEach(s => s.classList.remove("selected")));

const accTabs = document.querySelectorAll(".acc-tab-btn");
accTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        accTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentAccountTab = tab.getAttribute("data-acc");
        renderAllViews();
    });
});

const neededTabs = document.querySelectorAll(".needed-tab-btn");
neededTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        neededTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentNeededTab = tab.getAttribute("data-needed");
        renderAllViews();
    });
});

const twoStarTabs = document.querySelectorAll(".two-star-tab-btn");
twoStarTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        twoStarTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentTwoStarTab = tab.getAttribute("data-twostar");
        renderAllViews();
    });
});

document.getElementById("card-two-star-tab").addEventListener("change", (e) => {
    updateHighRarityTypeVisibility();
});

const lightboxModal = document.getElementById('lightbox-modal');
document.getElementById('close-modal').addEventListener("click", () => formModal.classList.remove("show"));
document.getElementById('close-deck-modal').addEventListener("click", () => {
    editingDeckDocId = null;
    document.getElementById("deck-modal-title").innerText = "➕ 新增 Meta 牌組";
    deckFormModal.classList.remove("show");
});
document.getElementById('close-deck-card-modal').addEventListener("click", () => {
    editingDeckCardIndex = null;
    document.querySelector("#deck-card-form-modal h2").innerText = "➕ 放入卡牌至牌組";
    deckCardForm.querySelector('button[type="submit"]').innerText = "加入牌組";
    deckCardFormModal.classList.remove("show");
});
document.getElementById('close-deck-cover-modal').addEventListener("click", () => deckCoverFormModal.classList.remove("show"));
document.getElementById('close-deck-replacement-modal').addEventListener("click", () => {
    editingReplacementContext = null;
    deckReplacementFormModal.classList.remove("show");
});
document.getElementById('close-deck-import-modal').addEventListener("click", () => deckImportFormModal.classList.remove("show"));
document.getElementById('lightbox-close').addEventListener('click', () => lightboxModal.classList.remove('show'));

window.addEventListener("click", (e) => { 
    if (e.target === formModal) formModal.classList.remove("show"); 
    if (e.target === deckFormModal) {
        editingDeckDocId = null;
        document.getElementById("deck-modal-title").innerText = "➕ 新增 Meta 牌組";
        deckFormModal.classList.remove("show");
    } 
    if (e.target === deckCardFormModal) {
        editingDeckCardIndex = null;
        document.querySelector("#deck-card-form-modal h2").innerText = "➕ 放入卡牌至牌組";
        deckCardForm.querySelector('button[type="submit"]').innerText = "加入牌組";
        deckCardFormModal.classList.remove("show");
    } 
    if (e.target === deckCoverFormModal) deckCoverFormModal.classList.remove("show"); 
    if (e.target === deckReplacementFormModal) {
        editingReplacementContext = null;
        deckReplacementFormModal.classList.remove("show");
    }
    if (e.target === deckImportFormModal) deckImportFormModal.classList.remove("show");
    if (e.target === lightboxModal) lightboxModal.classList.remove('show');
    if (e.target === quickTierModal) quickTierModal.classList.remove('show');
});

// ==========================================
// 終極即時連線引擎 與 字典產生器
// ==========================================
function setAuthPanelState(user) {
    if (!authUserInfo || !btnGoogleLogin || !btnGoogleLogout) return;

    if (user) {
        authUserInfo.classList.remove("signed-out");
        authUserInfo.classList.add("signed-in");
        authUserInfo.textContent = `已登入：${user.email || "Google 帳號"}`;
        btnGoogleLogin.style.display = "none";
        btnGoogleLogout.style.display = "";
    } else {
        authUserInfo.classList.remove("signed-in");
        authUserInfo.classList.add("signed-out");
        authUserInfo.textContent = "尚未登入，請先使用 Google 登入。";
        btnGoogleLogin.style.display = "";
        btnGoogleLogout.style.display = "none";
    }
}

function setSignedOutMessage() {
    const html = `<p style="text-align:center; color:#d9363e; padding:20px;">請先使用右上角的 Google 登入，登入後資料會自動載入。</p>`;
    [
        rarityRowsContainerAlt,
        rarityRowsContainer24h,
        rarityRowsContainerNeeded,
        rarityRowsContainerGeneral,
        rarityRowsContainerTwoStar
    ].forEach(container => {
        if (container) container.innerHTML = html;
    });
}

function stopFirestoreListeners() {
    if (unsubscribeCardsSnapshot) {
        unsubscribeCardsSnapshot();
        unsubscribeCardsSnapshot = null;
    }
}

rarityRowsContainerAlt.innerHTML = "<p style='text-align:center; color:#888; padding:20px;'>📡 建立即時連線中...</p>";

async function loadCatalogCardsFromJson() {
    try {
        const response = await fetch(cardCatalogJsonUrl, { cache: "default" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

        const cards = await response.json();
        catalogCardsData = Array.isArray(cards)
            ? cards.map((card, index) => ({
                docId: card.docId || card.id || card.cardId || `catalog-${index}`,
                ...card,
                imageUrl: card.imageUrl || card.img || "",
                img: card.img || card.imageUrl || ""
            }))
            : [];

        rebuildUniqueCardsDict(cardsData);
        if (currentSection === "card_catalog") renderCardCatalog();
        if (currentSection === "24h") render24hRows();
    } catch (error) {
        console.error("Catalog JSON load failed:", error);
        catalogCardsData = [];
        rebuildUniqueCardsDict(cardsData);
        if (currentSection === "card_catalog") {
            document.getElementById("catalog-expansions-grid").innerHTML =
                `<p style="color:#d9363e; padding:20px;">卡片圖鑑 JSON 載入失敗：${error.message}</p>`;
        }
    }
}

function showFirestoreLoadError(error) {
    console.error("Firestore 即時連線失敗：", error);
    const message = error?.code === "permission-denied"
        ? "資料庫權限不足，請檢查 Firebase Firestore Rules。"
        : `資料庫連線失敗：${error?.message || "未知錯誤"}`;
    const html = `<p style="text-align:center; color:#d9363e; padding:20px;">${message}</p>`;
    [
        rarityRowsContainerAlt,
        rarityRowsContainer24h,
        rarityRowsContainerNeeded,
        rarityRowsContainerGeneral,
        rarityRowsContainerTwoStar
    ].forEach(container => {
        if (container) container.innerHTML = html;
    });
}

function startFirestoreListeners() {
    if (unsubscribeCardsSnapshot) return;

    unsubscribeCardsSnapshot = onSnapshot(cardsCollection, (snapshot) => {
    const rawCards = snapshot.docs.map(doc => {
        const data = doc.data();
        const section = data.section || "alt_acc";
        
        let altAccData = null;
        if (section === "alt_acc") {
            altAccData = {
                accountType: data.accountType || currentAccountTab || "小帳",
                hasOnMain: data.hasOnMain || "false",
                ...(data.altAccData || {})
            };
        } else {
            altAccData = data.altAccData || null;
        }
        let challenge24hData = data.challenge24hData || (section === "24h" ? { ownership: data.ownership } : null);
        if (section === "24h" && challenge24hData) {
            challenge24hData = {
                ...challenge24hData,
                versionTabId: challenge24hData.versionTabId || DEFAULT_24H_VERSION_TAB_ID
            };
        }
        let neededCardsData = data.neededCardsData || (section === "needed_cards" ? { quantity: data.quantity || 1, order: data.order || Date.now(), tab: data.tab || "缺少的卡" } : null);
        let generalData = data.generalData || (section === "general_cards" ? { type: data.type || "支援者", order: data.order || Date.now(), hasOnMain: data.hasOnMain || "false" } : null);
        
        let twoStarData = data.twoStarData || (section === "two_star_cards" ? { 
            tab: data.tab || "擁有的卡", 
            status: data.status || "主帳", 
            type: data.type || "支援者", 
            tier: data.tier || "無", 
            order: data.order || Date.now() 
        } : null);
        if (twoStarData?.status === "本帳") twoStarData.status = "主帳";

        if (section === "alt_acc" && highRarityNames.has(data.rarity)) {
            twoStarData = twoStarData ? { ...twoStarData } : {};
            twoStarData.tab = "擁有的卡";
            twoStarData.status = altAccData?.accountType || "小帳"; 
            if (!twoStarData.order) twoStarData.order = Date.now();
            if (!twoStarData.tier) twoStarData.tier = "無";
            if (!twoStarData.quantity) twoStarData.quantity = altAccData?.quantity || 1;
        }

        return { docId: doc.id, ...data, section, altAccData, challenge24hData, neededCardsData, generalData, twoStarData };
    });

    const setAltAccStatus = (key, accType) => {
        const currentHighest = altAccStatusMap[key];
        if (accType === "資源帳") {
            altAccStatusMap[key] = "資源帳";
        } else if (accType === "小帳" && currentHighest !== "資源帳") {
            altAccStatusMap[key] = "小帳";
        }
    };

    const altAccStatusMap = {};
    rawCards.filter(c => c.section === "alt_acc").forEach(c => {
        const accType = c.altAccData?.accountType;
        getCardIdentityKeys(c).forEach(key => setAltAccStatus(key, accType));
    });

    const highRarityMainOwnedMap = {};
    rawCards.filter(c =>
        c.section === "two_star_cards"
        && c.rarity === "2星"
        && c.twoStarData?.tab === "擁有的卡"
        && ["主帳", "本帳"].includes(c.twoStarData?.status)
    ).forEach(c => {
        getCardIdentityKeys(c).forEach(key => {
            highRarityMainOwnedMap[key] = true;
        });
    });

    cardsData = rawCards.map(c => {
        if (c.section === "24h") {
            let dbOwnership = c.challenge24hData?.ownership || "無";
            const identityKeys = getCardIdentityKeys(c);
            const hasHighRarityMainOwned = identityKeys.some(key => highRarityMainOwnedMap[key]);
            const altAccOwnership = identityKeys.map(key => altAccStatusMap[key]).find(Boolean);

            if (dbOwnership === "取得" || hasHighRarityMainOwned) {
                c.computedOwnership = "取得";
            } else if (altAccOwnership) {
                c.computedOwnership = altAccOwnership;
            } else {
                c.computedOwnership = dbOwnership;
            }
        }
        return c;
    });
    
    rebuildUniqueCardsDict(cardsData);
    renderAllViews();
}, showFirestoreLoadError);
}

loadCatalogCardsFromJson();

onAuthStateChanged(auth, (user) => {
    currentAuthUser = user;
    setAuthPanelState(user);
    stopFirestoreListeners();

    if (user) {
        rarityRowsContainerAlt.innerHTML = "<p style='text-align:center; color:#888; padding:20px;'>📡 建立即時連線中...</p>";
        startFirestoreListeners();
    } else {
        cardsData = [];
        rebuildUniqueCardsDict([]);
        setSignedOutMessage();
    }
});
