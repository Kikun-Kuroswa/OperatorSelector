(() => {
  "use strict";

  const ICON_BASE = "https://assets.arkpedia.net/arkpedia/arkpedia-image-assets/fb8ce98b867c148d4ffe6c301c9b03ba45e79d7b";
  const CLASSES = ["Vanguard", "Guard", "Defender", "Sniper", "Caster", "Medic", "Supporter", "Specialist"];
  const RARITIES = [6, 5, 4, 3, 2, 1];
  const TAG_GROUPS = [
    ["Top Operator", "Senior Operator", "Starter", "Robot"],
    ["Melee", "Ranged"],
    [
      "DPS", "Healing", "Support", "Defense", "DP-Recovery", "AoE", "Survival",
      "Crowd-Control", "Slow", "Debuff", "Nuker", "Fast-Redeploy", "Summon",
      "Shift", "Elemental", "Soar"
    ]
  ];

  const OPERATORS = (Array.isArray(window.OPERATORS) ? window.OPERATORS : []).map((op) => ({
    ...op,
    tags: Array.isArray(op.tags) ? op.tags.map((t) => String(t).trim()).filter(Boolean) : []
  }));

  const state = {
    search: "",
    stars: new Set(),
    classes: new Set(),
    branches: new Set(),
    tags: new Set(),
    tagMode: "all", // "all" | "any"
    includeFuture: false,
    noRepeats: false,
    drawnNames: new Set(),
    pickMode: "single", // "single" | "multi"
    pickCount: 5,
    pickAll: false,
    tagsTrayOpen: true,
    poolOpen: false,
    results: [],
    history: [],
    branchFilterText: ""
  };

  // DOM References
  const $ = (id) => document.getElementById(id);
  const el = {
    themeToggle: $("themeToggle"),
    navPoolCount: $("navPoolCount"),
    navDrawMode: $("navDrawMode"),
    nameSearch: $("nameSearch"),
    clearSearchBtn: $("clearSearchBtn"),
    rarityGroup: $("rarityGroup"),
    classGroup: $("classGroup"),
    branchSelectRoot: $("branchSelectRoot"),
    branchTrigger: $("branchTrigger"),
    branchTriggerLabel: $("branchTriggerLabel"),
    branchMenu: $("branchMenu"),
    branchSearch: $("branchSearch"),
    clearBranchesBtn: $("clearBranchesBtn"),
    branchOptions: $("branchOptions"),
    toggleTagsBtn: $("toggleTagsBtn"),
    tagsCountBadge: $("tagsCountBadge"),
    tagsTray: $("tagsTray"),
    tagModeGroup: $("tagModeGroup"),
    clearTagsBtn: $("clearTagsBtn"),
    tagsGroup: $("tagsGroup"),
    showCnBtn: $("showCnBtn"),
    noRepeatsBtn: $("noRepeatsBtn"),
    resetBtn: $("resetBtn"),
    activeChipsRow: $("activeChipsRow"),
    activeChipsList: $("activeChipsList"),
    poolCountNum: $("poolCountNum"),
    poolSubHint: $("poolSubHint"),
    togglePoolBtn: $("togglePoolBtn"),
    pickModeGroup: $("pickModeGroup"),
    multiCountWrap: $("multiCountWrap"),
    countDownBtn: $("countDownBtn"),
    countInput: $("countInput"),
    countUpBtn: $("countUpBtn"),
    quickCounts: $("quickCounts"),
    drawBtn: $("drawBtn"),
    drawBtnLabel: $("drawBtnLabel"),
    resultsHeader: $("resultsHeader"),
    resultsHeading: $("resultsHeading"),
    resultsMeta: $("resultsMeta"),
    rerollAllBtn: $("rerollAllBtn"),
    copyNamesBtn: $("copyNamesBtn"),
    clearResultsBtn: $("clearResultsBtn"),
    resultsContainer: $("resultsContainer"),
    emptyState: $("emptyState"),
    emptyTitle: $("emptyTitle"),
    emptyHint: $("emptyHint"),
    historySection: $("historySection"),
    historyList: $("historyList"),
    clearHistoryBtn: $("clearHistoryBtn"),
    poolDrawer: $("poolDrawer"),
    poolDrawerTitle: $("poolDrawerTitle"),
    closePoolBtn: $("closePoolBtn"),
    poolGrid: $("poolGrid"),
    opModal: $("opModal"),
    modalCloseBtn: $("modalCloseBtn"),
    modalCloseAction: $("modalCloseAction"),
    modalArtImg: $("modalArtImg"),
    artTabE2: $("artTabE2"),
    artTabIcon: $("artTabIcon"),
    modalFaction: $("modalFaction"),
    modalOpName: $("modalOpName"),
    modalMeta: $("modalMeta"),
    modalTags: $("modalTags"),
    modalArkpediaLink: $("modalArkpediaLink"),
    toast: $("toast")
  };

  let toastTimer = null;
  let modalOp = null;

  // Build lookup of all branches grouped by class
  const branchesByClass = (() => {
    const map = new Map(CLASSES.map((c) => [c, new Set()]));
    for (const op of OPERATORS) {
      if (!op.branch) continue;
      if (!map.has(op.class)) map.set(op.class, new Set());
      map.get(op.class).add(op.branch);
    }
    const out = new Map();
    for (const [cls, set] of map.entries()) {
      out.set(cls, [...set].sort((a, b) => a.localeCompare(b)));
    }
    return out;
  })();

  // Complete ordered tag groups (adding any extra dataset tags safely)
  const orderedTagGroups = (() => {
    const known = new Set(TAG_GROUPS.flat());
    const extras = new Set();
    for (const op of OPERATORS) {
      for (const t of op.tags) {
        if (!known.has(t)) extras.add(t);
      }
    }
    const groups = TAG_GROUPS.map((g) => [...g]);
    if (extras.size) groups.push([...extras].sort((a, b) => a.localeCompare(b)));
    return groups;
  })();

  // Helpers
  function classIconUrl(cls) {
    return `${ICON_BASE}/class-icons/${encodeURIComponent(cls)}.webp`;
  }

  function branchIconUrl(branch) {
    return `${ICON_BASE}/branch-icons/${encodeURIComponent(branch)}.webp`;
  }

  function createMaskIcon(url, size, label) {
    const span = document.createElement("span");
    span.className = "mask-icon";
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", label);
    span.title = label;
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.maskImage = `url("${url}")`;
    span.style.webkitMaskImage = `url("${url}")`;
    return span;
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function matchesNonTagFilters(op) {
    if (!state.includeFuture && op.future) return false;
    if (state.stars.size > 0 && !state.stars.has(op.rarity)) return false;
    if (state.classes.size > 0 && !state.classes.has(op.class)) return false;
    if (state.branches.size > 0 && (!op.branch || !state.branches.has(op.branch))) return false;

    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = `${op.name} ${op.branch || ""} ${op.class} ${op.faction || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function matchesTags(op) {
    if (state.tags.size === 0) return true;
    if (state.tagMode === "all") {
      for (const t of state.tags) {
        if (!op.tags.includes(t)) return false;
      }
      return true;
    }
    for (const t of state.tags) {
      if (op.tags.includes(t)) return true;
    }
    return false;
  }

  function getMatchingPool() {
    return OPERATORS.filter((op) => matchesNonTagFilters(op) && matchesTags(op));
  }

  // Initialization of static filter controls
  function buildFilterControls() {
    // Rarity buttons (6★ -> 1★)
    el.rarityGroup.innerHTML = "";
    for (const r of RARITIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip rarity-chip";
      btn.dataset.rarity = String(r);
      btn.setAttribute("aria-label", `${r}-star`);
      btn.setAttribute("aria-pressed", "false");
      btn.textContent = `${r}★`;
      btn.addEventListener("click", () => {
        if (state.stars.has(r)) state.stars.delete(r);
        else state.stars.add(r);
        updateUI();
      });
      el.rarityGroup.appendChild(btn);
    }

    // Class icon buttons
    el.classGroup.innerHTML = "";
    for (const cls of CLASSES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip roster-icon-chip";
      btn.dataset.cls = cls;
      btn.setAttribute("aria-label", cls);
      btn.setAttribute("aria-pressed", "false");
      btn.title = cls;
      btn.appendChild(createMaskIcon(classIconUrl(cls), 22, cls));
      btn.addEventListener("click", () => {
        if (state.classes.has(cls)) state.classes.delete(cls);
        else state.classes.add(cls);
        updateUI();
      });
      el.classGroup.appendChild(btn);
    }

    // Tag buttons
    el.tagsGroup.innerHTML = "";
    orderedTagGroups.forEach((group, gi) => {
      if (gi > 0) {
        const div = document.createElement("span");
        div.className = "tag-divider";
        div.setAttribute("aria-hidden", "true");
        el.tagsGroup.appendChild(div);
      }
      for (const tag of group) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-chip tag-chip";
        btn.dataset.tag = tag;
        btn.setAttribute("aria-pressed", "false");

        const label = document.createElement("span");
        label.textContent = tag;
        const count = document.createElement("span");
        count.className = "tag-count";
        count.textContent = "0";

        btn.append(label, count);
        btn.addEventListener("click", () => {
          if (state.tags.has(tag)) state.tags.delete(tag);
          else state.tags.add(tag);
          updateUI();
        });
        el.tagsGroup.appendChild(btn);
      }
    });
  }

  function renderBranchOptions(basePool) {
    const q = state.branchFilterText.trim().toLowerCase();
    const counts = new Map();
    for (const op of OPERATORS) {
      if (!op.branch) continue;
      if (!state.includeFuture && op.future) continue;
      if (state.stars.size > 0 && !state.stars.has(op.rarity)) continue;
      counts.set(op.branch, (counts.get(op.branch) || 0) + 1);
    }

    // Order selected classes first if any class filter is active
    const orderedClasses = [
      ...CLASSES.filter((c) => state.classes.size === 0 || state.classes.has(c)),
      ...CLASSES.filter((c) => state.classes.size > 0 && !state.classes.has(c))
    ];

    el.branchOptions.innerHTML = "";
    let totalShown = 0;

    for (const cls of orderedClasses) {
      const branches = (branchesByClass.get(cls) || []).filter((b) =>
        !q || b.toLowerCase().includes(q) || cls.toLowerCase().includes(q)
      );
      if (branches.length === 0) continue;

      const groupLabel = document.createElement("div");
      groupLabel.className = "menu-group-label";
      groupLabel.appendChild(createMaskIcon(classIconUrl(cls), 13, cls));
      const groupText = document.createElement("span");
      groupText.textContent = state.classes.size > 0 && !state.classes.has(cls) ? `${cls} (outside class filter)` : cls;
      groupLabel.appendChild(groupText);
      el.branchOptions.appendChild(groupLabel);

      for (const branch of branches) {
        totalShown++;
        const selected = state.branches.has(branch);
        const opt = document.createElement("button");
        opt.type = "button";
        opt.className = "menu-option";
        opt.setAttribute("role", "option");
        opt.setAttribute("aria-selected", String(selected));

        const main = document.createElement("span");
        main.className = "menu-option-main";
        main.appendChild(createMaskIcon(branchIconUrl(branch), 17, branch));
        const nameSpan = document.createElement("span");
        nameSpan.textContent = branch;
        main.appendChild(nameSpan);

        const meta = document.createElement("span");
        meta.className = "menu-option-meta";
        const cnt = document.createElement("span");
        cnt.textContent = String(counts.get(branch) || 0);
        const chk = document.createElement("span");
        chk.className = "menu-check";
        chk.textContent = selected ? "✓" : "";
        meta.append(cnt, chk);

        opt.append(main, meta);
        opt.addEventListener("click", () => {
          if (state.branches.has(branch)) state.branches.delete(branch);
          else state.branches.add(branch);
          updateUI();
        });
        el.branchOptions.appendChild(opt);
      }
    }

    if (totalShown === 0) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.style.padding = "14px 12px";
      empty.textContent = "No archetypes match your search.";
      el.branchOptions.appendChild(empty);
    }

    // Trigger label
    if (state.branches.size === 0) {
      el.branchTriggerLabel.textContent = "All archetypes";
      el.branchTrigger.dataset.placeholder = "true";
      el.branchTrigger.classList.remove("has-value");
    } else if (state.branches.size === 1) {
      const [only] = [...state.branches];
      el.branchTriggerLabel.textContent = only;
      el.branchTrigger.dataset.placeholder = "false";
      el.branchTrigger.classList.add("has-value");
    } else {
      el.branchTriggerLabel.textContent = `${state.branches.size} archetypes`;
      el.branchTrigger.dataset.placeholder = "false";
      el.branchTrigger.classList.add("has-value");
    }
  }

  function renderActiveChips() {
    const items = [];
    for (const r of [...state.stars].sort((a, b) => b - a)) {
      items.push({ label: `${r}★`, remove: () => state.stars.delete(r) });
    }
    for (const cls of CLASSES) {
      if (state.classes.has(cls)) {
        items.push({ label: cls, remove: () => state.classes.delete(cls) });
      }
    }
    for (const br of [...state.branches].sort()) {
      items.push({ label: br, remove: () => state.branches.delete(br) });
    }
    for (const tag of state.tags) {
      items.push({ label: `Tag: ${tag}`, remove: () => state.tags.delete(tag) });
    }
    if (state.search) {
      items.push({
        label: `"${state.search}"`,
        remove: () => {
          state.search = "";
          el.nameSearch.value = "";
        }
      });
    }

    el.activeChipsList.innerHTML = "";
    el.activeChipsRow.hidden = items.length === 0;

    for (const item of items) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "active-chip";
      btn.title = `Remove ${item.label}`;
      btn.textContent = item.label;
      const x = document.createElement("span");
      x.setAttribute("aria-hidden", "true");
      x.textContent = "×";
      btn.appendChild(x);
      btn.addEventListener("click", () => {
        item.remove();
        updateUI();
      });
      li.appendChild(btn);
      el.activeChipsList.appendChild(li);
    }
  }

  function createOperatorCard(op, options = {}) {
    const { showTags = true, allowReroll = false, cardIndex = -1, animate = true } = options;

    const card = document.createElement("article");
    card.className = animate ? "card roster-card rise-in" : "card roster-card";
    if (animate && cardIndex >= 0) {
      card.style.animationDelay = `${Math.min(cardIndex, 15) * 35}ms`;
    }
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${op.name}, ${op.rarity}-star ${op.class}${op.branch ? ` (${op.branch})` : ""}. Open details`);

    // Portrait frame
    const avatar = document.createElement("div");
    avatar.className = `avatar tier-${op.rarity}`;

    const img = document.createElement("img");
    img.src = op.icon || op.art || "";
    img.alt = op.name;
    img.loading = "lazy";
    img.decoding = "async";
    avatar.appendChild(img);

    if (op.future) {
      const badge = document.createElement("span");
      badge.className = "card-cn-badge";
      badge.textContent = "CN";
      badge.title = "Unreleased on Global (CN-only)";
      avatar.appendChild(badge);
    }

    if (allowReroll) {
      const reroll = document.createElement("button");
      reroll.type = "button";
      reroll.className = "card-reroll-btn";
      reroll.title = "Reroll this card";
      reroll.setAttribute("aria-label", `Reroll ${op.name}`);
      reroll.innerHTML = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 9.5a6.5 6.5 0 1 1-1.6-4.3L17 7.3"/><path d="M17 3.5v3.8h-3.8"/></svg>`;
      reroll.addEventListener("click", (e) => {
        e.stopPropagation();
        rerollSingleSlot(cardIndex);
      });
      avatar.appendChild(reroll);
    }

    card.appendChild(avatar);

    // Name
    const nameEl = document.createElement("p");
    nameEl.className = "op-name";
    nameEl.textContent = op.name;
    card.appendChild(nameEl);

    // Rarity + Class Icon + Branch Icon + Branch Name (Arkpedia exact layout)
    const meta = document.createElement("p");
    meta.className = "hint roster-class-branch";

    const raritySpan = document.createElement("span");
    raritySpan.className = `rarity rarity-${op.rarity}`;
    raritySpan.textContent = `${op.rarity}★`;
    meta.appendChild(raritySpan);

    meta.appendChild(createMaskIcon(classIconUrl(op.class), 15, op.class));
    if (op.branch) {
      meta.appendChild(createMaskIcon(branchIconUrl(op.branch), 15, op.branch));
    }
    const branchText = document.createElement("span");
    branchText.textContent = op.branch || op.class;
    meta.appendChild(branchText);
    card.appendChild(meta);

    // Tags on card
    if (showTags && op.tags.length > 0) {
      const tagsWrap = document.createElement("div");
      tagsWrap.className = "card-tags";
      const isSingle = state.results.length === 1 && allowReroll && state.pickMode === "single";
      const displayTags = isSingle ? op.tags : op.tags.filter((t) => t !== "Top Operator" && t !== "Senior Operator").slice(0, 4);
      const shown = displayTags.length > 0 ? displayTags : op.tags.slice(0, 4);

      for (const tag of shown) {
        const pill = document.createElement("span");
        pill.className = state.tags.has(tag) ? "card-tag is-matched" : "card-tag";
        pill.textContent = tag;
        tagsWrap.appendChild(pill);
      }

      if (!isSingle) {
        const hiddenCount = op.tags.length - shown.length;
        if (hiddenCount > 0 && state.tags.size > 0) {
          // Ensure any matched tag not in `shown` is surfaced cleanly
          for (const mt of state.tags) {
            if (!shown.includes(mt) && op.tags.includes(mt)) {
              const pill = document.createElement("span");
              pill.className = "card-tag is-matched";
              pill.textContent = mt;
              tagsWrap.appendChild(pill);
            }
          }
        }
      }
      card.appendChild(tagsWrap);
    }

    if (state.results.length === 1 && allowReroll && state.pickMode === "single") {
      const foot = document.createElement("div");
      foot.className = "card-foot-note";
      const fac = document.createElement("span");
      fac.textContent = op.faction || "Rhodes Island";
      const link = document.createElement("a");
      link.href = op.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Arkpedia ↗";
      link.addEventListener("click", (e) => e.stopPropagation());
      foot.append(fac, link);
      card.appendChild(foot);
    }

    card.addEventListener("click", () => openModal(op));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        if (e.target === card) {
          e.preventDefault();
          openModal(op);
        }
      }
    });

    return card;
  }

  function renderResults(pool) {
    const hasResults = state.results.length > 0;
    el.resultsHeader.hidden = !hasResults;
    el.resultsContainer.innerHTML = "";
    el.emptyState.hidden = hasResults;

    if (!hasResults) {
      el.resultsContainer.className = "results-stage";
      if (pool.length === 0) {
        el.emptyTitle.textContent = "No Matching Operators";
        el.emptyHint.innerHTML = "Your current filter combination matches 0 operators. Try clearing a tag or switching tag mode to <strong>Match Any</strong>.";
      } else {
        el.emptyTitle.textContent = "Ready to Roll";
        const label = state.pickMode === "single"
          ? "Pick 1 Operator"
          : (state.pickAll ? `Draw All (${pool.length})` : `Draw ${Math.min(state.pickCount, pool.length)} Operators`);
        el.emptyHint.innerHTML = `<strong>${pool.length}</strong> operators match your current filters. Click <strong>${label}</strong> or press <kbd>R</kbd> to draw.`;
      }
      return;
    }

    const isSingleCard = state.results.length === 1 && state.pickMode === "single";
    el.resultsHeading.textContent = state.results.length === 1 ? "Selected Operator" : `Selected Operators (${state.results.length})`;

    if (isSingleCard) {
      el.resultsContainer.className = "results-stage is-single";
      el.resultsContainer.appendChild(
        createOperatorCard(state.results[0], { showTags: true, allowReroll: true, cardIndex: 0, animate: true })
      );
    } else {
      el.resultsContainer.className = "results-stage";
      const grid = document.createElement("div");
      grid.className = state.results.length <= 5 ? "roster-grid compact-center" : "roster-grid";
      state.results.forEach((op, idx) => {
        grid.appendChild(createOperatorCard(op, { showTags: true, allowReroll: true, cardIndex: idx, animate: true }));
      });
      el.resultsContainer.appendChild(grid);
    }
  }

  function renderHistory() {
    el.historySection.hidden = state.history.length === 0;
    el.historyList.innerHTML = "";
    for (const entry of state.history) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item";
      btn.title = `Restore roll: ${entry.map((o) => o.name).join(", ")}`;

      const thumbs = document.createElement("span");
      thumbs.className = "history-thumbs";
      for (const op of entry.slice(0, 4)) {
        const img = document.createElement("img");
        img.src = op.icon || "";
        img.alt = "";
        thumbs.appendChild(img);
      }

      const txt = document.createElement("span");
      if (entry.length === 1) {
        txt.textContent = entry[0].name;
      } else {
        txt.textContent = `${entry[0].name} + ${entry.length - 1} more`;
      }

      btn.append(thumbs, txt);
      btn.addEventListener("click", () => {
        state.results = entry.slice();
        el.resultsMeta.textContent = "Restored from roll history";
        renderResults(getMatchingPool());
      });
      el.historyList.appendChild(btn);
    }
  }

  function renderPoolBrowser(pool) {
    el.poolDrawer.hidden = !state.poolOpen;
    el.togglePoolBtn.setAttribute("aria-expanded", String(state.poolOpen));
    el.togglePoolBtn.textContent = state.poolOpen ? "Hide Pool" : "Browse Pool";
    if (!state.poolOpen) return;

    el.poolDrawerTitle.textContent = `All Matching Operators (${pool.length})`;
    el.poolGrid.innerHTML = "";

    if (pool.length === 0) {
      const msg = document.createElement("p");
      msg.className = "hint";
      msg.textContent = "No operators match the active filters.";
      el.poolGrid.appendChild(msg);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const op of pool) {
      frag.appendChild(createOperatorCard(op, { showTags: false, allowReroll: false, animate: false }));
    }
    el.poolGrid.appendChild(frag);
  }

  function updateUI() {
    const pool = getMatchingPool();
    const totalVisible = OPERATORS.filter((op) => state.includeFuture || !op.future).length;

    // Rarity pressed state
    for (const btn of el.rarityGroup.querySelectorAll(".rarity-chip")) {
      const r = Number(btn.dataset.rarity);
      btn.setAttribute("aria-pressed", String(state.stars.has(r)));
    }

    // Class pressed state
    for (const btn of el.classGroup.querySelectorAll(".roster-icon-chip")) {
      btn.setAttribute("aria-pressed", String(state.classes.has(btn.dataset.cls)));
    }

    // Tag counts & pressed state
    const nonTagPool = OPERATORS.filter(matchesNonTagFilters);
    for (const btn of el.tagsGroup.querySelectorAll(".tag-chip")) {
      const tag = btn.dataset.tag;
      const isSelected = state.tags.has(tag);
      btn.setAttribute("aria-pressed", String(isSelected));

      let count = 0;
      for (const op of nonTagPool) {
        if (!op.tags.includes(tag)) continue;
        if (state.tagMode === "all" && state.tags.size > 0 && !isSelected) {
          let ok = true;
          for (const activeTag of state.tags) {
            if (!op.tags.includes(activeTag)) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
        }
        count++;
      }
      btn.querySelector(".tag-count").textContent = String(count);
      btn.classList.toggle("is-zero", count === 0 && !isSelected);
      btn.title = `${tag} (${count} matching)`;
    }

    // Tag mode & tray controls
    for (const btn of el.tagModeGroup.querySelectorAll("button")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.tagMode === state.tagMode));
    }
    el.clearTagsBtn.hidden = state.tags.size === 0;
    el.tagsCountBadge.hidden = state.tags.size === 0;
    el.tagsCountBadge.textContent = String(state.tags.size);
    el.tagsTray.hidden = !state.tagsTrayOpen;
    el.toggleTagsBtn.setAttribute("aria-pressed", String(state.tagsTrayOpen));
    el.toggleTagsBtn.setAttribute("aria-expanded", String(state.tagsTrayOpen));

    // Search clear button
    el.clearSearchBtn.hidden = !state.search;

    // CN & No Repeats toggles
    el.showCnBtn.setAttribute("aria-pressed", String(state.includeFuture));
    el.noRepeatsBtn.setAttribute("aria-pressed", String(state.noRepeats));

    // Archetype options
    renderBranchOptions(pool);
    renderActiveChips();

    // Pool numbers & header readout
    el.poolCountNum.textContent = String(pool.length);
    el.navPoolCount.textContent = `${pool.length} / ${totalVisible}`;

    if (state.noRepeats) {
      const remaining = pool.filter((op) => !state.drawnNames.has(op.name)).length;
      el.poolSubHint.textContent = `${remaining} undrawn in current cycle`;
    } else {
      el.poolSubHint.textContent = state.includeFuture ? "Including CN-only operators" : "Global operators";
    }

    // Singular vs Multiple UI
    for (const btn of el.pickModeGroup.querySelectorAll("button")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.pickMode === state.pickMode));
    }
    el.multiCountWrap.hidden = state.pickMode !== "multi";
    el.countInput.value = String(state.pickCount);

    for (const btn of el.quickCounts.querySelectorAll("button")) {
      const val = btn.dataset.n;
      const isActive = (val === "all" && state.pickAll) || (!state.pickAll && Number(val) === state.pickCount);
      btn.classList.toggle("active", isActive);
    }

    const effectiveCount = state.pickMode === "single"
      ? Math.min(1, pool.length)
      : (state.pickAll ? pool.length : Math.min(state.pickCount, pool.length));

    el.drawBtn.disabled = pool.length === 0;
    if (pool.length === 0) {
      el.drawBtnLabel.textContent = "No Operators Match";
    } else if (state.pickMode === "single") {
      el.drawBtnLabel.textContent = "Pick 1 Operator";
    } else if (state.pickAll) {
      el.drawBtnLabel.textContent = `Draw All (${pool.length})`;
    } else {
      el.drawBtnLabel.textContent = effectiveCount === 1 ? "Draw 1 Operator" : `Draw ${effectiveCount} Operators`;
    }

    el.navDrawMode.textContent = state.pickMode === "single"
      ? "SINGLE · 1"
      : (state.pickAll ? `MULTI · ALL (${pool.length})` : `MULTI · ${state.pickCount}`);

    renderResults(pool);
    renderHistory();
    renderPoolBrowser(pool);
  }

  function performDraw() {
    const pool = getMatchingPool();
    if (pool.length === 0) {
      showToast("No operators match your current filters.");
      return;
    }

    const targetCount = state.pickMode === "single"
      ? 1
      : (state.pickAll ? pool.length : Math.max(1, Math.min(state.pickCount, pool.length)));

    let candidates = state.noRepeats
      ? pool.filter((op) => !state.drawnNames.has(op.name))
      : pool;

    let cycleReset = false;
    if (state.noRepeats && candidates.length === 0) {
      for (const op of pool) state.drawnNames.delete(op.name);
      candidates = pool;
      cycleReset = true;
    }

    let picked = shuffle(candidates).slice(0, targetCount);

    // If noRepeats had fewer remaining than targetCount, wrap around seamlessly for the remainder
    if (state.noRepeats && picked.length < targetCount && pool.length > picked.length) {
      const pickedSet = new Set(picked.map((o) => o.name));
      for (const op of pool) state.drawnNames.delete(op.name);
      const rest = shuffle(pool.filter((op) => !pickedSet.has(op.name))).slice(0, targetCount - picked.length);
      picked = picked.concat(rest);
      cycleReset = true;
    }

    if (state.noRepeats) {
      for (const op of picked) state.drawnNames.add(op.name);
    }

    state.results = picked;
    state.history.unshift(picked.slice());
    if (state.history.length > 8) state.history.length = 8;

    const requested = state.pickMode === "single" ? 1 : (state.pickAll ? pool.length : state.pickCount);
    if (cycleReset) {
      el.resultsMeta.textContent = `Cycle reshuffled · ${picked.length} drawn from ${pool.length} matching`;
    } else if (state.pickMode === "multi" && !state.pickAll && requested > pool.length) {
      el.resultsMeta.textContent = `Only ${pool.length} matched — drew all ${picked.length}`;
    } else {
      el.resultsMeta.textContent = `Drawn from ${pool.length} matching operator${pool.length === 1 ? "" : "s"}`;
    }

    updateUI();
  }

  function rerollSingleSlot(index) {
    if (index < 0 || index >= state.results.length) return;
    const pool = getMatchingPool();
    if (pool.length <= 1) {
      showToast("No other matching operators available to swap.");
      return;
    }

    const onScreen = new Set(state.results.map((o) => o.name));
    let candidates = pool.filter((op) => !onScreen.has(op.name));
    if (state.noRepeats) {
      const fresh = candidates.filter((op) => !state.drawnNames.has(op.name));
      if (fresh.length > 0) candidates = fresh;
    }

    if (candidates.length === 0) {
      showToast("All matching operators are already shown.");
      return;
    }

    const replacement = candidates[Math.floor(Math.random() * candidates.length)];
    if (state.noRepeats) state.drawnNames.add(replacement.name);
    state.results[index] = replacement;
    el.resultsMeta.textContent = `Swapped slot ${index + 1} · ${pool.length} matching`;
    updateUI();
  }

  // Operator Detail Modal
  function openModal(op) {
    modalOp = op;
    el.modalFaction.textContent = op.faction ? op.faction.toUpperCase() : "RHODES ISLAND";
    el.modalOpName.textContent = op.name;
    el.modalArkpediaLink.href = op.url;

    // Meta row
    el.modalMeta.innerHTML = "";
    const rar = document.createElement("span");
    rar.className = `rarity rarity-${op.rarity}`;
    rar.textContent = `${op.rarity}★`;
    el.modalMeta.appendChild(rar);

    el.modalMeta.appendChild(createMaskIcon(classIconUrl(op.class), 16, op.class));
    const clsSpan = document.createElement("span");
    clsSpan.textContent = op.class;
    el.modalMeta.appendChild(clsSpan);

    if (op.branch) {
      el.modalMeta.appendChild(createMaskIcon(branchIconUrl(op.branch), 16, op.branch));
      const brSpan = document.createElement("span");
      brSpan.textContent = op.branch;
      el.modalMeta.appendChild(brSpan);
    }

    if (op.position) {
      const posSpan = document.createElement("span");
      posSpan.style.color = "var(--text-dim)";
      posSpan.textContent = `· ${op.position}`;
      el.modalMeta.appendChild(posSpan);
    }

    if (op.future) {
      const cnSpan = document.createElement("span");
      cnSpan.style.color = "var(--amber)";
      cnSpan.textContent = "· CN Preview";
      el.modalMeta.appendChild(cnSpan);
    }

    // Tags
    el.modalTags.innerHTML = "";
    for (const tag of op.tags) {
      const pill = document.createElement("span");
      pill.className = state.tags.has(tag) ? "card-tag is-matched" : "card-tag";
      pill.textContent = tag;
      el.modalTags.appendChild(pill);
    }

    // Artwork tab setup
    const hasArt = Boolean(op.art);
    el.artTabE2.hidden = !hasArt;
    el.artTabE2.textContent = op.artLabel ? `${op.artLabel} Art` : "Full Artwork";
    setModalArtMode(hasArt ? "art" : "icon");

    el.opModal.showModal();
  }

  function setModalArtMode(mode) {
    if (!modalOp) return;
    const showFull = mode === "art" && Boolean(modalOp.art);
    el.artTabE2.setAttribute("aria-pressed", String(showFull));
    el.artTabIcon.setAttribute("aria-pressed", String(!showFull));
    el.modalArtImg.src = showFull ? modalOp.art : (modalOp.icon || "");
    el.modalArtImg.alt = `${modalOp.name} ${showFull ? (modalOp.artLabel || "Artwork") : "Icon"}`;
  }

  // Event Wiring
  function bindEvents() {
    // Theme toggle
    const savedTheme = localStorage.getItem("arkpedia-selector-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
    el.themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("arkpedia-selector-theme", next);
    });

    // Search
    el.nameSearch.addEventListener("input", () => {
      state.search = el.nameSearch.value.trim();
      updateUI();
    });
    el.clearSearchBtn.addEventListener("click", () => {
      state.search = "";
      el.nameSearch.value = "";
      el.nameSearch.focus();
      updateUI();
    });

    // Archetype dropdown
    el.branchTrigger.addEventListener("click", () => {
      const open = el.branchMenu.hidden;
      el.branchMenu.hidden = !open;
      el.branchTrigger.setAttribute("aria-expanded", String(open));
      if (open) {
        el.branchSearch.focus();
      }
    });
    el.branchSearch.addEventListener("input", () => {
      state.branchFilterText = el.branchSearch.value;
      renderBranchOptions(getMatchingPool());
    });
    el.clearBranchesBtn.addEventListener("click", () => {
      state.branches.clear();
      state.branchFilterText = "";
      el.branchSearch.value = "";
      updateUI();
    });
    document.addEventListener("click", (e) => {
      if (!el.branchMenu.hidden && !el.branchSelectRoot.contains(e.target)) {
        el.branchMenu.hidden = true;
        el.branchTrigger.setAttribute("aria-expanded", "false");
      }
    });

    // Tags tray toggle & mode
    el.toggleTagsBtn.addEventListener("click", () => {
      state.tagsTrayOpen = !state.tagsTrayOpen;
      updateUI();
    });
    for (const btn of el.tagModeGroup.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.tagMode = btn.dataset.tagMode;
        updateUI();
      });
    }
    el.clearTagsBtn.addEventListener("click", () => {
      state.tags.clear();
      updateUI();
    });

    // CN & No Repeats & Reset
    el.showCnBtn.addEventListener("click", () => {
      state.includeFuture = !state.includeFuture;
      updateUI();
    });
    el.noRepeatsBtn.addEventListener("click", () => {
      state.noRepeats = !state.noRepeats;
      if (!state.noRepeats) state.drawnNames.clear();
      updateUI();
    });
    el.resetBtn.addEventListener("click", () => {
      state.search = "";
      el.nameSearch.value = "";
      state.stars.clear();
      state.classes.clear();
      state.branches.clear();
      state.branchFilterText = "";
      el.branchSearch.value = "";
      state.tags.clear();
      state.drawnNames.clear();
      updateUI();
      showToast("Filters reset");
    });

    // Singular vs Multiple
    for (const btn of el.pickModeGroup.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        state.pickMode = btn.dataset.pickMode;
        updateUI();
      });
    }
    el.countDownBtn.addEventListener("click", () => {
      state.pickAll = false;
      state.pickCount = Math.max(1, state.pickCount - 1);
      updateUI();
    });
    el.countUpBtn.addEventListener("click", () => {
      state.pickAll = false;
      state.pickCount = Math.min(OPERATORS.length, state.pickCount + 1);
      updateUI();
    });
    el.countInput.addEventListener("change", () => {
      state.pickAll = false;
      const n = parseInt(el.countInput.value, 10);
      state.pickCount = Number.isFinite(n) ? Math.max(1, Math.min(OPERATORS.length, n)) : 1;
      updateUI();
    });
    for (const btn of el.quickCounts.querySelectorAll("button")) {
      btn.addEventListener("click", () => {
        if (btn.dataset.n === "all") {
          state.pickAll = true;
        } else {
          state.pickAll = false;
          state.pickCount = Number(btn.dataset.n);
        }
        updateUI();
      });
    }

    // Draw & Results actions
    el.drawBtn.addEventListener("click", performDraw);
    el.rerollAllBtn.addEventListener("click", performDraw);
    el.clearResultsBtn.addEventListener("click", () => {
      state.results = [];
      updateUI();
    });
    el.copyNamesBtn.addEventListener("click", async () => {
      if (state.results.length === 0) return;
      const text = state.results.map((o) => o.name).join(", ");
      try {
        await navigator.clipboard.writeText(text);
        showToast(`Copied ${state.results.length} name${state.results.length === 1 ? "" : "s"}`);
      } catch {
        showToast(text);
      }
    });

    // History & Pool Browser
    el.clearHistoryBtn.addEventListener("click", () => {
      state.history = [];
      updateUI();
    });
    el.togglePoolBtn.addEventListener("click", () => {
      state.poolOpen = !state.poolOpen;
      updateUI();
      if (state.poolOpen) {
        el.poolDrawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    el.closePoolBtn.addEventListener("click", () => {
      state.poolOpen = false;
      updateUI();
    });

    // Modal events
    el.modalCloseBtn.addEventListener("click", () => el.opModal.close());
    el.modalCloseAction.addEventListener("click", () => el.opModal.close());
    el.opModal.addEventListener("click", (e) => {
      if (e.target === el.opModal) el.opModal.close();
    });
    el.artTabE2.addEventListener("click", () => setModalArtMode("art"));
    el.artTabIcon.addEventListener("click", () => setModalArtMode("icon"));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.branchMenu.hidden) {
        el.branchMenu.hidden = true;
        el.branchTrigger.setAttribute("aria-expanded", "false");
        return;
      }
      if (el.opModal.open) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        performDraw();
      }
    });
  }

  buildFilterControls();
  bindEvents();
  updateUI();
})();
