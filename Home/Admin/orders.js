/* ===============================
   ORDERS MODULE - SAFE ADD ON
================================ */

const adminOrdersTableBody = document.getElementById("adminOrdersTableBody");
const ordersTotalCount = document.getElementById("ordersTotalCount");
const ordersPendingCount = document.getElementById("ordersPendingCount");
const ordersPaidCount = document.getElementById("ordersPaidCount");
const ordersToShipCount = document.getElementById("ordersToShipCount");
const orderFilterButtons = document.querySelectorAll(".order-filter-btn");

const dashboardToShip = document.getElementById("dashboardToShip");
const dashboardShipped = document.getElementById("dashboardShipped");
const dashboardDelivered = document.getElementById("dashboardDelivered");

let adminOrders = [];
let currentOrderFilter = "ALL";
let confirmCallback = null;

function getOrderStatusClass(status) {
  if (status === "PAID") return "status-paid";
  if (status === "Pending Payment") return "status-pending";
  if (status === "Processing") return "status-processing";
  if (status === "To Ship") return "status-processing";
  if (status === "Shipped") return "status-shipped";
  if (status === "In Transit") return "status-shipped";
  if (status === "Delivered") return "status-delivered";
  if (status === "Failed Delivery") return "status-pending";
  if (status === "Return to Seller") return "status-pending";
  if (status === "Returned") return "status-default";
  if (status === "Canceled") return "status-default";
  return "status-default";
}

function updateOrdersSummary() {
  if (ordersTotalCount) ordersTotalCount.textContent = adminOrders.length;

  if (ordersPendingCount) {
    ordersPendingCount.textContent = adminOrders.filter(order => order.status === "Pending Payment").length;
  }

  if (ordersPaidCount) {
    ordersPaidCount.textContent = adminOrders.filter(order => order.status === "PAID").length;
  }

  if (ordersToShipCount) {
    ordersToShipCount.textContent = adminOrders.filter(order =>
      order.order_status === "To Ship" ||
      (order.status === "PAID" && (!order.order_status || order.order_status === "Processing"))
    ).length;
  }
}

function updateDashboardOrders() {
  const toShip = adminOrders.filter(order =>
    order.order_status === "To Ship" ||
    (order.status === "PAID" && (!order.order_status || order.order_status === "Processing"))
  ).length;

  const shipped = adminOrders.filter(order =>
    order.order_status === "Shipped" || order.order_status === "In Transit"
  ).length;

  const delivered = adminOrders.filter(order => order.order_status === "Delivered").length;

  if (dashboardToShip) dashboardToShip.textContent = toShip;
  if (dashboardShipped) dashboardShipped.textContent = shipped;
  if (dashboardDelivered) dashboardDelivered.textContent = delivered;
}

