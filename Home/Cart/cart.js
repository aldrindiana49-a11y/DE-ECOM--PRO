function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("drinCart")) || [];

  const totalItems = cart.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0);
  }, 0);

  const badge = document.getElementById("cartCount");

  if (badge) {
    badge.textContent = totalItems;
  }
}

const cartList = document.getElementById("cartList");
const cartTotal = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const selectedCount = document.getElementById("selectedCount");

let cart = JSON.parse(localStorage.getItem("drinCart")) || [];

function safeText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(text) {
  return String(text ?? "").replaceAll('"', "&quot;");
}

function formatPrice(value) {
  return `₱${safeNumber(value, 0).toLocaleString("en-PH")}`;
}

function saveCart() {
  localStorage.setItem("drinCart", JSON.stringify(cart));
  updateCartCount();
}

function getProducts() {
  return JSON.parse(localStorage.getItem("drinProducts")) || [];
}

function getProductStock(productId, cartItem = null) {
  const products = getProducts();
  const product = products.find((item) => String(item.id) === String(productId));

  if (product) {
    return safeNumber(product.stock, -1);
  }

  if (cartItem && cartItem.stock !== undefined) {
    return safeNumber(cartItem.stock, -1);
  }

  return -1;
}

function clampQty(productId, qty, cartItem = null) {
  const stock = getProductStock(productId, cartItem);

  if (qty < 0) return 0;
  if (stock === -1) return qty;
  if (qty > stock) return stock;

  return qty;
}

function getSelectedCart() {
  return cart.filter((item) => {
    return item.selected && Number(item.quantity) > 0;
  });
}

function renderCart() {
  if (!cartList || !cartTotal) return;

  cartList.innerHTML = "";

  if (!Array.isArray(cart) || cart.length === 0) {
    cartList.innerHTML = `
      <div class="empty-cart">
        <h3>Your cart is empty</h3>
        <p>Add products first before checkout.</p>
        <a href="../Home/index.html">Go back to shop</a>
      </div>
    `;

    cartTotal.textContent = "₱0";

    if (selectedCount) selectedCount.textContent = "0";
    if (checkoutBtn) checkoutBtn.disabled = true;

    return;
  }

  let totalAmount = 0;

  cart.forEach((item, index) => {
    if (item.selected === undefined) {
      item.selected = true;
    }

    const stock = getProductStock(item.productId, item);

    let quantity = safeNumber(item.quantity, 1);
    quantity = clampQty(item.productId, quantity, item);
    cart[index].quantity = quantity;

    const isZeroQty = quantity === 0;
    const isOutOfStock = stock === 0;

    if (isZeroQty || isOutOfStock) {
      cart[index].selected = false;
      item.selected = false;
    }

    const price = safeNumber(item.price, 0);
    const itemTotal = quantity * price;

    if (item.selected && quantity > 0) {
      totalAmount += itemTotal;
    }

    const card = document.createElement("div");
    card.className = `cart-item ${item.selected ? "selected" : "unselected"} ${isZeroQty || isOutOfStock ? "unavailable" : ""
      }`;

    card.innerHTML = `
      <div class="cart-check">
        <input
          type="checkbox"
          ${item.selected ? "checked" : ""}
          ${isZeroQty || isOutOfStock ? "disabled" : ""}
          onchange="toggleSelect(${index})"
        />
      </div>

      <div class="cart-item-image">
        <img
          src="${escapeAttribute(safeText(item.image, "https://via.placeholder.com/300x300?text=No+Image"))}"
          alt="${escapeHtml(safeText(item.name, "Product"))}"
          onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'"
        />
      </div>

      <div class="cart-item-info">
        <span class="cart-item-category">${escapeHtml(safeText(item.category, "General"))}</span>
        <h3 class="cart-item-title">${escapeHtml(safeText(item.name, "Unnamed Product"))}</h3>
        <p class="cart-item-price">${formatPrice(price)}</p>

        <p class="cart-item-stock ${isOutOfStock ? "out-stock" : stock !== -1 && quantity >= stock ? "max-stock" : ""
      }">
  ${isZeroQty
        ? "Qty is 0"
        : isOutOfStock
          ? "Out of stock"
          : stock !== -1 && quantity >= stock
            ? "Maximum stock reached"
            : stock === -1
              ? "Stock: Available"
              : "Stock: " + stock
      }
</p>

        <div class="cart-item-actions">
          <div class="qty-box">
            <button
              type="button"
              onclick="decreaseQty(${index})"
              ${isZeroQty ? "disabled" : ""}
            >
              −
            </button>

            <input
              type="number"
              class="qty-input"
              value="${quantity}"
              min="0"
              ${stock === -1 ? "" : `max="${stock}"`}
              oninput="manualQty(${index}, this.value)"
            />

            <button
              type="button"
              onclick="increaseQty(${index})"
              ${stock !== -1 && quantity >= stock ? "disabled" : ""}
            >
              +
            </button>
          </div>

          <div class="item-total">${formatPrice(itemTotal)}</div>

          <button type="button" class="remove-btn" onclick="removeItem(${index})">
            Remove
          </button>
        </div>
      </div>
    `;

    cartList.appendChild(card);
  });

  saveCart();
  cartTotal.textContent = formatPrice(totalAmount);

  const selectedItems = getSelectedCart();

  if (selectedCount) {
    selectedCount.textContent = selectedItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0);
    }, 0);
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = selectedItems.length === 0;
  }

  const selectAll = document.getElementById("selectAll");
  if (selectAll) {
    const selectableItems = cart.filter((item) => {
      const qty = Number(item.quantity) || 0;
      const stock = getProductStock(item.productId, item);
      return qty > 0 && stock !== 0;
    });

    selectAll.checked =
      selectableItems.length > 0 &&
      selectedItems.length === selectableItems.length;
  }
}

