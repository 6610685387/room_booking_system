"use strict";

let allBookingsFilter = "all";
let allBookingsRooms = [];
let isRoomFilterInitialized = false;

const STATUS_TH = {
  Pending: "รออนุมัติ",
  Approved: "อนุมัติแล้ว",
  Rejected: "ไม่อนุมัติ",
  Cancelled: "ยกเลิกแล้ว",
};

const STATUS_BADGE = {
  Pending: "badge-pending",
  Approved: "badge-approved",
  Rejected: "badge-rejected",
  Cancelled: "bg-slate-100 text-slate-500 border border-slate-200",
};

const STATUS_BORDER = {
  Pending: "border-l-amber-400",
  Approved: "border-l-emerald-500",
  Rejected: "border-l-red-400",
  Cancelled: "border-l-slate-300",
};

const STATUS_PRIORITY = { Pending: 0, Approved: 1, Rejected: 2, Cancelled: 3 };

function purposeLabel(b) {
  const prefix = { teaching: "สอนปกติ/ชดเชย", training: "จัดอบรม/ติว" }[b.purpose_type] || "ไม่ทราบ";
  return b.subject ? `${prefix}: ${b.subject}` : prefix;
}

function setAllBookingsFilter(f) {
  allBookingsFilter = f;
  updateAllBookingsTabs();
  redrawAllBookingsList();
}
window.setAllBookingsFilter = setAllBookingsFilter;

function toggleBookingRoom(roomId) {
  const seen = new Set();
  const uniqueRoomIds = [];
  bookings.forEach((b) => {
    const rid = String(b.room?.room_id);
    if (rid && rid !== "undefined" && !seen.has(rid)) {
      seen.add(rid);
      uniqueRoomIds.push(rid);
    }
  });

  if (roomId === "all") {
    const isCurrentlyAll = allBookingsRooms.length === uniqueRoomIds.length;
    allBookingsRooms = isCurrentlyAll ? [] : [...uniqueRoomIds];
  } else {
    const id = String(roomId);
    if (allBookingsRooms.includes(id)) {
      allBookingsRooms = allBookingsRooms.filter((x) => x !== id);
    } else {
      allBookingsRooms = [...allBookingsRooms, id];
    }
  }

  redrawAllBookingsList();
  updateRoomFilterDropdown();
}
window.toggleBookingRoom = toggleBookingRoom;

function closeRoomDropdown() {
  document.getElementById("roomFilterDropdown")?.classList.add("hidden");
}
window.closeRoomDropdown = closeRoomDropdown;

function toggleRoomDropdown(e) {
  e.stopPropagation();
  document.getElementById("roomFilterDropdown")?.classList.toggle("hidden");
}
window.toggleRoomDropdown = toggleRoomDropdown;

function updateRoomFilterDropdown() {
  const container = document.getElementById("roomFilterContainer");
  if (!container) return;
  container.innerHTML = buildRoomFilterHtml();
  document.getElementById("roomFilterDropdown")?.classList.remove("hidden");
}
window.updateRoomFilterDropdown = updateRoomFilterDropdown;

