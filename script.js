// 1. 初始化資料 (加入 page 屬性)
const defaultCards = [
    {
        name: "傑尼龜",
        id: "A1-007",
        imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png&w=300",
        page: "page1" // 標記這張卡屬於 page1
    }
];

let myCards = JSON.parse(localStorage.getItem("ptcg_cards_v4")) || defaultCards;
let currentPage = "page1"; // 預設停留在第一個頁面

// 抓取 DOM 元素
const galleryElement = document.getElementById("gallery");
const formModal = document.getElementById("form-modal");
const cardForm = document.getElementById("card-form");
const sidebarItems = document.querySelectorAll(".sidebar-menu li");
const pageTitle = document.getElementById("page-title");
const imgInput = document.getElementById("card-img");
const imgPreview = document.getElementById("img-preview");

// 2. 渲染畫廊
function renderGallery() {
    galleryElement.innerHTML = "";

    // 關鍵邏輯：只篩選出屬於「當前頁面」的卡片
    const currentCards = myCards.filter(card => card.page === currentPage);

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

    // 💡 在最後加上 Notion 風格的 "+ New page" 按鈕
    const addNewElement = document.createElement("div");
    addNewElement.className = "add-new-card";
    addNewElement.innerHTML = `
        <span>➕</span>
        <div style="font-size: 14px; font-weight: bold;">New page</div>
    `;
    
    // 點擊新增按鈕時，打開 Modal 彈出視窗
    addNewElement.addEventListener("click", () => {
        formModal.classList.add("show");
    });
    
    galleryElement.appendChild(addNewElement);
}

// 3. 側邊欄切換邏輯
sidebarItems.forEach(item => {
    item.addEventListener("click", function() {
        // 移除所有選單的 active 樣式，並加到被點擊的選項上
        sidebarItems.forEach(li => li.classList.remove("active"));
        this.classList.add("active");
        
        // 更新目前頁面變數與標題
        currentPage = this.getAttribute("data-page");
        pageTitle.innerText = "🌟 " + this.innerText;
        
        // 重新渲染畫廊
        renderGallery();
    });
});

// 4. Modal 與表單邏輯
// 點擊 X 關閉視窗
document.getElementById("close-modal").addEventListener("click", () => {
    formModal.classList.remove("show");
});

// 點擊視窗外的黑色半透明區域也能關閉
window.addEventListener("click", (e) => {
    if (e.target === formModal) {
        formModal.classList.remove("show");
    }
});

// 即時圖片預覽：監聽網址輸入框的改變
imgInput.addEventListener("input", function() {
    const url = this.value.trim();
    if (url) {
        imgPreview.src = url;
    } else {
        imgPreview.src = "https://placehold.co/250x350/eaeaea/888888?text=Preview";
    }
});

// 送出表單
cardForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const newCard = {
        name: document.getElementById("card-name").value,
        id: document.getElementById("card-id").value,
        imageUrl: document.getElementById("card-img").value,
        page: currentPage // 紀錄這張卡片是被新增到哪一個分類中
    };

    myCards.push(newCard);
    localStorage.setItem("ptcg_cards_v4", JSON.stringify(myCards));
    
    // 關閉視窗、重新渲染畫面、重置表單與預覽圖
    formModal.classList.remove("show");
    renderGallery();
    cardForm.reset();
    imgPreview.src = "https://placehold.co/250x350/eaeaea/888888?text=Preview";
});

// 網頁開啟時第一次渲染
renderGallery();