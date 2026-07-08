// --- state -------------------------------------------------------------

const DIGIT_DEFAULTS = { 0: 1, 1: 1, 2: 3, 3: 1, 4: 1, 5: 5, 6: 1, 7: 1, 8: 1, 9: 10 };

const digitTable = document.getElementById("digit-table");
const stageInput = document.getElementById("stage-number");
const stageDigitEl = document.getElementById("stage-digit");
const stageMultEl = document.getElementById("stage-multiplier");
const boostToggle = document.getElementById("boost-toggle");

const goalBody = document.getElementById("goal-body");

// --- digit multiplier table ---------------------------------------------

function renderDigitTable() {
  const headRow = document.createElement("tr");
  const valRow = document.createElement("tr");
  for (let d = 0; d <= 9; d++) {
    const th = document.createElement("th");
    th.textContent = d;
    headRow.appendChild(th);

    const td = document.createElement("td");
    const inp = document.createElement("input");
    inp.type = "number";
    inp.min = "0";
    inp.dataset.digit = String(d);
    inp.value = DIGIT_DEFAULTS[d];
    inp.disabled = true;
    inp.addEventListener("input", () => { updateStageMultiplier(); saveState(); });
    td.appendChild(inp);
    valRow.appendChild(td);
  }
  digitTable.appendChild(headRow);
  digitTable.appendChild(valRow);
}

let digitsUnlocked = false;
const toggleEditDigitsBtn = document.getElementById("toggle-edit-digits");
toggleEditDigitsBtn.addEventListener("click", () => {
  digitsUnlocked = !digitsUnlocked;
  digitTable.querySelectorAll("input").forEach((inp) => {
    inp.disabled = !digitsUnlocked;
  });
  toggleEditDigitsBtn.textContent = digitsUnlocked ? "🔓 編集を終える" : "🔒 編集する";
});

function getDigitValue(d) {
  const inp = digitTable.querySelector(`input[data-digit="${d}"]`);
  return inp ? Number(inp.value) || 0 : 0;
}

function updateStageMultiplier() {
  const n = stageInput.value.trim();
  if (n === "" || isNaN(n)) {
    stageDigitEl.textContent = "-";
    stageMultEl.textContent = "-";
    return;
  }
  const digit = Number(n) % 10;
  const base = getDigitValue(digit);
  const mult = boostToggle.checked ? base * 2 : base;
  stageDigitEl.textContent = digit;
  stageMultEl.textContent = `丸太 x${mult}`;
}

stageInput.addEventListener("input", () => { updateStageMultiplier(); saveState(); });
boostToggle.addEventListener("change", () => { updateStageMultiplier(); saveState(); });

// --- goal table ----------------------------------------------------------

const goalStartTierInput = document.getElementById("goal-start-tier");

function addGoalRow(name = "", qty = "", banked = "0", icon = "") {
  const tr = document.createElement("tr");
  const iconHtml = icon ? `<img src="./icons/${icon}" class="row-icon" alt="" />` : "";
  tr.innerHTML = `
    <td class="drag-cell"><span class="row-drag" title="ドラッグして並び替え">⠿</span></td>
    <td class="name-cell">${iconHtml}<input type="text" class="goal-name" value="${name}" placeholder="例: 剣" /></td>
    <td><span class="goal-tier-badge">-</span></td>
    <td><input type="number" class="goal-qty" min="0" value="${qty}" placeholder="?" /></td>
    <td><input type="number" class="goal-banked" min="0" value="${banked}" /></td>
    <td><button class="row-remove" title="削除">✕</button></td>
  `;
  tr.querySelector(".row-remove").addEventListener("click", () => {
    const removedName = tr.querySelector(".goal-name").value.trim();
    tr.remove();
    boardCells = boardCells.map((v) => (v === removedName ? null : v));
    recomputeGoalTiers();
    renderBoardGrid();
    updateBoardSummary();
    saveState();
  });
  tr.querySelector(".goal-qty").addEventListener("input", () => { renderProgressBar(); saveState(); });
  tr.querySelector(".goal-banked").addEventListener("input", () => { renderProgressBar(); saveState(); });
  tr.querySelector(".goal-name").addEventListener("input", saveState);
  enableRowDrag(tr, tr.querySelector(".row-drag"));
  goalBody.appendChild(tr);
  recomputeGoalTiers();
}

