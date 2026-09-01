(function () {
  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("deliverysync-session-v1") || "null");
    } catch (e) {
      return null;
    }
  }

  function getArray(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    if (Array.isArray(result?.items)) return result.items;
    return [];
  }

  async function updateNotificationBadge() {
    const session = getSession();
    const token = session && session.token;
    if (!token) return;

    try {
      const response = await fetch("http://localhost:3000/api/notifications", {
        headers: { Authorization: "Bearer " + token },
      });

      if (!response.ok) return;

      const list = getArray(await response.json());
      const unread = list.filter((n) => !n.read).length;

      document.querySelectorAll(".icon-badge").forEach((el) => {
        el.textContent = unread > 0 ? String(unread) : "";
        el.style.display = unread > 0 ? "" : "none";
      });
    } catch (error) {
      console.error("Failed to load notification badge:", error);
    }
  }

  function wireProfileChip() {
    const isProfilePage = /profile\.html$/.test(window.location.pathname);

    document.querySelectorAll(".profile-chip").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", (event) => {
        event.preventDefault();
        if (!isProfilePage) window.location.href = "profile.html";
      });
    });
  }

  function wireLogout() {
    const btn = document.getElementById("driverLogout");
    if (!btn || btn.dataset.logoutWired) return;

    btn.dataset.logoutWired = "true";
    btn.addEventListener("click", () => {
      localStorage.removeItem("deliverysync-session-v1");
      window.location.href = "../login.html";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireProfileChip();
    wireLogout();
    updateNotificationBadge();
  });

  window.DriverCommon = { updateNotificationBadge };
})();
