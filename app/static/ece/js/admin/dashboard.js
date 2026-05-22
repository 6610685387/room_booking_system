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
      action: "go('all-bookings?status=Approved')",
    },
    {
      icon: "cancel",
      label: "ไม่อนุมัติ",
      val: rejected,
      color: "#ef4444",
      bg: "#fee2e2",
      action: "go('all-bookings?status=Rejected')",
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

  const pendingRaw = bookings.filter((b) => b.status === "Pending");
  const groupedPending = [];
  const seenPendingGroups = {};

  // 1. จัดทำกลุ่มข้อมูลคิวจองที่รออนุมัติ (Pending List Grouping)
  pendingRaw.forEach((b) => {
    const gid = b.recurring_group_id;
    if (!gid) {
      groupedPending.push({ type: "single", booking: b });
    } else {
      if (!seenPendingGroups[gid]) {
        seenPendingGroups[gid] = {
          type: "group",
          groupId: gid,
          room_name: b.room?.room_name || b.room_name || "—",
          room_code: b.room?.room_code || b.room_code || "—",
          purpose_type: b.purpose_type,
          subject: b.subject,
          bookings: [],
        };
        groupedPending.push(seenPendingGroups[gid]);
      }
      seenPendingGroups[gid].bookings.push(b);
    }
  });

  // แปลงรายการแบบกลุ่มที่มีเพียงรายการเดียว ให้แสดงผลเป็นสล็อตแถวเดี่ยว
  const finalGroupedPending = groupedPending.map((item) => {
    if (item.type === "group" && item.bookings.length === 1) {
      return { type: "single", booking: item.bookings[0] };
    }
    return item;
  });

  // ฟังก์ชันคำนวณวันเริ่มต้นจองเพื่อระบุความสำคัญในการเรียงลำดับคิว
  const getEarliestPendingDate = (item) => {
    if (item.type === "single") {
      return new Date(item.booking.start_datetime);
    } else {
      const dates = item.bookings.map((x) => new Date(x.start_datetime));
      return new Date(Math.min(...dates));
    }
  };

  // 2. จัดเรียงคิวรออนุมัติตามเวลาเริ่มใช้งานจากเร็วสุดไปช้าสุด (Ascending Order)
  finalGroupedPending.sort((a, b) => getEarliestPendingDate(a) - getEarliestPendingDate(b));

  // หยิบชุดข้อมูล 5 รายการแรกสุดเพื่อนำมาแสดงบนแถวแดชบอร์ด
  const pendingDisplay = finalGroupedPending.slice(0, 5);

  const pendingRows =
    pendingDisplay.length === 0
      ? `<tr><td colspan="4" class="text-center py-8 text-slate-400 text-sm">ไม่มีรายการรออนุมัติ</td></tr>`
      : pendingDisplay
        .map((item) => {
          if (item.type === "single") {
            const b = item.booking;
            const start = thaiDateShort(b.start_datetime);
            const ts = timeFromISO(b.start_datetime),
              te = timeFromISO(b.end_datetime);
            return `
<tr class="cursor-pointer hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0" onclick="viewDetailAdmin(${b.booking_id})">
    <td class="py-4 px-5 align-middle text-left"><div class="font-medium text-slate-800 text-xs">${b.booker?.displayname_th || "—"}</div></td>
    <td class="py-4 px-5 align-middle text-left">
        <div class="text-xs text-slate-700 font-bold">${b.room?.room_name || b.room_name} (${b.room?.room_code || b.room_code})</div>
        <div class="text-[11px] text-slate-400 mt-0.5">${{
              teaching: "สอนปกติ/ชดเชย",
              training: "จัดอบรม/ติว",
            }[b.purpose_type] || "ไม่ทราบ"
            } ${b.subject ? `· ${b.subject}` : ""}</div>
    </td>
    <td class="py-4 px-5 align-middle text-left text-xs text-slate-600">${start} · ${ts}–${te} น.</td>
    <td class="py-4 px-5 align-middle text-left">
        <div class="flex gap-1.5 flex-wrap items-center">
            <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-90 active:scale-95 transition-all" style="background:#10b981">อนุมัติ</button>
            <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 active:scale-95 transition-all">ปฏิเสธ</button>
        </div>
    </td>
</tr>`;
          } else {
            // เขียนคิวจองแบบกลุ่มซ้ำเป็นแถวตารางสีคราม (Indigo Style)
            const g = item;
            const sorted = [...g.bookings].sort((x, y) => new Date(x.start_datetime) - new Date(y.start_datetime));
            const minDate = thaiDateShort(sorted[0].start_datetime);
            const maxDate = thaiDateShort(sorted[sorted.length - 1].start_datetime);
            const ts = timeFromISO(g.bookings[0].start_datetime),
              te = timeFromISO(g.bookings[0].end_datetime);
            const bookerName = sorted[0].booker?.displayname_th || "—";
            
            return `
<tr class="cursor-pointer bg-indigo-50/20 hover:bg-indigo-50/50 transition-colors border-b border-indigo-100/50 last:border-0" 
    onclick="sessionStorage.setItem('expandGroup', '${g.groupId}'); sessionStorage.setItem('bookingFilterStatus', 'Pending'); go('all-bookings')">
    <td class="py-4 px-5 align-middle text-left">
        <div class="font-bold text-indigo-900 text-xs">${bookerName}</div>
        <div class="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mt-0.5">จองกลุ่มซ้ำ</div>
    </td>
    <td class="py-4 px-5 align-middle text-left">
        <!-- เพิ่มรายละเอียดวันและช่วงเวลาสำหรับการกดเปิดปิดดูด้านในตารางเพื่อความสะดวกในการตรวจสอบ -->
        <details class="group/dash-det select-none outline-none" onclick="event.stopPropagation()">
            <summary class="list-none cursor-pointer flex items-center gap-1">
                <span class="material-symbols-outlined text-[15px] text-indigo-500 group-open/dash-det:rotate-180 transition-transform">expand_more</span>
                <span class="text-xs text-indigo-950 font-black">${g.room_name} (${g.room_code})</span>
            </summary>
            <div class="mt-1.5 pl-4 border-l-2 border-indigo-100 space-y-1">
                ${sorted.map(b => `<p class="text-[10px] text-slate-500">• ${thaiDateShort(b.start_datetime)} เวลา ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)} น.</p>`).join("")}
            </div>
        </details>
        <div class="text-[11px] text-indigo-700 font-semibold mt-0.5 pl-4">${{
              teaching: "สอนปกติ/ชดเชย",
              training: "จัดอบรม/ติว",
            }[g.purpose_type] || "ไม่ทราบ"
            } ${g.subject ? `· ${g.subject}` : ""} <span class="text-xs text-slate-400 font-normal">(${g.bookings.length} รายการ)</span></div>
    </td>
    <td class="py-4 px-5 align-middle text-left text-xs text-indigo-900 font-medium">${minDate} – ${maxDate}<br><span class="text-[11px] text-slate-400 font-normal">${ts}–${te} น.</span></td>
    <td class="py-4 px-5 align-middle text-left">
        <div class="flex gap-1.5 flex-wrap items-center">
            <button onclick="event.stopPropagation(); openApproveGroup('${g.groupId}')"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white hover:opacity-90 active:scale-95 transition-all shadow-xs" style="background:#10b981">อนุมัติกลุ่ม</button>
            <button onclick="event.stopPropagation(); openCancelGroupModal('${g.groupId}')"
                class="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 active:scale-95 transition-all">ปฏิเสธทั้งกลุ่ม</button>
        </div>
    </td>
</tr>`;
          }
        })
        .join("");

  // ดึงกลุ่มข้อมูลคิวจองแบบย้อนหลังจากหลังสุดมาพักไว้ก่อน 15 คิว
  const rawRecent = [...bookings].reverse().slice(0, 15);
  const groupedRecent = [];
  const seenRecentGroups = {};

  rawRecent.forEach((b) => {
    const gid = b.recurring_group_id;
    if (!gid) {
      groupedRecent.push({ type: "single", booking: b });
    } else {
      if (!seenRecentGroups[gid]) {
        seenRecentGroups[gid] = {
          type: "group",
          groupId: gid,
          bookings: [],
        };
        groupedRecent.push(seenRecentGroups[gid]);
      }
      seenRecentGroups[gid].bookings.push(b);
    }
  });

  // แปลงรายการจองแบบกลุ่มที่มีสมาชิกคิวเดียว ให้กลับแสดงผลเป็นการ์ดเดี่ยวปกติ
  const finalGroupedRecent = groupedRecent.map((item) => {
    if (item.type === "group" && item.bookings.length === 1) {
      return { type: "single", booking: item.bookings[0] };
    }
    return item;
  });

  // เลือกหยิบเฉพาะ 4 กิจกรรมด้านบนสุดมาแสดงในหน้าแรก
  const recentDisplay = finalGroupedRecent.slice(0, 4);

  const activityHtml = recentDisplay
    .map((item) => {
      if (item.type === "single") {
        const b = item.booking;
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
        return `
<div class="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-slate-200 hover:shadow-sm transition-all" onclick="viewDetailAdmin(${b.booking_id})">
    <div class="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style="background:${clr}"></div>
    <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-slate-700 truncate">${b.booker?.displayname_th || "—"} — ${lbl}</p>
        <p class="text-[11px] text-slate-400 truncate">${b.room?.room_name || b.room_name || ""} · ${b.room?.room_code || b.room_code || ""} · ${thaiDateShort(b.start_datetime)}</p>
    </div>
    <span class="text-[10px] text-slate-400 flex-shrink-0">${created}</span>
</div>`;
      } else {
        const g = item;
        const first = g.bookings[0];
        const count = g.bookings.length;
        const created = first.created_at ? thaiDateShort(first.created_at) : "";
        return `
<div class="flex items-start gap-3 p-3 bg-indigo-50/45 rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all" 
     onclick="sessionStorage.setItem('expandGroup', '${g.groupId}'); sessionStorage.setItem('bookingFilterStatus', 'Pending'); go('all-bookings')">
    <div class="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 bg-indigo-500"></div>
    <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-slate-700 truncate">${first.booker?.displayname_th || "—"} — ส่งคำขอจองแบบกลุ่ม</p>
        <p class="text-[11px] text-indigo-600 font-bold truncate">${first.room?.room_name || first.room_name || ""} (${first.room?.room_code || first.room_code || ""})</p>
        <p class="text-[10px] text-slate-400 mt-0.5 font-medium">จองซ้ำต่อเนื่องทั้งหมด ${count} รายการ</p>
    </div>
    <span class="text-[10px] text-slate-400 flex-shrink-0">${created}</span>
</div>`;
      }
    })
    .join("");

  return `
<div class="p-6 sm:p-8">
    <div class="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">แดชบอร์ดเจ้าหน้าที่</h2>
            <p class="text-slate-500 text-sm mt-0.5">ภาพรวมระบบจองห้อง ณ วันนี้</p>
        </div>
        <button onclick="Promise.all([loadRooms(),loadBookings()]).then(()=>renderCurrentView())" class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
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