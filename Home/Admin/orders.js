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
let storePickupOrders = [];
let roroOrders = [];

let currentOrderFilter = "Processing";
let expandedOrderSummary = {};
let expandedOrderItems = {};
let currentOrdersPage = 1;
const ordersPerPage = 10;
const cancelledOrdersTableBody =
  document.getElementById("cancelledOrdersTableBody");
const storePickupOrdersTableBody =
  document.getElementById("storePickupOrdersTableBody");

const roroOrdersTableBody =
  document.getElementById("roroOrdersTableBody");
const returnRefundRequestsBody =
  document.getElementById("returnRefundRequestsBody");

let cancelledOrders = [];
const sellerInfo = {
  name: "Drin Electronics",
  address: "Pinalad Rd, Camachille St., Nagpayong, Brgy Pinagbuhatan Pasig City",
  phone: "09157765642",
  email: "drinelectronics@gmail.com"
};


function getCustomerFullAddress(order) {
  const address = order.address || {};

  if (typeof address === "string") {
    return address;
  }

  return [
    address.fullAddress,
    address.street,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
    address.country
  ]
    .filter(Boolean)
    .join(", ");
}

function printOrderInvoice(orderId) {
  const allActiveOrders = [
    ...adminOrders,
    ...storePickupOrders,
    ...roroOrders
  ];

  const order = allActiveOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  if (!order) {
    showToast("Order not found.", "error");
    return;
  }

  const customerAddress =
    getCustomerFullAddress(order) || "-";

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const calculatedSubtotal = items.reduce((sum, item) => {
    const price = Number(
      item.price ??
      item.unit_price ??
      item.unitPrice ??
      item.selling_price ??
      0
    );

    const quantity = Number(
      item.quantity ??
      item.qty ??
      item.quantityOrdered ??
      1
    );

    return sum + (price * quantity);
  }, 0);

  const subtotal =
    calculatedSubtotal > 0
      ? calculatedSubtotal
      : Number(order.subtotal || 0);

  const voucher = Number(
    order.voucher_discount ||
    order.voucherDiscount ||
    0
  );

  const shipping = Number(
    order.shipping_fee ||
    order.shippingFee ||
    0
  );

  const serviceFee = Number(
    order.service_fee ??
    order.serviceFee ??
    order.handling_fee ??
    order.handlingFee ??
    0
  );

  const total =
    subtotal -
    voucher +
    shipping +
    serviceFee;

  const paymentStatus =
    order.payment_status ||
    order.status ||
    "-";

  const courier =
    order.courier || "-";

  const tracking =
    order.tracking_number || "-";

  const itemsHtml = items.length
    ? items.map(item => {
      const itemName =
        item.name ||
        item.product_name ||
        item.title ||
        "Product";

      const variant =
        getItemVariant(item) || "-";

      const quantity =
        Number(item.quantity || item.qty || 1);

      const unitPrice =
        Number(
          item.price ||
          item.unit_price ||
          item.unitPrice ||
          item.selling_price ||
          0
        );

      const lineTotal =
        Number(
          item.total ||
          item.line_total ||
          item.lineTotal ||
          unitPrice * quantity
        );

      return `
          <tr>
            <td>
              <strong>${escapeHtml(itemName)}</strong>

              ${variant !== "-"
          ? `<div class="variant">
                      Variation: ${escapeHtml(variant)}
                    </div>`
          : ""
        }
            </td>

            <td class="center">
              ${quantity}
            </td>

            <td class="right">
              ₱${unitPrice.toLocaleString("en-PH", {
          minimumFractionDigits: 2
        })}
            </td>

            <td class="right">
              ₱${lineTotal.toLocaleString("en-PH", {
          minimumFractionDigits: 2
        })}
            </td>
          </tr>
        `;
    }).join("")
    : `
      <tr>
        <td colspan="4" class="center">
          No item details found.
        </td>
      </tr>
    `;

  const invoiceWindow =
    window.open("", "_blank");

  if (!invoiceWindow) {
    showToast(
      "Please allow popups to open the invoice.",
      "error"
    );
    return;
  }

  invoiceWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">

      <title>
        Invoice ${escapeHtml(orderId)}
      </title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 30px;
          background: #f3f4f6;
          color: #111827;
          font-family: Arial, sans-serif;
        }

        .invoice {
          width: 100%;
          max-width: 900px;
          margin: auto;
          padding: 40px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        }

        .invoice-header {
          display: flex;
          justify-content: space-between;
          gap: 30px;
          padding-bottom: 24px;
          border-bottom: 2px solid #2563eb;
        }

        .brand h1 {
          margin: 0 0 8px;
          color: #2563eb;
          font-size: 28px;
        }

        .brand p,
        .invoice-meta p {
          margin: 4px 0;
          color: #4b5563;
          font-size: 14px;
          line-height: 1.5;
        }

        .invoice-meta {
          text-align: right;
        }

        .invoice-title {
          margin: 0 0 10px;
          font-size: 24px;
          letter-spacing: 1px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 28px;
        }

        .details-box {
          padding: 18px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }

        .details-box h3 {
          margin: 0 0 12px;
          color: #2563eb;
          font-size: 15px;
          text-transform: uppercase;
        }

        .details-box p {
          margin: 6px 0;
          line-height: 1.5;
          font-size: 14px;
        }

        table {
          width: 100%;
          margin-top: 28px;
          border-collapse: collapse;
        }

        th {
          padding: 12px;
          background: #2563eb;
          color: #ffffff;
          font-size: 13px;
          text-align: left;
        }

        td {
          padding: 14px 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
          vertical-align: top;
        }

        .variant {
          margin-top: 5px;
          color: #6b7280;
          font-size: 12px;
        }

        .center {
          text-align: center;
        }

        .right {
          text-align: right;
        }

        .summary-area {
          display: flex;
          justify-content: flex-end;
          margin-top: 25px;
        }

        .summary {
          width: 100%;
          max-width: 380px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 9px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }

        .summary-row.voucher {
          color: #16a34a;
        }

        .summary-row.service {
          color: #7c3aed;
        }

        .summary-row.total {
          margin-top: 8px;
          padding: 14px 0;
          border-top: 2px solid #2563eb;
          border-bottom: none;
          color: #2563eb;
          font-size: 19px;
          font-weight: 700;
        }

        .shipping-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 28px;
          padding: 18px;
          background: #eff6ff;
          border-radius: 12px;
          font-size: 14px;
        }

        .shipping-info p {
          margin: 5px 0;
        }

        .invoice-footer {
          margin-top: 35px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          text-align: center;
          font-size: 13px;
        }

        .invoice-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin: 25px auto;
        }

        .invoice-actions button {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          background: #2563eb;
          color: #ffffff;
          cursor: pointer;
          font-weight: 700;
        }

        .invoice-actions button.secondary {
          background: #111827;
        }

        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }

          .invoice {
            max-width: none;
            padding: 20px;
            border-radius: 0;
            box-shadow: none;
          }

          .invoice-actions {
            display: none;
          }
        }

        @media (max-width: 650px) {
          body {
            padding: 12px;
          }

          .invoice {
            padding: 22px;
          }

          .invoice-header,
          .details-grid,
          .shipping-info {
            grid-template-columns: 1fr;
            display: grid;
          }

          .invoice-meta {
            text-align: left;
          }
        }
      </style>
    </head>

    <body>
      <div class="invoice">

        <div class="invoice-header">
          <div class="brand">
            <h1>
              ${escapeHtml(sellerInfo.name)}
            </h1>

            <p>
              ${escapeHtml(sellerInfo.address)}
            </p>

            <p>
              ${escapeHtml(sellerInfo.phone)}
            </p>

            <p>
              ${escapeHtml(sellerInfo.email)}
            </p>
          </div>

          <div class="invoice-meta">
            <h2 class="invoice-title">
              INVOICE
            </h2>

            <p>
              <strong>Invoice No.:</strong>
              ${escapeHtml(orderId)}
            </p>

            <p>
              <strong>Date:</strong>
              ${order.created_at
      ? escapeHtml(
        new Date(
          order.created_at
        ).toLocaleString("en-PH")
      )
      : "-"
    }
            </p>

            <p>
              <strong>Status:</strong>
              ${escapeHtml(order.order_status || "-")}
            </p>
          </div>
        </div>

        <div class="details-grid">
          <div class="details-box">
            <h3>Seller Details</h3>

            <p>
              <strong>
                ${escapeHtml(sellerInfo.name)}
              </strong>
            </p>

            <p>
              ${escapeHtml(sellerInfo.address)}
            </p>

            <p>
              ${escapeHtml(sellerInfo.phone)}
            </p>

            <p>
              ${escapeHtml(sellerInfo.email)}
            </p>
          </div>

          <div class="details-box">
            <h3>Bill To</h3>

            <p>
              <strong>
                ${escapeHtml(
      order.customer_name || "-"
    )}
              </strong>
            </p>

            <p>
              ${escapeHtml(
      order.customer_phone || "-"
    )}
            </p>

            <p>
              ${escapeHtml(customerAddress)}
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th class="center">Qty</th>
              <th class="right">Unit Price</th>
              <th class="right">Amount</th>
            </tr>
          </thead>

          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary-area">
          <div class="summary">

            <div class="summary-row">
              <span>Subtotal</span>

              <strong>
                ₱${subtotal.toLocaleString("en-PH", {
      minimumFractionDigits: 2
    })}
              </strong>
            </div>

            <div class="summary-row voucher">
              <span>Voucher Discount</span>

              <strong>
                -₱${voucher.toLocaleString("en-PH", {
      minimumFractionDigits: 2
    })}
              </strong>
            </div>

            <div class="summary-row">
              <span>Shipping Fee</span>

              <strong>
                ₱${shipping.toLocaleString("en-PH", {
      minimumFractionDigits: 2
    })}
              </strong>
            </div>

            <div class="summary-row service">
              <span>Service Fee</span>

              <strong>
                ₱${serviceFee.toLocaleString("en-PH", {
      minimumFractionDigits: 2
    })}
              </strong>
            </div>

            <div class="summary-row total">
              <span>Grand Total</span>

              <span>
                ₱${total.toLocaleString("en-PH", {
      minimumFractionDigits: 2
    })}
              </span>
            </div>
          </div>
        </div>

        <div class="shipping-info">
          <div>
            <p>
              <strong>Payment:</strong>
              ${escapeHtml(paymentStatus)}
            </p>

            <p>
              <strong>Courier:</strong>
              ${escapeHtml(courier)}
            </p>
          </div>

          <div>
            <p>
              <strong>Tracking Number:</strong>
              ${escapeHtml(tracking)}
            </p>

            <p>
              <strong>Order Number:</strong>
              ${escapeHtml(orderId)}
            </p>
          </div>
        </div>

        <div class="invoice-footer">
          <strong>Temporary Document Notice:</strong><br>
          This invoice is for order reference only and is not yet a BIR-registered official invoice.
          Shipping charges shown are temporary references and remain subject to final accounting treatment.
        </div>
      </div>

      <div class="invoice-actions">
        <button onclick="window.print()">
          Print Invoice
        </button>

        <button
          class="secondary"
          onclick="window.print()"
        >
          Save as PDF
        </button>
      </div>
    </body>
    </html>
  `);

  invoiceWindow.document.close();
}

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

function setButtonLoading(button, loadingText = "Updating...") {
  if (!button) return;

  button.dataset.originalHtml =
    button.dataset.originalHtml || button.innerHTML;

  button.disabled = true;

  button.innerHTML = `
    <span class="admin-btn-spinner"></span>
    ${escapeHtml(loadingText)}
  `;
}

function resetButtonLoading(button) {
  if (!button) return;

  button.disabled = false;
  button.innerHTML =
    button.dataset.originalHtml || "Update";

  delete button.dataset.originalHtml;
}

if (!document.getElementById("admin-button-spinner-style")) {
  const style = document.createElement("style");

  style.id = "admin-button-spinner-style";

  style.textContent = `
    .admin-btn-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-right: 6px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      vertical-align: -2px;
      animation: adminButtonSpin 0.7s linear infinite;
    }

    @keyframes adminButtonSpin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.head.appendChild(style);
}

