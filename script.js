// 🪄 1. 從 Firebase 載入工具包
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// 🪄 2. 你的專屬 Firebase 金鑰
const firebaseConfig = {
  apiKey: "AIzaSyBdT8oG7bjqOIZlnjEvkoxBz1GTlTx4s-k",
  authDomain: "ptcg-pocket-dex-1ac80.firebaseapp.com",
  projectId: "ptcg-pocket-dex-1ac80",
  storageBucket: "ptcg-pocket-dex-1ac80.firebasestorage.app",
  messagingSenderId: "104827060691",
  appId: "1:104827060691:web:5de9e363eb31d7e4822f26"
};

// 🪄 3. 啟動資料庫
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const cardsCollection = collection(db, "ptcg_cards"); 

// 本地暫存陣列 (從雲端抓下來放這裡)
let cardsData = [];
let currentAccountTab = "小帳";
let editingCardDocId = null; // 雲端資料庫的專屬 ID

// 你的圖示庫
const rarities = [
    { name: "4菱", icon: "https://img.game8.co/3995617/622e1c0cca9ffdaa43cdd588b8e18d78.png/show" },
    { name: "1星", icon: "https://img.game8.co/3994721/895579e1516f605b7882b0909f329b7e.png/show" },
    { name: "2星", icon: "https://img.game8.co/3995618/7d3d7e80340fe6f678a9fbd34193cae6.png/show" },
    { name: "3星", icon: "https://img.game8.co/3995619/a0d611ce374e3070c530ee8d3fd81efa.png/show" },
    { name: "1彩星", icon: "https://img.game8.co/4137129/6510d1633ee489b2e8fcba939d7e99cb.png/show" }, 
    { name: "2彩星", icon: "https://img.game8.co/4137130/6eb953da81d509f5f6fde8f63ded90f6.png/show" },
    { name: "皇冠", icon: "https://img.game8.co/3997607/303598e292a532bcde37ab527a0ac263.png/show" }
];

const rarityRowsContainer = document.getElementById("rarity-rows-container");
const accTabs = document.querySelectorAll(".tab-btn");
const formModal = document.getElementById("form-modal");
const cardForm = document.getElementById("card-form");
const modalTitle = document.getElementById("modal-title");
const colorSwatches = document.querySelectorAll(".color-swatch");
const colorInput = document.getElementById("card-bgcolor");

// 🪄 4. 向雲端索取資料
async function fetchCardsFromCloud() {
    rarityRowsContainer.innerHTML = "<p style='text-align:center; color:#888; padding:20px;'>📡 正在與雲端資料庫連線中...</p>";
    
    const snapshot = await getDocs(cardsCollection);
    cardsData = snapshot.docs.map(doc => ({
        docId: doc.id,
        ...doc.data()
    }));
    
    renderRarityRows();
}

function renderRarityRows() {
    rarityRowsContainer.innerHTML = "";

    rarities.forEach(rarity => {
        const targetCards = cardsData.filter(c => c.accountType === currentAccountTab && c.rarity === rarity.name);
        
        const rowBlock = document.createElement("div");
        rowBlock.className = "rarity-row-block";

        rowBlock.innerHTML = `
            <div class="rarity-header">
                <img src="${rarity.icon}" alt="${rarity.name}">
                <span>${rarity.name}</span>
            </div>
        `;

        createHorizontalRow(rowBlock, targetCards, "false", "主帳沒有的", "not-on-main", rarity.name);
        createHorizontalRow(rowBlock, targetCards, "true", "主帳有的", "on-main", rarity.name);

        rarityRowsContainer.appendChild(rowBlock);
    });
}

