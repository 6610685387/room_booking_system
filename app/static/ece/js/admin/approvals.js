/**
 * approvals.js — Approvals rendering, Approve, Reject & Cancel Group Actions
 */
"use strict";

let isGroupAction = false; // ตัวแปรสำหรับตรวจสอบว่าเป็นการอนุมัติแบบกลุ่มหรือไม่


function vApprovals() {
  const pending = bookings.filter((b) => b.status === "Pending");
  const groupedCardsHtml = buildAdminPendingBookingsHtml(pending);

  return `
<div class="p-6 sm:p-8 max-w-4xl">
    <header class="mb-6 flex items-start justify-between gap-4">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">รายการรออนุมัติ</h2>
            <p class="text-slate-500 text-sm mt-0.5">มี ${pending.length} รายการรอการดำเนินการ</p>
        </div>
        <button onclick="loadBookings().then(()=>renderCurrentView())" class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
            <span class="material-symbols-outlined text-[16px]">refresh</span>รีเฟรช
        </button>
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

  // คัดกรองและปรับโครงสร้าง: หากกลุ่มจองซ้ำ (Group) มีรายการจองเพียง 1 รายการ ให้เปลี่ยนไปแสดงผลแบบการ์ดเดี่ยว (Single)
  const finalGroupedList = groupedList.map((item) => {
    if (item.type === "group" && item.bookings.length === 1) {
      return { type: "single", booking: item.bookings[0] };
    }
    return item;
  });

  // ฟังก์ชันหาเวลาเริ่มต้นการจองที่เร็วที่สุด เพื่อจัดลำดับคิว
  const getEarliestDate = (item) => {
    if (item.type === "single") {
      return new Date(item.booking.start_datetime);
    } else {
      const dates = item.bookings.map((x) => new Date(x.start_datetime));
      return new Date(Math.min(...dates));
    }
  };

  const now = new Date();
  const isPast = (item) => {
    if (item.type === "single") {
      return new Date(item.booking.end_datetime) < now;
    } else {
      const sorted = [...item.bookings].sort(
        (x, y) => new Date(x.end_datetime) - new Date(y.end_datetime),
      );
      return new Date(sorted[sorted.length - 1].end_datetime) < now;
    }
  };

  // เรียงลำดับรายการตามวันที่เริ่มต้นการจองที่ใกล้มาถึงที่สุด (Ascending Order)
  // แต่ย้ายรายการที่ผ่านไปแล้ว (Past) ไปไว้ข้างล่างสุด
  finalGroupedList.sort((a, b) => {
    const aPast = isPast(a);
    const bPast = isPast(b);
    if (aPast && !bPast) return 1;
    if (!aPast && bPast) return -1;
    return getEarliestDate(a) - getEarliestDate(b);
  });

  const borderMap = {
    Pending: "border-l-amber-400",
    Approved: "border-l-emerald-500",
    Rejected: "border-l-red-400",
    Cancelled: "border-l-slate-300",
  };

  return finalGroupedList
    .map((item) => {
      const itemPast = isPast(item);
      const opacityClass = itemPast ? "opacity-60 grayscale-[30%]" : "";
      const badgeTextSingle = itemPast ? "หมดเวลา (รอประมวลผล)" : "รออนุมัติ";
      const badgeTextGroup = itemPast ? "รายการที่หมดเวลาแบบกลุ่ม" : "รายการรออนุมัติแบบกลุ่ม";

      if (item.type === "single") {
        const b = item.booking;
        const start = thaiDateShort(b.start_datetime);
        const ts = timeFromISO(b.start_datetime),
          te = timeFromISO(b.end_datetime);

        return `
<div class="bg-white border border-slate-200 border-l-4 ${borderMap[b.status] || "border-l-slate-300"} rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-slate-300 hover:shadow transition-all"
     onclick="viewDetailAdmin(${b.booking_id})">
    <div class="flex-1 space-y-1.5 min-w-0 ${opacityClass}">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="badge-pending px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-[11px]">pending</span>${badgeTextSingle}
            </span>
        </div>
        <h3 class="font-bold text-slate-800">${b.room?.room_name || b.room_name || "—"} (${b.room?.room_code || b.room_code || "—"})</h3>
        <p class="text-sm text-slate-600">ผู้จอง: ${b.booker?.displayname_th || "—"}</p>
        <p class="text-sm text-slate-600">${{
            teaching: "สอนปกติ/ชดเชย: ",
            training: "จัดอบรม/ติว: ",
          }[b.purpose_type] || "ไม่ทราบ: "
          } ${b.subject ? `${b.subject}` : ""}</p>
        <div class="flex gap-3 text-xs text-slate-500 flex-wrap">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
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
        const canApproveAnyGroup = g.bookings.some(
          (b) => b.status === "Pending"
        );
        const sortedBookings = [...g.bookings].sort(
          (x, y) => new Date(x.start_datetime) - new Date(y.start_datetime),
        );
        const minDateStr = thaiDateShort(sortedBookings[0].start_datetime);
        const maxDateStr = thaiDateShort(
          sortedBookings[sortedBookings.length - 1].start_datetime,
        );
        const ts = timeFromISO(g.bookings[0].start_datetime),
          te = timeFromISO(g.bookings[0].end_datetime);

        const slotsHtml = sortedBookings
          .map((b) => {
            const start = thaiDateShort(b.start_datetime);
            const tsSlot = timeFromISO(b.start_datetime),
              teSlot = timeFromISO(b.end_datetime);
            return `
<div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white border border-slate-150 gap-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
     onclick="event.stopPropagation(); viewDetailAdmin(${b.booking_id})">
    <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="badge-pending px-2 py-0.5 rounded-full text-[10px] font-bold">รออนุมัติ</span>
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
        <div class="flex-1 space-y-2 min-w-0 ${opacityClass}">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="badge-pending text-indigo-800 bg-indigo-100 border border-indigo-300 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1"><span class="material-symbols-outlined text-[11px]">pending</span>${badgeTextGroup}</span>
                <span class="text-slate-400 text-xs font-semibold">มีรายการจองทั้งหมด ${g.bookings.length} วัน</span>
            </div>
            <h3 class="text-base font-bold text-slate-800 truncate">${g.room_name} (${g.room_code})</h3>
            <p class="text-sm text-slate-600">ผู้จอง: ${sortedBookings[0].booker?.displayname_th || "—"}</p>
            <p class="text-sm text-slate-600">${{
            teaching: "สอนปกติ/ชดเชย",
            training: "จัดอบรม/ติว",
          }[g.purpose_type] || "ไม่ทราบ"
          }: ${g.subject || "—"}</p>
            <div class="flex flex-wrap gap-3 text-xs text-slate-500">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${minDateStr} – ${maxDateStr}</span>
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
            </div>
            ${sortedBookings[0].additional_requests ? `<p class="text-xs text-slate-400 italic">"${sortedBookings[0].additional_requests}"</p>` : ""}
        </div>
        <div class="flex items-center gap-2 flex-wrap flex-shrink-0 self-end md:self-center">
            ${canApproveAnyGroup
            ? `<button onclick="event.stopPropagation(); openApproveGroup('${g.groupId}')"
                class="px-4 py-2 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 hover:opacity-90 transition-all shadow-sm"
                style="background:#10b981">
                <span class="material-symbols-outlined text-[15px]">check_circle</span>อนุมัติทั้งกลุ่ม
            </button>`
            : ""
          }
            ${canCancelAnyGroup
            ? `<button onclick="event.stopPropagation(); openCancelGroupModal('${g.groupId}')"
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

function openApprove(id) {
  isGroupAction = false;
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

// ฟังก์ชันเปิดยืนยันการอนุมัติแบบกลุ่ม (แชร์ Modal ร่วมกับแบบคิวเดี่ยว)
function openApproveGroup(groupId) {
  isGroupAction = true;
  curActionId = groupId;

  const groupBookings = bookings.filter(
    (b) => b.recurring_group_id && String(b.recurring_group_id) === String(groupId)
  );

  if (groupBookings.length > 0) {
    const first = groupBookings[0];
    const roomName = first.room?.room_name || first.room_name || "—";
    const roomCode = first.room?.room_code || first.room_code || "—";
    const count = groupBookings.length;

    document.getElementById("approveDetail").innerHTML =
      `<strong>อนุมัติทั้งกลุ่ม #${groupId} (ทั้งหมด ${count} รายการ)</strong><br>
       ห้อง ${roomName} (${roomCode})<br>
       ผู้จอง: ${first.booker?.displayname_th || "—"}`;
  } else {
    document.getElementById("approveDetail").innerHTML = `<strong>อนุมัติทั้งกลุ่ม #${groupId}</strong>`;
  }

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
    `${b.room?.room_name || b.room_name} (${b.room?.room_code || b.room_code})<br>
         ${b.booker?.displayname_th || "—"} · ${thaiDateShort(b.start_datetime)} ${timeFromISO(b.start_datetime)}–${timeFromISO(b.end_datetime)}`;
  document.getElementById("rejectReason").value = "";
  document.getElementById("rejectModal").classList.remove("hidden");
}

async function doApprove() {
  const note = document.getElementById("approveNote").value.trim();
  closeModals();
  try {
    if (isGroupAction) {
      // เรียกส่ง PATCH ไปยังสล็อตการจองซ้ำแบบกลุ่ม
      await api.patch(`/api/admin/bookings/recurring/${curActionId}/approve/`, {
        admin_notes: note,
      });
      showToast("อนุมัติการจองทั้งกลุ่มเรียบร้อยแล้ว", "check_circle");
    } else {
      // เรียกส่ง PATCH ของคิวเดี่ยวปกติ
      await api.patch(`/api/admin/bookings/${curActionId}/approve/`, {
        admin_notes: note,
      });
      showToast("อนุมัติการจองเรียบร้อยแล้ว", "check_circle");
    }
    await loadBookings();
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
// RECURRING GROUP CANCEL Actions
// ═══════════════════════════════════════════════════════════════════
function openCancelGroupModal(groupId) {
  cancelGroupId = groupId;
  const displayEl = document.getElementById("cancelGroupIdDisplay");

  if (displayEl) {
    const groupBookings = bookings.filter(
      (b) => b.recurring_group_id && String(b.recurring_group_id) === String(groupId)
    );

    if (groupBookings.length > 0) {
      const first = groupBookings[0];
      const roomName = first.room?.room_name || first.room_name || "—";
      const roomCode = first.room?.room_code || first.room_code || "—";
      const subject = first.subject || (
        first.purpose_type === "teaching" ? "สอนปกติ/ชดเชย" :
          first.purpose_type === "training" ? "จัดอบรม/ติว" : "—"
      );

      // คำนวณจำนวนสล็อตจองที่ค้างอยู่ตามแต่ละสถานะ
      const pendingCount = groupBookings.filter(b => b.status === "Pending").length;
      const approvedCount = groupBookings.filter(b => b.status === "Approved").length;

      displayEl.innerHTML = `
        <span class="block mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-left text-slate-600 font-normal leading-relaxed">
          <strong class="text-slate-700">ห้อง:</strong> ${roomName} (${roomCode})<br>
          <strong class="text-slate-700">วัตถุประสงค์:</strong> ${subject}<br>
          <strong class="text-slate-700">จำนวนที่รอยกเลิก:</strong> ${pendingCount} รายการ<br>
          <span class="block text-[10px] text-amber-600 font-bold mt-1.5 leading-normal">
            ⚠️ ระบบจะส่งคำขอยกเลิกเฉพาะรายการที่ยังไม่ได้รับการอนุมัติเท่านั้น สำหรับรายการที่ได้รับอนุมัติไปแล้ว (${approvedCount} รายการ) จะได้รับการละเว้นและไม่มีการยกเลิกใด ๆ
          </span>
        </span>`;
    } else {
      displayEl.textContent = `รหัสกลุ่ม #${groupId}`;
    }
  }

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