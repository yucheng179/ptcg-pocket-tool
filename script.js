import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
const cardsCollection = collection(db, "ptcg_cards"); 

let cardsData = [];
let currentSection = "alt_acc"; 
let currentAccountTab = "小帳";
let currentNeededTab = "缺少的卡"; 
let editingCardDocId = null; 
let draggedCardDocId = null; 

const raritiesAlt = [
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" },
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" },
    { name: "3星", icon: "https://img.game8.co/3995619/a0d611ce374e3070c530ee8d3fd81efa.png/show" },
    { name: "1彩星", icon: "https://img.game8.co/4137129/6510d1633ee489b2e8fcba939d7e99cb.png/show" }, 
    { name: "2彩星", icon: "https://img.game8.co/4137130/6eb953da81d509f5f6fde8f63ded90f6.png/show" },
    { name: "皇冠", icon: "https://img.game8.co/3997607/303598e292a532bcde37ab527a0ac263.png/show" }
];

const rarities24h = [
    { name: "3菱", icon: "https://img.game8.co/3995616/740cd3cbff061c16c8e5d8eea939bb59.png/show" }, 
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" },
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" }
];

const raritiesNeededMissing = [
    { name: "2菱", icon: "https://img.game8.co/3995615/ef7758a60d9c9d1871eca629c203b81e.png/show" },
    { name: "3菱", icon: "https://img.game8.co/3995616/740cd3cbff061c16c8e5d8eea939bb59.png/show" }, 
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" }
];

const raritiesNeededGold = [
    { name: "1菱", icon: "https://img.game8.co/3994728/d0cbe26800d9abdfccddbbfd5aeab3e5.png/show" }, 
    { name: "2菱", icon: "https://img.game8.co/3995615/ef7758a60d9c9d1871eca629c203b81e.png/show" },
    { name: "3菱", icon: "https://img.game8.co/3995616/740cd3cbff061c16c8e5d8eea939bb59.png/show" }
];

const typesGeneral = [
    { name: "支援者" },
    { name: "物品" },
    { name: "道具" },
    { name: "寶可夢" }
];

const rarityRowsContainerAlt = document.getElementById("rarity-rows-container");
const rarityRowsContainer24h = document.getElementById("rarity-rows-24h-container");
const rarityRowsContainerNeeded = document.getElementById("rarity-rows-needed-container");
const rarityRowsContainerGeneral = document.getElementById("rarity-rows-general-container");

const formModal = document.getElementById("form-modal");
const cardForm = document.getElementById("card-form");
const modalTitle = document.getElementById("modal-title");
const colorSwatches = document.querySelectorAll(".color-swatch");
const colorInput = document.getElementById("card-bgcolor");

// ==========================================
// 視圖切換與側邊欄折疊邏輯
// ==========================================
const navAltAcc = document.getElementById("nav-alt-acc");
const nav24h = document.getElementById("nav-24h-challenge");
const navNeeded = document.getElementById("nav-needed-cards");
const navGeneral = document.getElementById("nav-general-cards");

const viewAltAcc = document.getElementById("view-alt-acc");
const view24h = document.getElementById("view-24h-challenge");
const viewNeeded = document.getElementById("view-needed-cards");
const viewGeneral = document.getElementById("view-general-cards");

const pageTitle = document.getElementById("page-title");

// 🪄 加入控制側邊欄折疊的 JS
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

function switchSection(sectionName, titleText, navEl, viewEl) {
    currentSection = sectionName;
    [navAltAcc, nav24h, navNeeded, navGeneral].forEach(el => el.classList.remove("active"));
    [viewAltAcc, view24h, viewNeeded, viewGeneral].forEach(el => el.style.display = "none");
    
    navEl.classList.add("active");
    viewEl.style.display = "block";
    pageTitle.innerText = titleText;
    renderAllViews();
}

navAltAcc.addEventListener("click", () => switchSection("alt_acc", "小帳資源", navAltAcc, viewAltAcc));
nav24h.addEventListener("click", () => switchSection("24h", "24H得卡挑戰", nav24h, view24h));
navNeeded.addEventListener("click", () => switchSection("needed_cards", "需要的卡", navNeeded, viewNeeded));
navGeneral.addEventListener("click", () => switchSection("general_cards", "泛用卡", navGeneral, viewGeneral));