/* ===============================
   STATUS CLASS
================================ */

function getOrderStatusClass(status) {
  if (status === "PAID") return "status-paid";

  if (
    status === "Pending" ||
    status === "Pending Payment"
  ) {
    return "status-pending";
  }

  if (status === "Processing") return "status-processing";
  if (status === "Packed") return "status-processing";
  if (status === "To Ship") return "status-processing";
  if (status === "Shipped") return "status-shipped";
  if (status === "Failed Delivery") return "status-inactive";
  if (status === "In Transit") return "status-shipped";
  if (status === "Delivered") return "status-delivered";
  if (status === "Cancelled") return "status-inactive";
  if (status === "Expired") return "status-inactive";

  return "status-default";
}

/* ===============================
   SUMMARY
================================ */

function updateOrdersSummary() {
  if (ordersTotalCount) {
    ordersTotalCount.textContent = adminOrders.length;
  }

  if (ordersPendingCount) {
    ordersPendingCount.textContent =
      adminOrders.filter(order =>
        order.order_status === "Pending" ||
        order.order_status === "Pending Payment"
      ).length;
  }

  if (ordersPaidCount) {
    ordersPaidCount.textContent =
      adminOrders.filter(order =>
        String(
          order.payment_status ||
          order.status ||
          ""
        ).toUpperCase() === "PAID"
      ).length;
  }

  if (ordersToShipCount) {
    ordersToShipCount.textContent =
      adminOrders.filter(order =>
        order.order_status === "Processing" ||
        order.order_status === "Packed" ||
        order.order_status === "To Ship"
      ).length;
  }
}

function updateDashboardOrders() {
  if (dashboardToShip) {
    dashboardToShip.textContent =
      adminOrders.filter(order =>
        order.order_status === "Processing" ||
        order.order_status === "Packed" ||
        order.order_status === "To Ship"
      ).length;
  }

  if (dashboardShipped) {
    dashboardShipped.textContent =
      adminOrders.filter(order =>
        order.order_status === "Shipped" ||
        order.order_status === "In Transit"
      ).length;
  }

  if (dashboardDelivered) {
    dashboardDelivered.textContent =
      adminOrders.filter(order =>
        order.order_status === "Delivered"
      ).length;
  }
}

