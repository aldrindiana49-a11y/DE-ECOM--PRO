const SUPABASE_URL = "https://zdinvxowzpkolbfzpcac.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
const checkoutItems = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutShippingFee = document.getElementById("checkoutShippingFee");
const checkoutTotal = document.getElementById("checkoutTotal");
const shippingStatus = document.getElementById("shippingStatus");
const parcelEstimate = document.getElementById("parcelEstimate");
const shippingRow = document.querySelector(".shipping-row");
const areaGroupSelect = document.getElementById("areaGroup");
const provinceSelect = document.getElementById("province");
const citySelect = document.getElementById("city");
const barangaySelect = document.getElementById("barangay");
const fullAddressInput = document.getElementById("fullAddress");
const courierSelect = document.getElementById("courierSelect");
const courierStatus = document.getElementById("courierStatus");
const nameInput = document.getElementById("custName");
const phoneInput = document.getElementById("custPhone");

const API_BASE_URL = "https://de-ecom-pro.onrender.com";


let cartItems = JSON.parse(localStorage.getItem("drinCheckoutItems")) || [];

function redirectIfNoCheckoutItems() {
  const items = JSON.parse(localStorage.getItem("drinCheckoutItems")) || [];

  if (!items.length) {
    window.location.replace("../index.html");
  }
}

redirectIfNoCheckoutItems();

window.addEventListener("pageshow", function () {
  redirectIfNoCheckoutItems();
});


let currentShippingFee = null;
const HANDLING_FEE = 25;
let currentShippingQuote = null;
let currentParcelInfo = null;
let shippingQuoteTimer = null;
let selectedCourier = "";
let claimedVoucher = null;
let voucherDiscount = 0;
let SPX_ADDRESSES = [];
let ADDRESS_DATA = {};

const AREA_GROUPS = ["Metro Manila", "North Luzon", "South Luzon", "Visayas", "Mindanao"];

async function loadSPXAddresses() {
  const res = await fetch("spx-addresses.json");

  SPX_ADDRESSES = await res.json();

  ADDRESS_DATA = {};

  SPX_ADDRESSES.forEach((row) => {

    const province =
      row.state === "Metro Manila"
        ? row.district
        : row.city;

    const city = row.district;

    const barangay = row.street;

    if (!ADDRESS_DATA[province]) {
      ADDRESS_DATA[province] = {
        areaGroup: row.state,
        cities: {}
      };
    }

    if (!ADDRESS_DATA[province].cities[city]) {
      ADDRESS_DATA[province].cities[city] = {
        zip: "",
        barangays: [],
        couriers: [
          "SPX",
          "Same Day Delivery / Lalamove",
        ]
      };
    }

    ADDRESS_DATA[province].cities[city].barangays.push(barangay);

  });
}

function cleanPrice(value) {
  return Number(String(value || "0").replace(/[^\d.]/g, "")) || 0;
}

function cleanQty(value) {
  return Number(value) || 1;
}

function formatPrice(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH")}`;
}