// ==========================================
// 渲染邏輯
// ==========================================
function renderAllViews() {
    if (currentSection === "alt_acc") {
        renderAltAccRows();
    } else if (currentSection === "24h") {
        render24hRows();
    } else if (currentSection === "needed_cards") {
        renderNeededCardsRows();
    } else if (currentSection === "general_cards") {
        renderGeneralCardsRows();
    }
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

        cardEl.innerHTML = `
            <button class="toggle-main-btn" title="切換分類狀態">🔄</button>
            <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            <div class="card-info">
                <strong>${displayName}</strong>
                ${displayId}
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
        cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); const d = { ...card }; delete d.docId; d.generalData.order = Date.now(); await addDoc(cardsCollection, d); });
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

// --- 渲染：需要的卡 ---
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
            cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); const duplicatedCardObj = { ...card }; delete duplicatedCardObj.docId; duplicatedCardObj.neededCardsData.order = Date.now(); await addDoc(cardsCollection, duplicatedCardObj); });
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
        rarityRowsContainerNeeded.appendChild(rowBlock);
    });
}

// --- 渲染：24H 得卡挑戰 ---
function render24hRows() {
    rarityRowsContainer24h.innerHTML = "";
    rarities24h.forEach(rarity => {
        const targetCards = cardsData.filter(c => c.section === "24h" && c.rarity === rarity.name);
        const ownedCount = targetCards.filter(c => c.computedOwnership && c.computedOwnership !== "無").length;
        
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
            cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); const d = { ...card }; delete d.docId; delete d.computedOwnership; await addDoc(cardsCollection, d); });
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
        rowBlock.innerHTML = `<div class="rarity-header"><img src="${rarity.icon}"><span>${rarity.name}</span></div>`;
        createHorizontalRowAlt(rowBlock, targetCards, "false", "主帳沒有的", "not-on-main", rarity.name);
        createHorizontalRowAlt(rowBlock, targetCards, "true", "主帳有的", "on-main", rarity.name);
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

        cardEl.innerHTML = `
            <button class="toggle-main-btn" title="切換主帳狀態">🔄</button>
            <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            <div class="card-info"><strong>${displayName}</strong>${displayId}</div>
            <button class="del-card-btn" title="刪除卡片">✕</button>
            <button class="copy-card-btn" title="複製卡片">📄</button>
            <button class="view-card-btn" title="放大預覽">🔍</button>
        `;

        cardEl.querySelector('.toggle-main-btn').addEventListener('click', async (e) => { e.stopPropagation(); const newStatus = (card.altAccData?.hasOnMain === "true") ? "false" : "true"; await updateDoc(doc(db, "ptcg_cards", card.docId), { altAccData: { accountType: card.altAccData?.accountType || "小帳", hasOnMain: newStatus }, section: "alt_acc" }); });
        cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); if(confirm("確定要刪除？")) await deleteDoc(doc(db, "ptcg_cards", card.docId)); });
        cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); const d = { ...card }; delete d.docId; delete d.computedOwnership; await addDoc(cardsCollection, d); });
        cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
        cardEl.addEventListener('click', () => openEditModal(card.docId));
        cardsListDiv.appendChild(cardEl);
    });

    const inlineAddBtn = document.createElement("div");
    inlineAddBtn.className = "add-new-card-box";
    inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
    inlineAddBtn.addEventListener("click", () => openNewModal(rarityName, null));
    cardsListDiv.appendChild(inlineAddBtn);

    statusRow.appendChild(cardsListDiv);
    parentBlock.appendChild(statusRow);
}

// ==========================================
// Modal 表單控制
// ==========================================
function setupModalFields() {
    const groupAccType = document.getElementById("group-acc-type");
    const groupHasMain = document.getElementById("group-has-main");
    const groupOwnership = document.getElementById("group-ownership");
    const groupNeededQty = document.getElementById("group-needed-qty");
    const groupNeededTab = document.getElementById("group-needed-tab");
    
    const groupRarity = document.getElementById("group-rarity");
    const groupGeneralType = document.getElementById("group-general-type");
    const groupGeneralSubtype = document.getElementById("group-general-subtype");

    [groupAccType, groupHasMain, groupOwnership, groupNeededQty, groupNeededTab, groupGeneralType, groupGeneralSubtype].forEach(g => g.style.display = "none");
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
    } else { 
        groupAccType.style.display = "flex";
        groupHasMain.style.display = "flex";
    }
}

function openNewModal(rarityName, typeName = null, hasMainVal = null) {
    editingCardDocId = null; 
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
    
    document.getElementById("card-bgcolor").value = "#ffffff";
    colorSwatches.forEach(s => s.classList.remove("selected"));
    colorSwatches[0].classList.add("selected");

    formModal.classList.add("show");
}

function openEditModal(docId) {
    const card = cardsData.find(c => c.docId === docId);
    if (card) {
        editingCardDocId = docId; 
        modalTitle.innerText = "✏️ 編輯卡片資料"; 
        
        const originalSection = currentSection; 
        currentSection = card.section || "alt_acc";
        setupModalFields();
        currentSection = originalSection; 

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
        
        const cardBg = card.bgColor || "#ffffff";
        colorInput.value = cardBg;
        colorSwatches.forEach(s => s.classList.remove("selected"));
        const matchSwatch = Array.from(colorSwatches).find(s => s.getAttribute("data-color").toUpperCase() === cardBg.toUpperCase());
        if (matchSwatch) matchSwatch.classList.add("selected");

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

    const cardObj = {
        name: document.getElementById("card-name").value.trim(),
        id: document.getElementById("card-id").value.trim(),
        imageUrl: document.getElementById("card-img").value.trim(),
        rarity: document.getElementById("card-rarity").value,
        bgColor: document.getElementById("card-bgcolor").value,
        section: saveSection 
    };

    if (saveSection === "24h") {
        cardObj.challenge24hData = { ownership: document.getElementById("card-ownership").value };
    } else if (saveSection === "needed_cards") {
        const currentQty = parseInt(document.getElementById("card-needed-qty").value) || 1;
        cardObj.neededCardsData = { 
            quantity: currentQty,
            tab: document.getElementById("card-needed-tab").value,
            order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.neededCardsData?.order || Date.now()) : Date.now()
        };
    } else if (saveSection === "general_cards") {
        cardObj.generalData = {
            type: document.getElementById("card-general-type").value,
            hasOnMain: document.getElementById("card-general-subtype").value,
            order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.generalData?.order || Date.now()) : Date.now()
        };
        cardObj.rarity = ""; 
    } else {
        cardObj.altAccData = { accountType: document.getElementById("card-acc-type").value, hasOnMain: document.getElementById("card-has-main").value };
    }
    
    if (editingCardDocId) {
        await updateDoc(doc(db, "ptcg_cards", editingCardDocId), cardObj);
    } else {
        await addDoc(cardsCollection, cardObj);
    }

    formModal.classList.remove("show");
    submitBtn.innerText = "儲存";
    submitBtn.disabled = false;
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
colorInput.addEventListener("input", () => colorSwatches.forEach(s => s.classList.remove("selected")));

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

const lightboxModal = document.getElementById('lightbox-modal');
document.getElementById('close-modal').addEventListener("click", () => formModal.classList.remove("show"));
document.getElementById('lightbox-close').addEventListener('click', () => lightboxModal.classList.remove('show'));
window.addEventListener("click", (e) => { 
    if (e.target === formModal) formModal.classList.remove("show"); 
    if (e.target === lightboxModal) lightboxModal.classList.remove('show');
});

// ==========================================
// 終極即時連線引擎
// ==========================================
rarityRowsContainerAlt.innerHTML = "<p style='text-align:center; color:#888; padding:20px;'>📡 建立即時連線中...</p>";

onSnapshot(cardsCollection, (snapshot) => {
    const rawCards = snapshot.docs.map(doc => {
        const data = doc.data();
        const section = data.section || "alt_acc";
        
        let altAccData = data.altAccData || (section === "alt_acc" ? { accountType: data.accountType, hasOnMain: data.hasOnMain } : null);
        let challenge24hData = data.challenge24hData || (section === "24h" ? { ownership: data.ownership } : null);
        let neededCardsData = data.neededCardsData || (section === "needed_cards" ? { quantity: data.quantity || 1, order: data.order || Date.now(), tab: data.tab || "缺少的卡" } : null);
        
        let generalData = data.generalData || (section === "general_cards" ? { type: data.type || "支援者", order: data.order || Date.now(), hasOnMain: data.hasOnMain || "false" } : null);
        if (generalData && !generalData.hasOnMain) generalData.hasOnMain = "false";

        return { docId: doc.id, ...data, section, altAccData, challenge24hData, neededCardsData, generalData };
    });

    const altAccStatusMap = {};
    rawCards.filter(c => c.section === "alt_acc" && c.id && c.id.trim() !== "").forEach(c => {
        const accType = c.altAccData?.accountType;
        const currentHighest = altAccStatusMap[c.id];
        if (accType === "資源帳") {
            altAccStatusMap[c.id] = "資源帳";
        } else if (accType === "小帳" && currentHighest !== "資源帳") {
            altAccStatusMap[c.id] = "小帳";
        }
    });

    cardsData = rawCards.map(c => {
        if (c.section === "24h") {
            let dbOwnership = c.challenge24hData?.ownership || "無";
            if (dbOwnership !== "取得" && c.id && altAccStatusMap[c.id]) {
                c.computedOwnership = altAccStatusMap[c.id]; 
            } else {
                c.computedOwnership = dbOwnership;
            }
        }
        return c;
    });
    
    renderAllViews();
});