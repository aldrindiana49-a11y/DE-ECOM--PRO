let products = [];
let cart = JSON.parse(localStorage.getItem("drinCart")) || [];

const params = new URLSearchParams(window.location.search);
const productId = params.get("id") || localStorage.getItem("selectedProductId");

const quantityInput = document.getElementById("quantityInput");
const plusBtn = document.getElementById("plusBtn");
const minusBtn = document.getElementById("minusBtn");
const addToCartBtn = document.getElementById("addToCartBtn");
const message = document.getElementById("message");

const variantContainer = document.getElementById("variantContainer");
let selectedVariant = null;

function renderVariantSelector() {
  if (!variantContainer) return;

  const variants = getVariants(product);

  if (!variants.length) {
    variantContainer.innerHTML = "";
    selectedVariant = null;
    return;
  }

  variantContainer.innerHTML = `
    <h4 class="variant-title">${product.variantTitle || "Variation"}</h4>
    <div class="variant-options">
      ${variants.map((variant, index) => `
        <button
          type="button"
          class="variant-btn ${safeNumber(variant.stock) <= 0 ? "out-of-stock" : ""}"
          data-index="${index}"
        >
          ${variant.label}
        </button>
      `).join("")}
    </div>
  `;

  const buttons = variantContainer.querySelectorAll(".variant-btn");

  buttons.forEach((button) => {
    button.addEventListener("click", function () {
      const variant = variants[Number(this.dataset.index)];

      if (!variant || safeNumber(variant.stock) <= 0) return;

      buttons.forEach(btn => btn.classList.remove("active"));
      this.classList.add("active");

      selectedVariant = variant;
      updateVariantUI(variant);
    });
  });

  selectedVariant = null;
}

