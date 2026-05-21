/**
 * admin.js — ECE Room Booking admin panel
 *
 * All data is fetched from the REST API.  No hard-coded mock arrays.
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════
// STATE & CONFIG
// ═══════════════════════════════════════════════════════════════════
let rooms = []; // GET /api/admin/req/room/
let bookings = []; // GET /api/admin/bookings/
let reportsSummary = null; // GET /api/reports/summary/

let curView = "dashboard";
let curActionId = null;
let curDetailId = null; // สถานะสำหรับเก็บ ID รายละเอียดที่เปิดค้างอยู่
let cancelGroupId = null; // สถานะเก็บรหัสกลุ่มสำหรับยกเลิกแบบกลุ่ม
let calDate = new Date();
let calRoomFilter = "all";

// ใช้ชื่อเฉพาะ LOCAL_MONTHS_TH เพื่อป้องกัน SyntaxError ชนกับตัวแปร Global
const LOCAL_MONTHS_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  let user = {};

  try {
    user = await api.get(`/api/auth/me/?_t=${Date.now()}`);
  } catch (err) {
    console.error("Failed to load admin user info from /api/auth/me/:", err);
    user = window.ECE_USER || {};
  }

  const displayName = user.displayname_th || user.username || "—";

  const sideNameEl = document.getElementById("sideUserName");
  if (sideNameEl) sideNameEl.textContent = displayName;

  const topNameEl = document.getElementById("topUserName");
  if (topNameEl) topNameEl.textContent = displayName;

  await Promise.all([loadRooms(), loadBookings()]);
  go("dashboard");

  // เริ่มระบบอัปเดตข้อมูลแบบ Realtime ฝั่งแอดมิน
  startRealtimePolling();
});

function doLogout() {
  window.location.href = "/logout/";
}

// ═══════════════════════════════════════════════════════════════════
// DATA LOADERS
// ═══════════════════════════════════════════════════════════════════
async function loadRooms() {
  try {
    rooms = (await api.get("/api/admin/req/room/")) || [];
  } catch (err) {
    showApiError(err);
  }
}

async function loadBookings(statusFilter = "") {
  try {
    const q = statusFilter ? `?status=${statusFilter}` : "";
    bookings = (await api.get(`/api/admin/bookings/${q}`)) || [];
  } catch (err) {
    showApiError(err);
  }
}

async function loadReportsSummary() {
  try {
    reportsSummary = await api.get(`/api/reports/summary/?_t=${Date.now()}`);
  } catch (err) {
    console.error("Failed to load summary statistics from API:", err);
    reportsSummary = null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// REALTIME BACKGROUND SYNC (POLLING)
// ═══════════════════════════════════════════════════════════════════
let pollingInterval = null;

function startRealtimePolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    if (document.hidden) return; // ไม่ทำงานเบื้องหลังหากย่อหน้าจออยู่
    await refreshAdminDataSilent();
  }, 30000); // ทำการดึงข้อมูลใหม่ทุกๆ 30 วินาที
}

function isAnyModalOpen() {
  const modals = [
    "approveModal",
    "rejectModal",
    "roomModal",
    "dayModal",
    "cancelModal",
    "cancelGroupModal",
    "exportModal",
  ];
  return modals.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains("hidden");
  });
}

async function refreshAdminDataSilent() {
  try {
    const [roomsData, bookingsData] = await Promise.all([
      api.get("/api/admin/req/room/"),
      api.get("/api/admin/bookings/"),
    ]);

    rooms = roomsData || [];
    bookings = bookingsData || [];

    updatePendingBadge();

    if (!isAnyModalOpen()) {
      if (curView === "reports") {
        await loadReportsSummary();
      }

      if (
        curView === "dashboard" ||
        curView === "approvals" ||
        curView === "all-bookings" ||
        curView === "detail" ||
        curView === "reports"
      ) {
        const app = document.getElementById("app");
        if (app) {
          app.innerHTML = `<div class="view-enter">${render()}</div>`;
          if (curView === "reports") {
            buildMonthOptions();
          }
        }
      } else if (curView === "calendar") {
        calRender();
      }
    }
  } catch (err) {
    console.error("Silent background refresh failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════
async function go(v) {
  curView = v;
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.className = `nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${el.dataset.view === v ? "nav-active" : "text-slate-600"}`;
  });
  updatePendingBadge();

  if (v === "reports") {
    await loadReportsSummary();
  }

  const app = document.getElementById("app");
  app.innerHTML = `<div class="view-enter">${render()}</div>`;
  app.scrollTop = 0;

  if (v === "calendar") initCalendar();
  if (v === "reports") {
    buildMonthOptions();
  }
}

function render() {
  switch (curView) {
    case "dashboard":
      return vDashboard();
    case "approvals":
      return vApprovals();
    case "all-bookings":
      return vAllBookings();
    case "rooms":
      return vRooms();
    case "reports":
      return vReports();
    case "calendar":
      return vCalendar();
    case "detail":
      return vDetailAdmin();
  }
  return "";
}

function updatePendingBadge() {
  const badge = document.getElementById("pendingBadge");
  const n = bookings.filter((b) => b.status === "Pending").length;
  if (badge) {
    badge.textContent = n || "";
    badge.style.display = n ? "" : "none";
  }
}

function viewDetailAdmin(id) {
  curDetailId = id;
  go("detail");
}
window.viewDetailAdmin = viewDetailAdmin;

// ═══════════════════════════════════════════════════════════════════
// VIEW: DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function vDashboard() {
  const pending = bookings.filter((b) => b.status === "Pending").length;
  const approved = bookings.filter((b) => b.status === "Approved").length;
  const rejected = bookings.filter((b) => b.status === "Rejected").length;
  const activeRooms = rooms.filter((r) => r.is_active !== false).length;

  const stats = [
    {
      icon: "pending_actions",
      label: "รออนุมัติ",
      val: pending,
      color: "#f59e0b",
      bg: "#fef9c3",
      action: "go('approvals')",
    },
    {
      icon: "check_circle",
      label: "อนุมัติแล้ว",
      val: approved,
      color: "#10b981",
      bg: "#d1fae5",
      action: null,
    },
    {
      icon: "cancel",
      label: "ไม่อนุมัติ",
      val: rejected,
      color: "#ef4444",
      bg: "#fee2e2",
      action: null,
    },
    {
      icon: "meeting_room",
      label: "ห้องเปิดใช้",
      val: `${activeRooms}/${rooms.length}`,
      color: "#7e0000",
      bg: "#fff1f2",
      action: "go('rooms')",
    },
  ];

  const statHtml = stats
    .map(
      (s) => `
<div class="stat-card bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${s.action ? "cursor-pointer" : ""}"
     ${s.action ? `onclick="${s.action}"` : ""}>
    <div class="flex items-start justify-between mb-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${s.bg}">
            <span class="material-symbols-outlined text-[22px]" style="color:${s.color}">${s.icon}</span>
        </div>
        ${s.action ? `<span class="material-symbols-outlined text-slate-300 text-[16px]">chevron_right</span>` : ""}
    </div>
    <div class="text-2xl font-black text-slate-800">${s.val}</div>
    <div class="text-xs text-slate-500 font-medium mt-0.5">${s.label}</div>
</div>`,
    )
    .join("");

  const pendingList = bookings
    .filter((b) => b.status === "Pending")
    .slice(0, 5);

  const pendingRows =
    pendingList.length === 0
      ? `<tr><td colspan="5" class="text-center py-8 text-slate-400 text-sm">ไม่มีรายการรออนุมัติ</td></tr>`
      : pendingList
          .map((b) => {
            const start = thaiDateShort(b.start_datetime);
            const ts = timeFromISO(b.start_datetime),
              te = timeFromISO(b.end_datetime);
            return `
<tr class="cursor-pointer hover:bg-slate-50 transition-colors" onclick="viewDetailAdmin(${b.booking_id})">
    <td><span class="text-xs text-slate-400">#${b.booking_id}</span></td>
    <td><div class="font-medium text-slate-800 text-xs">${b.booker?.displayname_th || "—"}</div></td>
    <td><div class="text-xs text-slate-700 font-bold">${b.room?.room_name} (${b.room?.room_code})</div>
        <div class="text-[11px] text-slate-400">${b.purpose_type} ${b.subject ? `· ${b.subject}` : ""}</div></td>
    <td class="text-xs text-slate-600">${start} · ${ts}–${te}</td>
    <td>
        <div class="flex gap-1.5 flex-wrap">
            <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-90" style="background:#10b981">อนุมัติ</button>
            <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100">ปฏิเสธ</button>
        </div>
    </td>
</tr>`;
          })
          .join("");

  const recentAll = [...bookings].reverse().slice(0, 4);
  const activityHtml = recentAll
    .map((b) => {
      const statusClean = b.status?.trim() || "";
      const clr =
        {
          Pending: "#f59e0b",
          Approved: "#10b981",
          Rejected: "#ef4444",
          Cancelled: "#64748b",
        }[statusClean] || "#64748b";

      const lbl =
        {
          Pending: "ส่งคำขอจอง",
          Approved: "ได้รับการอนุมัติ",
          Rejected: "ถูกปฏิเสธ",
          Cancelled: "ยกเลิกการจองแล้ว",
        }[statusClean] || "ยกเลิกการจองแล้ว";

      const created = b.created_at ? thaiDateShort(b.created_at) : "";
      return `<div class="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all" onclick="viewDetailAdmin(${b.booking_id})">
    <div class="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style="background:${clr}"></div>
    <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-slate-700 truncate">${b.booker?.displayname_th || "—"} — ${lbl}</p>
        <p class="text-[11px] text-slate-400 truncate">${b.room?.room_name || ""} · ${thaiDateShort(b.start_datetime)}</p>
    </div>
    <span class="text-[10px] text-slate-400 flex-shrink-0">${created}</span>
</div>`;
    })
    .join("");

  return `
<div class="p-6 sm:p-8">
    <div class="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">แดชบอร์ดเจ้าหน้าที่</h2>
            <p class="text-slate-500 text-sm mt-0.5">ภาพรวมระบบจองห้อง ณ วันนี้</p>
        </div>
        <button onclick="Promise.all([loadRooms(),loadBookings()]).then(()=>go('dashboard'))"
            class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
            <span class="material-symbols-outlined text-[16px]">refresh</span>รีเฟรช
        </button>
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">${statHtml}</div>
    
    <div class="space-y-6">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
            <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-amber-500 text-[18px]">pending_actions</span>
                    <h3 class="font-bold text-slate-800 text-sm">รายการรออนุมัติ</h3>
                </div>
                <button onclick="go('approvals')" class="text-xs font-bold hover:underline" style="color:#7e0000">ดูทั้งหมด →</button>
            </div>
            <div class="overflow-x-auto">
                <table class="data-table w-full">
                    <thead><tr><th>ID</th><th>ผู้จอง</th><th>ห้อง / วัตถุประสงค์</th><th>วันเวลา</th><th>การจัดการ</th></tr></thead>
                    <tbody>${pendingRows}</tbody>
                </table>
            </div>
        </div>
        
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 w-full">
            <h3 class="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <span class="material-symbols-outlined text-slate-400 text-[18px]">history</span> กิจกรรมล่าสุด
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">${activityHtml || '<p class="text-xs text-slate-400 col-span-4 text-center py-4">ยังไม่มีกิจกรรม</p>'}</div>
        </div>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: APPROVALS
// ═══════════════════════════════════════════════════════════════════
function vApprovals() {
  const pending = bookings.filter((b) => b.status === "Pending");
  const groupedCardsHtml = buildAdminPendingBookingsHtml(pending);

  return `
<div class="p-6 sm:p-8 max-w-4xl">
    <header class="mb-6">
        <h2 class="text-2xl font-bold text-slate-800">รายการรออนุมัติ</h2>
        <p class="text-slate-500 text-sm mt-0.5">มี ${pending.length} รายการรอการดำเนินการ</p>
    </header>
    <div class="space-y-4">${groupedCardsHtml}</div>
</div>`;
}

function buildAdminPendingBookingsHtml(pendingList) {
  if (pendingList.length === 0) {
    return `
      <div class="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <span class="material-symbols-outlined text-5xl block mb-2">check_circle</span>
          <p class="font-medium">ไม่มีรายการรอการอนุมัติ</p>
      </div>`;
  }

  const groupedList = [];
  const seenGroups = {};

  pendingList.forEach((b) => {
    const gid = b.recurring_group_id;
    if (!gid) {
      groupedList.push({ type: "single", booking: b });
    } else {
      if (!seenGroups[gid]) {
        seenGroups[gid] = {
          type: "group",
          groupId: gid,
          room_name: b.room?.room_name || b.room_name || "—",
          room_code: b.room?.room_code || b.room_code || "—",
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
        const ts = timeFromISO(b.start_datetime);
        const te = timeFromISO(b.end_datetime);

        return `
<div class="bg-white border border-slate-200 border-l-4 ${borderMap[b.status] || "border-l-slate-300"} rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-slate-300 hover:shadow transition-all"
     onclick="viewDetailAdmin(${b.booking_id})">
    <div class="flex-1 space-y-1.5 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="badge-pending px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[11px]">pending</span>รออนุมัติ
            </span>
            <span class="text-slate-400 text-xs">#${b.booking_id}</span>
        </div>
        <h3 class="font-bold text-slate-800">${b.room?.room_name} (${b.room?.room_code})</h3>
        <p class="text-sm text-slate-600">ผู้จอง: ${b.booker?.displayname_th || "—"}</p>
        <p class="text-sm text-slate-600">วัตถุประสงค์: ${b.purpose_type} ${b.subject ? `(${b.subject})` : ""}</p>
        <div class="flex gap-3 text-xs text-slate-500 flex-wrap">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te}</span>
        </div>
        ${b.additional_requests ? `<p class="text-xs text-slate-500 italic">"${b.additional_requests}"</p>` : ""}
    </div>
    <div class="flex flex-col gap-2 flex-shrink-0 min-w-[140px]">
        <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
            class="px-5 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            style="background:#10b981">
            <span class="material-symbols-outlined text-[16px]">check_circle</span>อนุมัติ
        </button>
        <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
            class="px-5 py-2 rounded-xl font-bold text-sm text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-2 transition-all">
            <span class="material-symbols-outlined text-[16px]">cancel</span>ปฏิเสธ
        </button>
    </div>
</div>`;
      } else {
        const g = item;
        const canCancelAnyGroup = g.bookings.some(
          (b) => b.status === "Pending" || b.status === "Approved",
        );

        const sortedBookings = [...g.bookings].sort(
          (x, y) => new Date(x.start_datetime) - new Date(y.start_datetime),
        );
        const minDateStr = thaiDateShort(sortedBookings[0].start_datetime);
        const maxDateStr = thaiDateShort(
          sortedBookings[sortedBookings.length - 1].start_datetime,
        );
        const ts = timeFromISO(g.bookings[0].start_datetime);
        const te = timeFromISO(g.bookings[0].end_datetime);

        const slotsHtml = sortedBookings
          .map((b) => {
            const start = thaiDateShort(b.start_datetime);
            const tsSlot = timeFromISO(b.start_datetime);
            const teSlot = timeFromISO(b.end_datetime);

            return `
<div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white border border-slate-150 gap-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
     onclick="event.stopPropagation(); viewDetailAdmin(${b.booking_id})">
    <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-400">#${b.booking_id}</span>
            <span class="badge-pending px-2 py-0.5 rounded-full text-[10px] font-bold">Pending</span>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${tsSlot} – ${teSlot} น.</span>
        </div>
        ${b.additional_requests ? `<p class="text-xs text-slate-500 italic">"${b.additional_requests}"</p>` : ""}
    </div>
    <div class="flex-shrink-0 self-end sm:self-center flex gap-2">
        <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
            class="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg font-bold text-[10px] hover:bg-emerald-600 transition-all">
            อนุมัติ
        </button>
        <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
            class="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-[10px] hover:bg-red-100 border border-red-100 transition-all">
            ปฏิเสธ
        </button>
    </div>
</div>`;
          })
          .join("");

        return `
<details class="bg-white border border-slate-200 border-l-4 border-l-indigo-500 rounded-xl shadow-sm overflow-hidden group/details">
    <summary class="p-5 cursor-pointer list-none flex flex-col md:flex-row md:items-center justify-between gap-4 select-none outline-none [&::-webkit-details-marker]:hidden">
        <div class="flex-1 space-y-2 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wider">กลุ่มรออนุมัติ #${g.groupId}</span>
                <span class="text-slate-400 text-xs font-semibold">มีรายการจองต่อเนื่องทั้งหมด ${g.bookings.length} วัน</span>
            </div>
            <h3 class="text-base font-bold text-slate-800 truncate">${g.room_name} (${g.room_code})</h3>
            <p class="text-sm text-slate-600">ผู้จอง: ${sortedBookings[0].booker?.displayname_th || "—"}</p>
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

// ═══════════════════════════════════════════════════════════════════
// VIEW: ALL BOOKINGS
// ═══════════════════════════════════════════════════════════════════
function vAllBookings() {
  const statusMap = {
    Pending: "badge-pending",
    Approved: "badge-approved",
    Rejected: "badge-rejected",
    Cancelled: "badge-rejected",
  };

  const rows = bookings
    .map((b) => {
      const start = thaiDateShort(b.start_datetime);
      const ts = timeFromISO(b.start_datetime),
        te = timeFromISO(b.end_datetime);

      const rejectNote =
        b.reject_reason && b.reject_reason.trim()
          ? `<div class="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-1 font-medium max-w-xs">
            <strong>เหตุผลปฏิเสธ:</strong> ${b.reject_reason}
           </div>`
          : "";

      const approveNote =
        b.admin_notes && b.admin_notes.trim()
          ? `<div class="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mt-1 font-medium max-w-xs">
            <strong>หมายเหตุ:</strong> ${b.admin_notes}
           </div>`
          : "";

      return `
<tr class="cursor-pointer hover:bg-slate-50 transition-colors" onclick="viewDetailAdmin(${b.booking_id})">
    <td><span class="text-xs text-slate-400">#${b.booking_id}</span></td>
    <td class="font-medium text-slate-800 text-xs">${b.booker?.displayname_th || "—"}</td>
    <td>
        <div class="text-xs text-slate-700 font-bold">${b.room?.room_name}</div>
        <div class="text-[11px] text-slate-400">${b.room?.room_code}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">วัตถุประสงค์: ${b.purpose_type} ${b.subject ? `(${b.subject})` : ""}</div>
        ${rejectNote}
        ${approveNote}
    </td>
    <td class="text-xs text-slate-600">${start}<br>${ts}–${te}</td>
    <td><span class="${statusMap[b.status] || "badge-pending"} px-2 py-0.5 rounded-full text-[10px] font-bold">${b.status}</span></td>
    <td>
        <div class="flex gap-1.5 flex-wrap">
            ${
              b.status === "Pending"
                ? `
            <button onclick="event.stopPropagation(); openApprove(${b.booking_id})" class="px-2.5 py-1 rounded text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">อนุมัติ</button>
            <button onclick="event.stopPropagation(); openReject(${b.booking_id})"  class="px-2.5 py-1 rounded text-[10px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">ปฏิเสธ</button>
            `
                : ""
            }
        </div>
    </td>
</tr>`;
    })
    .join("");

  return `
<div class="p-6 sm:p-8">
    <header class="mb-5">
        <h2 class="text-2xl font-bold text-slate-800">รายการจองทั้งหมด</h2>
        <p class="text-slate-500 text-sm mt-0.5">ทั้งหมด ${bookings.length} รายการ</p>
    </header>
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
            <table class="data-table w-full">
                <thead><tr><th>ID</th><th>ผู้จอง</th><th>ห้อง</th><th>วันเวลา</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="6" class="text-center py-8 text-slate-400">ไม่มีข้อมูล</td></tr>'}</tbody>
            </table>
        </div>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: DETAILED BOOKING
// ═══════════════════════════════════════════════════════════════════
function vDetailAdmin() {
  const b = bookings.find(
    (x) =>
      x.booking_id === Number(curDetailId) ||
      String(x.booking_id) === String(curDetailId),
  );
  if (!b) {
    return `
    <div class="p-6 sm:p-8 text-center text-slate-400">
        <span class="material-symbols-outlined text-5xl block mb-2">search_off</span>
        ไม่พบข้อมูลการจอง
    </div>`;
  }

  const sCfg = {
    Pending: {
      bar: "bg-amber-100 border-amber-200 text-amber-700",
      label: "รออนุมัติ (Pending)",
      ping: true,
    },
    Approved: {
      bar: "bg-green-100 border-green-200 text-green-700",
      label: "อนุมัติแล้ว (Approved)",
      ping: false,
    },
    Rejected: {
      bar: "bg-red-100 border-red-200 text-red-700",
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

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div class="flex items-center gap-3">
            <button onclick="go('all-bookings')"
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
                    <div><p class="text-xs text-slate-400 font-bold mb-1">ห้อง</p><p class="font-bold text-slate-800">${b.room?.room_name || "—"} (${b.room?.room_code || "—"})</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">ผู้จอง</p><p class="font-bold text-slate-800">${b.booker?.displayname_th || "—"}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วัตถุประสงค์</p><p class="font-medium">${b.purpose_type}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">เวลา</p><p class="font-medium">${ts} – ${te} น.</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วันที่เริ่มต้น</p><p class="font-medium">${start}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วันที่สิ้นสุด</p><p class="font-medium">${end}</p></div>
                    ${b.subject ? `<div class="col-span-2"><p class="text-xs text-slate-400 font-bold mb-1">วิชา / หัวข้อ</p><p class="font-medium">${b.subject}</p></div>` : ""}
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
              b.status === "Pending"
                ? `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4">การดำเนินการ</h3>
                <button onclick="openApprove(${b.booking_id})"
                    class="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all"
                    style="background:#10b981">
                    <span class="material-symbols-outlined text-[18px]">check_circle</span>อนุมัติการจอง
                </button>
                <button onclick="openReject(${b.booking_id})"
                    class="w-full py-3 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    <span class="material-symbols-outlined text-[18px]">cancel</span>ปฏิเสธการจอง
                </button>
            </div>`
                : `
            <div class="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center text-slate-500">
                <span class="material-symbols-outlined text-4xl block mb-2">lock</span>
                <p class="text-xs font-bold uppercase tracking-wider">ปิดการดำเนินการ</p>
                <p class="text-xs text-slate-400 mt-1">รายการนี้ได้รับการประมวลผลแล้ว</p>
            </div>`
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
// VIEW: ROOMS
// ═══════════════════════════════════════════════════════════════════
function vRooms() {
  const cards = rooms
    .map(
      (r) =>
        `
<div class="room-card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
    <div class="h-32 relative bg-slate-100">
        ${r.room_image ? `<img src="${r.room_image}" class="absolute inset-0 w-full h-full object-cover">` : ""}
        <div class="absolute inset-0 flex items-end p-3" style="background:linear-gradient(to top,rgba(0,0,0,.5),transparent)">
            <span class="text-white font-bold text-sm">${r.room_code}</span>
        </div>
        <div class="absolute top-2 right-2">
            <span class="${r.is_active !== false ? "badge-approved" : "badge-rejected"} px-2 py-0.5 rounded-full text-[10px] font-bold">
                ${r.is_active !== false ? "เปิดใช้งาน" : "ปิดชั่วคราว"}
            </span>
        </div>
    </div>
    <div class="p-4">
        <h3 class="font-bold text-slate-800">${r.room_name}</h3>
        <div class="flex gap-3 text-xs text-slate-500 mt-1">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">groups</span>${r.capacity} ที่นั่ง</span>
            <span>${r.room_type}</span>
        </div>
        <div class="flex gap-2 mt-3">
            <button onclick="openEditRoom(${r.room_id})"
                class="flex-1 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[14px]">edit</span>แก้ไข
            </button>
            <button onclick="toggleRoomActive(${r.room_id}, ${r.is_active !== false})"
                class="flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 ${r.is_active !== false ? "text-red-600 border border-red-100 bg-red-50 hover:bg-red-100" : "text-emerald-600 border border-emerald-100 bg-emerald-50 hover:bg-emerald-100"}">
                <span class="material-symbols-outlined text-[14px]">${r.is_active !== false ? "block" : "check_circle"}</span>
                ${r.is_active !== false ? "ปิดชั่วคราว" : "เปิดใช้งาน"}
            </button>
        </div>
    </div>
</div>`,
    )
    .join("");

  return `
<div class="p-6 sm:p-8">
    <div class="flex justify-between items-center mb-6">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">จัดการห้อง</h2>
            <p class="text-slate-500 text-sm mt-0.5">ทั้งหมด ${rooms.length} ห้อง</p>
        </div>
        <button onclick="openAddRoom()"
            class="px-5 py-2.5 text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2 hover:opacity-90"
            style="background:#7e0000">
            <span class="material-symbols-outlined text-[17px]">add</span>เพิ่มห้องใหม่
        </button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cards || '<p class="text-slate-400 col-span-3 text-center py-16">ไม่มีห้อง</p>'}</div>
</div>`;
}

async function toggleRoomActive(roomId, currentlyActive) {
  try {
    await api.patch(`/api/admin/req/room/${roomId}/`, {
      is_active: !currentlyActive,
    });
    await loadRooms();
    go("rooms");
    showToast(
      !currentlyActive ? "เปิดใช้งานห้องแล้ว" : "ปิดห้องชั่วคราวแล้ว",
      "check_circle",
    );
  } catch (err) {
    showApiError(err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: REPORTS (หน้ารายงานสถิติที่ประมวลค่าจาก JSON จริงของเซิร์ฟเวอร์)
// ═══════════════════════════════════════════════════════════════════
function vReports() {
  const statsSrc = reportsSummary?.statistics || {};

  // อัปเดตการอ่านค่าสถิติจากโครงสร้าง JSON API ของรายงานรวม
  const total = statsSrc.total_bookings ?? bookings.length;
  const approved =
    statsSrc.by_status?.Approved ??
    bookings.filter((b) => b.status === "Approved").length;
  const pending =
    statsSrc.by_status?.Pending ??
    bookings.filter((b) => b.status === "Pending").length;
  const pct = total ? Math.round((approved / total) * 100) : 0;

  // วาดแท่งสัดส่วนรายห้องจากข้อมูล by_room ของระบบหลังบ้านโดยตรง (มีระบบ Fallback ในกรณีที่ API ดึงสถิติไม่สำเร็จ)
  let roomRows = "";
  if (statsSrc.by_room && Array.isArray(statsSrc.by_room)) {
    roomRows = statsSrc.by_room
      .map((r) => {
        const count = r.booking_count || 0;
        const pct2 = total ? Math.round((count / total) * 105) : 0; // รักษาอัตราส่วนเพื่อความสวยงาม
        const renderPct = pct2 > 100 ? 100 : pct2;
        return `
        <div class="flex items-center gap-3">
            <div class="text-xs font-bold text-slate-600 w-24 flex-shrink-0 truncate" title="${r.room_name}">${r.room_code}</div>
            <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="util-bar h-full rounded-full transition-all duration-500" style="width:0%;background:${renderPct > 60 ? "#7e0000" : renderPct > 40 ? "#f59e0b" : "#10b981"}" data-w="${renderPct}"></div>
            </div>
            <div class="text-xs font-bold text-slate-700 w-28 text-right flex-shrink-0">${count} ครั้ง (${renderPct}%)</div>
        </div>`;
      })
      .join("");
  } else {
    // โครงสร้างประมวลผลสำรองฝั่ง Client
    roomRows = rooms
      .map((r) => {
        const cnt = bookings.filter(
          (b) => b.room?.room_id === r.room_id && b.status === "Approved",
        ).length;
        const pct2 = approved ? Math.round((cnt / approved) * 100) : 0;
        return `
        <div class="flex items-center gap-3">
            <div class="text-xs font-bold text-slate-600 w-24 flex-shrink-0 truncate">${r.room_code}</div>
            <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div class="util-bar h-full rounded-full transition-all duration-500" style="width:0%;background:${pct2 > 60 ? "#7e0000" : pct2 > 40 ? "#f59e0b" : "#10b981"}" data-w="${pct2}"></div>
            </div>
            <div class="text-xs font-bold text-slate-700 w-24 text-right flex-shrink-0">${cnt} ครั้ง (${pct2}%)</div>
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
                <span class="material-symbols-outlined text-[18px]">download</span>ส่งออกรายงานขั้นสูง
            </button>
        </div>
    </header>

    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-[24px] text-slate-400">calendar_month</span>
            <div>
                <p class="text-sm font-bold text-slate-700">ส่งออกข้อมูลรายเดือนแบบรวดเร็ว</p>
                <p class="text-xs text-slate-400">เลือกช่วงเดือนที่ต้องการส่งออกและรับไฟล์ได้ทันที</p>
            </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <select id="rptMonthSel" onchange="rptUpdateMonth()"
                class="px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-primary cursor-pointer w-full md:w-auto">
                <!-- โหลดตัวเลือกเดือนแบบไดนามิก -->
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
        <h3 class="font-bold text-slate-700 mb-4">การใช้งานรายห้อง (คิดเป็นสัดส่วนต่อห้องทั้งหมดที่ได้รับการอนุมัติ)</h3>
        <div class="space-y-3">
            ${roomRows}
        </div>
    </div>
</div>`;
  setTimeout(() => {
    document
      .querySelectorAll("[data-w]")
      .forEach((el) => (el.style.width = el.dataset.w + "%"));
  }, 100);
}

// ═══════════════════════════════════════════════════════════════════
// REPORTS EXPORT & MODAL CONTROL (FR-RPT-03)
// ═══════════════════════════════════════════════════════════════════
let rptMonth = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();

function buildMonthOptions() {
  const now = new Date();
  const sel = document.getElementById("rptMonthSel");
  if (!sel) return;

  let html = "";
  // ลูปแสดงเฉพาะเดือนปัจจุบันและเดือนย้อนหลัง 12 เดือน (ไม่แสดงช่วงเวลาในอนาคต)
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

let expPurpose = "all";

// ฟังก์ชันเปิดโมดอลพร้อมโหลดรายชื่อห้องเรียนจริงเข้าสู่ตัวเลือก dropdown
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

// ผูกข้อมูลรายชื่อห้องเรียนจริงเข้าใน Dropdown ฝั่ง Export ขั้นสูง
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

  // จัดเรียงฟอร์แมตวันที่ทำงานตาม timezone ท้องถิ่นโดยไม่เกิดความเหลื่อมล้ำของโซนเวลา
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

// ตรวจสอบความปลอดภัยการเลือกปุ่มสัญลักษณ์ไม่ให้มี Null Pointer Reference
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
    if (targetIcon) {
      targetIcon.style.color = "#7e0000";
    }
  }
  expUpdateSummary();
}

// อัปเดตรายละเอียดและรายงานสรุปตัวคัดกรองพารามิเตอร์บนโมดอลให้ครบทุกมิติ
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

// อัปเดตการดึงค่าพารามิเตอร์ส่งคำขอขั้นสูงไปยังระบบ Export ตาม API หลังบ้าน
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

// ผูกฟังก์ชันแอดมินเข้ากับ window เพื่อความปลอดภัยในการเรียกใช้งานจากแบบฟอร์มภายนอก
window.rptUpdateMonth = rptUpdateMonth;
window.rptExport = rptExport;
window.openExportModal = openExportModal;
window.expSetRange = expSetRange;
window.expSetPurpose = expSetPurpose;
window.expUpdateSummary = expUpdateSummary;
window.triggerExportWithFormat = triggerExportWithFormat;

// ═══════════════════════════════════════════════════════════════════
// VIEW: CALENDAR
// ═══════════════════════════════════════════════════════════════════
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
  for (let i = 0; i < fd; i++)
    html += `<div class="cal-day p-2 border-r border-b border-slate-100 bg-slate-50/50"></div>`;
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

// ═══════════════════════════════════════════════════════════════════
// APPROVE / REJECT MODALS
// ═══════════════════════════════════════════════════════════════════
function openApprove(id) {
  curActionId = id;
  const b = bookings.find(
    (x) => x.booking_id === id || String(x.booking_id) === String(id),
  );
  if (!b) return;
  document.getElementById("approveDetail").innerHTML =
    `<strong>#${b.booking_id}</strong> — ${b.room?.room_name || b.room_name} (${b.room?.room_code || b.room_code})<br>
         ${b.booker?.displayname_th || "—"} · ${thaiDateShort(b.start_datetime)} ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;
  document.getElementById("approveNote").value = "";
  document.getElementById("approveModal").classList.remove("hidden");
}

function openReject(id) {
  curActionId = id;
  const b = bookings.find(
    (x) => x.booking_id === id || String(x.booking_id) === String(id),
  );
  if (!b) return;
  document.getElementById("rejectDetail").innerHTML =
    `<strong>#${b.booking_id}</strong> — ${b.room?.room_name || b.room_name} (${b.room?.room_code || b.room_code})<br>
         ${b.booker?.displayname_th || "—"} · ${thaiDateShort(b.start_datetime)} ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectModal").classList.remove("hidden");
}

function closeModals() {
  [
    "approveModal",
    "rejectModal",
    "roomModal",
    "dayModal",
    "cancelModal",
    "cancelGroupModal",
    "exportModal",
  ].forEach((id) => {
    document.getElementById(id)?.classList.add("hidden");
  });
}

async function doApprove() {
  const note = document.getElementById("approveNote").value.trim();
  closeModals();
  try {
    await api.patch(`/api/admin/bookings/${curActionId}/approve/`, {
      admin_notes: note,
    });
    await loadBookings();
    showToast("อนุมัติการจองเรียบร้อยแล้ว", "check_circle");
    go(curView);
  } catch (err) {
    showApiError(err);
  }
}

async function doReject() {
  const reason = document.getElementById("rejectReason").value.trim();
  if (!reason) {
    showToast("กรุณาระบุเหตุผล", "error");
    return;
  }
  closeModals();
  try {
    await api.patch(`/api/admin/bookings/${curActionId}/reject/`, {
      reject_reason: reason,
    });
    await loadBookings();
    showToast("ปฏิเสธการจองเรียบร้อยแล้ว", "cancel");
    go(curView);
  } catch (err) {
    showApiError(err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CANCEL GROUP MODAL (สำหรับเจ้าหน้าที่ดูแลระบบในการยกเลิกซีรีส์การจอง)
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
    await loadBookings();
    showToast("ยกเลิกการจองแบบกลุ่มเรียบร้อยแล้ว", "cancel");
    go(curView);
  } catch (err) {
    showApiError(err);
  }
}

window.openCancelGroupModal = openCancelGroupModal;
window.closeCancelGroupModal = closeCancelGroupModal;
window.doCancelGroupBooking = doCancelGroupBooking;

// ═══════════════════════════════════════════════════════════════════
// ROOM MODAL  (Add / Edit)
// ═══════════════════════════════════════════════════════════════════
let editRoomId = null;

function openAddRoom() {
  editRoomId = null;
  document.getElementById("roomModalTitle").textContent = "เพิ่มห้องใหม่";
  ["rmCode", "rmName", "rmSeats"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const imgEl = document.getElementById("rmImage");
  if (imgEl) imgEl.value = "";

  // ซ่อนปุ่มลบห้องเมื่อเป็นโหมดเพิ่มห้องใหม่
  const btnDelete = document.getElementById("btnDeleteRoom");
  if (btnDelete) btnDelete.classList.add("hidden");

  document.getElementById("rmType").value = "Meeting Room";
  document.getElementById("rmActive").checked = true;
  document.getElementById("roomModal").classList.remove("hidden");
}

function openEditRoom(roomId) {
  const r = rooms.find(
    (x) => x.room_id === roomId || String(x.room_id) === String(roomId),
  );
  if (!r) return;
  editRoomId = roomId;
  document.getElementById("roomModalTitle").textContent = "แก้ไขห้อง";
  document.getElementById("rmCode").value = r.room_code;
  document.getElementById("rmName").value = r.room_name;
  document.getElementById("rmType").value = r.room_type || "Meeting Room";
  document.getElementById("rmSeats").value = r.capacity;
  document.getElementById("rmActive").checked = r.is_active !== false;

  const imgEl = document.getElementById("rmImage");
  if (imgEl) imgEl.value = "";

  // แสดงปุ่มลบห้องเฉพาะในโหมดแก้ไขห้องเท่านั้น
  const btnDelete = document.getElementById("btnDeleteRoom");
  if (btnDelete) btnDelete.classList.remove("hidden");

  document.getElementById("roomModal").classList.remove("hidden");
}

async function saveRoom() {
  const code = document.getElementById("rmCode").value.trim();
  const name = document.getElementById("rmName").value.trim();
  const type = document.getElementById("rmType").value;
  const seats = document.getElementById("rmSeats").value.trim(); // อ่านค่าเป็น string เพื่อตรวจสอบค่าว่าง
  const isActive = document.getElementById("rmActive").checked;
  const imageInput = document.getElementById("rmImage");

  if (!code || !name) {
    showToast("กรุณากรอกข้อมูลรหัสห้องและชื่อห้องให้ครบ", "error");
    return;
  }

  const formData = new FormData();
  formData.append("room_code", code);
  formData.append("room_name", name);
  formData.append("room_type", type);

  // หากเป็นค่าว่าง ให้ส่งเป็นสายอักขระว่างเพื่อให้หลังบ้านแจ้งเตือนอย่างถูกต้อง (เลี่ยงการส่ง 0 ซึ่งอาจติด Min Value ของระบบ)
  formData.append("capacity", seats !== "" ? Number(seats) : "");
  formData.append("is_active", isActive ? "true" : "false");

  if (imageInput && imageInput.files && imageInput.files[0]) {
    formData.append("room_image", imageInput.files[0]);
  }

  let url = "/api/admin/req/room/";
  let method = "POST";

  if (editRoomId) {
    url = `/api/admin/req/room/${editRoomId}/`;
    method = "PATCH";
  }

  try {
    const headers = {};

    // 1. ดึง Token ยืนยันตัวตน
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("jwt");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 2. ดึง CSRF Token
    let csrfToken = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith("csrftoken=")) {
          csrfToken = decodeURIComponent(cookie.substring("csrftoken=".length));
          break;
        }
      }
    }
    if (!csrfToken) {
      const csrfInput = document.querySelector("[name=csrfmiddlewaretoken]");
      if (csrfInput) csrfToken = csrfInput.value;
    }

    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }

    const response = await fetch(url, {
      method: method,
      headers: headers,
      body: formData,
      credentials: "same-origin",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errMsg = "";

      try {
        const errJson = JSON.parse(errorText);
        // ทำการดึงรายชื่อฟิลด์ที่ส่งไม่ผ่านมาจัดเรียงเพื่อแจ้งรายละเอียดให้แอดมินทราบอย่างถูกต้อง
        if (typeof errJson === "object" && errJson !== null) {
          errMsg = Object.entries(errJson)
            .map(
              ([field, msgs]) =>
                `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`,
            )
            .join("\n");
        } else {
          errMsg = errJson.message || "บันทึกข้อมูลไม่สำเร็จ";
        }
      } catch (e) {
        errMsg = errorText || "บันทึกข้อมูลไม่สำเร็จ";
      }
      throw new Error(errMsg);
    }

    const result = await response.json();
    showToast(
      editRoomId ? "แก้ไขห้องเรียบร้อยแล้ว" : "เพิ่มห้องเรียบร้อยแล้ว",
      "check_circle",
    );

    closeModals();
    await loadRooms();
    go("rooms");
  } catch (err) {
    // แสดงรายละเอียดปัญหาที่เกิดขึ้น (เช่น แจ้งว่าฟิลด์ใดขาดหายไป)
    alert("ไม่สามารถบันทึกข้อมูลได้เนื่องจาก:\n" + err.message);
  }
}

async function deleteRoom(roomId) {
  if (!confirm("ยืนยันการลบห้องนี้?")) return;
  try {
    await api.delete(`/api/admin/req/room/${roomId}/`);
    await loadRooms();
    showToast("ลบห้องเรียบร้อยแล้ว", "delete");
    go("rooms");
  } catch (err) {
    showApiError(err);
  }
}

// ═══════════════════════════════════════════════════════════════════
// GLOBAL CLICK
// ═══════════════════════════════════════════════════════════════════
window.addEventListener("click", (e) => {
  if (e.target === document.getElementById("approveModal")) closeModals();
  if (e.target === document.getElementById("rejectModal")) closeModals();
  if (e.target === document.getElementById("roomModal")) closeModals();
  if (e.target === document.getElementById("dayModal")) closeModals();
  if (e.target === document.getElementById("cancelModal")) closeModals();
  if (e.target === document.getElementById("cancelGroupModal")) closeModals();
  if (e.target === document.getElementById("exportModal")) closeModals();
});
