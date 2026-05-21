/**
 * bookings.js — All Bookings rendering & Detailed Views
 */
"use strict";

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
          ? `<div class="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-1 font-medium max-w-xs"><strong>เหตุผลปฏิเสธ:</strong> ${b.reject_reason}</div>`
          : "";

      const approveNote =
        b.admin_notes && b.admin_notes.trim()
          ? `<div class="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mt-1 font-medium max-w-xs"><strong>หมายเหตุ:</strong> ${b.admin_notes}</div>`
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
                ? `<button onclick="event.stopPropagation(); openApprove(${b.booking_id})" class="px-2.5 py-1 rounded text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">อนุมัติ</button>
                 <button onclick="event.stopPropagation(); openReject(${b.booking_id})"  class="px-2.5 py-1 rounded text-[10px] font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors">ปฏิเสธ</button>`
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

function vDetailAdmin() {
  const b = bookings.find(
    (x) =>
      x.booking_id === Number(curDetailId) ||
      String(x.booking_id) === String(curDetailId),
  );
  if (!b) {
    return `<div class="p-6 sm:p-8 text-center text-slate-400"><span class="material-symbols-outlined text-5xl block mb-2">search_off</span>ไม่พบข้อมูลการจอง</div>`;
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
  const ts = timeFromISO(b.start_datetime),
    te = timeFromISO(b.end_datetime);
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
            ${b.reject_reason ? `<div class="p-4 bg-red-50 border border-red-200 rounded-2xl"><p class="text-sm font-bold text-red-700 flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>เหตุผลการปฏิเสธจากเจ้าหน้าที่</p><p class="text-sm text-red-600">${b.reject_reason}</p></div>` : ""}
            ${b.admin_notes ? `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl"><p class="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[16px]">info</span>หมายเหตุการอนุมัติจากเจ้าหน้าที่</p><p class="text-sm text-emerald-600">${b.admin_notes}</p></div>` : ""}
        </div>
        
        <div class="col-span-12 lg:col-span-5 space-y-4">
            ${
              b.status === "Pending"
                ? `<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4">การดำเนินการ</h3>
                <button onclick="openApprove(${b.booking_id})" class="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all" style="background:#10b981"><span class="material-symbols-outlined text-[18px]">check_circle</span>อนุมัติการจอง</button>
                <button onclick="openReject(${b.booking_id})" class="w-full py-3 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"><span class="material-symbols-outlined text-[18px]">cancel</span>ปฏิเสธการจอง</button>
              </div>`
                : `<div class="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center text-slate-500"><span class="material-symbols-outlined text-4xl block mb-2">lock</span><p class="text-xs font-bold uppercase tracking-wider">ปิดการดำเนินการ</p><p class="text-xs text-slate-400 mt-1">รายการนี้ได้รับการประมวลผลแล้ว</p></div>`
            }
            ${b.recurring_group_id ? `<button onclick="openCancelGroupModal('${b.recurring_group_id}')" class="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 transition-all"><span class="material-symbols-outlined text-[18px]">event_busy</span>ยกเลิกทั้งกลุ่ม</button>` : ""}
        </div>
    </div>
</div>`;
}
