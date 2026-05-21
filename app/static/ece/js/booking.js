/**
 * booking.js — ECE Room Booking (user-facing)
 *
 * All data is fetched from the REST API.  No hard-coded mock arrays.
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════
let rooms = []; // GET /api/rooms/
let favRooms = []; // GET /api/rooms/favourites/
let myBookings = []; // GET /api/bookings/my/
let calBookings = {}; // built from myBookings
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

  await Promise.all([loadRooms(), loadFavRooms(), loadMyBookings()]);
  await loadAllSchedules(); // โหลดตารางจองภาพรวมของทุกห้องตั้งแต่เริ่มต้นระบบ
  navigate("dashboard");

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

// ช่วยคัดแยกเฉพาะสล็อตจองของวันนี้ที่อยู่ในสถานะ Approved หรือ Pending จากข้อมูลตารางรวม
function getTodayBookingsFromSchedule(roomId, roomCode) {
  const sched = allSchedules[roomId];
  if (!sched || !sched.slots) return [];

  const daysEN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDayEN = daysEN[new Date().getDay()];

  return (sched.slots || [])
    .filter(
      (s) =>
        s.day === todayDayEN &&
        (s.status === "Approved" || s.status === "Pending"),
    )
    .map((s) => {
      const startH = parseAndRoundHour(s.start_time);
      const endH = parseAndRoundHour(s.end_time);
      const dur = endH - startH;
      return {
        room: roomCode,
        h: startH,
        dur: dur > 0 ? dur : 1,
        status: s.status,
        subj: s.label,
      };
    });
}

// ตรวจสอบสถานะการจอง ณ ชั่วโมงปัจจุบันจากสล็อตจองของวันนี้
function getCurrentBookingStatusFromList(todayBks) {
  const h = new Date().getHours();
  const activeBk = todayBks.find((b) => b.h <= h && b.h + b.dur > h);
  return activeBk ? activeBk.status : null;
}

async function toggleFavourite(roomId, event) {
  if (event) event.stopPropagation();
  try {
    await api.post(`/api/rooms/${roomId}/favourite/`, {});
    await loadFavRooms();
    redrawRooms();
    showToast("อัปเดตห้องโปรดเรียบร้อยแล้ว", "grade");
  } catch (err) {
    showApiError(err);
  }
}

window.toggleFavourite = toggleFavourite;

async function refreshDashboardRooms() {
  const container = document.getElementById("dashRooms");
  if (container) {
    container.innerHTML = `
      <div class="text-center py-16 text-slate-400">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        กำลังค้นหาข้อมูลห้อง...
      </div>`;
  }

  const params = {
    q: dashSearch,
    room_type: dashType,
    capacity: dashCapacity,
  };

  await Promise.all([loadRooms(params), loadFavRooms()]);
  await loadAllSchedules();
  redrawRooms();
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

    const [roomsData, bookingsData, favRoomsData] = await Promise.all([
      api.get(query),
      api.get(`/api/bookings/my/?_t=${Date.now()}`),
      api.get(`/api/rooms/favourites/?_t=${Date.now()}`),
    ]);

    rooms = roomsData || [];
    myBookings = bookingsData || [];
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

let searchTimeout = null;
function debounceSearch(val) {
  dashSearch = val;
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    refreshDashboardRooms();
  }, 300);
}

let capTimeout = null;
function debounceCapacity(val) {
  dashCapacity = val;
  if (capTimeout) clearTimeout(capTimeout);
  capTimeout = setTimeout(() => {
    refreshDashboardRooms();
  }, 300);
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
    if (b.status !== "Approved" && b.status !== "Pending") {
      return;
    }

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
// NAVIGATION / ROUTER (ปรับปรุงตรรกะให้จำวันที่และแบบร่างขณะวนลูปในหน้าจอง)
// ═══════════════════════════════════════════════════════════════════
async function navigate(view, params = {}) {
  // ล้างค่าดราฟต์และวันที่จำจากปฏิทิน เฉพาะเมื่อ "กดเปลี่ยนเมนูหลักหนีออกนอกขั้นตอนการจอง" (เช่น เมนูประวัติ หรือ เมนูปฏิทินหลัก)
  if (view === "my-bookings" || view === "detail" || view === "calendar") {
    activeBookingDraft = null;
    calBookDate = null;
    calBookKey = null;
    calBookLabel = null;
  }

  curView = view;
  if (params.detailId) curDetailId = params.detailId;
  if (params.roomId) curRoomId = String(params.roomId);

  const sideMap = {
    dashboard: "dashboard",
    "room-booking": "dashboard", // ไฮไลต์ปุ่มเมนูหน้าแรกค้างไว้ขณะทำการจอง
    "my-bookings": "my-bookings",
    detail: "my-bookings",
    calendar: "calendar",
  };
  document.querySelectorAll("[data-view]").forEach((el) => {
    const active = el.dataset.view === (sideMap[view] || view);
    el.className = `nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer ${active ? "nav-active" : "text-slate-600"}`;
  });

  if (view === "detail" && params.detailId) {
    renderDetailLoading();
    await loadBookingDetail(params.detailId);
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

// ═══════════════════════════════════════════════════════════════════
// VIEW: DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function vDashboard() {
  const today = new Date();
  const todayStr = `วัน${DAYS_TH_L[today.getDay()]}ที่ ${today.getDate()} ${MONTHS_TH[today.getMonth()]} ${toBE(today.getFullYear())}`;

  // ติดตั้งแบนเนอร์แจ้งผู้จองว่ากำลังดำเนินการจองห้องสำหรับวันที่คลิกมาจากปฏิทิน
  const calBanner = calBookDate
    ? `
<div class="mb-5 px-5 py-4 rounded-2xl border-2 flex items-center justify-between gap-3 animate-fade-in"
     style="border-color:#fecaca;background:#fff1f2">
    <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-[22px]" style="color:#7e0000">event</span>
        <div>
            <p class="text-sm font-bold" style="color:#7e0000">กำลังจองสำหรับวันที่ <span class="underline">${calBookLabel}</span></p>
            <p class="text-xs text-red-400 mt-0.5">วันที่จะถูกกรอกอัตโนมัติในฟอร์ม — กรุณาเลือกห้องด้านล่างเพื่อดำเนินการ</p>
        </div>
    </div>
    <button onclick="calBookDate=null;calBookKey=null;calBookLabel=null;renderApp()"
        class="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1">
        <span class="material-symbols-outlined text-[13px]">close</span>ล้างการเลือก
    </button>
</div>`
    : "";

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">ตารางการใช้ห้องวันนี้</h2>
            <p class="text-slate-500 text-sm mt-0.5">${todayStr}</p>
        </div>
    </div>

    ${calBanner}

    <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-5 flex flex-wrap gap-3 items-center">
        <div class="flex-1 min-w-[200px] relative">
            <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">search</span>
            <input type="text" placeholder="ค้นหาชื่อห้อง หรือรหัสห้อง..."
                value="${dashSearch}"
                oninput="debounceSearch(this.value)"
                class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        
        <div class="relative min-w-[140px]">
            <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">groups</span>
            <input type="number" placeholder="ความจุขั้นต่ำ..."
                value="${dashCapacity}"
                min="1"
                oninput="debounceCapacity(this.value)"
                class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>

        <div class="relative min-w-[150px]">
            <select onchange="dashType=this.value;refreshDashboardRooms()"
                class="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary appearance-none cursor-pointer">
                <option value="all"          ${dashType === "all" ? "selected" : ""}>ทุกประเภท</option>
                <option value="Meeting Room" ${dashType === "Meeting Room" ? "selected" : ""}>ห้องประชุม</option>
                <option value="Classroom"    ${dashType === "Classroom" ? "selected" : ""}>ห้องเรียน</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
        </div>
    </div>
    
    <div class="space-y-4" id="dashRooms">${renderRoomCards()}</div>
</div>`;
}

function renderRoomCards() {
  if (rooms.length === 0)
    return `<div class="text-center py-16 text-slate-400">
        <span class="material-symbols-outlined text-5xl block mb-2">search_off</span>
        ไม่พบห้องที่ตรงตามเงื่อนไขการค้นหา</div>`;

  const favIds = new Set(favRooms.map((r) => String(r.room_id)));

  const q = dashSearch.toLowerCase();
  const minCap = Number(dashCapacity) || 0;

  const filteredAll = rooms.filter(
    (r) =>
      (r.room_code.toLowerCase().includes(q) ||
        r.room_name.toLowerCase().includes(q)) &&
      (dashType === "all" || r.room_type === dashType) &&
      r.capacity >= minCap,
  );

  const favouriteSectionRooms = filteredAll.filter((r) =>
    favIds.has(String(r.room_id)),
  );
  const allSectionRooms = filteredAll;

  const makeCard = (room) => {
    const todayBks = getTodayBookingsFromSchedule(room.room_id, room.room_code);
    const currentStatus = getCurrentBookingStatusFromList(todayBks);
    const isFav = favIds.has(String(room.room_id));

    const bars = todayBks
      .map((b) => {
        const l = ((b.h - 8) / 12) * 100,
          w = (b.dur / 12) * 100;
        const bg = b.status === "Approved" ? "#ef4444" : "#f59e0b";
        return `<div class="tl-bar" style="left:${l}%;width:${w}%;background:${bg}"></div>`;
      })
      .join("");

    const imgHtml = room.room_image
      ? `<img src="${room.room_image}" class="absolute inset-0 w-full h-full object-cover">`
      : `<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50">
               <span class="material-symbols-outlined text-slate-300 text-[32px] mb-1">meeting_room</span>
               <div class="text-sm font-black text-slate-700">${room.room_code}</div>
             </div>`;

    const favIcon = "star";

    // ใช้ font-variation-settings เพื่อควบคุมการถมสี (FILL) ของ Material Symbols
    const favColor = isFav
      ? "text-amber-500 [font-variation-settings:'FILL'_1]"
      : "text-slate-400 hover:text-amber-500 [font-variation-settings:'FILL'_0]";

    const favBtn = `
      <button onclick="toggleFavourite('${room.room_id}', event)" 
              class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-105 transition-all z-10">
          <span class="material-symbols-outlined text-[19px] ${favColor}">${favIcon}</span>
      </button>
    `;

    let badgeHtml = "";
    if (currentStatus === "Approved") {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-red-700 bg-red-100 border border-red-200 flex-shrink-0">ถูกใช้งาน</span>`;
    } else if (currentStatus === "Pending") {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 flex-shrink-0">รออนุมัติ</span>`;
    } else {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 flex-shrink-0">ว่างตอนนี้</span>`;
    }

    return `
<div class="room-card relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid cursor-pointer hover:border-primary transition-all"
     style="grid-template-columns:30% 1fr"
     onclick="navigate('room-booking',{roomId:${room.room_id}})">
    <div class="relative h-full min-h-[90px] bg-slate-50 border-r border-slate-100">
        ${imgHtml}
        ${favBtn}
    </div>
    <div class="p-5">
        <div class="flex justify-between items-start gap-2 mb-2">
            <div>
                <h3 class="text-base font-bold text-slate-800">${room.room_name}</h3>
                <div class="flex gap-3 mt-0.5 text-xs text-slate-500">
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[13px]">groups</span>${room.capacity} ที่นั่ง
                    </span>
                    <span class="flex items-center gap-1">
                        <span class="material-symbols-outlined text-[13px]">meeting_room</span>${room.room_type}
                    </span>
                </div>
            </div>
            ${badgeHtml}
        </div>
        <div class="tl-bg">${bars}</div>
        <div class="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span>
        </div>
        ${
          todayBks.length === 0
            ? `<p class="text-[11px] text-emerald-600 font-medium mt-1">✓ ว่างตลอดวันนี้</p>`
            : `<p class="text-[11px] text-amber-600 font-medium mt-1">มีการจอง ${todayBks.length} ช่วง</p>`
        }
    </div>
</div>`;
  };

  let favSectionHtml = "";
  if (favouriteSectionRooms.length > 0) {
    favSectionHtml = `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-amber-500 fill-amber-500 text-[20px]">star</span>
          <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">ห้องโปรด (${favouriteSectionRooms.length})</h3>
        </div>
        <div class="space-y-4">${favouriteSectionRooms.map(makeCard).join("")}</div>
      </div>
    `;
  }

  const allSectionHtml = `
    <div>
      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined text-slate-400 text-[20px]">widgets</span>
        <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">ห้องทั้งหมด (${allSectionRooms.length})</h3>
      </div>
      <div class="space-y-4">${allSectionRooms.map(makeCard).join("")}</div>
    </div>
  `;

  return favSectionHtml + allSectionHtml;
}

function redrawRooms() {
  const el = document.getElementById("dashRooms");
  if (el) el.innerHTML = renderRoomCards();
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: ROOM BOOKING FORM
// ═══════════════════════════════════════════════════════════════════
function vRoomBooking() {
  const room = rooms.find(
    (r) => r.room_id === Number(curRoomId) || String(r.room_id) === curRoomId,
  );
  if (!room)
    return `<div class="p-8 text-center text-slate-400">ไม่พบข้อมูลห้อง</div>`;

  // ดึงค่าดราฟต์ข้อมูลเดิมที่เคยกรอกค้างไว้ (ดึงมาใช้งานได้อย่างปลอดภัยไม่สูญหาย)
  const draft = activeBookingDraft || {};

  const preDateStart = draft.date_start || calBookDate || "";
  const preDateEnd = draft.date_end || calBookDate || "";
  const preTimeStart = draft.time_start || "08:00";
  const preTimeEnd = draft.time_end || "10:00";
  const prePurpose = draft.purpose_type || "teaching";
  const preSubjCode = draft.subject_code || "";
  const preSubjName = draft.subject_name || "";
  const preProgType = draft.program_type || "";
  const preTopic = draft.training_topic || "";
  const preRequests = draft.additional_requests || "";
  const preSkip = draft.skip_conflicts || false;
  const preDays = draft.days_of_week || [];

  // ตรวจสอบเงื่อนไขการจองวันเดียวเพื่อใช้ละเว้นการติ๊กเลือกวันอัตโนมัติ
  const isSingleDayBooking = !preDateEnd || preDateStart === preDateEnd;

  let checkedDays = new Set(preDays);
  // ติ๊กวันอัตโนมัติเฉพาะกรณีที่เป็นการเลือกช่วงวันที่คนละวันกันเท่านั้น (ไม่ติ๊กถ้าเป็นวันเดียวเพื่อหลีกเลี่ยงกฎข้อที่ 1)
  if (checkedDays.size === 0 && preDateStart && !isSingleDayBooking) {
    const [year, month, day] = preDateStart.split("-").map(Number);
    const dObj = new Date(year, month - 1, day);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    checkedDays.add(dayNames[dObj.getDay()]);
  }

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const wdLabels = ["จ.", "อ.", "พ.", "พฤ.", "ศ."];
  const dayPills = weekDays
    .map((d, i) => {
      const checkedAttr = checkedDays.has(d) ? "checked" : "";
      return `
<label class="day-pill cursor-pointer" title="${wdLabels[i]}">
    <input type="checkbox" name="rec_day" value="${d}" ${checkedAttr} class="hidden">
    <div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">${wdLabels[i]}</div>
</label>`;
    })
    .join("");

  const imgHtml = room.room_image
    ? `<img src="${room.room_image}" class="absolute inset-0 w-full h-full object-cover">`
    : "";

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return `
<div class="p-6 sm:p-8">
    <div class="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <button onclick="navigate('dashboard')" class="hover:text-primary font-medium transition-colors">ภาพรวมห้องวันนี้</button>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <span class="text-slate-700 font-bold">${room.room_name} (${room.room_code})</span>
    </div>

    <div class="grid grid-cols-12 gap-6 items-start">
        <div class="col-span-12 lg:col-span-7 space-y-5">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="h-44 relative overflow-hidden bg-slate-100">
                    ${imgHtml}
                    <div class="absolute inset-0 flex items-end p-5" style="background:linear-gradient(to top,rgba(0,0,0,.65),transparent)">
                        <div>
                            <h2 class="text-2xl font-bold text-white">${room.room_name}</h2>
                            <div class="flex gap-3 text-white/80 text-sm mt-1">
                                <span><span class="material-symbols-outlined text-[14px] align-middle">groups</span> ${room.capacity} ที่นั่ง</span>
                                <span><span class="material-symbols-outlined text-[14px] align-middle">badge</span> ${room.room_code}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">calendar_view_week</span>
                    <h3 class="font-bold text-slate-800 text-sm">ตารางการจองรายสัปดาห์</h3>
                </div>
                <div class="p-4 overflow-x-auto" id="scheduleTableWrap">
                    <div class="skeleton h-32 w-full"></div>
                </div>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-5">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-md sticky top-4 overflow-hidden">
                <div class="px-6 py-4 flex items-center gap-2" style="background:linear-gradient(135deg,#7e0000,#a50000)">
                    <span class="material-symbols-outlined text-white/80 text-[19px]">edit_calendar</span>
                    <h3 class="font-bold text-white">ข้อมูลการจอง</h3>
                </div>
                <div class="p-5 space-y-4" id="bookFormBody">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">วัตถุประสงค์</label>
                        <div class="grid grid-cols-2 gap-2">
                            <label class="flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all" id="pl1" ${prePurpose === "teaching" ? 'style="border-color:#7e0000;background:#fff1f2"' : ""}>
                                <input type="radio" name="purp" value="teaching" ${prePurpose === "teaching" ? "checked" : ""} class="accent-red-800" onchange="hlPurpose(1)">
                                <span class="text-sm font-medium">สอนปกติ/ชดเชย</span>
                            </label>
                            <label class="flex items-center gap-2 p-3 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-primary transition-all" id="pl2" ${prePurpose === "training" ? 'style="border-color:#7e0000;background:#fff1f2"' : ""}>
                                <input type="radio" name="purp" value="training" ${prePurpose === "training" ? "checked" : ""} class="accent-red-800" onchange="hlPurpose(2)">
                                <span class="text-sm font-medium">จัดอบรม/ติว</span>
                            </label>
                        </div>
                    </div>

                    <div id="teaching-fields" class="space-y-4 ${prePurpose !== "teaching" ? "hidden" : ""}">
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1">รหัสวิชา</label>
                                <input type="text" id="subject_code" placeholder="EEXXX" value="${preSubjCode}"
                                    class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-xs font-bold text-slate-500 mb-1">ชื่อวิชา</label>
                                <input type="text" id="subject_name" placeholder="ระบุชื่อวิชา" value="${preSubjName}"
                                    class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">หลักสูตร (Program Type)</label>
                            <select id="program_type"
                                class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                                <option value="" disabled ${!preProgType ? "selected" : ""}>-- เลือกหลักสูตร --</option>
                                <option value="Bachelor" ${preProgType === "Bachelor" ? "selected" : ""}>ปริญญาตรี</option>
                                <option value="Master" ${preProgType === "Master" ? "selected" : ""}>ปริญญาโท</option>
                                <option value="TEP-TEPE" ${preProgType === "TEP-TEPE" ? "selected" : ""}>TEP-TEPE</option>
                                <option value="TU-PINE" ${preProgType === "TU-PINE" ? "selected" : ""}>TU-PINE</option>
                            </select>
                        </div>
                    </div>

                    <div id="training-fields" class="space-y-4 ${prePurpose !== "training" ? "hidden" : ""}">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">หัวข้อการอบรม/ติว (Topic)</label>
                            <input type="text" id="training_topic" placeholder="ระบุชื่อหัวข้อหรือโครงการ" value="${preTopic}"
                                class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">วันที่เริ่ม</label>
                            <input type="date" id="date_start" value="${preDateStart}" min="${todayStr}" onchange="syncBookingDates('start')"
                                class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">วันที่สิ้นสุด</label>
                            <input type="date" id="date_end" value="${preDateEnd}" min="${todayStr}" onchange="syncBookingDates('end')"
                                class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                    </div>

                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">วันในสัปดาห์</label>
                            <button type="button" onclick="toggleAllWeekdays()" id="btnToggleAllDays" class="text-xs font-bold text-primary hover:underline">เลือกทุกวัน</button>
                        </div>
                        <div class="flex gap-2 flex-wrap">${dayPills}</div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">เวลาเริ่ม</label>
                            <input type="time" id="time_start" value="${preTimeStart}"
                                class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">เวลาสิ้นสุด</label>
                            <input type="time" id="time_end" value="${preTimeEnd}"
                                class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">คำขอเพิ่มเติม (ถ้ามี)</label>
                        <textarea id="additional_requests" rows="2" placeholder="เช่น ต้องการโปรเจคเตอร์, เครื่องเสียง..."
                            class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:border-primary">${preRequests}</textarea>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                            <p class="text-sm font-bold text-slate-700">ข้ามวันที่ชน (Recurring)</p>
                            <p class="text-xs text-slate-400">ข้ามวันที่มีการจองอื่นแล้วโดยอัตโนมัติ</p>
                        </div>
                        <label class="toggle flex items-center cursor-pointer relative w-10 h-5">
                            <input type="checkbox" id="skip_conflicts" ${preSkip ? "checked" : ""} class="sr-only peer">
                            <div class="w-full h-full rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-emerald-500"></div>
                            <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5"></div>
                        </label>
                    </div>

                    <div id="conflictAlert" class="hidden"></div>

                    <button onclick="submitBooking(${room.room_id})" id="submitBtn"
                        class="w-full py-3.5 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        style="background:#7e0000;box-shadow:0 4px 14px rgba(126,0,0,.25)">
                        <span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>`;
}

function toggleAllWeekdays() {
  const checkboxes = document.querySelectorAll("input[name='rec_day']");
  const anyUnchecked = Array.from(checkboxes).some((cb) => !cb.checked);

  checkboxes.forEach((cb) => {
    cb.checked = anyUnchecked;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const btn = document.getElementById("btnToggleAllDays");
  if (btn) {
    btn.textContent = anyUnchecked ? "ล้างทั้งหมด" : "เลือกทุกวัน";
  }
}
window.toggleAllWeekdays = toggleAllWeekdays;

function hlPurpose(n) {
  document.getElementById("pl1").style =
    n === 1 ? "border-color:#7e0000;background:#fff1f2" : "";
  document.getElementById("pl2").style =
    n === 2 ? "border-color:#7e0000;background:#fff1f2" : "";
  document
    .getElementById("teaching-fields")
    .classList.toggle("hidden", n !== 1);
  document
    .getElementById("training-fields")
    .classList.toggle("hidden", n !== 2);
}

function syncBookingDates(triggerSource) {
  const startEl = document.getElementById("date_start");
  const endEl = document.getElementById("date_end");
  if (!startEl || !endEl) return;

  if (triggerSource === "start" && startEl.value && !endEl.value) {
    endEl.value = startEl.value;
  }

  const startVal = startEl.value;
  const endVal = endEl.value;

  if (startVal && startVal === endVal) {
    document.querySelectorAll("input[name='rec_day']").forEach((cb) => {
      cb.checked = false;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const btn = document.getElementById("btnToggleAllDays");
    if (btn) btn.textContent = "เลือกทุกวัน";
  }
}

function parseAndRoundHour(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  return m >= 30 ? h + 1 : h;
}

async function loadRoomScheduleForView() {
  if (curView !== "room-booking") return;
  const wrap = document.getElementById("scheduleTableWrap");
  if (!wrap) return;

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  const weekStart = `${y}-${m}-${d}`;

  const sched = await loadRoomSchedule(curRoomId, weekStart);
  if (!sched) {
    wrap.innerHTML = `<p class="text-xs text-slate-400">ไม่สามารถโหลดตารางได้</p>`;
    return;
  }

  const hours = Array.from({ length: 12 }, (_, i) => i + 7);
  const wdLabels = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const MONTHS_TH_SHORT = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  const slotMap = {};
  (sched.slots || []).forEach((s) => {
    const status = s.status || "Approved";
    if (status !== "Approved" && status !== "Pending") return;

    const startHour = parseAndRoundHour(s.start_time);
    const endHour = parseAndRoundHour(s.end_time);
    const safeEndHour = endHour <= startHour ? startHour + 1 : endHour;

    for (let h = startHour; h < safeEndHour; h++) {
      if (!slotMap[s.day]) slotMap[s.day] = {};

      if (
        slotMap[s.day][h] &&
        slotMap[s.day][h].status === "Approved" &&
        status === "Pending"
      ) {
        continue;
      }
      slotMap[s.day][h] = s;
    }
  });

  const header = wdLabels
    .map((label, i) => {
      const colDate = new Date(sunday);
      colDate.setDate(sunday.getDate() + i);
      const dateNum = colDate.getDate();
      const monthShort = MONTHS_TH_SHORT[colDate.getMonth()];
      return `<th class="p-2 border border-slate-200 text-slate-600 font-bold text-center text-xs whitespace-nowrap">${label} ${dateNum} ${monthShort}</th>`;
    })
    .join("");

  const rows = hours
    .map((h) => {
      const cols = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map((day) => {
          const sl = slotMap[day]?.[h];
          if (sl) {
            const isPending = sl.status === "Pending";

            const cellClass = isPending
              ? "bg-amber-50/80 border-l-2 border-l-amber-500"
              : "bg-red-50/80 border-l-2 border-l-red-500";
            const textClass = isPending ? "text-amber-700" : "text-red-700";
            const statusText = isPending ? " (รออนุมัติ)" : " (ถูกจองแล้ว)";

            return `<td class="p-1 border border-slate-100 ${cellClass}" title="${sl.label}${statusText}">
                       <span class="text-[10px] ${textClass} font-bold truncate block">${sl.label}</span>
                    </td>`;
          }
          return `<td class="p-2 border border-slate-100 hover:bg-slate-50 transition-colors"></td>`;
        })
        .join("");
      return `<tr><td class="p-2 border border-slate-200 bg-slate-50 text-slate-400 text-center font-medium text-xs">${h}:00</td>${cols}</tr>`;
    })
    .join("");

  const blackoutNote = (sched.blackout_days || []).length
    ? `<p class="text-xs text-red-500 font-medium mt-2 flex items-center gap-1">
               <span class="material-symbols-outlined text-[13px]">block</span>
               ปิดปรับปรุง: ${sched.blackout_days.join(", ")}
           </p>`
    : "";

  wrap.innerHTML = `
<table class="w-full text-xs border-collapse min-w-[700px]">
    <thead><tr class="bg-slate-50">
        <th class="p-2 border border-slate-200 text-slate-400 font-bold w-14 text-center">เวลา</th>${header}
    </tr></thead>
    <tbody>${rows}</tbody>
</table>
<div class="flex gap-4 mt-3 text-xs font-bold">
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-red-500 rounded"></span>ถูกจองแล้ว</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-amber-500 rounded"></span>รออนุมัติ (Pending)</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-slate-300 bg-white" style="background:#ffffff"></span>ว่าง</span>
</div>${blackoutNote}`;
}

async function submitBooking(roomId) {
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> กำลังส่ง...`;

  const purposeEl = document.querySelector("input[name=purp]:checked");
  const purposeType = purposeEl ? purposeEl.value : "teaching";

  const days = [
    ...document.querySelectorAll("input[name=rec_day]:checked"),
  ].map((c) => c.value);

  const dateStart = document.getElementById("date_start").value;
  const dateEnd = document.getElementById("date_end").value;

  const isSingleDay = !dateEnd || dateStart === dateEnd;

  if (isSingleDay && days.length > 0) {
    showToast("เลือกแค่วันเดียวไม่ต้องส่งวัน", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  const payload = {
    room_id: roomId,
    date_start: dateStart,
    date_end: dateEnd || dateStart,
    days_of_week: null,
    time_start: document.getElementById("time_start").value,
    time_end: document.getElementById("time_end").value,
    purpose_type: purposeType,
    skip_conflicts: document.getElementById("skip_conflicts")?.checked || false,
    additional_requests:
      document.getElementById("additional_requests")?.value || "",
  };

  if (isSingleDay) {
    payload.days_of_week = null;
  } else {
    if (days.length === 0) {
      payload.days_of_week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    } else {
      payload.days_of_week = days;
    }
  }

  if (purposeType === "teaching") {
    payload.teaching_info = {
      subject_code: document.getElementById("subject_code")?.value || "",
      subject_name: document.getElementById("subject_name")?.value || "",
      program_type: document.getElementById("program_type")?.value || "",
    };
  } else {
    payload.training_info = {
      topic: document.getElementById("training_topic")?.value || "",
    };
  }

  if (!payload.date_start) {
    showToast("กรอกข้อมูลไม่ครบ: กรุณาระบุวันที่เริ่มการจอง", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (purposeType === "teaching") {
    if (
      !payload.teaching_info.subject_code ||
      !payload.teaching_info.subject_name ||
      !payload.teaching_info.program_type
    ) {
      showToast(
        "กรอกข้อมูลไม่ครบ: กรุณาระบุรหัสวิชา ชื่อวิชา และหลักสูตรให้ครบถ้วน",
        "error",
      );
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
      return;
    }
  } else {
    if (!payload.training_info.topic) {
      showToast("กรอกข้อมูลไม่ครบ: กรุณาระบุหัวข้อการอบรมหรือติว", "error");
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
      return;
    }
  }

  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = String(now.getMonth() + 1).padStart(2, "0");
  const todayD = String(now.getDate()).padStart(2, "0");
  const todayStr = `${todayY}-${todayM}-${todayD}`;

  const curHour = String(now.getHours()).padStart(2, "0");
  const curMin = String(now.getMinutes()).padStart(2, "0");
  const curTimeStr = `${curHour}:${curMin}`;

  if (payload.date_start < todayStr) {
    showToast("ไม่สามารถเลือกวันที่จองย้อนหลังในอดีตได้", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (payload.date_end && payload.date_start > payload.date_end) {
    showToast("วันที่เริ่มต้องไม่เกิดขึ้นหลังวันที่สิ้นสุด", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (payload.date_start === todayStr && payload.time_start < curTimeStr) {
    showToast(
      `ไม่สามารถเลือกเวลาเริ่มย้อนหลังได้ (เวลาปัจจุบันคือ ${curTimeStr} น.)`,
      "error",
    );
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (payload.time_start >= payload.time_end) {
    showToast("เวลาเริ่มต้องเกิดขึ้นก่อนเวลาสิ้นสุด", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  try {
    const result = await api.post("/api/bookings/", payload);
    calBookDate = null;
    calBookKey = null;
    calBookLabel = null;
    await loadMyBookings();
    showToast(
      `ส่งคำขอจอง ${result.booking_ids?.length || 1} รายการเรียบร้อย`,
      "check_circle",
    );
    navigate("my-bookings");
  } catch (err) {
    if (err.status === 409) {
      await fetchAndShowConflictAlert(err.data?.report, payload);
      showToast(err.data?.error || "มีเวลาจองที่ชนกัน", "error");
    } else {
      const serverError =
        err.data?.error || err.message || "เกิดข้อผิดพลาดในการจอง";
      showToast(serverError, "error");
    }
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
  }
}

// ย้ายหน้าไปยังห้องเรียนที่ระบบแนะนำ โดยเก็บแบบฟอร์มข้อมูลเดิมเอาไว้ลงแบบฟอร์มคราวถัดไป
function selectSuggestedRoom(newRoomId) {
  const purposeEl = document.querySelector("input[name=purp]:checked");
  const purposeType = purposeEl ? purposeEl.value : "teaching";

  const days = [
    ...document.querySelectorAll("input[name=rec_day]:checked"),
  ].map((c) => c.value);

  activeBookingDraft = {
    purpose_type: purposeType,
    subject_code: document.getElementById("subject_code")?.value || "",
    subject_name: document.getElementById("subject_name")?.value || "",
    program_type: document.getElementById("program_type")?.value || "",
    training_topic: document.getElementById("training_topic")?.value || "",
    date_start: document.getElementById("date_start").value,
    date_end: document.getElementById("date_end").value,
    days_of_week: days,
    time_start: document.getElementById("time_start").value,
    time_end: document.getElementById("time_end").value,
    additional_requests:
      document.getElementById("additional_requests")?.value || "",
    skip_conflicts: document.getElementById("skip_conflicts")?.checked || false,
  };

  navigate("room-booking", { roomId: newRoomId });
}
window.selectSuggestedRoom = selectSuggestedRoom;

// ฟังก์ชันดึงรายงานผลห้องว่างสำรองที่เข้าเกณฑ์ โดยเรียงลำดับห้องโปรด (Favourite) ไว้แถวบนสุด
async function fetchAndShowConflictAlert(report, payload) {
  const el = document.getElementById("conflictAlert");
  if (!el || !report) return;

  let suggestionsHtml = "";
  try {
    const conflictReport = await api.post(
      "/api/bookings/check-conflict/",
      payload,
    );
    const suggestedRooms = conflictReport.suggested_rooms || [];

    if (suggestedRooms.length > 0) {
      const favIds = new Set(favRooms.map((r) => Number(r.room_id)));

      const sortedSuggestions = [...suggestedRooms].sort((a, b) => {
        const aIsFav = favIds.has(Number(a.room_id)) ? 1 : 0;
        const bIsFav = favIds.has(Number(b.room_id)) ? 1 : 0;
        return bIsFav - aIsFav;
      });

      const cards = sortedSuggestions
        .map((r) => {
          const isFav = favIds.has(Number(r.room_id));
          return `
<div class="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-primary transition-all">
    <div class="min-w-0 pr-2">
        <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-slate-800 text-sm">${r.room_name}</span>
            <span class="text-xs text-slate-400 font-bold">(${r.room_code})</span>
            ${isFav ? `<span class="material-symbols-outlined text-[15px] text-amber-500 fill-amber-500" title="ห้องโปรด">star</span>` : ""}
        </div>
        <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <span class="material-symbols-outlined text-[13px]">groups</span>ความจุ: ${r.capacity} ที่นั่ง
        </p>
    </div>
    <button onclick="selectSuggestedRoom(${r.room_id})"
        class="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0 shadow-sm">
        <span class="material-symbols-outlined text-[14px]">add_circle</span>จองห้องนี้
    </button>
</div>`;
        })
        .join("");

      suggestionsHtml = `
<div class="mt-3.5 space-y-2">
    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        <span class="material-symbols-outlined text-[15px] text-primary">meeting_room</span>ห้องแนะนำอื่นที่ว่างตรงเวลาของท่าน:
    </p>
    <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">${cards}</div>
</div>`;
    }
  } catch (err) {
    console.error("Failed to fetch alternative suggested rooms:", err);
  }

  const conflicts = (report.conflicts || [])
    .map(
      (c) =>
        `<li class="text-xs text-red-700">• ${c.date} ${c.start_time}–${c.end_time} (${c.conflict_type})</li>`,
    )
    .join("");

  el.innerHTML = `
<div class="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-4">
    <div>
        <p class="text-sm font-bold text-red-700 flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-[18px]">warning</span>
            มีวันที่และช่วงเวลาจองชน (${report.summary?.conflict_count || 0} วัน)
        </p>
        <ul class="space-y-0.5 max-h-32 overflow-y-auto pl-1">${conflicts}</ul>
        <p class="text-[11px] text-slate-500 mt-2">เปิดสวิตช์ "ข้ามวันที่ชน" ด้านบนเพื่อเลือกจองเฉพาะวันที่ว่าง</p>
    </div>
    ${suggestionsHtml}
</div>`;
  el.classList.remove("hidden");
}

// ฟังก์ชัน "จองซ้ำ" เพื่อคัดลอกรายละเอียดคิวจองประวัติเดิมทั้งหมด โดยละเว้นข้อมูลวันเริ่ม/วันสิ้นสุดเดิมออกไปเพื่อให้ผู้ใช้ติ๊กเลือกใหม่เอง
async function rebookFromHistory(bookingId) {
  try {
    showToast("กำลังดึงรายละเอียดข้อมูลจองเดิม...", "autorenew");
    const b = await api.get(`/api/bookings/${bookingId}/?_t=${Date.now()}`);
    if (!b) return;

    // เก็บลงแบบร่าง Draft เพื่อให้หน้าต่างเขียนฟอร์มจอง ดึงสืบทอดข้อมูลไปแสดงผลล่วงหน้าอัตโนมัติ
    activeBookingDraft = {
      purpose_type: b.purpose_type,
      subject_code: b.teaching_info?.subject_code || "",
      subject_name: b.teaching_info?.subject_name || "",
      program_type: b.teaching_info?.program_type || "",
      training_topic: b.training_info?.topic || "",
      date_start: "", // ปล่อยว่างเพื่อบังคับให้ผู้จองเป็นผู้กรอกระบุวันใหม่เองตามข้อกำหนด
      date_end: "", // ปล่อยว่างเพื่อบังคับให้ผู้จองเป็นผู้กรอกระบุวันใหม่เองตามข้อกำหนด
      days_of_week: [], // คืนค่าเพื่อให้ผู้ใช้เริ่มเลือกวันที่ในการจองใหม่ทั้งหมดร่วมกับสล็อต
      time_start: timeFromISO(b.start_datetime),
      time_end: timeFromISO(b.end_datetime),
      additional_requests: b.additional_requests || "",
      skip_conflicts: false,
    };

    const roomId = b.room?.room_id || b.room_id;
    navigate("room-booking", { roomId: roomId });
  } catch (err) {
    showApiError(err);
  }
}
window.rebookFromHistory = rebookFromHistory;

// ═══════════════════════════════════════════════════════════════════
// VIEW: MY BOOKINGS
// ═══════════════════════════════════════════════════════════════════
function vMyBookings() {
  const counts = {
    all: myBookings.filter((b) => b.status !== "Cancelled").length,
    Pending: myBookings.filter((b) => b.status === "Pending").length,
    Approved: myBookings.filter((b) => b.status === "Approved").length,
    Rejected: myBookings.filter((b) => b.status === "Rejected").length,
  };
  const tabs = [
    ["all", "ทั้งหมด"],
    ["Pending", "รออนุมัติ"],
    ["Approved", "อนุมัติแล้ว"],
    ["Rejected", "ไม่อนุมัติ"],
  ];
  const filtered =
    mbTab === "all"
      ? myBookings.filter((b) => b.status !== "Cancelled")
      : myBookings.filter((b) => b.status === mbTab);

  const tabHtml = tabs
    .map(
      ([k, l]) => `
<button onclick="setMbTab('${k}')" data-mbt="${k}"
    class="pb-3 px-1 border-b-2 text-sm font-bold transition-all flex items-center gap-1.5 ${mbTab === k ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}">
    ${l} <span class="px-1.5 py-0.5 rounded-full text-[10px] ${mbTab === k ? "text-white" : "bg-slate-200 text-slate-500"}" ${mbTab === k ? 'style="background:#7e0000"' : ""}>${counts[k]}</span>
</button>`,
    )
    .join("");

  const cardsHtml = buildMyBookingsHtml(filtered);

  return `
<div class="p-6 sm:p-8 w-full">
    <header class="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">รายการจองของฉัน</h2>
            <p class="text-slate-500 text-sm mt-0.5">ตรวจสอบสถานะและจัดการรายการจองห้อง</p>
        </div>
        <button onclick="loadMyBookings().then(()=>renderApp())"
            class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
            <span class="material-symbols-outlined text-[16px]">refresh</span>รีเฟรช
        </button>
    </header>
    <div class="flex gap-5 border-b border-slate-200 mb-6">${tabHtml}</div>
    <div class="space-y-4" id="myBookingsList">${cardsHtml}</div>
</div>`;
}

function redrawMyBookings() {
  const container = document.getElementById("myBookingsList");
  if (!container) return;

  const filtered =
    mbTab === "all"
      ? myBookings.filter((b) => b.status !== "Cancelled")
      : myBookings.filter((b) => b.status === mbTab);

  const cardsHtml = buildMyBookingsHtml(filtered);
  container.innerHTML = cardsHtml;
}

function buildMyBookingsHtml(filteredList) {
  if (filteredList.length === 0) {
    return `<div class="text-center py-16 text-slate-400"><span class="material-symbols-outlined text-5xl block mb-2">event_busy</span>ไม่มีรายการจองในหมวดนี้</div>`;
  }

  const groupedList = [];
  const seenGroups = {};

  filteredList.forEach((b) => {
    const gid = b.recurring_group_id;
    if (!gid) {
      groupedList.push({ type: "single", booking: b });
    } else {
      if (!seenGroups[gid]) {
        seenGroups[gid] = {
          type: "group",
          groupId: gid,
          room_name: b.room_name,
          room_code: b.room_code,
          purpose_type: b.purpose_type,
          subject: b.subject,
          bookings: [],
        };
        groupedList.push(seenGroups[gid]);
      }
      seenGroups[gid].bookings.push(b);
    }
  });

  const borderMap = {
    Pending: "border-l-amber-400",
    Approved: "border-l-emerald-500",
    Rejected: "border-l-red-400",
    Cancelled: "border-l-slate-300",
  };

  return groupedList
    .map((item) => {
      if (item.type === "single") {
        const b = item.booking;
        const start = thaiDateShort(b.start_datetime);
        const end = thaiDateShort(b.end_datetime);
        const ts = timeFromISO(b.start_datetime);
        const te = timeFromISO(b.end_datetime);
        const adminNotesText = b.admin_notes || b.admin_note || "";

        return `
<div class="bg-white border border-slate-200 border-l-4 ${borderMap[b.status] || "border-l-slate-300"} rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-slate-300 hover:shadow transition-all"
     onclick="navigate('detail',{detailId:${b.booking_id}})">
    <div class="flex-1 space-y-2 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">${badge(b.status)}<span class="text-slate-400 text-xs">#${b.booking_id}</span></div>
        <h3 class="text-base font-bold text-slate-800 truncate">${b.room_name} (${b.room_code})</h3>
        <p class="text-sm text-slate-600">${b.purpose_type}: ${b.subject || "—"}</p>
        <div class="flex flex-wrap gap-3 text-xs text-slate-500">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}${end !== start ? " – " + end : ""}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te}</span>
        </div>
        ${
          b.reject_reason
            ? `<div class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5 mt-1.5">
            <span class="material-symbols-outlined text-[13px] mt-0.5 flex-shrink-0">admin_panel_settings</span><strong>เหตุผลที่ปฏิเสธ:</strong> ${b.reject_reason}</div>`
            : ""
        }
        ${
          adminNotesText
            ? `<div class="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5 mt-1.5">
            <span class="material-symbols-outlined text-[13px] mt-0.5 flex-shrink-0">info</span><strong>หมายเหตุอนุมัติ:</strong> ${adminNotesText}</div>`
            : ""
        }
    </div>
    <div class="flex gap-2 flex-shrink-0 md:self-center">
        <!-- ปุ่มจองซ้ำแบบการจองใบเดี่ยว -->
        <button onclick="event.stopPropagation(); rebookFromHistory(${b.booking_id})"
            class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all">
            <span class="material-symbols-outlined text-[15px]">autorenew</span>จองซ้ำ
        </button>
        ${
          b.can_cancel
            ? `
        <button onclick="event.stopPropagation(); openCancelModal(${b.booking_id})"
            class="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 border border-red-100 flex items-center gap-1.5 transition-all">
            <span class="material-symbols-outlined text-[15px]">cancel</span>ยกเลิก
        </button>`
            : `
        <button onclick="event.stopPropagation();" class="px-4 py-2 bg-slate-50 text-slate-300 rounded-xl font-bold text-xs cursor-not-allowed border border-slate-100 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[15px]">cancel</span>ยกเลิก
        </button>`
        }
    </div>
</div>`;
      } else {
        const g = item;
        const canCancelAnyGroup = g.bookings.some((b) => b.can_cancel);

        const sortedBookings = [...g.bookings].sort(
          (x, y) => new Date(x.start_datetime) - new Date(y.start_datetime),
        );
        const minDateStr = thaiDateShort(sortedBookings[0].start_datetime);
        const maxDateStr = thaiDateShort(
          sortedBookings[sortedBookings.length - 1].start_datetime,
        );
        const ts = timeFromISO(g.bookings[0].start_datetime);
        const te = timeFromISO(g.bookings[0].end_datetime);

        const sortedSlots = [...g.bookings].sort(
          (x, y) => new Date(x.start_datetime) - new Date(y.start_datetime),
        );

        const slotsHtml = sortedSlots
          .map((b) => {
            const start = thaiDateShort(b.start_datetime);
            const tsSlot = timeFromISO(b.start_datetime);
            const teSlot = timeFromISO(b.end_datetime);
            const adminNotesText = b.admin_notes || b.admin_note || "";

            return `
<div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white border border-slate-150 gap-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
     onclick="event.stopPropagation(); navigate('detail',{detailId:${b.booking_id}})">
    <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-400">#${b.booking_id}</span>
            ${badge(b.status)}
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${tsSlot} – ${teSlot} น.</span>
        </div>
        ${
          b.reject_reason
            ? `<div class="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-1">
                <strong>เหตุผลที่ปฏิเสธ:</strong> ${b.reject_reason}
               </div>`
            : ""
        }
        ${
          adminNotesText
            ? `<div class="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mt-1">
                <strong>หมายเหตุอนุมัติ:</strong> ${adminNotesText}
               </div>`
            : ""
        }
    </div>
    <div class="flex-shrink-0 self-end sm:self-center flex gap-1.5 items-center">
        <!-- ปุ่มจองซ้ำสำหรับแถวคิวย่อยภายในกลุ่มจองต่อเนื่อง -->
        <button onclick="event.stopPropagation(); rebookFromHistory(${b.booking_id})"
            class="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all">
            <span class="material-symbols-outlined text-[13px]">autorenew</span>จองซ้ำ
        </button>
        ${
          b.can_cancel
            ? `
        <button onclick="event.stopPropagation(); openCancelModal(${b.booking_id})"
            class="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] hover:bg-red-100 border border-red-100 transition-all">
            ยกเลิกคิวนี้
        </button>`
            : `
        <span class="text-[10px] text-slate-300 font-semibold px-2">ยกเลิกไม่ได้</span>`
        }
    </div>
</div>`;
          })
          .join("");

        return `
<details class="bg-white border border-slate-200 border-l-4 border-l-indigo-500 rounded-xl shadow-sm overflow-hidden group/details">
    <summary class="p-5 cursor-pointer list-none flex flex-col md:flex-row md:items-center justify-between gap-4 select-none outline-none [&::-webkit-details-marker]:hidden">
        <div class="flex-1 space-y-2 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">กลุ่มต่อเนื่อง #${g.groupId}</span>
                <span class="text-slate-400 text-xs font-semibold">มีทริกเกอร์จองทั้งหมด ${g.bookings.length} วัน</span>
            </div>
            <h3 class="text-base font-bold text-slate-800 truncate">${g.room_name} (${g.room_code})</h3>
            <p class="text-sm text-slate-600">${g.purpose_type}: ${g.subject || "—"}</p>
            <div class="flex flex-wrap gap-3 text-xs text-slate-500">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${minDateStr} – ${maxDateStr}</span>
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
            </div>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0 self-end md:self-center">
            ${
              canCancelAnyGroup
                ? `
            <button onclick="event.stopPropagation(); openCancelGroupModal('${g.groupId}')"
                class="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all">
                <span class="material-symbols-outlined text-[15px]">event_busy</span>ยกเลิกทั้งกลุ่ม
            </button>`
                : ""
            }
            <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-500 group-open/details:rotate-180 transition-transform duration-200">
                <span class="material-symbols-outlined text-[18px]">expand_more</span>
            </div>
        </div>
    </summary>
    <div class="px-5 pb-5 pt-1.5 border-t border-slate-100 space-y-2 bg-slate-50/40">
        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">รายการวันจองภายในกลุ่ม:</p>
        ${slotsHtml}
    </div>
</details>`;
      }
    })
    .join("");
}

function setMbTab(t) {
  mbTab = t;
  renderApp();
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: BOOKING DETAIL
// ═══════════════════════════════════════════════════════════════════
function vDetail() {
  const b = curDetailBooking;
  if (!b)
    return `<div class="p-8 text-slate-400 text-center">
        <span class="material-symbols-outlined text-5xl block mb-2">search_off</span>ไม่พบรายการจอง</div>`;

  const sCfg = {
    Pending: {
      bar: "bg-amber-100 border-amber-200 text-amber-700",
      label: "รอการอนุมัติ (Pending)",
      ping: true,
    },
    Approved: {
      bar: "bg-green-100 border-green-200 text-green-700",
      label: "อนุมัติแล้ว (Approved)",
      ping: false,
    },
    Rejected: {
      bar: "bg-red-100   border-red-200   text-red-700",
      label: "ไม่อนุมัติ (Rejected)",
      ping: false,
    },
    Cancelled: {
      bar: "bg-slate-100 border-slate-200 text-slate-600",
      label: "ยกเลิกแล้ว (Cancelled)",
      ping: false,
    },
  }[b.status] || {
    bar: "bg-slate-100 border-slate-200 text-slate-600",
    label: b.status,
    ping: false,
  };

  const start = thaiDateShort(b.start_datetime);
  const end = thaiDateShort(b.end_datetime);
  const ts = timeFromISO(b.start_datetime);
  const te = timeFromISO(b.end_datetime);
  const created = b.created_at ? thaiDateTime(b.created_at) : "—";

  const rName = b.room?.room_name || b.room_name || "—";
  const rCode = b.room?.room_code || b.room_code || "—";
  const subjectText =
    b.subject || b.teaching_info?.subject_name || b.training_info?.topic || "";

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div class="flex items-center gap-3">
            <button onclick="navigate('my-bookings')"
                class="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
                <h2 class="text-xl font-bold">รายละเอียดการจอง <span class="text-slate-400 font-normal text-base">#${b.booking_id}</span></h2>
                <p class="text-xs text-slate-500 mt-0.5">สร้างเมื่อ ${created}</p>
            </div>
        </div>
        <div class="px-5 py-2 ${sCfg.bar} border rounded-full flex items-center gap-2">
            ${sCfg.ping ? `<span class="relative flex h-2.5 w-2.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span></span>` : ""}
            <span class="font-bold text-sm">${sCfg.label}</span>
        </div>
    </div>

    <div class="grid grid-cols-12 gap-5">
        <div class="col-span-12 lg:col-span-7 space-y-4">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wider">ข้อมูลห้อง</h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><p class="text-xs text-slate-400 font-bold mb-1">ห้อง</p><p class="font-bold text-slate-800">${rName} (${rCode})</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วัตถุประสงค์</p><p class="font-medium">${b.purpose_type}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วันที่</p><p class="font-medium">${start}${end !== start ? " – " + end : ""}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">เวลา</p><p class="font-medium">${ts} – ${te} น.</p></div>
                    ${subjectText ? `<div class="col-span-2"><p class="text-xs text-slate-400 font-bold mb-1">วิชา / หัวข้อ</p><p class="font-medium">${subjectText}</p></div>` : ""}
                    ${b.additional_requests ? `<div class="col-span-2"><p class="text-xs text-slate-400 font-bold mb-1">คำขอเพิ่มเติม</p><p class="text-sm text-slate-600">${b.additional_requests}</p></div>` : ""}
                </div>
            </div>
            ${
              b.reject_reason
                ? `
            <div class="p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p class="text-sm font-bold text-red-700 flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>เหตุผลการปฏิเสธจากเจ้าหน้าที่
                </p>
                <p class="text-sm text-red-600">${b.reject_reason}</p>
            </div>`
                : ""
            }
            ${
              b.admin_notes
                ? `
            <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <p class="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-[16px]">info</span>หมายเหตุการอนุมัติจากเจ้าหน้าที่
                </p>
                <p class="text-sm text-emerald-600">${b.admin_notes}</p>
            </div>`
                : ""
            }
        </div>
        <div class="col-span-12 lg:col-span-5 space-y-4">
            ${
              b.can_cancel
                ? `
            <button onclick="openCancelModal(${b.booking_id})"
                class="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-100 border border-red-100 flex items-center justify-center gap-2 transition-all">
                <span class="material-symbols-outlined text-[18px]">cancel</span>ยกเลิกการจองนี้
            </button>`
                : ""
            }
            ${
              b.recurring_group_id
                ? `
            <button onclick="openCancelGroupModal('${b.recurring_group_id}')"
                class="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 transition-all">
                <span class="material-symbols-outlined text-[18px]">event_busy</span>ยกเลิกทั้งกลุ่ม
            </button>`
                : ""
            }
        </div>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: CALENDAR  (structure only — same JS as original, data from calBookings)
// ═══════════════════════════════════════════════════════════════════
function vCalendar() {
  const wdHeaders = DAYS_TH.map(
    (d) =>
      `<div class="py-2 text-center text-[11px] font-bold text-slate-400 uppercase">${d}</div>`,
  ).join("");
  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h2 class="text-2xl font-bold text-slate-800">ปฏิทินการจอง</h2>
        <div class="flex items-center gap-2 flex-wrap">
            <div class="relative" id="calFW">
                <button onclick="calTogFd(event)"
                    class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-slate-50">
                    <span class="material-symbols-outlined text-[16px] text-slate-400">filter_list</span>
                    <span id="calFLbl">ห้องทั้งหมด</span>
                </button>
                <div id="calFDD" class="filter-dd">
                    <label class="filter-opt"><input type="checkbox" id="calFAll" checked onchange="calTogAll(this)"><span>ทั้งหมด</span></label>
                    <hr class="border-slate-100 my-1">
                    ${rooms.map((r) => `<label class="filter-opt"><input type="checkbox" class="cal-rcb" value="${r.room_id}" checked onchange="calUpdFlt()"><span>${r.room_name}</span></label>`).join("")}
                </div>
            </div>
            <button onclick="calToday()"
                class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm">วันนี้</button>
            <button onclick="calNav(-1)" class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50">
                <span class="material-symbols-outlined text-[18px]">chevron_left</span></button>
            <span class="text-sm font-bold text-slate-700 min-w-[120px] text-center" id="calHdr"></span>
            <button onclick="calNav(1)"  class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50">
                <span class="material-symbols-outlined text-[18px]">chevron_right</span></button>
            <div class="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-sm">
                <button id="calTm" class="view-tab active" onclick="calSwitchView('month')">เดือน</button>
                <button id="calTw" class="view-tab"        onclick="calSwitchView('week')">สัปดาห์</button>
            </div>
            <button onclick="calQuickBook()"
                class="px-4 py-2 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm hover:opacity-90"
                style="background:#7e0000">
                <span class="material-symbols-outlined text-[16px]">add</span>จองห้อง
            </button>
        </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div id="calMV">
            <div class="cal-grid border-b border-slate-200">${wdHeaders}</div>
            <div class="cal-grid" id="calMG"></div>
        </div>
        <div id="calWV" class="hidden">
            <div class="week-grid border-b border-slate-200" id="calWH"></div>
            <div class="week-grid overflow-y-auto" id="calWB" style="max-height:520px"></div>
        </div>
    </div>
</div>`;
}

function calFKey(y, m, d) {
  return `${y}-${m}-${d}`;
}
function calGetBk(key) {
  const all = calBookings[key] || [];
  return all.filter(
    (b) => calRooms.has(String(b.room_id)) || calRooms.size === 0 || true,
  );
}

function initCalendar() {
  calRender();
}
function calRender() {
  const hdr = document.getElementById("calHdr");
  if (hdr) {
    hdr.textContent =
      calView === "month"
        ? `${MONTHS_TH[calDate.getMonth()]} ${toBE(calDate.getFullYear())}`
        : (() => {
            const ws = calWkStart(calDate);
            const we = new Date(ws);
            we.setDate(we.getDate() + 6);
            return `${ws.getDate()} – ${we.getDate()} ${MONTHS_TH[ws.getMonth()]} ${toBE(ws.getFullYear())}`;
          })();
  }
  if (calView === "month") calRenderMonth();
  else calRenderWeek();
}

function calRenderMonth() {
  const g = document.getElementById("calMG");
  if (!g) return;
  const y = calDate.getFullYear(),
    m = calDate.getMonth();
  const fd = new Date(y, m, 1).getDay(),
    dm = new Date(y, m + 1, 0).getDate();
  let html = "";
  for (let i = 0; i < fd; i++)
    html += `<div class="cal-day p-2 border-r border-b border-slate-100 bg-slate-50/50"></div>`;
  for (let d = 1; d <= dm; d++) {
    const key = calFKey(y, m, d),
      bks = calGetBk(key),
      tod = isToday(y, m, d);
    const isPreSel =
      calBookDate ===
      `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const chips = bks
      .slice(0, 3)
      .map(
        (b) =>
          `<div class="px-1.5 py-0.5 rounded-r text-[10px] font-bold truncate ${b.status === "Approved" ? "chip-approved" : "chip-pending"}">${b.room} ${b.time.split("–")[0]}</div>`,
      )
      .join("");
    const more =
      bks.length > 3
        ? `<div class="text-[10px] text-slate-400 font-semibold pl-1">+${bks.length - 3}</div>`
        : "";
    const td = `${d} ${MONTHS_TH[m]} ${toBE(y)}`;
    html += `<div class="cal-day p-2 border-r border-b border-slate-100 ${tod ? "bg-red-50/40" : ""} ${isPreSel ? "pre-selected" : ""}" onclick="calShowDay('${td}','${key}')">
            <span class="${tod ? "today-ring" : "font-bold text-sm"}">${d}</span>
            <div class="mt-1 space-y-0.5">${chips}${more}</div>
        </div>`;
  }
  g.innerHTML = html;
}

function calWkStart(d) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}
const CAL_HRS = Array.from({ length: 12 }, (_, i) => i + 7);
const SH = 52;

function calRenderWeek() {
  const wh = document.getElementById("calWH"),
    wb = document.getElementById("calWB");
  if (!wh || !wb) return;
  const ws = calWkStart(calDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return d;
  });
  let hHtml = `<div class="py-3 border-r border-slate-100"></div>`;
  days.forEach((d, i) => {
    const tod = isToday(d.getFullYear(), d.getMonth(), d.getDate());
    hHtml += `<div class="py-3 text-center border-r border-slate-100 ${tod ? "bg-red-50" : ""}">
            <div class="text-[11px] font-bold text-slate-400">${DAYS_TH[i]}</div>
            <div class="${tod ? "today-ring mx-auto mt-0.5" : "text-slate-700 font-bold text-sm"}">${d.getDate()}</div>
        </div>`;
  });
  wh.innerHTML = hHtml;
  wh.style.gridTemplateColumns = "56px repeat(7,1fr)";
  let bHtml = "";
  CAL_HRS.forEach((h) => {
    bHtml += `<div class="border-r border-b border-slate-100 flex items-start justify-end pr-2 pt-1" style="height:${SH}px">
            <span class="text-[10px] text-slate-400 font-medium">${h}:00</span>
        </div>`;
    days.forEach((d) => {
      const key = calFKey(d.getFullYear(), d.getMonth(), d.getDate());
      const bks = calGetBk(key).filter((b) => b.h === h);
      const tod = isToday(d.getFullYear(), d.getMonth(), d.getDate());
      const td = `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${toBE(d.getFullYear())}`;
      const blocks = bks
        .map(
          (b) => `
<div class="${b.status === "Approved" ? "block-approved" : "block-pending"} absolute left-1 right-1 rounded-lg px-1.5 py-1 text-[10px] font-bold overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
     style="top:2px;height:${b.dur * SH - 6}px;z-index:5" onclick="calShowDay('${td}','${key}')">
    <div class="truncate">${b.room}</div>
    <div class="opacity-70 text-[9px] truncate">${b.time}</div>
</div>`,
        )
        .join("");
      bHtml += `<div class="border-r border-b border-slate-100 relative ${tod ? "bg-red-50/20" : ""}" style="height:${SH}px">${blocks}</div>`;
    });
  });
  wb.innerHTML = bHtml;
  wb.style.gridTemplateColumns = "56px repeat(7,1fr)";
}

function calSwitchView(v) {
  calView = v;
  document.getElementById("calMV")?.classList.toggle("hidden", v !== "month");
  document.getElementById("calWV")?.classList.toggle("hidden", v !== "week");
  document.getElementById("calTm")?.classList.toggle("active", v === "month");
  document.getElementById("calTw")?.classList.toggle("active", v === "week");
  calRender();
}
function calNav(d) {
  calView === "month"
    ? (calDate = new Date(calDate.getFullYear(), calDate.getMonth() + d, 1))
    : (calDate = new Date(calDate.getTime() + d * 7 * 864e5));
  calRender();
}
function calToday() {
  calDate = new Date();
  calRender();
}
function calTogFd(e) {
  e.stopPropagation();
  document.getElementById("calFDD")?.classList.toggle("open");
}
function calTogAll(cb) {
  document
    .querySelectorAll(".cal-rcb")
    .forEach((r) => (r.checked = cb.checked));
  calUpdFlt();
}
function calUpdFlt() {
  const cbs = document.querySelectorAll(".cal-rcb");
  calRooms = new Set([...cbs].filter((c) => c.checked).map((c) => c.value));
  const all = document.getElementById("calFAll");
  if (all) {
    all.checked = calRooms.size === cbs.length;
    all.indeterminate = calRooms.size > 0 && calRooms.size < cbs.length;
  }
  const lbl = document.getElementById("calFLbl");
  if (lbl)
    lbl.textContent =
      calRooms.size === cbs.length
        ? "ห้องทั้งหมด"
        : calRooms.size === 0
          ? "ไม่มีห้อง"
          : `${calRooms.size} ห้อง`;
  calRender();
}

let calDayModalKey = null,
  calDayModalLabel = null;
function calShowDay(dateStr, key) {
  const items = calGetBk(key);
  document.getElementById("dayModalTitle").textContent =
    `รายการจอง – ${dateStr}`;
  document.getElementById("dayModalBody").innerHTML =
    items.length === 0
      ? `<div class="text-center py-8 text-slate-400"><span class="material-symbols-outlined text-4xl block mb-2">event_available</span><p class="text-sm font-medium">ยังไม่มีการจองในวันนี้</p></div>`
      : items
          .map((b) => {
            const cancelBtn = b.can_cancel
              ? `<button onclick="closeDayModal(); event.stopPropagation(); openCancelModal(${b.id})" 
                      class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0 shadow-sm">
                      <span class="material-symbols-outlined text-[14px]">cancel</span> ยกเลิก
                   </button>`
              : "";

            return `
<div class="p-4 rounded-2xl border-2 ${b.status === "Approved" ? "border-red-100 bg-red-50/30" : "border-amber-100 bg-amber-50/30"} flex justify-between items-center gap-3 cursor-pointer" onclick="closeDayModal(); navigate('detail',{detailId:${b.id}})">
    <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full ${b.status === "Approved" ? "bg-red-500" : "bg-amber-500"}"></span>
            <span class="text-xs font-bold ${b.status === "Approved" ? "text-red-700" : "text-amber-700"} uppercase tracking-wider">${b.status === "Approved" ? "ถูกจองแล้ว" : "รออนุมัติ"}</span>
        </div>
        <p class="font-bold text-slate-800 truncate">${b.roomFull}</p>
        <p class="text-sm text-slate-600 mt-0.5">เวลา ${b.time} น.</p>
        <p class="text-xs text-slate-500 mt-1 truncate">${b.subj}</p>
    </div>
    ${cancelBtn}
</div>`;
          })
          .join("");
  document.getElementById("dayModalBanner").classList.remove("hidden");
  document.getElementById("dayModal").classList.remove("hidden");
}

function closeDayModal() {
  document.getElementById("dayModal").classList.add("hidden");
}
function bookFromCalendar() {
  if (!calDayModalKey) {
    navigate("dashboard");
    closeDayModal();
    return;
  }
  const [y, m, d] = calDayModalKey.split("-").map(Number);
  calBookDate = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  calBookKey = calDayModalKey;
  calBookLabel = calDayModalLabel;
  closeDayModal();
  navigate("dashboard");
}
function calQuickBook() {
  calBookDate = null;
  calBookKey = null;
  calBookLabel = null;
  navigate("dashboard");
}

// ═══════════════════════════════════════════════════════════════════
// CANCEL MODAL  (single booking)
// ═══════════════════════════════════════════════════════════════════
function openCancelModal(id) {
  cancelId = id;
  document.getElementById("cancelId").textContent = "#" + id;
  document.getElementById("cancelModal").classList.remove("hidden");
}
function closeCancelModal() {
  document.getElementById("cancelModal").classList.add("hidden");
}

async function doCancelBooking() {
  closeCancelModal();
  try {
    await api.patch(`/api/bookings/${cancelId}/cancel/`, {});
    await loadMyBookings();
    showToast("ยกเลิกการจองเรียบร้อยแล้ว", "cancel");
    navigate(curView === "detail" ? "my-bookings" : curView);
  } catch (err) {
    showApiError(err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CANCEL GROUP MODAL  (recurring group booking)
// ═══════════════════════════════════════════════════════════════════
function openCancelGroupModal(groupId) {
  cancelGroupId = groupId;
  const displayEl = document.getElementById("cancelGroupIdDisplay");
  if (displayEl) displayEl.textContent = "#" + groupId;
  document.getElementById("cancelGroupModal")?.classList.remove("hidden");
}

function closeCancelGroupModal() {
  document.getElementById("cancelGroupModal")?.classList.add("hidden");
}

async function doCancelGroupBooking() {
  closeCancelGroupModal();
  try {
    await api.patch(`/api/bookings/recurring/${cancelGroupId}/cancel/`, {});
    await loadMyBookings();
    showToast("ยกเลิกการจองแบบกลุ่มเรียบร้อยแล้ว", "cancel");
    navigate(curView === "detail" ? "my-bookings" : curView);
  } catch (err) {
    showApiError(err);
  }
}

window.openCancelGroupModal = openCancelGroupModal;
window.closeCancelGroupModal = closeCancelGroupModal;
window.doCancelGroupBooking = doCancelGroupBooking;

// ═══════════════════════════════════════════════════════════════════
// GLOBAL CLICK
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("cancelModal")) closeCancelModal();
  if (e.target === document.getElementById("cancelGroupModal"))
    closeCancelGroupModal();
  if (e.target === document.getElementById("dayModal")) closeDayModal();
  const fw = document.getElementById("calFW");
  if (fw && !fw.contains(e.target))
    document.getElementById("calFDD")?.classList.remove("open");
});