document.getElementById("add-goal-row").addEventListener("click", () => { addGoalRow(); saveState(); });

function recomputeGoalTiers() {
  const start = Number(goalStartTierInput.value) || 0;
  [...goalBody.querySelectorAll("tr")].forEach((tr, idx) => {
    const tier = start + idx;
    tr.dataset.tier = String(tier);
    const badge = tr.querySelector(".goal-tier-badge");
    if (badge) badge.textContent = tier;
  });
  renderProgressBar();
}

goalStartTierInput.addEventListener("input", () => { recomputeGoalTiers(); saveState(); });

// --- progress bar (mirrors the in-game Final Goal bar) ----------------------

const progressBarEl = document.getElementById("progress-bar");
const progressBarFillEl = document.getElementById("progress-bar-fill");

function requiredFor(qtyInput) {
  const q = Number(qtyInput.value) || 0;
  return q > 0 ? q : 1;
}

function renderProgressBar() {
  progressBarEl.querySelectorAll(".progress-item").forEach((el) => el.remove());
  const rows = [...goalBody.querySelectorAll("tr")].filter((tr) =>
    tr.querySelector(".goal-name").value.trim()
  );

  // 先頭から連続して「完了」しているところまでを現在地とみなす
  let doneCount = 0;
  for (const tr of rows) {
    const bankedInput = tr.querySelector(".goal-banked");
    const banked = Number(bankedInput.value) || 0;
    if (banked >= requiredFor(tr.querySelector(".goal-qty"))) doneCount++;
    else break;
  }

  rows.forEach((tr, idx) => {
    const name = tr.querySelector(".goal-name").value.trim();
    const iconImg = tr.querySelector(".name-cell img.row-icon");
    const isDone = idx < doneCount;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "progress-item" + (isDone ? " done" : "");
    btn.title = `${name}: タップで「ここまで完了」にする`;
    btn.innerHTML = iconImg
      ? `<img src="${iconImg.getAttribute("src")}" alt="${name}" />`
      : `<span class="cell-label">${name}</span>`;
    btn.addEventListener("click", () => {
      const alreadyCurrent = idx === doneCount - 1;
      rows.forEach((r, i) => {
        const bankedInput = r.querySelector(".goal-banked");
        const shouldBeDone = alreadyCurrent ? i < idx : i <= idx;
        bankedInput.value = shouldBeDone ? requiredFor(r.querySelector(".goal-qty")) : 0;
      });
      renderProgressBar();
      saveState();
    });
    progressBarEl.appendChild(btn);
  });

  updateProgressBarFill(doneCount);
}

function updateProgressBarFill(doneCount) {
  const prevDoneCount = Number(progressBarFillEl.dataset.doneCount || 0);
  progressBarFillEl.dataset.doneCount = doneCount;

  // 最初の1本目が完了する瞬間だけ、3倍ゆっくり・ease-out（速い→遅い）で伸ばす
  const isFirstFill = prevDoneCount === 0 && doneCount === 1;
  progressBarFillEl.style.transition = isFirstFill ? "width 10s cubic-bezier(0.33, 1, 0.68, 1)" : "";

  if (doneCount <= 0) {
    progressBarFillEl.style.width = "0px";
    return;
  }
  const items = [...progressBarEl.querySelectorAll(".progress-item")];
  const lastDone = items[doneCount - 1];
  progressBarFillEl.style.width = lastDone ? `${lastDone.offsetLeft + lastDone.offsetWidth}px` : "0px";
}

// --- drag-to-reorder (mouse + touch) ---------------------------------------

function enableRowDrag(tr, handle) {
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tr.classList.add("dragging");

    const onMove = (ev) => {
      const overRow = [...goalBody.querySelectorAll("tr")]
        .filter((r) => r !== tr)
        .find((r) => {
          const rect = r.getBoundingClientRect();
          return ev.clientY >= rect.top && ev.clientY <= rect.bottom;
        });
      if (!overRow) return;
      const overRect = overRow.getBoundingClientRect();
      const isAfter = ev.clientY > overRect.top + overRect.height / 2;
      if (isAfter) overRow.after(tr); else overRow.before(tr);
      recomputeGoalTiers();
    };

    const onUp = () => {
      tr.classList.remove("dragging");
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      saveState();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  });
}

// --- board grid (tap-to-fill, mirrors the in-game board) --------------------