function updateOrderFilterCounts() {
  const counts = {
    all: adminOrders.length,
    pendingCod: 0,
    pendingSkyro: 0,
    awaitingSkyroApplication: 0,
    approvedSkyro: 0,
    processing: 0,
    packed: 0,
    shipped: 0,
    inTransit: 0,
    delivered: 0,
    paid: 0,
    pendingPayment: 0,
    failedDelivery: 0,
    expired: 0
  };

  adminOrders.forEach(order => {
    const orderStatus = String(
      order.order_status || ""
    ).trim().toLowerCase();

    const paymentStatus = String(
      order.payment_status ||
      order.status ||
      order.xendit_status ||
      ""
    ).trim().toLowerCase();

    const paymentMethod = String(
      order.payment_provider ||
      order.paymentProvider ||
      order.payment_method ||
      order.paymentMethod ||
      order.payment_type ||
      order.payment_option ||
      order.payment_channel ||
      order.method ||
      ""
    ).trim().toLowerCase();

    const paymentText =
      `${paymentStatus} ${paymentMethod}`;

    const isCOD =
      paymentText.includes("cod") ||
      paymentText.includes("cash on delivery");

    const isSkyro =
      paymentText.includes("skyro");

    const createdTime =
      new Date(order.created_at).getTime();

    const explicitExpiryTime =
      new Date(
        order.expires_at ||
        order.expiry_date ||
        order.invoice_expiry_date ||
        ""
      ).getTime();

    const fallbackExpiryTime =
      Number.isFinite(createdTime)
        ? createdTime + 60 * 60 * 1000
        : NaN;

    const expiryTime =
      Number.isFinite(explicitExpiryTime)
        ? explicitExpiryTime
        : fallbackExpiryTime;

    const isPendingOnlinePayment =
      !isCOD &&
      (
        orderStatus === "pending payment" ||
        paymentStatus === "pending" ||
        paymentStatus === "pending payment"
      );

    const isTimedOut =
      isPendingOnlinePayment &&
      Number.isFinite(expiryTime) &&
      Date.now() > expiryTime;

    const isExpired =
      orderStatus === "expired" ||
      orderStatus === "payment expired" ||
      paymentStatus.includes("expired") ||
      isTimedOut;

    if (isCOD && orderStatus === "pending") {
      counts.pendingCod++;
    }

    if (
      isSkyro &&
      [
        "pending stock confirmation",
        "pending skyro approval",
        "pending skyro application"
      ].includes(orderStatus)
    ) {
      counts.pendingSkyro++;
    }

    if (
      isSkyro &&
      orderStatus === "skyro application allowed"
    ) {
      counts.awaitingSkyroApplication++;
    }

    if (
      isSkyro &&
      orderStatus === "skyro approved"
    ) {
      counts.approvedSkyro++;
    }

    if (orderStatus === "processing") {
      counts.processing++;
    }

    if (orderStatus === "packed") {
      counts.packed++;
    }

    if (orderStatus === "shipped") {
      counts.shipped++;
    }

    if (orderStatus === "in transit") {
      counts.inTransit++;
    }

    if (orderStatus === "delivered") {
      counts.delivered++;
    }

    if (paymentStatus === "paid") {
      counts.paid++;
    }

    if (
      !isCOD &&
      !isExpired &&
      (
        orderStatus === "pending payment" ||
        paymentStatus === "pending" ||
        paymentStatus === "pending payment"
      )
    ) {
      counts.pendingPayment++;
    }

    if (orderStatus === "failed delivery") {
      counts.failedDelivery++;
    }

    if (isExpired) {
      counts.expired++;
    }
  });

  const countMap = {
    countAll: counts.all,
    countPendingCod: counts.pendingCod,
    countPendingSkyro: counts.pendingSkyro,
    countAwaitingSkyroApplication:
      counts.awaitingSkyroApplication,
    countApprovedSkyro: counts.approvedSkyro,
    countProcessing: counts.processing,
    countPacked: counts.packed,
    countShipped: counts.shipped,
    countInTransit: counts.inTransit,
    countDelivered: counts.delivered,
    countPaid: counts.paid,
    countPendingPayment: counts.pendingPayment,
    countFailedDelivery: counts.failedDelivery,
    countExpired: counts.expired
  };

  Object.entries(countMap).forEach(([id, count]) => {
    const badge = document.getElementById(id);

    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "inline-flex" : "none";
    }
  });
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
      const selectedFilter = String(
        currentOrderFilter || ""
      ).trim().toLowerCase();

      const orderStatus = String(
        order.order_status || ""
      ).trim().toLowerCase();

      const paymentStatus = String(
        order.payment_status ||
        order.status ||
        order.xendit_status ||
        ""
      ).trim().toLowerCase();

      const paymentMethod = String(
        order.payment_method ||
        order.paymentMethod ||
        order.payment_type ||
        order.payment_option ||
        order.payment_channel ||
        order.method ||
        ""
      ).trim().toLowerCase();

      const paymentText =
        `${paymentStatus} ${paymentMethod}`;

      const isCOD =
        paymentText.includes("cod") ||
        paymentText.includes("cash on delivery");

      const createdTime =
        new Date(order.created_at).getTime();

      const explicitExpiryTime =
        new Date(
          order.expires_at ||
          order.expiry_date ||
          order.invoice_expiry_date ||
          ""
        ).getTime();

      const fallbackExpiryTime =
        Number.isFinite(createdTime)
          ? createdTime + 60 * 60 * 1000
          : NaN;

      const expiryTime =
        Number.isFinite(explicitExpiryTime)
          ? explicitExpiryTime
          : fallbackExpiryTime;

      const explicitlyExpired =
        orderStatus === "expired" ||
        paymentStatus.includes("expired");

      const pendingOnlinePayment =
        !isCOD &&
        (
          paymentStatus === "pending" ||
          paymentStatus === "pending payment" ||
          orderStatus === "pending payment"
        );

      const timedOut =
        pendingOnlinePayment &&
        Number.isFinite(expiryTime) &&
        Date.now() > expiryTime;

      const isExpired =
        explicitlyExpired || timedOut;

      if (selectedFilter === "pending skyro") {
        return (
          paymentText.includes("skyro") &&
          [
            "pending stock confirmation",
            "pending skyro approval",
            "pending skyro application"
          ].includes(orderStatus)
        );
      }

      if (
        selectedFilter ===
        "awaiting customer application"
      ) {
        return (
          paymentText.includes("skyro") &&
          orderStatus ===
          "skyro application allowed"
        );
      }

      if (selectedFilter === "skyro approved") {
        return (
          paymentText.includes("skyro") &&
          orderStatus === "skyro approved"
        );
      }

      if (selectedFilter === "expired") {
        return isExpired;
      }

      if (
        selectedFilter === "pending" ||
        selectedFilter === "pending cod"
      ) {
        return isCOD && orderStatus === "pending";
      }

      if (selectedFilter === "pending payment") {
        return !isCOD && !isExpired && (
          orderStatus === "pending payment" ||
          paymentStatus === "pending" ||
          paymentStatus === "pending payment"
        );
      }

      return (
        orderStatus === selectedFilter ||
        paymentStatus === selectedFilter
      );
    });

  }

  filteredOrders.sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  const startIndex =
    (currentOrdersPage - 1) * ordersPerPage;

  const paginatedOrders =
    filteredOrders.slice(
      startIndex,
      startIndex + ordersPerPage
    );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ordersPerPage)
  );

  if (!filteredOrders.length) {
    adminOrdersTableBody.innerHTML = `<div class="empty-box">No orders found.</div>`;
    return;
  }

  adminOrdersTableBody.innerHTML = paginatedOrders.map(order => {


    const orderId = order.external_id || order.id || "";

    const isSummaryExpanded =
      expandedOrderSummary[orderId] === true;

    const paymentStatus =
      order.payment_status ||
      order.status ||
      "Pending Payment";

    const orderStatus =
      order.order_status ||
      "Pending";

    const items = getOrderItems(order);
    const isExpanded = expandedOrderItems[orderId];
    const visibleItems =
      isExpanded
        ? items
        : items.slice(0, 2);

    const hasOrderRequest =
      order.order_request_status &&
      String(order.order_request_status).trim() !== "";

    const calculatedSubtotal = items.reduce((sum, item) => {
      const price = Number(
        item.price ??
        item.unit_price ??
        item.unitPrice ??
        item.selling_price ??
        0
      );

      const quantity = Number(
        item.quantity ??
        item.qty ??
        item.quantityOrdered ??
        1
      );

      return sum + (price * quantity);
    }, 0);

    const subtotal =
      calculatedSubtotal > 0
        ? calculatedSubtotal
        : Number(order.subtotal || 0);

    const voucher =
      Number(order.voucher_discount || 0);

    const shipping =
      Number(order.shipping_fee || 0);

    const serviceFee =
      Number(
        order.service_fee ??
        order.serviceFee ??
        order.handling_fee ??
        order.handlingFee ??
        0
      );

    const total =
      subtotal -
      voucher +
      shipping +
      serviceFee;

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

            ${items.length > 2
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


<div
  class="warehouse-order-info summary-box"
  style="
    border-top:1px solid #e5e7eb;
    padding-top:10px;
    margin-top:10px;
  "
>

  <div>
    <span style="
      font-size:12px;
      font-weight:600;
      color:#6b7280;
    ">
      Subtotal
    </span>

    <strong>
      ₱${subtotal.toLocaleString("en-PH")}
    </strong>
  </div>

  ${isSummaryExpanded ? `

  <div>
    <span style="color:#16a34a;">Voucher</span>
    <strong style="color:#16a34a;">
      -₱${voucher.toLocaleString("en-PH")}
    </strong>
  </div>

  <div>
    <span style="color:#f59e0b;">Shipping</span>
    <strong>
      ₱${shipping.toLocaleString("en-PH")}
    </strong>
  </div>

  <div>
    <span style="color:#7c3aed;">Service Fee</span>
    <strong style="color:#7c3aed;">
      ₱${serviceFee.toLocaleString("en-PH")}
    </strong>
  </div>

  <div>
    <span>Total</span>

    <strong style="
      font-size:16px;
      color:#2563eb;
    ">
      ₱${total.toLocaleString("en-PH")}
    </strong>
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
` : ""}

<button
  class="show-more-items-btn"
  type="button"
  onclick="toggleOrderSummary('${escapeAttribute(orderId)}')"
>
  ${isSummaryExpanded ? "Hide Summary" : "Show Summary"}
</button>

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
    class="mini-manage-btn"
    type="button"
    onclick="openOrderModal('${escapeAttribute(orderId)}')"
  >
    Manage Order
  </button>

</div>

</div>
</div>
          
    `;
  }).join("");

  adminOrdersTableBody.innerHTML += `
  <div
    style="
      display:flex;
      justify-content:center;
      align-items:center;
      gap:12px;
      margin-top:18px;
      padding:12px;
    "
  >
    <button
      type="button"
      class="secondary-btn"
      onclick="changeOrdersPage(-1)"
      ${currentOrdersPage <= 1 ? "disabled" : ""}
    >
      Previous
    </button>

    <span style="font-weight:700;">
      Page ${currentOrdersPage} of ${totalPages}
    </span>

    <button
      type="button"
      class="secondary-btn"
      onclick="changeOrdersPage(1)"
      ${currentOrdersPage >= totalPages ? "disabled" : ""}
    >
      Next
    </button>
  </div>
`;

}

function renderStorePickupOrders() {
  if (!storePickupOrdersTableBody) return;

  if (!storePickupOrders.length) {
    storePickupOrdersTableBody.innerHTML = `
      <div class="empty-box">
        No store pickup orders yet.
      </div>
    `;
    return;
  }

  const sortedOrders = [...storePickupOrders].sort(
    (a, b) =>
      new Date(b.created_at) -
      new Date(a.created_at)
  );

  storePickupOrdersTableBody.innerHTML =
    sortedOrders.map(order => {
      const orderId =
        order.external_id ||
        order.id ||
        "";

      const orderStatus =
        order.order_status ||
        "Pending";

      const amount = Number(
        order.amount ||
        order.total ||
        0
      );

      return `
        <div class="warehouse-order-card">

          <div class="warehouse-order-head">
            <span>
              <strong>
                ${escapeHtml(orderId || "-")}
              </strong>
              <br>
              ${escapeHtml(
        order.customer_name ||
        "Customer"
      )}
            </span>

            <span class="status-badge ${getOrderStatusClass(orderStatus)}">
              ${escapeHtml(orderStatus)}
            </span>
          </div>

          <div class="warehouse-order-info summary-box">

            <div>
              <span>Phone</span>
              <strong>
                ${escapeHtml(
        order.customer_phone || "-"
      )}
              </strong>
            </div>

            <div>
              <span>Amount</span>
              <strong>
                ₱${amount.toLocaleString("en-PH")}
              </strong>
            </div>

            <div>
              <span>Payment</span>
              <strong>
                ${escapeHtml(
        order.payment_status ||
        order.status ||
        "-"
      )}
              </strong>
            </div>

            <div>
  <span>Courier</span>
  <strong>Store Pickup</strong>
</div>

</div>

<div
  style="
    display:flex;
    justify-content:flex-end;
    margin-top:10px;
  "
>
  <button
    class="mini-manage-btn"
    type="button"
    onclick="openOrderModal('${escapeAttribute(orderId)}')"
  >
    Manage Order
  </button>
</div>

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

function toggleOrderSummary(orderId) {
  expandedOrderSummary[orderId] =
    !expandedOrderSummary[orderId];

  renderAdminOrders();
}

function changeOrdersPage(direction) {
  const filteredOrders = adminOrders.filter(order => {
    if (currentOrderFilter === "ALL") {
      return true;
    }

    const selectedFilter = String(
      currentOrderFilter || ""
    ).trim().toLowerCase();

    const orderStatus = String(
      order.order_status || ""
    ).trim().toLowerCase();

    const paymentStatus = String(
      order.payment_status ||
      order.status ||
      order.xendit_status ||
      ""
    ).trim().toLowerCase();

    const paymentMethod = String(
      order.payment_provider ||
      order.paymentProvider ||
      order.payment_method ||
      order.paymentMethod ||
      order.payment_type ||
      order.payment_option ||
      order.payment_channel ||
      order.method ||
      ""
    ).trim().toLowerCase();

    const paymentText =
      `${paymentStatus} ${paymentMethod} `;

    const isCOD =
      paymentText.includes("cod") ||
      paymentText.includes("cash on delivery");

    if (selectedFilter === "pending skyro") {
      return (
        paymentText.includes("skyro") &&
        [
          "pending stock confirmation",
          "skyro application allowed",
          "pending skyro approval",
          "pending skyro application"
        ].includes(orderStatus)
      );
    }

    if (selectedFilter === "skyro approved") {
      return (
        paymentText.includes("skyro") &&
        orderStatus === "skyro approved"
      );
    }

    if (
      selectedFilter === "pending" ||
      selectedFilter === "pending cod"
    ) {
      return isCOD && orderStatus === "pending";
    }

    return (
      orderStatus === selectedFilter ||
      paymentStatus === selectedFilter
    );
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredOrders.length / ordersPerPage)
  );

  currentOrdersPage += direction;

  if (currentOrdersPage < 1) {
    currentOrdersPage = 1;
  }

  if (currentOrdersPage > totalPages) {
    currentOrdersPage = totalPages;
  }

  renderAdminOrders();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ===============================
   LOAD ORDERS
================================ */

function normalizeOrder(order) {
  const paymentStatus =
    order.payment_status ||
    order.status ||
    order.xendit_status ||
    "";

  const paymentMethod =
    order.payment_provider ||
    order.paymentProvider ||
    order.payment_method ||
    order.paymentMethod ||
    order.payment_type ||
    order.payment_option ||
    order.payment_channel ||
    order.method ||
    "";

  const paymentText = String(
    `${paymentStatus} ${paymentMethod} `
  )
    .trim()
    .toUpperCase();

  const isCOD =
    paymentText.includes("COD") ||
    paymentText.includes("CASH ON DELIVERY");

  const isSkyro =
    paymentText.includes("SKYRO");

  const isPaid =
    (
      paymentText === "PAID" ||
      paymentText.includes(" PAID")
    ) &&
    !paymentText.includes("UNPAID");

  const isPaymentExpired =
    paymentText.includes("EXPIRED") ||
    paymentText.includes("PAYMENT EXPIRED");

  let orderStatus = String(
    order.order_status || ""
  ).trim();

  if (isSkyro) {
    if (
      !orderStatus ||
      orderStatus === "Pending Payment" ||
      orderStatus === "Pending" ||
      orderStatus === "Pending Skyro Application"
    ) {
      orderStatus = "Pending Stock Confirmation";
    }

  } else if (isCOD) {
    if (
      !orderStatus ||
      orderStatus === "Pending Payment" ||
      orderStatus === "Pending"
    ) {
      orderStatus = "Pending";
    }

  } else if (isPaymentExpired) {
    orderStatus = "Expired";

  } else if (isPaid) {
    if (
      !orderStatus ||
      orderStatus === "Pending Payment" ||
      orderStatus === "Pending"
    ) {
      orderStatus = "Processing";
    }

  } else if (!orderStatus) {
    orderStatus = "Pending Payment";
  }

  return {
    ...order,

    order_id:
      order.external_id ||
      order.order_id ||
      order.id,

    payment_status:
      isSkyro
        ? (
          String(paymentStatus).trim() ||
          (
            String(orderStatus).toLowerCase() === "skyro approved"
              ? "Skyro Approved"
              : "Pending Skyro Approval"
          )
        )
        : paymentStatus || (isCOD ? "COD" : "Pending Payment"),

    payment_method: paymentMethod,
    order_status: orderStatus,

    subtotal: Number(order.subtotal || 0),

    shipping_fee: Number(
      order.shipping_fee ||
      order.shippingFee ||
      0
    ),

    service_fee: Number(
      order.service_fee ??
      order.serviceFee ??
      order.handling_fee ??
      order.handlingFee ??
      0
    ),

    voucher_discount: Number(
      order.voucher_discount ||
      order.voucherDiscount ||
      0
    ),

    amount: Number(
      order.amount ||
      order.total ||
      0
    ),

    items: Array.isArray(order.items)
      ? order.items
      : []
  };
}

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
    const activeOrders = data.orders
      .map(normalizeOrder)
      .filter(order => order.order_status !== "Cancelled");

    storePickupOrders = activeOrders.filter(order => {
      const courier = String(
        order.courier || ""
      ).toLowerCase();

      const orderStatus = String(
        order.order_status || ""
      ).toLowerCase();

      const paymentStatus = String(
        order.payment_status || ""
      ).toLowerCase();

      const isExpired =
        orderStatus.includes("expired") ||
        paymentStatus.includes("expired");

      const isPickupFinished =
        orderStatus === "completed" ||
        orderStatus === "picked up";

      return (
        courier.includes("store pickup") &&
        !isExpired &&
        !isPickupFinished
      );
    });

    roroOrders = activeOrders.filter(order => {
      const courier = String(
        order.courier || ""
      ).toLowerCase();

      const orderStatus = String(
        order.order_status || ""
      ).toLowerCase();

      const paymentStatus = String(
        order.payment_status || ""
      ).toLowerCase();

      const isExpired =
        orderStatus.includes("expired") ||
        paymentStatus.includes("expired");

      return (
        courier.includes("roro") &&
        !isExpired
      );
    });

    const storePickupCount =
      document.getElementById("countStorePickup");

    const roroCount =
      document.getElementById("countRoroOrders");

    if (storePickupCount) {
      storePickupCount.textContent =
        storePickupOrders.length;

      storePickupCount.style.display =
        storePickupOrders.length > 0
          ? "inline-flex"
          : "none";
    }

    if (roroCount) {
      roroCount.textContent =
        roroOrders.length;

      roroCount.style.display =
        roroOrders.length > 0
          ? "inline-flex"
          : "none";
    }

    adminOrders = activeOrders.filter(order => {
      const courier = String(
        order.courier || ""
      ).toLowerCase();

      const orderStatus = String(
        order.order_status || ""
      ).toLowerCase();

      const paymentStatus = String(
        order.payment_status || ""
      ).toLowerCase();

      const isExpired =
        orderStatus.includes("expired") ||
        paymentStatus.includes("expired");

      const isCompletedPickup =
        courier.includes("store pickup") &&
        (
          orderStatus === "completed" ||
          orderStatus === "picked up"
        ) &&
        paymentStatus === "paid";

      return (
        isExpired ||
        isCompletedPickup ||
        (
          !courier.includes("store pickup") &&
          !courier.includes("roro")
        )
      );
    });

    renderAdminOrders();
    renderStorePickupOrders();
    updateOrdersSummary();
    updateDashboardOrders();
    updateOrderFilterCounts();

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

function getShipmentButton(order, orderId) {
  const orderStatus = String(
    order.order_status || ""
  ).trim().toLowerCase();

  const courier = String(
    order.courier || ""
  ).trim().toLowerCase();

  const isStorePickup =
    courier.includes("store pickup");

  const isSkyro =
    String(order.payment_method || "")
      .toLowerCase()
      .includes("skyro");

  const isSkyroApproved =
    orderStatus === "skyro approved";

  if (isStorePickup) {
    if (
      orderStatus === "completed" ||
      orderStatus === "picked up"
    ) {
      return `
      <button
        class="primary-btn"
        type="button"
        disabled
        style="
          opacity:0.55;
          cursor:not-allowed;
        "
      >
        Pickup Completed
      </button>
    `;
    }

    if (orderStatus === "ready for pickup") {
      return `
      <button
        class="primary-btn"
        type="button"
        onclick="completeStorePickup(
          '${escapeAttribute(orderId)}',
          this
        )"
      >
        Mark as Picked Up
      </button>
    `;
    }

    return `
    <button
      class="primary-btn"
      type="button"
      onclick="confirmStorePickup(
        '${escapeAttribute(orderId)}',
        this
      )"
    >
      Mark Ready for Pickup
    </button>
  `;
  }

  if (isSkyro && !isSkyroApproved) {
    return `
      <button
        class="primary-btn"
        type="button"
        disabled
        style="
          opacity:0.55;
          cursor:not-allowed;
        "
      >
        Waiting for Skyro Approval
      </button>
    `;
  }

  const shipmentAlreadyArranged =
    Boolean(order.shipment_arranged_at) ||
    Boolean(order.awb_link) ||
    Boolean(order.tracking_number) ||
    [
      "processing",
      "packed",
      "shipped",
      "in transit",
      "delivered"
    ].includes(orderStatus);

  if (shipmentAlreadyArranged) {
    return `
      <button
        class="primary-btn"
        type="button"
        disabled
        style="
          opacity:0.55;
          cursor:not-allowed;
        "
      >
        Shipment Arranged
      </button>
    `;
  }

  return `
    <button
      class="primary-btn"
      type="button"
      onclick="arrangeShipment(
        '${escapeAttribute(orderId)}',
        this
      )"
    >
      Arrange Shipment
    </button>
  `;
}

async function confirmStorePickup(orderId, btn) {
  try {
    setButtonLoading(btn, "Confirming Pickup...");

    const response = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          order_status: "Ready for Pickup",
          payment_status: "Pay at Store"
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Failed to confirm pickup order."
      );
    }

    showToast(
      "Order is now ready for pickup.",
      "success"
    );

    closeOrderModal();
    await loadAdminOrders();

  } catch (error) {
    console.error(error);

    showToast(
      error.message ||
      "Pickup confirmation failed.",
      "error"
    );

  } finally {
    resetButtonLoading(btn);
  }
}

async function completeStorePickup(orderId, btn) {
  const confirmed = confirm(
    "Confirm that the customer has paid and picked up the order?"
  );

  if (!confirmed) return;

  try {
    setButtonLoading(btn, "Completing Order...");

    const response = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderId,
          order_status: "Completed",
          payment_status: "PAID",
          picked_up_at: new Date().toISOString()
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Failed to complete pickup order."
      );
    }

    showToast(
      "Pickup completed. Order moved to Paid.",
      "success"
    );

    closeOrderModal();
    await loadAdminOrders();

  } catch (error) {
    console.error(error);

    showToast(
      error.message ||
      "Pickup completion failed.",
      "error"
    );

  } finally {
    resetButtonLoading(btn);
  }
}