function safeText(value, fallback = "") {
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function resetSelect(select, label = "- choose -") {
  if (!select) return;
  select.innerHTML = `<option value="">${label}</option>`;
}

function getCheckoutTotal() {
  return cartItems.reduce((sum, item) => {
    return sum + cleanPrice(item.price) * cleanQty(item.quantity);
  }, 0);
}

function getItemWeight(item) {
  return Number(
    item.weight ??
    item.parcel_weight ??
    item.shippingWeight ??
    0.01
  );
}

function getItemLength(item) {
  return Number(
    item.length ??
    item.parcel_length ??
    item.shippingLength ??
    1
  );
}

function getItemWidth(item) {
  return Number(
    item.width ??
    item.parcel_width ??
    item.shippingWidth ??
    1
  );
}

function getItemHeight(item) {
  return Number(
    item.height ??
    item.parcel_height ??
    item.shippingHeight ??
    1
  );
}

function calculateParcelInfo(items = cartItems) {
  if (!items.length) {
    return {
      parcelWeight: 0,
      parcelLength: 0,
      parcelWidth: 0,
      parcelHeight: 0,
      itemQuantity: 0,
      itemName: "Electronics",
      itemType: "Electronics",
    };
  }

  let totalWeight = 0;
  let totalQuantity = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let stackedHeight = 0;

  items.forEach((item) => {

    const quantity = cleanQty(item.quantity);

    if (quantity > 50) {
      showOrderModal(
        "Quantity Limit",
        "Maximum 50 pcs only per SKU / variation."
      );

      throw new Error("SKU quantity limit exceeded");
    }

    totalQuantity += quantity;
    const actualWeight =
      getItemWeight(item) * quantity;

    const volumetricWeight =
      (
        getItemLength(item) *
        getItemWidth(item) *
        getItemHeight(item)
      ) / 3500 * quantity;

    totalWeight += Math.max(
      actualWeight,
      volumetricWeight
    );
    maxLength = Math.max(maxLength, getItemLength(item));
    maxWidth = Math.max(maxWidth, getItemWidth(item));
    stackedHeight += getItemHeight(item) * quantity;
  });

  return {
    parcelWeight: Number(Math.max(totalWeight, 0.1).toFixed(2)),
    parcelLength: Number(Math.max(maxLength, 1).toFixed(2)),
    parcelWidth: Number(Math.max(maxWidth, 1).toFixed(2)),
    parcelHeight: Number(Math.max(Math.min(stackedHeight, 149), 1).toFixed(2)),
    itemQuantity: totalQuantity,
    itemName: items[0]?.name || "Electronics",
    itemType: "Electronics",
  };
}

function updateParcelEstimate() {
  currentParcelInfo = calculateParcelInfo();


  if (!parcelEstimate) return;

  if (!cartItems.length) {
    parcelEstimate.textContent = "No parcel data yet";
    return;
  }

  parcelEstimate.textContent = `${currentParcelInfo.parcelWeight}kg • ${currentParcelInfo.parcelLength}×${currentParcelInfo.parcelWidth}×${currentParcelInfo.parcelHeight}cm`;
}

function setShippingUI(status, message, fee = null) {
  if (shippingRow) {
    shippingRow.classList.remove("loading", "ready", "failed");
    if (status) shippingRow.classList.add(status);
  }

  if (shippingStatus) shippingStatus.textContent = message;
  if (checkoutShippingFee) checkoutShippingFee.textContent = fee === null ? "To be confirmed" : formatPrice(fee);

  updateTotalsDisplay();

  if (checkoutBtn) {

    checkoutBtn.disabled = false;
    checkoutBtn.style.pointerEvents = "auto";
    checkoutBtn.style.opacity = "1";

  }
}

function updateTotalsDisplay() {

  const subtotal =
    getCheckoutTotal();

  const voucherRow =
    document.getElementById(
      "voucherSummaryRow"
    );

  const voucherLabel =
    document.getElementById(
      "voucherSummaryLabel"
    );

  const voucherAmount =
    document.getElementById(
      "voucherSummaryAmount"
    );

  voucherDiscount = 0;

  if (
    claimedVoucher &&
    subtotal >= Number(claimedVoucher.min_spend || 0)
  ) {

    voucherDiscount =
      Number(
        claimedVoucher.discount_amount || 0
      );

    if (voucherRow) {
      voucherRow.style.display = "flex";
    }

    if (voucherLabel) {
      voucherLabel.textContent =
        `Voucher (${claimedVoucher.code})`;
    }

    if (voucherAmount) {
      voucherAmount.textContent =
        `-₱${voucherDiscount.toLocaleString()}`;
    }

  } else {

    if (voucherRow) {
      voucherRow.style.display = "none";
    }

  }

  const grandTotal =
    subtotal -
    voucherDiscount +
    (Number(currentShippingFee) || 0) +
    HANDLING_FEE;

  if (checkoutSubtotal) {

    checkoutSubtotal.textContent =
      formatPrice(subtotal);
  }

  if (checkoutTotal) {

    checkoutTotal.textContent =
      formatPrice(grandTotal);
  }
}

function renderCheckout() {
  if (!checkoutItems || !checkoutTotal) return;

  if (!cartItems.length) {
    checkoutItems.innerHTML = `<p>No selected items.</p>`;
    currentShippingFee = null;
    currentShippingQuote = null;
    updateParcelEstimate();
    updateTotalsDisplay();
    setShippingUI("failed", "No items to ship", null);
    return;
  }

  checkoutItems.innerHTML = "";

  cartItems.forEach((item) => {
    const price = cleanPrice(item.price);
    const quantity = cleanQty(item.quantity);

    const itemTotal = price * quantity;

    const div = document.createElement("div");
    div.className = "checkout-item";

    div.innerHTML = `
  <div class="co-item">
    <img src="${safeText(item.image, "https://via.placeholder.com/100")}" />

    <div>
      <h4>${safeText(item.name, "Product")}</h4>

      ${item.variantLabel
        ? `<p class="checkout-variant">Variation: ${safeText(item.variantLabel)}</p>`
        : ""
      }

      <p>Qty: ${quantity}</p>
      <p>${formatPrice(itemTotal)}</p>
    </div>
  </div>
`;

    checkoutItems.appendChild(div);
  });

  updateParcelEstimate();
  updateTotalsDisplay();
}

function loadAreaGroups() {
  resetSelect(areaGroupSelect);
  AREA_GROUPS.forEach((group) => {
    const opt = document.createElement("option");
    opt.value = group;
    opt.textContent = group;
    areaGroupSelect.appendChild(opt);
  });
}

function loadProvinces() {
  resetSelect(provinceSelect);
  resetSelect(citySelect);
  resetSelect(barangaySelect);
  resetSelect(courierSelect);

  selectedCourier = "";
  currentShippingFee = null;
  currentShippingQuote = null;

  const selectedArea = areaGroupSelect.value;

  const provinces = Object.keys(ADDRESS_DATA)
    .filter((province) => ADDRESS_DATA[province].areaGroup === selectedArea)
    .sort((a, b) => a.localeCompare(b));

  provinces.forEach((province) => {
    const opt = document.createElement("option");
    opt.value = province;
    opt.textContent = province;
    provinceSelect.appendChild(opt);
  });

  updateCourierOptions();
}

function loadCities() {
  resetSelect(citySelect);
  resetSelect(barangaySelect);
  resetSelect(courierSelect);

  selectedCourier = "";
  currentShippingFee = null;
  currentShippingQuote = null;

  const province = provinceSelect.value;
  const cities = ADDRESS_DATA[province]?.cities || {};

  Object.keys(cities)
    .sort((a, b) => a.localeCompare(b))
    .forEach((city) => {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city;
      citySelect.appendChild(opt);
    });

  updateCourierOptions();
}

function loadBarangays() {
  resetSelect(barangaySelect);
  resetSelect(courierSelect);

  selectedCourier = "";
  currentShippingFee = null;
  currentShippingQuote = null;

  const province = provinceSelect.value;
  const city = citySelect.value;
  const cityData = ADDRESS_DATA[province]?.cities?.[city];

  (cityData?.barangays || []).forEach((barangay) => {
    const opt = document.createElement("option");
    opt.value = barangay;
    opt.textContent = barangay;
    barangaySelect.appendChild(opt);
  });

  updateCourierOptions();
}

function updateCourierOptions() {
  const currentValue = courierSelect?.value || "";

  resetSelect(courierSelect);

  ["SPX", "Same Day Delivery / Lalamove"].forEach((courier) => {
    const opt = document.createElement("option");
    opt.value = courier;
    opt.textContent = courier;
    courierSelect.appendChild(opt);
  });

  if (currentValue) {
    courierSelect.value = currentValue;
    selectedCourier = currentValue;
  }

  if (courierStatus) {
    courierStatus.textContent = selectedCourier
      ? `${selectedCourier} selected`
      : "Please select courier";
  }
}

function showOrderModal(title, message, showLoader = false) {
  const modal = document.getElementById("orderModal");
  const modalTitle = document.getElementById("orderModalTitle");
  const modalMessage = document.getElementById("orderModalMessage");

  if (!modal || !modalTitle || !modalMessage) {
    alert(`${title}: ${message}`);
    return;
  }

  modalTitle.textContent = title;
  modalMessage.innerHTML = showLoader
    ? `<div class="payment-loader"></div><p>${message}</p>`
    : `<p>${message}</p>`;

  // DISABLE CLOSE
  modal.onclick = null;

  const okBtn = document.getElementById("orderModalOk");
  const closeBtn = document.getElementById("orderModalClose");

  if (okBtn) {
    okBtn.style.display = showLoader ? "none" : "inline-block";
    okBtn.onclick = closeOrderModal;
  }

  if (closeBtn) {
    closeBtn.style.display = showLoader ? "none" : "inline-block";
  }

  modal.classList.add("show");
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (modal) modal.classList.remove("show");
}

function togglePayment() { }

if (nameInput) {
  nameInput.addEventListener("input", () => {
    nameInput.value = nameInput.value.replace(/[^a-zA-Z\s]/g, "");
  });
}

if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "");
  });
}

