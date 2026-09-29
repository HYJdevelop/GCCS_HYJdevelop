# HYJ_GCCS｜大專校院畢業學分計算系統

以 React、TypeScript、Vite 製作的通用畢業進度追蹤工具，由 HYJdevelop.com 製作。介面參考 HYJdevelop 官網的白底、深藍文字與簡潔科技感。台灣任何大專校院的學生都可在「設定畢業規定」輸入校名、系所、入學年度，以及總學分、系所必修、院／校必修、系所選修、通識、體育與外系選修上限；體育是否計入總學分可自行勾選。使用者也可選擇是否套用中興資管 115 學年度範例課程、通識細項及 CPE／英語門檻。未登入時使用瀏覽器 `localStorage`；設定 Firebase 後可用 Google 或電子郵件登入，將校系規定、課程與畢業檢核同步到 Firestore。

## 本機使用

安裝 Node.js 後，在專案資料夾執行：

```powershell
npm install
npm run dev
```

開啟 Vite 輸出的網址（預設 `http://localhost:5173`）。`npm run build` 會先執行 TypeScript 專案檢查，再將最佳化檔案輸出到 `dist/`。

## Firebase 設定

以下設定各做一次即可。Firebase Web SDK 設定完成後，訪客仍可用瀏覽器 `localStorage`；登入後才會同步雲端。

### 1. 建立 Firebase 專案與 Web app

