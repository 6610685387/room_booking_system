/**
 * calendar.js — Calendar UI rendering (month/week) & custom day detail modals
 */
"use strict";

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
                <button onclick="calTogFd(event)" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-1.5 shadow-sm hover:bg-slate-50"><span class="material-symbols-outlined text-[16px] text-slate-400">filter_list</span><span id="calFLbl">ห้องทั้งหมด</span></button>
                <div id="calFDD" class="filter-dd">
                    <label class="filter-opt"><input type="checkbox" id="calFAll" checked onchange="calTogAll(this)"><span>ทั้งหมด</span></label>
                    <hr class="border-slate-100 my-1">
                    ${rooms.map((r) => `<label class="filter-opt"><input type="checkbox" class="cal-rcb" value="${r.room_id}" checked onchange="calUpdFlt()"><span>${r.room_name} (${r.room_code})</span></label>`).join("")}
                </div>
            </div>
            <button onclick="calToday()" class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 shadow-sm">วันนี้</button>
            <button onclick="calNav(-1)" class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50"><span class="material-symbols-outlined text-[18px]">chevron_left</span></button>
            <span class="text-sm font-bold text-slate-700 min-w-[120px] text-center" id="calHdr"></span>
            <button onclick="calNav(1)" class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50"><span class="material-symbols-outlined text-[18px]">chevron_right</span></button>
            <div class="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-sm">
                <button id="calTm" class="view-tab active" onclick="calSwitchView('month')">เดือน</button>
                <button id="calTw" class="view-tab" onclick="calSwitchView('week')">สัปดาห์</button>
            </div>
            <button onclick="calQuickBook()" class="px-4 py-2 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm hover:opacity-90" style="background:#7e0000"><span class="material-symbols-outlined text-[16px]">add</span>จองห้อง</button>
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
    bHtml += `<div class="border-r border-b border-slate-100 flex items-start justify-end pr-2 pt-1" style="height:${SH}px"><span class="text-[10px] text-slate-400 font-medium">${h}:00</span></div>`;
    days.forEach((d) => {
      const key = calFKey(d.getFullYear(), d.getMonth(), d.getDate());
      const bks = calGetBk(key).filter((b) => b.h === h);
      const tod = isToday(d.getFullYear(), d.getMonth(), d.getDate());
      const td = `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${toBE(d.getFullYear())}`;
      const blocks = bks
        .map(
          (
            b,
          ) => `<div class="${b.status === "Approved" ? "block-approved" : "block-pending"} absolute left-1 right-1 rounded-lg px-1.5 py-1 text-[10px] font-bold overflow-hidden cursor-pointer hover:opacity-80 transition-opacity" style="top:2px;height:${b.dur * SH - 6}px;z-index:5" onclick="calShowDay('${td}','${key}')">
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
              ? `<button onclick="closeDayModal(); event.stopPropagation(); openCancelModal(${b.id})" class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0 shadow-sm"><span class="material-symbols-outlined text-[14px]">cancel</span> ยกเลิก</button>`
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

  calDayModalKey = key;
  calDayModalLabel = dateStr;
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
