const galleryElement = document.getElementById("gallery");

// 這是 flibustier 專案提供的最新 JSON 遠端原始檔網址
const DB_URL = "https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/cards.min.json";

// 定義一個非同步函式：去網路上把 JSON 抓下來
async function loadDatabase() {
    try {
        // 發送請求並等待回應
        const response = await fetch(DB_URL);
        const cardsData = await response.json();
        
        // 這個資料庫有幾百張卡片，為避免一次載入太多畫面卡頓，我們用 slice 先示範前 50 張
        renderGallery(cardsData.slice(0, 50)); 
    } catch (error) {
        console.error("讀取資料失敗:", error);
        galleryElement.innerHTML = "<p style='text-align:center; color:red;'>讀取資料庫失敗，請確認網路連線。</p>";
    }
}

// 畫出卡片的函式 (屬性對應到 flibustier 的格式)
function renderGallery(cards) {
    // 清空載入中的文字
    galleryElement.innerHTML = "";

    cards.forEach(card => {
        const cardElement = document.createElement("div");
        cardElement.className = "card";
        
        // 1. 處理卡片編號：資料庫是分開的，我們把它組合成 "A1-1" 的格式
        const cardNumber = `${card.set}-${card.number}`;
        
        // 2. 處理圖片：
        // ⚠️ 注意：該資料庫的 image 欄位只有檔名 (例如 bulbasaur.webp)，並沒有提供完整的圖片網址。
        // 所以我們在這裡先用一個「會顯示卡片名字的佔位圖 (Placeholder)」暫時代替。
        const imageUrl = `https://placehold.co/250x350/eaeaea/555555?text=${card.name}`;

        // 3. 把 flibustier 提供的屬性畫出來
        // (如果有些卡片沒有血量，我們用 || '-' 來給個預設值)
        cardElement.innerHTML = `
            <img src="${imageUrl}" alt="${card.name}">
            <h3>${card.name}</h3>
            <p><span>編號:</span> <span>${cardNumber}</span></p>
            <p><span>類型:</span> <span>${card.type || '無'}</span></p>
            <p><span>屬性:</span> <span>${card.element || '無'}</span></p>
            <p><span>HP:</span> <span>${card.health || '-'}</span></p>
            <p><span>稀有度:</span> <strong>${card.rarity || '無'}</strong></p>
        `;
        galleryElement.appendChild(cardElement);
    });
}

// 網頁一打開，立刻執行抓取資料的動作
loadDatabase();