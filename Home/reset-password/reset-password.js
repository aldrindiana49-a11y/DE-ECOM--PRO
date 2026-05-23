const resetPasswordForm =
  document.getElementById("resetPasswordForm");

const resetBtn =
  document.getElementById("resetBtn");

function togglePassword(id, el) {

  const input =
    document.getElementById(id);

  if (input.type === "password") {

    input.type = "text";

    el.innerHTML =
      '<i class="fa-solid fa-eye"></i>';

  } else {

    input.type = "password";

    el.innerHTML =
      '<i class="fa-solid fa-eye-slash"></i>';
  }

}

resetPasswordForm?.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    const newPassword =
      document.getElementById("newPassword").value;

    const confirmPassword =
      document.getElementById("confirmPassword").value;

    if (newPassword !== confirmPassword) {

      alert(
        "Passwords do not match."
      );

      return;
    }

    resetBtn.disabled = true;

    resetBtn.innerHTML =
      `<div class="loading-spinner"></div>`;

    const { error } =
      await supabaseClient.auth.updateUser({
        password: newPassword
      });

    resetBtn.disabled = false;

    resetBtn.textContent =
      "Update Password";

    if (error) {

      alert(error.message);

      return;
    }

    alert(
      "Password updated successfully."
    );

    window.location.href =
      "https://drinelectronicsph.com/login/";

  }
);