function openOrderModal(orderId) {
  const allActiveOrders = [
    ...adminOrders,
    ...storePickupOrders,
    ...roroOrders
  ];

  const order = allActiveOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  if (!order) return;

  const modal = document.getElementById("orderModal");
  const content = document.getElementById("orderModalContent");

  if (!modal || !content) return;

  const address = order.address || {};

  const pinnedLat =
    order.delivery_lat ||
    address.deliveryLat ||
    address.lat ||
    "-";

  const pinnedLng =
    order.delivery_lng ||
    address.deliveryLng ||
    address.lng ||
    "-";

  const fullAddress =
    typeof address === "string"
      ? address
      : [
        address.fullAddress,
        address.barangay,
        address.city,
        address.province,
        address.country
      ].filter(Boolean).join(", ");

  const modalItems = Array.isArray(order.items)
    ? order.items
    : [];

  const modalCalculatedSubtotal = modalItems.reduce((sum, item) => {
    const price = Number(
      item.price ??
      item.unit_price ??
      item.unitPrice ??
      item.selling_price ??
      0
    );

    const quantity = Number(
      item.quantity ??
      item.qty ??
      item.quantityOrdered ??
      1
    );

    return sum + (price * quantity);
  }, 0);

  const modalSubtotal =
    modalCalculatedSubtotal > 0
      ? modalCalculatedSubtotal
      : Number(order.subtotal || 0);

  const modalVoucher = Number(
    order.voucher_discount ??
    order.voucherDiscount ??
    0
  );

  const modalShipping = Number(
    order.shipping_fee ??
    order.shippingFee ??
    0
  );

  const modalServiceFee = Number(
    order.service_fee ??
    order.serviceFee ??
    order.handling_fee ??
    order.handlingFee ??
    0
  );

  const modalTotal =
    modalSubtotal -
    modalVoucher +
    modalShipping +
    modalServiceFee;
  const isStorePickup =
    String(order.courier || "")
      .toLowerCase()
      .includes("store pickup");

  content.innerHTML = `

    <h3>Order: ${escapeHtml(order.external_id || order.id || "-")}</h3>

    <p><strong>Customer:</strong> ${escapeHtml(order.customer_name || "-")}</p>
    <p><strong>Phone:</strong> ${escapeHtml(order.customer_phone || "-")}</p>
    <p><strong>Address:</strong> ${escapeHtml(fullAddress || "-")}</p>

    ${String(order.courier || "").toLowerCase().includes("lalamove") ||
      String(order.courier || "").toLowerCase().includes("same day")
      ? `
        <div style="
          margin-top:10px;
          padding:10px;
          background:#fff7ed;
          border-radius:8px;
        ">
          <strong>Pinned Delivery Address</strong><br>
          ${escapeHtml(address.pinAddress || "-")}

          <br><br>
          <small>
            Coordinates: ${escapeHtml(pinnedLat)}, ${escapeHtml(pinnedLng)}
          </small>
        </div>
        `
      : ""
    }

    <p><strong>Amount:</strong> ₱${modalTotal.toLocaleString("en-PH")}</p>
    <p><strong>Status:</strong> ${escapeHtml(order.order_status || "Pending")}</p>
    <p>
  
<p>
  <strong>Courier:</strong>

  ${String(order.courier || "")
      .toLowerCase()
      .includes("store pickup")
      ? `
      <span style="
        background:#16a34a;
        color:#fff;
        padding:4px 8px;
        border-radius:8px;
        font-weight:700;
      ">
        STORE PICKUP
      </span>
    `
      : String(order.courier || "")
        .toLowerCase()
        .includes("lalamove") ||
        String(order.courier || "")
          .toLowerCase()
          .includes("same day")
        ? `
        <span style="
          background:#f97316;
          color:#fff;
          padding:4px 8px;
          border-radius:8px;
          font-weight:700;
        ">
          LALAMOVE / SAME DAY - MANUAL BOOKING
        </span>
      `
        : `
        <span style="
          background:#2563eb;
          color:#fff;
          padding:4px 8px;
          border-radius:8px;
          font-weight:700;
        ">
          ${escapeHtml(order.courier || "SPX")}
        </span>
      `
    }
</p>

    <p><strong>Tracking:</strong> ${escapeHtml(order.tracking_number || "-")}</p>

    ${String(order.payment_method || "")
      .toUpperCase()
      .includes("SKYRO")
      ? `
    <div style="
      margin-top:14px;
      padding:14px;
      background:#f5f3ff;
      border:1px solid #ddd6fe;
      border-radius:12px;
    ">
      <div style="
        margin-bottom:10px;
        font-weight:700;
        color:#4c1d95;
      ">
        Skyro Application
      </div>

      <p style="
        margin:0 0 12px;
        color:#6b21a8;
      ">
        Status:
        <strong>
          ${escapeHtml(
        order.skyro_status ||
        order.order_status ||
        "Pending Stock Confirmation"
      )}
        </strong>
      </p>

      ${order.skyro_application_link
        ? `
          <div style="
            display:flex;
            gap:8px;
            flex-wrap:wrap;
          ">
            <button
              type="button"
              class="primary-btn"
              disabled
              style="
                opacity:0.55;
                cursor:not-allowed;
              "
            >
              Application Link Created
            </button>

            <button
              type="button"
              class="secondary-btn"
              onclick="window.open(
                '${escapeAttribute(order.skyro_application_link)}',
                '_blank'
              )"
            >
              View Skyro Link
            </button>
          </div>
        `
        : String(order.order_status || "") ===
          "Pending Stock Confirmation"
          ? `
            <button
              type="button"
              class="primary-btn"
              onclick="confirmSkyroStock(
                '${escapeAttribute(orderId)}',
                this
              )"
            >
              Confirm Stock & Create Skyro Link
            </button>
          `
          : `
            <button
              type="button"
              class="primary-btn"
              disabled
              style="
                opacity:0.55;
                cursor:not-allowed;
              "
            >
              Waiting for Skyro Application
            </button>
          `
      }
    </div>
  `
      : ""
    }

    <div class="order-modal-actions">

      ${getShipmentButton(order, orderId)}


${!isStorePickup ? `
  <button
    class="small-btn"
    type="button"
    onclick="markOrderPacked(
      '${escapeAttribute(orderId)}',
      this
    )"
  >
    Mark Packed
  </button>
