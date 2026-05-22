/**
 * core.js — State, Boot, Background Sync, Hash-Based Routing & Global Utilities
 */
"use strict";

// ═══════════════════════════════════════════════════════════════════
// STATE & CONFIG
// ═══════════════════════════════════════════════════════════════════
let rooms = []; // GET /api/admin/req/room/
let bookings = []; // GET /api/admin/bookings/
let reportsSummary = null; // GET /api/reports/summary/

let curView = "dashboard";
let curActionId = null;
let curDetailId = null;
let cancelGroupId = null;
let calDate = new Date();
let calRoomFilter = "all";

const LOCAL_MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  let user = {};
  try {
    user = await api.get(`/api/auth/me/?_t=${Date.now()}`);
  } catch (err) {
    console.error("Failed to load admin user info from /api/auth/me/:", err);
    user = window.ECE_USER || {};
  }

  const displayName = user.displayname_th || user.username || "—";
  const sideNameEl = document.getElementById("sideUserName");
  if (sideNameEl) sideNameEl.textContent = displayName;

  const topNameEl = document.getElementById("topUserName");
  if (topNameEl) topNameEl.textContent = displayName;

  await Promise.all([loadRooms(), loadBookings()]);

  // เริ่มระบบตรวจจับเส้นทาง Hash และบูตหน้าจอแรกตาม URL ปัจจุบันเมื่อเปิดหรือรีเฟรชหน้าเว็บ
  window.addEventListener("hashchange", handleRoute);
  handleRoute();

  startRealtimePolling();
});

function doLogout() {
  window.location.href = "/logout/";
}

// ═══════════════════════════════════════════════════════════════════
// DATA LOADERS
// ═══════════════════════════════════════════════════════════════════
async function loadRooms() {
  try {
    rooms = (await api.get("/api/admin/req/room/")) || [];
  } catch (err) {
    showApiError(err);
  }
}

async function loadBookings(statusFilter = "") {
  try {
    const q = statusFilter ? `?status=${statusFilter}` : "";
    bookings = (await api.get(`/api/admin/bookings/${q}`)) || [];
  } catch (err) {
    showApiError(err);
  }
}

async function loadReportsSummary() {
  try {
    reportsSummary = await api.get(`/api/reports/summary/?_t=${Date.now()}`);
  } catch (err) {
    console.error("Failed to load summary statistics from API:", err);
    reportsSummary = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// REALTIME BACKGROUND SYNC (POLLING)
// ═══════════════════════════════════════════════════════════════════
let pollingInterval = null;

function startRealtimePolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    if (document.hidden) return;
    await refreshAdminDataSilent();
  }, 30000);
}

function isAnyModalOpen() {
  const modals = [
    "approveModal",
    "rejectModal",
    "roomModal",
    "dayModal",
    "cancelModal",
    "cancelGroupModal",
    "exportModal",
    "deleteRoomConfirmModal",
    "saveRoomConfirmModal",
  ];
  return modals.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
}

async function refreshAdminDataSilent() {
  try {
    const [roomsData, bookingsData] = await Promise.all([
      api.get("/api/admin/req/room/"),
      api.get("/api/admin/bookings/"),
    ]);

    rooms = roomsData || [];
    bookings = bookingsData || [];
    updatePendingBadge();

    if (!isAnyModalOpen()) {
      if (curView === "reports") {
        await loadReportsSummary();
      }

      if (
        [
          "dashboard",
          "approvals",
          "all-bookings",
          "detail",
          "reports",
        ].includes(curView)
      ) {
        const app = document.getElementById("app");
        if (app) {
          app.innerHTML = `<div class="view-enter">${render()}</div>`;
          if (curView === "reports") buildMonthOptions();
        }
      } else if (curView === "calendar") {
        calRender();
      }
    }
  } catch (err) {
    console.error("Silent background refresh failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTER & HASH-BASED ROUTING
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ROUTER (HASH-BASED ROUTING WITH HIDDEN PARAMETERS)
// ═══════════════════════════════════════════════════════════════════
function go(v) {
  if (v.includes("?")) {
    const parts = v.split("?");
    const view = parts[0];
    const params = new URLSearchParams(parts[1]);
    const id = params.get("id");
    const status = params.get("status");

    if (id) {
      sessionStorage.setItem("curDetailId", id);
    }

    if (status) {
      sessionStorage.setItem("bookingFilterStatus", status);
    }

    window.location.hash = view;
  } else {
    window.location.hash = v;
  }
}

async function handleRoute() {
  const hash = window.location.hash.replace("#", "") || "dashboard";

  let view = hash;
  let param = null;

  // หากเป็นหน้าต่างรายละเอียด ให้อ่านค่า ID จาก Session Storage ที่ระบบบันทึกไว้ซ่อนหลังบ้าน
  if (view === "detail") {
    param = sessionStorage.getItem("curDetailId");
  }

  curView = view;

  if (view === "detail" && param) {
    curDetailId = param;
  }

  // ปรับปรุงการเน้นสีปุ่มเมนูที่ Active
  document.querySelectorAll("[data-view]").forEach((el) => {
    const isActive =
      el.dataset.view === view ||
      (view === "detail" && el.dataset.view === "all-bookings");
    el.className = `nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${isActive ? "nav-active" : "text-slate-600"}`;
  });

  updatePendingBadge();
  await renderCurrentView();
}

async function renderCurrentView() {
  if (curView === "reports") {
    await loadReportsSummary();
  }

  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `<div class="view-enter">${render()}</div>`;
    app.scrollTop = 0;
  }

  if (curView === "calendar") initCalendar();
  if (curView === "reports") buildMonthOptions();
}

function render() {
  switch (curView) {
    case "dashboard":
      return vDashboard();
    case "approvals":
      return vApprovals();
    case "all-bookings":
      return vAllBookings();
    case "rooms":
      return vRooms();
    case "reports":
      return vReports();
    case "calendar":
      return vCalendar();
    case "detail":
      return vDetailAdmin();
  }
  return "";
}

function updatePendingBadge() {
  const badge = document.getElementById("pendingBadge");
  const n = bookings.filter((b) => b.status === "Pending").length;
  if (badge) {
    badge.textContent = n || "";
    badge.style.display = n ? "" : "none";
  }
}

function viewDetailAdmin(id) {
  // เรียกใช้งานผ่านคำสั่ง go เพื่อบันทึกค่า ID และสลับไปยังหน้าหลักแบบไร้ตัวเลขคิวรี
  go(`detail?id=${id}`);
}
window.viewDetailAdmin = viewDetailAdmin;

function closeModals() {
  [
    "approveModal",
    "rejectModal",
    "roomModal",
    "dayModal",
    "cancelModal",
    "cancelGroupModal",
    "exportModal",
    "deleteRoomConfirmModal",
    "saveRoomConfirmModal",
  ].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
}

// Global Click
window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("approveModal")) closeModals();
  if (e.target === document.getElementById("rejectModal")) closeModals();
  if (e.target === document.getElementById("roomModal")) closeModals();
  if (e.target === document.getElementById("dayModal")) closeModals();
  if (e.target === document.getElementById("cancelModal")) closeModals();
  if (e.target === document.getElementById("cancelGroupModal")) closeModals();
  if (e.target === document.getElementById("exportModal")) closeModals();
  if (e.target === document.getElementById("deleteRoomConfirmModal"))
    closeDeleteConfirmModal();
  if (e.target === document.getElementById("saveRoomConfirmModal"))
    closeSaveConfirmModal();
});