1. 前往 [Firebase Console](https://console.firebase.google.com/)，選擇「建立專案」。專案名稱自行命名；Google Analytics 可依需求開啟或略過。
2. 進入新專案後，按「新增應用程式」並選 Web（`</>`）。填入應用程式暱稱，Firebase Hosting 可稍後設定。
3. 註冊後會看到 Firebase SDK 設定物件。在專案設定 > 一般 > 你的應用程式，也可再次找到 Web app 設定。

### 2. 設定本機環境變數

在專案根目錄以 PowerShell 複製範本並開啟：

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

將範本值換成 Firebase Web app 設定中的值：

| `.env.local` 欄位 | Firebase config 欄位 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

例如 Firebase 顯示 `projectId: "my-mis-app"`，就填 `VITE_FIREBASE_PROJECT_ID=my-mis-app`。不要保留 `YOUR_...` 範例值。存檔後停止並重新執行 `npm run dev`，Vite 才會讀取新環境變數。部署前也要先完成這個檔案，因為 `VITE_` 變數是在建置時寫入前端 bundle。

`.env.local` 已加入 `.gitignore`，不要提交此檔案。Firebase Web app 的 API key 會出現在瀏覽器程式中，這是正常設計，不是資料庫密碼；資料存取安全性必須由下方 Firestore Rules 控制。不要把 Firebase Admin SDK 私鑰或服務帳戶 JSON 放進前端。

### 3. 啟用登入方式

1. Firebase Console > Authentication > 開始使用。
2. 在 Sign-in method（登入方式）啟用 **Email/Password** 並儲存。此方式支援建立帳號、電子郵件密碼登入和忘記密碼信件。
3. 同一頁啟用 **Google**。若 Console 要求，選擇支援電子郵件並儲存。
4. Authentication > Settings > Authorized domains（授權網域）確認有 `localhost`；部署後也要加入你的 Hosting 網域，例如 `你的專案ID.web.app`。自訂網域也要另外加入。網域欄位只填主機名稱，不要加 `https://`、路徑或連接埠。

### 4. 建立 Firestore 與安全規則

1. Firebase Console > Firestore Database > 建立資料庫。正式環境建議選 Production mode，再選擇離使用者較近的資料庫位置；Firestore 建立後位置不易變更，建立前先確認。
2. 進入 Firestore Database > Rules，將規則替換為以下內容並按「發布」：

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

規則限定已登入使用者只能讀寫路徑 `users/{自己的 Firebase UID}`。不要使用允許所有人讀寫的測試規則，也不要刪除 `request.auth.uid == userId` 這項限制。

首次登入時，應用程式會把目前瀏覽器的進度存到新帳號。該帳號若已有雲端資料，則載入雲端版本。每個使用者文件由應用程式自動建立，位於 `users/{userId}`，欄位包含 `profile`（學校、系所及畢業門檻）、`courses`、`milestones` 和 `updatedAt`，不必在 Console 手動建立文件。

### 5. 本機測試登入與同步

```powershell
npm install
npm run dev
```

開啟終端機顯示的網址，預設為 `http://localhost:5173`。確認下列流程：

1. 開啟登入同步視窗，以 Google 登入，或切換至「建立帳號」使用電子郵件註冊。
2. 新增一門課並標記完成，等待頁首同步狀態顯示「已同步」。
3. 重新整理頁面，確認資料仍在；也可登出後重新登入同一帳號確認雲端載入。
4. 在登入模式輸入電子郵件，再選「忘記密碼」測試重設信件。若未收到，查看垃圾郵件及 Authentication 的電子郵件範本設定。

若要確認跨裝置同步，請在另一個瀏覽器或無痕視窗登入同一帳號。Firebase 未設定時會使用本機模式，登入按鈕會停用並提示設定 `.env.local`。

## 部署 Firebase Hosting

1. 安裝 Firebase CLI：`npm install -g firebase-tools`。若已安裝可略過。
2. 在專案根目錄執行 `firebase login`，使用擁有該 Firebase 專案權限的 Google 帳號登入。
3. 執行 `firebase use --add`，選擇剛建立的專案並設定本機別名。此步驟會建立 `.firebaserc`。
4. 確認 `.env.local` 已填入正式 Firebase Web app 設定，再執行 `npm run build`。建置成功後會產生 `dist/`。
5. 確認 `firebase.json` 中 Hosting 的 `public` 是 `dist`，執行 `firebase deploy --only hosting`。
6. 開啟 CLI 輸出的 Hosting 網址；將該網域加入 Authentication > Settings > Authorized domains，再重新測試登入。

後續更新網站時，重複執行 `npm run build` 和 `firebase deploy --only hosting` 即可。若切換 Firebase 專案，記得同步更新 `.env.local` 並確認 `firebase use` 指向正確專案。

## 部署 GitHub Pages

正式網址使用自訂網域 `https://gccs.hyjdevelop.com`，因此 Vite 使用網域根路徑 `/`，不使用 `/GCCS/` 子路徑。`public/CNAME` 會隨建置複製到 `dist/CNAME`，GitHub Pages workflow 則負責建置及發布 `dist/`。

### 設定網域

1. 到網域 DNS 管理頁新增 CNAME：名稱／Host 填 `gccs`，目標／Value 填 `charlie960906.github.io`，TTL 使用預設值。不要建立另一筆同名 A 或 CNAME 記錄。
2. 到 GitHub repository `charlie960906/GCCS` > **Settings** > **Pages**，在 **Custom domain** 輸入 `gccs.hyjdevelop.com` 並儲存。
3. 等 DNS 驗證完成後，在同一頁啟用 **Enforce HTTPS**。DNS 更新可能需要一段時間才會生效。
4. **Build and deployment** 的 **Source** 選擇 **GitHub Actions**。

### 設定 Firebase 網站變數

若 Pages 網站要使用 Google／Email 登入及 Firestore 同步，到 repository **Settings** > **Secrets and variables** > **Actions** > **Variables** 新增下列 Repository variables：

| Variable 名稱 | Firebase Web app 對應欄位 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

這些是 Firebase Web SDK 的前端設定值，不是 Admin 私鑰。絕對不要新增 Service Account JSON、`private_key` 或 Admin SDK 憑證。若尚未設定 Firebase variables，Pages 仍可部署，但網站會以訪客本機模式運作。

Firebase Console > Authentication > Settings > **Authorized domains** 也要加入 `gccs.hyjdevelop.com`，否則 Google 登入會回報 `auth/unauthorized-domain`。

### 自動部署

`.github/workflows/deploy.yml` 會在推送到 `main` 或手動啟動時執行 `npm ci`、`npm run build:pages`，再發布 `dist/`。首次設定完成後，把 workflow 與程式碼推送到 GitHub：

```powershell
git add .
git commit -m "Deploy site to GitHub Pages"
git push origin main
```

到 repository 的 **Actions** 頁面確認 **Deploy to GitHub Pages** 工作流程成功，接著開啟 `https://gccs.hyjdevelop.com`。未來每次推送到 `main` 都會自動更新網站；也可以在 Actions 手動執行部署。

### 常見問題

| 現象 | 檢查方式 |
| --- | --- |
| 登入按鈕停用／顯示 Firebase 尚未設定 | 確認 `.env.local` 存在於專案根目錄、四個 `VITE_FIREBASE_...` 值都有填，重啟 Vite。 |
| `auth/unauthorized-domain` | 把目前主機加入 Authentication > Settings > Authorized domains；只填網域名稱。 |
| `auth/operation-not-allowed` | 回到 Authentication > Sign-in method，確認 Google 或 Email/Password 已啟用。 |
| Firestore `permission-denied` | 確認資料庫已建立且 Rules 已發布，登入者 UID 必須與文件路徑中的 UID 相同。 |
| Google 登入視窗被封鎖 | 允許此網站開啟彈出視窗，並確認目前網域已授權。 |
| 修改 `.env.local` 後仍未生效 | 停止並重啟 `npm run dev`；正式站則重新 `npm run build` 再部署。 |

## 使用方式

1. 點選頁面右上角「設定畢業規定」，輸入自己的校名、系所與學年度，以及各類最低學分。
2. 若不是中興資管 115 學年度規定，取消「使用中興資管範例必修課程」；範例課程會移除，自訂課程會保留。校系名稱或學年度變更時也會先確認是否移除範例課程。
3. 需要時新增課程，設定課名、學分、類別、學期及是否完成。外系選修可另外標記，上限由畢業規定設定。
4. 體育學分不會加進畢業總學分；「其他採計學分」會計入總學分。電腦／AI 通識可選擇不列入畢業學分。
5. 通識細項與特定檢定門檻可依需求開關。所有規定仍應自行核對校方正式公告。