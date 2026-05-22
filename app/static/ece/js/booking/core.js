/**
 * core.js — State, Boot, Data Loaders, Polling, Hash-Based Routing & Global Utilities
 */
"use strict";

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════
let rooms = []; // GET /api/rooms/
let favRooms = []; // GET /api/rooms/favourites/
let myBookings = []; // GET /api/bookings/my/ (รายการของตัวเองสำหรับสิทธิ์ยกเลิก)
let allBookings = []; // GET /api/bookings/ (รายการทั้งหมดสำหรับแสดงผลบนปฏิทิน)
let calBookings = {}; // built from allBookings
let allSchedules = {}; // สำหรับเก็บตารางจองรวมของทุกห้อง (รวมข้อมูลผู้ใช้อื่นด้วย)
let activeBookingDraft = null; // ถังเก็บร่างฟอร์มเดิมชั่วคราวเพื่อส่งต่อไปยังห้องแนะนำสำรองเมื่อเกิดเหตุจองชน

// Router
let curView = "dashboard";
let curDetailId = null;
let curDetailBooking = null; // State สำหรับเก็บข้อมูลรายละเอียดจากการดึงผ่าน API ตรง
let curRoomId = null;
let mbTab = "all";
let dashSearch = "";
let dashType = "all";
let dashCapacity = ""; // State เก็บค่าความจุตัวเลขสำหรับหน้าแดชบอร์ด
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

// Room schedule cache { roomId: { weekStart: data } }
let scheduleCache = {};

// ═══════════════════════════════════════════════════════════════════
// BOOT
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

  // โหลดรายการจองของตนเอง (myBookings) และรายการจองทั้งหมด (allBookings)
  await Promise.all([
    loadRooms(),
    loadFavRooms(),
    loadMyBookings(),
    loadAllBookings(),
  ]);
  await loadAllSchedules(); // โหลดตารางจองภาพรวมของทุกห้องตั้งแต่เริ่มต้นระบบ

  // เริ่มระบบตรวจจับเส้นทาง Hash และบูตหน้าแรกตาม URL ปัจจุบันเมื่อเปิดหรือรีเฟรชหน้าเว็บ
  window.addEventListener("hashchange", handleRoute);
  await handleRoute();

  startRealtimePolling();
});

// ═══════════════════════════════════════════════════════════════════
// DATA LOADERS
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

async function loadBookingDetail(id) {
  try {
    curDetailBooking = await api.get(`/api/bookings/${id}/?_t=${Date.now()}`);
  } catch (err) {
    showApiError(err);
    curDetailBooking = null;
  }
}

// ดึงรายละเอียดคิวจองรายห้องของทุกท่านสำหรับนำมาประมวลผลบนแดชบอร์ดหลัก
async function loadAllSchedules() {
  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  const weekStart = `${y}-${m}-${d}`;

  const promises = rooms.map(async (r) => {
    try {
      const data = await api.get(
        `/api/rooms/${r.room_id}/schedule/?week_start=${weekStart}&_t=${Date.now()}`,
      );
      allSchedules[r.room_id] = data;
    } catch (err) {
      console.error(`Failed to load schedule for room ${r.room_id}:`, err);
    }
  });
  await Promise.all(promises);
}

// โหลดรายการจองของตนเอง
async function loadMyBookings() {
  try {
    const data = await api.get(`/api/bookings/my/?_t=${Date.now()}`);
    myBookings = data || [];
  } catch (err) {
    showApiError(err);
  }
}

