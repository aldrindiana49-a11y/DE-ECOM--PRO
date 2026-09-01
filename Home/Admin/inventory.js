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
let singleVariantImageChanged = false;
let products = [];
let inventoryProductSaving = false;
let inventoryCurrentPage = 1;
const inventoryItemsPerPage = 10;
let productGalleryData = [];
let selectedCoverIndex = 0;
let productGalleryFiles = [];

let productGalleryFileKeys = new Set();

function getFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

const inventoryPrevBtn =
  document.getElementById("inventoryPrevBtn");

const inventoryNextBtn =
  document.getElementById("inventoryNextBtn");

const inventoryPageInfo =
  document.getElementById("inventoryPageInfo");

function renderInventoryPageNumbers(totalItems, filter = "") {
  if (!inventoryPageInfo) return;

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / inventoryItemsPerPage)
  );

  if (inventoryCurrentPage > totalPages) {
    inventoryCurrentPage = totalPages;
  }

  let startPage = Math.max(
    1,
    inventoryCurrentPage - 2
  );

  let endPage = Math.min(
    totalPages,
    startPage + 4
  );

  startPage = Math.max(
    1,
    endPage - 4
  );

  inventoryPageInfo.innerHTML = "";

  for (let page = startPage; page <= endPage; page++) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "inventory-page-btn";
    button.textContent = String(page);

    if (page === inventoryCurrentPage) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    button.addEventListener("click", () => {
      inventoryCurrentPage = page;
      renderInventory(filter);
    });

    inventoryPageInfo.appendChild(button);
  }

  if (inventoryPrevBtn) {
    inventoryPrevBtn.disabled =
      inventoryCurrentPage <= 1;
  }

  if (inventoryNextBtn) {
    inventoryNextBtn.disabled =
      inventoryCurrentPage >= totalPages;
  }
}

if (inventoryPrevBtn) {
  inventoryPrevBtn.addEventListener("click", () => {

    if (inventoryCurrentPage > 1) {
      inventoryCurrentPage--;

      renderInventory(searchInput?.value || "");
    }

  });
}

if (inventoryNextBtn) {
  inventoryNextBtn.addEventListener("click", () => {

    const totalPages = Math.ceil(
      products.length / inventoryItemsPerPage
    );

    if (inventoryCurrentPage < totalPages) {
      inventoryCurrentPage++;
      renderInventory(searchInput?.value || "");
    }

  });
}

async function uploadImageToSupabase(file, folder = "products") {

  if (!file) return "";

  const fileExt = file.name.split(".").pop();

  const fileName =
    `${folder}-${Date.now()}-${Math.floor(Math.random() * 100000)}.${fileExt}`;

  const filePath =
    `${folder}/${fileName}`;

  const { error } =
    await supabaseClient.storage
      .from("product-images")
      .upload(filePath, file);

  if (error) {

    console.error(error);

    showToast("Image upload failed.", "error");

    return "";
  }

  const { data } =
    supabaseClient.storage
      .from("product-images")
      .getPublicUrl(filePath);

  return data.publicUrl;
}

