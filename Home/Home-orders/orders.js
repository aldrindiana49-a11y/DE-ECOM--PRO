const ordersList = document.getElementById("ordersList");

function showOrderModal(title, message) {
    const modal = document.getElementById("orderModal");
    const modalTitle = document.getElementById("orderModalTitle");
    const modalMessage = document.getElementById("orderModalMessage");
    const okBtn = document.getElementById("orderModalOk");

    if (!modal) {
        alert(message);
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (okBtn) {
        okBtn.style.display = "none";
    }

    modal.classList.add("show");
}

function closeOrderModal() {

    const modal =
        document.getElementById("orderModal");

    if (modal) {
        modal.classList.remove("show");
    }
}

async function loadOrders() {
    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        window.location.href = "/login/";
        return;
    }

    const { data: orders, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        ordersList.innerHTML = `<div class="empty-orders">Failed to load orders.</div>`;
        return;
    }

    if (!orders || !orders.length) {
        ordersList.innerHTML = `<div class="empty-orders">No orders yet.</div>`;
        return;
    }

    ordersList.innerHTML = "";

    orders.forEach(order => {
        const card = document.createElement("div");
        card.className = "order-card";

        const items = Array.isArray(order.items) ? order.items : [];

        const itemsHtml = items.map(item => `
  <div class="order-item">
    <img src="${item.image || 'https://via.placeholder.com/100'}" alt="${item.name || 'Product'}" />
    <div>
      <div class="order-item-name">${item.name || 'Product'}</div>
      <div class="order-item-price">
        Qty: ${item.quantity || 1} • ₱${Number(item.price || 0).toLocaleString()}
      </div>
    </div>
  </div>
`).join("");

        const statusText = String(order.order_status || "").toLowerCase();
        const createdTime = new Date(order.created_at).getTime();
        const expiryTime = createdTime + 60 * 60 * 1000;
        const remainingMs = expiryTime - Date.now();

        const isPendingPayment =
            statusText.includes("pending payment");

        const isExpired = isPendingPayment && remainingMs <= 0;

        const isPaid =
            statusText.includes("processing");

        card.innerHTML = `
      <div class="order-top">
        <div>
          <div class="order-id">
  Order #${order.external_id || order.externalId || order.order_id || order.orderId || order.id}
  
</div>

          <div class="order-date">${new Date(order.created_at).toLocaleString()}</div>
        </div>
        <div class="order-status">${order.order_status || "Processing"}</div>
      </div>

      <div class="order-items">
        ${itemsHtml}
      </div>

      <div class="order-bottom">
  <div class="order-total">
    Total: ₱${Number(order.amount || 0).toLocaleString()}
  </div>

  ${order.tracking_link
                ? `<button class="track-btn"
          onclick="window.open('${order.tracking_link}')">
          Track Order
        </button>`
                : ""
            }

  ${isPendingPayment && !isExpired
                ? `
      <div class="payment-countdown" data-expiry="${expiryTime}">
        Payment expires in:
        <strong>--:--:--</strong>
      </div>

      <button class="track-btn"
        onclick="continuePayment('${order.id}')">
        Complete Payment
      </button>
    `
                : ""
            }

  ${isExpired
                ? `
      <button class="track-btn expired-btn">
        Payment Expired
      </button>
    `
                : ""
            }

            ${isPaid
                ? `
      <button class="track-btn"
        style="background:#22c55e;">
        Paid ✓
      </button>
    `
                : ""
            }

  <button class="track-btn buy-again-btn"
    onclick="window.location.href='../Products/index.html'">
    Buy Again
  </button>

</div>

    `;

        ordersList.appendChild(card);
    });
}

async function continuePayment(orderId) {
    const { data: order, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

    if (error || !order) {
        showOrderModal("Order Error", "Order not found.");
        return;
    }

    showOrderModal(
        "Secure Checkout",
        "Preparing secure checkout...\n\nPlease do not refresh or close this page."
    );

    const res = await fetch("https://de-ecom-pro.onrender.com/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderId:
                order.external_id ||
                order.externalId ||
                order.order_id ||
                order.orderId ||
                String(order.id),
            amount: order.amount,
            subtotal: order.subtotal || 0,
            shippingFee: order.shipping_fee || 0,
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            paymentMethod: "XENDIT",
            courier: order.courier,
            address: order.address,
            parcelInfo: order.parcel_info || {},
            shippingQuote: order.shipping_quote || {},
            items: order.items
        })
    });

    const data = await res.json();

    if (!res.ok) {
        console.log("CONTINUE PAYMENT ERROR:", data);

        showOrderModal(
            "Payment Error",
            data.message || "Payment request failed."
        );

        return;
    }

    const redirectUrl =
        data.checkoutUrl ||
        data.checkout_url ||
        data.invoice_url ||
        data.redirectUrl;

    if (!redirectUrl) {
        showOrderModal(
            "Payment Error",
            data.message || "Cannot continue payment."
        );

        return;
    }

    window.location.replace(redirectUrl);

}

function updatePaymentCountdowns() {

    document.querySelectorAll(".payment-countdown")
        .forEach(timer => {

            const expiry =
                Number(timer.dataset.expiry);

            const remaining =
                expiry - Date.now();

            const text =
                timer.querySelector("strong");

            if (remaining <= 0) {

                text.textContent = "Expired";

                return;
            }

            const hours =
                Math.floor(remaining / 3600000);

            const minutes =
                Math.floor((remaining % 3600000) / 60000);

            const seconds =
                Math.floor((remaining % 60000) / 1000);

            text.textContent =
                `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        });
}

setInterval(updatePaymentCountdowns, 1000);

loadOrders();

updatePaymentCountdowns();