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
let uniqueCardsDict = {}; 

let currentSection = "alt_acc"; 
let currentAccountTab = "小帳";
let currentNeededTab = "缺少的卡"; 
let currentTwoStarTab = "擁有的卡"; 
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

const raritiesTwoStar = [
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" },
    { name: "2彩星", icon: "https://img.game8.co/4137130/6eb953da81d509f5f6fde8f63ded90f6.png/show" }
];

const typesGeneral = [
    { name: "支援者" },
    { name: "物品" },
    { name: "道具" },
    { name: "寶可夢" }
];

const tierWeights = { "SS": 8, "S": 7, "A": 6, "B": 5, "C": 4, "D": 3, "E": 2, "無": 1 };

const rarityRowsContainerAlt = document.getElementById("rarity-rows-container");
const rarityRowsContainer24h = document.getElementById("rarity-rows-24h-container");
const rarityRowsContainerNeeded = document.getElementById("rarity-rows-needed-container");
const rarityRowsContainerGeneral = document.getElementById("rarity-rows-general-container");
const rarityRowsContainerTwoStar = document.getElementById("rarity-rows-two-star-container");

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
const navTwoStar = document.getElementById("nav-two-star-cards");

const viewAltAcc = document.getElementById("view-alt-acc");
const view24h = document.getElementById("view-24h-challenge");
const viewNeeded = document.getElementById("view-needed-cards");
const viewGeneral = document.getElementById("view-general-cards");
const viewTwoStar = document.getElementById("view-two-star-cards");

const pageTitle = document.getElementById("page-title");

const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
sidebarToggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
});

function switchSection(sectionName, titleText, navEl, viewEl) {
    currentSection = sectionName;
    [navAltAcc, nav24h, navNeeded, navGeneral, navTwoStar].forEach(el => el.classList.remove("active"));
    [viewAltAcc, view24h, viewNeeded, viewGeneral, viewTwoStar].forEach(el => el.style.display = "none");
    
    navEl.classList.add("active");
    viewEl.style.display = "block";
    pageTitle.innerText = titleText;
    renderAllViews();
}

navAltAcc.addEventListener("click", () => switchSection("alt_acc", "小帳資源", navAltAcc, viewAltAcc));
nav24h.addEventListener("click", () => switchSection("24h", "24H得卡挑戰", nav24h, view24h));
navNeeded.addEventListener("click", () => switchSection("needed_cards", "需要卡", navNeeded, viewNeeded));
navGeneral.addEventListener("click", () => switchSection("general_cards", "泛用卡", navGeneral, viewGeneral));
navTwoStar.addEventListener("click", () => switchSection("two_star_cards", "二星", navTwoStar, viewTwoStar));

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
    } else if (currentSection === "two_star_cards") {
        renderTwoStarCardsRows();
    }
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

// --- 渲染：二星 ---
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
            } else if (rarity.name === "2彩星") {
                createTwoStarRow(rowBlock, targetCards, "寶可夢", "寶可夢", "general-row-bottom", rarity.name);
            }
        }
        
        rarityRowsContainerTwoStar.appendChild(rowBlock);
    });
}

function createTwoStarRow(parentBlock, cards, filterVal, labelText, className, rarityName) {
    const statusRow = document.createElement("div");
    statusRow.className = `status-row ${className}`;
    statusRow.innerHTML = `<div class="status-label">${labelText}</div>`;

    const cardsListDiv = document.createElement("div");
    cardsListDiv.className = "cards-horizontal-list";

    const filteredCards = cards.filter(c => {
        if (currentTwoStarTab === "擁有的卡") return c.twoStarData?.status === filterVal;
        if (currentTwoStarTab === "想要的卡" || currentTwoStarTab === "被交換的") return c.twoStarData?.type === filterVal;
        return false;
    });

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
        // 🪄 Bug Fix: 之前這裡也缺少了 hasMainVal，補上 "true" 參數
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
        cardEl.querySelector('.copy-card-btn').addEventListener('click', async (e) => { e.stopPropagation(); await handleSafeCopyCard(card); });
        cardEl.querySelector('.view-card-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('lightbox-img').src = displayImg; document.getElementById('lightbox-modal').classList.add('show'); });
        cardEl.addEventListener('click', () => openEditModal(card.docId));
        cardsListDiv.appendChild(cardEl);
    });

    const inlineAddBtn = document.createElement("div");
    inlineAddBtn.className = "add-new-card-box";
    inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
    // 🪄 Bug Fix: 把 hasMainVal 傳入 openNewModal，這樣點「主帳有的」的新增按鈕就不會變回「沒有」了！
    inlineAddBtn.addEventListener("click", () => openNewModal(rarityName, null, hasMainVal));
    cardsListDiv.appendChild(inlineAddBtn);

    statusRow.appendChild(cardsListDiv);
    parentBlock.appendChild(statusRow);
}

