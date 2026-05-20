const ordersList = document.getElementById("ordersList");

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

    card.innerHTML = `
      <div class="order-top">
        <div>
          <div class="order-id">Order #${order.id}</div>
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

        ${
          order.tracking_link
            ? `<button class="track-btn" onclick="window.open('${order.tracking_link}')">Track Order</button>`
            : ""
        }

        ${
          order.order_status === "Pending Payment"
            ? `<button class="track-btn" onclick="continuePayment('${order.id}')">Continue Payment</button>`
            : ""
        }
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
    alert("Order not found.");
    return;
  }

  const res = await fetch("https://de-ecom-pro.onrender.com/api/create-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: order.id,
      amount: order.amount,
      subtotal: order.subtotal || 0,
      shippingFee: order.shipping_fee || 0,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      paymentMethod: "XENDIT",
      courier: order.courier,
      address: order.address,
      items: order.items
    })
  });

  const data = await res.json();

  const redirectUrl =
    data.checkoutUrl ||
    data.checkout_url ||
    data.invoice_url ||
    data.redirectUrl;

  if (!redirectUrl) {
    alert(data.message || "Cannot continue payment.");
    return;
  }

  window.location.href = redirectUrl;
}

loadOrders();