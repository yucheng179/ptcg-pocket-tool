// 1. 初始化資料 (為了完美過渡到資料庫，加上了 UUID 和詳細屬性)
let cardsData = JSON.parse(localStorage.getItem("ptcg_db")) || [
    { uuid: "1", name: "路卡利歐", id: "A1-150", imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/448.png&w=150", accountType: "小帳", rarity: "4菱", hasOnMain: "false" },
    { uuid: "2", name: "炎帝", id: "A1-140", imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/244.png&w=150", accountType: "小帳", rarity: "2星", hasOnMain: "true" }
];

let currentAccountTab = "小帳"; // 預設顯示小帳

// DOM 元素
const sidebarItems = document.querySelectorAll(".sidebar-menu li");
const viewSections = document.querySelectorAll(".view-section");
const pageTitle = document.getElementById("page-title");
const matrixContainer = document.getElementById("matrix-container");
const accTabs = document.querySelectorAll(".tab-btn");

// --- 側邊欄切換邏輯 ---
sidebarItems.forEach(item => {
    item.addEventListener("click", () => {
        sidebarItems.forEach(li => li.classList.remove("active"));
        item.classList.add("active");
        pageTitle.innerText = item.innerText;
        
        // 切換視圖
        const targetView = item.getAttribute("data-target");
        viewSections.forEach(sec => sec.classList.remove("active"));
        document.getElementById(targetView).classList.add("active");
    });
});

// --- 小帳資源：頁籤切換邏輯 ---
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

document.getElementById("card-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const newCard = {
        uuid: "c_" + Date.now(),
        name: document.getElementById("card-name").value,
        id: document.getElementById("card-id").value,
        imageUrl: document.getElementById("card-img").value,
        accountType: document.getElementById("card-acc-type").value,
        rarity: document.getElementById("card-rarity").value,
        hasOnMain: document.getElementById("card-has-main").value
    };
    
    cardsData.push(newCard);
    localStorage.setItem("ptcg_db", JSON.stringify(cardsData));
    
    formModal.classList.remove("show");
    document.getElementById("card-form").reset();
    renderMatrix();
});

// 初始化
renderMatrix();