` : ""}

${!isStorePickup ? `
  <button
    class="small-btn"
    type="button"
    onclick="markOrderShipped(
      '${escapeAttribute(orderId)}',
      this
    )"
  >
    Mark Shipped
  </button>

  <button
    class="small-btn"
    type="button"
    onclick="markOrderInTransit(
      '${escapeAttribute(orderId)}',
      this
    )"
  >
    In Transit
  </button>

  <button
    class="danger-btn"
    type="button"
    onclick="markOrderFailed(
      '${escapeAttribute(orderId)}',
      this
    )"
  >
    Failed Delivery
  </button>

  <button
    class="small-btn"
    type="button"
    onclick="markOrderDelivered(
      '${escapeAttribute(orderId)}',
      this
    )"
  >
    Mark Delivered
  </button>

  <button
    class="secondary-btn"
    type="button"
    onclick="openAWB(
      '${escapeAttribute(orderId)}'
    )"
  >
    Print AWB
  </button>
` : ""}

<button
  class="secondary-btn"
  type="button"
  onclick="printOrderInvoice('${escapeAttribute(orderId)}')"
>
  Print Invoice
</button>

      ${!isStorePickup ? `
  <button
    class="secondary-btn"
    type="button"
    onclick="openTracking(
      '${escapeAttribute(orderId)}'
    )"
  >
    Track Order
  </button>
