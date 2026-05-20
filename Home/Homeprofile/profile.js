const profileForm =
  document.getElementById("profileForm");

const fullName =
  document.getElementById("fullName");

const contactNumber =
  document.getElementById("contactNumber");

const province =
  document.getElementById("province");

const city =
  document.getElementById("city");

const barangay =
  document.getElementById("barangay");

const streetAddress =
  document.getElementById("streetAddress");

const postalCode =
  document.getElementById("postalCode");

/* LOAD PROFILE */
async function loadProfile() {

  const {
    data: { user }
  } = await supabaseClient.auth.getUser();

  if (!user) {

    window.location.href =
      "../login/";

    return;
  }

  const { data, error } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    return;
  }

  if (!data) return;

  fullName.value =
    data.full_name || "";

  contactNumber.value =
    data.contact_number || "";

  province.value =
    data.province || "";

  city.value =
    data.city || "";

  barangay.value =
    data.barangay || "";

  streetAddress.value =
    data.street_address || "";

  postalCode.value =
    data.postal_code || "";
}

/* SAVE PROFILE */
profileForm.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    const {
      data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) return;

    const profileData = {

      id: user.id,

      full_name:
        fullName.value,

      contact_number:
        contactNumber.value,

      province:
        province.value,

      city:
        city.value,

      barangay:
        barangay.value,

      street_address:
        streetAddress.value,

      postal_code:
        postalCode.value,

      updated_at:
        new Date()
    };

    const { error } =
      await supabaseClient
        .from("profiles")
        .upsert(profileData);

    if (error) {

      console.error(error);

      alert(
        "Failed to save profile."
      );

      return;
    }

    alert(
      "Profile saved successfully!"
    );

  }
);

loadProfile();