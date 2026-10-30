import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("crawler/raenonx-cards.json", root), "utf8"));
const makeCard = (docId, name, type, extra = {}) => ({
    docId, name, id: docId, section: "general_cards", imageUrl: catalog[0].imageUrl,
    generalData: { type, hasOnMain: "false", order: 1, tagName: "共用標籤", tagColor: "#787774", ...extra }
});
const fixtures = [
    makeCard("old-support", "舊支援者", "支援者"),
    makeCard("old-item", "舊特別物品", "物品", { hasOnMain: "true" }),
    makeCard("grass-a", "草寶可夢甲", "寶可夢", { tab: "各屬性", attribute: "草" }),
    makeCard("grass-b", "草寶可夢乙", "寶可夢", { tab: "各屬性", attribute: "草", order: 2 }),
    makeCard("grass-support", "草支援者", "支援者", { tab: "各屬性", attribute: "草" }),
    makeCard("grass-item", "草物品", "物品", { tab: "各屬性", attribute: "草" }),
    makeCard("water-a", "水寶可夢", "寶可夢", { tab: "各屬性", attribute: "水" }),
    makeCard("fire-tool", "火道具", "道具", { tab: "各屬性", attribute: "火" }),
    makeCard("fire-stadium", "火競技場", "競技場", { tab: "各屬性", attribute: "火" }),
    { ...makeCard("other-section", "其他頁卡片", "支援者"), section: "needed_cards" }
];