` : ""}

      ${order.order_request_status ? `
        <button class="small-btn" type="button" onclick="handleOrderRequestAction('${escapeAttribute(orderId)}')">
          Customer Request
        </button>
      ` : ""}
    </div>

    <div class="order-cancel-actions">
      <select id="cancelReason-${escapeAttribute(orderId)}" class="cancel-reason-dropdown">
        <option value="">Select reason</option>
        <option>Out of stock</option>
        <option>Price error</option>
        <option>Wrong item listing</option>
        <option>Cannot fulfill order</option>
        <option>Customer unreachable</option>
        <option>Other reason</option>
      </select>

      <button class="danger-btn" type="button" onclick="cancelOrder('${escapeAttribute(orderId)}', this)">
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

async function confirmSkyroStock(orderId, btn) {
  const ok = confirm(
    "Confirm na available ang stock at gumawa ng Skyro application link?"
  );

  if (!ok) return;

  try {
    setButtonLoading(btn, "Creating Skyro Link...");

    const response = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/skyro-create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Failed to create Skyro application."
      );
    }

    showToast(
      result.alreadyCreated
        ? "Skyro application link already exists."
        : "Stock confirmed and Skyro link created.",
      "success"
    );

    closeOrderModal();
    await loadAdminOrders();

  } catch (error) {
    console.error(
      "Skyro create application error:",
      error
    );

    showToast(
      error.message ||
      "Skyro application server error.",
      "error"
    );

  } finally {
    resetButtonLoading(btn);
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
    setButtonLoading(btn, "Cancelling...");

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
    resetButtonLoading(btn);
  }
}

async function createSPXShipment(orderId, btn) {
  try {
    const order = adminOrders.find(o =>
      String(o.external_id || o.id) === String(orderId)
    );

    if (!order) {
      showToast("Order not found", "error");
      return;
    }

    const paymentStatus = String(
      order.payment_status ||
      order.status ||
      ""
    ).toUpperCase();

    const isCOD =
      paymentStatus.includes("COD");

    const isPaid =
      paymentStatus === "PAID";

    const isSkyroApproved =
      String(order.payment_method || "")
        .toUpperCase()
        .includes("SKYRO") &&
      String(order.order_status || "")
        .toUpperCase() === "SKYRO APPROVED";

    if (
      !isCOD &&
      !isPaid &&
      !isSkyroApproved
    ) {
      showToast(
        String(order.payment_method || "")
          .toUpperCase()
          .includes("SKYRO")
          ? "Skyro application must be approved before arranging shipment."
          : "Only COD, PAID, or Skyro Approved orders can arrange shipment.",
        "error"
      );

      return;
    }

    setButtonLoading(btn, "Arranging Shipment...");

    /*
      STEP 1:
      Gumawa ng SPX shipment / waybill.
    */
    const shipmentResponse = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/spx-create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const shipmentResult =
      await shipmentResponse.json();

    if (!shipmentResponse.ok || !shipmentResult.success) {
      throw new Error(
        shipmentResult.message ||
        "SPX shipment failed"
      );
    }

    /*
      STEP 2:
      Pag successful ang Arrange Shipment,
      Processing muna—not Shipped.
    */
    const updateResponse = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          orderId,
          order_status: "Processing",
          shipment_arranged_at:
            new Date().toISOString()
        })
      }
    );

    const updateResult =
      await updateResponse.json();

    if (!updateResponse.ok || !updateResult.success) {
      throw new Error(
        updateResult.message ||
        "Shipment created but status update failed"
      );
    }

    showToast(
      "Shipment arranged. Order moved to Processing.",
      "success"
    );

    closeOrderModal();
    await loadAdminOrders();

  } catch (error) {
    console.error(
      "SPX shipment error:",
      error
    );

    showToast(
      error.message || "SPX server error",
      "error"
    );

  } finally {
    resetButtonLoading(btn);
  }
}

async function bookLalamoveShipment(orderId, btn) {
  try {
    const order = adminOrders.find(o =>
      String(o.external_id || o.id) === String(orderId)
    );

    if (!order) {
      showToast("Order not found", "error");
      return;
    }

    const paymentStatus = String(
      order.payment_status ||
      order.status ||
      ""
    ).toUpperCase();

    const isCOD = paymentStatus.includes("COD");
    const isPaid = paymentStatus === "PAID";

    const isSkyroApproved =
      String(order.payment_method || "")
        .toUpperCase()
        .includes("SKYRO") &&
      String(order.order_status || "")
        .toUpperCase() === "SKYRO APPROVED";

    if (!isCOD && !isPaid && !isSkyroApproved) {
      showToast(
        "Only COD or PAID orders can arrange shipment.",
        "error"
      );
      return;
    }

    setButtonLoading(btn, "Booking Rider...");

    /*
      STEP 1:
      Book Lalamove rider.
    */
    const bookingResponse = await fetch(
      `https://de-ecom-pro.onrender.com/api/orders/${orderId}/lalamove-create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const bookingResult =
      await bookingResponse.json();

    if (!bookingResponse.ok || !bookingResult.success) {
      throw new Error(
        bookingResult.message ||
        "Lalamove booking failed"
      );
    }

    /*
      STEP 2:
      Pag successful ang booking,
      Processing muna.
    */
    const updateResponse = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          orderId,
          order_status: "Processing",
          shipment_arranged_at:
            new Date().toISOString()
        })
      }
    );

    const updateResult =
      await updateResponse.json();

    if (!updateResponse.ok || !updateResult.success) {
      throw new Error(
        updateResult.message ||
        "Booking successful but status update failed"
      );
    }

    showToast(
      "Rider booked. Order moved to Processing.",
      "success"
    );

    closeOrderModal();
    await loadAdminOrders();

  } catch (error) {
    console.error(
      "Lalamove booking error:",
      error
    );

    showToast(
      error.message || "Lalamove server error",
      "error"
    );

  } finally {
    resetButtonLoading(btn);
  }
}

