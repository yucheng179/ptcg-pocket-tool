// 1. V6 資料結構：加入了 type (gallery/note) 和 parentId，以及 noteContent
const defaultData = {
    pages: [
        { id: "page_1", name: "Meta 陣容圖鑑", type: "gallery", parentId: null },
        { id: "page_2", name: "超夢牌組筆記", type: "note", parentId: null, noteContent: "<h1>超夢牌組起手策略</h1><p>先攻找沙奈朵...</p>" },
        { id: "page_3", name: "需要的替換卡", type: "gallery", parentId: "page_2" } // 這是 page_2 的子頁面
    ],
    cards: [
        {
            uuid: "c_123", // 💡 現在每張卡片都有獨一無二的 UUID 方便刪除
            name: "超夢 EX", id: "A1-045",
            imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png&w=300",
            pageId: "page_1" 
        }
    ]
};

let appData = JSON.parse(localStorage.getItem("ptcg_data_v6")) || defaultData;
let currentPageId = appData.pages.length > 0 ? appData.pages[0].id : null;

// 抓取 DOM
const sidebarMenu = document.getElementById("sidebar-menu");
const pageTitle = document.getElementById("page-title");
const badge = document.getElementById("page-type-badge");
const viewGallery = document.getElementById("view-gallery");
const viewNote = document.getElementById("view-note");
const galleryElement = document.getElementById("gallery");
const noteEditor = document.getElementById("note-editor");
const formModal = document.getElementById("form-modal");
const cardForm = document.getElementById("card-form");

function saveData() { localStorage.setItem("ptcg_data_v6", JSON.stringify(appData)); }

// --- 渲染側邊欄 (支援一階巢狀) ---
function renderSidebar() {
    sidebarMenu.innerHTML = "";
    
    // 先抓出所有「主頁面」(parentId 為 null)
    const rootPages = appData.pages.filter(p => p.parentId === null);

    rootPages.forEach(rootPage => {
        // 畫出主頁面
        sidebarMenu.appendChild(createPageElement(rootPage, false));

        // 尋找這個主頁面底下有沒有「子頁面」
        const subPages = appData.pages.filter(p => p.parentId === rootPage.id);
        subPages.forEach(subPage => {
            sidebarMenu.appendChild(createPageElement(subPage, true));
        });
    });
}

// 建立側邊欄單個項目的共用函式
function createPageElement(page, isSub) {
    const li = document.createElement("li");
    if (page.id === currentPageId) li.classList.add("active");
    if (isSub) li.classList.add("sub-page");

    // 圖示：圖鑑用 🎴，筆記用 📝
    const icon = page.type === "gallery" ? "🎴" : "📝";

    li.innerHTML = `
        <span class="page-name">${icon} ${page.name}</span>
        <div class="page-actions">
            ${!isSub ? `<button class="add-sub-btn" title="新增子頁面">➕</button>` : ''}
            <button class="del-btn" title="刪除">🗑️</button>
        </div>
    `;

    // 點擊切換頁面
    li.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON") return;
        currentPageId = page.id;
        renderSidebar(); 
        renderContent(); 
    });

    // 刪除頁面
    li.querySelector(".del-btn").addEventListener("click", () => {
        if (confirm(`確定刪除「${page.name}」嗎？`)) {
            // 刪除該頁面、其子頁面、以及關聯的卡片
            appData.pages = appData.pages.filter(p => p.id !== page.id && p.parentId !== page.id);
            appData.cards = appData.cards.filter(c => c.pageId !== page.id);
            currentPageId = appData.pages.length > 0 ? appData.pages[0].id : null;
            saveData(); renderSidebar(); renderContent();
        }
    });

    // 新增子頁面 (只有主頁面有這個按鈕)
    if (!isSub) {
        li.querySelector(".add-sub-btn").addEventListener("click", () => {
            createNewPage(page.id); // 傳入父層 ID
        });
    }
    return li;
}

// 新增頁面的邏輯 (主頁面與子頁面共用)
document.getElementById("add-page-btn").addEventListener("click", () => createNewPage(null));

function createNewPage(parentId) {
    const name = prompt("請輸入頁面名稱：");
    if (!name) return;
    const typeInput = prompt("請選擇類型 (輸入 1 或 2)：\n1. 卡片圖鑑\n2. 自由筆記", "1");
    const type = typeInput === "2" ? "note" : "gallery";

    const newPage = { id: "page_" + Date.now(), name: name, type: type, parentId: parentId, noteContent: "" };
    appData.pages.push(newPage);
    currentPageId = newPage.id;
    saveData(); renderSidebar(); renderContent();
}

// --- 渲染右側內容 (核心切換邏輯) ---
function renderContent() {
    const page = appData.pages.find(p => p.id === currentPageId);
    if (!page) { pageTitle.innerText = "請建立頁面"; viewGallery.style.display = "none"; viewNote.style.display = "none"; return; }

    pageTitle.innerText = page.name;
    badge.innerText = page.type === "gallery" ? "圖鑑模式" : "筆記模式";

    if (page.type === "gallery") {
        viewGallery.style.display = "block";
        viewNote.style.display = "none";
        renderGallery(page.id);
    } else {
        viewGallery.style.display = "none";
        viewNote.style.display = "block";
        noteEditor.innerHTML = page.noteContent || ""; // 載入筆記內容
    }
}

// 渲染畫廊與卡片刪除功能
function renderGallery(pageId) {
    galleryElement.innerHTML = "";
    const currentCards = appData.cards.filter(c => c.pageId === pageId);

    currentCards.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "card";
        cardEl.innerHTML = `
            <button class="delete-card-btn" data-id="${card.uuid}">✕</button>
            <img src="${card.imageUrl}" onerror="this.src='https://placehold.co/250x350?text=No+Image'">
            <h3>${card.name}</h3>
            <p style="color: #666; font-size: 13px;">編號: ${card.id}</p>
        `;
        // 刪除卡片事件
        cardEl.querySelector(".delete-card-btn").addEventListener("click", function() {
            const uuid = this.getAttribute("data-id");
            appData.cards = appData.cards.filter(c => c.uuid !== uuid);
            saveData(); renderGallery(pageId);
        });
        galleryElement.appendChild(cardEl);
    });

    const addBtn = document.createElement("div");
    addBtn.className = "add-new-card";
    addBtn.innerHTML = `<span>➕</span><div>新增卡片</div>`;
    addBtn.addEventListener("click", () => formModal.classList.add("show"));
    galleryElement.appendChild(addBtn);
}

// --- 即時儲存筆記內容 ---
// 每當你在筆記區打字，就會自動存入 localStorage
noteEditor.addEventListener("input", function() {
    const page = appData.pages.find(p => p.id === currentPageId);
    if (page && page.type === "note") {
        page.noteContent = this.innerHTML;
        saveData();
    }
});

// 表單相關邏輯
document.getElementById("close-modal").addEventListener("click", () => formModal.classList.remove("show"));
cardForm.addEventListener("submit", function(e) {
    e.preventDefault();
    appData.cards.push({
        uuid: "c_" + Date.now(), // 給予卡片唯一 ID
        name: document.getElementById("card-name").value,
        id: document.getElementById("card-id").value,
        imageUrl: document.getElementById("card-img").value,
        pageId: currentPageId
    });
    saveData(); formModal.classList.remove("show"); renderGallery(currentPageId); cardForm.reset();
});

// 啟動！
renderSidebar(); renderContent();