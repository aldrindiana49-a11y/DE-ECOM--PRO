const fullName = document.getElementById("fullName");
const contactNumber = document.getElementById("contactNumber");
const province = document.getElementById("province");
const city = document.getElementById("city");
const barangay = document.getElementById("barangay");
const streetAddress = document.getElementById("streetAddress");
const postalCode = document.getElementById("postalCode");

const wishlistGrid = document.getElementById("profileWishlistGrid");
const wishlistLoading = document.getElementById("profileWishlistLoading");
const wishlistEmpty = document.getElementById("profileWishlistEmpty");
const wishlistCount = document.getElementById("wishlistCount");

let currentUser = null;
let wishlistProducts = [];

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPrice(value) {
  return `₱${safeNumber(value).toLocaleString()}`;
}

function getProductVariations(product) {
  if (Array.isArray(product?.variations)) {
    return product.variations;
  }

  if (Array.isArray(product?.variants)) {
    return product.variants;
  }

  return [];
}

function getBestVariation(product) {
  const variations = getProductVariations(product);

  if (!variations.length) return null;

  return (
    variations.find(variation => safeNumber(variation.stock) > 0) ||
    variations[0]
  );
}

function getProductPrice(product) {
  const variation = getBestVariation(product);

  const regularPrice = safeNumber(
    variation?.price ?? product?.price
  );

  const discountPrice = safeNumber(
    variation?.discountPrice ??
    variation?.discount_price ??
    product?.discount_price ??
    product?.discountPrice
  );

  if (
    discountPrice > 0 &&
    discountPrice < regularPrice
  ) {
    return discountPrice;
  }

  return regularPrice;
}

function getProductStock(product) {
  const variations = getProductVariations(product);

  if (variations.length) {
    return variations.reduce(
      (total, variation) =>
        total + safeNumber(variation.stock),
      0
    );
  }

  return safeNumber(product?.stock);
}

function getProductImage(product) {
  const variation = getBestVariation(product);

  return (
    variation?.image ||
    product?.image ||
    "https://via.placeholder.com/300x300?text=No+Image"
  );
}

function getProductName(product) {
  return product?.title || product?.name || "Unnamed Product";
}

function updateWishlistCount(total) {
  if (!wishlistCount) return;

  wishlistCount.textContent =
    `${total} ${total === 1 ? "item" : "items"}`;
}

function showWishlistState(state) {
  if (wishlistLoading) {
    wishlistLoading.style.display =
      state === "loading" ? "block" : "none";
  }

  if (wishlistEmpty) {
    wishlistEmpty.style.display =
      state === "empty" ? "block" : "none";
  }

  if (wishlistGrid) {
    wishlistGrid.style.display =
      state === "ready" ? "grid" : "none";
  }
}

async function loadProfile() {
  const {
    data: { session },
    error: sessionError
  } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("Profile session error:", sessionError);
  }

  currentUser = session?.user || null;

  if (!currentUser) {
    window.location.href =
      `../login/?redirect=${encodeURIComponent(window.location.href)}`;
    return;
  }
 
  if (!currentUser) {
    showWishlistState("empty");
    updateWishlistCount(0);

    return;
  }

  await Promise.all([
    loadProfileDetails(),
    loadWishlist()
  ]);
}

async function loadProfileDetails() {
  if (!currentUser) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile loading error:", error);
    return;
  }

  if (!data) return;

  if (fullName) {
    fullName.value = data.full_name || "";
    fullName.disabled = true;
  }

  if (contactNumber) {
    contactNumber.value = data.contact_number || "";
    contactNumber.disabled = true;
  }

  if (province) {
    province.value = data.province || "";
    province.disabled = true;
  }

  if (city) {
    city.value = data.city || "";
    city.disabled = true;
  }

  if (barangay) {
    barangay.value = data.barangay || "";
    barangay.disabled = true;
  }

  if (streetAddress) {
    streetAddress.value = data.street_address || "";
    streetAddress.disabled = true;
  }

  if (postalCode) {
    postalCode.value = data.postal_code || "";
    postalCode.disabled = true;
  }
}

async function loadWishlist() {
  if (!currentUser || !wishlistGrid) return;

  showWishlistState("loading");

  const { data: wishlistRows, error: wishlistError } =
    await supabaseClient
      .from("wishlists")
      .select("product_id, created_at")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

  if (wishlistError) {
    console.error("Wishlist loading error:", wishlistError);

    showWishlistState("empty");
    updateWishlistCount(0);
    return;
  }

  if (!wishlistRows?.length) {
    wishlistProducts = [];
    wishlistGrid.innerHTML = "";

    showWishlistState("empty");
    updateWishlistCount(0);
    return;
  }

  const productIds = wishlistRows.map(row =>
    String(row.product_id)
  );

  const { data: products, error: productsError } =
    await supabaseClient
      .from("products")
      .select("*")
      .in("id", productIds);

  if (productsError) {
    console.error(
      "Wishlist products loading error:",
      productsError
    );

    showWishlistState("empty");
    updateWishlistCount(0);
    return;
  }

  const productMap = new Map(
    (products || []).map(product => [
      String(product.id),
      product
    ])
  );

  wishlistProducts = productIds
    .map(id => productMap.get(String(id)))
    .filter(Boolean);

  renderWishlistProducts();
}

