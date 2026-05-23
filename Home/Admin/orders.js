/* ===============================
   ORDERS MODULE
================================ */

const adminOrdersTableBody = document.getElementById("adminOrdersTableBody");
const ordersTotalCount = document.getElementById("ordersTotalCount");
const ordersPendingCount = document.getElementById("ordersPendingCount");
const ordersPaidCount = document.getElementById("ordersPaidCount");
const ordersToShipCount = document.getElementById("ordersToShipCount");

const dashboardToShip = document.getElementById("dashboardToShip");
const dashboardShipped = document.getElementById("dashboardShipped");
const dashboardDelivered = document.getElementById("dashboardDelivered");

let adminOrders = [];
let currentOrderFilter = "ALL";
let expandedOrderItems = {};

const cancelledOrdersTableBody =
  document.getElementById("cancelledOrdersTableBody");

let cancelledOrders = [];

/* ===============================
   SAFE TEXT HELPERS
================================ */

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

/* ===============================
   STATUS CLASS
================================ */

function getOrderStatusClass(status) {
  if (status === "PAID") return "status-paid";
  if (status === "Pending Payment") return "status-pending";
  if (status === "Processing") return "status-processing";
  if (status === "To Ship") return "status-processing";
  if (status === "Shipped") return "status-shipped";
  if (status === "In Transit") return "status-shipped";
  if (status === "Delivered") return "status-delivered";
  if (status === "Cancelled") return "status-inactive";
  return "status-default";
}

/* ===============================
   SUMMARY
================================ */

function updateOrdersSummary() {
  if (ordersTotalCount) ordersTotalCount.textContent = adminOrders.length;

  if (ordersPendingCount) {
    ordersPendingCount.textContent =
      adminOrders.filter(o => o.status === "Pending Payment").length;
  }

  if (ordersPaidCount) {
    ordersPaidCount.textContent =
      adminOrders.filter(o => o.status === "PAID").length;
  }

  if (ordersToShipCount) {
    ordersToShipCount.textContent =
      adminOrders.filter(o =>
        o.order_status === "To Ship" ||
        o.order_status === "Processing"
      ).length;
  }
}

function updateDashboardOrders() {
  if (dashboardToShip) {
    dashboardToShip.textContent =
      adminOrders.filter(o =>
        o.order_status === "To Ship" ||
        o.order_status === "Processing"
      ).length;
  }

  if (dashboardShipped) {
    dashboardShipped.textContent =
      adminOrders.filter(o =>
        o.order_status === "Shipped" ||
        o.order_status === "In Transit"
      ).length;
  }

  if (dashboardDelivered) {
    dashboardDelivered.textContent =
      adminOrders.filter(o => o.order_status === "Delivered").length;
  }
}

/* ===============================
   ITEM HELPERS
================================ */

function getOrderItems(order) {
  return Array.isArray(order.items) ? order.items : [];
}

function getItemVariant(item) {
  return (
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
    ""
  );
}

/* ===============================
   RENDER ADMIN ORDERS
================================ */


