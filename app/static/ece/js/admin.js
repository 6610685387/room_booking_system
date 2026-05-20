/**
 * admin.js — ECE Room Booking admin panel
 *
 * All data is fetched from the REST API.  No hard-coded mock arrays.
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════
let rooms = []; // GET /api/admin/req/room/
let bookings = []; // GET /api/admin/bookings/

let curView = "dashboard";
let curActionId = null;
let calDate = new Date();
let calRoomFilter = "all";

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {
  const user = window.ECE_USER || {};
  document.getElementById("sideUserName").textContent =
    user.displayname_th || user.username || "—";

  await Promise.all([loadRooms(), loadBookings()]);
  go("dashboard");
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

// ═══════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════
function go(v) {
  curView = v;
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.className = `nav-item flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium ${el.dataset.view === v ? "nav-active" : "text-slate-600"}`;
  });
  updatePendingBadge();
  const app = document.getElementById("app");
  app.innerHTML = `<div class="view-enter">${render()}</div>`;
  app.scrollTop = 0;
  if (v === "calendar") initCalendar();
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
     ${s.action ? `onclick="${s.action}"` : ""}>>
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
<tr>
    <td><span class="text-xs text-slate-400">#${b.booking_id}</span></td>
    <td><div class="font-medium text-slate-800 text-xs">${b.booker?.displayname_th || "—"}</div></td>
    <td><div class="text-xs text-slate-700">${b.room?.room_name} (${b.room?.room_code})</div>
        <div class="text-[11px] text-slate-400">${b.purpose_type}</div></td>
    <td class="text-xs text-slate-600">${start} · ${ts}–${te}</td>
    <td>
        <div class="flex gap-1.5">
            <button onclick="openApprove(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-90" style="background:#10b981">อนุมัติ</button>
            <button onclick="openReject(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100">ปฏิเสธ</button>
        </div>
    </td>
</tr>`;
          })
          .join("");

  const recentAll = [...bookings].reverse().slice(0, 4);
  const activityHtml = recentAll
    .map((b) => {
      const clr = {
        Pending: "#f59e0b",
        Approved: "#10b981",
        Rejected: "#ef4444",
      }[b.status];
      const lbl = {
        Pending: "ส่งคำขอจอง",
        Approved: "ได้รับการอนุมัติ",
        Rejected: "ถูกปฏิเสธ",
      }[b.status];
      const created = b.created_at ? thaiDateShort(b.created_at) : "";
      return `<div class="flex items-start gap-3">
    <div class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style="background:${clr}"></div>
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
    <div class="grid grid-cols-12 gap-5">
        <div class="col-span-12 xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
        <div class="col-span-12 xl:col-span-4 space-y-5">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 class="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">history</span> กิจกรรมล่าสุด
                </h3>
                <div class="space-y-3">${activityHtml || '<p class="text-xs text-slate-400">ยังไม่มีกิจกรรม</p>'}</div>
            </div>
        </div>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: APPROVALS
// ═══════════════════════════════════════════════════════════════════
function vApprovals() {
  const pending = bookings.filter((b) => b.status === "Pending");
  const rows =
    pending.length === 0
      ? `<div class="text-center py-16 text-slate-400">
               <span class="material-symbols-outlined text-5xl block mb-2">check_circle</span>
               <p class="font-medium">ไม่มีรายการรอการอนุมัติ</p>
           </div>`
      : pending
          .map((b) => {
            const start = thaiDateShort(b.start_datetime);
            const ts = timeFromISO(b.start_datetime),
              te = timeFromISO(b.end_datetime);
            return `
<div class="bg-white border border-slate-200 border-l-4 border-l-amber-400 rounded-xl p-5 shadow-sm">
    <div class="flex flex-wrap justify-between gap-4">
        <div class="space-y-1.5 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="badge-pending px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <span class="material-symbols-outlined text-[11px]">pending</span>รออนุมัติ
                </span>
                <span class="text-slate-400 text-xs">#${b.booking_id}</span>
            </div>
            <h3 class="font-bold text-slate-800">${b.room?.room_name} (${b.room?.room_code})</h3>
            <p class="text-sm text-slate-600">ผู้จอง: ${b.booker?.displayname_th || "—"}</p>
            <p class="text-sm text-slate-600">วัตถุประสงค์: ${b.purpose_type}</p>
            <div class="flex gap-3 text-xs text-slate-500 flex-wrap">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te}</span>
            </div>
            ${b.additional_requests ? `<p class="text-xs text-slate-500 italic">"${b.additional_requests}"</p>` : ""}
        </div>
        <div class="flex flex-col gap-2 flex-shrink-0">
            <button onclick="openApprove(${b.booking_id})"
                class="px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2 hover:opacity-90"
                style="background:#10b981">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>อนุมัติ
            </button>
            <button onclick="openReject(${b.booking_id})"
                class="px-5 py-2.5 rounded-xl font-bold text-sm text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 flex items-center gap-2">
                <span class="material-symbols-outlined text-[16px]">cancel</span>ปฏิเสธ
            </button>
        </div>
    </div>
</div>`;
          })
          .join("");

  return `
<div class="p-6 sm:p-8 max-w-4xl">
    <header class="mb-6">
        <h2 class="text-2xl font-bold text-slate-800">รายการรออนุมัติ</h2>
        <p class="text-slate-500 text-sm mt-0.5">มี ${pending.length} รายการรอการดำเนินการ</p>
    </header>
    <div class="space-y-4">${rows}</div>
</div>`;
}

// ═══════════════════════════════════════════════════════════════════
// VIEW: ALL BOOKINGS
// ═══════════════════════════════════════════════════════════════════
function vAllBookings() {
  const statusMap = {
    Pending: "badge-pending",
    Approved: "badge-approved",
    Rejected: "badge-rejected",
  };
  const rows = bookings
    .map((b) => {
      const start = thaiDateShort(b.start_datetime);
      const ts = timeFromISO(b.start_datetime),
        te = timeFromISO(b.end_datetime);
      return `
<tr>
    <td><span class="text-xs text-slate-400">#${b.booking_id}</span></td>
    <td class="font-medium text-slate-800 text-xs">${b.booker?.displayname_th || "—"}</td>
    <td><div class="text-xs text-slate-700">${b.room?.room_name}</div><div class="text-[11px] text-slate-400">${b.room?.room_code}</div></td>
    <td class="text-xs text-slate-600">${start}<br>${ts}–${te}</td>
    <td><span class="${statusMap[b.status] || "badge-pending"} px-2 py-0.5 rounded-full text-[10px] font-bold">${b.status}</span></td>
    <td>
        <div class="flex gap-1">
            ${
              b.status === "Pending"
                ? `
            <button onclick="openApprove(${b.booking_id})" class="px-2 py-1 rounded text-[10px] font-bold text-white" style="background:#10b981">อนุมัติ</button>
            <button onclick="openReject(${b.booking_id})"  class="px-2 py-1 rounded text-[10px] font-bold text-red-600 border border-red-200 bg-red-50">ปฏิเสธ</button>
            `
                : '<span class="text-[10px] text-slate-400">—</span>'
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
// VIEW: ROOMS
// ═══════════════════════════════════════════════════════════════════
function vRooms() {
  const cards = rooms
    .map(
      (r) => `
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
// VIEW: REPORTS (skeleton — real analytics would need extra endpoints)
// ═══════════════════════════════════════════════════════════════════
function vReports() {
  const approved = bookings.filter((b) => b.status === "Approved").length;
  const total = bookings.length;
  const pct = total ? Math.round((approved / total) * 100) : 0;
  return `
<div class="p-6 sm:p-8">
    <header class="mb-6">
        <h2 class="text-2xl font-bold text-slate-800">รายงานสถิติ</h2>
        <p class="text-slate-500 text-sm mt-0.5">สรุปภาพรวมการใช้งานห้อง</p>
    </header>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center">
            <div class="text-3xl font-black text-slate-800 mb-1">${total}</div>
            <div class="text-xs text-slate-500 font-medium">คำขอจองทั้งหมด</div>
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
        <h3 class="font-bold text-slate-700 mb-4">การใช้งานรายห้อง</h3>
        <div class="space-y-3">
            ${rooms
              .map((r) => {
                const cnt = bookings.filter(
                  (b) =>
                    b.room?.room_id === r.room_id && b.status === "Approved",
                ).length;
                const pct2 = total
                  ? Math.round((cnt / Math.max(approved, 1)) * 100)
                  : 0;
                return `<div class="flex items-center gap-3">
                    <div class="text-xs font-bold text-slate-600 w-24 flex-shrink-0 truncate">${r.room_code}</div>
                    <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="util-bar h-full rounded-full" style="width:0%;background:${pct2 > 60 ? "#7e0000" : pct2 > 40 ? "#f59e0b" : "#10b981"}" data-w="${pct2}"></div>
                    </div>
                    <div class="text-xs font-bold text-slate-700 w-8 text-right">${cnt}</div>
                </div>`;
              })
              .join("")}
        </div>
    </div>
</div>`;
  // Animate bars
  setTimeout(() => {
    document
      .querySelectorAll("[data-w]")
      .forEach((el) => (el.style.width = el.dataset.w + "%"));
  }, 100);
}

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
    hdr.textContent = `${["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"][calDate.getMonth()]} ${calDate.getFullYear() + 543}`;
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
    // Filter bookings for this day
    const dayBks = bookings.filter((b) => {
      const s = new Date(b.start_datetime);
      return (
        s.getFullYear() === y &&
        s.getMonth() === m &&
        s.getDate() === d &&
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
  const months = [
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
  const dayBks = bookings.filter((b) => {
    const s = new Date(b.start_datetime);
    return (
      s.getFullYear() === y &&
      s.getMonth() === m &&
      s.getDate() === d &&
      (calRoomFilter === "all" || String(b.room?.room_id) === calRoomFilter)
    );
  });
  document.getElementById("dayModalTitle").textContent =
    `${d} ${months[m]} ${y + 543}`;
  document.getElementById("dayModalBody").innerHTML =
    dayBks.length === 0
      ? `<div class="text-center py-8 text-slate-400"><span class="material-symbols-outlined text-4xl block mb-2">event_available</span>ว่างทั้งวัน</div>`
      : dayBks
          .map(
            (b) => `
<div class="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex justify-between items-start gap-3">
    <div>
        <p class="font-bold text-slate-800 text-sm">${b.room?.room_name}</p>
        <p class="text-xs text-slate-500 mt-0.5">${b.booker?.displayname_th || "—"} · ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}</p>
        <p class="text-xs text-slate-500">${b.purpose_type}</p>
    </div>
    <span class="${{ Pending: "badge-pending", Approved: "badge-approved", Rejected: "badge-rejected" }[b.status] || "badge-pending"} px-2 py-0.5 rounded-full text-[10px] font-bold">${b.status}</span>
</div>`,
          )
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
    `<strong>#${b.booking_id}</strong> — ${b.room?.room_name} (${b.room?.room_code})<br>
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
    `<strong>#${b.booking_id}</strong> — ${b.room?.room_name} (${b.room?.room_code})<br>
         ${b.booker?.displayname_th || "—"} · ${thaiDateShort(b.start_datetime)} ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectModal").classList.remove("hidden");
}

function closeModals() {
  ["approveModal", "rejectModal", "roomModal", "dayModal"].forEach((id) => {
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
  document.getElementById("roomModal").classList.remove("hidden");
}

async function saveRoom() {
  const payload = {
    room_code: document.getElementById("rmCode").value.trim(),
    room_name: document.getElementById("rmName").value.trim(),
    room_type: document.getElementById("rmType").value,
    capacity: Number(document.getElementById("rmSeats").value),
    is_active: document.getElementById("rmActive").checked,
  };
  if (!payload.room_code || !payload.room_name) {
    showToast("กรุณากรอกข้อมูลให้ครบ", "error");
    return;
  }
  try {
    if (editRoomId) {
      await api.put(`/api/admin/req/room/${editRoomId}/`, payload);
      showToast("แก้ไขห้องเรียบร้อยแล้ว", "check_circle");
    } else {
      await api.post("/api/admin/req/room/", payload);
      showToast("เพิ่มห้องเรียบร้อยแล้ว", "check_circle");
    }
    closeModals();
    await loadRooms();
    go("rooms");
  } catch (err) {
    showApiError(err);
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
});