test("general tabs preserve legacy cards and save attribute cards through all workflows", async () => {
    await mkdir(new URL(".cache/", root), { recursive: true });
    const bridge = `
        window.__general = {
            load(cards) { cardsData = cards; rebuildUniqueCardsDict(cardsData); switchSection('general_cards', '泛用卡', navGeneral, viewGeneral); },
            state() { return structuredClone(cardsData); },
            context() { return getAutocompleteMatches('', cardAutocompleteContext).map(item => item.data.cardType); },
            add(data) { const id = 'new-' + cardsData.length; cardsData.push({docId:id, ...structuredClone(data)}); this.refresh(); return {id}; },
            update(ref, changes) {
                const card = cardsData.find(card => card.docId === ref.id);
                for (const [path,value] of Object.entries(changes)) {
                    const keys = path.split('.'); let target = card;
                    for (const key of keys.slice(0,-1)) target = target[key];
                    target[keys.at(-1)] = structuredClone(value);
                }
                this.refresh();
            },
            remove(ref) { cardsData = cardsData.filter(card => card.docId !== ref.id); this.refresh(); },
            refresh() { rebuildUniqueCardsDict(cardsData); renderAllViews(); }
        };
    `;
    const modules = {
        "firebase-app.js": "export const initializeApp=()=>({});",
        "firebase-auth.js": "export const browserLocalPersistence={}; export const getAuth=()=>({}); export class GoogleAuthProvider{setCustomParameters(){}} export const getRedirectResult=async()=>null; export const onAuthStateChanged=()=>{}; export const setPersistence=async()=>{}; export const signInWithPopup=async()=>{}; export const signInWithRedirect=async()=>{}; export const signOut=async()=>{};",
        "firebase-firestore.js": `export const getFirestore=()=>({}); export const collection=()=>({}); export const doc=(...args)=>({id:args.at(-1)}); export const onSnapshot=()=>()=>{};
            export const addDoc=async(ref,data)=>window.__general.add(data); export const updateDoc=async(ref,data)=>window.__general.update(ref,data); export const deleteDoc=async(ref)=>window.__general.remove(ref);
            export const writeBatch=()=>{const operations=[];return{update(ref,data){operations.push([ref,data]);},async commit(){if(window.__failBatch)throw new Error('test batch failure');for(const [ref,data] of operations)window.__general.update(ref,data);}}};`
    };
    const allowed = new Set(["index.html", "style.css", "script.js", "deck-qr.mjs", "crawler/raenonx-cards.json"]);
    const server = createServer(async (request, response) => {
        const path = new URL(request.url, "http://local").pathname.slice(1) || "index.html";
        if (!allowed.has(path)) { response.writeHead(404).end(); return; }
        let content = await readFile(new URL(path, root));
        if (path === "script.js") content = Buffer.concat([content, Buffer.from(bridge)]);
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
        await page.waitForFunction(() => window.__general);
        await page.evaluate(cards => window.__general.load(cards), fixtures);
        const blocks = page.locator("#rarity-rows-general-container > .rarity-row-block");
        const attributeTab = page.locator('.general-tab-btn[data-general="各屬性"]');
        const commonTab = page.locator('.general-tab-btn[data-general="通用"]');
        const grass = page.locator('.general-attribute-block[data-attribute="草"]');
        const water = page.locator('.general-attribute-block[data-attribute="水"]');
        const close = () => page.locator("#close-modal").click();
        const save = async () => {
            await page.locator('#card-form button[type="submit"]').click();
            await page.waitForFunction(() => !document.getElementById("form-modal").classList.contains("show"));
        };
        const state = () => page.evaluate(() => window.__general.state());
        const renameTag = async newName => {
            const dialogs = [];
            const handler = async dialog => {
                dialogs.push({ type: dialog.type(), message: dialog.message() });
                if (dialog.type() === "prompt") {
                    if (newName === null) await dialog.dismiss();
                    else await dialog.accept(newName);
                } else await dialog.accept();
            };
            page.on("dialog", handler);
            try {
                await page.locator(".general-tag-rename-option").click();
                await page.waitForFunction(() => !document.querySelector(".general-tag-rename-option")?.disabled);
            } finally {
                page.off("dialog", handler);
            }
            return dialogs;
        };
        const named = (parent, name) => parent.locator(".card-box").filter({ has: page.locator(".card-info strong", { hasText: name }) });

        assert.equal(await blocks.count(), 5);
        assert.deepEqual(await blocks.locator(".general-header-title").allTextContents(), ["支援者", "物品", "道具", "競技場", "寶可夢"]);
        assert.equal(await blocks.locator(".card-box").count(), 2);
        await attributeTab.click();
        assert.deepEqual(await blocks.locator(".general-header-title").allTextContents(), ["草", "火", "水", "電", "超", "鬥", "惡", "鋼", "龍", "無"]);
        assert.equal(await blocks.locator(".status-row").count(), 30);
        assert.deepEqual(await grass.locator(".status-label").allTextContents(), ["寶可夢", "支援者", "物品、道具、競技場"]);
        assert.equal(await blocks.locator(".toggle-main-btn").count(), 0);
        assert.equal(await page.locator('.general-attribute-block[data-attribute="火"] .status-row').nth(2).locator(".card-box").count(), 2);

        await grass.locator(".status-row").first().locator(".add-new-card-box").click();
        assert.equal(await page.locator("#card-general-tab").inputValue(), "各屬性");
        assert.equal(await page.locator("#card-general-attribute").inputValue(), "草");
        assert.equal(await page.locator("#card-general-type").inputValue(), "寶可夢");
        assert.equal(await page.locator("#group-general-subtype").isVisible(), false);
        assert.ok((await page.evaluate(() => window.__general.context())).every(type => type === "pokemon"));
        await page.locator("#card-name").fill("新增草卡");
        await page.locator("#card-id").fill("TEST-001");
        await page.locator("#card-general-tag-name").fill("首建藍標籤");
        const createTag = page.locator(".general-tag-create");
        assert.equal(await createTag.locator(".general-tag-pill").textContent(), "首建藍標籤");
        await createTag.focus();
        await createTag.press("Enter");
        assert.ok(await page.locator("#form-modal").evaluate(modal => modal.classList.contains("show")));
        assert.ok(await page.locator("#general-tag-color-popover").isVisible());
        assert.equal(await page.locator(".general-tag-delete-option").count(), 0);
        assert.equal(await page.locator(".general-tag-rename-option").count(), 0);
        await page.screenshot({ path: fileURLToPath(new URL(".cache/general-tag-new-desktop.png", root)) });
        await page.locator(".general-tag-color-option").filter({ hasText: "藍色" }).click();
        await save();
        let added = (await state()).find(card => card.name === "新增草卡");
        assert.equal(added.generalData.attribute, "草");
        assert.equal(added.generalData.tab, "各屬性");
        assert.equal(added.generalData.tagName, "首建藍標籤");
        assert.equal(added.generalData.tagColor, "#337ea9");
        await named(grass, "新增草卡").click();
        await page.locator("#card-general-attribute").selectOption("水");
        assert.equal(await page.locator("#card-general-tag-name").inputValue(), "首建藍標籤");
        assert.equal(await page.locator("#card-general-tag-color").inputValue(), "#337ea9");
        await save();
        assert.equal(await named(grass, "新增草卡").count(), 0);
        assert.equal(await named(water, "新增草卡").count(), 1);
        await named(water, "新增草卡").hover();
        await named(water, "新增草卡").locator(".copy-card-btn").click();
        assert.equal((await state()).filter(card => card.name === "新增草卡" && card.generalData.attribute === "水").length, 2);
        page.once("dialog", dialog => dialog.accept());
        await named(water, "新增草卡").last().hover();
        await named(water, "新增草卡").last().locator(".del-card-btn").click();
        assert.equal(await named(water, "新增草卡").count(), 1);

        await grass.locator(".status-row").nth(2).locator(".add-new-card-box").click();
        assert.equal(await page.locator("#card-general-type").inputValue(), "物品、道具、競技場");
        const contextTypes = await page.evaluate(() => window.__general.context());
        assert.ok(contextTypes.length > 0 && contextTypes.every(type => ["item", "pokemontool", "stadium"].includes(type)));
        await close();
        await named(grass, "草物品").click();
        await page.locator("#card-general-tab").selectOption("通用");
        assert.equal(await page.locator("#card-general-type").inputValue(), "物品");
        assert.ok(await page.locator("#group-general-subtype").isVisible());
        await save();
        await commonTab.click();
        assert.equal(await named(blocks, "草物品").count(), 1);
        await named(blocks, "舊支援者").hover();
        await named(blocks, "舊支援者").locator(".toggle-main-btn").click();
        assert.equal((await state()).find(card => card.docId === "old-support").generalData.hasOnMain, "true");
        await attributeTab.click();

        await named(grass, "草支援者").click();
        await page.locator("#card-general-tag-name").click();
        assert.equal(await page.locator('.general-tag-option[data-tag-name="首建藍標籤"]').count(), 1);
        assert.equal(await page.locator('.general-tag-option[data-tag-name="共用標籤"]').count(), 1);
        await page.locator("#card-general-type").selectOption("寶可夢");
        assert.equal(await page.locator("#card-general-tag-name").inputValue(), "共用標籤");
        await page.locator("#card-general-type").selectOption("支援者");
        await page.locator("#card-general-tag-name").fill("共用標籤");
        await page.locator('.general-tag-option[data-tag-name="共用標籤"] .general-tag-more').click();
        await page.locator(".general-tag-color-option").filter({ hasText: "粉色" }).click();
        await save();
        let records = await state();
        assert.ok(records.filter(card => card.section === "general_cards" && card.generalData.tagName === "共用標籤").every(card => card.generalData.tagColor === "#c14c8a"));
        assert.equal(records.find(card => card.docId === "water-a").generalData.tagColor, "#c14c8a");
        assert.equal(records.find(card => card.docId === "old-support").generalData.tagColor, "#c14c8a");
        assert.equal(records.find(card => card.docId === "other-section").generalData.tagColor, "#787774");
        await named(grass, "草支援者").click();
        await page.locator("#card-general-tag-name").click();
        await page.locator('.general-tag-option[data-tag-name="共用標籤"]').dragTo(page.locator('.general-tag-option[data-tag-name="首建藍標籤"]'));
        const sharedOrder = await page.locator(".general-tag-option").evaluateAll(options => options.map(option => option.dataset.tagName));
        await close();
        await named(water, "水寶可夢").click();
        await page.locator("#card-general-tag-name").click();
        assert.deepEqual(await page.locator(".general-tag-option").evaluateAll(options => options.map(option => option.dataset.tagName)), sharedOrder);
        await page.locator('.general-tag-option[data-tag-name="共用標籤"] .general-tag-more').click();
        await page.screenshot({ path: fileURLToPath(new URL(".cache/general-tag-rename-desktop.png", root)) });
        const beforeRename = await state();
        await renameTag(null);
        assert.deepEqual(await state(), beforeRename);
        const emptyName = await renameTag("   ");
        assert.ok(emptyName.some(dialog => dialog.type === "alert" && dialog.message.includes("不能為空白")));
        assert.deepEqual(await state(), beforeRename);
        const duplicateName = await renameTag("首建藍標籤");
        assert.ok(duplicateName.some(dialog => dialog.type === "alert" && dialog.message.includes("相同名稱")));
        assert.deepEqual(await state(), beforeRename);
        await page.evaluate(() => window.__failBatch = true);
        const failedRename = await renameTag("全頁標籤");
        assert.ok(failedRename.some(dialog => dialog.type === "alert" && dialog.message.includes("更名失敗")));
        assert.deepEqual(await state(), beforeRename);
        assert.equal(await page.locator("#card-general-tag-name").inputValue(), "共用標籤");
        await page.evaluate(() => window.__failBatch = false);
        await renameTag("全頁標籤");
        records = await state();
        const renamedCards = records.filter(card => card.section === "general_cards" && card.generalData.tagName === "全頁標籤");
        assert.equal(renamedCards.length, beforeRename.filter(card => card.section === "general_cards" && card.generalData.tagName === "共用標籤").length);
        assert.ok(renamedCards.every(card => card.generalData.tagColor === "#c14c8a"));
        assert.equal(records.find(card => card.docId === "other-section").generalData.tagName, "共用標籤");
        assert.equal(records.find(card => card.name === "新增草卡").generalData.tagName, "首建藍標籤");
        assert.equal(await page.locator("#card-general-tag-name").inputValue(), "全頁標籤");
        assert.deepEqual(await page.locator(".general-tag-option").evaluateAll(options => options.map(option => option.dataset.tagName)), sharedOrder.map(name => name === "共用標籤" ? "全頁標籤" : name));
        await save();
        assert.equal((await state()).find(card => card.docId === "water-a").generalData.tagName, "全頁標籤");
        await commonTab.click();
        assert.equal(await named(blocks, "舊支援者").locator(".general-card-tag").textContent(), "全頁標籤");
        await attributeTab.click();
        await named(water, "水寶可夢").click();
        await page.locator("#card-general-tag-name").click();
        await page.locator('.general-tag-option[data-tag-name="全頁標籤"] .general-tag-more').click();
        page.once("dialog", dialog => dialog.accept());
        await page.locator(".general-tag-delete-option").click();
        records = await state();
        assert.ok(records.filter(card => card.generalData.attribute === "草").every(card => card.generalData.tagName === ""));
        assert.equal(records.find(card => card.docId === "water-a").generalData.tagName, "");
        assert.equal(records.find(card => card.docId === "old-support").generalData.tagName, "");
        assert.equal(records.find(card => card.docId === "other-section").generalData.tagName, "共用標籤");
        assert.equal(records.find(card => card.name === "新增草卡").generalData.tagName, "首建藍標籤");
        await close();

        await named(grass, "草寶可夢甲").dragTo(named(grass, "草寶可夢乙"));
        records = await state();
        assert.ok(records.find(card => card.docId === "grass-a").generalData.order > records.find(card => card.docId === "grass-b").generalData.order);
        await grass.locator(".rarity-header").click();
        await named(water, "水寶可夢").click();
        await save();
        assert.ok(await grass.evaluate(element => element.classList.contains("collapsed")));
        await commonTab.click();
        assert.equal(await blocks.count(), 5);
        await attributeTab.click();
        assert.ok(await grass.evaluate(element => element.classList.contains("collapsed")));
        await grass.locator(".rarity-header").click();
        await mkdir(new URL(".cache/", root), { recursive: true });
        await grass.screenshot({ path: fileURLToPath(new URL(".cache/general-attributes-desktop.png", root)) });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#sidebar-toggle").click();
        await page.waitForFunction(() => document.getElementById("sidebar").getBoundingClientRect().width < 70);
        await grass.screenshot({ path: fileURLToPath(new URL(".cache/general-attributes-mobile.png", root)) });
        const noOverlap = await grass.locator(".status-row").evaluateAll(rows => rows.every(row => {
            const label = row.querySelector(".status-label").getBoundingClientRect();
            const content = row.querySelector(".cards-horizontal-list").getBoundingClientRect();
            return label.right <= content.left + 1 || label.bottom <= content.top + 1;
        }));
        assert.ok(noOverlap);
        const withinBlock = await grass.evaluate(block => {
            const bounds = block.getBoundingClientRect();
            return Array.from(block.querySelectorAll(".card-box, .add-new-card-box")).every(card => {
                const rect = card.getBoundingClientRect();
                return rect.left >= bounds.left && rect.right <= bounds.right;
            });
        });
        assert.ok(withinBlock, "Mobile cards must fit inside the attribute block");
        await named(grass, "草支援者").click();
        await page.locator("#card-general-tag-name").fill("手機初次新增");
        await page.locator(".general-tag-create").click();
        const paletteBounds = await page.locator("#general-tag-color-popover").boundingBox();
        assert.ok(paletteBounds.x >= 0 && paletteBounds.x + paletteBounds.width <= 390);
        assert.ok(paletteBounds.y >= 0 && paletteBounds.y + paletteBounds.height <= 844);
        await page.screenshot({ path: fileURLToPath(new URL(".cache/general-tag-new-mobile.png", root)) });
        await page.locator(".general-tag-color-option").filter({ hasText: "綠色" }).click();
        assert.equal(await page.locator("#card-general-tag-color").inputValue(), "#448361");
        await close();
        await page.setViewportSize({ width: 640, height: 360 });
        await named(water, "新增草卡").click();
        await page.locator("#card-general-tag-name").click();
        await page.locator('.general-tag-option[data-tag-name="首建藍標籤"] .general-tag-more').click();
        await page.locator(".general-tag-delete-option").scrollIntoViewIfNeeded();
        const smallPalette = await page.locator("#general-tag-color-popover").boundingBox();
        const deleteBounds = await page.locator(".general-tag-delete-option").boundingBox();
        assert.ok(smallPalette.y >= 0 && smallPalette.y + smallPalette.height <= 360);
        assert.ok(deleteBounds.y >= 0 && deleteBounds.y + deleteBounds.height <= 360);
        await page.screenshot({ path: fileURLToPath(new URL(".cache/general-tag-rename-mobile.png", root)) });
        assert.equal(errors.length, 0, errors.join("\n"));
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
});
