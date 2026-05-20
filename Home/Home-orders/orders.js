const ordersList =
  document.getElementById("ordersList");

/* LOAD ORDERS */
async function loadOrders() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {

    window.location.href =
      "/login/";

    return;
  }

  const { data: orders, error } =
    await supabaseClient
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false
      });

  if (error) {

    console.error(error);

    ordersList.innerHTML = `
      <div class="empty-orders">
        Failed to load orders.
      </div>
    `;

    return;
  }

  if (!orders || !orders.length) {

    ordersList.innerHTML = `
      <div class="empty-orders">
        No orders yet.
      </div>
    `;

    return;
  }

  ordersList.innerHTML = "";

  orders.forEach(order => {

    const card =
      document.createElement("div");

    card.className =
      "order-card";

    const items =
      Array.isArray(order.items)
        ? order.items
        : [];

    const itemsHtml =
      items.map(item => {

        return `
          <div class="order-item">

            <img
              src="${item.image || 'https://via.placeholder.com/100'}"
              alt="${item.name || 'Product'}"
            />

            <div>

              <div class="order-item-name">
                ${item.name || 'Product'}
              </div>

              <div class="order-item-price">

                Qty:
                ${item.quantity || 1}

                •

                ₱${Number(item.price || 0)
                  .toLocaleString()}

              </div>

            </div>

          </div>
        `;

      }).join("");

    card.innerHTML = `

      <div class="order-top">

        <div>

          <div class="order-id">
            Order #${order.id}
          </div>

          <div class="order-date">

            ${new Date(order.created_at)
              .toLocaleString()}

          </div>

        </div>

        <div class="order-status">
          ${order.order_status || "Processing"}
        </div>

      </div>

      <div class="order-items">
        ${itemsHtml}
      </div>

      <div class="order-bottom">

        <div class="order-total">

          Total:
          ₱${Number(order.amount || 0)
            .toLocaleString()}

        </div>

        ${
          order.tracking_link
          ? `
            <button
              class="track-btn"
              onclick="window.open('${order.tracking_link}')">

              Track Order

            </button>
          `
          : ""
        }

      </div>
    `;

    ordersList.appendChild(card);

  });

}

loadOrders();