function currentGoalNames() {
  return [...goalBody.querySelectorAll(".goal-name")]
    .map((i) => i.value.trim())
    .filter((v) => v.length > 0);
}

const BOARD_ROWS = 6;
const BOARD_COLS = 6;
let boardCells = new Array(BOARD_ROWS * BOARD_COLS).fill(null);

const boardGridEl = document.getElementById("board-grid");
const boardSummaryEl = document.getElementById("board-summary");
const cellPickerBackdrop = document.getElementById("cell-picker-backdrop");
const cellPickerOptions = document.getElementById("cell-picker-options");

function getBoardItemOptions() {
  const options = [{ name: "丸太", tier: 0, icon: "icon-log.png" }];
  [...goalBody.querySelectorAll("tr")].forEach((tr) => {
    const name = tr.querySelector(".goal-name").value.trim();
    if (!name) return;
    const iconImg = tr.querySelector(".name-cell img.row-icon");
    options.push({
      name,
      tier: Number(tr.dataset.tier) || 0,
      icon: iconImg ? iconImg.getAttribute("src").split("/").pop() : "",
    });
  });
  return options;
}

function tierForName(name) {
  if (name === "丸太") return 0;
  const tr = [...goalBody.querySelectorAll("tr")].find(
    (t) => t.querySelector(".goal-name").value.trim() === name
  );
  return tr ? Number(tr.dataset.tier) || 0 : 0;
}

function renderBoardGrid() {
  const options = getBoardItemOptions();
  boardGridEl.style.gridTemplateColumns = `repeat(${BOARD_COLS}, 1fr)`;
  boardGridEl.innerHTML = "";
  boardCells.forEach((name, idx) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "board-cell" + (name ? " filled" : "");
    if (name) {
      const opt = options.find((o) => o.name === name);
      cell.innerHTML = opt && opt.icon
        ? `<img src="./icons/${opt.icon}" alt="${name}" title="${name}" />`
        : `<span class="cell-label">${name}</span>`;
    }
    cell.addEventListener("click", () => openCellPicker(idx));
    boardGridEl.appendChild(cell);
  });
}

function updateBoardSummary() {
  const counts = {};
  boardCells.forEach((name) => {
    if (!name) return;
    counts[name] = (counts[name] || 0) + 1;
  });
  const parts = Object.entries(counts).map(([n, c]) => `${n}×${c}`);
  boardSummaryEl.textContent = parts.length ? `現在の盤面: ${parts.join(" / ")}` : "現在の盤面: (空)";
}

function openCellPicker(idx) {
  cellPickerOptions.innerHTML = "";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "cell-picker-option clear";
  clearBtn.textContent = "空にする";
  clearBtn.addEventListener("click", () => {
    boardCells[idx] = null;
    renderBoardGrid();
    updateBoardSummary();
    closeCellPicker();
    saveState();
  });
  cellPickerOptions.appendChild(clearBtn);

  getBoardItemOptions().forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell-picker-option";
    btn.innerHTML =
      (opt.icon ? `<img src="./icons/${opt.icon}" alt="" />` : "") + `<span>${opt.name}</span>`;
    btn.addEventListener("click", () => {
      boardCells[idx] = opt.name;
      renderBoardGrid();
      updateBoardSummary();
      closeCellPicker();
      saveState();
    });
    cellPickerOptions.appendChild(btn);
  });

  cellPickerBackdrop.classList.add("open");
}

function closeCellPicker() {
  cellPickerBackdrop.classList.remove("open");
}

document.getElementById("cell-picker-cancel").addEventListener("click", closeCellPicker);
cellPickerBackdrop.addEventListener("click", (e) => {
  if (e.target === cellPickerBackdrop) closeCellPicker();
});

document.getElementById("board-clear").addEventListener("click", () => {
  boardCells = new Array(BOARD_ROWS * BOARD_COLS).fill(null);
  renderBoardGrid();
  updateBoardSummary();
  saveState();
});

// --- calculation -----------------------------------------------------------

