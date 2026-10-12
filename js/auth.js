/* ==========================================================
   auth.js – register, login, logout (front-end only demo)
   ========================================================== */
const Auth = (() => {
  function makeId() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "u" + Date.now() + Math.random().toString(16).slice(2);
  }

  /** Salted SHA-256 (falls back to a weak hash if crypto.subtle is unavailable). */
  async function hash(password, salt) {
    const text = `${salt}:${password}`;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    let h = 5381;
    for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0;
    return "weak-" + h.toString(16);
  }

  const normalizeRoll = (r) => r.trim().toUpperCase();

  async function register({ name, rollNo, password }) {
    const roll = normalizeRoll(rollNo);
    const users = Store.getUsers();

    if (users.some((u) => u.rollNo === roll)) {
      return { ok: false, error: "That roll number is already registered. Please log in." };
    }

    const salt = makeId();
    const user = {
      id: makeId(),
      name: name.trim(),
      rollNo: roll,
      salt,
      passHash: await hash(password, salt),
      createdAt: Date.now()
    };

    users.push(user);
    Store.saveUsers(users);
    Store.setSession({ userId: user.id });
    return { ok: true, user };
  }

  async function login(rollNo, password) {
    const roll = normalizeRoll(rollNo);
    const user = Store.getUsers().find((u) => u.rollNo === roll);
    const bad = { ok: false, error: "Roll number or password is incorrect." };

    if (!user) return bad;
    if ((await hash(password, user.salt)) !== user.passHash) return bad;

    Store.setSession({ userId: user.id });
    return { ok: true, user };
  }

  function logout() {
    Store.clearSession();
  }

  function currentUser() {
    const session = Store.getSession();
    if (!session) return null;
    return Store.getUsers().find((u) => u.id === session.userId) || null;
  }

  return { register, login, logout, currentUser };
})();