// ==========================================
// Modal 表單控制
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

function setupModalFields() {
    const groupAccType = document.getElementById("group-acc-type");
    const groupHasMain = document.getElementById("group-has-main");
    const groupOwnership = document.getElementById("group-ownership");
    const groupNeededQty = document.getElementById("group-needed-qty");
    const groupNeededTab = document.getElementById("group-needed-tab");
    
    const groupRarity = document.getElementById("group-rarity");
    const groupGeneralType = document.getElementById("group-general-type");
    const groupGeneralSubtype = document.getElementById("group-general-subtype");

    const groupTwoStarTab = document.getElementById("group-two-star-tab");
    const groupTwoStarStatus = document.getElementById("group-two-star-status");
    const groupTwoStarType = document.getElementById("group-two-star-type");
    const groupTwoStarTier = document.getElementById("group-two-star-tier");

    [groupAccType, groupHasMain, groupOwnership, groupNeededQty, groupNeededTab, groupGeneralType, groupGeneralSubtype, groupTwoStarTab, groupTwoStarStatus, groupTwoStarType, groupTwoStarTier].forEach(g => g.style.display = "none");
    
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
    } else if (currentSection === "two_star_cards") {
        groupTwoStarTab.style.display = "flex";
        if (currentTwoStarTab === "擁有的卡") {
            groupTwoStarStatus.style.display = "flex";
        } else {
            groupTwoStarType.style.display = "flex";
        }
    } else { 
        groupAccType.style.display = "flex";
        groupHasMain.style.display = "flex";
    }
}

document.getElementById("card-rarity").addEventListener("change", updateTierFieldVisibility);

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
    formModal.classList.add("show");
}