function renderAdminOrders() {
  if (!adminOrdersTableBody) return;

  let filteredOrders = [...adminOrders];

  if (currentOrderFilter !== "ALL") {

    filteredOrders = filteredOrders.filter(order => {

      const status =
        String(order.order_status || "").toLowerCase();

      const createdTime =
        new Date(order.created_at).getTime();

      const expiryTime =
        createdTime + 60 * 60 * 1000;

      const isExpired =
        status.includes("pending payment") &&
        Date.now() > expiryTime;

      if (currentOrderFilter === "Expired") {
        return isExpired;
      }

      return (
        order.status === currentOrderFilter ||
        order.order_status === currentOrderFilter
      );

    });

  }

  filteredOrders.reverse();

  if (!filteredOrders.length) {
    adminOrdersTableBody.innerHTML = `<div class="empty-box">No orders found.</div>`;
    return;
  }

  adminOrdersTableBody.innerHTML = filteredOrders.map(order => {
    const orderId = order.external_id || order.id || "";
    const paymentStatus = order.status || "Pending Payment";
    const orderStatus =
      order.order_status ||
      (paymentStatus === "PAID" ? "Processing" : "Waiting Payment");

    const items = getOrderItems(order);
    const isExpanded = expandedOrderItems[orderId];
    const visibleItems = isExpanded ? items : items.slice(0, 3);

    const hasOrderRequest =
      order.order_request_status &&
      String(order.order_request_status).trim() !== "";

    return `
      <div class="warehouse-order-card">
        <div class="warehouse-order-head">
          <label class="order-select-wrap">
            <input
  type="checkbox"
  class="order-select-checkbox"
  value="${escapeAttribute(orderId)}"
>
            <span>
              <strong>${escapeHtml(orderId || "-")}</strong><br>
              ${escapeHtml(order.customer_name || "Customer")}
            </span>
          </label>

          <span class="status-badge ${getOrderStatusClass(orderStatus)}">
            ${escapeHtml(orderStatus)}
          </span>

${hasOrderRequest ? `
  <span class="status-badge" style="background:#f97316;color:#fff;">
    ${escapeHtml(order.order_request_status)}
  </span>
` : ""}

        </div>

        <div class="warehouse-order-grid">
          <div class="warehouse-items-list">

            ${visibleItems.length
        ? visibleItems.map(item => {
          const itemName =
            item.name ||
            item.product_name ||
            item.title ||
            "Product";

          const itemQty = item.quantity || item.qty || 1;

          const itemImage =
            item.variant_image ||
            item.variantImage ||
            item.product_image ||
            item.productImage ||
            item.image ||
            item.img ||
            item.photo ||
            "https://zdinvxowzpkolbfzpcac.supabase.co/storage/v1/object/public/product-images/favicon.png";

          const itemVariant = getItemVariant(item);

          return `
          <div class="warehouse-item">
            <img
              src="${escapeAttribute(itemImage)}"
              onerror="this.onerror=null; this.src='https://zdinvxowzpkolbfzpcac.supabase.co/storage/v1/object/public/product-images/favicon.png'"
            >

            <div class="warehouse-item-info">
              <div class="warehouse-item-title">
                ${escapeHtml(itemName)}
              </div>

              ${itemVariant
              ? `<div class="warehouse-item-variant">Variation: ${escapeHtml(itemVariant)}</div>`
              : ""
            }

              <div class="warehouse-item-qty">
                Qty: ${escapeHtml(itemQty)}
              </div>
            </div>
          </div>
        `;
        }).join("")
        : `<div class="empty-box">No item details found.</div>`
      }

            ${items.length > 3
        ? `
                  <button
                    class="show-more-items-btn"
                    type="button"
                    onclick="toggleShowAllOrderItems('${escapeAttribute(orderId)}')"
                  >
                    ${isExpanded ? "Show Less" : "Show All Orders"}
                  </button>
                `
        : ""
      }
          </div>

          <div class="warehouse-order-info">
            <div>
              <span>Amount</span>
              <strong>₱${Number(order.amount || 0).toLocaleString("en-PH")}</strong>
            </div>

            <div>
              <span>Payment</span>
              <strong>${escapeHtml(paymentStatus)}</strong>
            </div>

            <div>
              <span>Courier</span>
              <strong>${escapeHtml(order.courier || "-")}</strong>
            </div>

            <div>
              <span>Tracking</span>
              <strong>${escapeHtml(order.tracking_number || "-")}</strong>
            </div>
          </div>


${hasOrderRequest ? `

<div class="order-request-panel">

  <div
    style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      margin-bottom:8px;
    "
  >

    <div class="order-request-title">
      Customer Request
    </div>

    <button
      class="mini-manage-btn"
      type="button"
      onclick="openOrderModal('${escapeAttribute(orderId)}')"
    >
      Manage Order
    </button>

  </div>

  <div class="order-request-reason">
    ${escapeHtml(order.order_request_reason || "-")}
  </div>

</div>

` : ``}

<div
  style="
    display:flex;
    gap:8px;
    justify-content:flex-end;
    margin-top:10px;
  "
>

  <button
    class="mini-summary-btn"
    type="button"
    onclick="openOrderModal('${escapeAttribute(orderId)}')"
  >
    Order Summary
  </button>

  <button
    class="mini-manage-btn"
    type="button"
    onclick="openOrderModal('${escapeAttribute(orderId)}')"
  >
    Manage Order
  </button>

</div>
          
    `;
  }).join("");
}
/* ===============================
   SHOW ALL ITEMS TOGGLE
================================ */

