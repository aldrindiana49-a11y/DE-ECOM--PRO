const loginForm =
  document.getElementById("loginForm");

const googleLoginBtn =
  document.getElementById("googleLoginBtn");

googleLoginBtn.addEventListener("click", async () => {

  const { error } =
    await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://drinelectronicsph.com/"
      }
    });

  if (error) {
    alert(error.message);
  }

});

loginForm.addEventListener("submit", async (e) => {

  e.preventDefault();

  const email =
    document.getElementById("email").value;

  const password =
    document.getElementById("password").value;

  const { error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    alert(error.message);
    return;
  }

  localStorage.removeItem(
    "drinCustomerCheckoutInfo"
  );

  localStorage.removeItem(
    "drinCheckoutItems"
  );

  localStorage.removeItem(
    "drinCart"
  );

  window.location.href = "/";

});

function togglePassword(id, el) {



  const input =
    document.getElementById(id);

  if (input.type === "password") {
    input.type = "text";
    el.innerHTML = '<i class="fa-solid fa-eye"></i>';
  } else {
    input.type = "password";
    el.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
  }

}

function showPremiumAlert({
  title,
  message,
  icon = "🔐",
  confirmText = "OK",
  cancelText = "Cancel",
  showCancel = false
}) {

  return new Promise((resolve) => {

    const modal =
      document.getElementById("premiumAlert");

    const titleEl =
      document.getElementById("premiumAlertTitle");

    const messageEl =
      document.getElementById("premiumAlertMessage");

    const iconEl =
      modal.querySelector(".premium-alert-icon");

    const cancelBtn =
      document.getElementById("premiumAlertCancel");

    const confirmBtn =
      document.getElementById("premiumAlertConfirm");

    titleEl.textContent = title;

    messageEl.textContent = message;

    iconEl.textContent = icon;

    confirmBtn.textContent = confirmText;

    cancelBtn.textContent = cancelText;

    cancelBtn.style.display =
      showCancel ? "block" : "none";

    modal.classList.add("show");

    confirmBtn.onclick = () => {

      modal.classList.remove("show");

      resolve(true);

    };

    cancelBtn.onclick = () => {

      modal.classList.remove("show");

      resolve(false);

    };

  });

}

const forgotPasswordBtn =
  document.getElementById("forgotPasswordBtn");

forgotPasswordBtn?.addEventListener(
  "click",
  async (e) => {

    e.preventDefault();

    const email =
      document.getElementById("email").value.trim();

    if (!email) {

      await showPremiumAlert({
        title: "Email Required",
        message: "Please enter your email address first before requesting a password reset.",
        icon: "📧",
        confirmText: "OK"
      });

      return;
    }

    const confirmReset =
      await showPremiumAlert({
        title: "Reset Password",
        message: `We will send a password reset link to ${email}. Continue?`,
        icon: "🔐",
        confirmText: "Send Link",
        cancelText: "Cancel",
        showCancel: true
      });

    if (!confirmReset) return;


    const confirmBtn =
      document.getElementById("premiumAlertConfirm");

    confirmBtn.disabled = true;
    confirmBtn.innerHTML =
      `<span class="loading-spinner"></span>`;
    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo:
            "https://drinelectronicsph.com/reset-password/"
        }
      );

    confirmBtn.disabled = false;

    confirmBtn.textContent =
      "Send Link";

    if (error) {

      await showPremiumAlert({
        title: "Reset Failed",
        message: error.message,
        icon: "⚠️",
        confirmText: "OK"
      });

      return;
    }

    await showPremiumAlert({
      title: "Check Your Email",
      message: "Password reset link sent successfully. Please check your inbox or spam folder.",
      icon: "✅",
      confirmText: "Got it"
    });

  }
);