function renderAdminOrders() {
  if (!adminOrdersTableBody) return;

  let filteredOrders = [...adminOrders];

  if (currentOrderFilter !== "ALL") {
    filteredOrders = filteredOrders.filter(order =>
      order.status === currentOrderFilter || order.order_status === currentOrderFilter
    );
  }

  filteredOrders.reverse();

  if (!filteredOrders.length) {
    adminOrdersTableBody.innerHTML = `
      <tr>
        <td colspan="10"><div class="empty-box">No orders found.</div></td>
      </tr>
    `;
    return;
  }

  adminOrdersTableBody.innerHTML = filteredOrders.map(order => {
    const paymentStatus = order.status || "Pending Payment";
    const orderStatus = order.order_status || (paymentStatus === "PAID" ? "Processing" : "Waiting Payment");

    return `
      <tr>
        <td><strong>${escapeHtml(order.external_id || "-")}</strong></td>
        <td>${escapeHtml(order.customer_name || "Customer")}</td>
        <td>${escapeHtml(order.customer_phone || "-")}</td>
        <td>₱${Number(order.amount || 0).toLocaleString("en-PH")}</td>
        <td><span class="status-badge ${getOrderStatusClass(paymentStatus)}">${escapeHtml(paymentStatus)}</span></td>
        <td><span class="status-badge ${getOrderStatusClass(orderStatus)}">${escapeHtml(orderStatus)}</span></td>
        <td>${escapeHtml(order.courier || "-")}</td>
        <td>${escapeHtml(order.tracking_number || "-")}</td>
        <td>${escapeHtml(order.created_at || "-")}</td>
        <td>
          <button class="view-order-btn" onclick="openOrderModal('${escapeAttribute(order.external_id || "")}')">
            View
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function loadAdminOrders() {
  try {
    if (adminOrdersTableBody) {
      adminOrdersTableBody.innerHTML = `
        <tr>
          <td colspan="10"><div class="empty-box">Loading orders...</div></td>
        </tr>
      `;
    }

    const response = await fetch("http://localhost:3000/api/orders");
    const data = await response.json();

    if (!data.success || !Array.isArray(data.orders)) {
      throw new Error("Invalid orders response");
    }

    adminOrders = data.orders;

    console.log("Admin orders:", adminOrders);
    console.log("First order:", adminOrders[0]);

    renderAdminOrders();
    renderPickOrders();
    updateOrdersSummary();
    updateDashboardOrders();

  } catch (error) {
    console.error("Orders load error:", error);

    if (adminOrdersTableBody) {
      adminOrdersTableBody.innerHTML = `
        <tr>
          <td colspan="10"><div class="empty-box">Cannot load orders. Make sure server is running.</div></td>
        </tr>
      `;
    }
  }
}

orderFilterButtons.forEach(button => {
  button.addEventListener("click", function () {
    orderFilterButtons.forEach(btn => btn.classList.remove("active"));
    this.classList.add("active");
    currentOrderFilter = this.dataset.filter || "ALL";
    renderAdminOrders();
  });
});

/* ===============================
   SPX SHIPPING ACTIONS
   Handles:
   - Create SPX Shipment
   - Generate Tracking Number
   - Open AWB PDF
   - Open Tracking Link
   - Refresh Admin Orders

   Connected Backend Endpoints:
   POST /api/orders/:orderId/spx-create

   Notes:
   - Uses adminOrders[]
   - Requires running backend server
   - Requires SPX integration active
================================ */
async function createSPXShipment(orderId, btn) {
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Creating SPX...";
    }

    const res = await fetch(`http://localhost:3000/api/orders/${orderId}/spx-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "SPX shipment failed", "error");
      console.error("SPX error:", result);
      return;
    }

    showToast("SPX shipment created!", "success");

    await loadAdminOrders();
    openOrderModal(orderId);

  } catch (err) {
    console.error(err);
    showToast("SPX server error", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Create SPX";
    }
  }
}

function openAWB(orderId) {
  const order = adminOrders.find(o => o.external_id === orderId);

  if (!order || !order.awb_link) {
    showToast("No AWB link available.", "error");
    return;
  }

  window.open(order.awb_link, "_blank");
}

function openTracking(orderId) {
  const order = adminOrders.find(o => o.external_id === orderId);

  if (!order || !order.tracking_link) {
    showToast("No tracking link available.", "error");
    return;
  }

  window.open(order.tracking_link, "_blank");
}


/* ===============================
   END SPX SHIPPING ACTIONS
================================ */

/* ===============================
   ORDER MODAL UI
   Includes:
   - Order details
   - SPX action buttons
   - Manual order status controls
================================ */

