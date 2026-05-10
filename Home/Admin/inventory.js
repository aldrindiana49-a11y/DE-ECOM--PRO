/* ===============================
   INVENTORY MODULE - PRODUCT SYSTEM
   Handles:
   - Product creation, edit, delete
   - Variants (single & multi SKU)
   - Image upload & preview
   - Form validation
   - Inventory table rendering
   - LocalStorage (drinProducts)

   NOTE:
   - Used by generator.js (depends on products[])
   - Uses utils.js (safeText, safeNumber, etc.)
================================ */

let singleVariantImageData = "";
let products = [];

function saveProducts() {
  // Supabase only - localStorage disabled
}

function generateVariantId() {
  return `var-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createEmptyVariant() {
  return {
    id: generateVariantId(),
    label: "",
    price: 0,
    discountPrice: 0,
    stock: 0,
    sku: "",
    weight: 0,
    length: 0,
    width: 0,
    height: 0,
    image: "",
  };
}

function normalizeVariant(variant, index = 0) {
  return {
    id: safeText(variant?.id, `var-${Date.now()}-${index + 1}`),
    label: safeText(variant?.label, ""),
    price: safeNumber(variant?.price, 0),
    discountPrice: safeNumber(variant?.discountPrice, 0),
    stock: safeNumber(variant?.stock, 0),
    sku: safeText(variant?.sku, ""),
    weight: safeNumber(variant?.weight, 0),
    length: safeNumber(variant?.length, 0),
    width: safeNumber(variant?.width, 0),
    height: safeNumber(variant?.height, 0),
    image: safeText(variant?.image, ""),
  };
}

function normalizeProducts() {
  products = products.map((product, index) => ({
    id: safeText(product.id, `prod-${Date.now()}-${index + 1}`),
    name: safeText(product.name, "Unnamed Product"),
    category: safeText(product.category, "Uncategorized"),
    brand: safeText(product.brand, ""),
    productType: safeText(product.productType, "single"),
    variantTitle: safeText(product.variantTitle, ""),
    image: safeText(product.image, ""),
    description: safeText(product.description, ""),
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant, variantIndex) =>
        normalizeVariant(variant, variantIndex)
      )
      : [],
  }));
}

function showSection(sectionId) {
  contentSections.forEach((section) => section.classList.remove("active-section"));
  menuItems.forEach((item) => item.classList.remove("active"));

  const selectedSection = document.getElementById(sectionId);
  if (selectedSection) selectedSection.classList.add("active-section");

  const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  if (window.innerWidth <= 900 && sidebar) {
    sidebar.classList.remove("open");
  }
}

menuItems.forEach((item) => {
  item.addEventListener("click", function () {
    showSection(this.getAttribute("data-section"));
  });
});

actionButtons.forEach((button) => {
  button.addEventListener("click", function () {
    showSection(this.getAttribute("data-target"));
  });
});

if (toggleSidebarBtn) {
  toggleSidebarBtn.addEventListener("click", function () {
    sidebar.classList.toggle("open");
  });
}

function updateDashboard() {
  if (dashboardTotalProducts) {
    dashboardTotalProducts.textContent = products.length;
  }

  if (dashboardTotalStock) {
    const totalStock = products.reduce((sum, product) => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      return (
        sum +
        variants.reduce(
          (variantSum, variant) => variantSum + safeNumber(variant.stock, 0),
          0
        )
      );
    }, 0);

    dashboardTotalStock.textContent = totalStock;
  }

  if (dashboardTotalBanners) {
    dashboardTotalBanners.textContent = 0;
  }
}

function setImagePreview(src) {
  if (!productImagePreview || !imagePreviewPlaceholder) return;

  if (src) {
    productImagePreview.src = src;
    productImagePreview.style.display = "block";
    imagePreviewPlaceholder.style.display = "none";
  } else {
    productImagePreview.src = "";
    productImagePreview.style.display = "none";
    imagePreviewPlaceholder.style.display = "block";
  }
}

function setModeUI() {
  const mode = safeText(productTypeInput?.value, "single");

  if (mode === "single") {
    singleSkuSection.classList.remove("hidden-section");
    variantSection.classList.add("hidden-section");
  } else {
    singleSkuSection.classList.add("hidden-section");
    variantSection.classList.remove("hidden-section");
  }
}

if (productTypeInput) {
  productTypeInput.addEventListener("change", setModeUI);
}

if (productImageFile) {
  productImageFile.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) {
      setImagePreview(safeText(existingImageData?.value));
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid main product image file.", "error");
      this.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  });
}

if (singleVariantImageFile) {
  singleVariantImageFile.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid single SKU image file.", "error");
      this.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      singleVariantImageData = e.target.result;
      showToast("Single SKU image loaded.", "success");
    };
    reader.readAsDataURL(file);
  });
}

function getVariantRows() {
  if (!variantTableBody) return [];

  return Array.from(variantTableBody.querySelectorAll("tr[data-variant-id]")).map(
    (row) => ({
      id: safeText(row.dataset.variantId, generateVariantId()),
      label: safeText(row.querySelector('[data-field="label"]')?.value),
      price: safeNumber(row.querySelector('[data-field="price"]')?.value, 0),
      discountPrice: safeNumber(
        row.querySelector('[data-field="discountPrice"]')?.value,
        0
      ),
      stock: safeNumber(row.querySelector('[data-field="stock"]')?.value, 0),
      sku: safeText(row.querySelector('[data-field="sku"]')?.value),
      weight: safeNumber(row.querySelector('[data-field="weight"]')?.value, 0),
      length: safeNumber(row.querySelector('[data-field="length"]')?.value, 0),
      width: safeNumber(row.querySelector('[data-field="width"]')?.value, 0),
      height: safeNumber(row.querySelector('[data-field="height"]')?.value, 0),
      image: safeText(row.querySelector('[data-field="imageData"]')?.value),
    })
  );
}

function handleVariantFileChange(variantId, input) {
  const row = document.querySelector(`tr[data-variant-id="${variantId}"]`);
  if (!row) return;

  const hiddenImageInput = row.querySelector('[data-field="imageData"]');
  const fileNameText = row.querySelector('[data-role="variantFileName"]');
  const currentImage = safeText(hiddenImageInput?.value);
  const file = input?.files?.[0];

  if (!file) {
    if (fileNameText) {
      fileNameText.textContent = currentImage ? "Saved image" : "No file chosen";
    }
    return;
  }

  if (!file.type.startsWith("image/")) {
    showToast("Please select a valid variant image file.", "error");
    input.value = "";
    if (fileNameText) {
      fileNameText.textContent = currentImage ? "Saved image" : "No file chosen";
    }
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    if (hiddenImageInput) hiddenImageInput.value = e.target.result;
    if (fileNameText) fileNameText.textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function renderVariantTable(variants = []) {
  if (!variantTableBody) return;

  variantTableBody.innerHTML = "";

  if (!variants.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="11">
        <div class="variant-empty">No options yet. Click "Add Option".</div>
      </td>
    `;
    variantTableBody.appendChild(emptyRow);
    return;
  }

  variants.forEach((variant) => {
    const item = normalizeVariant(variant);
    const row = document.createElement("tr");
    row.dataset.variantId = item.id;

    row.innerHTML = `
      <td>
        <input
          type="text"
          data-field="label"
          maxlength="30"
          value="${escapeAttribute(item.label)}"
          placeholder="M1 - 2pcs / Yellow - 4pcs"
        />
      </td>
      <td><input type="number" data-field="price" min="0" step="0.01" value="${item.price}" /></td>
      <td><input type="number" data-field="discountPrice" min="0" step="0.01" value="${item.discountPrice || ""}" /></td>
      <td><input type="number" data-field="stock" min="0" value="${item.stock}" /></td>
      <td><input type="text" data-field="sku" maxlength="40" value="${escapeAttribute(item.sku)}" placeholder="SKU" /></td>
      <td><input type="number" data-field="weight" min="0" step="0.01" value="${item.weight || ""}" /></td>
      <td><input type="number" data-field="length" min="0" step="0.01" value="${item.length || ""}" /></td>
      <td><input type="number" data-field="width" min="0" step="0.01" value="${item.width || ""}" /></td>
      <td><input type="number" data-field="height" min="0" step="0.01" value="${item.height || ""}" /></td>
      <td>
        <input type="hidden" data-field="imageData" value="${escapeAttribute(item.image)}" />
        <input type="file" accept="image/*" onchange="handleVariantFileChange('${item.id}', this)" />
        <small data-role="variantFileName" class="helper-text">${item.image ? "Saved image" : "No file chosen"}</small>
      </td>
      <td><button type="button" class="variant-remove-btn" onclick="removeVariantRow('${item.id}')">Remove</button></td>
    `;

    variantTableBody.appendChild(row);
  });
}

