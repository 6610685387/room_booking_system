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
        <button onclick="openQuickBook()" class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all" style="background:linear-gradient(135deg,#7e0000,#b00000)">
            <span class="material-symbols-outlined text-[18px]">bolt</span>จองรวดเร็ว
        </button>
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
</div>

<!-- ─── Quick Book Modal ─── -->
<div id="qbModal" class="fixed inset-0 z-50 hidden items-center justify-center p-4" style="background:rgba(0,0,0,.5);backdrop-filter:blur(4px)">
  <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100" style="background:linear-gradient(135deg,#7e0000,#b00000)">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-white text-[20px]">bolt</span>
        <h3 class="font-bold text-white text-base">จองรวดเร็ว — ระบบเลือกห้องให้อัตโนมัติ</h3>
      </div>
      <button onclick="closeQuickBook()" class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition">
        <span class="material-symbols-outlined text-white text-[18px]">close</span>
      </button>
    </div>

    <div class="p-6 space-y-5" id="qbBody">
      <!-- วัตถุประสงค์ -->
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">วัตถุประสงค์ <span class="text-red-500">*</span></label>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all" id="qbpl1" style="border-color:#7e0000;background:#fff1f2">
            <input type="radio" name="qb_purp" value="teaching" checked class="accent-red-800" onchange="qbHlPurpose(1)">
            <span class="text-sm font-medium">สอนปกติ/ชดเชย</span>
          </label>
          <label class="flex items-center gap-2 p-3 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-primary transition-all" id="qbpl2">
            <input type="radio" name="qb_purp" value="training" class="accent-red-800" onchange="qbHlPurpose(2)">
            <span class="text-sm font-medium">จัดอบรม/ติว</span>
          </label>
        </div>
      </div>

      <!-- Teaching fields -->
      <div id="qb_teaching_fields" class="space-y-3">
        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">รหัสวิชา <span class="text-red-500">*</span></label>
            <input type="text" id="qb_subject_code" placeholder="EEXXX" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">ชื่อวิชา <span class="text-red-500">*</span></label>
            <input type="text" id="qb_subject_name" placeholder="ระบุชื่อวิชา" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">หลักสูตร <span class="text-red-500">*</span></label>
          <select id="qb_program_type" class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
            <option value="" disabled selected>-- เลือกหลักสูตร --</option>
            <option value="Bachelor">ปริญญาตรี</option>
            <option value="Master">ปริญญาโท</option>
            <option value="TEP-TEPE">TEP-TEPE</option>
            <option value="TU-PINE">TU-PINE</option>
          </select>
        </div>
      </div>

      <!-- Training fields -->
      <div id="qb_training_fields" class="hidden space-y-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">หัวข้อการอบรม/ติว <span class="text-red-500">*</span></label>
          <input type="text" id="qb_training_topic" placeholder="ระบุหัวข้อหรือโครงการ" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
      </div>

      <!-- วันที่ -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">วันที่เริ่ม <span class="text-red-500">*</span></label>
          <input type="date" id="qb_date_start" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">วันที่สิ้นสุด</label>
          <input type="date" id="qb_date_end" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
      </div>

      <!-- เวลา -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">เวลาเริ่ม <span class="text-red-500">*</span></label>
          <input type="time" id="qb_time_start" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary" onchange="qbAutoEndTime()">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">เวลาสิ้นสุด <span class="text-red-500">*</span></label>
          <input type="time" id="qb_time_end" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
      </div>

      <!-- ความจุ + ประเภทห้อง -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">จำนวนผู้ใช้ (คน) <span class="text-red-500">*</span></label>
          <input type="number" id="qb_capacity" min="1" placeholder="เช่น 30" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">ประเภทห้อง</label>
          <select id="qb_room_type" class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
            <option value="all">ทุกประเภท</option>
            <option value="Classroom">ห้องเรียน</option>
            <option value="Meeting Room">ห้องประชุม</option>
          </select>
        </div>
      </div>

      <!-- Result area -->
      <div id="qbResult" class="hidden"></div>

      <!-- Submit -->
      <button onclick="submitQuickBook()" id="qbSubmitBtn"
        class="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-95 transition-all"
        style="background:linear-gradient(135deg,#7e0000,#b00000)">
        <span class="material-symbols-outlined text-[18px]">bolt</span>ค้นหาห้องและจองเลย
      </button>
    </div>
  </div>
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

  // แยกส่วนให้ห้องโปรดกับห้องทั้งหมดแยกออกจากกันอย่างเด็ดขาด (Deduplication)
  const favouriteSectionRooms = filteredAll.filter((r) =>
    favIds.has(String(r.room_id)),
  );
  const allSectionRooms = filteredAll.filter((r) =>
    !favIds.has(String(r.room_id)),
  );

  const makeCard = (room) => {
    const todayBks = getTodayBookingsFromSchedule(room.room_id, room.room_code);
    const currentStatus = getCurrentBookingStatusFromList(todayBks);
    const isFav = favIds.has(String(room.room_id));

    // ปรับการคำนวณสเกลแท่งบอกเวลาการใช้งานให้อยู่ในกรอบ 24 ชั่วโมง
    const bars = todayBks
      .map((b) => {
        const l = (b.h / 24) * 100,
          w = (b.dur / 24) * 100;
        const bg = b.status === "Approved" ? "#ef4444" : "#f59e0b";
        return `<div class="tl-bar" style="left:${l}%;width:${w}%;background:${bg}"></div>`;
      })
      .join("");

    // ปรับการเรนเดอร์รูปภาพ: หากไม่มีรูปภาพจะแสดงเป็นไอคอนจำลอง
    const imgHtml = room.room_image
      ? `<img src="${room.room_image}" class="absolute inset-0 w-full h-full object-cover">`
      : `<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50"><span class="material-symbols-outlined text-slate-300 text-[28px]">meeting_room</span></div>`;

    const favIcon = "star";
    const favColor = isFav
      ? "text-amber-500 [font-variation-settings:'FILL'_1]"
      : "text-slate-400 hover:text-amber-500 [font-variation-settings:'FILL'_0]";

    const favBtn = `
      <button onclick="toggleFavourite('${room.room_id}', event)" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:scale-105 transition-all z-10">
          <span class="material-symbols-outlined text-[19px] ${favColor}">${favIcon}</span>
      </button>`;

    // ป้ายรหัสห้องเรียน/ห้องประชุม ลอยบนรูปภาพมุมล่างซ้าย สวยงามและอ่านง่าย
    const roomCodeBadge = `
      <div class="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-xs text-white text-[10px] font-black z-10 select-none uppercase tracking-wider shadow-sm">
          ${room.room_code}
      </div>`;

    let badgeHtml = "";
    if (currentStatus === "Approved") {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-red-700 bg-red-100 border border-red-200 flex-shrink-0">ถูกใช้งานตอนนี้</span>`;
    } else if (currentStatus === "Pending") {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 flex-shrink-0">รออนุมัติ</span>`;
    } else {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 flex-shrink-0">ว่างตอนนี้</span>`;
    }

    return `
<div class="room-card relative bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid cursor-pointer hover:border-primary transition-all" style="grid-template-columns:30% 1fr" onclick="navigate('room-booking',{roomId:${room.room_id}})">
    <div class="relative h-full min-h-[90px] bg-slate-50 border-r border-slate-100">${imgHtml}${favBtn}${roomCodeBadge}</div>
    <div class="p-5">
        <div class="flex justify-between items-start gap-2 mb-2">
            <div>
                <h3 class="text-base font-bold text-slate-800">${room.room_name}</h3>
                <div class="flex gap-3 mt-0.5 text-xs text-slate-500">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">groups</span>${room.capacity} ที่นั่ง</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">meeting_room</span>${
                      {
                        "Meeting Room": "ห้องประชุม",
                        Classroom: "ห้องเรียน",
                      }[room.room_type] || "ไม่ทราบ"
                    }</span>
                </div>
            </div>
            ${badgeHtml}
        </div>
        <div class="tl-bg">${bars}</div>
        <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
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
// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Modal open/close & UI helpers
// ═══════════════════════════════════════════════════════

function openQuickBook() {
  const modal = document.getElementById("qbModal");
  if (!modal) return;

  // Default วันที่/เวลา
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const roundedH = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
  const startH = Math.min(roundedH, 23);
  const endH   = Math.min(startH + 1, 23);
  const endM   = startH + 1 >= 24 ? 59 : 0;

  const dateEl   = document.getElementById("qb_date_start");
  const tsEl     = document.getElementById("qb_time_start");
  const teEl     = document.getElementById("qb_time_end");
  const dateEndEl= document.getElementById("qb_date_end");

  if (dateEl)    dateEl.value   = todayStr;
  if (dateEndEl) dateEndEl.value= todayStr;
  if (tsEl)      tsEl.value     = `${String(startH).padStart(2,"0")}:00`;
  if (teEl)      teEl.value     = `${String(endH).padStart(2,"0")}:${String(endM).padStart(2,"0")}`;

  // Set min date
  if (dateEl)    dateEl.min = todayStr;
  if (dateEndEl) dateEndEl.min= todayStr;

  // Reset result area
  const res = document.getElementById("qbResult");
  if (res) { res.className = "hidden"; res.innerHTML = ""; }

  // Reset button
  const btn = document.getElementById("qbSubmitBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">bolt</span>ค้นหาห้องและจองเลย`;
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeQuickBook() {
  const modal = document.getElementById("qbModal");
  if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
}

// ปิด modal เมื่อคลิก backdrop
document.addEventListener("click", (e) => {
  const modal = document.getElementById("qbModal");
  if (modal && !modal.classList.contains("hidden") && e.target === modal) {
    closeQuickBook();
  }
});

function qbHlPurpose(n) {
  const base = "flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all";
  const active = `${base}" style="border-color:#7e0000;background:#fff1f2`;
  document.getElementById("qbpl1").setAttribute("style", n===1 ? "border-color:#7e0000;background:#fff1f2" : "");
  document.getElementById("qbpl2").setAttribute("style", n===2 ? "border-color:#7e0000;background:#fff1f2" : "");
  document.getElementById("qbpl1").className = `${base}`;
  document.getElementById("qbpl2").className = `${base}`;
  document.getElementById("qb_teaching_fields").className = n===1 ? "space-y-3" : "hidden space-y-3";
  document.getElementById("qb_training_fields").className  = n===2 ? "space-y-3" : "hidden space-y-3";
}

function qbAutoEndTime() {
  const s = document.getElementById("qb_time_start");
  const e = document.getElementById("qb_time_end");
  if (!s || !e) return;
  const [h, m] = s.value.split(":").map(Number);
  const nh = h + 1;
  e.value = nh >= 24 ? "23:59" : `${String(nh).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Room selection algorithm
// ═══════════════════════════════════════════════════════

function qbTimeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function qbDayName(dateStr) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const [y, mo, d] = dateStr.split("-").map(Number);
  return days[new Date(y, mo-1, d).getDay()];
}

/**
 * หาห้องที่ดีที่สุดสำหรับ Quick Book
 * Priority: (1) ห้องโปรด (2) ความจุพอดีที่สุด (น้อยที่สุดที่ >= ที่ต้องการ)
 * กรอง: ห้องที่ไม่มี conflict ในตาราง allSchedules ณ วัน/เวลาที่ขอ
 */
function qbFindBestRoom(dateStart, timeStart, timeEnd, minCap, roomType) {
  const dayName = qbDayName(dateStart);
  const reqS = qbTimeToMin(timeStart);
  const reqE = qbTimeToMin(timeEnd);
  const favIds = new Set(favRooms.map(r => String(r.room_id)));

  // 1. กรองตาม capacity & type
  let candidates = rooms.filter(r =>
    r.capacity >= minCap &&
    (roomType === "all" || r.room_type === roomType)
  );

  if (candidates.length === 0) return { room: null, reason: "no_capacity" };

  // 2. กรอง conflict จาก allSchedules (best-effort client-side)
  const conflicted = [];
  const available = candidates.filter(r => {
    const sched = allSchedules[r.room_id];
    if (!sched || !sched.slots) return true; // ไม่มีข้อมูล = สมมติว่าว่าง

    const slots = sched.slots.filter(s =>
      s.day === dayName && (s.status === "Approved" || s.status === "Pending")
    );
    for (const sl of slots) {
      const slS = qbTimeToMin(sl.start_time);
      const slE = qbTimeToMin(sl.end_time);
      if (reqS < slE && reqE > slS) {
        conflicted.push(r);
        return false; // มี conflict
      }
    }
    return true;
  });

  if (available.length === 0) return { room: null, reason: "no_available", conflicted };

  // 3. เรียงลำดับ: ห้องโปรดก่อน → ความจุน้อยที่สุดที่ >= minCap
  available.sort((a, b) => {
    const aFav = favIds.has(String(a.room_id)) ? 0 : 1;
    const bFav = favIds.has(String(b.room_id)) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.capacity - b.capacity;
  });

  return { room: available[0], allAvailable: available, conflicted };
}

// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Submit
// ═══════════════════════════════════════════════════════

async function submitQuickBook() {
  const btn = document.getElementById("qbSubmitBtn");
  const resEl = document.getElementById("qbResult");

  // อ่านค่าจากฟอร์ม
  const purposeEl = document.querySelector("input[name=qb_purp]:checked");
  const purpose   = purposeEl ? purposeEl.value : "teaching";
  const dateStart = document.getElementById("qb_date_start")?.value || "";
  const dateEnd   = document.getElementById("qb_date_end")?.value || "";
  const timeStart = document.getElementById("qb_time_start")?.value || "";
  const timeEnd   = document.getElementById("qb_time_end")?.value || "";
  const minCap    = parseInt(document.getElementById("qb_capacity")?.value || "0", 10);
  const roomType  = document.getElementById("qb_room_type")?.value || "all";

  // Validate
  const errs = [];
  if (!dateStart)        errs.push("วันที่เริ่ม");
  if (!timeStart)        errs.push("เวลาเริ่ม");
  if (!timeEnd)          errs.push("เวลาสิ้นสุด");
  if (!minCap || minCap < 1) errs.push("จำนวนผู้ใช้");

  if (purpose === "teaching") {
    if (!document.getElementById("qb_subject_code")?.value) errs.push("รหัสวิชา");
    if (!document.getElementById("qb_subject_name")?.value) errs.push("ชื่อวิชา");
    if (!document.getElementById("qb_program_type")?.value) errs.push("หลักสูตร");
  } else {
    if (!document.getElementById("qb_training_topic")?.value) errs.push("หัวข้อการอบรม");
  }

  if (errs.length > 0) {
    showToast(`กรุณากรอก: ${errs.join(", ")}`, "error");
    return;
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const curTime  = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  if (dateStart < todayStr) {
    showToast("ไม่สามารถจองย้อนหลังได้", "error"); return;
  }
  if (dateEnd && dateEnd < dateStart) {
    showToast("วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม", "error"); return;
  }
  if (qbTimeToMin(timeStart) >= qbTimeToMin(timeEnd)) {
    showToast("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด", "error"); return;
  }
  if (dateStart === todayStr && timeStart < curTime) {
    showToast(`เวลาเริ่มต้องไม่ย้อนหลัง (ปัจจุบัน ${curTime})`, "error"); return;
  }

  // แสดง loading
  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>กำลังค้นหาห้อง...`;
  resEl.className = "hidden"; resEl.innerHTML = "";

  // หาห้องที่ดีที่สุด
  const found = qbFindBestRoom(dateStart, timeStart, timeEnd, minCap, roomType);

  if (!found.room) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">bolt</span>ค้นหาห้องและจองเลย`;

    let msg = "";
    if (found.reason === "no_capacity") {
      msg = `<p class="font-bold text-red-700 mb-1">ไม่มีห้องที่รองรับผู้ใช้ได้ถึง ${minCap} คน</p>
             <p class="text-sm text-slate-500">ลองลดจำนวนผู้ใช้หรือเปลี่ยนประเภทห้อง</p>`;
    } else {
      const names = (found.conflicted||[]).map(r=>`<span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">${r.room_code}</span>`).join(" ");
      msg = `<p class="font-bold text-red-700 mb-1">ไม่มีห้องว่างในช่วงเวลาที่เลือก</p>
             ${names ? `<p class="text-xs text-slate-500 mt-1">ห้องที่ถูกจองแล้ว: ${names}</p>` : ""}
             <p class="text-sm text-slate-500 mt-1">ลองเปลี่ยนวัน/เวลา หรือเลือกประเภทห้องอื่น</p>`;
    }
    resEl.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl">${msg}</div>`;
    resEl.className = "block";
    return;
  }

  // แสดงห้องที่เลือก & กำลังส่งคำขอ
  const room = found.room;
  resEl.innerHTML = `
<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
  <span class="material-symbols-outlined text-emerald-600 text-[24px]">meeting_room</span>
  <div>
    <p class="font-bold text-emerald-700 text-sm">พบห้องที่เหมาะสม!</p>
    <p class="text-slate-700 font-bold">${room.room_name} <span class="text-slate-400 font-normal">(${room.room_code})</span></p>
    <p class="text-xs text-slate-500">${room.capacity} ที่นั่ง · ${{"Meeting Room":"ห้องประชุม","Classroom":"ห้องเรียน"}[room.room_type]||room.room_type}</p>
  </div>
</div>`;
  resEl.className = "block";

  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>กำลังส่งคำขอจอง...`;

  // สร้าง payload และส่ง API
  const payload = {
    room_id:    room.room_id,
    date_start: dateStart,
    date_end:   dateEnd || dateStart,
    days_of_week: null,
    time_start: timeStart,
    time_end:   timeEnd,
    purpose_type: purpose,
    skip_conflicts: false,
    additional_requests: "",
  };

  if (purpose === "teaching") {
    payload.teaching_info = {
      subject_code: document.getElementById("qb_subject_code")?.value || "",
      subject_name: document.getElementById("qb_subject_name")?.value || "",
      program_type: document.getElementById("qb_program_type")?.value || "",
    };
  } else {
    payload.training_info = {
      topic: document.getElementById("qb_training_topic")?.value || "",
    };
  }

  try {
    const result = await api.post("/api/bookings/", payload);
    closeQuickBook();
    calBookDate = null; calBookKey = null; calBookLabel = null;
    await loadMyBookings();
    showToast(
      `จองห้อง ${room.room_code} สำเร็จ! (${result.booking_ids?.length||1} รายการ)`,
      "check_circle"
    );
    navigate("my-bookings");
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">bolt</span>ค้นหาห้องและจองเลย`;

    if (err.status === 409) {
      // ห้องที่เลือกมี conflict จริง → ลองห้องถัดไป
      const next = (found.allAvailable || []).slice(1);
      if (next.length > 0) {
        resEl.innerHTML = `
<div class="p-4 bg-amber-50 border border-amber-200 rounded-xl">
  <p class="font-bold text-amber-700 text-sm mb-1">ห้อง ${room.room_code} มีคนจองในช่วงนี้แล้ว</p>
  <p class="text-xs text-slate-500">มีห้องสำรองอีก ${next.length} ห้อง กรุณากดจองอีกครั้ง</p>
</div>`;
        // ปรับ available list ให้เหลือห้องถัดไป
        found.allAvailable.splice(0, 1);
      } else {
        resEl.innerHTML = `
<div class="p-4 bg-red-50 border border-red-200 rounded-xl">
  <p class="font-bold text-red-700 text-sm">ไม่มีห้องว่างในช่วงเวลาที่เลือก</p>
  <p class="text-xs text-slate-500 mt-1">กรุณาเปลี่ยนวัน/เวลา หรือจำนวนผู้ใช้</p>
</div>`;
      }
      resEl.className = "block";
    } else {
      resEl.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl"><p class="font-bold text-red-700 text-sm">${err.message||"เกิดข้อผิดพลาด"}</p></div>`;
      resEl.className = "block";
    }
  }
}

window.openQuickBook   = openQuickBook;
window.closeQuickBook  = closeQuickBook;
window.qbHlPurpose     = qbHlPurpose;
window.qbAutoEndTime   = qbAutoEndTime;
window.submitQuickBook = submitQuickBook;