function openOrderModal(orderId) {
  const order = adminOrders.find(o => o.external_id === orderId);
  if (!order) return;

  const modal = document.getElementById("orderModal");
  const content = document.getElementById("orderModalContent");

  if (!modal || !content) {
    alert("Order modal HTML is missing.");
    return;
  }

  const isLocked = ["Delivered", "Returned", "Canceled"].includes(order.order_status);

  content.innerHTML = `
    <h3>Order: ${escapeHtml(order.external_id || "-")}</h3>

    <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || "-")}</p>
    <p><strong>Phone:</strong> ${escapeHtml(order.customer_phone || "-")}</p>
    <p><strong>Amount:</strong> ₱${Number(order.amount || 0).toLocaleString("en-PH")}</p>
    <p><strong>Status:</strong> ${escapeHtml(order.order_status || "Processing")}</p>
    <p><strong>Courier:</strong> ${escapeHtml(order.courier || "-")}</p>
    <p><strong>Tracking:</strong> ${escapeHtml(order.tracking_number || "-")}</p>

    /* ===============================
   SPX ACTION BUTTONS UI
================================ */

<div style="margin:10px 0; display:flex; gap:8px; flex-wrap:wrap;">
  <button type="button" onclick="createSPXShipment('${escapeAttribute(order.external_id)}', this)">Create SPX</button>
  <button type="button" onclick="openAWB('${escapeAttribute(order.external_id)}')">Print AWB</button>
  <button type="button" onclick="openTracking('${escapeAttribute(order.external_id)}')">Track</button>
</div>

/* ===== END SPX ACTION BUTTONS UI ===== */

    /* ===============================
   SPX ACTION BUTTONS UI
   Buttons:
   - Create SPX Shipment
   - Print AWB PDF
   - Open Tracking Page

   Insert below:
   Tracking Number section
================================ */

<div style="margin:10px 0; display:flex; gap:8px; flex-wrap:wrap;">

  <button onclick="createSPXShipment('${order.external_id}', this)">
    Create SPX
  </button>

  <button onclick="openAWB('${order.external_id}')">
    Print AWB
  </button>

  <button onclick="openTracking('${order.external_id}')">
    Track
  </button>

</div>

/* ===== END SPX ACTION BUTTONS UI ===== */


    <hr>

    ${isLocked
      ? `<div style="color:green;font-weight:bold;">✔ Final Status: ${escapeHtml(order.order_status)}</div>`
      : `
        <label>Courier:</label>
        <select id="courierSelect">
          <option value="">Select Courier</option>
          <option value="SPX" ${order.courier === "SPX" ? "selected" : ""}>SPX</option>
          <option value="J&T" ${order.courier === "J&T" ? "selected" : ""}>J&T</option>
          <option value="Flash Express" ${order.courier === "Flash Express" ? "selected" : ""}>Flash Express</option>
          <option value="Lalamove / Same Day" ${order.courier === "Lalamove / Same Day" ? "selected" : ""}>Lalamove / Same Day</option>
          <option value="Pick Up" ${order.courier === "Pick Up" ? "selected" : ""}>Pick Up</option>
          <option value="Manual Delivery" ${order.courier === "Manual Delivery" ? "selected" : ""}>Manual Delivery</option>
        </select>

        <label>Tracking:</label>
        <input id="trackingInput" placeholder="Tracking number" value="${escapeAttribute(order.tracking_number || "")}">

        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">

          <button onclick="updateOrder('${order.external_id}', {
            order_status:'Processing',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this)">Processing</button>

          <button onclick="updateOrder('${order.external_id}', {
            order_status:'To Ship',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this)">To Ship</button>

          <button onclick="confirmUpdateOrder('${order.external_id}', {
            order_status:'Canceled',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this, 'Cancel this order?')">Cancel Order</button>

          <button onclick="updateOrder('${order.external_id}', {
            order_status:'Shipped',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this)">Shipped</button>

          <button onclick="updateOrder('${order.external_id}', {
            order_status:'In Transit',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this)">In Transit</button>

          <button onclick="confirmUpdateOrder('${order.external_id}', {
            order_status:'Delivered',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this, 'Mark as Delivered?')">Delivered</button>

          <button onclick="confirmUpdateOrder('${order.external_id}', {
            order_status:'Failed Delivery',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this, 'Mark as Failed Delivery?')">Failed Delivery</button>

          <button onclick="confirmUpdateOrder('${order.external_id}', {
            order_status:'Return to Seller',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this, 'Return to Seller?')">Return to Seller</button>

          <button onclick="confirmUpdateOrder('${order.external_id}', {
            order_status:'Returned',
            courier: document.getElementById('courierSelect').value,
            tracking_number: document.getElementById('trackingInput').value
          }, this, 'Mark as Returned? This will lock the order.')">Returned</button>

        </div>
      `
    }
  `;

  modal.style.display = "flex";
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (modal) modal.style.display = "none";
}

async function updateOrder(orderId, data, btn) {
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Updating...";
    }

    const res = await fetch("http://localhost:3000/api/orders/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderId,
        ...data
      })
    });

    const result = await res.json();

    if (result.success) {
      showToast("Order updated!", "success");

      if (data.order_status === "Shipped") {
        setTimeout(() => {
          updateOrder(orderId, { order_status: "In Transit" });
        }, 1500);
      }

      await loadAdminOrders();
      closeOrderModal();
    } else {
      showToast(result.message || "Update failed", "error");
    }

  } catch (err) {
    console.error(err);
    showToast("Server error", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Done";
    }
  }
}

