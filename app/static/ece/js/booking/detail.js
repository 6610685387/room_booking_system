/**
 * detail.js — Detail views
 */
"use strict";

function vDetail() {
  const b = curDetailBooking;
  if (!b)
    return `<div class="p-8 text-slate-400 text-center"><span class="material-symbols-outlined text-5xl block mb-2">search_off</span>ไม่พบรายการจอง</div>`;

  const sCfg = {
    Pending: {
      bar: "bg-amber-100 border-amber-200 text-amber-700",
      label: "รอการอนุมัติ",
      ping: true,
    },
    Approved: {
      bar: "bg-green-100 border-green-200 text-green-700",
      label: "อนุมัติแล้ว",
      ping: false,
    },
    Rejected: {
      bar: "bg-red-100 border-red-200 text-red-700",
      label: "ไม่อนุมัติ",
      ping: false,
    },
    Cancelled: {
      bar: "bg-slate-100 border-slate-200 text-slate-600",
      label: "ยกเลิกแล้ว",
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

  const rName = b.room?.room_name || b.room_name || "—";
  const rCode = b.room?.room_code || b.room_code || "—";
  const subjectText =
    b.subject || b.teaching_info?.subject_name || b.training_info?.topic || "";

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div class="flex items-center gap-3">
            <button onclick="navigate('my-bookings')"
                class="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
                <h2 class="text-xl font-bold">รายละเอียดการจอง</h2>
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
                    <div><p class="text-xs text-slate-400 font-bold mb-1">ห้อง</p><p class="font-bold text-slate-800">${rName} (${rCode})</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วัตถุประสงค์</p><p class="font-medium">${ {teaching: "สอนปกติ/ชดเชย", training: "จัดอบรม/ติว"}[b.purpose_type] || b.purpose_type }</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วันที่</p><p class="font-medium">${start}${end !== start ? " – " + end : ""}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">เวลา</p><p class="font-medium">${ts} – ${te} น.</p></div>
                    ${subjectText ? `<div class="col-span-2"><p class="text-xs text-slate-400 font-bold mb-1">วิชา / หัวข้อ</p><p class="font-medium">${subjectText}</p></div>` : ""}
                    ${b.additional_requests ? `<div class="col-span-2"><p class="text-xs text-slate-400 font-bold mb-1">คำขอเพิ่มเติม</p><p class="text-sm text-slate-600">${b.additional_requests}</p></div>` : ""}
                </div>
            </div>
            ${b.reject_reason ? `<div class="p-4 bg-red-50 border border-red-200 rounded-2xl"><p class="text-sm font-bold text-red-700 flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>เหตุผลการปฏิเสธจากเจ้าหน้าที่</p><p class="text-sm text-red-600">${b.reject_reason}</p></div>` : ""}
            ${b.admin_notes ? `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl"><p class="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[16px]">info</span>หมายเหตุการอนุมัติจากเจ้าหน้าที่</p><p class="text-sm text-emerald-600">${b.admin_notes}</p></div>` : ""}
        </div>
        <div class="col-span-12 lg:col-span-5 space-y-4">
            ${b.can_cancel ? `<button onclick="openCancelModal(${b.booking_id})" class="w-full py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-100 border border-red-100 flex items-center justify-center gap-2 transition-all"><span class="material-symbols-outlined text-[18px]">cancel</span>ยกเลิกการจองนี้</button>` : ""}
            ${b.recurring_group_id ? `<button onclick="openCancelGroupModal('${b.recurring_group_id}')" class="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 transition-all"><span class="material-symbols-outlined text-[18px]">event_busy</span>ยกเลิกทั้งกลุ่ม</button>` : ""}
        </div>
    </div>
</div>`;
}
