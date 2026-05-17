// 1. 初始化資料：先檢查瀏覽器有沒有存過卡片，沒有的話就用兩張預設卡片
const defaultCards = [
    {
        id: "A1-001",
        name: "妙蛙種子",
        type: "草",
        imageUrl: "https://cdn.raenonx.cc/api/image/ptcgp?format=webp&url=/images/game/card/full/zh/PK_10_000010_00.png&w=1920&q=75"
    },
    {
        id: "A1-004",
        name: "小火龍",
        type: "火",
        imageUrl: "https://cdn.raenonx.cc/api/image/ptcgp?format=webp&url=/images/game/card/full/zh/PK_10_000330_00.png&w=1920&q=75"
    }
];

// 從 localStorage 拿資料，如果沒有就用預設的
let myCards = JSON.parse(localStorage.getItem("ptcg_cards")) || defaultCards;

// 2. 抓取 HTML 元素
const galleryElement = document.getElementById("gallery");
const cardForm = document.getElementById("card-form");

// 3. 定義一個「把資料畫到畫面上」的函式
function renderGallery() {
    // 先清空畫廊，避免重複渲染
    galleryElement.innerHTML = "";

    // 跑迴圈把每一張卡片畫出來
    myCards.forEach(card => {
        const cardElement = document.createElement("div");
        cardElement.className = "card";
        cardElement.innerHTML = `
            <img src="${card.imageUrl}" alt="${card.name}" onerror="this.src='https://placehold.co/250x350?text=No+Image'">
            <h3>${card.name}</h3>
            <p>編號: ${card.id}</p>
            <p>屬性: ${card.type}</p>
        `;
        galleryElement.appendChild(cardElement);
    });
}

// 4. 監聽表單的「送出 (Submit)」事件
cardForm.addEventListener("submit", function(event) {
    // 阻止表單預設的重整網頁行為
    event.preventDefault();

    // 抓取使用者在輸入框填寫的數值
    const newCard = {
        id: document.getElementById("card-id").value,
        name: document.getElementById("card-name").value,
        type: document.getElementById("card-type").value,
        imageUrl: document.getElementById("card-img").value
    };

    // 把新卡片推進我們的資料陣列中
    myCards.push(newCard);

    // 把更新後的陣列存進 localStorage 永久保存
    localStorage.setItem("ptcg_cards", JSON.stringify(myCards));

    // 重新渲染畫面
    renderGallery();

    // 清空輸入框，方便下一次輸入
    cardForm.reset();
});

// 5. 網頁一打開，立刻執行第一次渲染
renderGallery();