function cleanImageForOrder(image) {
  const img = String(image || "");

  if (img.startsWith("data:")) {
    return "";
  }

  return img;
}

function normalizeOrderItems(items) {
  return items.map((item) => {
    const orderImage = cleanImageForOrder(
      item.variant_image ||
      item.variantImage ||
      item.product_image ||
      item.productImage ||
      item.image ||
      item.img ||
      item.photo ||
      ""
    );

    return {

      id: item.id || item.productId,
      productId: item.productId || item.id,
      name: item.name || item.product_name || item.title || "Product",
      quantity: item.quantity || item.qty || 1,
      price: item.price || 0,

      image: orderImage,
      variant_image: orderImage,
      product_image: orderImage,

      sku: item.sku || "",
      variant:
        item.variantLabel ||
        item.variant ||
        item.variation ||
        item.variant_name ||
        item.variantName ||
        item.option ||
        item.option_name ||
        item.selected_variant ||
        item.selectedVariation ||
        item.label ||
        "",
      variantLabel:
        item.variantLabel ||
        item.variant ||
        item.variation ||
        item.variant_name ||
        item.variantName ||
        item.option ||
        item.option_name ||
        item.selected_variant ||
        item.selectedVariation ||
        item.label ||
        "",
      weight: Number(item.weight ?? item.parcel_weight ?? item.shippingWeight ?? 0.01),
      length: Number(item.length ?? item.parcel_length ?? item.shippingLength ?? 1),
      width: Number(item.width ?? item.parcel_width ?? item.shippingWidth ?? 1),
      height: Number(item.height ?? item.parcel_height ?? item.shippingHeight ?? 1),
    };
  });
}

