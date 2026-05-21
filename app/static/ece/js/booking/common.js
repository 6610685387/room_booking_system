/**
 * common.js — ECE Room Booking Shared State & Routing Engine
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════
// GLOBAL SHARED STATE
// ═══════════════════════════════════════════════════════════════════
let rooms = [];
let favRooms = [];
let myBookings = [];
let calBookings = {};
let allSchedules = {};
let activeBookingDraft = null;

// Router
let curView = "dashboard";
let curDetailId = null;
let curDetailBooking = null;
let curRoomId = null;
let mbTab = "all";
let dashSearch = "";
let dashType = "all";
let dashCapacity = "";
let cancelId = null;
let cancelGroupId = null;
let bfType = "all";

// Calendar state
let calView = "month";
let calDate = new Date();
let calRooms = new Set();

// Booking-from-calendar context
let calBookDate = null;
let calBookKey = null;
let calBookLabel = null;

// Room schedule cache
let scheduleCache = {};

// ═══════════════════════════════════════════════════════════════════
// BOOT & HASH ROUTING
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  let user = {};

  try {
    user = await api.get(`/api/auth/me/?_t=${Date.now()}`);
  } catch (err) {
    console.error("Failed to load user info from /api/auth/me/:", err);
    user = window.ECE_USER || {};
  }

  const displayName = user.displayname_th || user.username || "—";
  const sideNameEl = document.getElementById("sideUserName");
  if (sideNameEl) sideNameEl.textContent = displayName;

  const topNameEl = document.getElementById("topUserName");
  if (topNameEl) topNameEl.textContent = displayName;

  await Promise.all([loadRooms(), loadFavRooms(), loadMyBookings()]);
  await loadAllSchedules();

  window.addEventListener("hashchange", handleHashRouting);
  await handleHashRouting();

  startRealtimePolling();
});

// จัดเส้นทางหน้าจอล่าสุดจากแฮชลิงก์บน URL
async function handleHashRouting() {
  const hash = window.location.hash || "#dashboard";

  const [viewPath, queryString] = hash.slice(1).split("?");
  const params = {};
  if (queryString) {
    queryString.split("&").forEach((pair) => {
      const [k, v] = pair.split("=");
      params[k] = decodeURIComponent(v);
    });
  }

  // ล้างค่าร่างข้อมูลเมื่อย้ายออกนอกขั้นตอนจองห้อง
  if (
    viewPath === "my-bookings" ||
    viewPath === "detail" ||
    viewPath === "calendar"
  ) {
    activeBookingDraft = null;
    calBookDate = null;
    calBookKey = null;
    calBookLabel = null;
  }

  curView = viewPath;
  if (params.detailId) curDetailId = params.detailId;
  if (params.roomId) curRoomId = String(params.roomId);

  const sideMap = {
    dashboard: "dashboard",
    "room-booking": "dashboard",
    "my-bookings": "my-bookings",
    detail: "my-bookings",
    calendar: "calendar",
  };

  document.querySelectorAll("[data-view]").forEach((el) => {
    const active = el.dataset.view === (sideMap[viewPath] || viewPath);
    el.className = `nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${active ? "nav-active" : "text-slate-600"}`;
  });

  if (viewPath === "detail" && params.detailId) {
    renderDetailLoading();
    await loadBookingDetail(params.detailId);
  }

  renderApp();

  const app = document.getElementById("app");
  if (app) app.scrollTop = 0;
}

function navigate(view, params = {}) {
  let hash = `#${view}`;
  const queryParts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      queryParts.push(`${k}=${encodeURIComponent(v)}`);
    }
  }
  if (queryParts.length > 0) {
    hash += `?${queryParts.join("&")}`;
  }
  window.location.hash = hash;
}

function renderDetailLoading() {
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML = `
      <div class="view-enter">
        <div class="p-6 sm:p-8 text-center text-slate-400">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-sm font-medium">กำลังโหลดรายละเอียดการจอง...</p>
        </div>
      </div>`;
  }
}

function renderApp() {
  const app = document.getElementById("app");
  if (!app) return;

  const prevScrollTop = app.scrollTop;
  let html = "";
  switch (curView) {
    case "dashboard":
      html = vDashboard();
      break;
    case "room-booking":
      html = vRoomBooking();
      break;
    case "my-bookings":
      html = vMyBookings();
      break;
    case "detail":
      html = vDetail();
      break;
    case "calendar":
      html = vCalendar();
      break;
  }

  app.innerHTML = `<div class="view-enter">${html}</div>`;
  app.scrollTop = prevScrollTop;

  if (curView === "calendar") initCalendar();
  if (curView === "room-booking") {
    loadRoomScheduleForView();
    syncBookingDates();
  }
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL DATA LOADERS
// ═══════════════════════════════════════════════════════════════════
async function loadRooms(params = {}) {
  try {
    let query = `/api/rooms/?is_active=true&_t=${Date.now()}`;
    if (params.room_type && params.room_type !== "all") {
      query += `&room_type=${encodeURIComponent(params.room_type)}`;
    }
    if (params.capacity) {
      query += `&capacity=${encodeURIComponent(params.capacity)}`;
    }
    if (params.q) {
      query += `&q=${encodeURIComponent(params.q)}`;
    }

    const data = await api.get(query);
    rooms = data || [];
    calRooms = new Set(rooms.map((r) => String(r.room_id)));
  } catch (err) {
    showApiError(err);
  }
}

async function loadFavRooms() {
  try {
    const data = await api.get(`/api/rooms/favourites/?_t=${Date.now()}`);
    favRooms = data || [];
  } catch (err) {
    favRooms = [];
    console.error("Failed to load favourites:", err);
  }
}

async function loadMyBookings() {
  try {
    const data = await api.get(`/api/bookings/my/?_t=${Date.now()}`);
    myBookings = data || [];
    buildCalBookings();
  } catch (err) {
    showApiError(err);
  }
}

async function loadRoomSchedule(roomId, weekStart) {
  const cacheKey = `${roomId}_${weekStart}`;
  if (scheduleCache[cacheKey]) return scheduleCache[cacheKey];
  try {
    const data = await api.get(
      `/api/rooms/${roomId}/schedule/?week_start=${weekStart}&_t=${Date.now()}`,
    );
    scheduleCache[cacheKey] = data;
    return data;
  } catch (err) {
    showApiError(err);
    return null;
  }
}

function buildCalBookings() {
  calBookings = {};
  myBookings.forEach((b) => {
    if (b.status !== "Approved" && b.status !== "Pending") return;

    const start = new Date(b.start_datetime);
    const y = start.getFullYear(),
      m = start.getMonth(),
      d = start.getDate();
    const key = `${y}-${m}-${d}`;
    if (!calBookings[key]) calBookings[key] = [];
    const end = new Date(b.end_datetime);
    calBookings[key].push({
      room: b.room_code,
      roomFull: `${b.room_name} (${b.room_code})`,
      time: `${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`,
      h: start.getHours(),
      dur: (end - start) / 3600000,
      subj: b.subject || b.purpose_type,
      status: b.status,
      id: b.booking_id,
      can_cancel: b.can_cancel,
    });
  });
}
