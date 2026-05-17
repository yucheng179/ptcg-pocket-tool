// 1. 初始化資料：更新為包含類型、稀有度、屬性的新格式
const defaultCards = [
    {
        name: "妙蛙種子",
        cardType: "寶可夢",  // 新增
        rarity: "1菱",      // 新增
        id: "A1-001",
        property: "草",     // 從 type 改成 property
        imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png&w=300"
    },
    {
        name: "小火龍",
        cardType: "寶可夢",  // 新增
        rarity: "1菱",      // 新增
        id: "A1-004",
        property: "火",     // 從 type 改成 property
        imageUrl: "https://wsrv.nl/?url=raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png&w=300"
    }
];

// 從 localStorage 拿資料，如果沒有就用預設的
let myCards = JSON.parse(localStorage.getItem("ptcg_cards_v2")) || defaultCards; 
// 💡 小技巧：我把 localStorage 的名字改成了 ptcg_cards_v2，這樣可以避免讀到你之前舊格式的資料而發生錯誤。

// 2. 抓取 HTML 元素
const galleryElement = document.getElementById("gallery");
const cardForm = document.getElementById("card-form");

// 3. 定義「把資料畫到畫面上」的函式
function renderGallery() {
    galleryElement.innerHTML = "";

    myCards.forEach(card => {
        const cardElement = document.createElement("div");
        cardElement.className = "card";
        
        // 將新增的屬性加入到卡片的顯示畫面中
        cardElement.innerHTML = `
            <img src="${card.imageUrl}" alt="${card.name}" onerror="this.src='https://placehold.co/250x350?text=No+Image'">
            <h3>${card.name}</h3>
            <p><span>編號:</span> <span>${card.id}</span></p>
            <p><span>類型:</span> <span>${card.cardType}</span></p>
            <p><span>屬性:</span> <span>${card.property}</span></p>
            <p><span>稀有度:</span> <strong>${card.rarity}</strong></p>
        `;
        galleryElement.appendChild(cardElement);
    });
}

// 4. 監聽表單的「送出 (Submit)」事件
cardForm.addEventListener("submit", function(event) {
    event.preventDefault();

    // 抓取你新設定的 id 裡面的值
    const newCard = {
        name: document.getElementById("card-name").value,
        cardType: document.getElementById("card-type").value,     // 新增
        rarity: document.getElementById("card-rarity").value,     // 新增
        id: document.getElementById("card-id").value,
        property: document.getElementById("card-property").value, // 更新 ID
        imageUrl: document.getElementById("card-img").value
    };

    myCards.push(newCard);

    // 存入 localStorage
    localStorage.setItem("ptcg_cards_v2", JSON.stringify(myCards));

    // 重新渲染畫面
    renderGallery();

    // 清空輸入框
    cardForm.reset();
});

// 5. 網頁一打開，立刻執行第一次渲染
renderGallery();