document.getElementById("calc-btn").addEventListener("click", () => {
  const goals = [...goalBody.querySelectorAll("tr")].map((tr) => ({
    name: tr.querySelector(".goal-name").value.trim(),
    tiers: Number(tr.dataset.tier) || 0,
    qty: Number(tr.querySelector(".goal-qty").value) || 0,
    banked: Number(tr.querySelector(".goal-banked").value) || 0,
  })).filter((g) => g.name);

  const invByName = {};
  boardCells.forEach((name) => {
    if (!name) return;
    invByName[name] = (invByName[name] || 0) + Math.pow(2, tierForName(name));
  });

  const n = stageInput.value.trim();
  const digit = n === "" || isNaN(n) ? 0 : Number(n) % 10;
  const base = getDigitValue(digit);
  const logsPerGame = Math.max(1, boostToggle.checked ? base * 2 : base);

  let totalRemaining = 0;
  const breakdown = goals.map((g) => {
    const required = Math.max(0, g.qty - g.banked) * Math.pow(2, g.tiers);
    const have = invByName[g.name] || 0;
    const remaining = Math.max(0, required - have);
    totalRemaining += remaining;
    return { ...g, required, have, remaining };
  });

  const gamesNeeded = totalRemaining > 0 ? Math.ceil(totalRemaining / logsPerGame) : 0;

  const resultEl = document.getElementById("result");
  resultEl.innerHTML = `
    <div class="result-total">残り 約 ${gamesNeeded} ゲーム</div>
    <div class="result-breakdown">
      <div><span>1ゲームあたり獲得</span><span>丸太換算 ${logsPerGame}</span></div>
      ${breakdown
        .map(
          (b) => `<div><span class="name">${b.name}</span><span>必要 ${b.required} / 保有 ${b.have} / 不足 ${b.remaining}</span></div>`
        )
        .join("")}
      <div><span>不足合計（丸太換算）</span><span>${totalRemaining}</span></div>
    </div>
  `;
});

// --- AI image fill (optional) -----------------------------------------------

const apiKeyInput = document.getElementById("api-key");
apiKeyInput.value = localStorage.getItem("mergeSmithApiKey") || "";
apiKeyInput.addEventListener("input", () => {
  localStorage.setItem("mergeSmithApiKey", apiKeyInput.value);
});