function saveOrder(order) {
  try {
    let orders = JSON.parse(localStorage.getItem("drinOrders")) || [];
    const lightOrder = { ...order, items: normalizeOrderItems(order.items) };
    orders.push(lightOrder);
    orders = orders.slice(-10);
    localStorage.setItem("drinOrders", JSON.stringify(orders));
  } catch (error) {
    console.warn("Storage full. Resetting old orders...");
    localStorage.removeItem("drinOrders");
    localStorage.setItem("drinOrders", JSON.stringify([order]));
  }
}

async function syncOrderToSupabase(order) {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {

    showOrderModal(
      "Login Required",
      `
      <div class="premium-login-alert">

        <div class="premium-login-icon">
          🔒
        </div>

        <h4>
          Secure Checkout Required
        </h4>

        <p>
          Please login or create your account first
          to continue with secure checkout.
        </p>

        <div class="premium-login-actions">

          <button
            type="button"
            onclick="window.location.href='/login/'">
            Login Account
          </button>

          <button
            type="button"
            class="secondary-btn"
            onclick="window.location.href='/signup/'">
            Create Account
          </button>

        </div>

      </div>
      `
    );

    return false;
  }

  console.log("SAVING ORDER TO SUPABASE:", {
    user_id: user.id,
    external_id: order.id,
    items: order.items,
    amount: order.total
  });

  const { error } = await supabaseClient
    .from("orders")
    .insert([
      {
        user_id: user.id,
        external_id: order.id,
        items: order.items,
        amount: order.total,
        order_status: order.status,
        courier: order.courier,
        address: order.address,
        customer_name: order.customer.name,
        customer_phone: order.customer.phone,
        subtotal: order.subtotal,
        shipping_fee: order.shippingFee,
        voucher_code: order.voucherCode,
        voucher_discount: order.voucherDiscount,
      }
    ]);

  console.log("SUPABASE INSERT ERROR:", error);

  if (error) {
    console.error("SUPABASE ORDER SYNC ERROR:", error);
    throw new Error(error.message);
  }

  return true;
}

function clearCheckedCartItems() {
  const checkedOutItems =
    JSON.parse(localStorage.getItem("drinCheckoutItems")) || [];

  let cart =
    JSON.parse(localStorage.getItem("drinCart")) || [];

  cart = cart.filter(cartItem => {
    return !checkedOutItems.some(orderItem =>
      String(orderItem.id) === String(cartItem.id) &&
      String(orderItem.variantLabel || "") === String(cartItem.variantLabel || "")
    );
  });

  localStorage.setItem("drinCart", JSON.stringify(cart));
  localStorage.removeItem("drinCheckoutItems");

  window.dispatchEvent(new Event("storage"));
}

function getSelectedAddress() {
  return {
    country: "Philippines",
    areaGroup: areaGroupSelect?.value || "",
    province: provinceSelect?.value || "",
    city: citySelect?.value || "",
    barangay: barangaySelect?.value || "",
    fullAddress: fullAddressInput?.value.trim() || "",
  };
}

function isAddressComplete() {
  const address = getSelectedAddress();

  return Boolean(
    address.areaGroup &&
    address.province &&
    address.city &&
    address.barangay &&
    address.fullAddress
  );
}

function scheduleShippingQuote() {
  clearTimeout(shippingQuoteTimer);

  currentShippingFee = null;
  currentShippingQuote = null;

  updateTotalsDisplay();

  if (!cartItems.length) {
    setShippingUI("failed", "No items to ship", null);
    return;
  }

  if (!isAddressComplete()) {
    setShippingUI("", "Complete address to calculate", null);
    return;
  }

  if (!selectedCourier) {
    setShippingUI("", "Please select courier", null);
    return;
  }


  // SAME DAY / LALAMOVE
  if (selectedCourier === "Same Day Delivery / Lalamove") {

    currentShippingFee = 0;

    currentShippingQuote = {
      success: true,
      courier: selectedCourier,
      fallback: true,
      message: "Same day delivery selected",
    };

    setShippingUI(
      "ready",
      "Shipping fee will be paid upon delivery.",
      null
    );
    return;
  }


  // REAL SPX API
  setShippingUI("loading", "Checking delivery availability and shipping fee...", null);

  shippingQuoteTimer = setTimeout(calculateShippingFee, 200);
}

