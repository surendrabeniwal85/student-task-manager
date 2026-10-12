/* ==========================================================
   storage.js – everything that touches localStorage
   ========================================================== */
const Store = (() => {
  const USERS_KEY = "stm.users.v2";
  const SESSION_KEY = "stm.session.v2";
  const dataKey = (userId) => `stm.data.v2.${userId}`;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      console.warn("Read failed:", key, err);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn("Write failed:", key, err);
      return false;
    }
  }

  return {
    getUsers:     ()      => read(USERS_KEY, []),
    saveUsers:    (users) => write(USERS_KEY, users),

    getSession:   ()      => read(SESSION_KEY, null),
    setSession:   (s)     => write(SESSION_KEY, s),
    clearSession: ()      => { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} },

    getData:      (userId)       => read(dataKey(userId), null),
    saveData:     (userId, data) => write(dataKey(userId), data)
  };
})();