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

resetPasswordForm?.addEventListener(
    "submit",
    async (e) => {

        e.preventDefault();

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (newPassword !== confirmPassword) {

            await showPremiumAlert({
                title: "Password Mismatch",
                message: "Passwords do not match. Please try again.",
                icon: "⚠️",
                confirmText: "OK"
            });

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

            await showPremiumAlert({
                title: "Reset Failed",
                message: error.message,
                icon: "⚠️",
                confirmText: "OK"
            });

            return;
        }

        await showPremiumAlert({
            title: "Password Updated",
            message: "Your password has been updated successfully.",
            icon: "✅",
            confirmText: "Login Now"
        });

        window.location.href =
            "https://drinelectronicsph.com/login/";

    }
);