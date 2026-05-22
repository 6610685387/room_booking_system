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
            <input type="text" id="dashInputSearch" placeholder="ค้นหาชื่อห้อง หรือรหัสห้อง..." value="${dashSearch}" oninput="debounceSearch(this.value)" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div class="relative min-w-[140px]">
            <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">groups</span>
            <input type="number" id="dashInputCap" placeholder="ความจุขั้นต่ำ..." value="${dashCapacity}" min="1" oninput="debounceCapacity(this.value)" class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div class="relative min-w-[150px]">
            <select id="dashInputType" onchange="dashType=this.value;refreshDashboardRooms()" class="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary appearance-none cursor-pointer">
                <option value="all" ${dashType === "all" ? "selected" : ""}>ทุกประเภท</option>
                <option value="Meeting Room" ${dashType === "Meeting Room" ? "selected" : ""}>ห้องประชุม</option>
                <option value="Classroom" ${dashType === "Classroom" ? "selected" : ""}>ห้องเรียน</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
        </div>
        
        <button onclick="clearDashboardSearch()" class="px-4 py-2.5 bg-slate-100 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold flex items-center gap-1 transition-all" title="ล้างการค้นหา">
            <span class="material-symbols-outlined text-[18px]">refresh</span>ล้างค่า
        </button>
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
        <h3 class="font-bold text-white text-base">จองรวดเร็ว — ระบุเงื่อนไขและเลือกห้อง</h3>
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
          <input type="date" id="qb_date_start" onchange="qbSyncDates()" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">วันที่สิ้นสุด</label>
          <input type="date" id="qb_date_end" onchange="qbSyncDates()" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
        </div>
      </div>

      <!-- วันในสัปดาห์ (Recurring) -->
      <div id="qb_days_section">
        <div class="flex justify-between items-center mb-2">
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">วันในสัปดาห์</label>
          <button type="button" onclick="qbToggleAllDays()" id="qbBtnToggleAllDays" class="text-xs font-bold text-primary hover:underline">เลือกทุกวัน</button>
        </div>
        <div class="flex gap-2 flex-wrap">
          <label class="day-pill cursor-pointer" title="จ."><input type="checkbox" name="qb_rec_day" value="Mon" class="hidden"><div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">จ.</div></label>
          <label class="day-pill cursor-pointer" title="อ."><input type="checkbox" name="qb_rec_day" value="Tue" class="hidden"><div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">อ.</div></label>
          <label class="day-pill cursor-pointer" title="พ."><input type="checkbox" name="qb_rec_day" value="Wed" class="hidden"><div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">พ.</div></label>
          <label class="day-pill cursor-pointer" title="พฤ."><input type="checkbox" name="qb_rec_day" value="Thu" class="hidden"><div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">พฤ.</div></label>
          <label class="day-pill cursor-pointer" title="ศ."><input type="checkbox" name="qb_rec_day" value="Fri" class="hidden"><div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">ศ.</div></label>
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

      <!-- Result area: แสดงรายการห้องที่เข้าเกณฑ์ -->
      <div id="qbResult" class="hidden"></div>

      <!-- Submit -->
      <button onclick="submitQuickBook()" id="qbSubmitBtn"
        class="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-95 transition-all"
        style="background:linear-gradient(135deg,#7e0000,#b00000)">
        <span class="material-symbols-outlined text-[18px]">search</span>ค้นหาห้องที่ว่าง
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
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">meeting_room</span>${{
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
//  DASHBOARD — Reset Search
// ═══════════════════════════════════════════════════════
function clearDashboardSearch() {
  // 1. รีเซ็ตตัวแปรในระบบ
  dashSearch = "";
  dashCapacity = "";
  dashType = "all";

  // 2. เคลียร์ค่าที่แสดงในหน้าจอ (เอาข้อความที่พิมพ์ค้างไว้ออก)
  const searchInput = document.getElementById("dashInputSearch");
  const capInput = document.getElementById("dashInputCap");
  const typeInput = document.getElementById("dashInputType");

  if (searchInput) searchInput.value = "";
  if (capInput) capInput.value = "";
  if (typeInput) typeInput.value = "all";

  // 3. สั่งโหลดข้อมูลห้องใหม่ให้แสดงทั้งหมด
  refreshDashboardRooms();
}

