import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { getPokemonTypes, pokemonTypeOptions } from "../pokemon-types.mjs";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("crawler/raenonx-cards.json", root), "utf8"));

test("crawler maps actual Pokemon types, not attack energy or trainer attributes", () => {
    for (const option of pokemonTypeOptions) {
        assert.deepEqual(getPokemonTypes({ cardType: "pokemon", play: { types: [option.id] } }), [option.key]);
    }
    assert.deepEqual(getPokemonTypes({ cardType: "pokemon", play: { types: [1, "3", 1, 99] } }), ["grass", "water"]);
    assert.deepEqual(getPokemonTypes({ cardType: "trainer", play: { types: [1] } }), []);
    assert.deepEqual(getPokemonTypes({ cardType: "pokemon", play: { weakness: { id: 2 } } }), []);
    assert.deepEqual(getPokemonTypes({ cardType: "pokemon", play: { types: null } }), []);
});

test("static catalog contains valid types for every Pokemon and no trainer types", () => {
    const known = new Set(pokemonTypeOptions.map(option => option.key));
    const found = new Set();
    for (const card of catalog) {
        assert.ok(Array.isArray(card.pokemonTypes), card.id);
        if (card.cardType === "pokemon") {
            assert.ok(card.pokemonTypes.length > 0, card.id);
            for (const key of card.pokemonTypes) {
                assert.ok(known.has(key), `${card.id}: ${key}`);
                found.add(key);
            }
        } else assert.deepEqual(card.pokemonTypes, [], card.id);
    }
    assert.equal(found.size, 10);
});