// โหลดรายการจองของทุกคนมาแสดงบนปฏิทิน
async function loadAllBookings() {
  try {
    const data = await api.get(`/api/admin/bookings/?_t=${Date.now()}`);
    allBookings = data || [];
    buildCalBookings(); // ประกอบปฏิทินด้วยรายการจองทั้งหมด
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

  allBookings.forEach((b) => {
    if (b.status !== "Approved" && b.status !== "Pending") return;

    const start = new Date(b.start_datetime);
    const y = start.getFullYear(),
      m = start.getMonth(),
      d = start.getDate();
    const key = `${y}-${m}-${d}`;
    if (!calBookings[key]) calBookings[key] = [];
    const end = new Date(b.end_datetime);

    // ตรวจสอบสิทธิ์ยกเลิก: จะยกเลิกได้เฉพาะรายการที่เป็นของผู้ใช้คนนี้เท่านั้น (มีอยู่ใน myBookings)
    const isMine = myBookings.some((mb) => mb.booking_id === b.booking_id);

    const roomCode = b.room_code || (b.room ? b.room.room_code : "—");
    const roomName = b.room_name || (b.room ? b.room.room_name : "—");

    calBookings[key].push({
      room_id: b.room_id || (b.room ? b.room.room_id : null),
      room: roomCode,
      roomFull: `${roomName} (${roomCode})`,
      time: `${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`,
      h: start.getHours(),
      dur: (end - start) / 3600000,
      subj: b.subject || b.purpose_type,
      status: b.status,
      id: b.booking_id,
      can_view: b.booker && b.booker.user_id !== null,
      can_cancel: b.can_cancel && isMine,
      is_mine: isMine,
    });
  });
}

function isAnyModalOpen() {
  const modals = ["dayModal", "cancelModal", "cancelGroupModal"];
  return modals.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
}

async function refreshDataSilent() {
  if (isAnyModalOpen()) return;

  try {
    const params = {
      q: dashSearch,
      room_type: dashType,
      capacity: dashCapacity,
    };
    let query = `/api/rooms/?is_active=true&_t=${Date.now()}`;
    if (params.room_type && params.room_type !== "all")
      query += `&room_type=${encodeURIComponent(params.room_type)}`;
    if (params.capacity)
      query += `&capacity=${encodeURIComponent(params.capacity)}`;
    if (params.q) query += `&q=${encodeURIComponent(params.q)}`;

    // ดึงค่าข้อมูลทั้งหมด รวมถึง allBookings เพื่ออัปเดตปฏิทินแบบเรียลไทม์
    const [roomsData, myBookingsData, allBookingsData, favRoomsData] =
      await Promise.all([
        api.get(query),
        api.get(`/api/bookings/my/?_t=${Date.now()}`),
        api.get(`/api/admin/bookings/?_t=${Date.now()}`),
        api.get(`/api/rooms/favourites/?_t=${Date.now()}`),
      ]);

    rooms = roomsData || [];
    myBookings = myBookingsData || [];
    allBookings = allBookingsData || [];
    favRooms = favRoomsData || [];
    buildCalBookings();

    if (curView === "dashboard") {
      await loadAllSchedules();
      redrawRooms();
    } else if (curView === "calendar") {
      calRender();
    } else if (curView === "my-bookings") {
      redrawMyBookings();
    } else if (curView === "detail") {
      if (curDetailId) {
        await loadBookingDetail(curDetailId);
        renderApp();
      }
    } else if (curView === "room-booking") {
      scheduleCache = {};
      await loadRoomScheduleForView();
    }
  } catch (err) {
    console.error("Background sync failed:", err);
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
    await refreshDataSilent();
  }, 30000);
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION / ROUTER (HASH-BASED ROUTING)
// ═══════════════════════════════════════════════════════════════════
function navigate(view, params = {}) {
  const searchParams = new URLSearchParams();
  if (params.roomId) searchParams.set("roomId", params.roomId);
  if (params.detailId) searchParams.set("detailId", params.detailId);

  const paramStr = searchParams.toString();
  window.location.hash = paramStr ? `${view}?${paramStr}` : view;
}

async function handleRoute() {
  const hash = window.location.hash.replace("#", "") || "dashboard";

  let view = hash;
  let roomId = null;
  let detailId = null;

  if (hash.includes("?")) {
    const parts = hash.split("?");
    view = parts[0];
    const params = new URLSearchParams(parts[1]);
    roomId = params.get("roomId");
    detailId = params.get("detailId");
  }

  if (["my-bookings", "detail", "calendar", "dashboard"].includes(view)) {
    if (curView !== view) {
      activeBookingDraft = null;
      // ถ้ากำลังเดินทาง calendar → dashboard คือ flow การจองจากปฏิทิน
      // ให้คง calBookDate ไว้ อย่าล้าง
      const keepCalDate = curView === "calendar" && view === "dashboard";
      if (!keepCalDate) {
        calBookDate = null;
        calBookKey = null;
        calBookLabel = null;
      }
    }
  }

  curView = view;
  if (roomId) curRoomId = String(roomId);
  if (detailId) curDetailId = detailId;

  const sideMap = {
    dashboard: "dashboard",
    "room-booking": "dashboard",
    "my-bookings": "my-bookings",
    detail: "my-bookings",
    calendar: "calendar",
  };

  document.querySelectorAll("[data-view]").forEach((el) => {
    const active = el.dataset.view === (sideMap[view] || view);
    el.className = `nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${active ? "nav-active" : "text-slate-600"}`;
  });

  if (view === "detail" && detailId) {
    renderDetailLoading();
    await loadBookingDetail(detailId);
  }

  renderApp();
  const app = document.getElementById("app");
  if (app) app.scrollTop = 0;
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

function doLogout() {
  window.location.href = "/logout/";
}

// Global Click
window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("cancelModal")) closeCancelModal();
  if (e.target === document.getElementById("cancelGroupModal"))
    closeCancelGroupModal();
  if (e.target === document.getElementById("dayModal")) closeDayModal();
  const fw = document.getElementById("calFW");
  if (fw && !fw.contains(e.target))
    document.getElementById("calFDD")?.classList.remove("open");
});