function buildRoomFilterHtml() {
  const uniqueRooms = [];
  const seen = new Set();
  bookings.forEach((b) => {
    const rid = String(b.room?.room_id);
    if (rid && !seen.has(rid)) {
      seen.add(rid);
      uniqueRooms.push({ id: rid, name: b.room?.room_name || "—", code: b.room?.room_code || "" });
    }
  });
  uniqueRooms.sort((a, b) => a.name.localeCompare(b.name, "th"));

  const allChecked = uniqueRooms.length > 0 && allBookingsRooms.length === uniqueRooms.length;

  const activeLabel = allBookingsRooms.length === uniqueRooms.length
    ? "ห้องทั้งหมด"
    : allBookingsRooms.length === 0
      ? "ไม่ได้เลือกห้อง"
      : allBookingsRooms.length === 1
        ? uniqueRooms.find((r) => allBookingsRooms.includes(r.id))?.name || "เลือกห้อง"
        : `${allBookingsRooms.length} ห้อง`;

  const rowAll = `
    <label class="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer" onclick="event.stopPropagation(); toggleBookingRoom('all')">
      <span class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0" style="${allChecked ? 'background:#7e0000;border-color:#7e0000' : 'border-color:#cbd5e1'}">
        ${allChecked ? `<span class="material-symbols-outlined text-white text-[11px]">check</span>` : ""}
      </span>
      <span class="text-sm font-bold text-slate-700">ทั้งหมด</span>
    </label>`;

  const rowsRooms = uniqueRooms.map((r) => {
    const checked = allBookingsRooms.includes(r.id);
    return `
    <label class="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer" onclick="event.stopPropagation(); toggleBookingRoom('${r.id}')">
      <span class="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0" style="${checked ? 'background:#7e0000;border-color:#7e0000' : 'border-color:#cbd5e1'}">
        ${checked ? `<span class="material-symbols-outlined text-white text-[11px]">check</span>` : ""}
      </span>
      <span class="text-sm text-slate-700">${r.name} <span class="text-slate-400">(${r.code})</span></span>
    </label>`;
  }).join("");

  return `
<div class="relative" onclick="event.stopPropagation()">
  <button onclick="toggleRoomDropdown(event)"
      class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
    <span class="material-symbols-outlined text-[16px] text-slate-500">filter_list</span>
    ${activeLabel}
    <span class="material-symbols-outlined text-[16px] text-slate-400">expand_more</span>
  </button>
  <div id="roomFilterDropdown" class="hidden absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-2 max-h-72 overflow-y-auto">
    ${rowAll}
    <div class="my-1 border-t border-slate-100"></div>
    ${rowsRooms}
  </div>
</div>`;
}

