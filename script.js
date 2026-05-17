// 1. 準備卡片資料 (未來這裡可以擴充成幾百張)
const cardsData = [
    {
        id: "A1-001",
        name: "妙蛙種子",
        type: "草",
        // 這裡先用一張免費的佔位圖片代替
        imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png&w=200"
    },
    {
        id: "A1-004",
        name: "小火龍",
        type: "火",
        imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png&w=200"
    }
];

// 2. 抓取 HTML 裡的畫廊區塊
const galleryElement = document.getElementById("gallery");

// 3. 把資料變成一張張的卡片放進去
cardsData.forEach(card => {
    // 創造一個 div 元素當作卡片
    const cardElement = document.createElement("div");
    cardElement.className = "card";

    // 設定卡片裡面的 HTML 內容
    cardElement.innerHTML = `
        <img src="${card.imageUrl}" alt="${card.name}">
        <h3>${card.name}</h3>
        <p>編號: ${card.id}</p>
        <p>屬性: ${card.type}</p>
    `;

    // 把卡片塞進畫廊裡
    galleryElement.appendChild(cardElement);
});