function renderWishlistProducts() {
  if (!wishlistGrid) return;

  if (!wishlistProducts.length) {
    wishlistGrid.innerHTML = "";

    showWishlistState("empty");
    updateWishlistCount(0);
    return;
  }

  updateWishlistCount(wishlistProducts.length);
  showWishlistState("ready");

  wishlistGrid.innerHTML = wishlistProducts
    .map(product => {
      const productId = String(product.id);
      const name = getProductName(product);
      const image = getProductImage(product);
      const price = getProductPrice(product);
      const stock = getProductStock(product);

      return `
        <article
          class="wishlist-product-card"
          data-product-id="${productId}"
        >

          <button
            type="button"
            class="wishlist-remove-btn"
            data-product-id="${productId}"
            aria-label="Remove from wishlist"
            title="Remove from Wishlist"
          >
            ♥
          </button>

          <button
            type="button"
            class="wishlist-product-link"
            data-product-id="${productId}"
          >
            <div class="wishlist-product-image">
              <img
                src="${image}"
                alt="${name}"
                loading="lazy"
              >
            </div>

            <div class="wishlist-product-info">

              <h3>${name}</h3>

              <strong class="wishlist-product-price">
                ${formatPrice(price)}
              </strong>

              <span
                class="wishlist-product-stock ${stock <= 0 ? "out-of-stock" : ""
        }"
              >
                ${stock > 0
          ? `Stock: ${stock} available`
          : "Out of stock"
        }
              </span>

            </div>
          </button>

          <button
            type="button"
            class="wishlist-add-cart-btn"
            data-product-id="${productId}"
            ${stock <= 0 ? "disabled" : ""}
          >
            ${stock > 0
          ? "🛒 Add to Cart"
          : "Out of Stock"
        }
          </button>

        </article>
      `;
    })
    .join("");
}

function openWishlistProduct(productId) {
  const product = wishlistProducts.find(
    item => String(item.id) === String(productId)
  );

  if (product) {
    localStorage.setItem(
      "selectedProduct",
      JSON.stringify(product)
    );

    localStorage.setItem(
      "selectedProductId",
      String(product.id)
    );
  }

  window.location.href =
    `../Product/index.html?id=${encodeURIComponent(productId)}`;
}

function addWishlistProductToCart(productId) {
  const product = wishlistProducts.find(
    item => String(item.id) === String(productId)
  );

  if (!product) return;

  const variations = getProductVariations(product);

  const realVariations = variations.filter(
    variation =>
      variation?.label &&
      variation.label !== "Default"
  );

  // Kapag may choices, papuntahin muna sa product page.
  if (realVariations.length > 1) {
    openWishlistProduct(productId);
    return;
  }

  const stock = getProductStock(product);

  if (stock <= 0) {
    showProfileToast("Product is out of stock.", "error");
    return;
  }

  const variation = getBestVariation(product);
  const variantLabel =
    variation?.label === "Default"
      ? ""
      : variation?.label || "";

  const productImage = getProductImage(product);
  const productPrice = getProductPrice(product);

  const cart = JSON.parse(
    localStorage.getItem("drinCart") || "[]"
  );

  const existingItem = cart.find(item =>
    String(item.id) === String(product.id) &&
    String(item.variantLabel || "") ===
    String(variantLabel)
  );

  if (existingItem) {
    if (safeNumber(existingItem.quantity) >= stock) {
      showProfileToast(
        "Maximum available stock reached.",
        "error"
      );
      return;
    }

    existingItem.quantity =
      safeNumber(existingItem.quantity) + 1;

    existingItem.selected = true;
  } else {
    cart.push({
      allow_cod: product.allow_cod,
      id: product.id,
      name: getProductName(product),
      variantLabel,
      price: productPrice,
      image: productImage,
      product_image: product.image,
      variant_image: variation?.image || productImage,
      stock,
      quantity: 1,
      selected: true,
      weight: safeNumber(
        variation?.weight ?? product.weight,
        0.01
      ),
      length: safeNumber(
        variation?.length ?? product.length,
        1
      ),
      width: safeNumber(
        variation?.width ?? product.width,
        1
      ),
      height: safeNumber(
        variation?.height ?? product.height,
        1
      )
    });
  }

  localStorage.setItem(
    "drinCart",
    JSON.stringify(cart)
  );

  showProfileToast(
    "Product added to cart!",
    "success"
  );
}

async function removeWishlistProduct(productId) {
  if (!currentUser) return;

  const card = wishlistGrid?.querySelector(
    `[data-product-id="${CSS.escape(String(productId))}"]`
  );

  const { error } = await supabaseClient
    .from("wishlists")
    .delete()
    .eq("user_id", currentUser.id)
    .eq("product_id", String(productId));

  if (error) {
    console.error("Remove wishlist error:", error);

    showProfileToast(
      "Unable to remove product.",
      "error"
    );

    return;
  }

  card?.classList.add("removing");

  setTimeout(() => {
    wishlistProducts = wishlistProducts.filter(
      product =>
        String(product.id) !== String(productId)
    );

    renderWishlistProducts();

    showProfileToast(
      "Removed from wishlist.",
      "success"
    );
  }, 200);
}

function showProfileToast(text, type = "success") {
  let toast = document.getElementById("profileToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "profileToast";
    toast.className = "profile-toast";

    document.body.appendChild(toast);
  }

  toast.textContent = text;

  toast.classList.remove("success", "error", "show");
  toast.classList.add(type, "show");

  clearTimeout(toast.hideTimer);

  toast.hideTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

document.addEventListener("click", event => {
  const removeButton =
    event.target.closest(".wishlist-remove-btn");

  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();

    removeWishlistProduct(
      removeButton.dataset.productId
    );

    return;
  }

  const addCartButton =
    event.target.closest(".wishlist-add-cart-btn");

  if (addCartButton) {
    event.preventDefault();
    event.stopPropagation();

    addWishlistProductToCart(
      addCartButton.dataset.productId
    );

    return;
  }

  const productLink =
    event.target.closest(".wishlist-product-link");

  if (productLink) {
    openWishlistProduct(
      productLink.dataset.productId
    );
  }
});

loadProfile();