function createHorizontalRow(parentBlock, cards, hasMainVal, labelText, className, rarityName) {
    const statusRow = document.createElement("div");
    statusRow.className = `status-row ${className}`;

    const labelDiv = document.createElement("div");
    labelDiv.className = "status-label";
    labelDiv.innerText = labelText;
    statusRow.appendChild(labelDiv);

    const cardsListDiv = document.createElement("div");
    cardsListDiv.className = "cards-horizontal-list";

    const filteredAndSorted = cards.filter(c => c.hasOnMain === hasMainVal).sort((a, b) => {
        const idA = a.id || "";
        const idB = b.id || "";
        return idA.localeCompare(idB);
    });

    filteredAndSorted.forEach(card => {
        const cardEl = document.createElement("div");
        cardEl.className = "card-box";
        
        const cardBg = card.bgColor || "#ffffff";
        cardEl.style.backgroundColor = cardBg;

        const displayImg = card.imageUrl ? card.imageUrl : "https://placehold.co/150x210/eaeaea/999999?text=No+Image";
        const displayName = card.name ? card.name : "<span style='color:#ccc'>(未命名)</span>";
        const displayId = card.id ? `# ${card.id}` : "<span style='color:#ccc'>(無編號)</span>";

        cardEl.innerHTML = `
            <button class="toggle-main-btn" title="切換主帳狀態">🔄</button>
            <img src="${displayImg}" onerror="this.src='https://placehold.co/150x210/eaeaea/999999?text=Error'">
            <div class="card-info">
                <strong>${displayName}</strong>
                ${displayId}
            </div>
            <button class="del-card-btn" title="刪除卡片">✕</button>
        `;

        // 綁定綠色切換：直接更新雲端
        cardEl.querySelector('.toggle-main-btn').addEventListener('click', async (e) => {
            e.stopPropagation(); 
            const newStatus = (card.hasOnMain === "true") ? "false" : "true";
            await updateDoc(doc(db, "ptcg_cards", card.docId), { hasOnMain: newStatus });
            fetchCardsFromCloud();
        });

        // 綁定紅色刪除：直接更新雲端
        cardEl.querySelector('.del-card-btn').addEventListener('click', async (e) => {
            e.stopPropagation(); 
            if(confirm("確定要從雲端刪除這張卡片嗎？")) {
                await deleteDoc(doc(db, "ptcg_cards", card.docId));
                fetchCardsFromCloud();
            }
        });

        cardEl.addEventListener('click', () => openEditModal(card.docId));

        cardsListDiv.appendChild(cardEl);
    });

    const inlineAddBtn = document.createElement("div");
    inlineAddBtn.className = "add-new-card-box";
    inlineAddBtn.innerHTML = `<span style="font-size: 28px; margin-bottom: 5px;">+</span><span>新增卡片</span>`;
    
    inlineAddBtn.addEventListener("click", () => {
        editingCardDocId = null; 
        modalTitle.innerText = "➕ 新增卡片資料";
        cardForm.reset(); 
        document.getElementById("card-acc-type").value = currentAccountTab;
        document.getElementById("card-rarity").value = rarityName;
        document.getElementById("card-has-main").value = hasMainVal;
        
        // 重置顏色選擇器為白色
        document.getElementById("card-bgcolor").value = "#ffffff";
        colorSwatches.forEach(s => s.classList.remove("selected"));
        colorSwatches[0].classList.add("selected");

        formModal.classList.add("show");
    });

    cardsListDiv.appendChild(inlineAddBtn);
    statusRow.appendChild(cardsListDiv);
    parentBlock.appendChild(statusRow);
}

function openEditModal(docId) {
    const card = cardsData.find(c => c.docId === docId);
    if (card) {
        editingCardDocId = docId; 
        modalTitle.innerText = "✏️ 編輯卡片資料"; 
        
        document.getElementById("card-name").value = card.name || "";
        document.getElementById("card-id").value = card.id || "";
        document.getElementById("card-img").value = card.imageUrl || "";
        document.getElementById("card-acc-type").value = card.accountType;
        document.getElementById("card-rarity").value = card.rarity;
        document.getElementById("card-has-main").value = card.hasOnMain;
        
        // 讀取這張卡片專屬的底色
        const cardBg = card.bgColor || "#ffffff";
        colorInput.value = cardBg;
        
        colorSwatches.forEach(s => s.classList.remove("selected"));
        const matchSwatch = Array.from(colorSwatches).find(s => s.getAttribute("data-color").toUpperCase() === cardBg.toUpperCase());
        if (matchSwatch) matchSwatch.classList.add("selected");

        formModal.classList.add("show");
    }
}

