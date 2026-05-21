/**
 * calendar.js — vCalendar rendering & Calendar events handlers (Month & Week views supported)
 */
"use strict";

// ประกาศตัวแปรเก็บสถานะมุมมองและตัวกรองภายในปฏิทิน Admin
let calView = "month"; // 'month' หรือ 'week'
let calRooms = new Set();
const CAL_HRS = Array.from({ length: 12 }, (_, i) => i + 7); // สล็อตเวลารายชั่วโมง 7:00 ถึง 18:00 น.
const SH = 52; // ความสูงสล็อตชั่วโมงในมุมมองรายสัปดาห์

// ตรวจสอบตัวแปรชื่อวันภาษาไทยแบบสั้น-ยาวเพื่อป้องกัน Error
if (typeof DAYS_TH === "undefined") {
  window.DAYS_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
}
const DAYS_TH_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function vCalendar() {
  const wdHeaders = DAYS_TH_SHORT
    .map(
      (d) =>
        `<div class="py-2 text-center text-[11px] font-bold text-slate-400 uppercase">${d}</div>`,
    )
    .join("");

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h2 class="text-2xl font-bold text-slate-800">ปฏิทินห้องว่าง</h2>
        <div class="flex items-center gap-2 flex-wrap">
            <!-- เมนูตัวเลือกหลายห้องสไตล์เดียวกับฝั่ง Lecturer -->
            <div class="relative" id="calFW">
                <button onclick="calTogFd(event)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-slate-50">
                    <span class="material-symbols-outlined text-[16px] text-slate-400">filter_list</span>
                    <span id="calFLbl">ห้องทั้งหมด</span>
                </button>
                <div id="calFDD" class="filter-dd">
                    <label class="filter-opt">
                        <input type="checkbox" id="calFAll" checked onchange="calTogAll(this)">
                        <span>ทั้งหมด</span>
                    </label>
                    <hr class="border-slate-100 my-1">
                    ${rooms.map((r) => `
                        <label class="filter-opt">
                            <input type="checkbox" class="cal-rcb" value="${r.room_id}" checked onchange="calUpdFlt()">
                            <span>${r.room_name} (${r.room_code})</span>
                        </label>
                    `).join("")}
                </div>
            </div>

            <!-- ปุ่ม วันนี้ และ ปุ่มเลื่อนสล็อตปฏิทิน -->
            <button onclick="calDate=new Date();calRender()" 
                class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm transition-all active:scale-95">วันนี้</button>
            <button onclick="calNav(-1)" class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                <span class="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span id="calHdr" class="text-sm font-bold text-slate-700 min-w-[120px] text-center"></span>
            <button onclick="calNav(1)" class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                <span class="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>

            <!-- เมนูสลับมุมมอง เดือน / สัปดาห์ แบบเดียวกับ Lecturer -->
            <div class="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-sm">
                <button id="calTm" class="view-tab active" onclick="calSwitchView('month')">เดือน</button>
                <button id="calTw" class="view-tab"        onclick="calSwitchView('week')">สัปดาห์</button>
            </div>
        </div>
    </div>

    <!-- โครงสร้างปฏิทินแบบ 2 มุมมอง (Month/Week View) -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- 1. มุมมองรายเดือน -->
        <div id="calMV">
            <div class="cal-grid border-b border-slate-200">${wdHeaders}</div>
            <div class="cal-grid" id="calMG"></div>
        </div>
        <!-- 2. มุมมองรายสัปดาห์ -->
        <div id="calWV" class="hidden">
            <div class="week-grid border-b border-slate-200" id="calWH"></div>
            <div class="week-grid overflow-y-auto" id="calWB" style="max-height:520px"></div>
        </div>
    </div>
</div>`;
}

function initCalendar() {
  calRooms = new Set(rooms.map((r) => String(r.room_id)));
  calRender();
}

// ควบคุมการเลื่อนปฏิทินรองรับทั้งแบบสัปดาห์และเดือน
function calNav(d) {
  if (calView === "month") {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() + d, 1);
  } else {
    calDate = new Date(calDate.getTime() + d * 7 * 864e5);
  }
  calRender();
}

// ฟังก์ชันดึงวันจันทร์แรกของสัปดาห์สำหรับการจัดรูปตาราง Week View
function calWkStart(d) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

// ฟังก์ชันตัวกรองข้อมูลกลางที่ใช้งานร่วมกันในทุกฟังก์ชันแสดงผล
function calGetBkAdmin(y, m, d) {
  return bookings.filter((b) => {
    const s = new Date(b.start_datetime);
    return (
      s.getFullYear() === y &&
      s.getMonth() === m &&
      s.getDate() === d &&
      (b.status === "Approved" || b.status === "Pending") &&
      (calRooms.has(String(b.room?.room_id)) || calRooms.size === 0)
    );
  });
}

// การเรนเดอร์สวิตช์ปุ่มมุมมอง เดือน / สัปดาห์
function calSwitchView(v) {
  calView = v;
  document.getElementById("calMV")?.classList.toggle("hidden", v !== "month");
  document.getElementById("calWV")?.classList.toggle("hidden", v !== "week");
  document.getElementById("calTm")?.classList.toggle("active", v === "month");
  document.getElementById("calTw")?.classList.toggle("active", v === "week");
  calRender();
}

// ฟังก์ชันควบคุมการเปิด/ปิดตัวกรองห้องแบบ Checklist
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
  if (lbl) {
    lbl.textContent =
      calRooms.size === cbs.length
        ? "ห้องทั้งหมด"
        : calRooms.size === 0
          ? "ไม่มีห้อง"
          : `${calRooms.size} ห้อง`;
  }
  calRender();
}

function calRender() {
  const hdr = document.getElementById("calHdr");
  if (hdr) {
    hdr.textContent =
      calView === "month"
        ? `${LOCAL_MONTHS_TH[calDate.getMonth()]} ${calDate.getFullYear() + 543}`
        : (() => {
            const ws = calWkStart(calDate);
            const we = new Date(ws);
            we.setDate(we.getDate() + 6);
            return `${ws.getDate()} – ${we.getDate()} ${LOCAL_MONTHS_TH[ws.getMonth()]} ${ws.getFullYear() + 543}`;
          })();
  }

  if (calView === "month") calRenderMonth();
  else calRenderWeek();
}

// เขียนข้อมูลลงปฏิทินแบบรายเดือน
function calRenderMonth() {
  const g = document.getElementById("calMG");
  if (!g) return;

  const y = calDate.getFullYear(),
    m = calDate.getMonth();
  const fd = new Date(y, m, 1).getDay(),
    dm = new Date(y, m + 1, 0).getDate();
  let html = "";

  for (let i = 0; i < fd; i++) {
    html += `<div class="cal-day p-2 border-r border-b border-slate-100 bg-slate-50/50"></div>`;
  }

  for (let d = 1; d <= dm; d++) {
    const tod = isToday(y, m, d);
    const dayBks = calGetBkAdmin(y, m, d);

    const chips = dayBks
      .slice(0, 2)
      .map(
        (b) =>
          `<div class="px-1.5 py-0.5 rounded-r text-[10px] font-bold truncate ${b.status === "Approved" ? "chip-approved" : "chip-pending"}">${b.room?.room_code} ${timeFromISO(b.start_datetime)}</div>`,
      )
      .join("");

    const more =
      dayBks.length > 2
        ? `<div class="text-[10px] text-slate-400 font-semibold pl-1">+${dayBks.length - 2}</div>`
        : "";

    html += `<div class="cal-day p-2 border-r border-b border-slate-100 ${tod ? "bg-red-50/40" : ""}" onclick="calShowDayAdmin(${y},${m},${d})">
            <span class="${tod ? "today-ring" : "font-bold text-sm"}">${d}</span>
            <div class="mt-1 space-y-0.5">${chips}${more}</div>
        </div>`;
  }
  g.innerHTML = html;
}

// เขียนข้อมูลลงปฏิทินแบบรายสัปดาห์ (Week View)
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

  let hHtml = `<div class="py-3 border-r border-slate-100 bg-slate-50/35"></div>`;
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
    bHtml += `<div class="border-r border-b border-slate-100 flex items-start justify-end pr-2 pt-1 bg-slate-50/10" style="height:${SH}px">
            <span class="text-[10px] text-slate-400 font-medium">${h}:00</span>
        </div>`;

    days.forEach((d) => {
      const dayBks = calGetBkAdmin(d.getFullYear(), d.getMonth(), d.getDate());
      // คัดกรองหารายการที่มีชั่วโมงเริ่มต้นที่ตรงกับแถวนั้น ๆ
      const hourBks = dayBks.filter((b) => {
        const startHour = new Date(b.start_datetime).getHours();
        return startHour === h;
      });

      const tod = isToday(d.getFullYear(), d.getMonth(), d.getDate());

      const blocks = hourBks
        .map((b) => {
          const start = new Date(b.start_datetime);
          const end = new Date(b.end_datetime);
          const duration = (end - start) / 3600000;
          const roomCode = b.room?.room_code || b.room_code || "—";
          const timeRange = `${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;

          return `
<div class="${b.status === "Approved" ? "block-approved" : "block-pending"} absolute left-1 right-1 rounded-lg px-1.5 py-1 text-[10px] font-bold overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" 
     style="top:2px;height:${duration * SH - 6}px;z-index:5" 
     onclick="calShowDayAdmin(${d.getFullYear()},${d.getMonth()},${d.getDate()})">
    <div class="truncate">${roomCode}</div>
    <div class="opacity-70 text-[9px] truncate">${timeRange}</div>
</div>`;
        })
        .join("");

      bHtml += `<div class="border-r border-b border-slate-100 relative ${tod ? "bg-red-50/20" : ""}" style="height:${SH}px">${blocks}</div>`;
    });
  });

  wb.innerHTML = bHtml;
  wb.style.gridTemplateColumns = "56px repeat(7,1fr)";
}