function generateVariantId() {
  return `var-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function inventorySupplierPrice(value) {
  if (value == null || String(value).trim() === "") return null;

  const amount = Number(value);

  return Number.isFinite(amount) && amount >= 0
    ? amount
    : null;
}

function inventoryPeso(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);
}

function inventoryGrossProfit(variant) {
  const cost = inventorySupplierPrice(variant.supplierPrice);
  const price = Number(variant.price);
  const discount = Number(variant.discountPrice || 0);

  if (
    cost === null ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isFinite(discount) ||
    discount < 0 ||
    (discount > 0 && discount >= price)
  ) {
    return null;
  }

  const sellingPrice = discount > 0 ? discount : price;
  const unit = Math.round((sellingPrice - cost) * 100) / 100;
  const stock = Math.max(0, safeNumber(variant.stock, 0));

  return {
    unit,
    total: Math.round(unit * stock * 100) / 100
  };
}

function inventoryProfitPreview(variant) {
  const profit = inventoryGrossProfit(variant);

  if (!profit) return "Set supplier price and valid selling price.";

  return `Gross profit/item: ${inventoryPeso(profit.unit)}
    | Potential stock profit: ${inventoryPeso(profit.total)}`;
}

function createEmptyVariant() {
  return {
    id: generateVariantId(),
    label: "",
    price: 0,
    discountPrice: 0,
    supplierPrice: null,
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
    supplierPrice: inventorySupplierPrice(variant?.supplierPrice),
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

function renderProductGallery() {
  const galleryContainer =
    document.getElementById("productGalleryPreview");

  if (!galleryContainer) return;

  galleryContainer.innerHTML = "";

  for (let index = 0; index < 5; index++) {
    const image = productGalleryData[index] || "";

    const card = document.createElement("div");

    card.className = image
      ? "product-photo-card"
      : "product-photo-slot";

    if (image) {
      card.innerHTML = `
        <div class="photo-card-image-wrap">

          <span class="slot-number">
            ${index + 1}
          </span>

          <img
            src="${escapeAttribute(image)}"
            alt="Product photo ${index + 1}"
          />

          ${index === selectedCoverIndex
          ? `<span class="cover-badge">Cover</span>`
          : ""
        }

        </div>

        <div class="photo-card-actions">

          ${index !== selectedCoverIndex
          ? `
                <button
                  type="button"
                  class="set-cover-btn"
                  onclick="setProductCover(${index})"
                >
                  Set as Cover
                </button>
              `
          : `
                <span class="current-cover-text">
                  Main Photo
                </span>
              `
        }

          <button
            type="button"
            class="remove-photo-btn"
            onclick="removeProductPhoto(${index})"
          >
            Remove
          </button>

        </div>
      `;
    } else {
      card.innerHTML = `
        <span class="slot-number">
          ${index + 1}
        </span>

        <span class="slot-empty-text">
          No Photo
        </span>
      `;
    }

    galleryContainer.appendChild(card);
  }
}

function setProductCover(index) {
  if (!productGalleryData[index]) return;

  selectedCoverIndex = index;

  setImagePreview(productGalleryData[index]);

  renderProductGallery();
}

function removeProductPhoto(index) {

  const removedImage =
    productGalleryData[index];

  if (!removedImage) return;

  if (
    typeof removedImage === "string" &&
    !removedImage.startsWith("http")
  ) {

    const localImagesBefore =
      productGalleryData
        .slice(0, index)
        .filter(image =>
          typeof image === "string" &&
          !image.startsWith("http")
        );

    const fileIndex =
      localImagesBefore.length;

    const removedFile =
      productGalleryFiles[fileIndex];

    if (removedFile) {

      if (typeof getFileKey === "function") {
        productGalleryFileKeys.delete(
          getFileKey(removedFile)
        );
      }

      productGalleryFiles.splice(
        fileIndex,
        1
      );
    }
  }

  productGalleryData.splice(index, 1);

  if (productGalleryData.length === 0) {

    selectedCoverIndex = 0;
    setImagePreview("");

  } else {

    if (index < selectedCoverIndex) {
      selectedCoverIndex--;
    }

    if (
      selectedCoverIndex >=
      productGalleryData.length
    ) {
      selectedCoverIndex = 0;
    }

    setImagePreview(
      productGalleryData[selectedCoverIndex]
    );
  }

  renderProductGallery();
}

function setImagePreview(src, gallery = []) {

  const preview =
    document.getElementById("productImagePreview");

  const placeholder =
    document.getElementById("imagePreviewPlaceholder");

  if (!preview || !placeholder) return;

  const box =
    preview.parentElement;

  if (!box) return;

  const images =
    gallery.length
      ? gallery
      : (src ? [src] : []);

  if (!images.length) {

    preview.src = "";

    preview.style.display = "none";

    placeholder.style.display = "block";

    return;
  }

  preview.src = images[0];

  preview.style.display = "block";

  placeholder.style.display = "none";
}

function refreshSupplierProfitPreview() {
  const singlePreview =
    document.getElementById("singleSupplierProfitPreview");

  if (singlePreview) {
    singlePreview.textContent = inventoryProfitPreview({
      supplierPrice:
        document.getElementById("singleSupplierPrice")?.value,
      price: singlePriceInput?.value,
      discountPrice: singleDiscountPriceInput?.value,
      stock: singleStockInput?.value
    });
  }

  if (!variantTableBody) return;

  variantTableBody
    .querySelectorAll("tr[data-variant-id]")
    .forEach((row) => {
      const preview =
        row.querySelector('[data-role="supplierProfitPreview"]');

      if (!preview) return;

      preview.textContent = inventoryProfitPreview({
        supplierPrice:
          row.querySelector('[data-field="supplierPrice"]')?.value,
        price:
          row.querySelector('[data-field="price"]')?.value,
        discountPrice:
          row.querySelector('[data-field="discountPrice"]')?.value,
        stock:
          row.querySelector('[data-field="stock"]')?.value
      });
    });
}

function setupSupplierPriceFields() {
  if (
    singleSkuSection &&
    !document.getElementById("singleSupplierPrice")
  ) {
    const field = document.createElement("div");

    field.className = "form-group";
    field.innerHTML = `
      <label for="singleSupplierPrice">
        Supplier Price / Item (₱)
      </label>

      <input
        id="singleSupplierPrice"
        type="number"
        min="0"
        step="0.01"
        placeholder="Not set"
      />

      <p
        id="singleSupplierProfitPreview"
        aria-live="polite"
      ></p>

      <small>
        Gross profit only. Excludes fees and other expenses.
      </small>
    `;

    singleSkuSection.appendChild(field);
  }

  productForm?.addEventListener(
    "input",
    refreshSupplierProfitPreview
  );

  refreshSupplierProfitPreview();
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

    const files = Array.from(this.files || []);

    if (!files.length) {
      setImagePreview(safeText(existingImageData?.value));
      return;
    }

    const MAX_IMAGE_SIZE = 500 * 1024; // 500 KB

    if (files.length > 5) {
      showToast(
        "Photo Limit Reached — Maximum of 5 product photos only.",
        "warning"
      );
      this.value = "";
      return;
    }

    const invalidFile = files.find(
      file => !file.type.startsWith("image/")
    );

    if (invalidFile) {
      showToast(
        "Invalid Image — Please upload a valid image file.",
        "error"
      );

      this.value = "";
      return;
    }

    const oversizedFile = files.find(
      file => file.size > MAX_IMAGE_SIZE
    );

    if (oversizedFile) {
      showToast(
        `Image Too Large — "${oversizedFile.name}" must be smaller than 500 KB.`,
        "error"
      );

      this.value = "";
      return;
    }

    Promise.all(
      files.map(file => fileToBase64(file))
    ).then((images) => {

      const uniqueImages = [];
      const uniqueFiles = [];

      images.forEach((image, index) => {

        const file = files[index];
        const fileKey = getFileKey(file);

        const alreadyExists =
          productGalleryFileKeys.has(fileKey);

        const alreadyAdded =
          uniqueFiles.some(
            item => getFileKey(item) === fileKey
          );

        if (!alreadyExists && !alreadyAdded) {
          uniqueImages.push(image);
          uniqueFiles.push(files[index]);
        }

      });

      if (!uniqueImages.length) {
        showToast(
          "Photo Already Added — This image is already in your product gallery.",
          "warning"
        );

        this.value = "";
        return;
      }

      const remainingSlots =
        5 - productGalleryData.length;

      if (remainingSlots <= 0) {
        showToast(
          "Photo Limit Reached — Maximum of 5 product photos only.",
          "warning"
        );

        this.value = "";
        return;
      }

      const newImages =
        uniqueImages.slice(0, remainingSlots);

      const newFiles =
        uniqueFiles.slice(0, remainingSlots);

      productGalleryData.push(...newImages);
      productGalleryFiles.push(...newFiles);

      newFiles.forEach(file => {
        productGalleryFileKeys.add(
          getFileKey(file)
        );
      });

      if (
        productGalleryData.length ===
        newImages.length
      ) {
        selectedCoverIndex = 0;
      }

      setImagePreview(
        productGalleryData[selectedCoverIndex]
      );

      renderProductGallery();

      showToast(
        `${productGalleryData.length} product photos selected.`,
        "success"
      );

      this.value = "";
    });

  });
}


if (singleVariantImageFile) {
  singleVariantImageFile.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast(
        "Invalid Image — Please upload a valid image file.",
        "error"
      );
      this.value = "";
      return;
    }

    const MAX_IMAGE_SIZE = 500 * 1024;

    if (file.size > MAX_IMAGE_SIZE) {
      showToast(
        `Image Too Large — "${file.name}" must be smaller than 500 KB.`,
        "error"
      );
      this.value = "";
      return;
    }

    showToast("Uploading single SKU image...", "success");

    uploadImageToSupabase(file, "variants")
      .then((imageUrl) => {

        if (!imageUrl) {
          showToast("Single SKU image upload failed.", "error");
          return;
        }

        singleVariantImageData = String(imageUrl).trim();
        singleVariantImageChanged = true;

        showToast("Single SKU image uploaded.", "success");
      });

  });
}

function getVariantRows() {
  if (!variantTableBody) return [];

  return Array.from(variantTableBody.querySelectorAll("tr[data-variant-id]")).map(
    (row) => ({
      id: safeText(row.dataset.variantId, generateVariantId()),
      label: safeText(row.querySelector('[data-field="label"]')?.value),
      price: safeNumber(row.querySelector('[data-field="price"]')?.value, 0),
      supplierPrice: inventorySupplierPrice(
        row.querySelector('[data-field="supplierPrice"]')?.value
      ),
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
    showToast(
      "Invalid Image — Please upload a valid image file.",
      "error"
    );

    input.value = "";

    if (fileNameText) {
      fileNameText.textContent =
        currentImage ? "Saved image" : "No file chosen";
    }

    return;
  }

  const MAX_IMAGE_SIZE = 500 * 1024;

  if (file.size > MAX_IMAGE_SIZE) {
    showToast(
      `Image Too Large — "${file.name}" must be smaller than 500 KB.`,
      "error"
    );

    input.value = "";

    if (fileNameText) {
      fileNameText.textContent =
        currentImage ? "Saved image" : "No file chosen";
    }

    return;
  }

  if (fileNameText) {
    fileNameText.textContent = "Uploading...";
  }

  uploadImageToSupabase(file, "variants")
    .then((imageUrl) => {

      if (!imageUrl) {
        if (fileNameText) fileNameText.textContent = "Upload failed";
        return;
      }

      if (hiddenImageInput) {
        hiddenImageInput.value = String(imageUrl).trim();
        hiddenImageInput.setAttribute("value", String(imageUrl).trim());
      }

      if (fileNameText) {
        fileNameText.textContent = file.name;
      }

      showToast("Variant image uploaded.", "success");
    });
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
     
        <td>
          <input
            type="number"
            data-field="price"
            min="0"
            step="0.01"
            value="${item.price}"
          />

          <label style="display:block; margin-top:8px;">
            Supplier Price / Item (₱)

            <input
              type="number"
              data-field="supplierPrice"
              min="0"
              step="0.000001"
              value="${item.supplierPrice ?? ""}"
              placeholder="Not set"
              ${safeText(productId?.value) && item.supplierPrice !== null
        ? "readonly"
        : ""
      }
            
      />
      </label>

      <small
        data-role="supplierProfitPreview"

            aria-live="polite"
            style="display:block; margin-top:6px;"
          >
            ${inventoryProfitPreview(item)}
          </small>
        </td>

      <td><input type="number" data-field="discountPrice" min="0" step="0.01" value="${item.discountPrice || ""}" /></td>
      <td>
      <input
        type="number"
        data-field="stock"
        min="0"
        value="${item.stock}"
        ${safeText(productId?.value) ? "readonly" : ""}
        />
      </td>
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

const applyToAllVariantsBtn =
  document.getElementById("applyToAllVariantsBtn");

if (applyToAllVariantsBtn) {
  applyToAllVariantsBtn.addEventListener("click", () => {

    const stock = document.getElementById("applyAllStock")?.value;
    const weight = document.getElementById("applyAllWeight")?.value;
    const length = document.getElementById("applyAllLength")?.value;
    const width = document.getElementById("applyAllWidth")?.value;
    const height = document.getElementById("applyAllHeight")?.value;

    const rows =
      document.querySelectorAll(
        '#variantTableBody tr[data-variant-id]'
      );

    if (!rows.length) {
      showToast("No variants available.", "warning");
      return;
    }

    rows.forEach((row) => {

      const stockField =
        row.querySelector('[data-field="stock"]');

      if (
        stock != null &&
        stock !== "" &&
        stockField &&
        !stockField.readOnly
      ) {
        stockField.value = stock;
      }

      if (weight !== "") {
        row.querySelector('[data-field="weight"]').value = weight;
      }

      if (length !== "") {
        row.querySelector('[data-field="length"]').value = length;
      }

      if (width !== "") {
        row.querySelector('[data-field="width"]').value = width;
      }

      if (height !== "") {
        row.querySelector('[data-field="height"]').value = height;
      }

    });

    showToast(
      "Values applied to all variants.",
      "success"
    );

  });
}

window.addVariantRow = addVariantRow;

function removeVariantRow(variantId) {
  const variants = getVariantRows().filter(
    (item) => String(item.id) !== String(variantId)
  );
  renderVariantTable(variants);
}

function buildSingleSkuVariant(mainImage = "") {

  const existingMainImage =
    safeText(existingImageData?.value);

  const existingSkuImage =
    safeText(singleVariantImageData);

  let fallbackImage = "";

  if (singleVariantImageChanged) {

    // User explicitly uploaded a new Single SKU image
    fallbackImage = existingSkuImage;

  } else if (
    existingSkuImage &&
    existingSkuImage !== existingMainImage
  ) {

    // Preserve an existing separate SKU image
    fallbackImage = existingSkuImage;

  } else {

    // SKU was using the main image, so follow the new cover/main image
    fallbackImage =
      safeText(mainImage) ||
      existingSkuImage ||
      existingMainImage;
  }

  const existingProduct = products.find(
    (item) => String(item.id) === String(productId?.value)
  );

  const existingVariant =
    existingProduct?.productType === "single"
      ? existingProduct.variants?.[0]
      : null;

  return normalizeVariant({
    id: existingVariant?.id || generateVariantId(),

    label: "Default",
    price: safeNumber(singlePriceInput?.value, 0),
    supplierPrice: inventorySupplierPrice(
      document.getElementById("singleSupplierPrice")?.value
    ),
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

  if (description.length < 100) {
    showToast("Description must be at least 100 characters.", "error");
    return false;
  }

  if (description.length > 3000) {
    showToast("Description must not exceed 3000 characters.", "error");
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

  if (singleStockInput) {
    singleStockInput.value = "";
    singleStockInput.readOnly = false;
  }

  const supplierInput =
    document.getElementById("singleSupplierPrice");

  if (supplierInput) {
    supplierInput.value = "";
    supplierInput.readOnly = false;
  }

  if (singleSkuInput) singleSkuInput.value = "";
  if (singleWeightInput) singleWeightInput.value = "";
  if (singleLengthInput) singleLengthInput.value = "";
  if (singleWidthInput) singleWidthInput.value = "";
  if (singleHeightInput) singleHeightInput.value = "";
  if (singleVariantImageFile) singleVariantImageFile.value = "";

  singleVariantImageData = "";
  singleVariantImageChanged = false;

  refreshSupplierProfitPreview();
}

function resetProductForm() {
  if (!productForm) return;

  const restockPanel =
    document.getElementById("inventoryRestockDialog");

  if (restockPanel) {
    restockPanel.hidden = true;
    delete restockPanel.dataset.productId;
  }

  productForm.reset();

  restockLoadVersion++;

  if (productId) {
    productId.value = "";
    delete productId.dataset.editRevision;
    delete productId.dataset.detailsFingerprint;
  }

  if (existingImageData) existingImageData.value = "";

  productGalleryData = [];
  productGalleryFiles = [];
  productGalleryFileKeys.clear();
  selectedCoverIndex = 0;

  renderProductGallery();

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
      ? product.variants.some((variant) => {

        const label = safeText(variant.label).toLowerCase();
        const sku = safeText(variant.sku).toLowerCase();

        return (
          label.includes(searchValue) ||
          sku.includes(searchValue)
        );
      })
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

  renderInventoryPageNumbers(
    filteredProducts.length,
    searchValue
  );

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

  const orderedProducts = filteredProducts.slice();

  const startIndex =
    (inventoryCurrentPage - 1) * inventoryItemsPerPage;

  const endIndex =
    startIndex + inventoryItemsPerPage;

  const paginatedProducts =
    orderedProducts.slice(startIndex, endIndex);

  paginatedProducts.forEach((product) => {

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
            <td>

          <div class="action-buttons">

            <button
              type="button"
              class="small-btn"
              onclick="openProductEditor('${product.id}')"
              >
              Edit
            </button>

          <button
            type="button"
            class="small-btn view-live-btn"
            onclick="viewLiveProduct('${product.id}')"
          >
            View Live
          </button>

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

    if (
      inventoryProductSaving ||
      inventoryRestockSaving ||
      initialCostSaving
    ) {
      showToast(
        "Please wait for the current save to finish.",
        "warning"
      );
      return;
    }

    inventoryProductSaving = true;
    if (submitBtn) submitBtn.disabled = true;

    try {

      let galleryImages = [];

      const uploadedFiles = productGalleryFiles;

      if (productGalleryData.length > 5) {
        showToast("Maximum 5 product photos only.", "error");
        return;
      }

      let uploadIndex = 0;

      for (const image of productGalleryData) {

        // Existing uploaded image
        if (
          typeof image === "string" &&
          image.startsWith("http")
        ) {
          galleryImages.push(image);
          continue;
        }

        // Newly selected local/base64 image
        const file = uploadedFiles[uploadIndex];

        if (file) {
          const uploadedUrl =
            await uploadImageToSupabase(
              file,
              "products"
            );

          if (!uploadedUrl) {
            showToast(
              "One of the product images failed to upload.",
              "error"
            );
            return;
          }

          galleryImages.push(uploadedUrl);
          uploadIndex++;
        }
      }

      const finalImage =
        galleryImages[selectedCoverIndex] ||
        galleryImages[0] ||
        "";

      const currentMode = safeText(productTypeInput?.value, "single");

      const variants = currentMode === "single"
        ? [buildSingleSkuVariant(finalImage)]
        : getVariantRows().map((variant, index) =>
          normalizeVariant(variant, index)
        );

      const firstVariant = variants[0] || {};

      const totalStock = variants.reduce(
        (sum, variant) => sum + safeNumber(variant.stock, 0),
        0
      );

      const productData = {
        title: safeText(nameInput?.value),
        brand: safeText(brandInput?.value),
        price: safeNumber(firstVariant.price, 0),
        discount_price: safeNumber(firstVariant.discountPrice, 0),
        category: safeText(categoryInput?.value),
        description: safeText(descriptionInput?.value),
        stock: totalStock,
        image: safeText(finalImage),
        gallery: galleryImages,
        variant_title: currentMode === "variant"
          ? safeText(variantTitleInput?.value, "Variation")
          : "Single SKU",
        variations: variants.map((variant) => {
          const publicVariant = { ...variant };

          delete publicVariant.supplierPrice;

          return publicVariant;
        }),
        weight: safeNumber(firstVariant.weight, 0),
        length: safeNumber(firstVariant.length, 0),
        width: safeNumber(firstVariant.width, 0),
        height: safeNumber(firstVariant.height, 0),
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

      const editingId = safeText(productId?.value);

      let error;
      let savedRows = [];

      if (editingId) {
        const expectedRevision =
          productId?.dataset.editRevision || "";

        if (!/^\d+$/.test(expectedRevision)) {
          showToast(
            "Product revision is missing. Reopen Edit before saving.",
            "error"
          );
          return;
        }

        const result = await supabaseClient.rpc(
          "inventory_save_product_details",
          {
            p_product_id: editingId,
            p_expected_revision: expectedRevision,
            p_details: productData
          }
        );

        error = result.error;
        savedRows = result.data ? [result.data] : [];

        if (!error && savedRows.length === 0) {
          showToast("Product save was not confirmed.", "error");
          return;
        }

      } else {
        const result = await supabaseClient
          .from("products")
          .insert([productData])
          .select("id, stock, variations");

        error = result.error;
        savedRows = result.data || [];
      }

      if (error) {
        console.error(error);
        showToast(error.message || "Supabase save failed.", "error");
        return;
      }

      let costSaveError = "";
      let existingCostDifferent = false;

      try {
        const savedProductId = savedRows[0]?.id;

        if (savedProductId == null) {
          throw new Error("Saved product ID was not returned.");
        }

        existingCostDifferent = await saveProductInitialCosts(
          savedProductId,
          variants
        );

      } catch (error) {
        costSaveError =
          error.message || "Supplier cost could not be saved.";
      }

      if (costSaveError) {
        showToast(
          "Product saved, but supplier cost saving did not finish: " +
          costSaveError +
          " Reopen Edit to retry the missing costs.",
          "error"
        );

      } else if (existingCostDifferent) {
        showToast(
          "Product saved. Existing average cost was kept; use Restock to record new delivery costs.",
          "warning"
        );

      } else {
        showToast(
          "Product and supplier cost saved successfully.",
          "success"
        );
      }

      resetProductForm();
      await loadAdminProductsFromSupabase();
      showSection("inventorySection");

    } catch (error) {
      console.error(error);
      showToast("Failed to save product online.", "error");
    } finally {
      inventoryProductSaving = false;
      if (submitBtn) submitBtn.disabled = false;

      updateInitialCostButton();
      updateRestockPreview();
    }
  });
}

async function saveProductInitialCosts(savedProductId, variants) {
  let existingCostDifferent = false;

  for (const variant of variants) {
    const cost = inventorySupplierPrice(variant.supplierPrice);

    if (cost === null) continue;

    const { data, error } = await supabaseClient
      .from("inventory_costs")
      .select("average_cost")
      .eq("product_id", savedProductId)
      .eq("variant_id", variant.id)
      .maybeSingle();

    if (error) throw error;

    // Existing average cost must not be overwritten by Edit.
    if (data?.average_cost != null) {
      if (Number(data.average_cost) !== cost) {
        existingCostDifferent = true;
      }

      continue;
    }

    const result = await supabaseClient.rpc(
      "inventory_set_initial_cost",
      {
        p_product_id: savedProductId,
        p_variant_id: variant.id,
        p_unit_cost: cost,
        p_expected_stock: variant.stock
      }
    );

    if (result.error) {
      throw new Error(
        `${variant.label || variant.id}: ${result.error.message}`
      );
    }
  }

  return existingCostDifferent;
}

function inventoryDetailsFingerprint(product) {
  const details = {};

  [
    "title",
    "brand",
    "price",
    "discount_price",
    "category",
    "description",
    "image",
    "gallery",
    "variant_title",
    "weight",
    "length",
    "width",
    "height"
  ].forEach((key) => {
    details[key] = product[key] ?? null;
  });

  details.variations = (
    Array.isArray(product.variations)
      ? product.variations
      : []
  ).map((variant) => {
    const item = { ...variant };

    delete item.stock;
    delete item.supplierPrice;

    return item;
  });

  function sortKeys(value) {
    if (Array.isArray(value)) {
      return value.map(sortKeys);
    }

    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, sortKeys(value[key])])
      );
    }

    return value;
  }

  return JSON.stringify(sortKeys(details));
}

function updateEditorInventoryFields(
  savedProductId,
  variantId,
  stock,
  averageCost
) {
  if (
    !productId ||
    String(productId.value) !== String(savedProductId)
  ) {
    return;
  }

  function updateFields(stockField, costField) {
    if (stockField) {
      stockField.value = String(stock);
      stockField.readOnly = true;
    }

    // Preserve a typed initial cost if no saved cost exists yet.
    if (costField && averageCost !== null) {
      costField.value = String(averageCost);
      costField.step = "0.000001";
      costField.readOnly = true;
    }
  }

  if (productTypeInput?.value === "single") {
    const baseline = JSON.parse(
      productId.dataset.detailsFingerprint || "{}"
    );

    if (
      String(baseline.variations?.[0]?.id) !== String(variantId)
    ) {
      return;
    }

    updateFields(
      singleStockInput,
      document.getElementById("singleSupplierPrice")
    );
  } else {
    const rows = variantTableBody?.querySelectorAll(
      "tr[data-variant-id]"
    ) || [];

    for (const row of rows) {
      if (String(row.dataset.variantId) !== String(variantId)) {
        continue;
      }

      updateFields(
        row.querySelector('[data-field="stock"]'),
        row.querySelector('[data-field="supplierPrice"]')
      );
    }
  }

  refreshSupplierProfitPreview();
}

function openProductEditor(id) {
  const url = new URL(window.location.href);

  url.searchParams.set("editProduct", String(id));
  url.hash = "";

  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

window.openProductEditor = openProductEditor;

async function editProduct(id) {
  const product = products.find(
    (item) => String(item.id).trim() === String(id).trim()
  );

  if (!product) return;

  try {
    const costRows = [];
    const pageSize = 500;

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabaseClient
        .from("inventory_costs")
        .select("variant_id, average_cost")
        .eq("product_id", product.id)
        .order("variant_id")
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      costRows.push(...(data || []));

      if (!data || data.length < pageSize) break;
    }

    const costsByVariant = new Map(
      costRows.map((row) => [
        String(row.variant_id),
        inventorySupplierPrice(row.average_cost)
      ])
    );

    product.variants = (
      Array.isArray(product.variants) ? product.variants : []
    ).map((variant) => ({
      ...variant,
      supplierPrice:
        costsByVariant.get(String(variant.id)) ?? null
    }));

  } catch (error) {
    showToast(
      "Cannot load supplier costs: " +
      (error.message || "Please retry."),
      "error"
    );
    return;
  }

  if (productId) {
    productId.value = safeText(product.id);
    productId.dataset.editRevision = safeText(product.editRevision);
    productId.dataset.detailsFingerprint =
      safeText(product.detailsFingerprint);
  }
  if (existingImageData) existingImageData.value = safeText(product.image);
  if (nameInput) nameInput.value = safeText(product.name);
  if (categoryInput) categoryInput.value = safeText(product.category);
  if (brandInput) {
    const savedBrand = safeText(product.brand);

    const optionExists = Array.from(brandInput.options).some(
      (option) => option.value === savedBrand
    );
    if (savedBrand && optionExists) {
      brandInput.value = savedBrand;
    } else if (savedBrand) {
      const newOption = document.createElement("option");
      newOption.value = savedBrand;
      newOption.textContent = savedBrand;
      brandInput.appendChild(newOption);
      brandInput.value = savedBrand;
    } else {
      brandInput.value = "";
    }

  }
  if (descriptionInput) descriptionInput.value = safeText(product.description);
  if (productTypeInput) productTypeInput.value = safeText(product.productType, "single");

  setModeUI();

  if (safeText(product.productType, "single") === "single") {
    const single =
      Array.isArray(product.variants) && product.variants.length
        ? normalizeVariant(product.variants[0])
        : createEmptyVariant();

    if (singlePriceInput) singlePriceInput.value = single.price || "";
    const supplierPriceInput =
      document.getElementById("singleSupplierPrice");

    if (supplierPriceInput) {
      supplierPriceInput.value = single.supplierPrice ?? "";
      supplierPriceInput.step = "0.000001";
      supplierPriceInput.readOnly = single.supplierPrice !== null;
    }

    if (singleDiscountPriceInput) {
      singleDiscountPriceInput.value = single.discountPrice || "";
    }

    if (singleStockInput) {
      singleStockInput.value = String(
        safeNumber(single.stock, 0)
      );
      singleStockInput.readOnly = true;
    }

    if (singleSkuInput) singleSkuInput.value = safeText(single.sku);
    if (singleWeightInput) singleWeightInput.value = single.weight || "";
    if (singleLengthInput) singleLengthInput.value = single.length || "";
    if (singleWidthInput) singleWidthInput.value = single.width || "";
    if (singleHeightInput) singleHeightInput.value = single.height || "";
    singleVariantImageData = safeText(single.image);
    singleVariantImageChanged = false;
    renderVariantTable([]);
    if (variantTitleInput) variantTitleInput.value = "";
  } else {
    if (variantTitleInput) variantTitleInput.value = safeText(product.variantTitle);
    renderVariantTable(Array.isArray(product.variants) ? product.variants : []);
    resetSingleSkuFields();
  }

  if (submitBtn) submitBtn.textContent = "Update Product";
  productGalleryData =
    Array.isArray(product.gallery) && product.gallery.length
      ? [...product.gallery]
      : (product.image ? [product.image] : []);

  productGalleryFiles = [];
  productGalleryFileKeys.clear();

  selectedCoverIndex = productGalleryData.findIndex(
    (img) => img === product.image
  );

  if (selectedCoverIndex < 0) {
    selectedCoverIndex = 0;
  }

  setImagePreview(
    productGalleryData[selectedCoverIndex] || product.image || ""
  );

  renderProductGallery();
  refreshSupplierProfitPreview();
  showSection("addListingSection");

  await openInlineRestock(product);

  productForm?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
  // window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("Loaded product for editing.", "success");
}

function viewLiveProduct(id) {
  window.open(
    `../Product/index.html?id=${encodeURIComponent(id)}`,
    "_blank"
  );
}



async function deleteProduct(id) {
  const selected = products.find(
    (item) => String(item.id).trim() === String(id).trim()
  );
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

if (searchInput) {
  searchInput.addEventListener("input", function () {

    const keyword = safeText(this.value).toLowerCase().trim();

    inventoryCurrentPage = 1;
    renderInventory(keyword);


  });
}

if (searchInput) {
  searchInput.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {
      e.preventDefault();

      const keyword = safeText(this.value).toLowerCase().trim();

      inventoryCurrentPage = 1;
      renderInventory(keyword);
    }

  });
}


async function loadAdminProductsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")

  if (error) {
    console.error(error);
    showToast("Failed to load products from Supabase.", "error");
    return;
  }

  products = (data || []).map((item) => ({
    id: item.id,
    editRevision: String(item.edit_revision ?? ""),
    detailsFingerprint: inventoryDetailsFingerprint(item),
    name: item.title,
    brand: item.brand || "",
    category: item.category,
    productType: item.variations && item.variations.length > 1 ? "variant" : "single",
    variantTitle: item.variant_title || "Options",
    image: item.image,
    gallery: Array.isArray(item.gallery) ? item.gallery : [],
    description: item.description,
    weight: item.weight,
    length: item.length,
    width: item.width,
    height: item.height,
    variants: Array.isArray(item.variations)
      ? item.variations
      : []
  }));

  renderInventory();
  updateDashboard();
}

setupSupplierPriceFields();
setImagePreview("");
renderVariantTable([]);
setModeUI();

loadAdminProductsFromSupabase()
  .then(async () => {
    const url = new URL(window.location.href);
    const editId = url.searchParams.get("editProduct");

    if (!editId) {
      showSection("ordersSection");
      return;
    }

    // Remove the Edit instruction from the URL after reading it.
    url.searchParams.delete("editProduct");
    window.history.replaceState(
      window.history.state,
      "",
      url.toString()
    );

    const exists = products.some(
      (item) => String(item.id) === editId
    );

    if (!exists) {
      showSection("ordersSection");
      showToast("Product not found.", "error");
      return;
    }

    await editProduct(editId);
  })
  .catch((error) => {
    console.error(error);
    showToast("Failed to load the admin page.", "error");
  });

window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.viewLiveProduct = viewLiveProduct;
window.removeVariantRow = removeVariantRow;
window.handleVariantFileChange = handleVariantFileChange;

window.setProductCover = setProductCover;
window.removeProductPhoto = removeProductPhoto;

document.addEventListener("wheel", function (e) {
  const active = document.activeElement;

  if (active && active.type === "number") {
    active.blur();
  }
}, { passive: true });

async function openInlineRestock(product) {
  let panel =
    document.getElementById("inventoryRestockDialog");

  if (!panel || !productForm) {
    showToast("Restock section is missing from the HTML.", "error");
    return;
  }

  // Convert the existing dialog into a normal page section.
  // Moving its children preserves their existing event listeners.
  if (panel.tagName === "DIALOG") {
    const section = document.createElement("section");

    section.id = "inventoryRestockDialog";
    section.className = "panel-card";
    section.style.marginTop = "24px";

    while (panel.firstChild) {
      section.appendChild(panel.firstChild);
    }

    panel.replaceWith(section);
    panel = section;
  }

  // Place Restock outside the product form, on the same page.
  productForm.insertAdjacentElement("afterend", panel);

  panel.hidden = false;
  panel.dataset.productId = String(product.id);

  const heading = panel.querySelector("h2");
  if (heading) heading.textContent = "Restock / Add Stock";

  const closeButton = document.getElementById("closeRestockBtn");
  if (closeButton) {
    closeButton.hidden = true;
    closeButton.onclick = null;
  }

  document.getElementById("restockProductName").textContent =
    safeText(product.name, "Unnamed Product");

  const variantSelect =
    document.getElementById("restockVariant");

  variantSelect.replaceChildren();

  const variants = Array.isArray(product.variants)
    ? product.variants
    : [];

  variants.forEach((variant) => {
    const option = document.createElement("option");

    option.value = safeText(variant.id);
    option.textContent = safeText(variant.label, "Default");

    variantSelect.appendChild(option);
  });

  await loadSelectedRestockVariant();
}

let restockLoadVersion = 0;

async function loadSelectedRestockVariant() {
  const dialog =
    document.getElementById("inventoryRestockDialog");

  const variantSelect =
    document.getElementById("restockVariant");

  if (!dialog || !variantSelect) return;

  const loadVersion = ++restockLoadVersion;
  const selectedProductId = dialog.dataset.productId;
  const selectedVariantId = variantSelect.value;

  const editorRevision =
    productId?.dataset.editRevision || "";

  const editorFingerprint =
    productId?.dataset.detailsFingerprint || "";

  function editorStillMatches() {
    return (
      loadVersion === restockLoadVersion &&
      String(productId?.value) === String(selectedProductId) &&
      dialog.dataset.productId === selectedProductId &&
      variantSelect.value === selectedVariantId &&
      productId?.dataset.editRevision === editorRevision &&
      productId?.dataset.detailsFingerprint === editorFingerprint
    );
  }

  const stockInput =
    document.getElementById("restockCurrentStock");

  const costInput =
    document.getElementById("restockCurrentCost");

  const message =
    document.getElementById("restockMessage");

  stockInput.value = "";
  costInput.value = "";

  delete dialog.dataset.currentStock;
  delete dialog.dataset.averageCost;

  document.getElementById("restockInitialCost").value = "";
  document.getElementById("restockQuantity").value = "";
  document.getElementById("restockNewCost").value = "";
  document.getElementById("restockPreview").textContent = "";

  document.getElementById("restockInitialCostSection").hidden = true;
  document.getElementById("saveInitialCostBtn").disabled = true;
  document.getElementById("saveRestockBtn").disabled = true;

  if (!selectedProductId || !selectedVariantId) {
    message.textContent = "No valid variant selected.";
    return;
  }

  message.textContent = "Loading current stock and cost...";

  try {
    const [productResult, costResult] = await Promise.all([

      supabaseClient
        .from("products")
        .select("*")
        .eq("id", selectedProductId)
        .single(),

      supabaseClient
        .from("inventory_costs")
        .select("average_cost")
        .eq("product_id", selectedProductId)
        .eq("variant_id", selectedVariantId)
        .maybeSingle()
    ]);

    // Ignore an old response if another variant was selected.
    if (loadVersion !== restockLoadVersion) return;

    if (productResult.error) throw productResult.error;
    if (costResult.error) throw costResult.error;

    if (!editorStillMatches()) return;

    if (
      !editorFingerprint ||
      inventoryDetailsFingerprint(productResult.data) !== editorFingerprint
    ) {
      throw new Error(
        "Product details changed in another session. Copy your unsaved edits, then reopen Edit. Your edits were not replaced."
      );
    }

    const freshRevision = String(
      productResult.data.edit_revision ?? ""
    );

    if (
      !/^\d+$/.test(editorRevision) ||
      !/^\d+$/.test(freshRevision) ||
      BigInt(freshRevision) < BigInt(editorRevision)
    ) {
      throw new Error(
        "Cannot verify product revision. Copy your unsaved edits, then reopen Edit."
      );
    }

    const variants = productResult.data?.variations;

    const matches = Array.isArray(variants)
      ? variants.filter(
        (item) => String(item.id) === selectedVariantId
      )
      : [];

    if (matches.length !== 1) {
      throw new Error("Variant is missing or its ID is duplicated.");
    }

    const rawStock = matches[0].stock;
    const stock = Number(rawStock);

    if (
      rawStock == null ||
      String(rawStock).trim() === "" ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      throw new Error("Variant stock is invalid.");
    }

    const rawCost = costResult.data?.average_cost;
    const hasCost = rawCost !== null && rawCost !== undefined;
    const averageCost = hasCost ? Number(rawCost) : null;

    if (
      hasCost &&
      (!Number.isFinite(averageCost) || averageCost < 0)
    ) {
      throw new Error("Saved average cost is invalid.");
    }

    if (!editorStillMatches()) return;

    productId.dataset.editRevision = freshRevision;

    stockInput.value = String(stock);
    dialog.dataset.currentStock = String(stock);

    if (hasCost) {
      costInput.value = inventoryPeso(averageCost);
      dialog.dataset.averageCost = String(averageCost);
    } else {
      costInput.value = "Not set";

      document.getElementById(
        "restockInitialCostSection"
      ).hidden = stock === 0;
    }

    updateEditorInventoryFields(
      selectedProductId,
      selectedVariantId,
      stock,
      averageCost
    );

    message.textContent = !hasCost && stock > 0
      ? "Set the initial cost of existing stock before restocking."
      : "Stock and cost loaded. Enter the delivery quantity and supplier cost.";

    return true;

  } catch (error) {
    if (
      loadVersion !== restockLoadVersion ||
      String(productId?.value) !== String(selectedProductId) ||
      dialog.dataset.productId !== selectedProductId ||
      variantSelect.value !== selectedVariantId
    ) {
      return false;
    }

    delete dialog.dataset.currentStock;
    delete dialog.dataset.averageCost;

    document.getElementById("saveInitialCostBtn").disabled = true;
    document.getElementById("saveRestockBtn").disabled = true;

    message.textContent =
      error.message || "Failed to load stock and cost.";

    return false;
  }
}

document.getElementById("restockVariant")?.addEventListener(
  "change",
  loadSelectedRestockVariant
);

let initialCostSaving = false;

function updateInitialCostButton() {
  const dialog =
    document.getElementById("inventoryRestockDialog");

  const input =
    document.getElementById("restockInitialCost");

  const button =
    document.getElementById("saveInitialCostBtn");

  const section =
    document.getElementById("restockInitialCostSection");

  if (!dialog || !input || !button || !section) return;

  const cost = Number(input.value);

  const valid =
    !section.hidden &&
    dialog.dataset.currentStock !== undefined &&
    dialog.dataset.averageCost === undefined &&
    input.value.trim() !== "" &&
    input.validity.valid &&
    Number.isFinite(cost) &&
    cost >= 0 &&
    cost < 100000000000000;

  button.disabled =
    inventoryProductSaving ||
    inventoryRestockSaving ||
    initialCostSaving ||
    !valid;
}

document.getElementById("restockInitialCost")?.addEventListener(
  "input",
  updateInitialCostButton
);

document.getElementById("saveInitialCostBtn")?.addEventListener(
  "click",
  async function () {
    updateInitialCostButton();

    if (this.disabled || initialCostSaving) return;

    const dialog =
      document.getElementById("inventoryRestockDialog");

    const input =
      document.getElementById("restockInitialCost");

    const variantSelect =
      document.getElementById("restockVariant");

    const closeButton =
      document.getElementById("closeRestockBtn");

    const message =
      document.getElementById("restockMessage");

    const payload = {
      p_product_id: dialog.dataset.productId,
      p_variant_id: variantSelect.value,
      p_unit_cost: input.value.trim(),
      p_expected_stock: dialog.dataset.currentStock
    };

    initialCostSaving = true;
    this.disabled = true;
    this.textContent = "Saving...";
    input.disabled = true;
    variantSelect.disabled = true;
    closeButton.disabled = true;

    message.textContent = "Saving initial cost...";

    try {
      const { error } = await supabaseClient.rpc(
        "inventory_set_initial_cost",
        payload
      );

      if (error) throw error;

      showToast(
        "Initial cost saved. Stock quantity was not changed.",
        "success"
      );

      await loadSelectedRestockVariant();

    } catch (error) {
      message.textContent =
        error.message || "Failed to save initial cost.";

    } finally {
      initialCostSaving = false;
      this.textContent = "Save Initial Cost";
      input.disabled = false;
      variantSelect.disabled = false;
      closeButton.disabled = false;

      updateInitialCostButton();
    }
  }
);

document.getElementById("inventoryRestockDialog")?.addEventListener(
  "cancel",
  function (event) {
    if (initialCostSaving) event.preventDefault();
  }
);

let inventoryRestockSaving = false;

function getRestockInputData() {
  const dialog = document.getElementById("inventoryRestockDialog");
  const variant = document.getElementById("restockVariant");
  const qtyInput = document.getElementById("restockQuantity");
  const costInput = document.getElementById("restockNewCost");

  if (!dialog || !variant || !qtyInput || !costInput) return null;

  if (
    !dialog.dataset.productId ||
    !variant.value ||
    dialog.dataset.currentStock === undefined ||
    qtyInput.value.trim() === "" ||
    costInput.value.trim() === "" ||
    !qtyInput.validity.valid ||
    !costInput.validity.valid
  ) {
    return null;
  }

  const stock = Number(dialog.dataset.currentStock);
  const quantity = Number(qtyInput.value);
  const cost = Number(costInput.value);

  const hasCost = dialog.dataset.averageCost !== undefined;
  const averageCost = hasCost
    ? Number(dialog.dataset.averageCost)
    : 0;

  if (
    !Number.isSafeInteger(stock) ||
    stock < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    !Number.isSafeInteger(stock + quantity) ||
    !Number.isFinite(cost) ||
    cost < 0 ||
    cost >= 100000000000000 ||
    !Number.isFinite(averageCost) ||
    averageCost < 0 ||
    (stock > 0 && !hasCost)
  ) {
    return null;
  }

  return {
    stock,
    quantity,
    cost,
    averageCost,
    payload: {
      p_product_id: dialog.dataset.productId,
      p_variant_id: variant.value,
      p_quantity: quantity,
      p_unit_cost: costInput.value.trim()
    }
  };
}

function updateRestockPreview() {
  const button = document.getElementById("saveRestockBtn");
  const preview = document.getElementById("restockPreview");

  if (!button || !preview) return;

  const data = getRestockInputData();

  button.disabled =
    inventoryProductSaving ||
    inventoryRestockSaving ||
    initialCostSaving ||
    !data;

  if (!data) {
    preview.textContent =
      "Enter quantity and new supplier cost. Existing stock needs an initial cost.";
    return;
  }

  const newStock = data.stock + data.quantity;
  const newCost = (
    data.stock * data.averageCost +
    data.quantity * data.cost
  ) / newStock;

  preview.textContent =
    `Updated stock: ${newStock} | ` +
    `Estimated average cost: ${inventoryPeso(newCost)} / item`;
}

["restockQuantity", "restockNewCost"].forEach((id) => {
  document.getElementById(id)?.addEventListener(
    "input",
    updateRestockPreview
  );
});

document.getElementById("saveRestockBtn")?.addEventListener(
  "click",
  async function () {
    updateRestockPreview();

    if (this.disabled || inventoryRestockSaving) return;

    const data = getRestockInputData();
    if (!data) return;

    const message = document.getElementById("restockMessage");
    const pendingKey = "drinPendingInventoryRestock";

    const controls = [
      "restockVariant",
      "restockQuantity",
      "restockNewCost",
      "restockInitialCost",
      "saveInitialCostBtn",
      "closeRestockBtn"
    ]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const previousStates = controls.map((input) => input.disabled);
    let saved = false;

    inventoryRestockSaving = true;
    this.disabled = true;
    this.textContent = "Saving...";

    controls.forEach((input) => {
      input.disabled = true;
    });

    try {
      const signature = JSON.stringify(data.payload);
      const stored = sessionStorage.getItem(pendingKey);
      let pending = stored ? JSON.parse(stored) : null;

      if (pending && pending.signature !== signature) {
        throw new Error(
          "Retry the previous unconfirmed restock using its original product, variant, quantity and cost."
        );
      }

      if (!pending) {
        pending = {
          signature,
          requestId: crypto.randomUUID()
        };

        // Remember the ID before sending, to prevent duplicate retries.
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }

      message.textContent = "Saving restock...";

      const { data: result, error } = await supabaseClient.rpc(
        "inventory_restock",
        {
          ...data.payload,
          p_request_id: pending.requestId
        }
      );

      if (error) throw error;

      if (!result || result.request_id !== pending.requestId) {
        throw new Error(
          "Save not confirmed. Retry using the same values."
        );
      }

      saved = true;
      sessionStorage.removeItem(pendingKey);

      const refreshed = await loadSelectedRestockVariant();

      await loadAdminProductsFromSupabase();

      if (refreshed) {
        message.textContent =
          "Restock saved. Stock, average cost and history updated.";

        showToast("Restock saved successfully.", "success");
      } else {
        showToast(
          "Restock was saved, but the Edit form could not refresh safely. Copy your unsaved edits, then reopen Edit. Do not repeat the saved restock.",
          "warning"
        );
      }

    } catch (error) {
      message.textContent = saved
        ? "Restock saved, but refresh did not finish. Reopen the window to check."
        : error.message || "Save not confirmed. Retry the same values.";

    } finally {
      inventoryRestockSaving = false;
      this.textContent = "Save Restock";

      controls.forEach((input, index) => {
        input.disabled = previousStates[index];
      });

      if (typeof updateInitialCostButton === "function") {
        updateInitialCostButton();
      }

      updateRestockPreview();
    }
  }
);

document.getElementById("inventoryRestockDialog")?.addEventListener(
  "cancel",
  function (event) {
    if (inventoryRestockSaving) event.preventDefault();
  }
);
/* ===============================
   END INVENTORY MODULE
================================ */