document.getElementById("analyze-image").addEventListener("click", async () => {
  const status = document.getElementById("analyze-status");
  const fileInput = document.getElementById("board-image");
  const apiKey = apiKeyInput.value.trim();
  const file = fileInput.files[0];

  if (!apiKey) { status.textContent = "APIキーを入力してください。"; return; }
  if (!file) { status.textContent = "画像を選択してください。"; return; }

  status.textContent = "解析中...";

  try {
    const base64 = await fileToBase64(file);
    const schemaPrompt = `これはスマホゲーム「Royal Match」の「Merge Smith」というマージイベントの盤面スクリーンショットです。
盤面上に置かれているアイテム（丸太・板・盾・兜・剣・鎧・マントなど）を種類ごとに数えてください。
同じ見た目のアイコンは同じ「段数」として扱い、より原始的な素材（丸太など）を段数0、そこから合成が進んだ見た目ほど段数を1,2,3...と上げてください（正確な段数が分からない場合は見た目の複雑さで推測してよいです）。
上部の進行バー（Final Goal に向けた目標アイテム列）が見えれば、そこに並ぶ完成アイテム名を左から順に列挙してください。
さらに、その進行バーのうち何番目まで（左から数えて）すでに完了（緑のラインより左・チェック済みなど）になっているかを goalBarCompletedCount として数字で返してください（例: 左2つが完了済みなら2）。進行バー自体が写っていない・完了状況が判断できない場合は goalBarCompletedCount を省略してください。
以下のJSON形式のみで出力してください（説明文不要）:
{"inventory":[{"name":"日本語の短い名前","tier":0,"count":1}],"goalItemNames":["名前1","名前2"],"goalBarCompletedCount":0}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: schemaPrompt },
                { inline_data: { mime_type: file.type || "image/png", data: base64 } },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした: " + text.slice(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);

    (parsed.goalItemNames || []).forEach((name) => {
      if (!currentGoalNames().includes(name)) addGoalRow(name);
    });

    let placed = 0;
    let skipped = 0;
    (parsed.inventory || []).forEach((item) => {
      const count = item.count ?? 1;
      for (let i = 0; i < count; i++) {
        const emptyIdx = boardCells.findIndex((v) => v === null);
        if (emptyIdx === -1) { skipped++; continue; }
        boardCells[emptyIdx] = item.name;
        placed++;
      }
    });
    renderBoardGrid();
    updateBoardSummary();

    let progressMsg = "";
    const goalItemNames = parsed.goalItemNames || [];
    if (typeof parsed.goalBarCompletedCount === "number" && goalItemNames.length > 0) {
      const n = Math.max(0, Math.min(parsed.goalBarCompletedCount, goalItemNames.length));
      const rows = [...goalBody.querySelectorAll("tr")];
      if (n > 0) {
        const targetName = goalItemNames[n - 1];
        const idx = rows.findIndex((tr) => tr.querySelector(".goal-name").value.trim() === targetName);
        if (idx !== -1) {
          rows.forEach((r, i) => {
            r.querySelector(".goal-banked").value = i <= idx ? requiredFor(r.querySelector(".goal-qty")) : 0;
          });
          progressMsg = `進行状況も「${targetName}」まで完了に反映しました。`;
        }
      } else {
        rows.forEach((r) => { r.querySelector(".goal-banked").value = 0; });
        progressMsg = "進行状況は未着手として反映しました。";
      }
      renderProgressBar();
    }

    status.textContent = `解析完了。目標${goalItemNames.length}件を追加し、盤面に${placed}個を配置しました。${skipped ? `（盤面が満杯のため${skipped}個は未配置）` : ""}${progressMsg}内容を確認・修正してください。`;
    saveState();
  } catch (err) {
    status.textContent = "解析に失敗しました: " + err.message;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- persistence (remembers your inputs across reloads) ---------------------

const STATE_STORAGE_KEY = "mergeSmithState";

function saveState() {
  const state = {
    stageNumber: stageInput.value,
    boost: boostToggle.checked,
    digits: Object.fromEntries(
      [...digitTable.querySelectorAll("input[data-digit]")].map((inp) => [inp.dataset.digit, inp.value])
    ),
    goalStartTier: goalStartTierInput.value,
    goalRows: [...goalBody.querySelectorAll("tr")].map((tr) => {
      const iconImg = tr.querySelector(".name-cell img.row-icon");
      return {
        name: tr.querySelector(".goal-name").value,
        qty: tr.querySelector(".goal-qty").value,
        banked: tr.querySelector(".goal-banked").value,
        icon: iconImg ? iconImg.getAttribute("src").split("/").pop() : "",
      };
    }),
    boardCells,
  };
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- init --------------------------------------------------------------

const DEFAULT_GOAL_ROWS = [
  { name: "板", qty: "", banked: "1", icon: "icon-plank.png" },
  { name: "丸盾", qty: "", banked: "1", icon: "icon-woodshield.png" },
  { name: "宝石の盾", qty: "", banked: "1", icon: "icon-gemshield.png" },
  { name: "紋章の盾", qty: "", banked: "1", icon: "icon-shield.png" },
  { name: "兜", qty: "", banked: "1", icon: "icon-helmet.png" },
  { name: "剣（1本）", qty: "", banked: "1", icon: "icon-sword-single.png" },
  { name: "剣", qty: "", banked: "0", icon: "icon-sword.png" },
  { name: "弓矢", qty: "", banked: "0", icon: "icon-bow.png" },
  { name: "鎧", qty: "", banked: "0", icon: "icon-armor.png" },
  { name: "マント", qty: "", banked: "0", icon: "icon-cape.png" },
];

renderDigitTable();

const savedState = loadState();
if (savedState) {
  stageInput.value = savedState.stageNumber || "";
  boostToggle.checked = !!savedState.boost;
  if (savedState.digits) {
    Object.entries(savedState.digits).forEach(([d, v]) => {
      const inp = digitTable.querySelector(`input[data-digit="${d}"]`);
      if (inp) inp.value = v;
    });
  }
  goalStartTierInput.value = savedState.goalStartTier ?? "1";
  const rows = savedState.goalRows && savedState.goalRows.length ? savedState.goalRows : DEFAULT_GOAL_ROWS;
  rows.forEach((r) => addGoalRow(r.name, r.qty, r.banked, r.icon));
  if (Array.isArray(savedState.boardCells) && savedState.boardCells.length === BOARD_ROWS * BOARD_COLS) {
    boardCells = savedState.boardCells;
  }
} else {
  DEFAULT_GOAL_ROWS.forEach((r) => addGoalRow(r.name, r.qty, r.banked, r.icon));
}

updateStageMultiplier();
renderBoardGrid();
updateBoardSummary();