function addVariantRow() {
  const variants = getVariantRows();
  variants.push(createEmptyVariant());
  renderVariantTable(variants);
}

function removeVariantRow(variantId) {
  const variants = getVariantRows().filter(
    (item) => String(item.id) !== String(variantId)
  );
  renderVariantTable(variants);
}

function buildSingleSkuVariant() {
  const fallbackImage =
    safeText(singleVariantImageData) ||
    safeText(existingImageData?.value) ||
    safeText(productImagePreview?.src);

  return normalizeVariant({
    id: generateVariantId(),
    label: "Default",
    price: safeNumber(singlePriceInput?.value, 0),
    discountPrice: safeNumber(singleDiscountPriceInput?.value, 0),
    stock: safeNumber(singleStockInput?.value, 0),
    sku: safeText(singleSkuInput?.value),
    weight: safeNumber(singleWeightInput?.value, 0),
    length: safeNumber(singleLengthInput?.value, 0),
    width: safeNumber(singleWidthInput?.value, 0),
    height: safeNumber(singleHeightInput?.value, 0),
    image: safeText(fallbackImage),
  });
}

function validateTitle(value) {
  const title = safeText(value);

  if (!title) {
    showToast("Please enter product title.", "error");
    return false;
  }

  if (title.length < 15) {
    showToast("Product title must be at least 15 characters.", "error");
    return false;
  }

  if (title.length > 100) {
    showToast("Product title must not exceed 100 characters.", "error");
    return false;
  }

  return true;
}