// 表單送出 (與雲端同步)
cardForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const submitBtn = cardForm.querySelector('button[type="submit"]');
    submitBtn.innerText = "⏳ 雲端同步中...";
    submitBtn.disabled = true;

    const currentBgColor = document.getElementById("card-bgcolor").value;
    
    const cardObj = {
        name: document.getElementById("card-name").value.trim(),
        id: document.getElementById("card-id").value.trim(),
        imageUrl: document.getElementById("card-img").value.trim(),
        accountType: document.getElementById("card-acc-type").value,
        rarity: document.getElementById("card-rarity").value,
        hasOnMain: document.getElementById("card-has-main").value,
        bgColor: currentBgColor
    };
    
    if (editingCardDocId) {
        await updateDoc(doc(db, "ptcg_cards", editingCardDocId), cardObj);
    } else {
        await addDoc(cardsCollection, cardObj);
    }

    formModal.classList.remove("show");
    submitBtn.innerText = "儲存";
    submitBtn.disabled = false;
    
    fetchCardsFromCloud();
});

// 調色盤邏輯
colorSwatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
        colorSwatches.forEach(s => s.classList.remove("selected"));
        swatch.classList.add("selected");
        colorInput.value = swatch.getAttribute("data-color");
    });
});
colorInput.addEventListener("input", () => {
    colorSwatches.forEach(s => s.classList.remove("selected"));
});

// 頁籤與 Modal 切換
accTabs.forEach(tab => {
    tab.addEventListener("click", () => {
        accTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentAccountTab = tab.getAttribute("data-acc");
        renderMatrix();
    });
});

// --- 核心：渲染矩陣排版 ---
function renderMatrix() {
    matrixContainer.innerHTML = "";
    
    // 定義你要顯示的稀有度順序
    const rarities = ["4菱", "1星", "2星", "1彩星", "2彩星", "3星&皇冠"];
    
    // 建立兩個 Row (主帳沒有、主帳有)
    const rows = [
        { label: "主帳沒有的", hasMainVal: "false" },
        { label: "主帳有的", hasMainVal: "true" }
    ];

    rows.forEach(rowInfo => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "matrix-row";
        
        // Row 的標題
        rowDiv.innerHTML = `<div class="row-header">${rowInfo.label}</div>`;

        // 依序畫出每一個稀有度的直行 (Column)
        rarities.forEach(rarity => {
            const groupDiv = document.createElement("div");
            groupDiv.className = "rarity-group";
            
            // 💡 如果未來你想用圖片代替文字，可以把這裡的 innerHTML 改成 <img src="...">
            groupDiv.innerHTML = `<div class="rarity-title">${rarity}</div>`;
            
            const cardListDiv = document.createElement("div");
            cardListDiv.className = "card-list";

            // 過濾並排序卡片 (過濾：帳號、稀有度、主帳擁有狀態 | 排序：依編號)
            const filteredCards = cardsData.filter(c => 
                c.accountType === currentAccountTab && 
                c.rarity === rarity && 
                c.hasOnMain === rowInfo.hasMainVal
            ).sort((a, b) => a.id.localeCompare(b.id)); // 依編號排序

            // 畫出卡片
            filteredCards.forEach(card => {
                const cardEl = document.createElement("div");
                cardEl.className = "card-mini";
                cardEl.innerHTML = `
                    <img src="${card.imageUrl}">
                    <div class="card-info">
                        <strong>${card.name}</strong>
                        ${card.id}
                    </div>
                    <button class="del-card-btn" onclick="deleteCard('${card.uuid}')">✕</button>
                `;
                cardListDiv.appendChild(cardEl);
            });

            groupDiv.appendChild(cardListDiv);
            rowDiv.appendChild(groupDiv);
        });

        matrixContainer.appendChild(rowDiv);
    });
}

// 刪除卡片
window.deleteCard = function(uuid) {
    if(confirm("確定刪除此卡片？")) {
        cardsData = cardsData.filter(c => c.uuid !== uuid);
        localStorage.setItem("ptcg_db", JSON.stringify(cardsData));
        renderMatrix();
    }
};

// --- 表單邏輯 ---
const formModal = document.getElementById("form-modal");
document.getElementById("open-form-btn").addEventListener("click", () => formModal.classList.add("show"));
document.getElementById("close-modal").addEventListener("click", () => formModal.classList.remove("show"));

document.getElementById("card-img").addEventListener("input", function() {
    document.getElementById("img-preview").src = this.value || "https://placehold.co/250x350/eaeaea/888888?text=Preview";
});

// 🚀 啟動：向雲端要資料！
fetchCardsFromCloud();
