const ordersList = document.getElementById("ordersList");

console.log("orders.js loaded");
console.log("supabaseClient:", typeof supabaseClient);


function showOrderModal(title, message, showLoader = false) {
    const modal = document.getElementById("orderModal");
    const modalTitle = document.getElementById("orderModalTitle");
    const modalMessage = document.getElementById("orderModalMessage");
    const okBtn = document.getElementById("orderModalOk");
    const loader = document.getElementById("paymentLoader");

    if (!modal) {
        alert(message);
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (loader) {
        loader.style.display = showLoader ? "block" : "none";
    }

    if (okBtn) {
        okBtn.style.display = showLoader ? "none" : "inline-block";
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
        const subtotal =
            Number(order.subtotal || 0);

        const rawShippingFee =
            Number(order.shipping_fee || 0);

        const serviceFee =
            Number(
                order.service_fee ||
                order.handling_fee ||
                order.packaging_fee ||
                25
            );

        const shippingFee =
            rawShippingFee;

        const finalTotal =
            Number(order.amount || 0);

        const discounts =
            Array.isArray(order.discounts)
                ? order.discounts
                : [];

        if (
            Number(order.voucher_discount || 0) > 0
        ) {
            discounts.push({
                source: "voucher",
                name: "Voucher Discount",
                amount: Number(order.voucher_discount)
            });
        }

        const items = Array.isArray(order.items) ? order.items : [];

        const discountsHtml =
            discounts.map(discount => `

    <div class="summary-row discount">

        <span>
            ${discount.name}
        </span>

        <span>
            -₱${Number(discount.amount || 0).toLocaleString()}
        </span>

    </div>

`).join("");

        const visibleItems =
            items.slice(0, 2);

        const hiddenItems =
            items.slice(2);

        const visibleItemsHtml =
            visibleItems.map(item => `

  <div class="order-item">

    <img src="${item.image || 'https://via.placeholder.com/100'}" alt="${item.name || 'Product'}" />

    <div>

      <div class="order-item-name">
        ${item.name || 'Product'}
      </div>

      ${item.variant_name || item.variantName || item.variant || item.selected_variant ? `
        <div class="order-item-variant">
          Variant: ${item.variant_name || item.variantName || item.variant || item.selected_variant}
        </div>
      ` : ""}

      <div class="order-item-price">
        Qty: ${item.quantity || 1} • ₱${Number(item.price || 0).toLocaleString()}
      </div>

    </div>

  </div>

`).join("");

        const hiddenItemsHtml =
            hiddenItems.map(item => `

  <div class="order-item hidden-order-item">

    <img src="${item.image || 'https://via.placeholder.com/100'}" alt="${item.name || 'Product'}" />

    <div>

      <div class="order-item-name">
        ${item.name || 'Product'}
      </div>

      ${item.variant_name || item.variantName || item.variant || item.selected_variant ? `
        <div class="order-item-variant">
          Variant: ${item.variant_name || item.variantName || item.variant || item.selected_variant}
        </div>
      ` : ""}

      <div class="order-item-price">
        Qty: ${item.quantity || 1} • ₱${Number(item.price || 0).toLocaleString()}
      </div>

    </div>

  </div>

`).join("");

        const itemsHtml = `
    ${visibleItemsHtml}

    ${hiddenItemsHtml}

    ${items.length > 2 ? `
        <button class="see-more-btn">
            See More
        </button>
    ` : ""}
`;

        const statusText = String(order.order_status || "").toLowerCase();
        const createdTime = new Date(order.created_at).getTime();
        const expiryTime = createdTime + 60 * 60 * 1000;
        const remainingMs = expiryTime - Date.now();

        const isPendingPayment =
            statusText.includes("pending payment");

        const isExpired = isPendingPayment && remainingMs <= 0;

        const isPaid =
            statusText.includes("processing");

        const paymentMethod =
            String(
                order.payment_method ||
                order.paymentMethod ||
                order.payment_provider ||
                order.paymentProvider ||
                ""
            ).toUpperCase();

        const paymentStatus =
            String(order.payment_status || order.paymentStatus || "").toLowerCase();

        const isXendit =
            paymentMethod === "XENDIT";

        const isPaidPayment =
            paymentStatus.includes("paid");

        const hasPendingRequest =
            String(order.order_request_status || "")
                .toLowerCase()
                .includes("pending");

        const canRequestChange =
            !statusText.includes("packed") &&
            !statusText.includes("shipped") &&
            !statusText.includes("delivered") &&
            !statusText.includes("cancelled") &&
            !hasPendingRequest &&
            !(isXendit && isPaidPayment) &&
            !isExpired;

        card.innerHTML = `
      <div class="order-top">
        <div>
          <div class="order-id">
  Order #${order.external_id || order.externalId || order.order_id || order.orderId || order.id}
  
</div>

          <div class="order-date">${new Date(order.created_at).toLocaleString()}</div>
        </div>
       
<div class="order-status
  ${String(order.order_status).includes("Cancelled")
                ? "cancelled-status"
                : ""}
">

  ${order.order_status || "Processing"}
${String(order.order_status || "").toLowerCase().includes("cancelled") && order.cancel_type
                ? ` • ${order.cancel_type}`
                : ""}
${String(order.order_status || "").toLowerCase().includes("cancelled") && order.cancel_reason
                ? ` • ${order.cancel_reason}`
                : ""}

</div>

      </div>

      <div class="order-items">
        ${itemsHtml}
      </div>

<div class="order-summary">

    <div class="summary-row">

        <span>
            Subtotal
        </span>

        <span>
            ₱${subtotal.toLocaleString()}
        </span>

    </div>

    ${shippingFee > 0 ? `

        <div class="summary-row">

            <span>
                Shipping Fee
            </span>

            <span>
                ₱${shippingFee.toLocaleString()}
            </span>

        </div>

    ` : ""}

    ${serviceFee > 0 ? `

    <div class="summary-row">

        <span>
            Service / Handling Fee
            <small style="display:block;color:#94a3b8;font-size:12px;margin-top:3px;">
               Includes packaging materials, parcel protection, and secure payment processing
            </small>
        </span>

        <span>
            ₱${serviceFee.toLocaleString()}
        </span>

    </div>

` : ""}

    ${discountsHtml}

    <div class="summary-row total">

        <span>
            Total
        </span>

        <span>
            ₱${finalTotal.toLocaleString()}
        </span>

    </div>
<div class="summary-row">

    <span>
        Payment Mode
    </span>

    <span>
        ${paymentMethod === "XENDIT"
                ? "Online Payment"
                : "COD"}
    </span>

</div>


</div>

      <div class="order-bottom">
  
  ${order.tracking_link
                ? `<button class="track-btn"
          onclick="window.open('${order.tracking_link}')">
          Track Order
        </button>`
                : ""
            }

  ${isPendingPayment && !isExpired
                ? `
      <div
  class="payment-countdown"
  data-expiry="${expiryTime}"
  data-expire-order-id="${order.external_id || order.id}"
>
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

${canRequestChange ? `
    <button class="track-btn request-change-btn"
        onclick="requestOrderChange('${order.id}')">
        Request Cancellation
    </button>
` : ""}

${(String(order.order_status || "").toLowerCase().includes("delivered") ||
                String(order.order_status || "").toLowerCase().includes("completed"))
                && !order.review_submitted
                ? `
<button class="track-btn review-btn"
  onclick='openReviewModal(${JSON.stringify(order).replaceAll("'", "&#39;")})'>
  Write Review
</button>
`
                : ""
            }

  <button class="track-btn buy-again-btn"
  onclick="window.location.href='/'">
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

    const loader =
        document.getElementById("paymentLoader");

    if (loader) {
        loader.style.display = "block";
    }

    showOrderModal(
        "Secure Checkout",
        "Preparing secure checkout...\n\nPlease do not refresh or close this page.",
        true
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

                const orderId =
                    timer.dataset.expireOrderId;

                if (
                    orderId &&
                    timer.dataset.expiredSent !== "true"
                ) {

                    timer.dataset.expiredSent = "true";

                    expirePaymentOrder(orderId);
                }

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

async function expirePaymentOrder(orderId) {

    try {

        const res = await fetch(
            `https://de-ecom-pro.onrender.com/api/orders/${orderId}/expire-payment`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        const result = await res.json();

        console.log(
            "EXPIRE PAYMENT RESULT:",
            result
        );

        if (result.success) {
            loadOrders();
        }

    } catch (error) {

        console.error(
            "Expire payment error:",
            error
        );
    }
}

document.addEventListener("click", e => {

    if (
        e.target.classList.contains("see-more-btn")
    ) {

        const hiddenItems =
            e.target.parentElement.querySelectorAll(".hidden-order-item");

        const expanded =
            e.target.dataset.expanded === "true";

        hiddenItems.forEach(item => {

            item.style.display =
                expanded ? "none" : "flex";
        });

        e.target.dataset.expanded =
            expanded ? "false" : "true";

        e.target.textContent =
            expanded ? "See More" : "See Less";
    }
});

let selectedCancelOrderId = null;

function requestOrderChange(orderId) {
    selectedCancelOrderId = orderId;

    document
        .getElementById("cancelRequestModal")
        .classList.add("show");
}

function closeCancelRequestModal() {
    document
        .getElementById("cancelRequestModal")
        .classList.remove("show");

    selectedCancelOrderId = null;
}

async function submitCancelRequest() {
    const reason =
        document.getElementById("cancelRequestReason").value;

    if (!reason) {
        showOrderModal(
            "Required",
            "Please select cancellation reason."
        );
        return;
    }

    const { error } = await supabaseClient
        .from("orders")
        .update({
            order_request_status: "Pending Admin Approval",
            order_request_reason: reason,
            order_request_date: new Date().toISOString()
        })
        .eq("id", selectedCancelOrderId);

    if (error) {
        console.error(error);
        showOrderModal("Request Error", "Failed to submit request.");
        return;
    }

    closeCancelRequestModal();

    showOrderModal(
        "Request Submitted",
        "Cancellation request submitted successfully."
    );

    loadOrders();
}

document.addEventListener("DOMContentLoaded", () => {
    loadOrders();
    updatePaymentCountdowns();
    setInterval(updatePaymentCountdowns, 1000);
});

let selectedReviewOrder = null;

function openReviewModal(order) {

    selectedReviewOrder = order;

    document.getElementById("reviewOrderId").value = order.id;
    document.getElementById("reviewModal").classList.add("show");
}

function closeReviewModal() {
    document.getElementById("reviewModal").classList.remove("show");
    selectedReviewOrder = null;
}

async function submitReview() {
    if (!selectedReviewOrder) {
        showOrderModal("Review Error", "No order selected.");
        return;
    }

    const rating = Number(document.getElementById("reviewRating").value);
    const comment = document.getElementById("reviewComment").value.trim();


    const {
        data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
        window.location.href = "/login/";
        return;
    }

    const imageFile =
        document.getElementById("reviewImage")?.files?.[0];

    let reviewImageUrl = null;

    if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from("review-images")
            .upload(filePath, imageFile);

        if (uploadError) {
            console.error(uploadError);
            showOrderModal("Upload Error", "Failed to upload review photo.");
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from("review-images")
            .getPublicUrl(filePath);

        reviewImageUrl = publicUrlData.publicUrl;
    }

    const items = Array.isArray(selectedReviewOrder.items)
        ? selectedReviewOrder.items
        : [];

    if (!items.length) {
        showOrderModal("Review Error", "No products found in this order.");
        return;
    }

    const productId =
        items[0].id ||
        items[0].product_id ||
        items[0].productId;

    if (!productId) {
        showOrderModal("Review Error", "Product ID not found.");
        return;
    }

    const { error } = await supabaseClient
        .from("product_reviews")
        .insert({
            product_id: String(productId),
            order_id: String(selectedReviewOrder.id),
            user_id: user.id,
            customer_name:
                selectedReviewOrder.customer_name ||
                selectedReviewOrder.customerName ||
                "Anonymous",
            rating,
            comment,
            review_image: reviewImageUrl
        });

    if (error) {
        console.error(error);
        showOrderModal("Review Error", "You may have already reviewed this product.");
        return;
    }

    await supabaseClient
        .from("orders")
        .update({
            review_submitted: true
        })
        .eq("id", selectedReviewOrder.id);

    closeReviewModal();

    showOrderModal(
        "Review Submitted",
        "Thank you for your review!"
    );

    loadOrders();
}

window.submitReview = submitReview;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;