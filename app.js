// --- state -------------------------------------------------------------

const DIGIT_DEFAULTS = { 0: 1, 1: 1, 2: 3, 3: 1, 4: 1, 5: 5, 6: 1, 7: 1, 8: 1, 9: 10 };

const digitTable = document.getElementById("digit-table");
const stageInput = document.getElementById("stage-number");
const stageDigitEl = document.getElementById("stage-digit");
const stageMultEl = document.getElementById("stage-multiplier");
const boostToggle = document.getElementById("boost-toggle");

const goalBody = document.getElementById("goal-body");
const invBody = document.getElementById("inv-body");

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
    inp.addEventListener("input", updateStageMultiplier);
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

stageInput.addEventListener("input", updateStageMultiplier);
boostToggle.addEventListener("change", updateStageMultiplier);

// --- goal table ----------------------------------------------------------

function addGoalRow(name = "", tiers = "", qty = "", banked = "0", icon = "") {
  const tr = document.createElement("tr");
  const iconHtml = icon ? `<img src="./icons/${icon}" class="row-icon" alt="" />` : "";
  tr.innerHTML = `
    <td class="name-cell">${iconHtml}<input type="text" class="goal-name" value="${name}" placeholder="例: 剣" /></td>
    <td><input type="number" class="goal-tiers" min="0" value="${tiers}" placeholder="?" /></td>
    <td><input type="number" class="goal-qty" min="0" value="${qty}" placeholder="?" /></td>
    <td><input type="number" class="goal-banked" min="0" value="${banked}" /></td>
    <td><button class="row-remove" title="削除">✕</button></td>
  `;
  tr.querySelector(".row-remove").addEventListener("click", () => {
    tr.remove();
    refreshInvNameOptions();
  });
  tr.querySelector(".goal-name").addEventListener("input", refreshInvNameOptions);
  goalBody.appendChild(tr);
  refreshInvNameOptions();
}

document.getElementById("add-goal-row").addEventListener("click", () => addGoalRow());

// --- inventory table -------------------------------------------------------

function currentGoalNames() {
  return [...goalBody.querySelectorAll(".goal-name")]
    .map((i) => i.value.trim())
    .filter((v) => v.length > 0);
}

function refreshInvNameOptions() {
  const names = currentGoalNames();
  invBody.querySelectorAll("select.inv-name").forEach((sel) => {
    const prev = sel.value;
    sel.innerHTML =
      `<option value="">(選択)</option>` +
      names.map((n) => `<option value="${n}">${n}</option>`).join("");
    if (names.includes(prev)) sel.value = prev;
  });
}

function addInvRow(name = "", tier = "", count = "") {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="name-cell"><select class="inv-name"></select></td>
    <td><input type="number" class="inv-tier" min="0" value="${tier}" /></td>
    <td><input type="number" class="inv-count" min="0" value="${count}" /></td>
    <td><button class="row-remove" title="削除">✕</button></td>
  `;
  tr.querySelector(".row-remove").addEventListener("click", () => tr.remove());
  invBody.appendChild(tr);
  refreshInvNameOptions();
  if (name) tr.querySelector(".inv-name").value = name;
}

document.getElementById("add-inv-row").addEventListener("click", () => addInvRow());

// --- calculation -----------------------------------------------------------

document.getElementById("calc-btn").addEventListener("click", () => {
  const goals = [...goalBody.querySelectorAll("tr")].map((tr) => ({
    name: tr.querySelector(".goal-name").value.trim(),
    tiers: Number(tr.querySelector(".goal-tiers").value) || 0,
    qty: Number(tr.querySelector(".goal-qty").value) || 0,
    banked: Number(tr.querySelector(".goal-banked").value) || 0,
  })).filter((g) => g.name);

  const invByName = {};
  [...invBody.querySelectorAll("tr")].forEach((tr) => {
    const name = tr.querySelector(".inv-name").value;
    const tier = Number(tr.querySelector(".inv-tier").value) || 0;
    const count = Number(tr.querySelector(".inv-count").value) || 0;
    if (!name) return;
    invByName[name] = (invByName[name] || 0) + count * Math.pow(2, tier);
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
上部の進行バー（Final Goal に向けた目標アイテム列）が見えれば、そこに並ぶ完成アイテム名も列挙してください。
以下のJSON形式のみで出力してください（説明文不要）:
{"inventory":[{"name":"日本語の短い名前","tier":0,"count":1}],"goalItemNames":["名前1","名前2"]}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: file.type || "image/png", data: base64 } },
              { type: "text", text: schemaPrompt },
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
    const text = data.content?.map((c) => c.text).join("") || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが見つかりませんでした: " + text.slice(0, 200));
    const parsed = JSON.parse(jsonMatch[0]);

    (parsed.goalItemNames || []).forEach((name) => {
      if (!currentGoalNames().includes(name)) addGoalRow(name);
    });
    (parsed.inventory || []).forEach((item) => {
      addInvRow(item.name, item.tier ?? 0, item.count ?? 1);
    });

    status.textContent = `解析完了。目標${(parsed.goalItemNames || []).length}件・在庫${(parsed.inventory || []).length}件を追加しました。内容を確認・修正してください。`;
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

// --- init --------------------------------------------------------------

renderDigitTable();
addGoalRow("剣", "", "", "0", "icon-sword.png");
addGoalRow("弓矢", "", "", "0", "icon-bow.png");
addGoalRow("鎧", "", "", "0", "icon-armor.png");
addGoalRow("マント", "", "", "0", "icon-cape.png");
addInvRow();