function estimateFallbackShippingFee(courier) {
  return 0;
}
async function calculateShippingFee() {
  showOrderModal(
    "Checking SPX Shipping Fee",
    "Please wait while we calculate the best shipping rate for your address...",
    true
  );

  const slowShippingTimer = setTimeout(() => {

    const modalMessage =
      document.getElementById("orderModalMessage");

    if (modalMessage) {

      modalMessage.innerHTML = `
      <div class="payment-loader"></div>
      <p>
        Shipping calculation is taking longer than usual.<br><br>
        Please wait while we check courier availability...
      </p>
    `;
    }

  }, 15000);

  try {
    currentParcelInfo = calculateParcelInfo();



    const address = getSelectedAddress();
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "COD";
    const subtotal = getCheckoutTotal();

    const normalizedItems = normalizeOrderItems(cartItems);

    const orderItems = normalizedItems.map((item) => ({
      item_name: item.name,
      item_quantity: Number(item.quantity) || 1,
      item_value: Number(item.price) || 0
    }));


    const res = await fetch(`${API_BASE_URL}/api/spx/check-shipping-fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: subtotal,
        paymentMethod,
        address,
        parcelInfo: currentParcelInfo,
        items: normalizedItems,

        base_info: {
          ed_item_list: orderItems
        },

        baseInfo: {
          ed_item_list: orderItems
        }
      }),
    });
    const data = await res.json();

    window.lastSPXResponse = data;
    // console.log("FULL SPX RESPONSE:", data);

    if (!res.ok || !data.success) {
      console.log("SPX ERROR RESPONSE:", window.lastSPXResponse = data);
      // alert(JSON.stringify(data));

      const isUnsupportedArea =
        JSON.stringify(data).includes("NotSupportDeliverAddressErrorCode");

      if (isUnsupportedArea) {

        currentShippingFee = null;

        currentShippingQuote = {
          success: false,
          unsupportedArea: true
        };

        setShippingUI(
          "failed",
          "SPX is not available in this area.",
          null
        );
        clearTimeout(slowShippingTimer);
        closeOrderModal();

        return;
      }

      currentShippingFee = null;
      currentShippingQuote = {
        success: false,
        courier: selectedCourier,
        fallback: false,
        spxError: data,
      };

      setShippingUI(
        "failed",
        "SPX error. Check console for details.",
        null
      );
      clearTimeout(slowShippingTimer);
      closeOrderModal();
      return;
    }

    currentShippingQuote = data;
    currentShippingFee = Number(data.shippingFee || 0);

    const etaText = data.edtMin !== undefined && data.edtMax !== undefined
      ? `SPX estimated delivery: ${data.edtMin}-${data.edtMax} day(s)`
      : "SPX shipping fee calculated";

    setShippingUI("ready", etaText, currentShippingFee);
    clearTimeout(slowShippingTimer);
    closeOrderModal();

  } catch (error) {
    console.error("SHIPPING FEE ERROR:", error);

    currentShippingFee = null;
    currentShippingQuote = {
      success: false,
      courier: selectedCourier,
      fallback: false,
      error: error.message,
    };

    setShippingUI(
      "failed",
      "SPX connection error. Check console.",
      null
    );

    clearTimeout(slowShippingTimer);
    closeOrderModal();

  }
}

function getFallbackCourier() {

  return "Same Day Delivery / Lalamove";

}

async function deductOrderStock(order) {

  for (const item of order.items) {

    const { error } =
      await supabaseClient.rpc(
        "deduct_stock",
        {
          p_product_id:
            Number(item.id),

          p_variant_label:
            item.variantLabel ||
            item.variant ||
            "Default",

          p_quantity:
            Number(item.quantity) || 1,

          p_order_id:
            order.id
        }
      );

    if (error) {

      console.error(
        "RPC ERROR:",
        error
      );

      throw error;
    }

  }
}

async function placeOrder() {

  if (isPlacingOrder) return;

  isPlacingOrder = true;

  const resetPlaceOrder = () => {
    isPlacingOrder = false;

    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.style.pointerEvents = "auto";
      checkoutBtn.style.opacity = "1";
    }

    return;
  };

  if (
    !nameInput?.value ||
    !phoneInput?.value ||
    !fullAddressInput?.value
  ) {
    enableCustomerEdit();

    showOrderModal(
      "Customer Details Required",
      "Please fill up and save your customer details first."
    );

    document.getElementById("customerDetailsBody")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    return resetPlaceOrder();
  }

  const name = nameInput?.value.trim() || "";
  const phone = phoneInput?.value.trim() || "";
  const paymentMain =
    document.querySelector('input[name="payment"]:checked')
      ?.value
      ?.trim()
      ?.toUpperCase() || "ONLINE";

  const selectedCourierNow = courierSelect?.value || selectedCourier || "";

  if (!cartItems.length) {
    showOrderModal("No Items", "Please select items first.");
    return resetPlaceOrder();
  }

  if (!name || name.length < 3) {
    showOrderModal("Invalid Name", "Name must be at least 3 characters.");
    return resetPlaceOrder();
  }

  if (!phone || phone.length !== 11 || !phone.startsWith("09")) {
    showOrderModal("Invalid Number", "Enter a valid 11-digit phone number (09XXXXXXXXX).");
    return resetPlaceOrder();
  }

  if (!isAddressComplete()) {
    showOrderModal("Incomplete Details", "Please complete all address fields.");
    return resetPlaceOrder();
  }

  if (currentShippingFee === null) {
    await calculateShippingFee();
  }

  if (currentShippingQuote?.unsupportedArea) {
    showOrderModal(
      "Delivery Not Available",
      "SPX delivery is currently unavailable in this area.\n\nPlease contact our support team for manual shipping assistance."
    );

    return resetPlaceOrder();
  }

  const subtotalNumber = getCheckoutTotal();
  const handlingFee = 25;
  const shippingFeeNumber = Number(currentShippingFee) || 0;

  const totalNumber =
    subtotalNumber -
    voucherDiscount +
    shippingFeeNumber +
    handlingFee;

  if (
    paymentMain === "COD" &&
    selectedCourierNow === "Same Day Delivery / Lalamove"
  ) {
    showOrderModal(
      "COD Not Available",
      "COD is not available for Same Day Delivery / Lalamove. Please select Online Payment or change courier."
    );

    return resetPlaceOrder();
  }

  if (paymentMain === "COD" && totalNumber < 200) {
    showOrderModal(
      "COD Minimum Order",
      "Cash on Delivery requires a minimum total order of ₱200 including shipping."
    );

    return resetPlaceOrder();
  }

  if (paymentMain === "COD" && totalNumber > 8000) {
    showOrderModal(
      "COD Limit Reached",
      "Cash on Delivery is only available up to ₱8,000 total including shipping.\n\nPlease select Online Payment to continue."
    );

    return resetPlaceOrder();
  }

  if (paymentMain !== "COD" && totalNumber < 100) {
    showOrderModal(
      "Minimum Online Payment",
      "Online payment requires a minimum total order of ₱100 including shipping."
    );

    return resetPlaceOrder();
  }

  if (subtotalNumber <= 0) {
    showOrderModal("Invalid Total", "Order total must be greater than ₱0.");
    return resetPlaceOrder();
  }

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  const voucherCode = localStorage.getItem("claimedVoucherCode");

  if (voucherCode && user) {
    const { data: existingUsage } =
      await supabaseClient
        .from("voucher_usage")
        .select("*")
        .eq("voucher_code", voucherCode)
        .eq("user_id", user.id)
        .maybeSingle();

    if (existingUsage) {
      showOrderModal(
        "Voucher Already Used",
        "This voucher has already been used on your account."
      );

      return resetPlaceOrder();
    }
  }

  const normalizedItems = normalizeOrderItems(cartItems);
  const address = getSelectedAddress();
  currentParcelInfo = calculateParcelInfo();

  if (currentShippingQuote?.unsupportedArea) {
    showOrderModal(
      "Delivery Not Available",
      "SPX delivery is currently unavailable in this area.\n\nPlease contact our support team for manual shipping assistance."
    );

    return resetPlaceOrder();
  }

  // dito tuloy yung existing code mo sa baba

  const order = {
    id: "ORD-" + Date.now(),
    customer: { name, phone },
    address,
    courier: selectedCourier || courierSelect?.value || "Manual Delivery",
    payment: { method: paymentMain },
    items: normalizedItems,
    subtotal: subtotalNumber,
    shippingFee: shippingFeeNumber,
    voucherCode: voucherCode || "",
    voucherDiscount: voucherDiscount || 0,
    parcelInfo: currentParcelInfo,
    shippingQuote: currentShippingQuote,
    total: totalNumber,
    status: paymentMain === "COD" ? "Pending COD" : "Pending Payment",
    date: new Date().toLocaleString(),
  };

  saveOrder(order);

  try {

    await syncOrderToSupabase(order);

    if (paymentMain === "COD") {

      await deductOrderStock(order);

    }

    if (voucherCode && user) {

      await supabaseClient
        .from("voucher_usage")
        .insert({

          voucher_code: voucherCode,

          user_id: user.id

        });

      localStorage.removeItem(
        "claimedVoucherCode"
      );

    }

  } catch (error) {

    alert("ORDER SYNC ERROR: " + error.message);

    return resetPlaceOrder();
  }

  if (paymentMain === "COD") {
    showOrderModal(
      "Processing COD Order...",
      "Please wait while we save your order.",
      true
    );

    try {
      await fetch(`${API_BASE_URL}/api/orders/cod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          amount: totalNumber,
          subtotal: subtotalNumber,
          shippingFee: shippingFeeNumber,
          customerName: name,
          customerPhone: phone,
          paymentMethod: "COD",
          courier: order.courier,
          address,
          parcelInfo: currentParcelInfo,
          items: order.items,
        }),
      });

    } catch (error) {

      console.warn("COD backend save failed:", error);

    }

    clearCheckedCartItems();
    localStorage.removeItem("drinCart");

    localStorage.removeItem("drinCheckoutItems");

    closeOrderModal();

    showOrderModal(
      "Thank You!",
      `Your order has been placed successfully.`
    );

    setTimeout(() => {
      window.location.href = "/home-orders";
    }, 1200);
    return;
  }

  try {
    const paymentUrl = `${API_BASE_URL}/api/create-payment`;
    showOrderModal(
      "Please Wait",
      "Redirecting to secure payment gateway... Please do not close this window.",
      true
    );


    const res = await fetch(paymentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: order.id,
        amount: totalNumber,
        subtotal: subtotalNumber,
        shippingFee: shippingFeeNumber,
        customerName: name,
        customerPhone: phone,
        paymentMethod: "XENDIT",
        courier: order.courier,
        address,
        parcelInfo: currentParcelInfo,
        items: order.items,
      }),
    });

    const data = await res.json();

    const redirectUrl =
      data.checkoutUrl ||
      data.checkout_url ||
      data.invoice_url ||
      data.redirectUrl;

    if (redirectUrl) {

      clearCheckedCartItems();

      localStorage.removeItem("drinCart");
      localStorage.removeItem("drinCheckoutItems");

      sessionStorage.setItem("paymentStarted", "true");

      window.location.replace(redirectUrl);

    }

    else {
      showOrderModal("Payment Error", data.message || "Checkout failed.");
      return resetPlaceOrder();
    }

  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    showOrderModal("Server Error", "Cannot connect to payment server.");
    return resetPlaceOrder();
  }
}


