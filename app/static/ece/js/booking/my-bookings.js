/**
 * my-bookings.js — Personal booking histories, status tabs & cancel actions
 */
"use strict";

function vMyBookings() {
  const counts = {
    all: myBookings.filter((b) => b.status !== "Cancelled").length,
    Pending: myBookings.filter((b) => b.status === "Pending").length,
    Approved: myBookings.filter((b) => b.status === "Approved").length,
    Rejected: myBookings.filter((b) => b.status === "Rejected").length,
  };
  const tabs = [
    ["all", "ทั้งหมด"],
    ["Pending", "รออนุมัติ"],
    ["Approved", "อนุมัติแล้ว"],
    ["Rejected", "ไม่อนุมัติ"],
  ];
  const filtered =
    mbTab === "all"
      ? myBookings.filter((b) => b.status !== "Cancelled")
      : myBookings.filter((b) => b.status === mbTab);

  const tabHtml = tabs
    .map(
      ([k, l]) => `
<button onclick="setMbTab('${k}')" data-mbt="${k}" class="pb-3 px-1 border-b-2 text-sm font-bold transition-all flex items-center gap-1.5 ${mbTab === k ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}">
    ${l} <span class="px-1.5 py-0.5 rounded-full text-[10px] ${mbTab === k ? "text-white" : "bg-slate-200 text-slate-500"}" ${mbTab === k ? 'style="background:#7e0000"' : ""}>${counts[k]}</span>
</button>`,
    )
    .join("");

  const cardsHtml = buildMyBookingsHtml(filtered);

  return `
<div class="p-6 sm:p-8 w-full">
    <header class="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
            <h2 class="text-2xl font-bold text-slate-800">รายการจองของฉัน</h2>
            <p class="text-slate-500 text-sm mt-0.5">ตรวจสอบสถานะและจัดการรายการจองห้อง</p>
        </div>
        <button onclick="loadMyBookings().then(()=>renderApp())" class="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary px-3 py-2 rounded-xl hover:bg-slate-100 transition-all">
            <span class="material-symbols-outlined text-[16px]">refresh</span>รีเฟรช
        </button>
    </header>
    <div class="flex gap-5 border-b border-slate-200 mb-6">${tabHtml}</div>
    <div class="space-y-4" id="myBookingsList">${cardsHtml}</div>
</div>`;
}

function redrawMyBookings() {
  const container = document.getElementById("myBookingsList");
  if (!container) return;
  const filtered =
    mbTab === "all"
      ? myBookings.filter((b) => b.status !== "Cancelled")
      : myBookings.filter((b) => b.status === mbTab);
  const cardsHtml = buildMyBookingsHtml(filtered);
  container.innerHTML = cardsHtml;
}

// ฟังก์ชันสร้าง Badge ป้ายสีแสดงสถานะการจองอย่างชัดเจน
function badge(status) {
  const config = {
    Approved: "text-emerald-700 bg-emerald-50 border-emerald-200",
    Pending: "text-amber-700 bg-amber-50 border-amber-200",
    Rejected: "text-red-700 bg-red-50 border-red-200",
    Cancelled: "text-slate-500 bg-slate-50 border-slate-200"
  };
  const text = {
    Approved: "อนุมัติแล้ว",
    Pending: "รออนุมัติ",
    Rejected: "ไม่อนุมัติ",
    Cancelled: "ยกเลิกแล้ว"
  };
  const cls = config[status] || "text-slate-500 bg-slate-50 border-slate-200";
  const txt = text[status] || status;
  return `<span class="px-2.5 py-1 rounded-full border text-xs font-bold ${cls}">${txt}</span>`;
}

