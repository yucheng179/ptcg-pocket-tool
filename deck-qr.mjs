const energyOptions = [
    { value: 1, label: "草" },
    { value: 2, label: "火" },
    { value: 3, label: "水" },
    { value: 4, label: "電" },
    { value: 5, label: "超" },
    { value: 6, label: "鬥" },
    { value: 7, label: "惡" },
    { value: 8, label: "鋼" }
];

export { energyOptions };

export function getDeckQrEnergyTypes(tab = {}, attribute = "") {
    if (Array.isArray(tab.energyTypes)) return [...tab.energyTypes];
    const normalizedAttribute = { "雷": "電", "超能": "超" }[attribute] || attribute;
    const option = energyOptions.find(item => item.label === normalizedAttribute);
    return option ? [option.value] : [];
}

let qrLibraryPromise;
export function loadDeckQrLibrary() {
    if (!qrLibraryPromise) {
        qrLibraryPromise = import("./vendor/tcgp-deck-qr/tcgp-deck-qr.mjs").catch(error => {
            qrLibraryPromise = null;
            throw error;
        });
    }
    return qrLibraryPromise;
}

export function drawDeckQrCanvas(canvas, matrix) {
    const scale = 12;
    const margin = 4;
    const count = matrix.length;
    canvas.width = canvas.height = (count + margin * 2) * scale;
    const context = canvas.getContext("2d");
    const background = "#ffffff";
    const gradient = context.createLinearGradient(0, margin * scale, 0, (count + margin) * scale);
    gradient.addColorStop(0, "#08a9bf");
    gradient.addColorStop(0.5, "#0587b9");
    gradient.addColorStop(1, "#0755a6");
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const finders = [[0, 0], [count - 7, 0], [0, count - 7]];
    const isFinder = (x, y) => finders.some(([left, top]) => x >= left && x < left + 7 && y >= top && y < top + 7);

    context.fillStyle = gradient;
    matrix.forEach((row, y) => row.forEach((dark, x) => {
        if (!dark || isFinder(x, y)) return;
        const left = (x + margin) * scale;
        const top = (y + margin) * scale;
        context.beginPath();
        context.arc(left + scale / 2, top + scale / 2, scale * 0.44, 0, Math.PI * 2);
        context.fill();
    }));

    const roundedSquare = (x, y, size, radius, fill) => {
        context.fillStyle = fill;
        context.beginPath();
        context.roundRect((x + margin) * scale, (y + margin) * scale, size * scale, size * scale, radius * scale);
        context.fill();
    };
    finders.forEach(([x, y]) => {
        roundedSquare(x, y, 7, 1.1, gradient);
        roundedSquare(x + 1, y + 1, 5, 0.5, background);
        roundedSquare(x + 2, y + 2, 3, 0.4, gradient);
    });

    // Keep the central badge small to limit obscured data modules.
    const center = count / 2;
    roundedSquare(center - 5, center - 5, 10, 1.5, background);
    context.save();
    context.translate((center + margin) * scale, (center + margin) * scale);
    context.scale(scale, scale);
    // Recreate the gradient in badge-local coordinates after the transform.
    const iconGradient = context.createLinearGradient(0, -4, 0, 4);
    iconGradient.addColorStop(0, "#08a9bf");
    iconGradient.addColorStop(1, "#0755a6");
    context.strokeStyle = iconGradient;
    context.lineWidth = 0.58;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-3.2, -2.7);
    context.lineTo(1.8, -2.1);
    context.lineTo(1.8, 3.8);
    context.lineTo(-3.2, 3.2);
    context.closePath();
    context.moveTo(-3.2, -2.7);
    context.lineTo(-1.5, -4);
    context.lineTo(3.4, -3.4);
    context.lineTo(1.8, -2.1);
    context.moveTo(3.4, -3.4);
    context.lineTo(3.4, 2.5);
    context.lineTo(1.8, 3.8);
    context.moveTo(-3.2, 0.2);
    context.lineTo(-1.6, 0.4);
    context.moveTo(0.2, 0.6);
    context.lineTo(1.8, 0.8);
    context.lineTo(3.4, -0.5);
    context.stroke();
    context.beginPath();
    context.arc(-0.7, 0.5, 0.9, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    return canvas;
}