function validateBrand(value) {
  const brand = safeText(value);

  if (!brand) {
    showToast("Please enter brand.", "error");
    return false;
  }

  if (brand.length > 30) {
    showToast("Brand must not exceed 30 characters.", "error");
    return false;
  }

  return true;
}

function validateCategory(value) {
  const category = safeText(value);

  if (!category) {
    showToast("Please select a category.", "error");
    return false;
  }

  if (category.length > 30) {
    showToast("Category must not exceed 30 characters.", "error");
    return false;
  }

  return true;
}

function validateDescription(value) {
  const description = safeText(value);

  if (!description) {
    showToast("Please enter product description.", "error");
    return false;
  }

  if (description.length < 20) {
    showToast("Description must be at least 20 characters.", "error");
    return false;
  }

  if (description.length > 500) {
    showToast("Description must not exceed 500 characters.", "error");
    return false;
  }

  return true;
}

function validateSingleSku() {
  const originalPrice = safeNumber(singlePriceInput?.value, 0);
  const discountPrice = safeNumber(singleDiscountPriceInput?.value, 0);
  const stock = safeNumber(singleStockInput?.value, -1);
  const sku = safeText(singleSkuInput?.value);
  const weight = safeNumber(singleWeightInput?.value, 0);
  const length = safeNumber(singleLengthInput?.value, 0);
  const width = safeNumber(singleWidthInput?.value, 0);
  const height = safeNumber(singleHeightInput?.value, 0);

  if (originalPrice <= 0) {
    showToast("Single SKU must have a valid original price.", "error");
    return false;
  }

  if (discountPrice < 0) {
    showToast("Single SKU has an invalid discount price.", "error");
    return false;
  }

  if (discountPrice > 0 && discountPrice >= originalPrice) {
    showToast("Discount price must be lower than the original price.", "error");
    return false;
  }

  if (stock < 0) {
    showToast("Single SKU must have a valid stock value.", "error");
    return false;
  }

  if (!sku) {
    showToast("Single SKU must have an SKU.", "error");
    return false;
  }

  if (sku.length > 40) {
    showToast("SKU must not exceed 40 characters.", "error");
    return false;
  }

  if (weight <= 0) {
    showToast("Single SKU must have a valid weight.", "error");
    return false;
  }

  if (length <= 0 || width <= 0 || height <= 0) {
    showToast("Single SKU must have complete dimensions (L, W, H).", "error");
    return false;
  }

  return true;
}