function toggleSelect(index) {
  if (!cart[index]) return;

  const qty = safeNumber(cart[index].quantity, 0);
  const stock = getProductStock(cart[index].productId, cart[index]);

  if (qty <= 0 || stock === 0) {
    cart[index].selected = false;
    saveCart();
    renderCart();
    return;
  }

  cart[index].selected = !cart[index].selected;
  saveCart();
  renderCart();
}

function toggleSelectAll(checkbox) {
  cart.forEach((item) => {
    const qty = Number(item.quantity) || 0;
    const stock = getProductStock(item.productId, item);

    item.selected = checkbox.checked && qty > 0 && stock !== 0;
  });

  saveCart();
  renderCart();
}

function increaseQty(index) {
  if (!cart[index]) return;

  const currentQty = safeNumber(cart[index].quantity, 0);
  const stock = getProductStock(cart[index].productId, cart[index]);

  if (stock !== -1 && currentQty >= stock) return;

  cart[index].quantity = currentQty + 1;

  if (cart[index].quantity > 0 && stock !== 0) {
    cart[index].selected = true;
  }

  saveCart();
  renderCart();
}

function decreaseQty(index) {
  if (!cart[index]) return;

  const currentQty = safeNumber(cart[index].quantity, 0);

  if (currentQty > 0) {
    cart[index].quantity = currentQty - 1;
  }

  if (cart[index].quantity <= 0) {
    cart[index].quantity = 0;
    cart[index].selected = false;
  }

  saveCart();
  renderCart();
}

function manualQty(index, value) {
  if (!cart[index]) return;

  let qty = safeNumber(value, 0);
  qty = clampQty(cart[index].productId, qty, cart[index]);

  cart[index].quantity = qty;

  const stock = getProductStock(cart[index].productId, cart[index]);

  if (qty <= 0 || stock === 0) {
    cart[index].selected = false;
  }

  saveCart();
  renderCart();
}

let lastRemovedItem = null;
let lastRemovedIndex = null;
let undoTimer = null;

function removeItem(index) {
  if (!cart[index]) return;

  const itemCard = document.querySelectorAll(".cart-item")[index];

  if (itemCard) {
    itemCard.classList.add("removing");
  }

  lastRemovedItem = { ...cart[index] };
  lastRemovedIndex = index;

  setTimeout(() => {
    cart.splice(index, 1);
    saveCart();
    renderCart();
    showUndoToast(lastRemovedItem.name || "Item");
  }, 250);
}

function showUndoToast(itemName) {
  const toast = document.getElementById("cartToast");
  const toastText = document.getElementById("cartToastText");

  if (!toast || !toastText) return;

  toastText.textContent = `${itemName} removed`;
  toast.classList.add("show");

  clearTimeout(undoTimer);

  undoTimer = setTimeout(() => {
    toast.classList.remove("show");
    lastRemovedItem = null;
    lastRemovedIndex = null;
  }, 4000);
}

function undoRemove() {
  if (!lastRemovedItem || lastRemovedIndex === null) return;

  cart.splice(lastRemovedIndex, 0, lastRemovedItem);
  saveCart();
  renderCart();

  const toast = document.getElementById("cartToast");
  if (toast) toast.classList.remove("show");

  lastRemovedItem = null;
  lastRemovedIndex = null;
  clearTimeout(undoTimer);
}

function goToCheckout() {
  const selectedItems = getSelectedCart();

  if (selectedItems.length === 0) {
    alert("Please select at least one item to checkout.");
    return;
  }

  localStorage.setItem("drinCheckoutItems", JSON.stringify(selectedItems));
  window.location.href = "../Checkout/checkout.html";
}

renderCart();

window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;
window.manualQty = manualQty;
window.removeItem = removeItem;
window.goToCheckout = goToCheckout;
window.toggleSelect = toggleSelect;
window.toggleSelectAll = toggleSelectAll;
window.undoRemove = undoRemove;