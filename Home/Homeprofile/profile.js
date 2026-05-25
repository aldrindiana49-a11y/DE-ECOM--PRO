const fullName = document.getElementById("fullName");
const contactNumber = document.getElementById("contactNumber");
const province = document.getElementById("province");
const city = document.getElementById("city");
const barangay = document.getElementById("barangay");
const streetAddress = document.getElementById("streetAddress");
const postalCode = document.getElementById("postalCode");

async function loadProfile() {
  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {
    window.location.href = "../login/";
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    return;
  }

  if (!data) return;

  fullName.value = data.full_name || "";
  contactNumber.value = data.contact_number || "";
  province.value = data.province || "";
  city.value = data.city || "";
  barangay.value = data.barangay || "";
  streetAddress.value = data.street_address || "";
  postalCode.value = data.postal_code || "";

  [
    fullName,
    contactNumber,
    province,
    city,
    barangay,
    streetAddress,
    postalCode
  ].forEach(input => {
    if (input) input.disabled = true;
  });
}

loadProfile();