function toggleShowAllOrderItems(orderId) {
  expandedOrderItems[orderId] = !expandedOrderItems[orderId];
  renderAdminOrders();
}

/* ===============================
   LOAD ORDERS
================================ */

async function loadAdminOrders() {
  try {
    if (adminOrdersTableBody) {
      adminOrdersTableBody.innerHTML = `
        <div class="empty-box">Loading orders...</div>
      `;
    }

    const response = await fetch("https://de-ecom-pro.onrender.com/api/orders");
    const data = await response.json();

    if (!data.success || !Array.isArray(data.orders)) {
      throw new Error("Invalid orders response");
    }

    /* REMOVE CANCELLED ORDERS FROM MAIN DASHBOARD */
    adminOrders = data.orders.filter(order => {
      return order.order_status !== "Cancelled";
    });

    renderAdminOrders();
    updateOrdersSummary();
    updateDashboardOrders();

  } catch (error) {
    console.error(error);

    if (adminOrdersTableBody) {
      adminOrdersTableBody.innerHTML = `
        <div class="empty-box">Cannot load orders.</div>
      `;
    }
  }
}

/* ===============================
   ORDER MODAL
================================ */

function openOrderModal(orderId) {
  const order = adminOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  if (!order) return;

  const modal = document.getElementById("orderModal");
  const content = document.getElementById("orderModalContent");

  if (!modal || !content) return;

  content.innerHTML = `
    <h3>Order: ${escapeHtml(order.external_id || order.id || "-")}</h3>

    <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || "-")}</p>
    <p><strong>Phone:</strong> ${escapeHtml(order.customer_phone || "-")}</p>
    <p><strong>Amount:</strong> ₱${Number(order.amount || 0).toLocaleString("en-PH")}</p>
    <p><strong>Status:</strong> ${escapeHtml(order.order_status || "Processing")}</p>
    <p><strong>Courier:</strong> ${escapeHtml(order.courier || "-")}</p>
    <p><strong>Tracking:</strong> ${escapeHtml(order.tracking_number || "-")}</p>

    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
      
<button
  class="primary-btn"
  type="button"
  onclick="createSPXShipment('${escapeAttribute(orderId)}', this)"
>
  Arrange Shipment
</button>

<button
  class="secondary-btn"
  type="button"
  onclick="openAWB('${escapeAttribute(orderId)}')"
>
  Print AWB
</button>

<button
  class="secondary-btn"
  type="button"
  onclick="openTracking('${escapeAttribute(orderId)}')"
>
  Track Order
</button>

${order.order_request_status ? `

<button
  class="small-btn"
  type="button"
  onclick="handleOrderRequestAction('${escapeAttribute(orderId)}')"
>
  Customer Request
</button>

` : ""}

<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">

  <select
    id="cancelReason-${escapeAttribute(orderId)}"
    class="cancel-reason-dropdown"
  >
    <option value="">Select reason</option>

    <option>Out of stock</option>
    <option>Price error</option>
    <option>Wrong item listing</option>
    <option>Cannot fulfill order</option>
    <option>Customer unreachable</option>
    <option>Other reason</option>
  </select>

  <button
    class="danger-btn"
    type="button"
    onclick="cancelOrder('${escapeAttribute(orderId)}', this)"
  >
    Cancel Order
  </button>

</div>
  `;

  modal.style.display = "flex";
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");

  if (modal) {
    modal.style.display = "none";
  }
}

/* ===============================
   CANCEL ORDER
   NOTE: Backend route must exist: /api/orders/:orderId/cancel
================================ */