function validateVariants(variants) {
  if (!variants.length) {
    showToast("Please add at least one option under your variant title.", "error");
    return false;
  }

  for (const variant of variants) {
    if (!safeText(variant.label)) {
      showToast("Each option must have a name. Example: M1 - 2pcs.", "error");
      return false;
    }

    if (safeText(variant.label).length > 30) {
      showToast(`Option "${variant.label}" is too long. Keep it within 30 characters.`, "error");
      return false;
    }

    if (safeNumber(variant.price, 0) <= 0) {
      showToast(`Option "${variant.label}" must have a valid original price.`, "error");
      return false;
    }

    if (safeNumber(variant.discountPrice, 0) < 0) {
      showToast(`Option "${variant.label}" has an invalid discount price.`, "error");
      return false;
    }

    if (
      safeNumber(variant.discountPrice, 0) > 0 &&
      safeNumber(variant.discountPrice, 0) >= safeNumber(variant.price, 0)
    ) {
      showToast(
        `Option "${variant.label}" has invalid pricing. Discount price must be lower than the original price.`,
        "error"
      );
      return false;
    }

    if (safeNumber(variant.stock, -1) < 0) {
      showToast(`Option "${variant.label}" has an invalid stock value.`, "error");
      return false;
    }

    if (!safeText(variant.sku)) {
      showToast(`Option "${variant.label}" must have an SKU.`, "error");
      return false;
    }

    if (safeText(variant.sku).length > 40) {
      showToast(`Option "${variant.label}" SKU must not exceed 40 characters.`, "error");
      return false;
    }

    if (safeNumber(variant.weight, 0) <= 0) {
      showToast(`Option "${variant.label}" must have a valid weight.`, "error");
      return false;
    }

    if (
      safeNumber(variant.length, 0) <= 0 ||
      safeNumber(variant.width, 0) <= 0 ||
      safeNumber(variant.height, 0) <= 0
    ) {
      showToast(`Option "${variant.label}" must have complete dimensions (L, W, H).`, "error");
      return false;
    }
  }

  return true;
}

function resetSingleSkuFields() {
  if (singlePriceInput) singlePriceInput.value = "";
  if (singleDiscountPriceInput) singleDiscountPriceInput.value = "";
  if (singleStockInput) singleStockInput.value = "";
  if (singleSkuInput) singleSkuInput.value = "";
  if (singleWeightInput) singleWeightInput.value = "";
  if (singleLengthInput) singleLengthInput.value = "";
  if (singleWidthInput) singleWidthInput.value = "";
  if (singleHeightInput) singleHeightInput.value = "";
  if (singleVariantImageFile) singleVariantImageFile.value = "";
  singleVariantImageData = "";
}

function resetProductForm() {
  if (!productForm) return;

  productForm.reset();
  if (productId) productId.value = "";
  if (existingImageData) existingImageData.value = "";
  if (submitBtn) submitBtn.textContent = "Save Product";
  setImagePreview("");
  renderVariantTable([]);
  resetSingleSkuFields();

  if (productTypeInput) productTypeInput.value = "single";
  if (variantTitleInput) variantTitleInput.value = "";

  setModeUI();
}

function validateProductBase(data) {
  if (!validateTitle(data.name)) return false;
  if (!validateCategory(data.category)) return false;
  if (!validateBrand(data.brand)) return false;
  if (!safeText(data.image)) {
    showToast("Please upload a main product photo.", "error");
    return false;
  }
  if (!validateDescription(data.description)) return false;
  return true;
}