async function arrangeShipment(orderId, btn) {
  const order = adminOrders.find(o =>
    String(o.external_id || o.id) === String(orderId)
  );

  const courier = String(order?.courier || "").toLowerCase();

  if (courier.includes("lalamove") || courier.includes("same day")) {
    return bookLalamoveShipment(orderId, btn);
  }

  return createSPXShipment(orderId, btn);
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

<div
  class="warehouse-order-info summary-box"
  style="
    border-top:1px solid #e5e7eb;
    padding-top:10px;
    margin-top:10px;
  "
>
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

async function bulkMarkPacked(btn) {
  const selectedOrders = getSelectedOrderIds();

  if (!selectedOrders.length) {
    showToast(
      "Select orders first.",
      "error"
    );

    return;
  }

  try {
    setButtonLoading(
      btn,
      `Packing ${selectedOrders.length} order(s)...`
    );

    let successCount = 0;
    let failedCount = 0;

    for (const orderId of selectedOrders) {
      try {
        const response = await fetch(
          "https://de-ecom-pro.onrender.com/api/orders/update",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orderId,
              order_status: "Packed",
              packed_at: new Date().toISOString()
            })
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          failedCount++;
          continue;
        }

        successCount++;

      } catch (error) {
        console.error(
          `Failed to pack order ${orderId}:`,
          error
        );

        failedCount++;
      }
    }

    if (successCount > 0) {
      showToast(
        `${successCount} order(s) marked as Packed.`,
        "success"
      );
    }

    if (failedCount > 0) {
      showToast(
        `${failedCount} order(s) failed to update.`,
        "error"
      );
    }

    await loadAdminOrders();

  } finally {
    resetButtonLoading(btn);
  }
}