async function cancelOrder(orderId, btn) {

  const reasonSelect =
    document.getElementById(`cancelReason-${orderId}`);

  const cancelReason =
    reasonSelect?.value || "";

  if (!cancelReason) {

    showToast(
      "Please select cancellation reason.",
      "error"
    );

    return;
  }
  const confirmCancel = confirm("Cancel this order?");

  if (!confirmCancel) return;

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Cancelling...";
    }

    const res = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          orderId,
          order_status: "Cancelled",
          cancel_type: "Seller Forced Cancel",
          cancel_reason: cancelReason,
          cancelled_by: "seller",
          cancelled_at: new Date().toISOString(),

          order_request_status: null,
          order_request_reason: null
        })

      }

    );

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "Failed to cancel order", "error");
      return;
    }

    showToast("Order cancelled", "success");
    closeOrderModal();

    await loadAdminOrders();
    await loadCancelledOrders();

  } catch (error) {
    console.error(error);
    showToast("Cancel order server error", "error");

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Cancel Order";
    }
  }
}

/* ===============================
   SPX
================================ */

async function createSPXShipment(orderId, btn) {
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Arranging Shipment...";
    }

    const res = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/spx-create`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      }
    );

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "SPX shipment failed", "error");
      return;
    }

    showToast("Shipment arranged successfully!", "success");
    await loadAdminOrders();

  } catch (err) {
    console.error(err);
    showToast("SPX server error", "error");

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Arrange Shipment";
    }
  }
}

function openAWB(orderId) {
  const order = adminOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  if (!order || !order.awb_link) {
    showToast("No AWB link available.", "error");
    return;
  }

  window.open(order.awb_link, "_blank");
}

async function approveOrderRequest(orderId) {
  const ok = confirm("Approve customer cancellation request and cancel this order?");

  if (!ok) return;

  const order = adminOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  const reason =
    order?.order_request_reason ||
    "Customer cancellation request approved";

  try {
    const res = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          orderId,
          order_status: "Cancelled",
          cancel_type: "Customer Requested Cancel",
          cancel_reason: reason,
          cancelled_by: "customer_request",
          cancelled_at: new Date().toISOString(),

          order_request_status: "Approved",
          order_request_reason: reason
        })
      }
    );

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "Failed to approve cancellation.", "error");
      return;
    }

    showToast("Cancellation request approved. Order cancelled.", "success");

    closeOrderModal();
    await loadAdminOrders();
    await loadCancelledOrders();

  } catch (error) {
    console.error(error);
    showToast("Approve request server error.", "error");
  }
}


async function rejectOrderRequest(orderId) {
  const ok = confirm("Reject this customer request?");

  if (!ok) return;

  await updateOrderRequestStatus(orderId, "Rejected");

  showToast("Request rejected.", "success");
}

async function updateOrderRequestStatus(orderId, status) {
  const { error } = await supabaseClient
    .from("orders")
    .update({
      order_request_status: status
    })
    .or(`external_id.eq.${orderId},id.eq.${orderId}`);

  if (error) {
    console.error(error);
    showToast("Failed to update request status.", "error");
    return;
  }

  await loadAdminOrders();
}

async function handleOrderRequestAction(orderId) {

  const action = prompt(
    `Customer Request Action

Type:
1 = Approve
2 = Reject`
  );

  if (!action) return;

  if (action === "1") {

    await approveOrderRequest(orderId);

  } else if (action === "2") {

    await rejectOrderRequest(orderId);

  } else {

    showToast("Invalid action selected.", "error");

  }
}

function openTracking(orderId) {
  const order = adminOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  if (!order || !order.tracking_link) {
    showToast("No tracking link available.", "error");
    return;
  }

  window.open(order.tracking_link, "_blank");
}

/* ===============================
   CANCELLED ORDERS
================================ */

async function loadCancelledOrders() {
  if (!cancelledOrdersTableBody) return;

  try {

    cancelledOrdersTableBody.innerHTML = `
      <div class="empty-box">
        Loading cancelled orders...
      </div>
    `;

    const res = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/cancelled"
    );

    const data = await res.json();

    cancelledOrders = Array.isArray(data.orders)
      ? data.orders
      : [];

    renderCancelledOrders();

  } catch (error) {

    console.error(error);

    cancelledOrdersTableBody.innerHTML = `
      <div class="empty-box">
        Cannot load cancelled orders.
      </div>
    `;
  }
}

function renderCancelledOrders() {

  if (!cancelledOrdersTableBody) return;

  if (!cancelledOrders.length) {

    cancelledOrdersTableBody.innerHTML = `
      <div class="empty-box">
        No cancelled orders yet.
      </div>
    `;

    return;
  }

  cancelledOrdersTableBody.innerHTML =
    cancelledOrders.map(order => {

      const orderId =
        order.external_id ||
        order.id ||
        "";

      return `
        <div class="warehouse-order-card">

          <div class="warehouse-order-head">

            <span>
              <strong>${escapeHtml(orderId)}</strong>
              <br>
              ${escapeHtml(order.customer_name || "Customer")}
            </span>

            <span class="status-badge status-inactive">
  Cancelled
  ${order.cancel_type
          ? `• ${escapeHtml(order.cancel_type)}`
          : ""}