function updateVariantUI(variant) {
  const price = safeNumber(variant.price);
  const discount = safeNumber(variant.discountPrice);
  const finalPrice = discount > 0 && discount < price ? discount : price;
  const percent = discount > 0 && discount < price
    ? Math.round(((price - discount) / price) * 100)
    : 0;

  document.getElementById("productPrice").textContent = formatPrice(finalPrice);
  document.getElementById("productOldPrice").textContent = percent ? formatPrice(price) : "";
  document.getElementById("discountBadge").textContent = percent ? `-${percent}%` : "";
  document.getElementById("stockText").textContent =
    safeNumber(variant.stock) > 0 ? `Stock: ${variant.stock} available` : "Out of stock";

  if (variant.image) {
    document.getElementById("productImg").src = variant.image;
  }

  quantityInput.max = safeNumber(variant.stock);
  quantityInput.value = safeNumber(variant.stock) > 0 ? 1 : 0;

  addToCartBtn.disabled = safeNumber(variant.stock) <= 0;
  addToCartBtn.textContent = safeNumber(variant.stock) <= 0 ? "Out of Stock" : "Add to Cart";
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatPrice(value) {
  return `₱${safeNumber(value).toLocaleString()}`;
}

function getVariants(product) {
  return Array.isArray(product?.variants) ? product.variants : [];
}

function getBestVariant(product) {
  const variants = getVariants(product);
  if (!variants.length) return null;

  const inStock = variants.find(v => safeNumber(v.stock) > 0);
  return inStock || variants[0];
}

function getProductStock(product) {
  const variants = getVariants(product);

  if (variants.length) {
    return variants.reduce((sum, v) => sum + safeNumber(v.stock), 0);
  }

  return safeNumber(product?.stock);
}

function getProductPrice(product) {
  const variant = getBestVariant(product);

  const price = variant ? safeNumber(variant.price) : safeNumber(product?.price);
  const discount = variant ? safeNumber(variant.discountPrice) : safeNumber(product?.discountPrice);

  return discount > 0 && discount < price ? discount : price;
}

function getProductImage(product) {
  const variant = getBestVariant(product);

  return (
    variant?.image ||
    product?.image ||
    "https://via.placeholder.com/500x400?text=No+Image"
  );
}

function getProductGallery(product) {
  const gallery = Array.isArray(product?.gallery)
    ? product.gallery
    : [];

  const mainImage =
    product?.image ||
    getProductImage(product);

  return [mainImage, ...gallery]
    .filter(Boolean)
    .filter((img, index, arr) => arr.indexOf(img) === index)
    .slice(0, 5);
}

function findProduct() {
  if (productId) {
    const found = products.find(p => String(p.id) === String(productId));
    if (found) return found;
  }

  const selected = JSON.parse(localStorage.getItem("selectedProduct") || "null");
  if (selected) return selected;

  return products[0] || null;
}

let product = null;

async function loadProductsFromSupabase() {

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  products = (data || []).map((item) => {

    const firstVariation =
      Array.isArray(item.variations) && item.variations.length
        ? item.variations[0]
        : {};

    const mainPrice = safeNumber(
      item.price || firstVariation.price,
      0
    );

    const mainDiscount = safeNumber(
      item.discount_price ||
      item.discountPrice ||
      firstVariation.discountPrice ||
      firstVariation.discount_price ||
      0,
      0
    );

    const variants =
      item.variations && item.variations.length
        ? item.variations.map((variant) => ({
          ...variant,
          discountPrice:
            variant.discountPrice ||
            variant.discount_price ||
            item.discount_price ||
            item.discountPrice ||
            0
        }))
        : [
          {
            label: "Default",
            price: mainPrice,
            discountPrice: mainDiscount,
            stock: item.stock,
            image: item.image
          }
        ];

    return {
      id: item.id,
      name: item.title,
      brand: item.brand || "",
      category: item.category,
      description: item.description,
      variantTitle: item.variant_title || "Variation",
      variants,
      image: item.image,
      gallery: Array.isArray(item.gallery) ? item.gallery : [],
      price: mainPrice,
      discountPrice: mainDiscount,
      stock: item.stock
    };
  });

  product = findProduct();

  if (!product) {

    document.querySelector(".product-container").innerHTML = `
      <div>
        <h2>Product not found</h2>
        <p>No product data found.</p>
      </div>
    `;

    return;
  }

  renderProduct();
  renderSuggestedProducts();
  loadProductVouchers();
  updateCartCount();
}

loadProductsFromSupabase();

function renderProduct() {
  const stock = getProductStock(product);

  document.getElementById("productName").textContent =
    product.name || "Unnamed Product";

  const variant = getBestVariant(product);

  let price = variant ? variant.price : product.price;
  let discount = variant ? variant.discountPrice : product.discountPrice;

  let finalPrice = price;
  let percent = 0;

  if (discount && discount < price) {
    finalPrice = discount;
    percent = Math.round(((price - discount) / price) * 100);
  }

  document.getElementById("productPrice").textContent =
    formatPrice(finalPrice);

  document.getElementById("productOldPrice").textContent =
    percent ? formatPrice(price) : "";

  document.getElementById("discountBadge").textContent =
    percent ? `-${percent}%` : "";

  document.getElementById("stockText").textContent =
    stock > 0
      ? `Stock: ${stock} available`
      : "Out of stock";

  renderProductGallery();

  const descEl =
    document.getElementById("productDescription") ||
    document.querySelector(".description");

  if (descEl) {
    descEl.textContent =
      product.description || "No description available.";
  }

  renderVariantSelector();

  quantityInput.max = stock;

  if (stock <= 0) {
    quantityInput.value = 0;
    addToCartBtn.disabled = true;
    addToCartBtn.textContent = "Out of Stock";
  }
}

function renderProductGallery() {
  const imageBox = document.querySelector(".product-image");
  if (!imageBox) return;

  const images = getProductGallery(product);
  let currentIndex = 0;

  imageBox.innerHTML = `
    <div class="product-gallery-slider">
      <button type="button" class="gallery-nav prev" id="galleryPrevBtn">‹</button>

      <img id="productImg" src="${images[0] || ""}" alt="Product Image" />

      <button type="button" class="gallery-nav next" id="galleryNextBtn">›</button>
    </div>

    <div class="product-thumbnails">
      ${images.map((img, index) => `
        <button
          type="button"
          class="product-thumb ${index === 0 ? "active" : ""}"
          data-index="${index}"
        >
          <img src="${img}" />
        </button>
      `).join("")}
    </div>
  `;

  function showImage(index) {
    currentIndex = index;

    document.getElementById("productImg").src = images[currentIndex];

    imageBox.querySelectorAll(".product-thumb").forEach((thumb, i) => {
      thumb.classList.toggle("active", i === currentIndex);
    });
  }

  imageBox.querySelectorAll(".product-thumb").forEach((btn) => {
    btn.addEventListener("click", function () {
      showImage(Number(this.dataset.index));
    });
  });

  document.getElementById("galleryPrevBtn")?.addEventListener("click", () => {
    const nextIndex = currentIndex <= 0 ? images.length - 1 : currentIndex - 1;
    showImage(nextIndex);
  });

  document.getElementById("galleryNextBtn")?.addEventListener("click", () => {
    const nextIndex = currentIndex >= images.length - 1 ? 0 : currentIndex + 1;
    showImage(nextIndex);
  });

  let touchStartX = 0;
  let touchEndX = 0;

  const slider = imageBox.querySelector(".product-gallery-slider");

  slider?.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  slider?.addEventListener("touchend", (e) => {
    touchEndX = e.changedTouches[0].screenX;

    const swipeDistance = touchEndX - touchStartX;

    if (Math.abs(swipeDistance) < 50) return;

    if (swipeDistance < 0) {
      const nextIndex =
        currentIndex >= images.length - 1 ? 0 : currentIndex + 1;
      showImage(nextIndex);
    } else {
      const prevIndex =
        currentIndex <= 0 ? images.length - 1 : currentIndex - 1;
      showImage(prevIndex);
    }
  });
}



function getCart() {
  return JSON.parse(localStorage.getItem("drinCart")) || [];
}

function saveCart(cartData) {
  localStorage.setItem("drinCart", JSON.stringify(cartData));
}

function updateCartCount() {
  const cartData = getCart();
  const totalQty = cartData.reduce((sum, item) => sum + safeNumber(item.quantity), 0);

  const cartCount = document.getElementById("cartCount");
  const mobileCartCount = document.getElementById("mobileCartCount");

  if (cartCount) cartCount.textContent = totalQty;
  if (mobileCartCount) mobileCartCount.textContent = totalQty;
}

function validateQuantity() {
  const stock = getProductStock(product);
  let qty = parseInt(quantityInput.value);

  if (isNaN(qty) || qty < 1) qty = 1;
  if (qty > stock) qty = stock;

  quantityInput.value = qty;
  return qty;
}

plusBtn.addEventListener("click", () => {
  const stock = getProductStock(product);
  let qty = validateQuantity();

  if (qty < stock) {
    quantityInput.value = qty + 1;
  } else {
    showMessage("Maximum stock reached.", "error");
  }
});

minusBtn.addEventListener("click", () => {
  let qty = validateQuantity();

  if (qty > 1) {
    quantityInput.value = qty - 1;
  }
});

quantityInput.addEventListener("input", validateQuantity);

addToCartBtn.addEventListener("click", () => {
  const stock = getProductStock(product);
  const qty = validateQuantity();
  const variants = getVariants(product);

  if (
    variants.length > 1 &&
    !selectedVariant
  ) {
    if (window.innerWidth <= 768) {
      openVariantPopup();
    } else {
      showMessage(
        `Please select ${product.variantTitle || "variation"}.`,
        "error"
      );

      variantContainer?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

    return;
  }

  if (stock <= 0) {
    showMessage("Out of stock.", "error");
    return;
  }

  let cartData = getCart();
  const existingItem = cartData.find(item => String(item.id) === String(product.id));

  if (existingItem) {
    const newQty = safeNumber(existingItem.quantity) + qty;

    if (newQty > stock) {
      existingItem.quantity = stock;
      showMessage("Cart updated to maximum available stock.", "error");
    } else {
      existingItem.quantity = newQty;
      showMessage("Quantity added to cart!", "success");
    }
  } else {
    cartData.push({
      id: product.id,
      name: product.name,
      price: getProductPrice(product),
      image: getProductImage(product),
      stock,
      quantity: qty
    });

    showMessage("Product added to cart!", "success");
  }

  saveCart(cartData);
  updateCartCount();
});

function showMessage(text, type) {
  message.textContent = text;
  message.style.color = type === "success" ? "#16a34a" : "#dc2626";

  setTimeout(() => {
    message.textContent = "";
  }, 2500);
}

function renderSuggestedProducts() {
  const container = document.getElementById("suggestedProducts");
  if (!container) return;

  const list = products
    .filter(p =>
      String(p.id) !== String(product.id) &&
      getProductStock(p) > 0
    )
    .slice(0, 8);

  if (!list.length) {
    container.innerHTML = `
      <div class="suggested-card">
        <h3>No suggested products yet</h3>
        <p>Add more products in admin.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => `
  <div class="homepage-product-card" onclick="openSuggestedProduct('${item.id}')">
    
    <div class="homepage-product-image">
      <img src="${getProductImage(item)}" alt="${item.name}">
    </div>

    <div class="homepage-product-info">
      <h3>${item.name}</h3>

      <div class="homepage-product-pricing">
        <span class="current-price">${formatPrice(getProductPrice(item))}</span>
      </div>

      <span class="homepage-product-stock">
        Stock: ${getProductStock(item)}
      </span>
    </div>

  </div>
`).join("");
}

function openSuggestedProduct(id) {
  localStorage.setItem("selectedProductId", id);
  window.location.href = `/Product/?id=${encodeURIComponent(id)}`;
}

// ===== SIDEBAR MENU FIX =====
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

function openSidebar() {
  sidebar.classList.add("active");
  overlay.classList.add("active");
}

function closeSidebar() {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
}

if (menuBtn) {
  menuBtn.addEventListener("click", openSidebar);
}

if (overlay) {
  overlay.addEventListener("click", closeSidebar);
}

// TITLE TOGGLE
const title = document.getElementById("productName");
const titleToggle = document.getElementById("titleToggle");

if (title && titleToggle) {
  titleToggle.addEventListener("click", () => {
    title.classList.toggle("expanded");
    title.style.webkitLineClamp = title.classList.contains("expanded") ? "unset" : "2";
    titleToggle.textContent = title.classList.contains("expanded")
      ? "Show less"
      : "Read more";
  });
}

// DESCRIPTION TOGGLE
const desc = document.getElementById("productDescription");
const descToggle = document.getElementById("descToggle");

descToggle.textContent = "Read more";

if (desc && descToggle) {
  descToggle.addEventListener("click", () => {
    desc.classList.toggle("description-limit");
    descToggle.textContent = desc.classList.contains("description-limit")
      ? "Read more"
      : "Show less";
  });
}

async function loadProductVouchers() {

  const voucherList = document.getElementById("voucherList");
  const voucherSection = document.querySelector(".voucher-section");

  if (!voucherList) return;

  const { data, error } = await supabaseClient
    .from("vouchers")
    .select("*")
    .eq("is_active", true)
    .eq("voucher_type", "regular")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    voucherList.innerHTML = "";
    if (voucherSection) voucherSection.style.display = "none";
    return;
  }

  if (voucherSection) voucherSection.style.display = "block";

  voucherList.innerHTML = data.map((voucher, index) => {

    const amount = Number(voucher.discount_amount || 0).toLocaleString();

    const minSpend = Number(voucher.min_spend || 0).toLocaleString();

    const code = voucher.code || "DRIN";

    return `
      <div class="voucher-card ${index === 0 ? "active" : ""}">
        
        <strong>₱${amount} OFF</strong>

        <span>Min. spend ₱${minSpend}</span>

        <button onclick="claimProductVoucher('${code}', this)">
          Claim
        </button>

      </div>
    `;
  }).join("");

  enableVoucherDragSwipe();

}

function claimProductVoucher(code, btn) {

  localStorage.setItem("claimedVoucherCode", code);

  document.querySelectorAll(".voucher-card")
    .forEach(card => card.classList.remove("active"));

  btn.closest(".voucher-card")
    .classList.add("active");

  alert(`Voucher ${code} claimed!`);
}

// DESKTOP + MOBILE VOUCHER DRAG SWIPE
function enableVoucherDragSwipe() {
  const slider = document.getElementById("voucherList");
  if (!slider) return;

  let isDown = false;
  let startX;
  let scrollLeft;

  slider.addEventListener("mousedown", (e) => {
    isDown = true;
    slider.classList.add("dragging");
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });

  slider.addEventListener("mouseleave", () => {
    isDown = false;
    slider.classList.remove("dragging");
  });

  slider.addEventListener("mouseup", () => {
    isDown = false;
    slider.classList.remove("dragging");
  });

  slider.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();

    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5;

    slider.scrollLeft = scrollLeft - walk;
  });
}

function scrollVoucher(direction) {

  const voucherList = document.getElementById("voucherList");

  if (!voucherList) return;

  const scrollAmount = 300;

  voucherList.scrollBy({
    left: direction * scrollAmount,
    behavior: "smooth"
  });
}

const protectionToggle = document.getElementById("protectionToggle");
const protectionMore = document.getElementById("protectionMore");

if (protectionToggle && protectionMore) {
  protectionToggle.addEventListener("click", () => {
    protectionMore.classList.toggle("show");

    protectionToggle.textContent =
      protectionMore.classList.contains("show")
        ? "Show Less"
        : "Read More";
  });
}

let variantPopup;
let variantPopupOptions;

function openVariantPopup() {

  variantPopup =
    document.getElementById("variantPopup");

  variantPopupOptions =
    document.getElementById("variantPopupOptions");

  if (window.innerWidth > 768) return;

  const variants = getVariants(product);

  if (!variants.length) return;

  document.getElementById("variantPopupName").textContent =
    product.name;

  document.getElementById("variantPopupTitle").textContent =
    product.variantTitle || "Variation";

  document.getElementById("variantPopupImage").src =
    getProductImage(product);

  document.getElementById("variantPopupPrice").textContent =
    formatPrice(getProductPrice(product));

  document.getElementById("variantPopupStock").textContent =
    `Stock: ${getProductStock(product)}`;

  variantPopupOptions.innerHTML = variants.map((variant, index) => `
    <button
      type="button"
      class="variant-popup-option ${safeNumber(variant.stock) <= 0 ? "out-of-stock" : ""}"
      data-index="${index}"
    >
      ${variant.label}
    </button>
  `).join("");

  variantPopup.classList.add("show");

  variantPopupOptions
    .querySelectorAll(".variant-popup-option")
    .forEach((btn) => {

      btn.addEventListener("click", function () {

        const variant =
          variants[Number(this.dataset.index)];

        if (!variant) return;

        if (safeNumber(variant.stock) <= 0) return;

        variantPopupOptions
          .querySelectorAll(".variant-popup-option")
          .forEach(item =>
            item.classList.remove("active")
          );

        this.classList.add("active");

        selectedVariant = variant;

        document.getElementById("variantPopupImage").src =
          variant.image || getProductImage(product);

        document.getElementById("variantPopupPrice").textContent =
          formatPrice(
            safeNumber(variant.discountPrice) > 0
              ? variant.discountPrice
              : variant.price
          );

        document.getElementById("variantPopupStock").textContent =
          `Stock: ${variant.stock}`;
      });

    });
}

document
  .getElementById("closeVariantPopup")
  ?.addEventListener("click", () => {

    document
      .getElementById("variantPopup")
      ?.classList.remove("show");

  });