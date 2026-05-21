/**
 * calendar.js — vCalendar rendering & Calendar events handlers
 */
"use strict";

function vCalendar() {
  const wdHeaders = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."]
    .map(
      (d) =>
        `<div class="py-2 text-center text-[11px] font-bold text-slate-400 uppercase">${d}</div>`,
    )
    .join("");
  const roomOpts = [
    '<option value="all">ทุกห้อง</option>',
    ...rooms.map((r) => `<option value="${r.room_id}">${r.room_name}</option>`),
  ].join("");

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-center gap-3 mb-5">
        <h2 class="text-2xl font-bold text-slate-800">ปฏิทินห้องว่าง</h2>
        <div class="flex items-center gap-2 flex-wrap">
            <select onchange="calRoomFilter=this.value;calRender()"
                class="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none">${roomOpts}</select>
            <button onclick="calDate=new Date();calRender()"
                class="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50">วันนี้</button>
            <button onclick="calNav(-1)" class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50">
                <span class="material-symbols-outlined text-[18px]">chevron_left</span></button>
            <span id="calHdr" class="text-sm font-bold text-slate-700 min-w-[120px] text-center"></span>
            <button onclick="calNav(1)"  class="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-50">
                <span class="material-symbols-outlined text-[18px]">chevron_right</span></button>
        </div>
    </div>
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="cal-grid border-b border-slate-200">${wdHeaders}</div>
        <div class="cal-grid" id="calMG"></div>
    </div>
</div>`;
}

function initCalendar() {
  calRender();
}

function calNav(d) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth() + d, 1);
  calRender();
}

function calRender() {
  const hdr = document.getElementById("calHdr");
  if (hdr)
    hdr.textContent = `${LOCAL_MONTHS_TH[calDate.getMonth()]} ${calDate.getFullYear() + 543}`;

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
    const dayBks = bookings.filter((b) => {
      const s = new Date(b.start_datetime);
      return (
        s.getFullYear() === y &&
        s.getMonth() === m &&
        s.getDate() === d &&
        (b.status === "Approved" || b.status === "Pending") &&
        (calRoomFilter === "all" || String(b.room?.room_id) === calRoomFilter)
      );
    });

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

function isToday(y, m, d) {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
}

function calShowDayAdmin(y, m, d) {
  const dayBks = bookings.filter((b) => {
    const s = new Date(b.start_datetime);
    return (
      s.getFullYear() === y &&
      s.getMonth() === m &&
      s.getDate() === d &&
      (b.status === "Approved" || b.status === "Pending") &&
      (calRoomFilter === "all" || String(b.room?.room_id) === calRoomFilter)
    );
  });

  document.getElementById("dayModalTitle").textContent =
    `${d} ${LOCAL_MONTHS_TH[m]} ${y + 543}`;
  document.getElementById("dayModalBody").innerHTML =
    dayBks.length === 0
      ? `<div class="text-center py-8 text-slate-400"><span class="material-symbols-outlined text-4xl block mb-2">event_available</span>ว่างทั้งวัน</div>`
      : dayBks
          .map((b) => {
            const rejectNote =
              b.reject_reason && b.reject_reason.trim()
                ? `<p class="text-[11px] text-red-600 bg-red-50 rounded px-2 py-1 mt-1 font-medium"><strong>เหตุผล:</strong> ${b.reject_reason}</p>`
                : "";
            const approveNote =
              b.admin_notes && b.admin_notes.trim()
                ? `<p class="text-[11px] text-emerald-600 bg-emerald-50 rounded px-2 py-1 mt-1 font-medium"><strong>หมายเหตุอนุมัติ:</strong> ${b.admin_notes}</p>`
                : "";

            return `
<div class="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex justify-between items-start gap-3 cursor-pointer" onclick="closeModals(); viewDetailAdmin(${b.booking_id})">
    <div class="min-w-0 flex-1">
        <p class="font-bold text-slate-800 text-sm">${b.room?.room_name}</p>
        <p class="text-xs text-slate-500 mt-0.5">${b.booker?.displayname_th || "—"} · ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}</p>
        <p class="text-xs text-slate-500">วัตถุประสงค์: ${b.purpose_type} ${b.subject ? `(${b.subject})` : ""}</p>
        ${rejectNote}
        ${approveNote}
    </div>
    <span class="${{ Pending: "badge-pending", Approved: "badge-approved", Rejected: "badge-rejected" }[b.status] || "badge-pending"} px-2 py-0.5 rounded-full text-[10px] font-bold">${b.status}</span>
</div>`;
          })
          .join("");
  document.getElementById("dayModal").classList.remove("hidden");
}