function buildMyBookingsHtml(filteredList) {
  if (filteredList.length === 0) {
    return `<div class="text-center py-16 text-slate-400"><span class="material-symbols-outlined text-5xl block mb-2">event_busy</span>ไม่มีรายการจองในหมวดนี้</div>`;
  }

  const groupedList = [];
  const seenGroups = {};

  filteredList.forEach((b) => {
    const gid = b.recurring_group_id;
    if (!gid) {
      groupedList.push({ type: "single", booking: b });
    } else {
      if (!seenGroups[gid]) {
        seenGroups[gid] = {
          type: "group",
          groupId: gid,
          room_name: b.room_name,
          room_code: b.room_code,
          purpose_type: b.purpose_type,
          subject: b.subject,
          bookings: [],
        };
        groupedList.push(seenGroups[gid]);
      }
      seenGroups[gid].bookings.push(b);
    }
  });

  // 1. แปลงรายการกลุ่มที่มีการจองเพียง 1 คิว ให้เปลี่ยนไปแสดงผลแบบการ์ดเดี่ยว (Single)
  const finalGroupedList = groupedList.map((item) => {
    if (item.type === "group" && item.bookings.length === 1) {
      return { type: "single", booking: item.bookings[0] };
    }
    return item;
  });

  // ฟังก์ชันคำนวณระบุสล็อตเวลาเริ่มจองที่เก่าที่สุดหรือใกล้ที่สุด เพื่อจัดเรียงลำดับ
  const getEarliestDate = (item) => {
    if (item.type === "single") {
      return new Date(item.booking.start_datetime);
    } else {
      const dates = item.bookings.map((x) => new Date(x.start_datetime));
      return new Date(Math.min(...dates));
    }
  };

  // 2. จัดเรียงลำดับคิวจองจากรายการที่ใกล้ถึงกำหนดใช้งานมากที่สุดขึ้นก่อน (Ascending Order)
  // แต่ย้ายรายการที่ผ่านไปแล้ว (Past) ไปไว้ข้างล่างสุด
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

      if (item.type === "single") {
        const b = item.booking;
        const start = thaiDateShort(b.start_datetime);
        const end = thaiDateShort(b.end_datetime);
        const ts = timeFromISO(b.start_datetime),
          te = timeFromISO(b.end_datetime);
        const adminNotesText = b.admin_notes || b.admin_note || "";

        // กำหนดปุ่มจองซ้ำให้สามารถกดจองได้เฉพาะรายการที่ "อนุมัติแล้ว" เท่านั้น
        const isApproved = b.status === "Approved";
        const rebookBtn = isApproved
          ? `<button onclick="event.stopPropagation(); rebookFromHistory(${b.booking_id})" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"><span class="material-symbols-outlined text-[15px]">autorenew</span>จองซ้ำ</button>`
          : `<button onclick="event.stopPropagation();" class="px-3.5 py-2 bg-slate-50 text-slate-300 border border-slate-100 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-not-allowed" title="จองซ้ำได้เฉพาะรายการที่อนุมัติแล้วเท่านั้น"><span class="material-symbols-outlined text-[15px]">autorenew</span>จองซ้ำ</button>`;

        return `
<div class="bg-white border border-slate-200 border-l-4 ${borderMap[b.status] || "border-l-slate-300"} rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-slate-300 hover:shadow transition-all" onclick="navigate('detail',{detailId:${b.booking_id}})">
    <div class="flex-1 space-y-2 min-w-0 ${opacityClass}">
        <div class="flex items-center gap-2 flex-wrap">
            ${badge(b.status)}
            
        </div>
        <h3 class="text-base font-bold text-slate-800 truncate">${b.room_name} (${b.room_code})</h3>
        <p class="text-sm text-slate-600">${({
            "teaching": "สอนปกติ/ชดเชย",
            "training": "จัดอบรม/ติว"
          }[b.purpose_type] || "ไม่ทราบ")}: ${b.subject || "—"}</p>
        <div class="flex flex-wrap gap-3 text-xs text-slate-500">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}${end !== start ? " – " + end : ""}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
        </div>
        ${b.additional_requests ? `<p class="text-xs text-slate-500 italic mt-1.5">"คำขอพิเศษ: ${b.additional_requests}"</p>` : ""}
        ${b.reject_reason ? `<div class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5 mt-1.5"><span class="material-symbols-outlined text-[13px] mt-0.5 flex-shrink-0">admin_panel_settings</span><strong>เหตุผลที่ปฏิเสธ:</strong> ${b.reject_reason}</div>` : ""}
        ${adminNotesText ? `<div class="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex items-start gap-1.5 mt-1.5"><span class="material-symbols-outlined text-[13px] mt-0.5 flex-shrink-0">info</span><strong>หมายเหตุอนุมัติ:</strong> ${adminNotesText}</div>` : ""}
    </div>
    <div class="flex gap-2 flex-shrink-0 md:self-center">
        ${rebookBtn}
        ${b.can_cancel
            ? `<button onclick="event.stopPropagation(); openCancelModal(${b.booking_id})" class="px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 border border-red-100 flex items-center gap-1.5 transition-all"><span class="material-symbols-outlined text-[15px]">cancel</span>ยกเลิก</button>`
            : `<button onclick="event.stopPropagation();" class="px-4 py-2 bg-slate-50 text-slate-300 rounded-xl font-bold text-xs cursor-not-allowed border border-slate-100 flex items-center gap-1.5"><span class="material-symbols-outlined text-[15px]">cancel</span>ยกเลิก</button>`
          }
    </div>
</div>`;
      } else {
        const g = item;
        const canCancelAnyGroup = g.bookings.some((b) => b.can_cancel);
        const sortedBookings = [...g.bookings].sort(
          (x, y) => new Date(x.start_datetime) - new Date(y.start_datetime),
        );
        const minDateStr = thaiDateShort(sortedBookings[0].start_datetime);
        const maxDateStr = thaiDateShort(
          sortedBookings[sortedBookings.length - 1].start_datetime,
        );
        const ts = timeFromISO(g.bookings[0].start_datetime),
          te = timeFromISO(g.bookings[0].end_datetime);

        // ตรวจสอบและสลับกลุ่มสีของการ์ดแบบกลุ่ม (เมื่อ Approved ทั้งหมด หรือ Rejected ทั้งหมด)
        const allStatuses = g.bookings.map((b) => b.status);
        const uniqueStatuses = [...new Set(allStatuses)];

        let groupBorderClass = "border-l-indigo-500";
        let groupBadgeClass = "text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full uppercase tracking-wider";
        let groupBadgeText = "รายการจองแบบต่อเนื่อง";

        if (uniqueStatuses.length === 1) {
          const singleStatus = uniqueStatuses[0];
          if (singleStatus === "Approved") {
            groupBorderClass = "border-l-emerald-500";
            groupBadgeClass = "text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full uppercase tracking-wider";
            groupBadgeText = "รายการจองแบบต่อเนื่อง (อนุมัติทั้งหมด)";
          } else if (singleStatus === "Rejected") {
            groupBorderClass = "border-l-red-400";
            groupBadgeClass = "text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full uppercase tracking-wider";
            groupBadgeText = "รายการจองแบบต่อเนื่อง (ปฏิเสธทั้งหมด)";
          } else if (singleStatus === "Pending") {
            groupBorderClass = "border-l-amber-400";
            groupBadgeClass = "text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full uppercase tracking-wider";
            groupBadgeText = "รายการจองแบบต่อเนื่อง (รออนุมัติทั้งหมด)";
          } else if (singleStatus === "Cancelled") {
            groupBorderClass = "border-l-slate-300";
            groupBadgeClass = "text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full uppercase tracking-wider";
            groupBadgeText = "รายการจองแบบต่อเนื่อง (ยกเลิกแล้ว)";
          }
        }

        const slotsHtml = sortedBookings
          .map((b) => {
            const start = thaiDateShort(b.start_datetime);
            const tsSlot = timeFromISO(b.start_datetime),
              teSlot = timeFromISO(b.end_datetime);
            const adminNotesText = b.admin_notes || b.admin_note || "";

            // ตรวจสอบปุ่มจองซ้ำในคิวย่อยแบบกลุ่ม
            const isApproved = b.status === "Approved";
            const subRebookBtn = isApproved
              ? `<button onclick="event.stopPropagation(); rebookFromHistory(${b.booking_id})" class="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all"><span class="material-symbols-outlined text-[13px]">autorenew</span>จองซ้ำ</button>`
              : `<button onclick="event.stopPropagation();" class="px-2.5 py-1.5 bg-slate-50 text-slate-300 border border-slate-100 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-not-allowed" title="จองซ้ำได้เฉพาะรายการที่อนุมัติแล้วเท่านั้น"><span class="material-symbols-outlined text-[13px]">autorenew</span>จองซ้ำ</button>`;

            return `
<div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white border border-slate-150 gap-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer" onclick="event.stopPropagation(); navigate('detail',{detailId:${b.booking_id}})">
    <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2 flex-wrap"><span class="text-xs font-bold text-slate-400">#${b.booking_id}</span>${badge(b.status)}</div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span><span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${tsSlot} – ${teSlot} น.</span></div>
        ${b.reject_reason ? `<div class="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-1"><strong>เหตุผลที่ปฏิเสธ:</strong> ${b.reject_reason}</div>` : ""}
        ${adminNotesText ? `<div class="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mt-1"><strong>หมายเหตุอนุมัติ:</strong> ${adminNotesText}</div>` : ""}
    </div>
    <div class="flex-shrink-0 self-end sm:self-center flex gap-1.5 items-center">
        ${subRebookBtn}
        ${b.can_cancel
                ? `<button onclick="event.stopPropagation(); openCancelModal(${b.booking_id})" class="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-bold text-[10px] hover:bg-red-100 border border-red-100 transition-all">ยกเลิกคิวนี้</button>`
                : `<span class="text-[10px] text-slate-300 font-semibold px-2">ยกเลิกไม่ได้</span>`
              }
    </div>
</div>`;
          })
          .join("");

        return `
<details class="bg-white border border-slate-200 border-l-4 ${groupBorderClass} rounded-xl shadow-sm overflow-hidden group/details">
    <summary class="p-5 cursor-pointer list-none flex flex-col md:flex-row md:items-center justify-between gap-4 select-none outline-none [&::-webkit-details-marker]:hidden">
        <div class="flex-1 space-y-2 min-w-0 ${opacityClass}">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[11px] font-bold ${groupBadgeClass}">${groupBadgeText}</span>
                <span class="text-slate-400 text-xs font-semibold">มีรายการจองทั้งหมด ${g.bookings.length} วัน</span>
            </div>
            <h3 class="text-base font-bold text-slate-800 truncate">${g.room_name} (${g.room_code})</h3>
            <p class="text-sm text-slate-600">${({
            "teaching": "สอนปกติ/ชดเชย",
            "training": "จัดอบรม/ติว"
          }[g.purpose_type] || "ไม่ทราบ")}: ${g.subject || "—"}</p>
            <div class="flex flex-wrap gap-3 text-xs text-slate-500">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${minDateStr} – ${maxDateStr}</span>
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
            </div>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0 self-end md:self-center">
            ${canCancelAnyGroup
            ? `<button onclick="event.stopPropagation(); openCancelGroupModal('${g.groupId}')" class="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"><span class="material-symbols-outlined text-[15px]">event_busy</span>ยกเลิกทั้งกลุ่ม</button>`
            : ""
          }
            <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 text-slate-500 group-open/details:rotate-180 transition-transform duration-200"><span class="material-symbols-outlined text-[18px]">expand_more</span></div>
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

function setMbTab(t) {
  mbTab = t;
  renderApp();
}

function openCancelModal(id) {
  cancelId = id;
  document.getElementById("cancelId").textContent = "#" + id;
  document.getElementById("cancelModal").classList.remove("hidden");
}

function closeCancelModal() {
  document.getElementById("cancelModal").classList.add("hidden");
}

async function doCancelBooking() {
  closeCancelModal();
  try {
    await api.patch(`/api/bookings/${cancelId}/cancel/`, {});
    await loadMyBookings();
    showToast("ยกเลิกการจองเรียบร้อยแล้ว", "cancel");
    renderApp();
  } catch (err) {
    showApiError(err);
  }
}

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
    await loadMyBookings();
    showToast("ยกเลิกการจองแบบกลุ่มเรียบร้อยแล้ว", "cancel");
    renderApp();
  } catch (err) {
    showApiError(err);
  }
}

window.openCancelGroupModal = openCancelGroupModal;
window.closeCancelGroupModal = closeCancelGroupModal;
window.doCancelGroupBooking = doCancelGroupBooking;