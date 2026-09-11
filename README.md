# PTCG Pocket 小工具

一個自用的 PTCG Pocket 卡片管理工具，主要用來整理卡片資源、Meta 牌組、24H 得卡挑戰、高星卡交換紀錄，以及從 Raenonx 卡片資料建立圖鑑與智慧選單。

目前專案是純前端 Web App，使用原生 HTML / CSS / JavaScript，搭配 Firebase Authentication、Firestore 與 Firebase Hosting。

## 主要功能

- **卡片圖鑑**
  - 依擴充包瀏覽卡片
  - 支援全域搜尋與包內搜尋
  - 支援卡片種類與稀有度篩選
  - 卡片資料由 `crawler/raenonx-cards.json` 提供

- **Meta 牌組**
  - 依版本與 Tier 管理牌組
  - 牌組內支援多分頁
  - 支援牌組卡片新增、編輯、複製、拖曳排序
  - 支援可替換卡區塊
  - 支援文字格式匯入牌組

- **需要卡**
  - 依稀有度管理缺少的卡與金邊卡
  - 支援數量調整與拖曳排序

- **泛用卡**
  - 依支援者、物品、道具、競技場、寶可夢分類
  - 支援自訂標籤與標籤顏色

- **高星卡**
  - 管理 2 星、2 閃、3 星、皇冠等高罕卡
  - 支援擁有的卡、想要的卡、被交換的卡
  - 被交換的卡可記錄「交換的卡」
  - 與小帳資源部分資料雙向同步

- **小帳資源**
  - 記錄小帳 / 資源帳卡片
  - 支援主帳是否擁有、數量、卡片底色等欄位

- **24H 得卡挑戰**
  - 依版本分頁管理挑戰卡片
  - 可從卡片圖鑑資料匯入指定版本的挑戰卡片
  - 會依小帳資源與高星卡狀態計算取得狀態

- **智慧選單**
  - 會整合手動輸入卡片與圖鑑資料
  - 支援依稀有度或卡片種類篩選候選卡
  - 可自動帶入名稱、編號、圖片網址與部分卡片資訊

## 技術棧

- HTML
- CSS
- JavaScript ES Modules
- Firebase Authentication
- Firebase Firestore
- Firebase Hosting
- Node.js crawler scripts
- Playwright

## 專案結構

```text
.
├─ index.html
├─ style.css
├─ script.js
├─ firebase.json
├─ package.json
├─ crawler/
│  ├─ raenonx-cards.mjs
│  ├─ sync-ptcg-cards-from-catalog.mjs
│  ├─ backfill-ptcg-card-sections.mjs
│  └─ raenonx-cards.json
└─ README.md
```

> `crawler/raenonx-cards.json` 是卡片圖鑑與智慧選單用的靜態資料。此檔案可能很大，是否提交到 Git 依專案部署方式決定。

## 本地使用

這個專案是純前端專案，可以用 VS Code Live Server 或任何靜態檔案伺服器開啟。

如果使用 VS Code Live Server：

```text
右鍵 index.html -> Open with Live Server
```

或使用 Firebase Hosting 本地預覽：

```bash
firebase emulators:start --only hosting
```

## 安裝依賴

```bash
npm install
```

## 更新卡片圖鑑資料

從 Raenonx 重新抓取卡片資料：

```bash
npm run crawl:cards
```

這會更新：

```text
crawler/raenonx-cards.json
```

若需要用最新圖鑑資料修正 Firestore 中既有卡片資料：

```bash
npm run sync:cards:dry-run
npm run sync:cards
```

> `sync:cards` 需要 Firebase Admin service account key。請將金鑰放在 `crawler/service-account-key.json`，並確認它有被 `.gitignore` 忽略，不能提交到 GitHub。

## Firebase 部署

部署到 Firebase Hosting：

```bash
firebase deploy --only hosting
```

目前 `firebase.json` 的 hosting public directory 是根目錄：

```json
{
  "hosting": {
    "public": "."
  }
}
```

因此部署前要確認 `index.html`、`script.js`、`style.css` 與 `crawler/raenonx-cards.json` 都在正確位置。

## Firestore 資料

主要資料集合：

```text
ptcg_cards
```

常見 section：

```text
alt_acc
24h
needed_cards
general_cards
two_star_cards
meta_deck
meta_lobby_config
challenge_24h_version_config
```

## Git 注意事項

不要提交以下內容：

```text
node_modules/
.cache/
.firebase/
crawler/service-account-key.json
*.service-account.json
```

如果 `.firebase/` 已經被 Git 追蹤過，加入 `.gitignore` 後仍可能顯示 modified。可用以下指令停止追蹤：

```bash
git rm -r --cached .firebase
git add .gitignore
git commit -m "Ignore Firebase hosting cache"
```

## 常用指令

```bash
# 查看修改狀態
git status

# 建立 commit
git add .
git commit -m "Update project"

# 推到 GitHub
git push

# 抓取卡片圖鑑資料
npm run crawl:cards

# 檢查 Firestore 同步會改哪些資料
npm run sync:cards:dry-run

# 同步 Firestore 既有卡片資料
npm run sync:cards

# 部署網站
firebase deploy --only hosting
```

## 備註

這是個人使用取向的 PTCG Pocket 輔助工具，資料來源與圖片主要用於個人整理與管理。若要公開使用，建議再檢查 Firebase Rules、資料來源授權、登入權限與安全設定。