// อย่าลืมแนบเข้า window เพื่อให้คลิกจาก HTML ได้
window.clearDashboardSearch = clearDashboardSearch;


// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Modal open/close & UI helpers
// ═══════════════════════════════════════════════════════

// ตัวแปรเก็บ roomId ที่ผู้ใช้เลือกในหน้าผลลัพธ์
let qbSelectedRoomId = null;

function openQuickBook() {
  const modal = document.getElementById("qbModal");
  if (!modal) return;

  // Default วันที่/เวลา
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const roundedH = now.getMinutes() > 0 ? now.getHours() + 1 : now.getHours();
  const startH = Math.min(roundedH, 23);
  const endH = Math.min(startH + 1, 23);
  const endM = startH + 1 >= 24 ? 59 : 0;

  const dateEl = document.getElementById("qb_date_start");
  const tsEl = document.getElementById("qb_time_start");
  const teEl = document.getElementById("qb_time_end");
  const dateEndEl = document.getElementById("qb_date_end");

  if (dateEl) dateEl.value = todayStr;
  if (dateEndEl) dateEndEl.value = todayStr;
  if (tsEl) tsEl.value = `${String(startH).padStart(2, "0")}:00`;
  if (teEl) teEl.value = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  // Set min date
  if (dateEl) dateEl.min = todayStr;
  if (dateEndEl) dateEndEl.min = todayStr;

  // Reset weekday pills
  document.querySelectorAll("input[name=qb_rec_day]").forEach(cb => { cb.checked = false; });
  const daysBtn = document.getElementById("qbBtnToggleAllDays");
  if (daysBtn) daysBtn.textContent = "เลือกทุกวัน";

  // Reset result area & selected room
  qbSelectedRoomId = null;
  const res = document.getElementById("qbResult");
  if (res) { res.className = "hidden"; res.innerHTML = ""; }

  // Reset button
  const btn = document.getElementById("qbSubmitBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">search</span>ค้นหาห้องที่ว่าง`;
  }

  // Sync days section visibility
  qbSyncDates();

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeQuickBook() {
  const modal = document.getElementById("qbModal");
  if (modal) { modal.classList.add("hidden"); modal.classList.remove("flex"); }
  qbSelectedRoomId = null;
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
  document.getElementById("qbpl1").setAttribute("style", n === 1 ? "border-color:#7e0000;background:#fff1f2" : "");
  document.getElementById("qbpl2").setAttribute("style", n === 2 ? "border-color:#7e0000;background:#fff1f2" : "");
  document.getElementById("qbpl1").className = `${base}`;
  document.getElementById("qbpl2").className = `${base}`;
  document.getElementById("qb_teaching_fields").className = n === 1 ? "space-y-3" : "hidden space-y-3";
  document.getElementById("qb_training_fields").className = n === 2 ? "space-y-3" : "hidden space-y-3";
}

function qbAutoEndTime() {
  const s = document.getElementById("qb_time_start");
  const e = document.getElementById("qb_time_end");
  if (!s || !e) return;
  const [h, m] = s.value.split(":").map(Number);
  const nh = h + 1;
  e.value = nh >= 24 ? "23:59" : `${String(nh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** ซิงค์ date_start → date_end และแสดง/ซ่อนส่วน weekdays ตาม isSingleDay */
function qbSyncDates() {
  const startEl = document.getElementById("qb_date_start");
  const endEl = document.getElementById("qb_date_end");
  const daysSection = document.getElementById("qb_days_section");
  if (!startEl || !endEl) return;

  // ถ้า date_end ว่างให้ copy จาก date_start
  if (startEl.value && !endEl.value) endEl.value = startEl.value;

  const isSingleDay = !endEl.value || startEl.value === endEl.value;

  // ถ้าเป็น single day → ซ่อนวันในสัปดาห์ & uncheck ทั้งหมด
  if (daysSection) {
    if (isSingleDay) {
      daysSection.classList.add("hidden");
      document.querySelectorAll("input[name=qb_rec_day]").forEach(cb => { cb.checked = false; });
    } else {
      daysSection.classList.remove("hidden");
    }
  }

  // รีเซ็ต result เมื่อเปลี่ยนวัน
  const res = document.getElementById("qbResult");
  if (res) { res.className = "hidden"; res.innerHTML = ""; }
  qbSelectedRoomId = null;
  const btn = document.getElementById("qbSubmitBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">search</span>ค้นหาห้องที่ว่าง`;
  }
}

function qbToggleAllDays() {
  const checkboxes = document.querySelectorAll("input[name=qb_rec_day]");
  const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
  checkboxes.forEach(cb => { cb.checked = anyUnchecked; });
  const btn = document.getElementById("qbBtnToggleAllDays");
  if (btn) btn.textContent = anyUnchecked ? "ล้างทั้งหมด" : "เลือกทุกวัน";
}

// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Room finder (client-side, best-effort)
// ═══════════════════════════════════════════════════════

function qbTimeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function qbDayName(dateStr) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const [y, mo, d] = dateStr.split("-").map(Number);
  return days[new Date(y, mo - 1, d).getDay()];
}

/**
 * หาห้องที่เข้าเกณฑ์ทั้งหมดสำหรับ Quick Book
 * Returns { available: Room[], conflicted: Room[], reason?: string }
 * เรียงลำดับ: ห้องโปรดก่อน → ความจุน้อยที่สุดที่ >= minCap
 */
function qbFindAvailableRooms(dateStart, timeStart, timeEnd, minCap, roomType) {
  const dayName = qbDayName(dateStart);
  const reqS = qbTimeToMin(timeStart);
  const reqE = qbTimeToMin(timeEnd);
  const favIds = new Set(favRooms.map(r => String(r.room_id)));

  // 1. กรองตาม capacity & type
  const candidates = rooms.filter(r =>
    r.capacity >= minCap &&
    (roomType === "all" || r.room_type === roomType)
  );

  if (candidates.length === 0) return { available: [], conflicted: [], reason: "no_capacity" };

  // 2. กรอง conflict จาก allSchedules (best-effort client-side, single-day check)
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
        return false;
      }
    }
    return true;
  });

  // 3. เรียงลำดับ: ห้องโปรดก่อน → ความจุน้อยที่สุด
  available.sort((a, b) => {
    const aFav = favIds.has(String(a.room_id)) ? 0 : 1;
    const bFav = favIds.has(String(b.room_id)) ? 0 : 1;
    if (aFav !== bFav) return aFav - bFav;
    return a.capacity - b.capacity;
  });

  return { available, conflicted };
}

// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Room card selection UI
// ═══════════════════════════════════════════════════════

/** เลือก/ยกเลิกเลือกห้องใน result list */
function qbSelectRoom(roomId) {
  qbSelectedRoomId = (qbSelectedRoomId === roomId) ? null : roomId;

  // อัปเดต highlight ทุก card
  document.querySelectorAll(".qb-room-card").forEach(card => {
    const id = Number(card.dataset.roomId);
    if (id === qbSelectedRoomId) {
      card.classList.add("border-primary", "bg-red-50/60");
      card.classList.remove("border-slate-200");
      card.querySelector(".qb-select-badge").innerHTML =
        `<span class="material-symbols-outlined text-[16px] text-white">check</span>`;
      card.querySelector(".qb-select-badge").className =
        "qb-select-badge w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-primary";
    } else {
      card.classList.remove("border-primary", "bg-red-50/60");
      card.classList.add("border-slate-200");
      card.querySelector(".qb-select-badge").innerHTML =
        `<span class="material-symbols-outlined text-[16px] text-slate-400">radio_button_unchecked</span>`;
      card.querySelector(".qb-select-badge").className =
        "qb-select-badge w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0";
    }
  });

  // แสดง/ซ่อนปุ่มยืนยัน
  const confirmBtn = document.getElementById("qbConfirmBtn");
  if (confirmBtn) {
    confirmBtn.classList.toggle("hidden", qbSelectedRoomId === null);
  }
}

// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Search & Show rooms
// ═══════════════════════════════════════════════════════

async function submitQuickBook() {
  const btn = document.getElementById("qbSubmitBtn");
  const resEl = document.getElementById("qbResult");

  // อ่านค่าจากฟอร์ม
  const purposeEl = document.querySelector("input[name=qb_purp]:checked");
  const purpose = purposeEl ? purposeEl.value : "teaching";
  const dateStart = document.getElementById("qb_date_start")?.value || "";
  const dateEnd = document.getElementById("qb_date_end")?.value || "";
  const timeStart = document.getElementById("qb_time_start")?.value || "";
  const timeEnd = document.getElementById("qb_time_end")?.value || "";
  const minCap = parseInt(document.getElementById("qb_capacity")?.value || "0", 10);
  const roomType = document.getElementById("qb_room_type")?.value || "all";
  const isSingleDay = !dateEnd || dateStart === dateEnd;
  const days = [...document.querySelectorAll("input[name=qb_rec_day]:checked")].map(c => c.value);

  // Validate
  const errs = [];
  if (!dateStart) errs.push("วันที่เริ่ม");
  if (!timeStart) errs.push("เวลาเริ่ม");
  if (!timeEnd) errs.push("เวลาสิ้นสุด");
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
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const curTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (dateStart < todayStr) { showToast("ไม่สามารถจองย้อนหลังได้", "error"); return; }
  if (dateEnd && dateEnd < dateStart) { showToast("วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม", "error"); return; }
  if (qbTimeToMin(timeStart) >= qbTimeToMin(timeEnd)) { showToast("เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด", "error"); return; }
  if (dateStart === todayStr && timeStart < curTime) { showToast(`เวลาเริ่มต้องไม่ย้อนหลัง (ปัจจุบัน ${curTime})`, "error"); return; }

  // แสดง loading & ค้นหาห้อง
  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>กำลังค้นหาห้อง...`;
  resEl.className = "hidden";
  resEl.innerHTML = "";
  qbSelectedRoomId = null;

  const { available, conflicted, reason } = qbFindAvailableRooms(dateStart, timeStart, timeEnd, minCap, roomType);

  btn.disabled = false;
  btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">search</span>ค้นหาห้องที่ว่าง`;

  if (available.length === 0) {
    let msg = "";
    if (reason === "no_capacity") {
      msg = `<p class="font-bold text-red-700 mb-1">ไม่มีห้องที่รองรับผู้ใช้ได้ถึง ${minCap} คน</p>
             <p class="text-sm text-slate-500">ลองลดจำนวนผู้ใช้หรือเปลี่ยนประเภทห้อง</p>`;
    } else {
      const names = conflicted.map(r => `<span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">${r.room_code}</span>`).join(" ");
      msg = `<p class="font-bold text-red-700 mb-1">ไม่มีห้องว่างในช่วงเวลาที่เลือก</p>
             ${names ? `<p class="text-xs text-slate-500 mt-1">ห้องที่ถูกจองแล้ว: ${names}</p>` : ""}
             <p class="text-sm text-slate-500 mt-1">ลองเปลี่ยนวัน/เวลา หรือเลือกประเภทห้องอื่น</p>`;
    }
    resEl.innerHTML = `<div class="p-4 bg-red-50 border border-red-200 rounded-xl">${msg}</div>`;
    resEl.className = "block";
    return;
  }

  // สร้าง card list ให้ผู้ใช้เลือก
  const favIds = new Set(favRooms.map(r => String(r.room_id)));
  const roomTypeLabel = { "Meeting Room": "ห้องประชุม", "Classroom": "ห้องเรียน" };

  const cards = available.map(r => {
    const isFav = favIds.has(String(r.room_id));
    return `
<div class="qb-room-card flex items-center gap-3 p-3.5 bg-white border-2 border-slate-200 rounded-xl cursor-pointer hover:border-primary transition-all"
     data-room-id="${r.room_id}" onclick="qbSelectRoom(${r.room_id})">
  <div class="qb-select-badge w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">
    <span class="material-symbols-outlined text-[16px] text-slate-400">radio_button_unchecked</span>
  </div>
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5 flex-wrap">
      <span class="font-bold text-slate-800 text-sm">${r.room_name}</span>
      <span class="text-xs text-slate-400 font-bold">(${r.room_code})</span>
      ${isFav ? `<span class="material-symbols-outlined text-[14px] text-amber-500 [font-variation-settings:'FILL'_1]" title="ห้องโปรด">star</span>` : ""}
    </div>
    <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
      <span class="material-symbols-outlined text-[12px]">groups</span>${r.capacity} ที่นั่ง
      <span class="ml-1 text-slate-400">·</span>
      ${roomTypeLabel[r.room_type] || r.room_type}
    </p>
  </div>
</div>`;
  }).join("");

  const favNote = available.some(r => favIds.has(String(r.room_id)))
    ? `<p class="text-xs text-amber-600 font-medium flex items-center gap-1 mb-2"><span class="material-symbols-outlined text-[13px] [font-variation-settings:'FILL'_1]">star</span>ห้องโปรดแสดงก่อน</p>` : "";

  resEl.innerHTML = `
<div class="space-y-3">
  <p class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
    <span class="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
    พบห้องที่เข้าเกณฑ์ ${available.length} ห้อง — เลือกห้องที่ต้องการ
  </p>
  ${favNote}
  <div class="space-y-2 max-h-64 overflow-y-auto pr-1">${cards}</div>
  <button id="qbConfirmBtn" onclick="qbConfirmBook()" class="hidden w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-95 transition-all" style="background:linear-gradient(135deg,#16a34a,#15803d)">
    <span class="material-symbols-outlined text-[18px]">bolt</span>ยืนยันการจองห้องที่เลือก
  </button>
</div>`;
  resEl.className = "block";
}

// ═══════════════════════════════════════════════════════
//  QUICK BOOK — Confirm & Submit booking
// ═══════════════════════════════════════════════════════

async function qbConfirmBook() {
  if (!qbSelectedRoomId) {
    showToast("กรุณาเลือกห้องก่อนยืนยัน", "error");
    return;
  }

  const confirmBtn = document.getElementById("qbConfirmBtn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>กำลังส่งคำขอจอง...`;
  }

  // อ่านค่าจากฟอร์ม
  const purposeEl = document.querySelector("input[name=qb_purp]:checked");
  const purpose = purposeEl ? purposeEl.value : "teaching";
  const dateStart = document.getElementById("qb_date_start")?.value || "";
  const dateEnd = document.getElementById("qb_date_end")?.value || "";
  const timeStart = document.getElementById("qb_time_start")?.value || "";
  const timeEnd = document.getElementById("qb_time_end")?.value || "";
  const isSingleDay = !dateEnd || dateStart === dateEnd;
  const days = [...document.querySelectorAll("input[name=qb_rec_day]:checked")].map(c => c.value);
  const payload = {
    room_id: qbSelectedRoomId,
    date_start: dateStart,
    date_end: dateEnd || dateStart,
    time_start: timeStart,
    time_end: timeEnd,
    purpose_type: purpose,
    skip_conflicts: false,
    additional_requests: "",
  };

  // Recurring: ถ้าเป็น single day ไม่ส่ง days_of_week; ถ้า multi-day ส่งวันที่เลือก
  if (isSingleDay) {
    payload.days_of_week = null;
  } else {
    payload.days_of_week = days.length > 0 ? days : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  }

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
    const room = rooms.find(r => r.room_id === qbSelectedRoomId);
    closeQuickBook();
    calBookDate = null; calBookKey = null; calBookLabel = null;
    await Promise.all([loadMyBookings(), loadAllBookings(), loadAllSchedules()]);

    if (result.skipped_dates && result.skipped_dates.length > 0) {
      const skippedStr = result.skipped_dates.map(d => thaiDateShort(d)).join(", ");
      showToast(`จองสำเร็จ ข้ามรายการที่ชนอัตโนมัติ: ${skippedStr}`, "warning");
    } else {
      showToast(
        `จองห้อง ${room?.room_code || ""} สำเร็จ! (${result.booking_ids?.length || 1} รายการ)`,
        "check_circle"
      );
    }
    navigate("my-bookings");
  } catch (err) {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">bolt</span>ยืนยันการจองห้องที่เลือก`;
    }
    if (err.status === 409) {
      showToast("ห้องที่เลือกมีเวลาจองชน กรุณาเลือกห้องอื่น หรือเปิดสวิตช์ข้ามวันที่ชน", "error");
    } else {
      showToast(err.data?.error || err.message || "เกิดข้อผิดพลาดในการจอง", "error");
    }
  }
}

window.openQuickBook = openQuickBook;
window.closeQuickBook = closeQuickBook;
window.qbHlPurpose = qbHlPurpose;
window.qbAutoEndTime = qbAutoEndTime;
window.qbSyncDates = qbSyncDates;
window.qbToggleAllDays = qbToggleAllDays;
window.qbSelectRoom = qbSelectRoom;
window.submitQuickBook = submitQuickBook;
window.qbConfirmBook = qbConfirmBook;