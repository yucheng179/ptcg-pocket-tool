import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("crawler/raenonx-cards.json", root), "utf8"));
function card(id, qty = 1) {
    const entry = catalog.find(entry => entry.id === id);
    assert.ok(entry, id);
    return { id, qty, name: entry.name, img: entry.imageUrl, type: entry.cardType === "pokemon" ? "寶可夢" : entry.cardType === "support" ? "支援者" : "物品、道具、競技場" };
}

test("active deck exports round-trippable text and copies it without changing card data", async () => {
    const cards = [card("A1-001"), card("A1-001"), card("A1-227"), card("A1-002"), card("A1-272"), card("PROMO-A-007", 2), card("PROMO-A-005", 2)];
    const imageOnly = card(catalog.find(entry => entry.expansion === "A1" && entry.pokemonTypes.includes("water")).id);
    const imageOnlyId = imageOnly.id;
    delete imageOnly.id;
    imageOnly.img += "&w=1080&q=75";
    cards.push(imageOnly);
    const deck = { docId: "export-test", section: "meta_deck", deckData: {
        name: "匯出測試牌組", attribute: "草", coverImg: cards[0].img,
        tabs: [
            { id: "first", name: "第一分頁", cards, energyTypes: [4, 8], replacements: [{ id: "unused", sources: [{ name: "不要匯出可替換卡" }], alternatives: [] }] },
            { id: "second", name: "第二分頁", cards: [card("A1-004"), card("A2-190", 2)], energyTypes: [2, 3], replacements: [] }
        ]
    } };
    const bridge = `window.__export = {
        ready(){return catalogCardsData.length>0;},
        show(deck,tab='first'){cardsData=[structuredClone(deck)];rebuildUniqueCardsDict(cardsData);switchSection('meta_decks','Meta牌組',navMetaDecks,viewMetaDecks);activeMetaDeckId=deck.docId;activeDeckTabId=tab;metaDecksListView.style.display='none';metaDeckDetailView.style.display='block';renderMetaDeckDetail();},
        state(){return structuredClone(cardsData);},
        parse(text){return parseDeckImportText(text);},
        build(cards,energies=[]){try{return {text:buildDeckExportText(cards,energies)};}catch(error){return {error:error.message};}}
    };`;
    const modules = {
        "firebase-app.js": "export const initializeApp=()=>({});",
        "firebase-auth.js": "export const browserLocalPersistence={}; export const getAuth=()=>({}); export class GoogleAuthProvider{setCustomParameters(){}} export const getRedirectResult=async()=>null; export const onAuthStateChanged=()=>{}; export const setPersistence=async()=>{}; export const signInWithPopup=async()=>{}; export const signInWithRedirect=async()=>{}; export const signOut=async()=>{};",
        "firebase-firestore.js": "export const getFirestore=()=>({}); export const collection=()=>({}); export const doc=()=>({}); export const onSnapshot=()=>()=>{}; const noWrite=async()=>{window.__unexpectedWrites=(window.__unexpectedWrites||0)+1;throw new Error('Unexpected database write');}; export const addDoc=noWrite,updateDoc=noWrite,deleteDoc=noWrite; export const writeBatch=()=>({update(){},commit:noWrite});"
    };
    const allowed = new Set(["index.html", "script.js", "style.css", "deck-qr.mjs", "pokemon-types.mjs", "crawler/raenonx-cards.json", "vendor/lucide/copy.svg", "vendor/lucide/import.svg", "vendor/lucide/download.svg"]);
    const server = createServer(async (request, response) => {
        const path = new URL(request.url, "http://local").pathname.slice(1) || "index.html";
        if (!allowed.has(path)) { response.writeHead(404).end(); return; }
        let body = await readFile(new URL(path, root));
        if (path === "script.js") body = Buffer.concat([body, Buffer.from(bridge)]);
        const type = path.endsWith(".html") ? "text/html; charset=utf-8" : path.endsWith(".css") ? "text/css" : path.endsWith(".json") ? "application/json" : path.endsWith(".svg") ? "image/svg+xml" : "application/javascript";
        response.writeHead(200, { "Content-Type": type }).end(body);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__copiedText = text; } } });
        });
        const origin = `http://127.0.0.1:${server.address().port}`;
        await page.route("**/*", async route => {
            const url = route.request().url();
            const mock = Object.entries(modules).find(([file]) => url.includes("www.gstatic.com/firebasejs/") && url.endsWith(file));
            if (mock) return route.fulfill({ contentType: "application/javascript", body: mock[1] });
            if (url.startsWith(origin)) return route.continue();
            const icon = /img\.game8\.co\/(401872[1-9]|4018730)\//.exec(url);
            if (icon) {
                try { return route.fulfill({ contentType: "image/png", body: await readFile(new URL(`.cache/deck-energy-icons/${icon[1]}.png`, root)) }); } catch {}
            }
            return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
        });
        await page.goto(origin);
        await page.waitForFunction(() => window.__export?.ready());
        await page.evaluate(deck => window.__export.show(deck), deck);
        const button = page.locator("#btn-export-deck-list");
        const checkTransferButtons = async () => {
            const sizes = await page.locator(".deck-transfer-button").evaluateAll(buttons => buttons.map(button => {
                const rect = button.getBoundingClientRect();
                return [rect.width, rect.height];
            }));
            assert.deepEqual(sizes, [[124, 40], [124, 40]]);
            await page.waitForFunction(() => [...document.querySelectorAll(".deck-transfer-button img")].every(img => img.complete && img.naturalWidth > 0));
        };
        await checkTransferButtons();
        await page.locator("#btn-import-deck-list").click();
        assert.ok(await page.locator("#deck-import-modal").isVisible());
        await page.locator("#close-deck-import-modal").click();
        const before = await page.evaluate(() => window.__export.state());
        const exportText = async () => {
            await button.click();
            await page.waitForFunction(() => !document.getElementById("btn-export-deck-list").disabled);
            return page.evaluate(() => window.__copiedText);
        };
        const text = await exportText();
        assert.ok(text.includes(`2 ${cards[0].name} A1 1`));
        assert.ok(text.includes(`1 ${cards[2].name} A1 227`));
        assert.ok(text.includes(`2 ${card("PROMO-A-007").name} P-A 7`));
        assert.ok(text.endsWith("Energy: Lightning, Metal"));
        assert.equal(text.includes("不要匯出可替換卡"), false);
        const parsed = await page.evaluate(text => window.__export.parse(text), text);
        assert.deepEqual(parsed.unmatchedLines, []);
        assert.equal(parsed.importedCards.reduce((sum, card) => sum + card.qty, 0), 10);
        assert.equal(parsed.importedCards.find(card => card.id === "A1-001").qty, 2);
        assert.ok(parsed.importedCards.some(card => card.id === imageOnlyId));
        assert.equal(parsed.importedCards.find(card => card.id === "PROMO-A-005").type, "物品、道具、競技場");
        assert.deepEqual(await page.evaluate(() => window.__export.state()), before);
        assert.equal(await page.locator("#deck-export-status").textContent(), "牌組文字已複製到剪貼簿");
        await page.getByRole("button", { name: "第二分頁", exact: true }).click();
        await page.waitForFunction(() => document.getElementById("deck-export-status").textContent === "");
        assert.equal(await page.locator("#deck-export-status").textContent(), "");
        const second = await exportText();
        assert.ok(second.includes(`1 ${card("A1-004").name} A1 4`));
        assert.ok(second.endsWith("Energy: Fire, Water"));
        assert.equal(second.includes(" P-A 7"), false);

        await page.evaluate(() => {
            navigator.clipboard.writeText = async () => { throw new Error("Blocked"); };
            document.execCommand = command => {
                if (command !== "copy") return false;
                window.__copiedText = document.activeElement.value;
                return true;
            };
        });
        assert.equal(await exportText(), second);
        assert.equal(await page.locator(".deck-copy-buffer").count(), 0);
        await page.evaluate(() => document.execCommand = () => false);
        const copyError = page.waitForEvent("dialog").then(async dialog => {
            assert.ok(dialog.message().includes("未允許複製"));
            await dialog.accept();
        });
        await button.click();
        await copyError;
        await page.waitForFunction(() => !document.getElementById("btn-export-deck-list").disabled);
        assert.equal(await page.locator(".deck-copy-buffer").count(), 0);
        assert.equal(await page.locator("#deck-export-status").textContent(), "");
        assert.equal(await page.evaluate(() => window.__copiedText), second);
        for (const invalid of [[{ name: cards[0].name }], [card("A1-001", 0)], [{ name: "錯誤卡片", id: "not-a-number" }], []]) {
            const result = await page.evaluate(cards => window.__export.build(cards), invalid);
            assert.ok(result.error);
        }
        const defaultQty = card("A1-001");
        delete defaultQty.qty;
        assert.ok((await page.evaluate(card => window.__export.build([card]), defaultQty)).text.startsWith(`1 ${cards[0].name} A1 1`));
        const empty = structuredClone(deck);
        empty.deckData.tabs[0].cards = [];
        await page.evaluate(deck => window.__export.show(deck), empty);
        const emptyError = page.waitForEvent("dialog").then(async dialog => {
            assert.ok(dialog.message().includes("沒有卡片"));
            await dialog.accept();
        });
        await button.click();
        await emptyError;
        const legacy = { docId: "legacy", section: "meta_deck", deckData: { name: "舊牌組", attribute: "電", coverImg: cards[0].img, cards: [card("A1-001")] } };
        await page.evaluate(deck => window.__export.show(deck, "default"), legacy);
        await page.evaluate(() => navigator.clipboard.writeText = async text => window.__copiedText = text);
        assert.ok((await exportText()).endsWith("Energy: Lightning"));
        await mkdir(new URL(".cache/", root), { recursive: true });
        await page.locator(".deck-detail-header").screenshot({ path: fileURLToPath(new URL(".cache/deck-export-desktop.png", root)) });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#sidebar-toggle").click();
        await page.waitForFunction(() => document.getElementById("sidebar").getBoundingClientRect().width < 70);
        await checkTransferButtons();
        await button.focus();
        await button.press("Enter");
        await page.waitForFunction(() => !document.getElementById("btn-export-deck-list").disabled);
        assert.ok(await page.locator(".deck-detail-header").evaluate(header => [...header.querySelectorAll("button, h2")].every(element => {
            const rect = element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth;
        })));
        await page.waitForFunction(() => document.querySelector("#btn-export-deck-list img").naturalWidth > 0);
        await page.locator(".deck-detail-header").screenshot({ path: fileURLToPath(new URL(".cache/deck-export-mobile.png", root)) });
        assert.equal(await page.evaluate(() => window.__unexpectedWrites || 0), 0);
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
