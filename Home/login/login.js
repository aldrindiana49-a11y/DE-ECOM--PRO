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