</span>

          </div>

          <div class="warehouse-order-info">

            <div>
              <span>Amount</span>

              <strong>
                ₱${Number(order.amount || 0)
          .toLocaleString("en-PH")}
              </strong>
            </div>

            <div>
              <span>Payment</span>

              <strong>
                ${escapeHtml(order.status || "-")}
              </strong>
            </div>

          </div>
      `;

    }).join("");
}

async function undoCancelledOrder(orderId) {

  const ok = await showConfirmModal(
    "Undo Cancelled Order",
    "Restore this order back to Processing?"
  );

  if (!ok) return;

  try {

    const res = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          orderId,
          order_status: "Processing"
        })
      }
    );

    const result = await res.json();

    if (!result.success) {
      showToast(
        result.message || "Failed to restore order",
        "error"
      );
      return;
    }

    showToast("Order restored", "success");

    await loadCancelledOrders();
    await loadAdminOrders();

  } catch (error) {

    console.error(error);

    showToast(
      "Restore order server error",
      "error"
    );
  }
}

async function permanentDeleteOrder(orderId) {

  const ok = await showConfirmModal(
    "Permanent Delete",
    "This action cannot be undone."
  );

  if (!ok) return;

  try {

    const res = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/delete`,
      {
        method: "DELETE"
      }
    );

    const result = await res.json();

    if (!result.success) {

      showToast(
        result.message || "Failed to delete order",
        "error"
      );

      return;
    }

    showToast(
      "Order permanently deleted",
      "success"
    );

    await loadCancelledOrders();

  } catch (error) {

    console.error(error);

    showToast(
      "Delete order server error",
      "error"
    );
  }
}

function getSelectedOrderIds() {

  return Array
    .from(document.querySelectorAll(".order-select-checkbox:checked"))

    .map(checkbox => checkbox.value)

    .filter(Boolean);

}

async function bulkArrangeShipment() {

  const selectedOrders =
    getSelectedOrderIds();

  if (!selectedOrders.length) {

    showToast(
      "Select orders first.",
      "error"
    );

    return;
  }

  for (const orderId of selectedOrders) {

    await createSPXShipment(orderId);

  }

  showToast(
    "Bulk shipment arrangement complete.",
    "success"
  );

}

/* ===============================
   GLOBALS
================================ */

window.handleOrderRequestAction = handleOrderRequestAction;
window.approveOrderRequest = approveOrderRequest;
window.rejectOrderRequest = rejectOrderRequest;
window.updateOrderRequestStatus = updateOrderRequestStatus;
window.bulkArrangeShipment = bulkArrangeShipment;
window.loadAdminOrders = loadAdminOrders;
window.loadCancelledOrders = loadCancelledOrders;
window.undoCancelledOrder = undoCancelledOrder;
window.permanentDeleteOrder = permanentDeleteOrder;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.cancelOrder = cancelOrder;
window.createSPXShipment = createSPXShipment;
window.openAWB = openAWB;
window.openTracking = openTracking;
window.toggleShowAllOrderItems = toggleShowAllOrderItems;

/* ===============================
   INIT
================================ */
document
  .querySelectorAll(".order-filter-btn")

  .forEach(button => {

    button.addEventListener("click", () => {

      document
        .querySelectorAll(".order-filter-btn")

        .forEach(btn =>
          btn.classList.remove("active")
        );

      button.classList.add("active");

      currentOrderFilter =
        button.dataset.filter;

      renderAdminOrders();

    });

  });

loadAdminOrders();
