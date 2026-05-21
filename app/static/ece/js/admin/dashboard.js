/**
 * dashboard.js — vDashboard Render
 */
"use strict";

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
<tr class="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0" onclick="viewDetailAdmin(${b.booking_id})">

    <td class="py-4 px-5 align-middle text-left"><div class="font-medium text-slate-800 text-xs">${b.booker?.displayname_th || "—"}</div></td>
    <td class="py-4 px-5 align-middle text-left">
        <div class="text-xs text-slate-700 font-bold">${b.room?.room_name} (${b.room?.room_code})</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${
          {
            teaching: "สอนปกติ/ชดเชย",
            training: "จัดอบรม/ติว",
          }[b.purpose_type] || "ไม่ทราบ"
        } ${b.subject ? `· ${b.subject}` : ""}</div>
    </td>
    <td class="py-4 px-5 align-middle text-left text-xs text-slate-600">${start} · ${ts}–${te}</td>
    <td class="py-4 px-5 align-middle text-left">
        <div class="flex gap-1.5 flex-wrap items-center">
            <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-90 active:scale-95 transition-all" style="background:#10b981">อนุมัติ</button>
            <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 active:scale-95 transition-all">ปฏิเสธ</button>
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
        <p class="text-[11px] text-slate-400 truncate">${b.room?.room_name || ""} · ${b.room?.room_code || ""} · ${thaiDateShort(b.start_datetime)}</p>
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
                <table class="data-table w-full border-collapse">
                    <thead>
                        <tr class="border-b border-slate-100 text-slate-400 text-[11px] uppercase tracking-wider">

                            <th class="py-3 px-5 text-left font-bold">ผู้จอง</th>
                            <th class="py-3 px-5 text-left font-bold">ห้อง / วัตถุประสงค์</th>
                            <th class="py-3 px-5 text-left font-bold">วันเวลา</th>
                            <th class="py-3 px-5 text-left font-bold">การจัดการ</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">${pendingRows}</tbody>
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