courierSelect?.addEventListener("change", function () {

  selectedCourier = this.value;

  if (courierStatus) {

    courierStatus.textContent =
      selectedCourier
        ? `${selectedCourier} selected`
        : "Please select courier";

  }

  scheduleShippingQuote();

});

const saveCustomerBtn =
  document.getElementById("saveCustomerBtn");

let customerSaved = false;

let isPlacingOrder = false;


saveCustomerBtn?.addEventListener("click", () => {

  if (!customerSaved) {

    saveCustomerCheckoutInfo();


    [
      nameInput,
      phoneInput,
      fullAddressInput,
      areaGroupSelect,
      provinceSelect,
      citySelect,
      barangaySelect,
    ].forEach(input => {

      if (input) {
        input.disabled = true;
      }

    });

    saveCustomerBtn.textContent = "Edit";
    const toggleBtn =
      document.getElementById(
        "toggleCustomerBtn"
      );

    if (toggleBtn) {
      toggleBtn.textContent =
        "Show More";
    }

    customerSaved = true;

    const body =
      document.getElementById(
        "customerDetailsBody"
      );

    if (body) {

      body.classList.add(
        "collapsed"
      );

    }

  } else {

    [
      nameInput,
      phoneInput,
      fullAddressInput,
      areaGroupSelect,
      provinceSelect,
      citySelect,
      barangaySelect,
    ].forEach(input => {

      if (input) {
        input.disabled = false;
      }

    });

    saveCustomerBtn.textContent = "Save";

    customerSaved = false;
    enableCustomerEdit();
  }

});

