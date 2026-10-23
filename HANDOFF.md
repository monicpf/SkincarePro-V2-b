# SkincarePro Prototype B — Handoff（2026-10-23）

給接手的 Claude：這是 Monic 的 SkincarePro Report / Recommendation HTML prototype（B 白色版）。你接手前請完整讀這份文件。

## 1. 位置

- **GitHub**：`monicpf/SkincarePro-V2-b`（main 分支，GitHub Pages：https://monicpf.github.io/SkincarePro-V2-b/）
  - 只有三個主檔：`index.html`、`app.css`、`app.js`，圖片都在 `assets/`。
  - `tools/pack.py`：把網站打包成單一 HTML，用來發佈成 Claude Artifact。
  - `tools/comp.py`：把分析 overlay 疊到詳細頁照片的構圖上。
- **Review artifact**：https://claude.ai/artifact/6WGjRYm8VNWt7TJ6pYQvHx（目前 Version 45）
  - 留言串用的網址是 https://claude.ai/code/artifact/2c93f51c-d655-4f33-947f-361b5f6c0ef3
  - 從新對話更新時，先 `Artifact read` 這個 url，再帶 `url` publish。
- **Figma**：檔案 key `XEbKvkxrpqv91AI8SmfMTD`（Skincare_Pro_UI），頁面 `20261104_AISummary(TBD)`（4561:1796）。
  - Detail guideline：mobile `5001:32937`、iPad portrait `5001:32024`、iPad landscape `5001:32460`。
  - Report 首頁 guideline：p1 `5079:37724`、mobile `5079:38509`、portrait `5079:37526`、landscape `5079:38028`。
  - Skin Type 詳細頁和 Photo Limitation 的新版 guideline 在 **EXPLORE 區**：`Report_p2_new_skintype` `5112:36564`、`Report_p2_without` `5108:39717`。designB 區有同名的舊版，不要讀錯。
- **原始素材**：在 Monic 電腦 `~/Documents/Prototype_by_claude/SkincarePro_1011/assets`（`analysis-overlay/`、`focus-map/_new_focus/`），要透過裝置連線取得。

## 2. 架構重點

- **畫布與畫面**
  - 三個畫布：`.canvas.cv-p`（iPad portrait 1440 寬設計 px）、`.cv-l`（landscape 1920）、`.cv-m`（mobile 414）。
  - 每個畫布有這些畫面：`section[data-screen]` = result / take / report / detail / recAll / recRed / routines / treatments / share。
- **CSS**
  - Tailwind 只有已編譯的 class 可用，新值一律寫在 `app.css` 尾端的覆寫規則。
  - 覆寫要有範圍，例如 `.cv-p .screen[data-screen=detail] ...`，並加 `/* 1022xx: 說明 */` 註解。
- **詳細頁**
  - Redness 是 live 內容，寫在 `.scroller` 裡；其他 15 頁（14 個 concern + Skin Type）都是 `<template class="det-tpl" data-dc="…">`，每個畫布各一份，由 `swapDet()` 換入。
  - 改詳細頁一定要三個畫布 × 16 頁都改到。注意 node-id 在不同 template 之間會重複，**不能用 `h.find(node-id)` 定位**，要先切出該 template 的範圍再改。
- **JS 狀態**
  - 用 `window.__proto` 操作：`.state`、`.go(screen)`、`.setDet(i)`。
  - 測試時常用：`state.dc='Wrinkles'; go('detail')`；或 `state.filter='Redness'; go('routines')`。
- **推薦頁示範資料**
  - `recFill()` 會依 concern 從示範項目挑一部分。
  - Routines 每組至少 3 步，篩選後重新編號 1..n。
- **詳細頁照片**
  - 所有 concern 都疊在同一個構圖 `assets/det_analysis.jpg` 上，檔名 `det_an_*.jpg`。
  - Focus map 是 `fm2_*.png`，統一位置 `left:-10.235%;top:0.010%;width:105.402%`。

## 3. 發佈流程（每次修改都要做）

1. 修改檔案。
2. 用 Playwright 量測驗證：三個畫布都要量；有篩選或多頁的地方要全部跑過。
3. `git commit`：訊息以 `1022xx:` 開頭，最新是 1022av，下一個用 1022aw。結尾加 attribution，然後 `git push origin HEAD`。
4. `python3 tools/pack.py <scratchpad>/SkincarePro_B_review.html`。
   - 打包後的檔案大約 15.9MB，**上限是 16MB**。
   - 詳細頁的大圖會被壓到 720px；新增大圖前要先確認不會超過上限。
