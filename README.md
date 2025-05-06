# Discord OAuth2 + Firebase Example

## 專案簡介
這是一個結合 Firebase Cloud Functions 與 Discord OAuth2 的登入範例。  
用戶可透過 Discord 帳號登入，並將用戶資訊與所屬伺服器（guilds）同步到 Firebase Firestore。

## 功能特色
- Discord OAuth2 登入（支援 identify、guilds 權限）
- Firebase Authentication 用戶管理
- Firestore 儲存用戶資訊與伺服器列表
- 前端顯示 Discord 頭像、名稱、標籤與伺服器列表
- 限制特定 Discord 伺服器成員才能登入

## 技術棧
- Firebase Hosting
- Firebase Cloud Functions
- Firebase Firestore
- Discord OAuth2
- Node.js

## 安裝與部署

### 1. 前置作業
- 申請 [Discord Developer Portal](https://discord.com/developers/applications) 應用，取得 Client ID、Client Secret
- 在 Discord 應用設定 OAuth2 Redirect URI，填入：  
  `https://<your-firebase-project>.web.app/auth/callback`
- 設定允許登入的 Discord 伺服器 ID（在 Firebase Functions 環境變數中設定）

### 2. Firebase 專案初始化
```bash
firebase login
firebase init
```
選擇 Hosting、Functions、Firestore

### 3. 設定 Discord 環境變數
```bash
firebase functions:config:set discord.client_id="你的ClientID" discord.client_secret="你的ClientSecret" discord.allowed_guild_id="允許登入的伺服器ID"
```

### 4. 安裝依賴
```bash
cd functions
npm install
```

### 5. 部署
```bash
firebase deploy
```

## 使用方式

1. 使用者進入首頁，點擊「Login with Discord」
2. 跳轉到 Discord 授權頁面，授權後自動回到網站
3. 首次登入會自動在 Firestore 建立用戶資料與伺服器列表
4. 前端會顯示用戶頭像、名稱、標籤與伺服器列表

## 目錄結構
```
/
├── public/                # 前端靜態檔案
│   └── index.html
├── functions/             # Cloud Functions 原始碼
│   └── index.js
├── .firebaserc            # Firebase 專案設定
├── firebase.json          # Firebase 部署設定
├── firestore.rules        # Firestore 安全規則
├── firestore.indexes.json # Firestore 索引設定
└── package.json           # 專案依賴
```

## 常見問題
- **Q:** 登入後沒有顯示伺服器列表？
  - **A:** 請確認 Discord OAuth2 scope 包含 `guilds`，且 Cloud Function 有正確存取權限。
- **Q:** 如何更換 Firebase 專案？
  - **A:** 使用 `firebase use --add` 重新綁定專案。
- **Q:** 為什麼我無法登入系統？
  - **A:** 請確認您是否為允許登入的 Discord 伺服器成員。如果確認是成員但仍無法登入，請聯繫管理員。

## 參考資源
- [Firebase 官方文件](https://firebase.google.com/docs)
- [Discord OAuth2 文件](https://discord.com/developers/docs/topics/oauth2)
- [firebase-discord-oauth2-example](https://github.com/luizkc/firebase-discord-oauth2-example)