areaGroupSelect?.addEventListener("change", loadProvinces);

provinceSelect?.addEventListener("change", loadCities);

citySelect?.addEventListener("change", loadBarangays);

barangaySelect?.addEventListener("change", () => {

  saveCustomerCheckoutInfo();

});

document.querySelectorAll('input[name="payment"]').forEach((input) => {
  input.addEventListener("change", () => {
    isPlacingOrder = false;

    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.style.pointerEvents = "auto";
      checkoutBtn.style.opacity = "1";
    }

    scheduleShippingQuote();
  });
});

async function loadClaimedVoucher() {

  const voucherCode =
    localStorage.getItem(
      "claimedVoucherCode"
    );

  if (!voucherCode) return;

  const { data, error } =
    await supabaseClient
      .from("vouchers")
      .select("*")
      .eq("code", voucherCode)
      .eq("is_active", true)
      .single();

  if (error || !data) {
    return;
  }

  claimedVoucher = data;

  updateTotalsDisplay();
}

(async function initCheckout() {

  await loadSPXAddresses();

  await loadClaimedVoucher();

  fetch(`${API_BASE_URL}/api/spx/verify`)
    .catch(() => { });

  renderCheckout();
  loadAreaGroups();

  loadCustomerCheckoutInfo();

  updateParcelEstimate();
  updateTotalsDisplay();
  // scheduleShippingQuote();

})();

[
  nameInput,
  phoneInput,
  fullAddressInput,
  areaGroupSelect,
  provinceSelect,
  citySelect,
  barangaySelect,
  courierSelect
].forEach((input) => {

  if (!input) return;

  input.addEventListener("input", saveCustomerCheckoutInfo);
  input.addEventListener("change", saveCustomerCheckoutInfo);

});