function renderInventory(filter = "") {
  if (!inventoryTableBody) return;

  inventoryTableBody.innerHTML = "";
  const searchValue = safeText(filter).toLowerCase();

  const filteredProducts = products.filter((product) => {
    const name = safeText(product.name).toLowerCase();
    const category = safeText(product.category).toLowerCase();
    const description = safeText(product.description).toLowerCase();
    const variantTitle = safeText(product.variantTitle).toLowerCase();
    const productType = safeText(product.productType).toLowerCase();
    const brand = safeText(product.brand).toLowerCase();

    const variantMatch = Array.isArray(product.variants)
      ? product.variants.some((variant) =>
        safeText(variant.label).toLowerCase().includes(searchValue)
      )
      : false;

    return (
      name.includes(searchValue) ||
      category.includes(searchValue) ||
      description.includes(searchValue) ||
      variantTitle.includes(searchValue) ||
      productType.includes(searchValue) ||
      brand.includes(searchValue) ||
      variantMatch
    );
  });

  if (!filteredProducts.length) {
    inventoryTableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-box">No products found.</div>
        </td>
      </tr>
    `;
    return;
  }

  filteredProducts
    .slice()
    .reverse()
    .forEach((product) => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const totalStock = variants.reduce(
        (sum, item) => sum + safeNumber(item.stock, 0),
        0
      );
      const variantTitleText = safeText(
        product.variantTitle,
        product.productType === "single" ? "Single SKU" : "Variant"
      );

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <img
            src="${escapeAttribute(
        safeText(product.image, "https://via.placeholder.com/100x100?text=No+Image")
      )}"
            alt="${escapeHtml(safeText(product.name))}"
            class="table-image"
            onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'"
          />
        </td>
        <td>${escapeHtml(safeText(product.name, "Unnamed Product"))}</td>
        <td>${escapeHtml(safeText(product.category, "Uncategorized"))}</td>
        <td>${product.productType === "single" ? "Single SKU" : "With Variant"}</td>
        <td>${escapeHtml(variantTitleText)}</td>
        <td>
          <div class="variant-preview-list">
            ${variants
          .map(
            (variant) =>
              `<span class="variant-chip" title="${escapeAttribute(
                safeText(variant.label, "Option")
              )}">${escapeHtml(safeText(variant.label, "Option"))}</span>`
          )
          .join("")}
          </div>
        </td>
        <td>${totalStock}</td>
        <td>${escapeHtml(safeText(product.description, "No description"))}</td>
        <td>
          <div class="action-buttons">
            <button class="small-btn" onclick="editProduct('${product.id}')">Edit</button>
            <button class="danger-btn" onclick="deleteProduct('${product.id}')">Delete</button>
          </div>
        </td>
      `;
      inventoryTableBody.appendChild(row);
    });
}

if (productForm) {
  productForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    try {
      let finalImage = safeText(existingImageData?.value);
      const uploadedFile = productImageFile?.files?.[0];

      if (uploadedFile) {
        finalImage = await fileToBase64(uploadedFile);
      }

      const currentMode = safeText(productTypeInput?.value, "single");

      const variants = currentMode === "single"
        ? [buildSingleSkuVariant()]
        : getVariantRows().map((variant, index) =>
          normalizeVariant(variant, index)
        );

      const firstVariant = variants[0] || {};

      const productData = {
        title: safeText(nameInput?.value),
        price: safeNumber(firstVariant.price, 0),
        category: safeText(categoryInput?.value),
        description: safeText(descriptionInput?.value),
        stock: safeNumber(firstVariant.stock, 0),
        image: safeText(finalImage),
        variations: variants,
        weight: safeNumber(firstVariant.weight, 0),
        length: safeNumber(firstVariant.length, 0),
        width: safeNumber(firstVariant.width, 0),
        height: safeNumber(firstVariant.height, 0)
      };

      if (!productData.title) {
        showToast("Please enter product title.", "error");
        return;
      }

      if (!productData.category) {
        showToast("Please select category.", "error");
        return;
      }

      if (!productData.description) {
        showToast("Please enter description.", "error");
        return;
      }

      if (productData.price <= 0) {
        showToast("Please enter valid price.", "error");
        return;
      }

      const { error } = await supabaseClient
        .from("products")
        .insert([productData]);

      if (error) {
        console.error(error);
        showToast(error.message || "Supabase save failed.", "error");
        return;
      }

      showToast("Product saved online successfully.", "success");

      resetProductForm();
      showSection("inventorySection");

    } catch (error) {
      console.error(error);
      showToast("Failed to save product online.", "error");
    }
  });
}

function editProduct(id) {
  const product = products.find((item) => String(item.id) === String(id));
  if (!product) return;

  if (productId) productId.value = safeText(product.id);
  if (existingImageData) existingImageData.value = safeText(product.image);
  if (nameInput) nameInput.value = safeText(product.name);
  if (categoryInput) categoryInput.value = safeText(product.category);
  if (brandInput) brandInput.value = safeText(product.brand);
  if (descriptionInput) descriptionInput.value = safeText(product.description);
  if (productTypeInput) productTypeInput.value = safeText(product.productType, "single");

  setModeUI();

  if (safeText(product.productType, "single") === "single") {
    const single =
      Array.isArray(product.variants) && product.variants.length
        ? normalizeVariant(product.variants[0])
        : createEmptyVariant();

    if (singlePriceInput) singlePriceInput.value = single.price || "";
    if (singleDiscountPriceInput) {
      singleDiscountPriceInput.value = single.discountPrice || "";
    }
    if (singleStockInput) singleStockInput.value = single.stock || "";
    if (singleSkuInput) singleSkuInput.value = safeText(single.sku);
    if (singleWeightInput) singleWeightInput.value = single.weight || "";
    if (singleLengthInput) singleLengthInput.value = single.length || "";
    if (singleWidthInput) singleWidthInput.value = single.width || "";
    if (singleHeightInput) singleHeightInput.value = single.height || "";
    singleVariantImageData = safeText(single.image);
    renderVariantTable([]);
    if (variantTitleInput) variantTitleInput.value = "";
  } else {
    if (variantTitleInput) variantTitleInput.value = safeText(product.variantTitle);
    renderVariantTable(Array.isArray(product.variants) ? product.variants : []);
    resetSingleSkuFields();
  }

  if (submitBtn) submitBtn.textContent = "Update Product";
  setImagePreview(safeText(product.image));
  showSection("addListingSection");
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("Loaded product for editing.", "success");
}

async function deleteProduct(id) {
  const selected = products.find((item) => String(item.id) === String(id));
  if (!selected) return;

  const confirmed = confirm(`Delete "${safeText(selected.name, "this product")}"?`);
  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    showToast("Failed to delete product online.", "error");
    return;
  }

  products = products.filter((item) => String(item.id) !== String(id));
  renderInventory(searchInput?.value);
  updateDashboard();
  showToast("Product deleted online.", "success");
}

if (resetBtn) {
  resetBtn.addEventListener("click", function () {
    resetProductForm();
    showToast("Form cleared.", "success");
  });
}

if (searchInput) {
  searchInput.addEventListener("input", function () {
    renderInventory(this.value);
  });
}

if (addVariantBtn) {
  addVariantBtn.addEventListener("click", function () {
    addVariantRow();
    showToast("New option row added.", "success");
  });
}

async function loadAdminProductsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    showToast("Failed to load products from Supabase.", "error");
    return;
  }

  products = (data || []).map((item) => ({
    id: item.id,
    name: item.title,
    brand: item.brand || "",
    category: item.category,
    productType: item.variations && item.variations.length > 1 ? "variant" : "single",
    variantTitle: "Options",
    image: item.image,
    description: item.description,
    variants: item.variations || []
  }));

  renderInventory();
  updateDashboard();
}

loadAdminProductsFromSupabase();
setImagePreview("");
renderVariantTable([]);
setModeUI();

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.removeVariantRow = removeVariantRow;
window.handleVariantFileChange = handleVariantFileChange;

/* ===============================
   END INVENTORY MODULE
================================ */