function isToday(y, m, d) {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
}

// แสดงรายละเอียดกล่อง Modal เมื่อคลิกเลือกวัน (จัดเรียงเวลา, กรุ๊ปห้องซ้ำ และปรับสี Approved เป็นเขียว)
function calShowDayAdmin(y, m, d) {
  const dayBks = calGetBkAdmin(y, m, d);
  const formattedDate = `${d} ${LOCAL_MONTHS_TH[m]} ${y + 543}`;

  document.getElementById("dayModalTitle").textContent = `รายการจอง – ${formattedDate}`;

  if (dayBks.length === 0) {
    document.getElementById("dayModalBody").innerHTML = `
      <div class="text-center py-8 text-slate-400">
         <span class="material-symbols-outlined text-4xl block mb-2">event_available</span>
         <p class="text-sm font-medium">ยังไม่มีการจองในวันนี้</p>
      </div>`;
    document.getElementById("dayModal").classList.remove("hidden");
    return;
  }

  // 1. เรียงลำดับรายการจองทั้งหมดตามเวลาเริ่มต้น (Ascending Order)
  dayBks.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

  // 2. จัดแบ่งและกรุ๊ปข้อมูลการจองรายห้อง
  const groupedByRoom = {};
  dayBks.forEach((b) => {
    const rId = b.room?.room_id || b.room_id || "unknown";
    if (!groupedByRoom[rId]) {
      groupedByRoom[rId] = {
        room_id: rId,
        room_name: b.room?.room_name || b.room_name || "—",
        room_code: b.room?.room_code || b.room_code || "—",
        bookings: []
      };
    }
    groupedByRoom[rId].bookings.push(b);
  });

  const groupList = Object.values(groupedByRoom);

  // เรียงลำดับรายการกลุ่มตามสล็อตจองที่เช้าที่สุดของห้องนั้น ๆ
  groupList.sort((a, b) => new Date(a.bookings[0].start_datetime) - new Date(b.bookings[0].start_datetime));

  // 3. เขียนโครงสร้างการ์ด (แยกประเภท Single และ Multiple)
  const listHtml = groupList
    .map((g) => {
      if (g.bookings.length === 1) {
        // กรณีห้องมีคิวจองเพียง "1 รายการ" ในวันนั้น
        const b = g.bookings[0];
        const roomFull = `${g.room_name} (${g.room_code})`;
        const timeRange = `${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;
        const bookerName = b.booker?.displayname_th || "—";
        const details = b.subject ? b.subject : (b.purpose_type === "teaching" ? "สอนปกติ/ชดเชย" : "จัดอบรม/ติว");

        return `
<div class="p-4 rounded-2xl border-2 ${b.status === "Approved" ? "border-emerald-100 bg-emerald-50/30" : "border-amber-100 bg-amber-50/30"} flex justify-between items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity" 
     onclick="closeModals(); viewDetailAdmin(${b.booking_id})">
    <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-1.5">
            <span class="w-2 h-2 rounded-full ${b.status === "Approved" ? "bg-emerald-500" : "bg-amber-500"}"></span>
            <span class="text-xs font-bold ${b.status === "Approved" ? "text-emerald-700" : "text-amber-700"} uppercase tracking-wider">
                ${b.status === "Approved" ? "ถูกจองแล้ว" : "รออนุมัติ"}
            </span>
        </div>
        <p class="font-bold text-slate-800 truncate">${roomFull}</p>
        <p class="text-sm text-slate-600 mt-0.5">เวลา ${timeRange} น.</p>
        <p class="text-xs text-slate-500 mt-1 truncate">ผู้จอง: ${bookerName} · ${details}</p>
    </div>
</div>`;
      } else {
        // กรณีมีจองตั้งแต่ "2 รายการขึ้นไป" สำหรับห้องนี้ ให้กรุ๊ปสล็อตจองย่อยรวมกันภายใต้คอนเทนเนอร์คราม (Indigo)
        const slotsHtml = g.bookings
          .map((b) => {
            const timeRange = `${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;
            const bookerName = b.booker?.displayname_th || "—";
            const details = b.subject ? b.subject : (b.purpose_type === "teaching" ? "สอนปกติ/ชดเชย" : "จัดอบรม/ติว");

            return `
<div class="p-3 rounded-xl border border-slate-100 bg-white/80 hover:border-slate-300 shadow-xs flex justify-between items-center gap-2 cursor-pointer transition-all"
     onclick="event.stopPropagation(); closeModals(); viewDetailAdmin(${b.booking_id})">
    <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 mb-1">
            <span class="w-1.5 h-1.5 rounded-full ${b.status === "Approved" ? "bg-emerald-500" : "bg-amber-500"}"></span>
            <span class="text-[10px] font-bold ${b.status === "Approved" ? "text-emerald-600" : "text-amber-600"} uppercase tracking-wider">
                ${b.status === "Approved" ? "ถูกจองแล้ว" : "รออนุมัติ"}
            </span>
            <span class="text-[10px] text-slate-400">#${b.booking_id}</span>
        </div>
        <p class="text-xs font-bold text-slate-700">เวลา ${timeRange} น.</p>
        <p class="text-[11px] text-slate-500 mt-0.5 truncate">ผู้จอง: ${bookerName} · ${details}</p>
    </div>
    <span class="material-symbols-outlined text-[16px] text-slate-400">chevron_right</span>
</div>`;
          })
          .join("");

        return `
<div class="p-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/10 space-y-3">
    <div class="flex justify-between items-start gap-2">
        <div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 uppercase tracking-wider">มีการจองหลายช่วงเวลา</span>
            <h3 class="font-bold text-slate-800 text-sm mt-1.5">${g.room_name} (${g.room_code})</h3>
            <p class="text-[10px] text-slate-400 font-semibold mt-0.5">พบรายการจองทั้งหมด ${g.bookings.length} รายการในวันนี้</p>
        </div>
    </div>
    <div class="space-y-1.5">${slotsHtml}</div>
</div>`;
      }
    })
    .join("");

  document.getElementById("dayModalBody").innerHTML = listHtml;
  document.getElementById("dayModal").classList.remove("hidden");
}