window.loadProvinces = loadProvinces;
window.loadCities = loadCities;
window.loadBarangays = loadBarangays;
window.placeOrder = placeOrder;
window.closeOrderModal = closeOrderModal;
window.togglePayment = togglePayment;

function smartBack(fallback = "../Cart/index.html") {

  if (
    document.referrer &&
    document.referrer !== window.location.href
  ) {
    window.history.back();
  } else {
    window.location.href = fallback;
  }

}


function saveCustomerCheckoutInfo() {
  const data = {
    name: nameInput?.value || "",
    phone: phoneInput?.value || "",
    areaGroup: areaGroupSelect?.value || "",
    province: provinceSelect?.value || "",
    city: citySelect?.value || "",
    barangay: barangaySelect?.value || "",
    fullAddress: fullAddressInput?.value || "",
    courier: courierSelect?.value || ""
  };

  localStorage.setItem(
    "drinCustomerCheckoutInfo",
    JSON.stringify(data)
  );

  updateCustomerQuickView();
}


function updateCustomerQuickView() {
  const name = document.getElementById("quickCustomerName");
  const phone = document.getElementById("quickCustomerPhone");
  const address = document.getElementById("quickCustomerAddress");

  if (name) name.textContent = nameInput?.value || "Customer Name";
  if (phone) phone.textContent = phoneInput?.value || "Phone Number";

  if (address) {
    address.textContent = [
      barangaySelect?.value,
      citySelect?.value,
      provinceSelect?.value
    ].filter(Boolean).join(", ") || "Address summary";
  }
}

function toggleCustomerDetails() {
  const body = document.getElementById("customerDetailsBody");
  const btn = document.getElementById("toggleCustomerBtn");

  if (!body) return;

  body.classList.toggle("collapsed");

  if (btn) {
    btn.textContent = body.classList.contains("collapsed")
      ? "Read More"
      : "Show Less";
  }
}

function enableCustomerEdit() {
  const body = document.getElementById("customerDetailsBody");

  if (body) {
    body.classList.remove("collapsed");
    const toggleBtn =
      document.getElementById(
        "toggleCustomerBtn"
      );

    if (toggleBtn) {
      toggleBtn.textContent =
        "Show Less";
    }
  }

  const btn = document.getElementById("toggleCustomerBtn");
  if (btn) btn.textContent = "Show Less";
}

function loadCustomerCheckoutInfo() {

  const saved =
    JSON.parse(
      localStorage.getItem(
        "drinCustomerCheckoutInfo"
      )
    ) || {};

  if (nameInput) {
    nameInput.value = saved.name || "";
  }

  if (phoneInput) {
    phoneInput.value = saved.phone || "";
  }

  if (fullAddressInput) {
    fullAddressInput.value =
      saved.fullAddress || "";
  }

  if (areaGroupSelect && saved.areaGroup) {

    areaGroupSelect.value =
      saved.areaGroup;

    loadProvinces();

  }



  setTimeout(() => {

    if (provinceSelect && saved.province) {

      provinceSelect.value =
        saved.province;

      loadCities();

    }

    setTimeout(() => {

      if (citySelect && saved.city) {

        citySelect.value =
          saved.city;

        loadBarangays();

      }

      setTimeout(() => {

        if (
          barangaySelect &&
          saved.barangay
        ) {

          barangaySelect.value =
            saved.barangay;

        }

        if (courierSelect) {

          courierSelect.value = "";

          selectedCourier = "";

        }

        updateCustomerQuickView();

      }, 100);

    }, 100);

  }, 100);

  const body =
    document.getElementById(
      "customerDetailsBody"
    );

  if (
    saved.name &&
    saved.phone &&
    body
  ) {

    body.classList.add(
      "collapsed"
    );

  }

  if (
    saved.name &&
    saved.phone &&
    saved.fullAddress
  ) {
    const toggleBtn =
      document.getElementById(
        "toggleCustomerBtn"
      );

    if (toggleBtn) {
      toggleBtn.textContent =
        "Show More";
    }
    customerSaved = true;

    saveCustomerBtn.textContent = "Edit";

    [
      nameInput,
      phoneInput,
      fullAddressInput,
      areaGroupSelect,
      provinceSelect,
      citySelect,
      barangaySelect,
    ].forEach(input => {

      if (input) {
        input.disabled = true;
      }

    });

  }

}

async function syncCheckoutProfile() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) return;

  try {

    await supabaseClient
      .from("profiles")
      .upsert({

        id: user.id,

        full_name:
          nameInput?.value || "",

        contact_number:
          phoneInput?.value || "",

        province:
          provinceSelect?.value || "",

        city:
          citySelect?.value || "",

        barangay:
          barangaySelect?.value || "",

        street_address:
          fullAddressInput?.value || "",

        updated_at:
          new Date().toISOString()

      });

  } catch (error) {

    console.error(
      "PROFILE SYNC ERROR:",
      error
    );

  }
}