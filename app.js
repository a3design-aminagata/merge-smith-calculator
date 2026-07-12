// --- state -------------------------------------------------------------

const DIGIT_DEFAULTS = { 0: 1, 1: 1, 2: 3, 3: 1, 4: 1, 5: 5, 6: 1, 7: 1, 8: 1, 9: 10 };

const digitTable = document.getElementById("digit-table");

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
    inp.addEventListener("input", () => { renderGoalGamesEstimates(); saveState(); });
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

// --- goal table ----------------------------------------------------------

const crownLogsBadge = document.getElementById("crown-logs-badge");

function addGoalRow(name = "", icon = "") {
  const tr = document.createElement("tr");
  const iconHtml = icon ? `<img src="./icons/${icon}" class="row-icon" alt="" />` : "";
  tr.innerHTML = `
    <td class="drag-cell"><span class="row-drag" title="ドラッグして並び替え">⠿</span></td>
    <td class="name-cell">${iconHtml}<input type="text" class="goal-name" value="${name}" placeholder="例: 剣" /></td>
    <td><span class="goal-logs-badge">-</span></td>
    <td><span class="goal-games-badge">-</span></td>
  `;
  tr.querySelector(".goal-name").addEventListener("input", saveState);
  enableRowDrag(tr, tr.querySelector(".row-drag"));
  goalBody.appendChild(tr);
  recomputeGoalTiers();
}

document.getElementById("add-goal-row").addEventListener("click", () => { addGoalRow(); saveState(); });

function recomputeGoalTiers() {
  const rows = [...goalBody.querySelectorAll("tr")];
  rows.forEach((tr, idx) => {
    const tier = idx + 1;
    tr.dataset.tier = String(tier);
    const logsBadge = tr.querySelector(".goal-logs-badge");
    if (logsBadge) logsBadge.textContent = Math.pow(2, tier);
  });
  if (crownLogsBadge) crownLogsBadge.textContent = Math.pow(2, rows.length + 1);
  renderStageBonusList();
  renderGoalGamesEstimates();
}

// ざっと何ゲームかかるかの目安。一の位がどこから始まるかで変わるので、
// 0〜9の全開始位置で計算してその最小〜最大を範囲として出す。
function gamesRangeText(target) {
  if (target <= 0) return "0ゲーム";
  let min = Infinity;
  let max = -Infinity;
  for (let d = 0; d <= 9; d++) {
    const games = gamesNeededFrom(d, target, false);
    if (games < min) min = games;
    if (games > max) max = games;
  }
  return min === max ? `${min}ゲーム` : `${min}〜${max}ゲーム`;
}

// このtierに到達するまでに必ず通過している到達ボーナス(トリガーのtierが
// これより小さいもの)は、そこまでの過程で確定でもらえている前提で
// 丸太換算から差し引く。トリガーtier以上の分はまだ未通過なので含めない。
function stageBonusValueBelowTier(tier) {
  let total = 0;
  STAGE_BONUSES.forEach((bonus) => {
    if (tierForName(bonus.triggerName) >= tier) return;
    total += bonus.rewardItems.reduce(
      (sum, item) => sum + item.count * Math.pow(2, tierForName(item.name)),
      0
    );
  });
  return total;
}

function adjustedGoalTarget(tier) {
  return Math.max(0, Math.pow(2, tier) - stageBonusValueBelowTier(tier));
}

