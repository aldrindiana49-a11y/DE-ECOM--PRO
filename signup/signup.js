const signupForm =
    document.getElementById("signupForm");

const googleSignupBtn =
    document.getElementById("googleSignupBtn");

googleSignupBtn.addEventListener("click", async () => {

    const { error } =
        await supabaseClient.auth.signInWithOAuth({

            provider: "google",

            options: {
                redirectTo: "https://drinelectronicsph.com"
            }

        });

    if (error) {
        alert(error.message);
    }

});

signupForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const name =
        document.getElementById("name").value;

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    const { data, error } =
        await supabaseClient.auth.signUp({

            email,
            password,

            options: {
                data: {
                    full_name: name
                }
            }

        });

    if (error) {
        alert(error.message);
        return;
    }

    alert("Signup successful! Please check your email.");

    window.location.href = "/";

});