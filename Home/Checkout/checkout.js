const SUPABASE_URL = "https://zdinvxowzpkolbfzpcac.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
const checkoutItems = document.getElementById("checkoutItems");
const checkoutSubtotal = document.getElementById("checkoutSubtotal");
const checkoutShippingFee = document.getElementById("checkoutShippingFee");
const checkoutTotal = document.getElementById("checkoutTotal");
const shippingStatus = document.getElementById("shippingStatus");
const parcelEstimate = document.getElementById("parcelEstimate");
const shippingRow = document.querySelector(".shipping-row");

const areaGroupSelect = document.getElementById("areaGroup");
const provinceSelect = document.getElementById("province");
const citySelect = document.getElementById("city");
const barangaySelect = document.getElementById("barangay");
const zipCodeInput = document.getElementById("zipCode");
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
let currentShippingQuote = null;
let currentParcelInfo = null;
let shippingQuoteTimer = null;
let selectedCourier = "";

let SPX_ADDRESSES = [];
let ADDRESS_DATA = {};

const AREA_GROUPS = ["Metro Manila", "North Luzon", "South Luzon", "Visayas", "Mindanao"];

async function loadSPXAddresses() {
  const res = await fetch("spx-addresses.json");

  SPX_ADDRESSES = await res.json();

  ADDRESS_DATA = {};

  SPX_ADDRESSES.forEach((row) => {

    const province = row.city;
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
          "Pick Up / Walk In"
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
  return Number(item.weight || item.parcel_weight || item.shippingWeight || 0.5) || 0.5;
}

function getItemLength(item) {
  return Number(item.length || item.parcel_length || item.shippingLength || 10) || 10;
}

function getItemWidth(item) {
  return Number(item.width || item.parcel_width || item.shippingWidth || 10) || 10;
}

function getItemHeight(item) {
  return Number(item.height || item.parcel_height || item.shippingHeight || 10) || 10;
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
    totalQuantity += quantity;
    totalWeight += getItemWeight(item) * quantity;
    maxLength = Math.max(maxLength, getItemLength(item));
    maxWidth = Math.max(maxWidth, getItemWidth(item));
    stackedHeight += getItemHeight(item) * quantity;
  });

  return {
    parcelWeight: Number(Math.max(totalWeight, 0.1).toFixed(2)),
    parcelLength: Number(Math.max(maxLength, 1).toFixed(2)),
    parcelWidth: Number(Math.max(maxWidth, 1).toFixed(2)),
    parcelHeight: Number(Math.max(stackedHeight, 1).toFixed(2)),
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
}

function updateTotalsDisplay() {
  const subtotal = getCheckoutTotal();
  const grandTotal = subtotal + (Number(currentShippingFee) || 0);

  if (checkoutSubtotal) checkoutSubtotal.textContent = formatPrice(subtotal);
  if (checkoutTotal) checkoutTotal.textContent = formatPrice(grandTotal);
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
  courierSelect.innerHTML = "";

  if (zipCodeInput) zipCodeInput.value = "";
  selectedCourier = "";

  const selectedArea = areaGroupSelect.value;

  const provinces = Object.keys(ADDRESS_DATA)
    .filter((province) => ADDRESS_DATA[province].areaGroup === selectedArea)
    .sort((a, b) => a.localeCompare(b));

  console.log("Selected area:", selectedArea);
  console.log("Province options:", provinces.slice(0, 30));

  provinces.forEach((province) => {
    const opt = document.createElement("option");
    opt.value = province;
    opt.textContent = province;
    provinceSelect.appendChild(opt);
  });

  updateCourierOptions();
  scheduleShippingQuote();
}

function loadCities() {
  resetSelect(citySelect);
  resetSelect(barangaySelect);
  resetSelect(courierSelect);

  if (zipCodeInput) zipCodeInput.value = "";
  selectedCourier = "";

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
  scheduleShippingQuote();
}

function loadBarangays() {
  resetSelect(barangaySelect);
  resetSelect(courierSelect);

  const province = provinceSelect.value;
  const city = citySelect.value;
  const cityData = ADDRESS_DATA[province]?.cities?.[city];

  if (zipCodeInput) zipCodeInput.value = cityData?.zip || "";

  (cityData?.barangays || []).forEach((barangay) => {
    const opt = document.createElement("option");
    opt.value = barangay;
    opt.textContent = barangay;
    barangaySelect.appendChild(opt);
  });

  updateCourierOptions();
  scheduleShippingQuote();
}

function updateCourierOptions() {

  const currentValue = courierSelect?.value || "";

  resetSelect(courierSelect);

  const couriers = [
    "SPX",
    "Same Day Delivery / Lalamove",
    "Pick Up / Walk In"
  ];

  couriers.forEach((courier) => {
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

function showOrderModal(title, message) {
  const modal = document.getElementById("orderModal");
  const modalTitle = document.getElementById("orderModalTitle");
  const modalMessage = document.getElementById("orderModalMessage");

  if (!modal || !modalTitle || !modalMessage) {
    alert(`${title}: ${message}`);
    return;
  }

  modalTitle.textContent = title;
  modalMessage.innerHTML = `
  <div class="payment-loader"></div>
  <p>${message}</p>
`;

  // DISABLE CLOSE
  modal.onclick = null;

  // HIDE OK BUTTON
  const okBtn = document.getElementById("orderModalOk");
  if (okBtn) {
    // okBtn.style.display = "none";
  }

  // HIDE CLOSE/X BUTTON
  const closeBtn = document.getElementById("orderModalClose");
  if (closeBtn) {
    // closeBtn.style.display = "none";
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
      weight: Number(item.weight || item.parcel_weight || item.shippingWeight || 0.5) || 0.5,
      length: Number(item.length || item.parcel_length || item.shippingLength || 10) || 10,
      width: Number(item.width || item.parcel_width || item.shippingWidth || 10) || 10,
      height: Number(item.height || item.parcel_height || item.shippingHeight || 10) || 10,
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
    throw new Error("Please login or create an account before checkout.");
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
      }
    ]);

  console.log("SUPABASE INSERT ERROR:", error);

  if (error) {
    console.error("SUPABASE ORDER SYNC ERROR:", error);
    throw new Error(error.message);
  }
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
    zipCode: zipCodeInput?.value || "",
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

  updateCourierOptions();

  if (!isAddressComplete()) {
    setShippingUI("", "Complete address to calculate", null);
    return;
  }

  if (!selectedCourier) {
    setShippingUI("", "Please select courier", null);
    return;
  }


  // PICK UP / WALK IN
  if (selectedCourier === "Pick Up / Walk In") {

    currentShippingFee = 0;

    currentShippingQuote = {
      success: true,
      courier: selectedCourier,
      fallback: true,
      message: "Free pickup selected",
    };

    setShippingUI(
      "ready",
      "Pick Up / Walk In selected",
      currentShippingFee
    );

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
  setShippingUI("loading", "Calculating SPX shipping fee...", null);

  shippingQuoteTimer = setTimeout(calculateShippingFee, 650);
}

function estimateFallbackShippingFee(courier) {
  return 0;
}
async function calculateShippingFee() {
  try {
    currentParcelInfo = calculateParcelInfo();
    const address = getSelectedAddress();
    const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || "COD";
    const subtotal = getCheckoutTotal();

    const res = await fetch(`${API_BASE_URL}/api/spx/check-shipping-fee`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: subtotal,
        paymentMethod,
        address,
        parcelInfo: currentParcelInfo,
        items: normalizeOrderItems(cartItems),
      }),
    });

    const data = await res.json();

    window.lastSPXResponse = data;
    // console.log("FULL SPX RESPONSE:", data);

    if (!res.ok || !data.success) {
      console.log("SPX ERROR RESPONSE:", window.lastSPXResponse = data);
      // alert(JSON.stringify(data));

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

      return;
    }

    currentShippingQuote = data;
    currentShippingFee = Number(data.shippingFee || 0);

    const etaText = data.edtMin !== undefined && data.edtMax !== undefined
      ? `SPX estimated delivery: ${data.edtMin}-${data.edtMax} day(s)`
      : "SPX shipping fee calculated";

    setShippingUI("ready", etaText, currentShippingFee);

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
  }
}

