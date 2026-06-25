const SUPABASE_URL = "https://zdinvxowzpkolbfzpcac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yWOmkaQzsh7sInJPhDOFWw_tyjALAuP";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

async function checkGuestOrder() {

    const email =
        document.getElementById("trackEmail").value.trim();

    const result =
        document.getElementById("trackResult");

    const params =
        new URLSearchParams(window.location.search);

    const trackingCode =
        params.get("track");

    if (!email) {
        result.innerHTML = "Enter email first.";
        return;
    }

    const { data, error } =
        await supabaseClient
            .from("orders")
            .select("*")
            .eq("guest_tracking_code", trackingCode)
            .eq("customer_email", email)
            .single();

    if (error || !data) {
        result.innerHTML =
            "<p>Order not found.</p>";
        return;
    }

    result.innerHTML = `
    <div class="result-box">

      <p><strong>Order ID:</strong> ${data.external_id}</p>

      <p><strong>Status:</strong> ${data.order_status}</p>

      <p><strong>Courier:</strong> ${data.courier}</p>

      <p><strong>Total:</strong> ₱${data.amount}</p>

      ${data.tracking_link
            ?
            `<button onclick="window.open('${data.tracking_link}')">
          Track Shipment
        </button>`
            :
            ""
        }

    </div>
  `;
}