5. 用 `Artifact` publish 同一個 url。
6. 如果是 artifact 留言觸發的，到該 thread 回覆，再 resolve。
7. 回報 Monic，格式如下：
   - ✅ 完成：一句話說明
   - 📎 產出：artifact 版本、commit
   - ❓ 需要你決定：要她決定的事；沒有就寫「無」

## 4. Monic 的工作規則（務必遵守）

- **溝通**
  - 繁體中文，結論先說，簡潔，不要客套開場。
  - 做 UI 或 Artifact 變更前，先給 3 句以內的設計意圖摘要，等她確認。如果是明確的 bug 修正，或她已經給了數值，可以直接改。
  - 不確定的數值不要自己決定，要問她。不懂就先問。
- **Figma**
  - 進 Figma 前先問「可以進去了嗎？」。
  - Figma 由 Monic 自己改，除非她要你改。目前約定是你**只改 prototype**。
  - 嚴格照 Figma 的 **Fill / Hug / Fixed** 設定實作。她明確糾正過文字寬度要 Fill、chip 名稱要 Hug。
- **QA 要求**
  - 改完要自己檢查：對齊、置中、Fill 設定、三種畫布、有沒有破壞到其他東西、同類元素有沒有同樣問題。
  - 她批評過只修一處、沒有全面排查的情況（例如圖片變形只修一張）。
- **卡片規則（優先於 Figma 畫的固定高度）**

  | 項目 | 規則 |
  |---|---|
  | iPad 並排卡片（Key Points / Contributing Factors / Daily Care） | 同一排等高；標題固定 2 行；內文依字數上限預留高度 |
  | Contributing Factors / Daily Care 內文上限 | **150 字** → portrait factor 內文 192 / step 160；landscape factor 160 / step 192 |
  | Key Points 內文上限 | **100 字** → portrait 內文 190（卡片 304），landscape 152（卡片 266）；只剩 2 張時平分整排，內文 114（卡片 228） |
  | Mobile | 寬度固定、高度 hug，卡片可以不等高；Contributing Factors / Daily Care 內文行高 19 |

- **Photo Limitation**
  - 不做成卡片，改成 Key Points 下方一行灰字：「**Photo Limitation:** 內文」（Semibold 標籤，iPad 22px，mobile 16px）。
  - 標題統一用「Photo Limitation」。

## 5. 待辦／未結事項

1. **Skin Type 分數條 pill icon**：artifact thread `4547938b-c5e5-4080-9377-f65ccdba00e9` 還開著。Figma 裡 Oily pill 放的是 U icon、Dry pill 放的是 T icon；prototype 依資料放成 Oily = T、Dry = U，正在等 Monic 確認是不是她故意對調的。
2. **Figma 待同步**（Monic 說她會自己改，你不用動）：
   - 詳細頁 iPad 的內文高度要改成上面表格的數值。
   - Mobile Contributing Factors / Daily Care 內文行高改 16/19。
   - Photo Limitation 改成小字的版本，要延伸到 landscape / mobile。
3. **未回覆的小問題**：
   - Firmness「Photo Limitation」102 字、Dark Circle「Photo Factor」101 字，超過 100 字上限，但目前放得下。現在都已移到小字，問題已不明顯。
   - Landscape 的 likelihood 免責聲明，Figma 放在 Daily Care 底下；prototype 維持放在 Contributing Factors 底下。
4. **素材限制**：
   - Forehead Botulinum 的圖 `331a1.jpg` 只有 480×320，解析度偏低。
   - 所有詳細頁的底圖都是 Redness 那張照片，兩頰帶紅。要換成乾淨底圖，需要 Monic 提供原始照片。
5. **已知的字型差異**：測試環境沒有 SF Pro，會 fallback 成 Inter，所以文字寬度比真機略寬。Landscape 的「Powered by」在 Inter 下間距會黏在一起，真機應該正常。

## 6. 常用驗證手法

- 本機開 `python3 -m http.server 8766`，用 Playwright 開 `index.html`。
  - Viewport：p 768×1024、l 1024×768、m 390×844。
  - 量測時要除以 `canvas._s`，換回設計 px。
- 溢出檢查用 `scrollHeight > clientHeight`。Mobile 行高 16 時，descender 會造成 +2 的誤判。
- 圖片變形檢查：非 cover / contain 的 img，比較 `(顯示寬/高) / (原圖寬/高)`，差異 > 3% 就算有問題。