function openEditModal(docId) {
    const card = cardsData.find(c => c.docId === docId);
    if (card) {
        editingCardDocId = docId; 
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
        
        document.getElementById("card-two-star-tab").value = card.twoStarData?.tab || "擁有的卡";
        document.getElementById("card-two-star-status").value = card.twoStarData?.status || "主帳";
        document.getElementById("card-two-star-type").value = card.twoStarData?.type || "支援者";
        document.getElementById("card-two-star-tier").value = card.twoStarData?.tier || "無";

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
    } else if (saveSection === "two_star_cards") {
        cardObj.twoStarData = {
            tab: document.getElementById("card-two-star-tab").value,
            status: document.getElementById("card-two-star-status").value,
            type: document.getElementById("card-two-star-type").value,
            tier: rarityInput === "2星" ? document.getElementById("card-two-star-tier").value : "無", 
            order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.twoStarData?.order || Date.now()) : Date.now()
        };
    } else {
        cardObj.altAccData = { accountType: document.getElementById("card-acc-type").value, hasOnMain: document.getElementById("card-has-main").value };
        if (rarityInput === "2星" || rarityInput === "2彩星") {
            cardObj.twoStarData = {
                tab: "擁有的卡", 
                // 🪄 Bug Fix: 永遠只存入卡片所屬的小帳或資源帳，這樣鏡像過去才不會迷路跑到「主帳」
                status: document.getElementById("card-acc-type").value,
                type: document.getElementById("card-two-star-type").value || "支援者",
                tier: rarityInput === "2星" ? document.getElementById("card-two-star-tier").value : "無",
                order: editingCardDocId ? (cardsData.find(c => c.docId === editingCardDocId)?.twoStarData?.order || Date.now()) : Date.now()
            };
        }
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
// 🪄 快速修改評級 (Mini Modal) 邏輯
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
                    "twoStarData.status": targetCard.altAccData?.accountType || "小帳", // 🪄 安全防護：修改時也維持它的小帳身分
                    "twoStarData.type": targetCard.twoStarData?.type || "支援者",
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

// 🪄 智慧圖片下拉選單邏輯
const cardNameInput = document.getElementById("card-name");
const autocompleteList = document.getElementById("custom-autocomplete-list");

function renderAutocomplete(filterText = "") {
    autocompleteList.innerHTML = "";
    const matchedNames = Object.keys(uniqueCardsDict).filter(name => name.toLowerCase().includes(filterText.toLowerCase()));
    
    if (matchedNames.length === 0) {
        autocompleteList.classList.remove('show');
        return;
    }

    matchedNames.forEach(name => {
        const dictData = uniqueCardsDict[name];
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

cardNameInput.addEventListener("input", (e) => {
    renderAutocomplete(e.target.value.trim());
});
cardNameInput.addEventListener("focus", (e) => {
    renderAutocomplete(e.target.value.trim());
});

document.addEventListener("click", (e) => {
    if (e.target !== cardNameInput && !autocompleteList.contains(e.target)) {
        autocompleteList.classList.remove('show');
    }
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
    const isOwned = e.target.value === "擁有的卡";
    document.getElementById("group-two-star-status").style.display = isOwned ? "flex" : "none";
    document.getElementById("group-two-star-type").style.display = isOwned ? "none" : "flex";
});

const lightboxModal = document.getElementById('lightbox-modal');
document.getElementById('close-modal').addEventListener("click", () => formModal.classList.remove("show"));
document.getElementById('lightbox-close').addEventListener('click', () => lightboxModal.classList.remove('show'));

window.addEventListener("click", (e) => { 
    if (e.target === formModal) formModal.classList.remove("show"); 
    if (e.target === lightboxModal) lightboxModal.classList.remove('show');
    if (e.target === quickTierModal) quickTierModal.classList.remove('show');
});

// ==========================================
// 終極即時連線引擎 與 字典產生器
// ==========================================
rarityRowsContainerAlt.innerHTML = "<p style='text-align:center; color:#888; padding:20px;'>📡 建立即時連線中...</p>";

onSnapshot(cardsCollection, (snapshot) => {
    uniqueCardsDict = {};

    const rawCards = snapshot.docs.map(doc => {
        const data = doc.data();
        const section = data.section || "alt_acc";
        
        let altAccData = data.altAccData || (section === "alt_acc" ? { accountType: data.accountType, hasOnMain: data.hasOnMain } : null);
        let challenge24hData = data.challenge24hData || (section === "24h" ? { ownership: data.ownership } : null);
        let neededCardsData = data.neededCardsData || (section === "needed_cards" ? { quantity: data.quantity || 1, order: data.order || Date.now(), tab: data.tab || "缺少的卡" } : null);
        let generalData = data.generalData || (section === "general_cards" ? { type: data.type || "支援者", order: data.order || Date.now(), hasOnMain: data.hasOnMain || "false" } : null);
        
        let twoStarData = data.twoStarData || (section === "two_star_cards" ? { 
            tab: data.tab || "擁有的卡", 
            status: data.status || "主帳", 
            type: data.type || "支援者", 
            tier: data.tier || "無", 
            order: data.order || Date.now() 
        } : null);

        // 🪄 Bug Fix 2：小帳資源的 2星卡，完全依照它自己的「小帳/資源帳」屬性映射到「擁有的卡」
        if (section === "alt_acc" && (data.rarity === "2星" || data.rarity === "2彩星")) {
            twoStarData = twoStarData ? { ...twoStarData } : {};
            twoStarData.tab = "擁有的卡";
            // 永遠映射到它真實的帳號，不再被 hasOnMain 干擾！
            twoStarData.status = altAccData?.accountType || "小帳"; 
            if (!twoStarData.order) twoStarData.order = Date.now();
            if (!twoStarData.tier) twoStarData.tier = "無";
        }

        if (data.name) {
            if (!uniqueCardsDict[data.name]) {
                uniqueCardsDict[data.name] = {
                    id: data.id || "",
                    imageUrl: data.imageUrl || "",
                    rarity: data.rarity || "1星",
                    bgColor: data.bgColor || "#ffffff"
                };
            } else {
                if (!uniqueCardsDict[data.name].imageUrl && data.imageUrl) uniqueCardsDict[data.name].imageUrl = data.imageUrl;
                if (!uniqueCardsDict[data.name].id && data.id) uniqueCardsDict[data.name].id = data.id;
            }
        }

        return { docId: doc.id, ...data, section, altAccData, challenge24hData, neededCardsData, generalData, twoStarData };
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