async function markOrderPacked(orderId, btn) {
  try {
    const order = adminOrders.find(o =>
      String(o.external_id || o.id) === String(orderId)
    );

    if (!order) {
      showToast("Order not found", "error");
      return;
    }

    const currentStatus =
      String(order.order_status || "");

    if (currentStatus !== "Processing") {
      showToast(
        "Processing orders only can be marked as Packed.",
        "error"
      );
      return;
    }

    setButtonLoading(btn, "Packing...");

    const response = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          orderId,
          order_status: "Packed",
          packed_at: new Date().toISOString()
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        "Failed to mark order as Packed"
      );
    }

    showToast(
      "Order marked as Packed.",
      "success"
    );

    closeOrderModal();
    await loadAdminOrders();

  } catch (error) {
    console.error(
      "Mark packed error:",
      error
    );

    showToast(
      error.message ||
      "Mark packed server error",
      "error"
    );

  } finally {
    resetButtonLoading(btn);
  }
}

async function markOrderShipped(orderId, btn) {
  try {

    const order = adminOrders.find(o =>
      String(o.external_id || o.id) === String(orderId)
    );

    if (!order) {
      showToast("Order not found", "error");
      return;
    }

    const paymentStatus = String(
      order.payment_status ||
      order.status ||
      ""
    ).toUpperCase();

    const isCOD =
      paymentStatus.includes("COD");

    const isPaid =
      paymentStatus === "PAID";

    const isSkyroApproved =
      String(order.payment_method || "")
        .toUpperCase()
        .includes("SKYRO") &&
      String(order.order_status || "")
        .toUpperCase() === "SKYRO APPROVED";

    if (!isCOD && !isPaid && !isSkyroApproved) {
      showToast(
        "Only COD or PAID orders can be marked shipped.",
        "error"
      );
      return;
    }

    setButtonLoading(btn, "Updating...");

    const res = await fetch(
      "https://de-ecom-pro.onrender.com/api/orders/update",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          order_status: "Shipped"
        })
      }
    );

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "Failed to mark shipped", "error");
      return;
    }

    showToast("Order marked as Shipped.", "success");
    closeOrderModal();
    await loadAdminOrders();

  } catch (err) {
    console.error(err);
    showToast("Mark shipped server error", "error");

  } finally {
    resetButtonLoading(btn);
  }
}

async function markOrderInTransit(orderId, btn) {
  await forceUpdateOrderStatus(orderId, "In Transit", btn);
}

async function markOrderFailed(orderId, btn) {
  await forceUpdateOrderStatus(orderId, "Failed Delivery", btn);
}

async function markOrderDelivered(orderId, btn) {
  try {

    setButtonLoading(btn, "Updating...");

    const res = await fetch("https://de-ecom-pro.onrender.com/api/orders/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        order_status: "Delivered",
        delivered_at: new Date().toISOString()
      })
    });

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "Failed to mark delivered", "error");
      return;
    }

    showToast("Order marked as Delivered.", "success");
    closeOrderModal();
    await loadAdminOrders();

  } catch (err) {
    console.error(err);
    showToast("Mark delivered server error", "error");
  } finally {
    resetButtonLoading(btn);
  }
}

async function forceUpdateOrderStatus(orderId, status, btn) {
  try {

    const order = adminOrders.find(o =>
      String(o.external_id || o.id) === String(orderId)
    );

    if (!order) {
      showToast("Order not found", "error");
      return;
    }

    const paymentStatus = String(
      order.payment_status ||
      order.status ||
      ""
    ).toUpperCase();

    const isCOD =
      paymentStatus.includes("COD");

    const isPaid =
      paymentStatus === "PAID";

    const isSkyroApproved =
      String(order.payment_method || "")
        .toUpperCase()
        .includes("SKYRO") &&
      String(order.order_status || "")
        .toUpperCase() === "SKYRO APPROVED";

    if (!isCOD && !isPaid && !isSkyroApproved) {

      showToast(
        "Only COD or PAID orders can update status.",
        "error"
      );

      return;
    }

    setButtonLoading(btn, "Updating...");

    const res = await fetch("https://de-ecom-pro.onrender.com/api/orders/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, order_status: status })
    });

    const result = await res.json();

    if (!result.success) {
      showToast(result.message || "Failed to update order", "error");
      return;
    }

    showToast(`Order marked as ${status}.`, "success");
    closeOrderModal();
    await loadAdminOrders();

  } catch (err) {
    console.error(err);
    showToast("Order update server error", "error");

  } finally {
    resetButtonLoading(btn);
  }
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

    await arrangeShipment(orderId);
  }

  showToast(
    "Bulk shipment arrangement complete.",
    "success"
  );

}

/* ===============================
   GLOBALS
================================ */
window.confirmSkyroStock = confirmSkyroStock;
window.markOrderPacked = markOrderPacked;
window.handleOrderRequestAction = handleOrderRequestAction;
window.approveOrderRequest = approveOrderRequest;
window.rejectOrderRequest = rejectOrderRequest;
window.updateOrderRequestStatus = updateOrderRequestStatus;
window.bulkMarkPacked = bulkMarkPacked;
window.markOrderShipped = markOrderShipped;
window.bulkArrangeShipment = bulkArrangeShipment;
window.loadAdminOrders = loadAdminOrders;
window.loadCancelledOrders = loadCancelledOrders;
window.undoCancelledOrder = undoCancelledOrder;
window.permanentDeleteOrder = permanentDeleteOrder;
window.openOrderModal = openOrderModal;
window.closeOrderModal = closeOrderModal;
window.cancelOrder = cancelOrder;
window.createSPXShipment = createSPXShipment;
window.bookLalamoveShipment = bookLalamoveShipment;
window.arrangeShipment = arrangeShipment;
window.openAWB = openAWB;
window.printOrderInvoice = printOrderInvoice;
window.openTracking = openTracking;
window.toggleShowAllOrderItems = toggleShowAllOrderItems;
window.toggleOrderSummary = toggleOrderSummary;
window.changeOrdersPage = changeOrdersPage;
window.markOrderInTransit = markOrderInTransit;
window.markOrderFailed = markOrderFailed;
window.markOrderDelivered = markOrderDelivered;

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
      currentOrdersPage = 1;
      renderAdminOrders();

    });

  });

loadAdminOrders();

setTimeout(() => {
  loadCancelledOrders();
}, 1000);
