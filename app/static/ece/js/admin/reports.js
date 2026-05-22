/**
 * reports.js — Statistics visualizer & advanced report export control
 */
"use strict";

let rptMonth = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();

let expPurpose = "all";

function vReports() {
  const statsSrc = reportsSummary?.statistics || {};
  const total = statsSrc.total_bookings ?? bookings.length;
  const approved =
    statsSrc.by_status?.Approved ??
    bookings.filter((b) => b.status === "Approved").length;
  const pending =
    statsSrc.by_status?.Pending ??
    bookings.filter((b) => b.status === "Pending").length;
  const pct = total ? Math.round((approved / total) * 100) : 0;

  // ── helper: แปลง % → สีแบบ gradient (เขียว → เหลือง → แดงเข้ม)
  function pctColor(p) {
    if (p >= 75) return "#7e0000";       // แดงเข้ม — ใช้งานสูงมาก
    if (p >= 50) return "#dc2626";       // แดง
    if (p >= 30) return "#f59e0b";       // เหลืองส้ม
    if (p >= 15) return "#10b981";       // เขียว
    return "#94a3b8";                    // เทา — ใช้งานน้อย
  }

  let roomRows = "";
  if (statsSrc.by_room && Array.isArray(statsSrc.by_room)) {
    // ใช้ approved จาก API เป็นตัวหาร (สัดส่วนจากที่อนุมัติทั้งหมด)
    const approvedTotal = statsSrc.by_status?.Approved ?? approved;
    roomRows = statsSrc.by_room
      .map((r) => {
        const count = r.booking_count || 0;
        const pct2 = approvedTotal ? Math.round((count / approvedTotal) * 100) : 0;
        const clamp = Math.min(pct2, 100);
        return `
        <div class="flex items-center gap-3">
            <div class="text-xs font-bold text-slate-600 w-24 flex-shrink-0 truncate" title="${r.room_name}">${r.room_code}</div>
            <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="util-bar h-full rounded-full transition-all duration-500" style="width:0%;background:${pctColor(clamp)}" data-w="${clamp}"></div>
            </div>
            <div class="text-xs font-bold text-slate-700 w-28 text-right flex-shrink-0">${count} ครั้ง (${clamp}%)</div>
        </div>`;
      })
      .join("");
  } else {
    // fallback: คำนวณจาก bookings ในหน่วยความจำ โดยหารด้วย approved
    roomRows = rooms
      .map((r) => {
        const cnt = bookings.filter(
          (b) => b.room?.room_id === r.room_id && b.status === "Approved",
        ).length;
        const pct2 = approved ? Math.round((cnt / approved) * 100) : 0;
        const clamp = Math.min(pct2, 100);
        return `
        <div class="flex items-center gap-3">
            <div class="text-xs font-bold text-slate-600 w-24 flex-shrink-0 truncate">${r.room_code}</div>
            <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="util-bar h-full rounded-full transition-all duration-500" style="width:0%;background:${pctColor(clamp)}" data-w="${clamp}"></div>
            </div>
            <div class="text-xs font-bold text-slate-700 w-24 text-right flex-shrink-0">${cnt} ครั้ง (${clamp}%)</div>
        </div>`;
      })
      .join("");
  }

  return `
<div class="p-6 sm:p-8">
    <header class="mb-6 flex flex-wrap justify-between items-start gap-4">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">รายงานสถิติระบบ</h2>
            <p class="text-slate-500 text-sm mt-0.5">สรุปภาพรวมและสถิติการใช้บริการห้องเรียนทั้งหมดในระบบ</p>
        </div>
        <div class="flex gap-2 flex-wrap items-center">
            <button onclick="openExportModal()"
                class="px-5 py-2.5 text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2 hover:opacity-90 transition-all bg-indigo-600">
                <span class="material-symbols-outlined text-[18px]">download</span>ดาวน์โหลดรายงานแบบละเอียด
            </button>
        </div>
    </header>

    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[24px] text-slate-400">calendar_month</span>
            <div>
                <p class="text-sm font-bold text-slate-700">ส่งออกรายงานรายเดือน</p>
                <p class="text-xs text-slate-400">เลือกช่วงเดือนและดาวน์โหลดไฟล์ได้ทันที</p>
            </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <select id="rptMonthSel" onchange="rptUpdateMonth()"
                class="px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-primary cursor-pointer w-full md:w-auto">
            </select>
            <button onclick="rptExport('csv')"
                class="px-4 py-2 border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-100 flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px]">csv</span>ดาวน์โหลด CSV
            </button>
            <button onclick="rptExport('excel')"
                class="px-4 py-2 border border-emerald-100 bg-emerald-50 text-emerald-700 font-bold rounded-xl text-xs hover:bg-emerald-100 flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px]">table</span>ดาวน์โหลด Excel
            </button>
        </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
            <div class="text-3xl font-black text-slate-800 mb-1">${total}</div>
            <div class="text-xs text-slate-500 font-medium">คำขอจองทั้งหมด</div>
        </div>
         <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
            <div class="text-3xl font-black text-amber-500 mb-1">${pending}</div>
            <div class="text-xs text-slate-500 font-medium">รออนุมัติ</div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
            <div class="text-3xl font-black text-emerald-600 mb-1">${approved}</div>
            <div class="text-xs text-slate-500 font-medium">อนุมัติแล้ว</div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
            <div class="text-3xl font-black mb-1" style="color:#7e0000">${pct}%</div>
            <div class="text-xs text-slate-500 font-medium">อัตราการอนุมัติ</div>
        </div>
    </div>

    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 class="font-bold text-slate-700">สัดส่วนการใช้งานรายห้อง จากห้องที่ได้รับอนุมัติทั้งหมด</h3>
            <div class="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#94a3b8"></span>&lt;15%</span>
                <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#10b981"></span>15–29%</span>
                <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#f59e0b"></span>30–49%</span>
                <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#dc2626"></span>50–74%</span>
                <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:#7e0000"></span>≥75%</span>
            </div>
        </div>
        <div class="space-y-3">${roomRows}</div>
    </div>
</div>`;
}

function animateUtilBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".util-bar[data-w]").forEach((el) => {
      el.style.width = el.dataset.w + "%";
    });
  });
}

function buildMonthOptions() {
  const now = new Date();
  const sel = document.getElementById("rptMonthSel");
  if (!sel) return;

  let html = "";
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const val = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = `${LOCAL_MONTHS_TH[m]} ${y + 543}`;
    html += `<option value="${val}" ${i === 0 ? "selected" : ""}>${label}</option>`;
  }
  sel.innerHTML = html;
  rptMonth = sel.value;
  animateUtilBars();
}

function rptUpdateMonth() {
  const sel = document.getElementById("rptMonthSel");
  if (sel) rptMonth = sel.value;
}

function rptExport(format) {
  const [year, month] = rptMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const dateFrom = `${rptMonth}-01`;
  const dateTo = `${rptMonth}-${String(lastDay).padStart(2, "0")}`;
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  window.location.href = `/api/reports/export/${format}/?${params}`;
}

function openExportModal() {
  expSetRange("this_month");
  expSetPurpose("all");

  const statusEl = document.getElementById("expStatus");
  if (statusEl) statusEl.value = "";

  const progEl = document.getElementById("expProgramType");
  if (progEl) progEl.value = "";

  populateExportRooms();
  expUpdateSummary();

  const modal = document.getElementById("exportModal");
  if (modal) modal.classList.remove("hidden");
}

function populateExportRooms() {
  const sel = document.getElementById("expRoomId");
  if (!sel) return;
  sel.innerHTML =
    '<option value="">ทุกห้อง</option>' +
    rooms
      .map(
        (r) =>
          `<option value="${r.room_id}">${r.room_name} (${r.room_code})</option>`,
      )
      .join("");
}

function expSetRange(preset) {
  const now = new Date();
  let from, to;
  if (preset === "this_month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (preset === "last_month") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (preset === "this_year") {
    from = new Date(now.getFullYear(), 0, 1);
    to = new Date(now.getFullYear(), 11, 31);
  } else {
    const fromEl = document.getElementById("expDateFrom");
    const toEl = document.getElementById("expDateTo");
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";
    expUpdateSummary();
    return;
  }

  const fmt = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fromEl = document.getElementById("expDateFrom");
  const toEl = document.getElementById("expDateTo");
  if (fromEl) fromEl.value = fmt(from);
  if (toEl) toEl.value = fmt(to);
  expUpdateSummary();
}

