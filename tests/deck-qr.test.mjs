import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDeckQrData, loadDeckQrLibrary } from "../deck-qr.mjs";

const catalog = JSON.parse(await readFile(new URL("../crawler/raenonx-cards.json", import.meta.url), "utf8"));
const entries = [
    ["B1a-024", 2], ["A1-098", 2], ["B1a-026", 1], ["B3a-019", 2], ["A3a-021", 2],
    ["PROMO-A-007", 2], ["B3a-073", 1], ["B1-225", 1], ["A2-150", 1],
    ["B1-226", 1], ["B1a-068", 1], ["A1-225", 1], ["PROMO-A-005", 2], ["A2-147", 1]
];
function sampleDeck() {
    return entries.map(([id, qty]) => {
        const card = catalog.find(entry => entry.id === id);
        assert.ok(card, `Catalog is missing ${id}`);
        return { id, name: card.name, img: card.imageUrl, qty };
    });
}

test("real 20-card catalog deck maps to game entities and round-trips through a QR", async () => {
    const data = buildDeckQrData(sampleDeck(), catalog, [4]);
    assert.equal(data.pokemonIds.length, 9);
    assert.equal(data.trainerIds.length, 11);
    assert.equal(data.pokemonIds.filter(id => id === 18340).length, 2);
    assert.equal(data.trainerIds.filter(id => id === 30).length, 2);
    const { encodePayload, decodePayload, createQrMatrix, decodeQrPixels } = await loadDeckQrLibrary();
    const payload = encodePayload(data);
    assert.deepEqual(decodePayload(payload), data);
    const matrix = createQrMatrix(payload);
    assert.equal(matrix.length, 53);
    const scale = 8;
    const width = (matrix.length + 8) * scale;
    const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
    matrix.forEach((row, y) => row.forEach((dark, x) => {
        if (!dark) return;
        for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) {
                const offset = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4;
                pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
            }
        }
    }));
    assert.equal(decodeQrPixels({ data: pixels, width, height: width }).payload, payload);
});

test("alternate trainer art and encoded legacy image URLs preserve the entity", () => {
    const deck = sampleDeck();
    const sabrinaIndex = deck.findIndex(card => card.id === "A1-225");
    deck[sabrinaIndex] = { id: "A1-272", name: "娜姿", qty: 1 };
    const data = buildDeckQrData(deck, catalog, [4]);
    assert.ok(data.trainerIds.includes(170));
    const legacy = sampleDeck().map(({ id, img, ...card }) => ({
        ...card,
        img: `https://image.example/?url=${encodeURIComponent(img)}&w=1080&q=75`
    }));
    assert.deepEqual(buildDeckQrData(legacy, [], [4]), buildDeckQrData(sampleDeck(), catalog, [4]));
});

test("incomplete decks, excessive same-name copies and invalid energies cannot export", () => {
    assert.throws(() => buildDeckQrData(sampleDeck().slice(1), catalog, [4]), /18 \/ 20/);
    for (const energies of [[], [4, 4], [10], [11], [1, 2, 3, 4]]) {
        assert.throws(() => buildDeckQrData(sampleDeck(), catalog, energies), /能量/);
    }
    const duplicate = sampleDeck();
    duplicate[0] = { ...duplicate[0], qty: 1 };
    duplicate[10] = { id: "A1-272", name: "娜姿", qty: 2 };
    assert.throws(() => buildDeckQrData(duplicate, catalog, [4]), /同名卡超過 2 張/);
});

test("ambiguous name-only Pokemon cannot silently choose a different card", () => {
    const deck = sampleDeck();
    deck[0] = { name: "小磁怪", qty: 2 };
    assert.throws(() => buildDeckQrData(deck, catalog, [4]), /無法辨識/);
});