function renderGoalGamesEstimates() {
  const logBadge = document.getElementById("log-games-badge");
  if (logBadge) logBadge.textContent = gamesRangeText(adjustedGoalTarget(0));

  const rows = [...goalBody.querySelectorAll("tr")];
  rows.forEach((tr) => {
    const badge = tr.querySelector(".goal-games-badge");
    if (badge) badge.textContent = gamesRangeText(adjustedGoalTarget(Number(tr.dataset.tier) || 0));
  });

  const crownGamesBadge = document.getElementById("crown-games-badge");
  if (crownGamesBadge) crownGamesBadge.textContent = gamesRangeText(adjustedGoalTarget(rows.length + 1));
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

function goalTarget() {
  return Math.pow(2, goalBody.querySelectorAll("tr").length + 1);
}

// 盤面の一番高いアイテムが一定の段まで到達すると、次の段のステージ開始時に
// 無料でもらえるアイテムがある。到達済みのものを全部足して不足から引く。
const STAGE_BONUSES = [
  {
    triggerName: "シングルソード",
    rewardItems: [
      { name: "丸太", count: 12 },
      { name: "板", count: 4 },
      { name: "兜", count: 1 },
    ],
  },
  {
    triggerName: "クロスソード",
    rewardItems: [
      { name: "丸太", count: 12 },
      { name: "板", count: 5 },
      { name: "シングルソード", count: 1 },
      { name: "青の盾", count: 1 },
    ],
  },
  {
    triggerName: "弓矢",
    rewardItems: [
      { name: "丸太", count: 7 },
      { name: "板", count: 7 },
      { name: "シングルソード", count: 2 },
      { name: "青の盾", count: 2 },
      { name: "兜", count: 1 },
      { name: "金の盾", count: 1 },
    ],
  },
  {
    triggerName: "鎧",
    rewardItems: [
      { name: "青の盾", count: 7 },
      { name: "板", count: 6 },
      { name: "丸太", count: 5 },
      { name: "兜", count: 4 },
      { name: "クロスソード", count: 2 },
    ],
  },
  {
    triggerName: "マント",
    rewardItems: [
      { name: "板", count: 7 },
      { name: "青の盾", count: 4 },
      { name: "兜", count: 4 },
      { name: "丸太", count: 4 },
      { name: "クロスソード", count: 3 },
      { name: "シングルソード", count: 2 },
      { name: "弓矢", count: 1 },
      { name: "金の盾", count: 1 },
    ],
  },
];

const stageBonusListEl = document.getElementById("stage-bonus-list");

function renderStageBonusList() {
  if (!stageBonusListEl) return;
  stageBonusListEl.innerHTML = STAGE_BONUSES.map((bonus) => {
    const value = bonus.rewardItems.reduce(
      (sum, item) => sum + item.count * Math.pow(2, tierForName(item.name)),
      0
    );
    const itemsText = bonus.rewardItems.map((item) => `${item.name}×${item.count}`).join("、");
    return `
      <div class="bonus-row">
        <div class="bonus-title"><span>${bonus.triggerName}到達</span><span class="goal-logs-badge">丸太換算 ${value}</span></div>
        <div class="bonus-items">${itemsText}</div>
      </div>
    `;
  }).join("");
}

function boardHighestTier() {
  let max = 0;
  boardCells.forEach((name) => {
    if (!name) return;
    max = Math.max(max, tierForName(name));
  });
  return max;
}

// 盤面の一番高いアイテムから見て、まだ通過していない段の到達ボーナスは
// 全部これから確定でもらえる分。既に通過済みの段のボーナスは盤面の状態に
// 織り込み済みなので対象外、まだ先の段の分は全部合算して見積もる。
function pendingStageBonusTotal() {
  const highest = boardHighestTier();
  const applied = [];
  let total = 0;
  STAGE_BONUSES.forEach((bonus) => {
    if (tierForName(bonus.triggerName) <= highest) return;
    const value = bonus.rewardItems.reduce(
      (sum, item) => sum + item.count * Math.pow(2, tierForName(item.name)),
      0
    );
    total += value;
    applied.push({ name: bonus.triggerName, value });
  });
  return { total, applied };
}

// 盤面の一番高いアイテムの次の段（＝次に完成させたいアイテム）の情報
function nextItemInfo() {
  const rows = [...goalBody.querySelectorAll("tr")];
  const nextTier = boardHighestTier() + 1;
  if (nextTier > rows.length) return null;
  const tr = rows.find((t) => Number(t.dataset.tier) === nextTier);
  if (!tr) return null;
  const name = tr.querySelector(".goal-name").value.trim();
  const iconImg = tr.querySelector(".name-cell img.row-icon");
  const icon = iconImg ? iconImg.getAttribute("src").split("/").pop() : "";
  return { name, icon, target: Math.pow(2, nextTier) };
}

// STAGE_BONUSESはシングルソード到達時点からしか登録していない。兜到達時点の
// ボーナスはまだ未登録なので、盤面の一番高いアイテムが兜未満（金の盾以下）
// だと、pendingStageBonusTotalがその分を拾えずゲーム数がやや多めに出る
function missingBonusDataWarning() {
  if (boardHighestTier() >= tierForName("兜")) return "";
  return "⚠️ 兜ステージ以下の確定ボーナスがまだ未登録なので、下のゲーム数はやや多めに出ています。";
}

function rewardForDigit(d, boosted) {
  const base = getDigitValue(d);
  return Math.max(1, boosted ? base * 2 : base);
}

// 一の位はステージを1つクリアするごとに0→1→2→...→9→0と巡回するので、
// 開始する一の位から順に報酬を足していき、不足分に届くまでのゲーム数を数える
function gamesNeededFrom(startDigit, remaining, boosted) {
  if (remaining <= 0) return 0;
  let total = 0;
  let games = 0;
  let d = startDigit;
  while (total < remaining) {
    total += rewardForDigit(d, boosted);
    games++;
    d = (d + 1) % 10;
  }
  return games;
}

document.getElementById("calc-btn").addEventListener("click", () => {
  const target = goalTarget();

  const invByName = {};
  let haveTotal = 0;
  boardCells.forEach((name) => {
    if (!name) return;
    const value = Math.pow(2, tierForName(name));
    invByName[name] = (invByName[name] || 0) + value;
    haveTotal += value;
  });

  const remaining = Math.max(0, target - haveTotal);
  const { total: bonusTotal, applied: appliedBonuses } = pendingStageBonusTotal();
  const adjustedRemaining = Math.max(0, remaining - bonusTotal);

  const nextInfo = nextItemInfo();
  const nextRemaining = nextInfo === null ? null : Math.max(0, nextInfo.target - haveTotal);
  const nextHeader = nextInfo
    ? (nextInfo.icon ? `<img src="./icons/${nextInfo.icon}" class="row-icon" alt="${nextInfo.name}" />` : nextInfo.name) + "まで"
    : "次アイテム";

  const perDigitRows = Array.from({ length: 10 }, (_, d) => {
    const normal = gamesNeededFrom(d, adjustedRemaining, false);
    const boosted = gamesNeededFrom(d, adjustedRemaining, true);
    const nextNormal = nextRemaining === null ? "-" : gamesNeededFrom(d, nextRemaining, false);
    const nextBoosted = nextRemaining === null ? "-" : gamesNeededFrom(d, nextRemaining, true);
    return `<tr><td>${d}</td><td>${normal}</td><td>${boosted}</td><td>${nextNormal}</td><td>${nextBoosted}</td></tr>`;
  }).join("");

  const invLines = Object.entries(invByName)
    .map(([name, value]) => `<div><span class="name">${name}</span><span>丸太換算 ${value}</span></div>`)
    .join("");

  const bonusLines = appliedBonuses
    .map((b) => `<div><span class="name">${b.name}ボーナス（未到達分）</span><span>-${b.value}</span></div>`)
    .join("");
  const bonusLine = bonusTotal > 0
    ? `${bonusLines}<div><span>不足（ボーナス反映後）</span><span>丸太換算 ${adjustedRemaining}</span></div>`
    : "";

  const warning = missingBonusDataWarning();

  const resultEl = document.getElementById("result");
  resultEl.innerHTML = `
    <div class="result-breakdown">
      ${warning ? `<p class="note warn">${warning}</p>` : ""}
      <div><span>目標合計</span><span>丸太換算 ${target}</span></div>
      <div><span>盤面の保有合計</span><span>丸太換算 ${haveTotal}</span></div>
      <div><span>不足</span><span>丸太換算 ${remaining}</span></div>
      ${bonusLine}
      ${invLines ? `<div class="result-sep">盤面の内訳</div>${invLines}` : ""}
      <div class="result-sep">👑までのゲーム数</div>
      <table class="mini-result-table">
        <thead><tr><th>一の位</th><th><img src="./icons/icon-crown.png" class="row-icon" alt="王冠" />まで</th><th>x2</th><th>${nextHeader}</th><th>x2</th></tr></thead>
        <tbody>${perDigitRows}</tbody>
      </table>
    </div>
  `;
});

// --- AI image fill (optional) -----------------------------------------------

const GEMINI_PROXY_URL = "https://merge-smith-gemini-proxy.ami-nagata.workers.dev";

document.getElementById("analyze-image").addEventListener("click", async () => {
  const status = document.getElementById("analyze-status");
  const fileInput = document.getElementById("board-image");
  const file = fileInput.files[0];

  if (!file) { status.textContent = "画像を選択してください。"; return; }

  status.textContent = "解析中...";

  try {
    const base64 = await fileToBase64(file);
    const schemaPrompt = `これはスマホゲーム「Royal Match」の「Merge Smith」というマージイベントの盤面スクリーンショットです。
盤面上に置かれているアイテムを種類ごとに数えてください。名前は必ず次の一覧から見た目が一致するものを選び、一覧にない見た目のアイテムだけ自由に短い名前を付けてください:
丸太, 板, 木の盾（丸くて木目調の盾）, 青の盾（青い宝石つきの盾）, 金の盾（金と青の紋章の盾）, 兜, シングルソード（剣1本）, クロスソード（剣2本が交差）, 弓矢, 鎧, マント
同じ見た目のアイコンは同じ「段数」として扱い、より原始的な素材（丸太など）を段数0、そこから合成が進んだ見た目ほど段数を1,2,3...と上げてください（正確な段数が分からない場合は見た目の複雑さで推測してよいです）。
上部の進行バー（Final Goal に向けた目標アイテム列）が見えれば、そこに並ぶ完成アイテム名を左から順に列挙してください（同じく上記の名前一覧を使ってください）。
以下のJSON形式のみで出力してください（説明文不要）:
{"inventory":[{"name":"日本語の短い名前","tier":0,"count":1}],"goalItemNames":["名前1","名前2"]}`;

    const res = await fetch(GEMINI_PROXY_URL, {
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
    });

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

    const goalItemNames = parsed.goalItemNames || [];
    status.textContent = `解析完了。目標${goalItemNames.length}件を追加し、盤面に${placed}個を配置しました。${skipped ? `（盤面が満杯のため${skipped}個は未配置）` : ""}内容を確認・修正してください。`;
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
    digits: Object.fromEntries(
      [...digitTable.querySelectorAll("input[data-digit]")].map((inp) => [inp.dataset.digit, inp.value])
    ),
    goalRows: [...goalBody.querySelectorAll("tr")].map((tr) => {
      const iconImg = tr.querySelector(".name-cell img.row-icon");
      return {
        name: tr.querySelector(".goal-name").value,
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
  { name: "板", icon: "icon-plank.png" },
  { name: "木の盾", icon: "icon-woodshield.png" },
  { name: "青の盾", icon: "icon-gemshield.png" },
  { name: "金の盾", icon: "icon-shield.png" },
  { name: "兜", icon: "icon-helmet.png" },
  { name: "シングルソード", icon: "icon-sword-single.png" },
  { name: "クロスソード", icon: "icon-sword.png" },
  { name: "弓矢", icon: "icon-bow.png" },
  { name: "鎧", icon: "icon-armor.png" },
  { name: "マント", icon: "icon-cape.png" },
];

renderDigitTable();

const savedState = loadState();
if (savedState) {
  if (savedState.digits) {
    Object.entries(savedState.digits).forEach(([d, v]) => {
      const inp = digitTable.querySelector(`input[data-digit="${d}"]`);
      if (inp) inp.value = v;
    });
  }
  const rows = savedState.goalRows && savedState.goalRows.length ? savedState.goalRows : DEFAULT_GOAL_ROWS;
  rows.forEach((r) => addGoalRow(r.name, r.icon));
  if (Array.isArray(savedState.boardCells) && savedState.boardCells.length === BOARD_ROWS * BOARD_COLS) {
    boardCells = savedState.boardCells;
  }
} else {
  DEFAULT_GOAL_ROWS.forEach((r) => addGoalRow(r.name, r.icon));
}

renderBoardGrid();
updateBoardSummary();