function expSetPurpose(val) {
  expPurpose = val;
  const map = {
    all: "expPurpAll",
    teaching: "expPurpTeach",
    training: "expPurpTrain",
  };

  Object.values(map).forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.className =
        "flex flex-col items-center gap-1 p-3 border-2 rounded-xl cursor-pointer transition-all border-slate-200";
      const icon = el.querySelector(".material-symbols-outlined");
      if (icon) {
        icon.className = "material-symbols-outlined text-[20px] text-slate-400";
        icon.style.color = "";
      }
    }
  });

  const targetEl = document.getElementById(map[val]);
  if (targetEl) {
    targetEl.className =
      "flex flex-col items-center gap-1 p-3 border-2 rounded-xl cursor-pointer transition-all border-red-800 bg-red-50";
    const targetIcon = targetEl.querySelector(".material-symbols-outlined");
    if (targetIcon) targetIcon.style.color = "#7e0000";
  }
  expUpdateSummary();
}

function expUpdateSummary() {
  const fromEl = document.getElementById("expDateFrom");
  const toEl = document.getElementById("expDateTo");
  const statusEl = document.getElementById("expStatus");
  const progEl = document.getElementById("expProgramType");
  const roomSelEl = document.getElementById("expRoomId");

  const from = fromEl ? fromEl.value : "";
  const to = toEl ? toEl.value : "";
  const status = statusEl ? statusEl.value : "";
  const programType = progEl ? progEl.value : "";
  const roomId = roomSelEl ? roomSelEl.value : "";

  const purposeLabel = {
    all: "ทั้งหมด",
    teaching: "สอนเท่านั้น",
    training: "อบรมเท่านั้น",
  }[expPurpose];
  const parts = [];
  if (from && to) parts.push(`📅 ${from} ถึง ${to}`);
  else if (!from && !to) parts.push("📅 ทุกช่วงเวลา");

  parts.push(`📋 ประเภท: ${purposeLabel}`);
  if (status) parts.push(`🔖 สถานะ: ${status}`);
  if (programType) parts.push(`🎓 หลักสูตร: ${programType}`);
  if (roomId) {
    const r = rooms.find((x) => String(x.room_id) === String(roomId));
    if (r) parts.push(`🚪 ห้อง: ${r.room_code}`);
  }

  const summaryEl = document.getElementById("expSummary");
  if (summaryEl) summaryEl.innerHTML = parts.join(" &nbsp;·&nbsp; ");
}

function triggerExportWithFormat() {
  const csvEl = document.getElementById("chkCSV");
  const excelEl = document.getElementById("chkExcel");
  const isCSV = csvEl ? csvEl.checked : false;
  const isExcel = excelEl ? excelEl.checked : false;

  if (!isCSV && !isExcel) {
    alert("กรุณาเลือกรูปแบบไฟล์อย่างน้อย 1 ประเภทครับ");
    return;
  }

  const fromEl = document.getElementById("expDateFrom");
  const toEl = document.getElementById("expDateTo");
  const statusEl = document.getElementById("expStatus");
  const progEl = document.getElementById("expProgramType");
  const roomSelEl = document.getElementById("expRoomId");

  const from = fromEl ? fromEl.value : "";
  const to = toEl ? toEl.value : "";
  const status = statusEl ? statusEl.value : "";
  const programType = progEl ? progEl.value : "";
  const roomId = roomSelEl ? roomSelEl.value : "";

  const params = new URLSearchParams();
  if (from) params.set("date_from", from);
  if (to) params.set("date_to", to);
  if (expPurpose !== "all") params.set("purpose_type", expPurpose);
  if (status) params.set("status", status);
  if (programType) params.set("program_type", programType);
  if (roomId) params.set("room_id", roomId);

  closeModals();

  if (isCSV) {
    showToast("กำลังส่งออกไฟล์ CSV...", "download");
    window.location.href = `/api/reports/export/csv/?${params}`;
  }

  if (isExcel) {
    if (isCSV) {
      setTimeout(() => {
        showToast("กำลังส่งออกไฟล์ Excel...", "download");
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = `/api/reports/export/excel/?${params}`;
        document.body.appendChild(iframe);
        setTimeout(() => document.body.removeChild(iframe), 3000);
      }, 1500);
    } else {
      showToast("กำลังส่งออกไฟล์ Excel...", "download");
      window.location.href = `/api/reports/export/excel/?${params}`;
    }
  }
}

window.rptUpdateMonth = rptUpdateMonth;
window.rptExport = rptExport;
window.openExportModal = openExportModal;
window.expSetRange = expSetRange;
window.expSetPurpose = expSetPurpose;
window.expUpdateSummary = expUpdateSummary;
window.triggerExportWithFormat = triggerExportWithFormat;