function getFallbackCourier() {

  return "Same Day Delivery / Lalamove";

}

async function placeOrder() {
  const name = nameInput?.value.trim() || "";
  const phone = phoneInput?.value.trim() || "";
  const paymentMain = document.querySelector('input[name="payment"]:checked')?.value || "ONLINE";
  const selectedCourierNow =
    courierSelect?.value || selectedCourier || "";

  if (!cartItems.length) {
    showOrderModal("No Items", "Please select items first.");
    return;
  }

  if (!name || name.length < 3) {
    showOrderModal("Invalid Name", "Name must be at least 3 characters.");
    return;
  }

  if (!phone || phone.length !== 11 || !phone.startsWith("09")) {
    showOrderModal("Invalid Number", "Enter a valid 11-digit phone number (09XXXXXXXXX).");
    return;
  }

  if (!isAddressComplete()) {
    showOrderModal("Incomplete Details", "Please complete all address fields.");
    return;
  }

  if (currentShippingFee === null) {
    await calculateShippingFee();
  }

  const subtotalNumber = getCheckoutTotal();
  const handlingFee = 25;

  const shippingFeeNumber =
    (Number(currentShippingFee) || 0) + handlingFee;
  const totalNumber = subtotalNumber + shippingFeeNumber;


  if (
    paymentMain === "COD" &&
    (
      selectedCourierNow === "Pick Up / Walk In" ||
      selectedCourierNow === "Same Day Delivery / Lalamove"
    )
  ) {

    const modalMessage =
      selectedCourierNow === "Pick Up / Walk In"
        ? "Pick Up orders require advance payment before preparation.\n\nPick Up Schedule: 10:00 AM - 4:00 PM.\n\nPlease use Online Payment or select ★ SPX Courier ★ for COD."
        : "COD is only available for ★ SPX Courier ★\n\nPress OK and select SPX to continue.";

    showOrderModal(
      selectedCourierNow === "Pick Up / Walk In"
        ? "Pick Up Policy"
        : "COD Not Available",
      modalMessage
    );

    const okBtn = document.getElementById("orderModalOk");
    if (okBtn) {
      okBtn.style.display = "inline-block";
      okBtn.onclick = closeOrderModal;
    }

    const closeBtn = document.getElementById("orderModalClose");
    if (closeBtn) {
      closeBtn.style.display = "inline-block";
    }

    return;
  }

  if (paymentMain === "COD" && totalNumber < 200) {
    showOrderModal(
      "COD Minimum Order",
      "Cash on Delivery requires a minimum total order of ₱200 including shipping."
    );
    return;
  }

  if (paymentMain === "COD" && totalNumber > 8000) {

    showOrderModal(
      "COD Limit Reached",
      "Cash on Delivery is only available up to ₱8,000 total including shipping.\n\nPlease select Online Payment to continue."
    );

    const okBtn = document.getElementById("orderModalOk");
    if (okBtn) {
      okBtn.style.display = "inline-block";
      okBtn.onclick = closeOrderModal;
    }

    const closeBtn = document.getElementById("orderModalClose");
    if (closeBtn) {
      closeBtn.style.display = "inline-block";
    }

    return;
  }

  if (paymentMain !== "COD" && totalNumber < 100) {
    showOrderModal(
      "Minimum Online Payment",
      "Online payment requires a minimum total order of ₱100 including shipping."
    );
    return;
  }

  if (subtotalNumber <= 0) {
    showOrderModal("Invalid Total", "Order total must be greater than ₱0.");
    return;
  }

  const normalizedItems = normalizeOrderItems(cartItems);
  const address = getSelectedAddress();
  currentParcelInfo = calculateParcelInfo();

  const order = {
    id: "ORD-" + Date.now(),
    customer: { name, phone },
    address,
    courier: selectedCourier || courierSelect?.value || "Manual Delivery",
    payment: { method: paymentMain },
    items: normalizedItems,
    subtotal: subtotalNumber,
    shippingFee: shippingFeeNumber,
    parcelInfo: currentParcelInfo,
    shippingQuote: currentShippingQuote,
    total: totalNumber,
    status: paymentMain === "COD" ? "Pending COD" : "Pending Payment",
    date: new Date().toLocaleString(),
  };

  saveOrder(order);

  try {
    await syncOrderToSupabase(order);
  } catch (error) {

    console.error("ORDER SYNC REAL ERROR:", error);

    // continue kahit may Supabase issue
  }

  if (paymentMain === "COD") {
    showOrderModal(
      "Processing COD Order...",
      "Please wait while we save your order."
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
      "Redirecting to secure payment gateway... Please do not close this window."
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

    } else {

      showOrderModal("Payment Error", data.message || "Checkout failed.");
    }
  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    showOrderModal("Server Error", "Cannot connect to payment server.");
  }
}

areaGroupSelect?.addEventListener("change", loadProvinces);
provinceSelect?.addEventListener("change", loadCities);
citySelect?.addEventListener("change", loadBarangays);
barangaySelect?.addEventListener("change", scheduleShippingQuote);
fullAddressInput?.addEventListener("input", scheduleShippingQuote);
courierSelect?.addEventListener("change", function () {
  selectedCourier = this.value;

  if (courierStatus) {
    courierStatus.textContent = selectedCourier
      ? `${selectedCourier} selected`
      : "Please select courier";
  }

  scheduleShippingQuote();
});

document.querySelectorAll('input[name="payment"]').forEach((input) => {
  input.addEventListener("change", scheduleShippingQuote);
});

(async function initCheckout() {
  await loadSPXAddresses();
  renderCheckout();
  loadAreaGroups();
  updateParcelEstimate();
  updateTotalsDisplay();
  scheduleShippingQuote();
})();

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

