import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("crawler/raenonx-cards.json", root), "utf8"));
const coverImg = catalog[0].imageUrl;
const fixtures = [
    { docId: "legacy", section: "meta_deck", deckData: { name: "舊電系牌組", attribute: "雷", coverImg, tier: "Tier 1", order: 1, cards: [] } },
    { docId: "dual", section: "meta_deck", deckData: { name: "雙屬性牌組", attributes: ["火", "水"], attribute: "火", coverImg, tier: "Tier 1", order: 2, tabs: [{ id: "default", name: "預設牌組", cards: [], replacements: [], energyTypes: [8] }] } }
];

test("deck attributes can be selected, saved, copied and restored on desktop and mobile", async () => {
    const bridge = `window.__decks = {
        load(cards) { cardsData=cards; rebuildUniqueCardsDict(cards); switchSection('meta_decks','Meta牌組',navMetaDecks,viewMetaDecks); },
        ready() { return catalogCardsData.length > 0; },
        state() { return structuredClone(cardsData); },
        tabs(id) { return getDeckTabs(cardsData.find(card=>card.docId===id)); },
        add(data) { const id='new-'+cardsData.length; cardsData.push({docId:id,...structuredClone(data)}); renderAllViews(); return {id}; },
        update(ref,changes) { const card=cardsData.find(card=>card.docId===ref.id); for(const [path,value] of Object.entries(changes)) { const keys=path.split('.'); let target=card; for(const key of keys.slice(0,-1)) target=target[key]; target[keys.at(-1)]=structuredClone(value); } renderAllViews(); }
    };`;
    const modules = {
        "firebase-app.js": "export const initializeApp=()=>({});",
        "firebase-auth.js": "export const browserLocalPersistence={}; export const getAuth=()=>({}); export class GoogleAuthProvider{setCustomParameters(){}} export const getRedirectResult=async()=>null; export const onAuthStateChanged=()=>{}; export const setPersistence=async()=>{}; export const signInWithPopup=async()=>{}; export const signInWithRedirect=async()=>{}; export const signOut=async()=>{};",
        "firebase-firestore.js": "export const getFirestore=()=>({}); export const collection=()=>({}); export const doc=(...args)=>({id:args.at(-1)}); export const onSnapshot=()=>()=>{}; export const addDoc=async(ref,data)=>window.__decks.add(data); export const updateDoc=async(ref,data)=>window.__decks.update(ref,data); export const deleteDoc=async()=>{}; export const writeBatch=()=>({update(){},commit:async()=>{}});"
    };
    const allowed = new Set(["index.html", "style.css", "script.js", "deck-qr.mjs", "pokemon-types.mjs", "crawler/raenonx-cards.json", "vendor/lucide/download.svg"]);
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
        await page.waitForFunction(() => window.__decks?.ready());
        await page.evaluate(cards => window.__decks.load(cards), fixtures);
        const box = id => page.locator(`.deck-box-container[data-deck-id="${id}"]`);
        const attribute = value => page.locator(`#deck-attribute input[value="${value}"]`);
        const selected = () => page.locator('#deck-attribute input:checked').evaluateAll(inputs => inputs.map(input => input.value));
        const state = () => page.evaluate(() => window.__decks.state());
        const save = async () => {
            await page.locator('#deck-form button[type="submit"]').click();
            await page.waitForFunction(() => !document.getElementById("deck-form-modal").classList.contains("show"));
        };
        assert.deepEqual(await box("legacy").locator(".deck-attr-tag").evaluateAll(tags => tags.map(tag => tag.title)), ["電"]);
        assert.deepEqual(await box("dual").locator(".deck-attr-tag").evaluateAll(tags => tags.map(tag => tag.title)), ["火", "水"]);
        assert.equal(await box("legacy").evaluate(element => getComputedStyle(element).backgroundImage), "none");
        assert.equal(await box("legacy").evaluate(element => getComputedStyle(element).backgroundColor), "rgb(255, 248, 216)");
        assert.equal(await box("dual").evaluate(element => getComputedStyle(element).backgroundImage), "linear-gradient(90deg, rgb(255, 233, 230) 30%, rgb(229, 245, 255) 70%)");
        await mkdir(new URL(".cache/", root), { recursive: true });
        const gradientPng = await box("dual").screenshot({ path: fileURLToPath(new URL(".cache/deck-gradient-desktop.png", root)) });
        const bottomColors = await page.evaluate(async base64 => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);
            return [20, image.width - 20].map(x => Array.from(context.getImageData(x, image.height - 16, 1, 1).data).slice(0, 3));
        }, gradientPng.toString("base64"));
        assert.deepEqual(bottomColors, [[255, 233, 230], [229, 245, 255]], "Both attribute colors must remain distinct below the cover image");
        await box("legacy").locator(".deck-box-info").click();
        assert.deepEqual(await selected(), ["電"]);
        assert.equal(await page.locator("#deck-attribute input").count(), 10);
        await attribute("鋼").check();
        await mkdir(new URL(".cache/", root), { recursive: true });
        await page.locator("#deck-attribute").screenshot({ path: fileURLToPath(new URL(".cache/deck-attributes-desktop.png", root)) });
        await save();
        let records = await state();
        const legacy = records.find(card => card.docId === "legacy");
        assert.deepEqual(legacy.deckData.attributes, ["電", "鋼"]);
        assert.equal(legacy.deckData.attribute, "電");
        assert.deepEqual(await page.evaluate(() => window.__decks.tabs("legacy")[0].energyTypes), [4, 8]);
        await box("legacy").locator(".deck-box-info").click();
        assert.deepEqual(await selected(), ["電", "鋼"]);
        await page.locator("#close-deck-modal").click();
        await box("dual").locator(".deck-box-info").click();
        assert.deepEqual(await selected(), ["火", "水"]);
        await attribute("草").check();
        await save();
        assert.equal(await box("dual").evaluate(element => getComputedStyle(element).backgroundImage), "linear-gradient(90deg, rgb(237, 249, 232), rgb(255, 233, 230), rgb(229, 245, 255))");
        assert.deepEqual(await page.evaluate(() => window.__decks.tabs("dual")[0].energyTypes), [8]);
        await box("dual").hover();
        await box("dual").locator(".copy-deck-btn").click();
        records = await state();
        const copied = records.find(card => card.deckData.name === "雙屬性牌組 複製");
        assert.deepEqual(copied.deckData.attributes, ["草", "火", "水"]);
        assert.deepEqual(copied.deckData.tabs[0].energyTypes, [8]);
        await box(copied.docId).locator(".deck-box-info").click();
        await attribute("火").uncheck();
        await save();
        assert.deepEqual((await state()).find(card => card.docId === "dual").deckData.attributes, ["草", "火", "水"]);

        await page.locator("#tier-1-grid .add-new-deck-box").click();
        assert.deepEqual(await selected(), ["草"]);
        await page.locator("#deck-name").fill("新雙屬性牌組");
        await page.locator("#deck-img").fill(coverImg);
        await attribute("草").uncheck();
        const beforeInvalidSave = await state();
        page.once("dialog", dialog => dialog.accept());
        await page.locator('#deck-form button[type="submit"]').click();
        assert.deepEqual(await state(), beforeInvalidSave);
        assert.ok(await page.locator("#deck-form-modal").isVisible());
        await attribute("草").check();
        await attribute("水").check();
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#deck-attribute").scrollIntoViewIfNeeded();
        const fits = await page.locator(".deck-attribute-option").evaluateAll(options => options.every(option => {
            const rect = option.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth && option.scrollWidth <= option.clientWidth;
        }));
        assert.ok(fits, "Attribute choices must fit on mobile");
        await page.locator("#deck-attribute").screenshot({ path: fileURLToPath(new URL(".cache/deck-attributes-mobile.png", root)) });
        await save();
        const created = (await state()).find(card => card.deckData.name === "新雙屬性牌組");
        assert.deepEqual(created.deckData.attributes, ["草", "水"]);
        assert.equal(await box(created.docId).evaluate(element => getComputedStyle(element).backgroundImage), "linear-gradient(90deg, rgb(237, 249, 232) 30%, rgb(229, 245, 255) 70%)");
        await box(created.docId).screenshot({ path: fileURLToPath(new URL(".cache/deck-gradient-mobile.png", root)) });
        assert.deepEqual(created.deckData.tabs[0].energyTypes, [1, 3]);
        assert.equal(created.deckData.cards.reduce((total, card) => total + card.qty, 0), 7);
        await box(created.docId).locator(".deck-box-cover-wrap").click();
        assert.deepEqual(await page.locator(".deck-qr-energy input:checked").evaluateAll(inputs => inputs.map(input => Number(input.value))), [1, 3]);
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
