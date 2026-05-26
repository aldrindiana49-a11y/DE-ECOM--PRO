/* =========================
   PARTNER PROGRAM POPUP
========================= */

function showPartnerSoonPopup() {

    const popup =
        document.getElementById(
            "partnerSoonPopup"
        );

    if (popup) {

        popup.style.display =
            "flex";

    }

}

function closePartnerSoonPopup() {

    const popup =
        document.getElementById(
            "partnerSoonPopup"
        );

    if (popup) {

        popup.style.display =
            "none";

    }

}

/* CLOSE WHEN CLICK OUTSIDE */

window.addEventListener(
    "click",
    function (e) {

        const popup =
            document.getElementById(
                "partnerSoonPopup"
            );

        if (
            e.target === popup
        ) {

            closePartnerSoonPopup();

        }

    }
);

/* ESC KEY CLOSE */

document.addEventListener(
    "keydown",
    function (e) {

        if (
            e.key === "Escape"
        ) {

            closePartnerSoonPopup();

        }

    }
);