const normalizeName = value => String(value || "").normalize("NFKC").replace(/\s|[\u200B-\u200D\uFEFF]/g, "").toLowerCase();
const normalizeId = value => normalizeName(value).replace(/^p-([ab])-/, "promo-$1-");

function getCardEntity(card = {}) {
    const source = [card.cardId, card.imageUrl, card.img].filter(Boolean).join(" ");
    // Image proxy parameters can contain the original path more than once encoded.
    let decoded = source;
    for (let i = 0; i < 3; i += 1) {
        try {
            const next = decodeURIComponent(decoded);
            if (next === decoded) break;
            decoded = next;
        } catch {
            break;
        }
    }
    const match = /(?:^|[^a-z0-9])c?(PK|TR)_\d+_(\d{6})_\d+/i.exec(decoded);
    if (!match || Number(match[2]) <= 0) return null;
    return { type: match[1].toUpperCase() === "PK" ? "pokemon" : "trainer", id: Number(match[2]) };
}

export function buildDeckQrData(cards = [], catalog = [], energyTypes = []) {
    const total = cards.reduce((sum, card) => sum + Number(card.qty ?? 1), 0);
    if (total !== 20) throw new Error(`目前 ${total} / 20 張`);
    if (!Array.isArray(energyTypes) || energyTypes.length < 1 || energyTypes.length > 3
        || new Set(energyTypes).size !== energyTypes.length
        || energyTypes.some(value => !energyOptions.some(option => option.value === value))) {
        throw new Error("請選擇 1 至 3 種能量");
    }

    const byId = new Map(catalog.map(card => [normalizeId(card.id), card]));
    const trainerIds = [];
    const pokemonIds = [];
    const nameCounts = new Map();
    const entityCounts = new Map();

    for (const card of cards) {
        const quantity = Number(card.qty ?? 1);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2) {
            throw new Error(`「${card.name || card.id || "卡片"}」數量須為 1 或 2`);
        }

        const catalogCard = card.id ? byId.get(normalizeId(card.id)) : null;
        let entity = getCardEntity(catalogCard || card);
        let resolvedName = catalogCard?.name || card.name;
        if (!entity && !card.id) {
            const matches = catalog.filter(entry => normalizeName(entry.name) === normalizeName(card.name));
            const entities = new Map(matches.map(entry => {
                const candidate = getCardEntity(entry);
                return candidate ? [`${candidate.type}:${candidate.id}`, candidate] : ["", null];
            }).filter(([, candidate]) => candidate));
            if (entities.size === 1) {
                entity = entities.values().next().value;
                resolvedName = matches[0].name;
            }
        }
        if (!entity) throw new Error(`無法辨識「${card.name || card.id || "卡片"}」，請重新選取卡片`);

        const entityKey = `${entity.type}:${entity.id}`;
        const nameKey = normalizeName(resolvedName) || entityKey;
        const nameCount = (nameCounts.get(nameKey) || 0) + quantity;
        const entityCount = (entityCounts.get(entityKey) || 0) + quantity;
        if (nameCount > 2 || entityCount > 2) throw new Error(`「${resolvedName || card.id}」同名卡超過 2 張`);
        nameCounts.set(nameKey, nameCount);
        entityCounts.set(entityKey, entityCount);
        (entity.type === "pokemon" ? pokemonIds : trainerIds).push(...Array(quantity).fill(entity.id));
    }
    if (pokemonIds.length === 0) throw new Error("牌組需要寶可夢卡片");
    return { trainerIds, pokemonIds, energyTypes: [...energyTypes] };
}
