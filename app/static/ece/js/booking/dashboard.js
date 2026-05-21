/**
 * dashboard.js — Dashboard views & search inputs
 */
"use strict";

function vDashboard() {
  const today = new Date();
  const todayStr = `วัน${DAYS_TH_L[today.getDay()]}ที่ ${today.getDate()} ${MONTHS_TH[today.getMonth()]} ${toBE(today.getFullYear())}`;

  const calBanner = calBookDate
    ? `<div class="mb-5 px-5 py-4 rounded-2xl border-2 flex items-center justify-between gap-3 animate-fade-in" style="border-color:#fecaca;background:#fff1f2">
    <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-[22px]" style="color:#7e0000">event</span>
        <div>
            <p class="text-sm font-bold" style="color:#7e0000">กำลังจองสำหรับวันที่ <span class="underline">${calBookLabel}</span></p>
            <p class="text-xs text-red-400 mt-0.5">วันที่จะถูกกรอกอัตโนมัติในฟอร์ม — กรุณาเลือกห้องด้านล่างเพื่อดำเนินการ</p>
        </div>
    </div>
    <button onclick="calBookDate=null;calBookKey=null;calBookLabel=null;renderApp()" class="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1">
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
            <input type="text" placeholder="ค้นหาชื่อห้อง หรือรหัสห้อง..." value="${dashSearch}" oninput="debounceSearch(this.value)" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div class="relative min-w-[140px]">
            <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">groups</span>
            <input type="number" placeholder="ความจุขั้นต่ำ..." value="${dashCapacity}" min="1" oninput="debounceCapacity(this.value)" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div class="relative min-w-[150px]">
            <select onchange="dashType=this.value;refreshDashboardRooms()" class="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary appearance-none cursor-pointer">
                <option value="all" ${dashType === "all" ? "selected" : ""}>ทุกประเภท</option>
                <option value="Meeting Room" ${dashType === "Meeting Room" ? "selected" : ""}>ห้องประชุม</option>
                <option value="Classroom" ${dashType === "Classroom" ? "selected" : ""}>ห้องเรียน</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
        </div>
    </div>
    
    <div class="space-y-4" id="dashRooms">${renderRoomCards()}</div>
</div>`;
}

function renderRoomCards() {
  if (rooms.length === 0)
    return `<div class="text-center py-16 text-slate-400"><span class="material-symbols-outlined text-5xl block mb-2">search_off</span>ไม่พบห้องที่ตรงตามเงื่อนไขการค้นหา</div>`;

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
      : `<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50"><span class="material-symbols-outlined text-slate-300 text-[32px] mb-1">meeting_room</span><div class="text-sm font-black text-slate-700">${room.room_code}</div></div>`;

    const favIcon = "star";
    const favColor = isFav
      ? "text-amber-500 [font-variation-settings:'FILL'_1]"
      : "text-slate-400 hover:text-amber-500 [font-variation-settings:'FILL'_0]";

    const favBtn = `
      <button onclick="toggleFavourite('${room.room_id}', event)" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-105 transition-all z-10">
          <span class="material-symbols-outlined text-[19px] ${favColor}">${favIcon}</span>
      </button>`;

    let badgeHtml = "";
    if (currentStatus === "Approved") {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-red-700 bg-red-100 border border-red-200 flex-shrink-0">ถูกใช้งาน</span>`;
    } else if (currentStatus === "Pending") {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 flex-shrink-0">รออนุมัติ</span>`;
    } else {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 flex-shrink-0">ว่างตอนนี้</span>`;
    }

    return `
<div class="room-card relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid cursor-pointer hover:border-primary transition-all" style="grid-template-columns:30% 1fr" onclick="navigate('room-booking',{roomId:${room.room_id}})">
    <div class="relative h-full min-h-[90px] bg-slate-50 border-r border-slate-100">${imgHtml}${favBtn}</div>
    <div class="p-5">
        <div class="flex justify-between items-start gap-2 mb-2">
            <div>
                <h3 class="text-base font-bold text-slate-800">${room.room_name}</h3>
                <div class="flex gap-3 mt-0.5 text-xs text-slate-500">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">groups</span>${room.capacity} ที่นั่ง</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">meeting_room</span>${room.room_type}</span>
                </div>
            </div>
            ${badgeHtml}
        </div>
        <div class="tl-bg">${bars}</div>
        <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span></div>
        ${todayBks.length === 0 ? `<p class="text-[11px] text-emerald-600 font-medium mt-1">✓ ว่างตลอดวันนี้</p>` : `<p class="text-[11px] text-amber-600 font-medium mt-1">มีการจอง ${todayBks.length} ช่วง</p>`}
    </div>
</div>`;
  };

  let favSectionHtml = "";
  if (favouriteSectionRooms.length > 0) {
    favSectionHtml = `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-amber-500 [font-variation-settings:'FILL'_1] text-[20px]">star</span>
          <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">ห้องโปรด (${favouriteSectionRooms.length})</h3>
        </div>
        <div class="space-y-4">${favouriteSectionRooms.map(makeCard).join("")}</div>
      </div>`;
  }

  const allSectionHtml = `
    <div>
      <div class="flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined text-slate-400 text-[20px]">widgets</span>
        <h3 class="text-sm font-bold text-slate-700 uppercase tracking-wider">ห้องทั้งหมด (${allSectionRooms.length})</h3>
      </div>
      <div class="space-y-4">${allSectionRooms.map(makeCard).join("")}</div>
    </div>`;

  return favSectionHtml + allSectionHtml;
}

function redrawRooms() {
  const el = document.getElementById("dashRooms");
  if (el) el.innerHTML = renderRoomCards();
}

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
    container.innerHTML = `<div class="text-center py-16 text-slate-400"><div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>กำลังค้นหาข้อมูลห้อง...</div>`;
  }
  const params = { q: dashSearch, room_type: dashType, capacity: dashCapacity };
  await Promise.all([loadRooms(params), loadFavRooms()]);
  await loadAllSchedules();
  redrawRooms();
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