test("catalog attribute filters work globally, inside expansions, with other filters and on mobile", async () => {
    const fixtures = pokemonTypeOptions.map((option, index) => ({
        ...catalog.find(card => card.pokemonTypes.includes(option.key)),
        id: `C1-${String(index + 1).padStart(3, "0")}`,
        expansion: "C1", name: `${option.label}測試寶可夢`,
        pokemonTypes: [option.key], sourceRarity: "C", rarity: "1菱"
    }));
    fixtures.push(
        { ...fixtures[0], id: "C2-001", expansion: "C2", name: "跨包草卡", sourceRarity: "RR", rarity: "4菱" },
        { ...fixtures[0], id: "C1-011", name: "雙屬性卡", pokemonTypes: ["grass", "water"] },
        { ...fixtures[0], id: "C1-012", name: "無屬性資料卡", pokemonTypes: undefined },
        { ...fixtures[0], id: "C1-013", name: "訓練家不是草卡", cardType: "supporter", pokemonTypes: ["grass"] }
    );
    const modules = {
        "firebase-app.js": "export const initializeApp=()=>({});",
        "firebase-auth.js": "export const browserLocalPersistence={}; export const getAuth=()=>({}); export class GoogleAuthProvider{setCustomParameters(){}} export const getRedirectResult=async()=>null; export const onAuthStateChanged=()=>{}; export const setPersistence=async()=>{}; export const signInWithPopup=async()=>{}; export const signInWithRedirect=async()=>{}; export const signOut=async()=>{};",
        "firebase-firestore.js": "export const getFirestore=()=>({}); export const collection=()=>({}); export const doc=()=>({}); export const onSnapshot=()=>()=>{}; export const addDoc=async()=>({id:'test'}); export const updateDoc=async()=>{}; export const deleteDoc=async()=>{}; export const writeBatch=()=>({update(){},commit:async()=>{}});"
    };
    const allowed = new Set(["index.html", "style.css", "script.js", "deck-qr.mjs", "pokemon-types.mjs", "crawler/raenonx-cards.json"]);
    let servedCards = fixtures;
    let catalogRequests = 0;
    const server = createServer(async (request, response) => {
        const path = new URL(request.url, "http://local").pathname.slice(1) || "index.html";
        if (!allowed.has(path)) { response.writeHead(404).end(); return; }
        if (path.endsWith(".json")) catalogRequests += 1;
        const content = path.endsWith(".json") ? JSON.stringify(servedCards) : await readFile(new URL(path, root));
        const type = path.endsWith(".html") ? "text/html; charset=utf-8" : path.endsWith(".css") ? "text/css" : path.endsWith(".json") ? "application/json" : "application/javascript";
        response.writeHead(200, { "Content-Type": type }).end(content);
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
        await page.locator("#nav-card-catalog").click();
        await page.waitForFunction(() => document.querySelector(".catalog-card"));
        assert.deepEqual(await page.locator(".catalog-series-tab-btn").evaluateAll(tabs => tabs.map(tab => tab.dataset.series)), ["ALL", "C", "B", "A", "PROMO"]);
        assert.equal(await page.locator(".catalog-series-tab-btn.active").getAttribute("data-series"), "ALL");
        assert.equal(await page.locator("#catalog-global-count").textContent(), "全圖鑑共 14 張卡片");
        assert.equal(await page.locator("#catalog-expansions-grid .catalog-card").count(), 14);
        assert.equal(await page.locator("#btn-catalog-load-more").isVisible(), false);
        await page.locator('.catalog-series-tab-btn[data-series="C"]').click();
        const globalPanel = page.locator("#catalog-global-filters");
        const detailPanel = page.locator("#catalog-detail-filters");
        const globalCount = page.locator("#catalog-global-count");
        const detailCount = page.locator("#catalog-detail-count");
        const globalClear = globalPanel.getByRole("button", { name: "清除篩選" });
        const detailClear = detailPanel.getByRole("button", { name: "清除篩選" });
        const globalCards = page.locator("#catalog-expansions-grid .catalog-card");
        const detailCards = page.locator("#catalog-cards-grid .catalog-card");
        const chip = (panel, key, type = "attribute") => panel.locator(`[data-filter-type="${type}"][data-filter-key="${key}"]`);
        const names = parent => parent.locator(".catalog-card-info strong").allTextContents();
        assert.equal(await globalCount.textContent(), "此系列共 14 張卡片");
        assert.ok(await globalClear.isDisabled());
        assert.equal(await globalCount.evaluate(element => getComputedStyle(element).textAlign), "right");
        await page.locator('.catalog-series-tab-btn[data-series="B"]').click();
        assert.equal(await globalCount.textContent(), "此系列共 0 張卡片");
        await page.locator('.catalog-series-tab-btn[data-series="C"]').click();
        assert.equal(await globalPanel.locator(".catalog-attribute-chip").count(), 10);
        assert.deepEqual(await globalPanel.locator(".catalog-filter-label").allTextContents(), ["卡片種類", "稀有度", "屬性"]);
        assert.deepEqual(await detailPanel.locator(".catalog-filter-label").allTextContents(), ["卡片種類", "稀有度", "屬性"]);
        assert.deepEqual(await globalPanel.locator(".catalog-attribute-chip").evaluateAll(nodes => nodes.map(node => node.title)), pokemonTypeOptions.map(option => option.label));
        await page.waitForFunction(() => [...document.querySelectorAll("#catalog-global-filters .catalog-attribute-chip img")].every(img => img.complete && img.naturalWidth > 0));
        await page.locator("#catalog-global-search").fill("草");
        await chip(globalPanel, "pokemon", "type").click();
        await chip(globalPanel, "C", "rarity").click();
        await chip(globalPanel, "grass").click();
        assert.equal(await globalCards.count(), 1);
        await globalClear.click();
        assert.equal(await globalPanel.locator('[aria-pressed="true"]').count(), 0);
        assert.equal(await detailPanel.locator('[aria-pressed="true"]').count(), 0);
        assert.equal(await page.locator("#catalog-global-search").inputValue(), "");
        assert.equal(await page.locator(".catalog-expansion-card").count(), 2);
        assert.equal(await globalCount.textContent(), "此系列共 14 張卡片");
        assert.ok(await globalClear.isDisabled());
        await page.locator("#catalog-global-search").fill("不存在");
        assert.ok(await globalClear.isEnabled(), "Search-only conditions must enable the clear button");
        await globalClear.click();
        assert.equal(await page.locator("#catalog-global-search").inputValue(), "");
        assert.equal(await page.locator(".catalog-expansion-card").count(), 2);
        assert.ok(await globalClear.isDisabled());
        for (const option of pokemonTypeOptions) {
            await chip(globalPanel, option.key).click();
            assert.deepEqual(await names(globalCards), fixtures.filter(card => card.cardType === "pokemon" && card.pokemonTypes?.includes(option.key))
                .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })).map(card => card.name));
            assert.equal(await chip(globalPanel, option.key).getAttribute("aria-pressed"), "true");
            assert.equal(await globalCount.textContent(), `符合條件：${await globalCards.count()} 張卡片`);
            await chip(globalPanel, option.key).click();
            assert.equal(await page.locator(".catalog-expansion-card").count(), 2);
            assert.equal(await globalCount.textContent(), "此系列共 14 張卡片");
        }
        await chip(globalPanel, "grass").click();
        await chip(globalPanel, "water").click();
        assert.equal(await globalCards.count(), 4);
        assert.equal(await globalCount.textContent(), "符合條件：4 張卡片");
        await chip(globalPanel, "RR", "rarity").click();
        assert.deepEqual(await names(globalCards), ["跨包草卡"]);
        assert.equal(await globalCount.textContent(), "符合條件：1 張卡片");
        await page.locator("#catalog-global-search").fill("不存在");
        assert.equal(await globalCards.count(), 0);
        assert.equal(await globalCount.textContent(), "符合條件：0 張卡片");
        assert.ok(await page.locator("#catalog-expansions-grid .catalog-empty-state").isVisible());
        await page.locator("#catalog-global-search").fill("");
        await chip(globalPanel, "RR", "rarity").click();
        await chip(globalPanel, "support", "type").click();
        assert.equal(await globalCards.count(), 0, "Trainers must not match an attribute even if carrying invalid type data");
        await chip(globalPanel, "support", "type").click();
        await mkdir(new URL(".cache/", root), { recursive: true });
        await globalPanel.screenshot({ path: fileURLToPath(new URL(".cache/catalog-attribute-filters-desktop.png", root)) });
        await page.locator('.catalog-series-tab-btn[data-series="C"]').click();
        assert.equal(await globalPanel.locator('.catalog-attribute-chip[aria-pressed="true"]').count(), 0);
        await page.locator(".catalog-expansion-card").first().click();
        assert.equal(await detailCount.textContent(), "符合條件：13 / 13 張卡片");
        assert.equal(await page.locator("#catalog-detail-name").textContent(), "C1");
        assert.equal(await detailCount.evaluate(element => getComputedStyle(element).textAlign), "right");
        await page.locator("#catalog-detail-search").fill("草");
        await chip(detailPanel, "pokemon", "type").click();
        await chip(detailPanel, "RR", "rarity").click();
        await chip(detailPanel, "grass").click();
        assert.equal(await detailCards.count(), 0);
        await detailClear.click();
        assert.equal(await detailPanel.locator('[aria-pressed="true"]').count(), 0);
        assert.equal(await globalPanel.locator('[aria-pressed="true"]').count(), 0);
        assert.equal(await page.locator("#catalog-detail-search").inputValue(), "");
        assert.equal(await detailCards.count(), 13);
        assert.equal(await detailCount.textContent(), "符合條件：13 / 13 張卡片");
        assert.ok(await detailClear.isDisabled());
        await page.locator("#catalog-detail-search").fill("不存在");
        assert.ok(await detailClear.isEnabled(), "Detail search must update the clear button immediately");
        await detailClear.click();
        assert.equal(await page.locator("#catalog-detail-search").inputValue(), "");
        assert.equal(await detailCards.count(), 13);
        assert.ok(await detailClear.isDisabled());
        await chip(detailPanel, "grass").click();
        assert.deepEqual(await names(detailCards), ["草測試寶可夢", "雙屬性卡"]);
        assert.equal(await page.locator("#catalog-detail-name").textContent(), "C1");
        assert.equal(await detailCount.textContent(), "符合條件：2 / 13 張卡片");
        await page.locator("#btn-toggle-catalog-cardtype").click();
        assert.equal(await page.locator(".catalog-card-type-group").count(), 1);
        assert.equal(await detailCards.count(), 2);
        assert.equal(await detailCount.textContent(), "符合條件：2 / 13 張卡片");
        await page.locator("#catalog-detail-search").fill("不存在");
        assert.equal(await detailCount.textContent(), "符合條件：0 / 13 張卡片");
        await page.locator("#catalog-detail-search").fill("雙屬性");
        assert.deepEqual(await names(detailCards), ["雙屬性卡"]);
        await chip(detailPanel, "water").click();
        assert.equal(await detailCards.count(), 1, "A dual-type card must not be duplicated");
        assert.equal(await detailCount.textContent(), "符合條件：1 / 13 張卡片");
        await page.locator("#catalog-detail-search").fill("");
        assert.equal(await detailCards.count(), 3);
        assert.equal(await detailCount.textContent(), "符合條件：3 / 13 張卡片");
        await page.locator("#btn-back-catalog-expansions").click();
        assert.equal(await globalCards.count(), 4);
        assert.equal(await chip(globalPanel, "grass").getAttribute("aria-pressed"), "true");
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#sidebar-toggle").click();
        await page.waitForFunction(() => document.getElementById("sidebar").getBoundingClientRect().width < 70);
        await globalPanel.scrollIntoViewIfNeeded();
        const bounds = await globalPanel.locator(".catalog-attribute-chip").evaluateAll(nodes => nodes.map(node => {
            const rect = node.getBoundingClientRect();
            return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
        }));
        assert.ok(bounds.every(rect => rect.left >= 0 && rect.right <= 390 && rect.width === 40 && rect.height === 40));
        await globalPanel.screenshot({ path: fileURLToPath(new URL(".cache/catalog-attribute-filters-mobile.png", root)) });
        await globalCount.scrollIntoViewIfNeeded();
        const countBounds = await globalCount.boundingBox();
        assert.ok(countBounds.x >= 0 && countBounds.x + countBounds.width <= 390);
        await globalCount.screenshot({ path: fileURLToPath(new URL(".cache/catalog-result-count-mobile.png", root)) });
        await chip(globalPanel, "fire").focus();
        await chip(globalPanel, "fire").press("Space");
        assert.equal(await chip(globalPanel, "fire").getAttribute("aria-pressed"), "true");
        await globalClear.scrollIntoViewIfNeeded();
        const clearBounds = await globalClear.boundingBox();
        assert.ok(clearBounds.x >= 0 && clearBounds.x + clearBounds.width <= 390);
        await globalPanel.screenshot({ path: fileURLToPath(new URL(".cache/catalog-clear-filters-mobile.png", root)) });
        await globalClear.click();
        assert.equal(await globalPanel.locator('[aria-pressed="true"]').count(), 0);
        assert.equal(await globalCount.textContent(), "此系列共 14 張卡片");
        await page.locator("#nav-general-cards").click();
        await page.locator("#nav-card-catalog").click();
        assert.equal(await globalPanel.locator('.catalog-attribute-chip[aria-pressed="true"]').count(), 0);
        assert.equal(await page.locator(".catalog-series-tab-btn.active").getAttribute("data-series"), "ALL");

        servedCards = Array.from({ length: 250 }, (_, index) => ({
            ...fixtures[0], expansion: index < 150 ? "C1" : "C2",
            id: `${index < 150 ? "C1" : "C2"}-${String(index + 1).padStart(3, "0")}`,
            name: index < 180 ? "分批草卡" : "分批火卡",
            pokemonTypes: [index < 180 ? "grass" : "fire"]
        }));
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.reload();
        await page.locator("#nav-card-catalog").click();
        await page.waitForFunction(() => document.querySelectorAll("#catalog-expansions-grid .catalog-card").length === 120);
        const more = page.locator("#btn-catalog-load-more");
        assert.equal(await globalCount.textContent(), "全圖鑑共 250 張卡片");
        assert.ok(await more.isVisible());
        assert.ok(await globalCards.locator('img[loading="lazy"]').count() === 120);
        assert.equal(await more.textContent(), "顯示更多（剩餘 130）");
        const desktopMoreBounds = await more.boundingBox();
        assert.equal(desktopMoreBounds.width, 276);
        assert.equal(desktopMoreBounds.height, 56);
        await more.screenshot({ path: fileURLToPath(new URL(".cache/catalog-load-more-desktop.png", root)) });
        await globalCards.first().evaluate(element => window.__firstCatalogCard = element);
        const requestsBeforeMore = catalogRequests;
        await more.click();
        assert.equal(await globalCards.count(), 240);
        assert.equal(await more.textContent(), "顯示更多（剩餘 10）");
        assert.ok(await globalCards.first().evaluate(element => window.__firstCatalogCard === element), "Loading more must preserve existing cards");
        await more.click();
        assert.equal(await globalCards.count(), 250);
        assert.equal(await more.isVisible(), false);
        assert.equal(catalogRequests, requestsBeforeMore, "Loading more must not download the catalog again");
        assert.equal(new Set(await globalCards.locator(".catalog-card-info span").allTextContents()).size, 250);
        await page.locator("#catalog-global-search").fill("分批草卡");
        assert.equal(await globalCards.count(), 120);
        assert.equal(await more.textContent(), "顯示更多（剩餘 60）");
        assert.equal(await globalCount.textContent(), "符合條件：180 張卡片");
        await more.click();
        assert.equal(await globalCards.count(), 180);
        assert.equal(await more.isVisible(), false);
        await globalClear.click();
        assert.equal(await globalCards.count(), 120);
        assert.equal(await more.textContent(), "顯示更多（剩餘 130）");
        await chip(globalPanel, "grass").click();
        await more.click();
        assert.equal(await globalCards.count(), 180);
        await chip(globalPanel, "C", "rarity").click();
        assert.equal(await globalCards.count(), 120, "Changing filters must reset the batch size");
        await globalClear.click();
        assert.equal(await globalCards.count(), 120);
        await page.locator("#catalog-global-search").fill("不存在");
        assert.equal(await globalCards.count(), 0);
        assert.equal(await more.isVisible(), false);
        await globalClear.click();
        assert.equal(await globalCards.count(), 120);
        await more.click();
        await page.locator('.catalog-series-tab-btn[data-series="C"]').click();
        assert.equal(await more.isVisible(), false);
        assert.equal(await page.locator(".catalog-expansion-card").count(), 2);
        await page.locator('.catalog-series-tab-btn[data-series="ALL"]').click();
        assert.equal(await globalCards.count(), 120);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.evaluate(() => document.querySelector(".main-content").scrollTop = 0);
        await page.screenshot({ path: fileURLToPath(new URL(".cache/catalog-overview-desktop.png", root)) });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#sidebar-toggle").click();
        await page.waitForFunction(() => document.getElementById("sidebar").getBoundingClientRect().width < 70);
        await more.scrollIntoViewIfNeeded();
        const moreBounds = await more.boundingBox();
        assert.ok(moreBounds.x >= 0 && moreBounds.x + moreBounds.width <= 390);
        assert.ok(await more.evaluate(button => button.scrollWidth <= button.clientWidth));
        await more.screenshot({ path: fileURLToPath(new URL(".cache/catalog-load-more-mobile.png", root)) });
        await more.click();
        assert.equal(await globalCards.count(), 240);
        assert.equal(await more.textContent(), "顯示更多（剩餘 10）");
        await page.locator('.catalog-series-tab-btn[data-series="ALL"]').click();
        await page.evaluate(() => document.querySelector(".main-content").scrollTop = 0);
        assert.ok(await page.locator(".catalog-series-tab-btn").evaluateAll(tabs => tabs.every(tab => {
            const rect = tab.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth;
        })));
        await page.screenshot({ path: fileURLToPath(new URL(".cache/catalog-overview-mobile.png", root)) });
        assert.deepEqual(errors, []);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
