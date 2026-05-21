// 1. 初始化資料結構：現在我們有「分頁」和「卡片」兩個陣列
const defaultData = {
    pages: [
        { id: "page_1", name: "超夢擴充包" },
        { id: "page_2", name: "支援者卡片" }
    ],
    cards: [
        {
            name: "傑尼龜", id: "A1-007",
            imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png&w=300",
            pageId: "page_1" // 綁定到分頁的 ID
        }
    ]
};

// 從 localStorage 讀取，沒有就用預設值
let appData = JSON.parse(localStorage.getItem("ptcg_data_v5")) || defaultData;
// 預設選擇第一個分頁，如果沒有分頁就設為 null
let currentPageId = appData.pages.length > 0 ? appData.pages[0].id : null;

// 抓取 DOM 元素
const sidebarMenu = document.getElementById("sidebar-menu");
const pageTitle = document.getElementById("page-title");
const galleryElement = document.getElementById("gallery");
const addPageBtn = document.getElementById("add-page-btn");

// 隱藏表單相關 DOM
const formModal = document.getElementById("form-modal");
const cardForm = document.getElementById("card-form");
const imgInput = document.getElementById("card-img");
const imgPreview = document.getElementById("img-preview");

// --- 儲存資料的通用函式 ---
function saveData() {
    localStorage.setItem("ptcg_data_v5", JSON.stringify(appData));
}

// --- 渲染側邊欄 (分頁列表) ---
function renderSidebar() {
    sidebarMenu.innerHTML = "";

    appData.pages.forEach(page => {
        const li = document.createElement("li");
        if (page.id === currentPageId) li.classList.add("active");

        // 分頁名稱與右側的操作按鈕
        li.innerHTML = `
            <span class="page-name">${page.name}</span>
            <div class="page-actions">
                <button class="edit-btn" title="重新命名">✏️</button>
                <button class="del-btn" title="刪除分類">🗑️</button>
            </div>
        `;

        // 點擊分頁：切換顯示的內容
        li.addEventListener("click", (e) => {
            // 如果點擊的是按鈕，不要觸發切換頁面的邏輯
            if (e.target.tagName === "BUTTON") return;
            
            currentPageId = page.id;
            renderSidebar(); // 重新渲染側邊欄以更新 active 樣式
            renderGallery(); // 重新渲染畫廊
        });

        // 點擊編輯按鈕
        li.querySelector(".edit-btn").addEventListener("click", () => {
            const newName = prompt("請輸入新的分類名稱：", page.name);
            if (newName && newName.trim() !== "") {
                page.name = newName.trim();
                saveData();
                renderSidebar();
                if(currentPageId === page.id) renderGallery(); // 如果正在看這頁，順便更新大標題
            }
        });

        // 點擊刪除按鈕
        li.querySelector(".del-btn").addEventListener("click", () => {
            const confirmDel = confirm(`確定要刪除「${page.name}」嗎？\n注意：這會連同裡面的卡片一起刪除！`);
            if (confirmDel) {
                // 1. 刪除分頁
                appData.pages = appData.pages.filter(p => p.id !== page.id);
                // 2. 刪除屬於該分頁的卡片
                appData.cards = appData.cards.filter(c => c.pageId !== page.id);
                
                // 如果刪除的是當前觀看的頁面，把畫面切換到第一個分頁
                if (currentPageId === page.id) {
                    currentPageId = appData.pages.length > 0 ? appData.pages[0].id : null;
                }
                
                saveData();
                renderSidebar();
                renderGallery();
            }
        });

        sidebarMenu.appendChild(li);
    });
}

// --- 新增分頁邏輯 ---
addPageBtn.addEventListener("click", () => {
    const newName = prompt("幫新分類取個名字吧 (例如: 皮卡丘擴充包)：");
    if (newName && newName.trim() !== "") {
        const newPage = {
            id: "page_" + Date.now(), // 用當下時間戳記當作永遠不會重複的 ID
            name: newName.trim()
        };
        appData.pages.push(newPage);
        currentPageId = newPage.id; // 直接跳轉到新建立的頁面
        saveData();
        renderSidebar();
        renderGallery();
    }
});

// --- 渲染畫廊 (卡片列表) ---
function renderGallery() {
    galleryElement.innerHTML = "";

    // 防呆：如果根本沒有分頁
    if (!currentPageId) {
        pageTitle.innerText = "請先建立一個分類";
        return;
    }

    // 找出當前分頁的資料
    const currentPage = appData.pages.find(p => p.id === currentPageId);
    if(currentPage) pageTitle.innerText = "🌟 " + currentPage.name;

    // 篩選出屬於當前分頁的卡片
    const currentCards = appData.cards.filter(card => card.pageId === currentPageId);

    currentCards.forEach(card => {
        const cardElement = document.createElement("div");
        cardElement.className = "card";
        cardElement.innerHTML = `
            <img src="${card.imageUrl}" alt="${card.name}" onerror="this.src='https://placehold.co/250x350/eaeaea/888888?text=No+Image'">
            <h3>${card.name}</h3>
            <p style="color: #666; font-size: 13px; margin: 4px 0;">編號: ${card.id}</p>
        `;
        galleryElement.appendChild(cardElement);
    });

    // 加入 "+ New page" 新增卡片按鈕
    const addNewElement = document.createElement("div");
    addNewElement.className = "add-new-card";
    addNewElement.innerHTML = `<span>➕</span><div style="font-size: 14px; font-weight: bold;">新增卡片</div>`;
    addNewElement.addEventListener("click", () => formModal.classList.add("show"));
    galleryElement.appendChild(addNewElement);
}

// --- Modal 與表單邏輯 (與先前大同小異) ---
document.getElementById("close-modal").addEventListener("click", () => formModal.classList.remove("show"));
window.addEventListener("click", (e) => { if (e.target === formModal) formModal.classList.remove("show"); });

imgInput.addEventListener("input", function() {
    const url = this.value.trim();
    imgPreview.src = url ? url : "https://placehold.co/250x350/eaeaea/888888?text=Preview";
});

cardForm.addEventListener("submit", function(event) {
    event.preventDefault();
    if (!currentPageId) return alert("請先選擇或建立一個分頁！");

    const newCard = {
        name: document.getElementById("card-name").value,
        id: document.getElementById("card-id").value,
        imageUrl: document.getElementById("card-img").value,
        pageId: currentPageId // 關鍵：綁定 ID 而非名稱
    };

    appData.cards.push(newCard);
    saveData();
    
    formModal.classList.remove("show");
    renderGallery();
    cardForm.reset();
    imgPreview.src = "https://placehold.co/250x350/eaeaea/888888?text=Preview";
});

// 網頁開啟時第一次渲染
renderSidebar();
renderGallery();