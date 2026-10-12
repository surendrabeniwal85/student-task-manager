/* ==========================================================
   login.js – controls the login / register page
   ========================================================== */
(() => {
  "use strict";

  // Already logged in? Go straight to the dashboard.
  if (Auth.currentUser()) {
    location.replace("dashboard.html");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const loginForm = $("login-form");
  const registerForm = $("register-form");

  function showError(id, message) {
    const box = $(id);
    box.textContent = message;
    box.hidden = !message;
  }

  function showTab(name) {
    const isLogin = name === "login";
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;

    $("tab-login").classList.toggle("is-active", isLogin);
    $("tab-register").classList.toggle("is-active", !isLogin);
    $("tab-login").setAttribute("aria-selected", String(isLogin));
    $("tab-register").setAttribute("aria-selected", String(!isLogin));

    showError("login-error", "");
    showError("register-error", "");
  }

  $("tab-login").addEventListener("click", () => showTab("login"));
  $("tab-register").addEventListener("click", () => showTab("register"));

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const roll = $("login-roll").value;
    const pass = $("login-pass").value;

    if (!roll.trim() || !pass) {
      return showError("login-error", "Please enter your roll number and password.");
    }

    const result = await Auth.login(roll, pass);
    if (!result.ok) return showError("login-error", result.error);
    location.href = "dashboard.html";
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("reg-name").value.trim();
    const roll = $("reg-roll").value.trim();
    const pass = $("reg-pass").value;
    const pass2 = $("reg-pass2").value;

    if (!name || !roll)   return showError("register-error", "Name and roll number are required.");
    if (pass.length < 6)  return showError("register-error", "Password must be at least 6 characters.");
    if (pass !== pass2)   return showError("register-error", "Passwords do not match.");

    const result = await Auth.register({ name, rollNo: roll, password: pass });
    if (!result.ok) return showError("register-error", result.error);
    location.href = "dashboard.html";
  });
})();