function vAllBookings() {
  const redirectStatus = sessionStorage.getItem("bookingFilterStatus");
  if (redirectStatus) {
    allBookingsFilter = redirectStatus;
    sessionStorage.removeItem("bookingFilterStatus");
  }

  const tabs = [
    { key: "all", label: "ทั้งหมด" },
    { key: "Pending", label: "รออนุมัติ" },
    { key: "Approved", label: "อนุมัติแล้ว" },
    { key: "Rejected", label: "ไม่อนุมัติ" },
    { key: "Cancelled", label: "ยกเลิกแล้ว" },
  ];

  const counts = { all: bookings.length };
  tabs.slice(1).forEach((t) => {
    counts[t.key] = bookings.filter((b) => b.status === t.key).length;
  });

  const tabsHtml = tabs.map((t) => {
    const active = allBookingsFilter === t.key;
    return `<button onclick="setAllBookingsFilter('${t.key}')"
      class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${active
        ? "bg-white text-slate-800 shadow-sm border border-slate-200"
        : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
      }">
      ${t.label}
      <span class="text-[11px] px-1.5 py-0.5 rounded-full ${active ? "bg-slate-100 text-slate-600" : "bg-slate-200/60 text-slate-400"}">${counts[t.key]}</span>
    </button>`;
  }).join("");

  const allRoomIds = [...new Set(bookings.map(b => String(b.room?.room_id)).filter(Boolean))];
  if (!isRoomFilterInitialized && bookings.length > 0) {
    allBookingsRooms = [...allRoomIds];
    isRoomFilterInitialized = true;
  }

  let filtered = allBookingsFilter === "all"
    ? [...bookings]
    : bookings.filter((b) => b.status === allBookingsFilter);

  filtered = filtered.filter((b) => allBookingsRooms.includes(String(b.room?.room_id)));

  const groupedList = [];
  const seenGroups = {};

  filtered.forEach((b) => {
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

  const finalGroupedList = groupedList.map((item) => {
    if (item.type === "group" && item.bookings.length === 1) {
      return { type: "single", booking: item.bookings[0] };
    }
    return item;
  });

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

  const getGroupPriorityAndDate = (item) => {
    if (item.type === "single") {
      const b = item.booking;
      return {
        priority: STATUS_PRIORITY[b.status] ?? 9,
        date: new Date(b.start_datetime)
      };
    } else {
      const priorities = item.bookings.map((b) => STATUS_PRIORITY[b.status] ?? 9);
      const minPriority = Math.min(...priorities);
      const dates = item.bookings.map((b) => new Date(b.start_datetime));
      const minDate = new Date(Math.min(...dates));
      return {
        priority: minPriority,
        date: minDate
      };
    }
  };

  finalGroupedList.sort((a, b) => {
    const aPast = isPast(a);
    const bPast = isPast(b);
    if (aPast && !bPast) return 1;
    if (!aPast && bPast) return -1;

    const infoA = getGroupPriorityAndDate(a);
    const infoB = getGroupPriorityAndDate(b);

    if (infoA.priority !== infoB.priority) {
      return infoA.priority - infoB.priority;
    }
    return infoA.date - infoB.date;
  });

  const cardsHtml = finalGroupedList.length
    ? finalGroupedList.map((item) => {
      const itemPast = isPast(item);
      const opacityClass = itemPast ? "opacity-60 grayscale-[30%]" : "";

      if (item.type === "single") {
        return bookingCard(item.booking, opacityClass);
      } else {
        return groupCard(item, opacityClass);
      }
    }).join("")
    : `<div class="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
         <span class="material-symbols-outlined text-5xl block mb-2">search_off</span>
         <p class="font-medium">ไม่มีรายการ</p>
       </div>`;

  return `
<div class="p-6 sm:p-8 max-w-4xl" onclick="closeRoomDropdown()">
    <header class="mb-5">
        <h2 class="text-2xl font-bold text-slate-800">รายการจองทั้งหมด</h2>
        <p class="text-slate-500 text-sm mt-0.5">ทั้งหมด ${bookings.length} รายการ</p>
    </header>

    <div class="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div class="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl flex-wrap" id="allBookingsTabs">
            ${tabsHtml}
        </div>
        <div id="roomFilterContainer">
            ${buildRoomFilterHtml()}
        </div>
    </div>

    <div class="space-y-3" id="allBookingsList">${cardsHtml}</div>
</div>`;
}

function bookingCard(b, opacityClass = "") {
  const start = thaiDateShort(b.start_datetime);
  const ts = timeFromISO(b.start_datetime);
  const te = timeFromISO(b.end_datetime);

  const badgeClass = STATUS_BADGE[b.status] || "badge-pending";
  const borderClass = STATUS_BORDER[b.status] || "border-l-slate-300";
  const labelTh = STATUS_TH[b.status] || b.status;

  const badgeIcon = { Pending: "pending", Approved: "check_circle", Rejected: "cancel", Cancelled: "block" }[b.status] || "help";

  const rejectNote = b.reject_reason?.trim()
    ? `<p class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mt-1"><strong>เหตุผลไม่อนุมัติ:</strong> ${b.reject_reason}</p>`
    : "";

  const approveNote = b.admin_notes?.trim()
    ? `<p class="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-1"><strong>หมายเหตุ:</strong> ${b.admin_notes}</p>`
    : "";

  const actionBtns = b.status === "Pending"
    ? `<div class="flex flex-col gap-2 flex-shrink-0 min-w-[130px]">
         <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
             class="px-4 py-2 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 hover:opacity-90 transition-all"
             style="background:#10b981">
             <span class="material-symbols-outlined text-[15px]">check_circle</span>อนุมัติ
         </button>
         <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
             class="px-4 py-2 rounded-xl font-bold text-sm text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-1.5 transition-all">
             <span class="material-symbols-outlined text-[15px]">cancel</span>ปฏิเสธ
         </button>
       </div>`
    : "";

  return `
<div class="bg-white border border-slate-200 border-l-4 ${borderClass} ${opacityClass} rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:shadow transition-all"
     onclick="viewDetailAdmin(${b.booking_id})">
    <div class="flex-1 space-y-1.5 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="${badgeClass} px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                <span class="material-symbols-outlined text-[11px]">${badgeIcon}</span>${labelTh}
            </span>
        </div>
        <h3 class="font-bold text-slate-800">${b.room?.room_name || "—"} <span class="font-normal text-slate-500 text-sm">(${b.room?.room_code || "—"})</span></h3>
        <p class="text-sm text-slate-600">ผู้จอง: ${b.booker?.displayname_th || "—"}</p>
        <p class="text-sm text-slate-600">${purposeLabel(b)}</p>
        <div class="flex gap-3 text-xs text-slate-500 flex-wrap">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
        </div>
        ${b.additional_requests ? `<p class="text-xs text-slate-400 italic">"${b.additional_requests}"</p>` : ""}
        ${rejectNote}
        ${approveNote}
    </div>
    ${actionBtns}
</div>`;
}

function groupCard(g, opacityClass = "") {
  const canCancelAnyGroup = g.bookings.some((b) => b.status === "Pending");
  const canApproveAnyGroup = g.bookings.some((b) => b.status === "Pending");
  const sortedBookings = [...g.bookings].sort(
    (x, y) => new Date(x.start_datetime) - new Date(y.start_datetime),
  );
  const minDateStr = thaiDateShort(sortedBookings[0].start_datetime);
  const maxDateStr = thaiDateShort(sortedBookings[sortedBookings.length - 1].start_datetime);
  const ts = timeFromISO(g.bookings[0].start_datetime),
    te = timeFromISO(g.bookings[0].end_datetime);

  const allStatuses = g.bookings.map((b) => b.status);
  const uniqueStatuses = [...new Set(allStatuses)];

  let groupBorderClass = "border-l-indigo-500";
  let groupBadgeClass = "text-indigo-800 bg-indigo-100 border border-indigo-300";
  let groupBadgeText = "รายการจองแบบกลุ่ม";

  if (uniqueStatuses.length === 1) {
    const singleStatus = uniqueStatuses[0];
    if (singleStatus === "Approved") {
      groupBorderClass = "border-l-emerald-500";
      groupBadgeClass = "text-emerald-700 bg-emerald-50 border border-emerald-200";
      groupBadgeText = "รายการจองแบบกลุ่ม (อนุมัติทั้งหมด)";
    } else if (singleStatus === "Rejected") {
      groupBorderClass = "border-l-red-400";
      groupBadgeClass = "text-red-700 bg-red-50 border border-red-200";
      groupBadgeText = "รายการจองแบบกลุ่ม (ปฏิเสธทั้งหมด)";
    } else if (singleStatus === "Pending") {
      groupBorderClass = "border-l-amber-400";
      groupBadgeClass = "text-amber-700 bg-amber-50 border border-amber-200";
      groupBadgeText = "รายการจองแบบกลุ่ม (รออนุมัติทั้งหมด)";
    } else if (singleStatus === "Cancelled") {
      groupBorderClass = "border-l-slate-300";
      groupBadgeClass = "text-slate-500 bg-slate-50 border border-slate-200";
      groupBadgeText = "รายการจองแบบกลุ่ม (ยกเลิกแล้ว)";
    }
  }

  const slotsHtml = sortedBookings
    .map((b) => {
      const start = thaiDateShort(b.start_datetime);
      const tsSlot = timeFromISO(b.start_datetime),
        teSlot = timeFromISO(b.end_datetime);
      const labelTh = STATUS_TH[b.status] || b.status;
      const badgeClass = STATUS_BADGE[b.status] || "badge-pending";

      const subActionBtns = b.status === "Pending"
        ? `<div class="flex-shrink-0 flex gap-1.5 self-end sm:self-center">
             <button onclick="event.stopPropagation(); openApprove(${b.booking_id})"
                 class="px-2.5 py-1.5 bg-emerald-500 text-white rounded-lg font-bold text-[10px] hover:bg-emerald-600 transition-all">อนุมัติ</button>
             <button onclick="event.stopPropagation(); openReject(${b.booking_id})"
                 class="px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-[10px] hover:bg-red-100 border border-red-100 transition-all">ปฏิเสธ</button>
           </div>`
        : "";

      return `
<div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-white border border-slate-150 gap-3 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
     onclick="event.stopPropagation(); viewDetailAdmin(${b.booking_id})">
    <div class="min-w-0 flex-1 space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-400">#${b.booking_id}</span>
            <span class="${badgeClass} px-2 py-0.5 rounded-full text-[10px] font-bold">${labelTh}</span>
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${start}</span>
            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${tsSlot} – ${teSlot} น.</span>
        </div>
        ${b.additional_requests ? `<p class="text-xs text-slate-500 italic">"${b.additional_requests}"</p>` : ""}
        ${b.reject_reason ? `<div class="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1 mt-1"><strong>เหตุผลที่ปฏิเสธ:</strong> ${b.reject_reason}</div>` : ""}
        ${b.admin_notes ? `<div class="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-1 mt-1"><strong>หมายเหตุ:</strong> ${b.admin_notes}</div>` : ""}
    </div>
    ${subActionBtns}
</div>`;
    })
    .join("");

  return `
<details class="bg-white border border-slate-200 border-l-4 ${groupBorderClass} ${opacityClass} rounded-xl shadow-sm overflow-hidden group/details">
    <summary class="p-5 cursor-pointer list-none flex flex-col md:flex-row md:items-center justify-between gap-4 select-none outline-none [&::-webkit-details-marker]:hidden">
        <div class="flex-1 space-y-2 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="${groupBadgeClass} px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">${groupBadgeText}</span>
                <span class="text-slate-400 text-xs font-semibold">มีรายการจองทั้งหมด ${g.bookings.length} วัน</span>
            </div>
            <h3 class="text-base font-bold text-slate-800 truncate">${g.room_name} (${g.room_code})</h3>
            <p class="text-sm text-slate-600">ผู้จอง: ${sortedBookings[0].booker?.displayname_th || "—"}</p>
            <p class="text-sm text-slate-600">${purposeLabel(sortedBookings[0])}</p>
            <div class="flex flex-wrap gap-3 text-xs text-slate-500">
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">calendar_month</span>${minDateStr} – ${maxDateStr}</span>
                <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">schedule</span>${ts} – ${te} น.</span>
            </div>
            ${sortedBookings[0].additional_requests ? `<p class="text-xs text-slate-400 italic">"${sortedBookings[0].additional_requests}"</p>` : ""}
        </div>
        <div class="flex items-center gap-2.5 flex-wrap flex-shrink-0 self-end md:self-center">
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

function vDetailAdmin() {
  const b = bookings.find(
    (x) => x.booking_id === Number(curDetailId) || String(x.booking_id) === String(curDetailId),
  );
  if (!b) {
    return `<div class="p-6 sm:p-8 text-center text-slate-400"><span class="material-symbols-outlined text-5xl block mb-2">search_off</span>ไม่พบข้อมูลการจอง</div>`;
  }

  const sCfg = {
    Pending: { bar: "bg-amber-100 border-amber-200 text-amber-700", label: "รออนุมัติ", ping: true },
    Approved: { bar: "bg-green-100 border-green-200 text-green-700", label: "อนุมัติแล้ว", ping: false },
    Rejected: { bar: "bg-red-100 border-red-200 text-red-700", label: "ไม่อนุมัติ", ping: false },
    Cancelled: { bar: "bg-slate-100 border-slate-200 text-slate-600", label: "ยกเลิกแล้ว", ping: false },
  }[b.status] || { bar: "bg-slate-100 border-slate-200 text-slate-600", label: b.status, ping: false };

  const start = thaiDateShort(b.start_datetime);
  const end = thaiDateShort(b.end_datetime);
  const ts = timeFromISO(b.start_datetime);
  const te = timeFromISO(b.end_datetime);
  const created = b.created_at ? thaiDateTime(b.created_at) : "—";

  const isGroup = b.recurring_group_id && bookings.filter((x) => String(x.recurring_group_id) === String(b.recurring_group_id)).length > 1;
  const groupBookings = isGroup ? bookings.filter((x) => String(x.recurring_group_id) === String(b.recurring_group_id)) : [];
  const hasPendingInGroup = groupBookings.some((x) => x.status === "Pending");

  const groupApproveBtn = (isGroup && hasPendingInGroup)
    ? `<button onclick="event.stopPropagation(); openApproveGroup('${b.recurring_group_id}')"
        class="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-sm"
        style="background:#10b981">
        <span class="material-symbols-outlined text-[18px]">check_circle</span>อนุมัติการจองทั้งกลุ่ม
       </button>`
    : "";

  const groupCancelBtn = (isGroup && b.status !== "Approved" && groupBookings.some((x) => x.status === "Pending"))
    ? `<button onclick="event.stopPropagation(); openCancelGroupModal('${b.recurring_group_id}')"
        class="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 transition-all">
        <span class="material-symbols-outlined text-[18px]">event_busy</span>ยกเลิกการจองทั้งกลุ่ม
      </button>`
    : "";

  return `
<div class="p-6 sm:p-8">
    <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div class="flex items-center gap-3">
            <button onclick="history.back()"
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
                <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wider">ข้อมูลการจอง</h3>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><p class="text-xs text-slate-400 font-bold mb-1">ห้อง</p><p class="font-bold text-slate-800">${b.room?.room_name || "—"} (${b.room?.room_code || "—"})</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">ผู้จอง</p><p class="font-bold text-slate-800">${b.booker?.displayname_th || "—"}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วัตถุประสงค์</p><p class="font-medium">${purposeLabel(b)}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">เวลา</p><p class="font-medium">${ts} – ${te} น.</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วันที่เริ่มต้น</p><p class="font-medium">${start}</p></div>
                    <div><p class="text-xs text-slate-400 font-bold mb-1">วันที่สิ้นสุด</p><p class="font-medium">${end}</p></div>
                    ${b.additional_requests ? `<div class="col-span-2"><p class="text-xs text-slate-400 font-bold mb-1">คำขอเพิ่มเติม</p><p class="text-sm text-slate-600">${b.additional_requests}</p></div>` : ""}
                </div>
            </div>
            ${b.reject_reason ? `<div class="p-4 bg-red-50 border border-red-200 rounded-2xl"><p class="text-sm font-bold text-red-700 flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>เหตุผลการปฏิเสธจากเจ้าหน้าที่</p><p class="text-sm text-red-600">${b.reject_reason}</p></div>` : ""}
            ${b.admin_notes ? `<div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl"><p class="text-sm font-bold text-emerald-700 flex items-center gap-2 mb-1"><span class="material-symbols-outlined text-[16px]">info</span>หมายเหตุการอนุมัติจากเจ้าหน้าที่</p><p class="text-sm text-emerald-600">${b.admin_notes}</p></div>` : ""}
        </div>

        <div class="col-span-12 lg:col-span-5 space-y-4">
            ${b.status === "Pending" ? `
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
                <h3 class="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4">การดำเนินการ</h3>
                <button onclick="openApprove(${b.booking_id})" class="w-full py-3 text-white rounded-xl font-bold text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all" style="background:#10b981">
                    <span class="material-symbols-outlined text-[18px]">check_circle</span>อนุมัติการจอง
                </button>
                <button onclick="openReject(${b.booking_id})" class="w-full py-3 text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    <span class="material-symbols-outlined text-[18px]">cancel</span>ปฏิเสธการจอง
                </button>
            </div>
            ` : ""}
            ${groupApproveBtn}
            ${groupCancelBtn}
        </div>
    </div>
</div>`;
}

function updateAllBookingsTabs() {
  const tabsContainer = document.getElementById("allBookingsTabs");
  if (!tabsContainer) return;

  const tabs = [
    { key: "all", label: "ทั้งหมด" },
    { key: "Pending", label: "รออนุมัติ" },
    { key: "Approved", label: "อนุมัติแล้ว" },
    { key: "Rejected", label: "ไม่อนุมัติ" },
    { key: "Cancelled", label: "ยกเลิกแล้ว" },
  ];

  const counts = { all: bookings.length };
  tabs.slice(1).forEach((t) => {
    counts[t.key] = bookings.filter((b) => b.status === t.key).length;
  });

  const tabsHtml = tabs.map((t) => {
    const active = allBookingsFilter === t.key;
    return `<button onclick="setAllBookingsFilter('${t.key}')"
      class="px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${active
        ? "bg-white text-slate-800 shadow-sm border border-slate-200"
        : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
      }">
      ${t.label}
      <span class="text-[11px] px-1.5 py-0.5 rounded-full ${active ? "bg-slate-100 text-slate-600" : "bg-slate-200/60 text-slate-400"}">${counts[t.key]}</span>
    </button>`;
  }).join("");

  tabsContainer.innerHTML = tabsHtml;
}

function redrawAllBookingsList() {
  const container = document.getElementById("allBookingsList");
  if (!container) return;

  let filtered = allBookingsFilter === "all"
    ? [...bookings]
    : bookings.filter((b) => b.status === allBookingsFilter);

  filtered = filtered.filter((b) => allBookingsRooms.includes(String(b.room?.room_id)));

  const groupedList = [];
  const seenGroups = {};

  filtered.forEach((b) => {
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

  const finalGroupedList = groupedList.map((item) => {
    if (item.type === "group" && item.bookings.length === 1) {
      return { type: "single", booking: item.bookings[0] };
    }
    return item;
  });

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

  const getGroupPriorityAndDate = (item) => {
    if (item.type === "single") {
      const b = item.booking;
      return {
        priority: STATUS_PRIORITY[b.status] ?? 9,
        date: new Date(b.start_datetime)
      };
    } else {
      const priorities = item.bookings.map((b) => STATUS_PRIORITY[b.status] ?? 9);
      const minPriority = Math.min(...priorities);
      const dates = item.bookings.map((b) => new Date(b.start_datetime));
      const minDate = new Date(Math.min(...dates));
      return {
        priority: minPriority,
        date: minDate
      };
    }
  };

  finalGroupedList.sort((a, b) => {
    const aPast = isPast(a);
    const bPast = isPast(b);
    if (aPast && !bPast) return 1;
    if (!aPast && bPast) return -1;

    const infoA = getGroupPriorityAndDate(a);
    const infoB = getGroupPriorityAndDate(b);

    if (infoA.priority !== infoB.priority) {
      return infoA.priority - infoB.priority;
    }
    return infoA.date - infoB.date;
  });

  const cardsHtml = finalGroupedList.length
    ? finalGroupedList.map((item) => {
      const itemPast = isPast(item);
      const opacityClass = itemPast ? "opacity-60 grayscale-[30%]" : "";

      if (item.type === "single") {
        return bookingCard(item.booking, opacityClass);
      } else {
        return groupCard(item, opacityClass);
      }
    }).join("")
    : `<div class="text-center py-16 text-slate-400 bg-white border border-slate-200 rounded-2xl">
         <span class="material-symbols-outlined text-5xl block mb-2">search_off</span>
         <p class="font-medium">ไม่มีรายการ</p>
       </div>`;

  container.innerHTML = cardsHtml;
}