function showConfirm(message, callback) {
  const modal = document.getElementById("confirmModal");
  const msg = document.getElementById("confirmMessage");
  const yesBtn = document.getElementById("confirmYesBtn");
  const noBtn = document.getElementById("confirmNoBtn");

  if (!modal || !msg || !yesBtn || !noBtn) {
    const fallback = confirm(message);
    if (fallback) callback();
    return;
  }

  msg.textContent = message;
  modal.style.display = "flex";
  confirmCallback = callback;

  yesBtn.onclick = () => {
    modal.style.display = "none";
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  };

  noBtn.onclick = () => {
    modal.style.display = "none";
    confirmCallback = null;
  };
}

function confirmUpdateOrder(orderId, data, btn, message) {
  showConfirm(message, () => {
    updateOrder(orderId, data, btn);
  });
}

window.loadAdminOrders = loadAdminOrders;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.updateOrder = updateOrder;
window.confirmUpdateOrder = confirmUpdateOrder;


/* ===============================
   SPX GLOBAL EXPORTS
================================ */

window.createSPXShipment = createSPXShipment;
window.openAWB = openAWB;
window.openTracking = openTracking;

/* ===== END SPX GLOBAL EXPORTS ===== */

loadAdminOrders();

function renderPickOrders() {
  const container = document.getElementById("pickOrdersList");
  const parcelCount = document.getElementById("parcelCount");

  if (!container) return;

  const orders = Array.isArray(adminOrders) ? adminOrders : [];

  const pickOrders = orders.filter((order) => {
    const status = String(order.order_status || order.status || "").toLowerCase();
    const payment = String(order.payment_provider || order.payment || order.payment_status || "").toLowerCase();

    return (
      status.includes("processing") ||
      status.includes("to ship") ||
      status.includes("paid") ||
      payment.includes("paid") ||
      payment.includes("cod") ||
      payment.includes("maya") ||
      payment.includes("xendit")
    );
  });

  if (parcelCount) parcelCount.textContent = pickOrders.length;

  if (!pickOrders.length) {
    container.innerHTML = `<div class="empty-box">No parcels ready for picking.</div>`;
    return;
  }

  container.innerHTML = pickOrders
    .map((order, index) => {
      const orderId = order.external_id || order.order_no || order.id || `ORDER-${index + 1}`;
      const customer = order.customer_name || order.customer || "Customer";
      const amount = order.amount || order.total || order.total_amount || 0;
      const status = order.order_status || order.status || "To Pick";
      const payment = order.payment_provider || order.payment || order.payment_status || "Payment";
      const items = Array.isArray(order.items) ? order.items : [];
      const safeOrderId = escapeAttribute(orderId);

      return `
        <div class="pick-order-card">
          <div class="pick-order-header" onclick="togglePickItems('${safeOrderId}')">
            <div>
              <strong>${escapeHtml(orderId)} | ${escapeHtml(customer)}</strong>
              <div class="pick-order-meta">
                ₱${escapeHtml(amount)} • ${escapeHtml(payment)} • ${escapeHtml(status)}
              </div>
            </div>

            <div class="pick-order-actions" onclick="event.stopPropagation()">
              <button class="small-btn" type="button">Packed</button>
              <button class="primary-btn" type="button">Waybill</button>
            </div>
          </div>

          <div id="items-${safeOrderId}" class="pick-order-items">
            ${items.length
          ? items.map((item) => {
            const image = item.image || item.img || item.photo || "https://via.placeholder.com/60?text=No+Image";
            const name = item.name || item.product_name || item.title || "Product";
            const qty = item.quantity || item.qty || 1;
            const location = item.location || item.shelf || "-";

            return `
                    <div class="pick-item">
                      <div class="pick-item-left">
                        <input type="checkbox">

                        <img
                          src="${escapeAttribute(image)}"
                          class="pick-item-img"
                          onerror="this.src='https://via.placeholder.com/60?text=No+Image'"
                        >

                        <span>
                          ${escapeHtml(name)} x${escapeHtml(qty)}
                        </span>
                      </div>

                      <span>${escapeHtml(location)}</span>
                    </div>
                  `;
          }).join("")
          : `<div class="empty-box">No item details found for this order.</div>`
        }
          </div>
        </div>
      `;
    })
    .join("");
}

function togglePickItems(orderId) {
  const itemBox = document.getElementById(`items-${orderId}`);
  if (itemBox) itemBox.classList.toggle("active");
}

window.renderPickOrders = renderPickOrders;
window.togglePickItems = togglePickItems;
