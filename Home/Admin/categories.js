/* ===============================
   CATEGORY SYSTEM - ADD + DELETE UI PANEL
   No alert/prompt for add/delete UI.
   Default categories are protected.
   Products and uploaded images are not deleted.
================================ */

(function () {
  const dropdown = document.getElementById("category");
  if (!dropdown) return;

  const ADD_NEW = "__add_new_category__";
  const DELETE = "__delete_category__";

  const defaultCategories = [
    "Power Amplifier",
    "Speaker & Tweeter",
    "Audio Processor",
    "Transistor / MOSFET",
    "Capacitor",
    "Diode",
    "Resistor",
    "Integrated Circuits (IC)",
    "PCB / Boards",
    "Connectors & Terminals",
    "Wires & Cables",
    "Relay",
    "Others"
  ];

  function clean(value) {
    return String(value || "").trim();
  }

  function key(value) {
    return clean(value).toLowerCase();
  }

  function makeSlug(name) {
    return clean(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function isDefaultCategory(name) {
    return defaultCategories.some((item) => key(item) === key(name));
  }

  function getSavedCategories() {
    try {
      const saved = JSON.parse(localStorage.getItem("drinCategories") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function saveCategories(categories) {
    localStorage.setItem("drinCategories", JSON.stringify(categories));
  }

  function getRealOptions() {
    return Array.from(dropdown.options).filter((option) => {
      return option.value && option.value !== ADD_NEW && option.value !== DELETE;
    });
  }

  function optionExists(name) {
    return getRealOptions().some((option) => key(option.value) === key(name));
  }

  function addOptionToDropdown(name) {
    const finalName = clean(name);
    if (!finalName || optionExists(finalName)) return;

    const option = document.createElement("option");
    option.value = finalName;
    option.textContent = finalName;

    const addOption = Array.from(dropdown.options).find((item) => item.value === ADD_NEW);
    const deleteOption = Array.from(dropdown.options).find((item) => item.value === DELETE);

    if (addOption) {
      dropdown.insertBefore(option, addOption);
    } else if (deleteOption) {
      dropdown.insertBefore(option, deleteOption);
    } else {
      dropdown.appendChild(option);
    }
  }

  function ensureControlOptions() {
    const hasAdd = Array.from(dropdown.options).some((option) => option.value === ADD_NEW);
    const hasDelete = Array.from(dropdown.options).some((option) => option.value === DELETE);

    if (!hasAdd) {
      const option = document.createElement("option");
      option.value = ADD_NEW;
      option.textContent = "+ Add New Category";
      dropdown.appendChild(option);
    }

    if (!hasDelete) {
      const option = document.createElement("option");
      option.value = DELETE;
      option.textContent = "− Delete Category";
      dropdown.appendChild(option);
    }
  }

  function syncDropdownDefaultsToStorage() {
    const saved = getSavedCategories();
    const existingKeys = saved.map((category) => key(category.name));

    getRealOptions().forEach((option) => {
      const name = clean(option.value);
      if (!name || existingKeys.includes(key(name))) return;

      saved.push({
        id: "cat-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        name,
        slug: makeSlug(name),
        status: "active",
        isDefault: isDefaultCategory(name),
        createdAt: new Date().toISOString()
      });

      existingKeys.push(key(name));
    });

    saveCategories(saved);
  }

  function loadSavedCategoriesToDropdown() {
    getSavedCategories().forEach((category) => {
      if (category.name) addOptionToDropdown(category.name);
    });
  }

  function createPanel() {
    let panel = document.getElementById("categoryActionPanel");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "categoryActionPanel";
    panel.style.display = "none";
    panel.style.marginTop = "10px";
    panel.style.padding = "14px";
    panel.style.border = "1px solid #e5e7eb";
    panel.style.borderRadius = "12px";
    panel.style.background = "#ffffff";
    panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)";

    dropdown.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function closePanel() {
    const panel = document.getElementById("categoryActionPanel");
    if (panel) {
      panel.style.display = "none";
      panel.innerHTML = "";
    }
    dropdown.value = "";
  }

  function showAddPanel() {
    const panel = createPanel();
    panel.style.display = "block";
    panel.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <strong>Add New Category</strong>
        <input
          type="text"
          id="newCategoryNameInput"
          placeholder="Example: CCTV"
          maxlength="30"
          style="width:100%; padding:11px 12px; border:1px solid #d1d5db; border-radius:10px; outline:none;"
        />
        <small style="color:#6b7280;">Maximum 30 characters. This will be saved to your category dropdown.</small>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" id="saveNewCategoryBtn" class="primary-btn">Save Category</button>
          <button type="button" id="cancelCategoryActionBtn" class="secondary-btn">Cancel</button>
        </div>
      </div>
    `;

    const input = document.getElementById("newCategoryNameInput");
    const saveBtn = document.getElementById("saveNewCategoryBtn");
    const cancelBtn = document.getElementById("cancelCategoryActionBtn");

    setTimeout(() => input?.focus(), 50);

    function saveNewCategory() {
      const name = clean(input?.value);

      if (!name) {
        showToast("Please enter category name.", "error");
        return;
      }

      if (name.length > 30) {
        showToast("Category must not exceed 30 characters.", "error");
        return;
      }

      if (optionExists(name)) {
        showToast("Category already exists.", "error");
        dropdown.value = name;
        closePanel();
        return;
      }

      const saved = getSavedCategories();
      saved.push({
        id: "cat-" + Date.now(),
        name,
        slug: makeSlug(name),
        status: "active",
        isDefault: false,
        createdAt: new Date().toISOString()
      });

      saveCategories(saved);
      addOptionToDropdown(name);
      dropdown.value = name;

      panel.style.transition = "0.2s ease";
      panel.style.transform = "scale(0.98)";
      panel.style.opacity = "0";

      setTimeout(() => {
        closePanel();
        showToast(`Category "${name}" added.`, "success");
      }, 180);
    }

    saveBtn?.addEventListener("click", saveNewCategory);
    input?.addEventListener("keydown", function (e) {
      if (e.key === "Enter") saveNewCategory();
    });
    cancelBtn?.addEventListener("click", closePanel);
  }

  function showDeletePanel() {
    const customOptions = getRealOptions().filter((option) => !isDefaultCategory(option.value));
    const panel = createPanel();
    panel.style.display = "block";

    if (!customOptions.length) {
      panel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
          <strong>Delete Category</strong>
          <p style="margin:0; color:#6b7280;">No custom categories to delete. Default categories are protected.</p>
          <button type="button" id="cancelCategoryActionBtn" class="secondary-btn">Close</button>
        </div>
      `;
      document.getElementById("cancelCategoryActionBtn")?.addEventListener("click", closePanel);
      return;
    }

    panel.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px;">
        <strong>Delete Category</strong>
        <p style="margin:0; color:#dc2626; font-weight:700;">Warning: deleted category cannot be restored.</p>
        <select id="categoryDeleteSelect" style="width:100%; padding:11px 12px; border:1px solid #d1d5db; border-radius:10px; outline:none;">
          <option value="">Select category to delete</option>
          ${customOptions.map((option) => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.value)}</option>`).join("")}
        </select>
        <small style="color:#6b7280;">Products will not be deleted. Only the category option will be removed.</small>
        <div id="deleteConfirmBox" style="display:none; padding:10px; border-radius:10px; background:#fef2f2; color:#991b1b; font-weight:700;"></div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" id="confirmDeleteCategoryBtn" class="danger-btn">Delete Permanently</button>
          <button type="button" id="cancelCategoryActionBtn" class="secondary-btn">Cancel</button>
        </div>
      </div>
    `;

    const deleteSelect = document.getElementById("categoryDeleteSelect");
    const confirmBox = document.getElementById("deleteConfirmBox");
    const confirmBtn = document.getElementById("confirmDeleteCategoryBtn");
    const cancelBtn = document.getElementById("cancelCategoryActionBtn");

    deleteSelect?.addEventListener("change", function () {
      if (!deleteSelect.value) {
        confirmBox.style.display = "none";
        confirmBox.textContent = "";
        return;
      }

      confirmBox.style.display = "block";
      confirmBox.textContent = `You are about to permanently delete "${deleteSelect.value}".`;
    });

    confirmBtn?.addEventListener("click", function () {
      const selectedName = clean(deleteSelect?.value);

      if (!selectedName) {
        showToast("Select category to delete first.", "error");
        return;
      }

      if (isDefaultCategory(selectedName)) {
        showToast("Default category cannot be deleted.", "error");
        return;
      }

      let saved = getSavedCategories();
      saved = saved.filter((category) => key(category.name) !== key(selectedName));
      saveCategories(saved);

      const targetOption = Array.from(dropdown.options).find((option) => key(option.value) === key(selectedName));
      if (targetOption) targetOption.remove();

      panel.style.transition = "0.2s ease";
      panel.style.transform = "translateY(-4px)";
      panel.style.opacity = "0";

      setTimeout(() => {
        closePanel();
        showToast(`Category "${selectedName}" deleted permanently.`, "success");
      }, 180);
    });

    cancelBtn?.addEventListener("click", closePanel);
  }

  ensureControlOptions();
  syncDropdownDefaultsToStorage();
  loadSavedCategoriesToDropdown();

  dropdown.addEventListener("change", function () {
    if (dropdown.value === ADD_NEW) {
      showAddPanel();
      return;
    }

    if (dropdown.value === DELETE) {
      showDeletePanel();
    }
  });
})();

