const SUPABASE_URL = "https://zdinvxowzpkolbfzpcac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

async function checkGuestOrder() {
    const email = document.getElementById("trackEmail").value.trim();
    const result = document.getElementById("trackResult");

    if (!email) {
        result.innerHTML = "Enter email first.";
        return;
    }

    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("customer_email", email)
        .eq("guest_order", true)
        .order("created_at", { ascending: false });

    if (error) {
        result.innerHTML = `<p>${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        result.innerHTML = "<p>No orders found.</p>";
        return;
    }

    result.innerHTML = data.map(order => `
    <div class="result-box">
      <p><strong>Order ID:</strong> ${order.external_id}</p>
      <p><strong>Status:</strong> ${order.order_status}</p>
      <p><strong>Courier:</strong> ${order.courier}</p>
      <p><strong>Total:</strong> ₱${Number(order.amount || 0).toLocaleString()}</p>
      <p><strong>Tracking Number:</strong> ${order.tracking_number || "Not available yet"}</p>

      ${order.tracking_link
            ? `<button onclick="window.open('${order.tracking_link}', '_blank')">Track Shipment</button>`
            : `<p>Tracking link not available yet.</p>`
        }
    </div>
  `).join("");
}