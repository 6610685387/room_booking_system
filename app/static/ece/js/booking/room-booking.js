/**
 * room-booking.js — Booking form, weekly schedules & alternative suggested rooms
 */
"use strict";

function vRoomBooking() {
  const room = rooms.find(
    (r) => r.room_id === Number(curRoomId) || String(r.room_id) === curRoomId,
  );
  if (!room)
    return `<div class="p-8 text-center text-slate-400">ไม่พบข้อมูลห้อง</div>`;

  const draft = activeBookingDraft || {};

  const preDateStart = draft.date_start || calBookDate || "";
  const preDateEnd = draft.date_end || calBookDate || "";
  // Default เวลาเป็นเวลาปัจจุบัน (ปัดขึ้นเป็นชั่วโมงถัดไป)
  const _nowForTime = new Date();
  _nowForTime.setMinutes(0, 0, 0);
  _nowForTime.setHours(_nowForTime.getHours() + (new Date().getMinutes() > 0 ? 1 : 0));
  const _defaultTimeStart = draft.time_start
    ? ""
    : `${String(_nowForTime.getHours()).padStart(2, "0")}:00`;
  const _defaultTimeEnd = draft.time_end
    ? ""
    : `${String(_nowForTime.getHours() + 1 < 24 ? _nowForTime.getHours() + 1 : 23).padStart(2, "0")}:${_nowForTime.getHours() + 1 < 24 ? "00" : "59"}`;
  const preTimeStart = draft.time_start || calBookTimeStart || _defaultTimeStart;
  const preTimeEnd = draft.time_end || calBookTimeEnd || _defaultTimeEnd;
  const prePurpose = draft.purpose_type || "teaching";
  const preSubjCode = draft.subject_code || "";
  const preSubjName = draft.subject_name || "";
  const preProgType = draft.program_type || "";
  const preTopic = draft.training_topic || "";
  const preRequests = draft.additional_requests || "";
  const preSkip = draft.skip_conflicts || false;
  const preDays = draft.days_of_week || [];

  const isSingleDayBooking = !preDateEnd || preDateStart === preDateEnd;
  let checkedDays = new Set(preDays);
  if (checkedDays.size === 0 && preDateStart && !isSingleDayBooking) {
    const [year, month, day] = preDateStart.split("-").map(Number);
    const dObj = new Date(year, month - 1, day);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    checkedDays.add(dayNames[dObj.getDay()]);
  }

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const wdLabels = ["จ.", "อ.", "พ.", "พฤ.", "ศ."];
  const dayPills = weekDays
    .map((d, i) => {
      const checkedAttr = checkedDays.has(d) ? "checked" : "";
      return `<label class="day-pill cursor-pointer" title="${wdLabels[i]}">
    <input type="checkbox" name="rec_day" value="${d}" ${checkedAttr} class="hidden">
    <div class="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 transition-all hover:border-primary hover:text-primary">${wdLabels[i]}</div>
</label>`;
    })
    .join("");

  const imgHtml = room.room_image
    ? `<img src="${room.room_image}" class="absolute inset-0 w-full h-full object-cover">`
    : "";
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // ดาว Favorite สำหรับหน้าจอง
  const isFavRoom = favRooms.some((r) => String(r.room_id) === String(room.room_id));
  const favColorBook = isFavRoom
    ? "text-amber-400 [font-variation-settings:'FILL'_1]"
    : "text-white/70 hover:text-amber-400 [font-variation-settings:'FILL'_0]";
  const favBtnBook = `
    <button onclick="toggleFavourite('${room.room_id}', event); setTimeout(()=>{ const el=document.getElementById('bookFavBtn'); if(el){ const isFav=favRooms.some(r=>String(r.room_id)===String('${room.room_id}')); el.querySelector('span').className='material-symbols-outlined text-[22px] '+(isFav ? 'text-amber-400 [font-variation-settings:\\'FILL\\'_1]' : 'text-white/70 [font-variation-settings:\\'FILL\\'_0]'); } }, 400)"
      id="bookFavBtn"
      class="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center shadow hover:scale-110 transition-all z-20">
      <span class="material-symbols-outlined text-[22px] ${favColorBook}">star</span>
    </button>`;

  // ป้ายเลขห้องมุมรูป
  const roomCodeBadgeBook = `
    <div class="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-black z-20 select-none uppercase tracking-wider shadow">
        ${room.room_code}
    </div>`;

  return `
<div class="p-6 sm:p-8">
    <div class="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <button onclick="clearDraftAndNavigate('dashboard')" class="hover:text-primary font-medium transition-colors">ภาพรวมห้องวันนี้</button>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <span class="text-slate-700 font-bold">${room.room_name} (${room.room_code})</span>
    </div>

    <div class="grid grid-cols-12 gap-6 items-start">
        <div class="col-span-12 lg:col-span-7 space-y-5">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="h-44 relative overflow-hidden bg-slate-100">
                    ${imgHtml}
                    ${favBtnBook}
                    ${roomCodeBadgeBook}
                    <div class="absolute inset-0 flex items-end p-5" style="background:linear-gradient(to top,rgba(0,0,0,.65),transparent)">
                        <div>
                            <h2 class="text-2xl font-bold text-white">${room.room_name}</h2>
                            <div class="flex gap-3 text-white/80 text-sm mt-1">
                                <span><span class="material-symbols-outlined text-[14px] align-middle">groups</span> ${room.capacity} ที่นั่ง</span>
                                <span><span class="material-symbols-outlined text-[14px] align-middle">badge</span> ${room.room_code}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                    <span class="material-symbols-outlined text-slate-400 text-[18px]">calendar_view_week</span>
                    <h3 class="font-bold text-slate-800 text-sm">ตารางการจองรายสัปดาห์</h3>
                </div>
                <div class="p-4 overflow-x-auto" id="scheduleTableWrap"><div class="skeleton h-32 w-full"></div></div>
            </div>
        </div>

        <div class="col-span-12 lg:col-span-5">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-md sticky top-4 overflow-hidden">
                <div class="px-6 py-4 flex items-center gap-2" style="background:linear-gradient(135deg,#7e0000,#a50000)">
                    <span class="material-symbols-outlined text-white/80 text-[19px]">edit_calendar</span>
                    <h3 class="font-bold text-white">ข้อมูลการจอง</h3>
                </div>
                <div class="p-5 space-y-4" id="bookFormBody">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">วัตถุประสงค์</label>
                        <div class="grid grid-cols-2 gap-2">
                            <label class="flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all" id="pl1" ${prePurpose === "teaching" ? 'style="border-color:#7e0000;background:#fff1f2"' : ""}>
                                <input type="radio" name="purp" value="teaching" ${prePurpose === "teaching" ? "checked" : ""} class="accent-red-800" onchange="hlPurpose(1)">
                                <span class="text-sm font-medium">สอนปกติ/ชดเชย</span>
                            </label>
                            <label class="flex items-center gap-2 p-3 border-2 border-slate-200 rounded-xl cursor-pointer hover:border-primary transition-all" id="pl2" ${prePurpose === "training" ? 'style="border-color:#7e0000;background:#fff1f2"' : ""}>
                                <input type="radio" name="purp" value="training" ${prePurpose === "training" ? "checked" : ""} class="accent-red-800" onchange="hlPurpose(2)">
                                <span class="text-sm font-medium">จัดอบรม/ติว</span>
                            </label>
                        </div>
                    </div>

                    <div id="teaching-fields" class="space-y-4 ${prePurpose !== "teaching" ? "hidden" : ""}">
                        <div class="grid grid-cols-3 gap-2">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 mb-1">รหัสวิชา <span class="text-red-500">*</span></label>
                                <input type="text" id="subject_code" placeholder="EEXXX" value="${preSubjCode}" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-xs font-bold text-slate-500 mb-1">ชื่อวิชา <span class="text-red-500">*</span></label>
                                <input type="text" id="subject_name" placeholder="ระบุชื่อวิชา" value="${preSubjName}" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">หลักสูตร (Program Type) <span class="text-red-500">*</span></label>
                            <select id="program_type" class="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                                <option value="" disabled ${!preProgType ? "selected" : ""}>-- เลือกหลักสูตร --</option>
                                <option value="Bachelor" ${preProgType === "Bachelor" ? "selected" : ""}>ปริญญาตรี</option>
                                <option value="Master" ${preProgType === "Master" ? "selected" : ""}>ปริญญาโท</option>
                                <option value="TEP-TEPE" ${preProgType === "TEP-TEPE" ? "selected" : ""}>TEP-TEPE</option>
                                <option value="TU-PINE" ${preProgType === "TU-PINE" ? "selected" : ""}>TU-PINE</option>
                            </select>
                        </div>
                    </div>

                    <div id="training-fields" class="space-y-4 ${prePurpose !== "training" ? "hidden" : ""}">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">หัวข้อการอบรม/ติว (Topic) <span class="text-red-500">*</span></label>
                            <input type="text" id="training_topic" placeholder="ระบุชื่อหัวข้อหรือโครงการ" value="${preTopic}" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">วันที่เริ่ม <span class="text-red-500">*</span></label>
                            <input type="date" id="date_start" value="${preDateStart}" min="${todayStr}" onchange="syncBookingDates('start')" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">วันที่สิ้นสุด <span class="text-red-500">*</span></label>
                            <input type="date" id="date_end" value="${preDateEnd}" min="${todayStr}" onchange="syncBookingDates('end')" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                    </div>

                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">วันในสัปดาห์</label>
                            <button type="button" onclick="toggleAllWeekdays()" id="btnToggleAllDays" class="text-xs font-bold text-primary hover:underline">เลือกทุกวัน</button>
                        </div>
                        <div class="flex gap-2 flex-wrap">${dayPills}</div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">เวลาเริ่ม <span class="text-red-500">*</span></label>
                            <input type="time" id="time_start" value="${preTimeStart}" onchange="autoSetEndTime()" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 mb-1">เวลาสิ้นสุด <span class="text-red-500">*</span></label>
                            <input type="time" id="time_end" value="${preTimeEnd}" class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-1">คำขอเพิ่มเติม (ถ้ามี)</label>
                        <textarea id="additional_requests" rows="2" placeholder="เช่น ต้องการโปรเจคเตอร์, เครื่องเสียง..." class="w-full p-2.5 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:border-primary">${preRequests}</textarea>
                    </div>

                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                            <p class="text-sm font-bold text-slate-700">ข้ามวันที่ชน (Recurring)</p>
                            <p class="text-xs text-slate-400">ข้ามวันที่มีการจองอื่นแล้วโดยอัตโนมัติ</p>
                        </div>
                        <label class="toggle flex items-center cursor-pointer relative w-10 h-5">
                            <input type="checkbox" id="skip_conflicts" ${preSkip ? "checked" : ""} class="sr-only peer">
                            <div class="w-full h-full rounded-full bg-slate-300 transition-colors duration-200 peer-checked:bg-emerald-500"></div>
                            <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-5"></div>
                        </label>
                    </div>

                    <div id="conflictAlert" class="hidden"></div>

                    <button onclick="submitBooking(${room.room_id})" id="submitBtn" class="w-full py-3.5 text-white font-bold rounded-xl text-sm shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2" style="background:#7e0000;box-shadow:0 4px 14px rgba(126,0,0,.25)">
                        <span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>`;
}

function toggleAllWeekdays() {
  const checkboxes = document.querySelectorAll("input[name='rec_day']");
  const anyUnchecked = Array.from(checkboxes).some((cb) => !cb.checked);

  checkboxes.forEach((cb) => {
    cb.checked = anyUnchecked;
    cb.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const btn = document.getElementById("btnToggleAllDays");
  if (btn) btn.textContent = anyUnchecked ? "ล้างทั้งหมด" : "เลือกทุกวัน";
}
window.toggleAllWeekdays = toggleAllWeekdays;

function hlPurpose(n) {
  document.getElementById("pl1").style =
    n === 1 ? "border-color:#7e0000;background:#fff1f2" : "";
  document.getElementById("pl2").style =
    n === 2 ? "border-color:#7e0000;background:#fff1f2" : "";
  document
    .getElementById("teaching-fields")
    .classList.toggle("hidden", n !== 1);
  document
    .getElementById("training-fields")
    .classList.toggle("hidden", n !== 2);
}

function syncBookingDates(triggerSource) {
  const startEl = document.getElementById("date_start");
  const endEl = document.getElementById("date_end");
  if (!startEl || !endEl) return;

  if (triggerSource === "start" && startEl.value && !endEl.value) {
    endEl.value = startEl.value;
  }

  const startVal = startEl.value;
  const endVal = endEl.value;

  if (startVal && startVal === endVal) {
    document.querySelectorAll("input[name='rec_day']").forEach((cb) => {
      cb.checked = false;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const btn = document.getElementById("btnToggleAllDays");
    if (btn) btn.textContent = "เลือกทุกวัน";
  }
}

function parseAndRoundHour(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const h = parseInt(parts[0], 10);
  const m = parts[1] ? parseInt(parts[1], 10) : 0;
  return m >= 30 ? h + 1 : h;
}

async function loadRoomScheduleForView() {
  if (curView !== "room-booking") return;
  const wrap = document.getElementById("scheduleTableWrap");
  if (!wrap) return;

  const today = new Date();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  const y = sunday.getFullYear(),
    m = String(sunday.getMonth() + 1).padStart(2, "0"),
    d = String(sunday.getDate()).padStart(2, "0");
  const weekStart = `${y}-${m}-${d}`;

  const sched = await loadRoomSchedule(curRoomId, weekStart);
  if (!sched) {
    wrap.innerHTML = `<p class="text-xs text-slate-400">ไม่สามารถโหลดตารางได้</p>`;
    return;
  }

  // ปรับการสร้างสล็อตแถวเวลาจาก 12 แถวเป็น 24 แถว (0 - 23 น.)
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const wdLabels = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const MONTHS_TH_SHORT = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  const slotMap = {};
  (sched.slots || []).forEach((s) => {
    const status = s.status || "Approved";
    if (status !== "Approved" && status !== "Pending") return;

    const startHour = parseAndRoundHour(s.start_time);
    const endHour = parseAndRoundHour(s.end_time);
    const safeEndHour = endHour <= startHour ? startHour + 1 : endHour;

    for (let h = startHour; h < safeEndHour; h++) {
      if (!slotMap[s.day]) slotMap[s.day] = {};
      if (
        slotMap[s.day][h] &&
        slotMap[s.day][h].status === "Approved" &&
        status === "Pending"
      )
        continue;
      slotMap[s.day][h] = s;
    }
  });

  const header = wdLabels
    .map((label, i) => {
      const colDate = new Date(sunday);
      colDate.setDate(sunday.getDate() + i);
      const dateNum = colDate.getDate();
      const monthShort = MONTHS_TH_SHORT[colDate.getMonth()];
      const dateVal = `${colDate.getFullYear()}-${String(colDate.getMonth() + 1).padStart(2, "0")}-${String(colDate.getDate()).padStart(2, "0")}`;
      return `<th class="p-2 border border-slate-200 text-slate-600 font-bold text-center text-xs whitespace-nowrap" data-date="${dateVal}">${label} ${dateNum} ${monthShort}</th>`;
    })
    .join("");

  const rows = hours
    .map((h) => {
      const cols = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map((day) => {
          const colDate = new Date(sunday);
          const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
          colDate.setDate(sunday.getDate() + dayIdx);
          const dateVal = `${colDate.getFullYear()}-${String(colDate.getMonth() + 1).padStart(2, "0")}-${String(colDate.getDate()).padStart(2, "0")}`;

          const sl = slotMap[day]?.[h];
          if (sl) {
            const isPending = sl.status === "Pending";
            const cellClass = isPending
              ? "bg-amber-50/80 border-l-2 border-l-amber-500"
              : "bg-red-50/80 border-l-2 border-l-red-500";
            const textClass = isPending ? "text-amber-700" : "text-red-700";
            const statusText = isPending ? " (รออนุมัติ)" : " (ถูกจองแล้ว)";

            return `<td class="p-1 border border-slate-100 ${cellClass}" title="${sl.label}${statusText}"><span class="text-[10px] ${textClass} font-bold truncate block">${sl.label}</span></td>`;
          }
          return `<td class="cal-slot p-2 border border-slate-100 hover:bg-slate-50 transition-colors select-none" data-date="${dateVal}" data-time="${String(h).padStart(2, "0")}:00"></td>`;
        })
        .join("");

      // ปรับรูปแบบเลเบลเวลาด้านหน้าแถวให้อยู่ในรูปแบบ HH:00 ที่สมมาตร (เช่น 00:00, 08:00)
      const timeLabel = String(h).padStart(2, "0") + ":00";
      return `<tr><td class="p-2 border border-slate-200 bg-slate-50 text-slate-400 text-center font-medium text-xs">${timeLabel}</td>${cols}</tr>`;
    })
    .join("");

  const blackoutNote = (sched.blackout_days || []).length
    ? `<p class="text-xs text-red-500 font-medium mt-2 flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">block</span>ปิดปรับปรุง: ${sched.blackout_days.join(", ")}</p>`
    : "";

  wrap.innerHTML = `
<table class="w-full text-xs border-collapse min-w-[700px]">
    <thead><tr class="bg-slate-50"><th class="p-2 border border-slate-200 text-slate-400 font-bold w-14 text-center">เวลา</th>${header}</tr></thead>
    <tbody>${rows}</tbody>
</table>
<div class="flex gap-4 mt-3 text-xs font-bold">
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-red-500 rounded"></span>ถูกจองแล้ว</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 bg-amber-500 rounded"></span>รออนุมัติ</span>
    <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border border-slate-300 bg-white" style="background:#ffffff"></span>ว่าง (ลากเมาส์เพื่อระบุเวลาจอง)</span>
</div>${blackoutNote}`;

  // ── Drag-to-select Logic for Room Schedule ────────────────────────────────
  const table = wrap.querySelector("table");
  if (!table) return;

  let isDragging = false;
  let isSelecting = true;
  let dragStart = null;
  let dragEnd = null;

  table.onmousedown = (e) => {
    const slot = e.target.closest(".cal-slot");
    if (!slot) return;
    isDragging = true;
    isSelecting = !slot.classList.contains("drag-highlight");
    dragStart = slot;
    dragEnd = slot;
    updateHighlightBox();

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        finalizeDrag();
      }
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mouseup", onMouseUp);
  };

  table.onmouseover = (e) => {
    if (!isDragging) return;
    const slot = e.target.closest(".cal-slot");
    if (slot) {
      dragEnd = slot;
      updateHighlightBox();
    }
  };

  function updateHighlightBox() {
    if (!dragStart || !dragEnd) return;
    const d1 = dragStart.dataset.date;
    const d2 = dragEnd.dataset.date;
    const t1 = parseInt(dragStart.dataset.time);
    const t2 = parseInt(dragEnd.dataset.time);

    const minT = Math.min(t1, t2);
    const maxT = Math.max(t1, t2);

    const allTh = Array.from(table.querySelectorAll("th[data-date]")).map(th => th.dataset.date);
    const idx1 = allTh.indexOf(d1);
    const idx2 = allTh.indexOf(d2);
    if (idx1 === -1 || idx2 === -1) return;

    const minDIdx = Math.min(idx1, idx2);
    const maxDIdx = Math.max(idx1, idx2);
    const targetDates = allTh.slice(minDIdx, maxDIdx + 1);

    table.querySelectorAll(".cal-slot.drag-temp").forEach(s => {
        s.classList.remove("drag-temp");
        s.style.backgroundColor = "";
    });

    table.querySelectorAll(".cal-slot").forEach(s => {
      const t = parseInt(s.dataset.time);
      const d = s.dataset.date;
      if (t >= minT && t <= maxT && targetDates.includes(d)) {
        s.classList.add("drag-temp");
        if (isSelecting) {
            s.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
        } else {
            s.style.backgroundColor = "rgba(100, 116, 139, 0.1)";
        }
      }
    });
  }

  function finalizeDrag() {
    table.querySelectorAll(".cal-slot.drag-temp").forEach(s => {
      s.classList.remove("drag-temp");
      s.style.backgroundColor = "";
      if (isSelecting) {
          s.classList.add("drag-highlight");
      } else {
          s.classList.remove("drag-highlight");
      }
    });

    const highlighted = Array.from(table.querySelectorAll(".cal-slot.drag-highlight"));
    if (highlighted.length === 0) return;

    const selectedDates = [...new Set(highlighted.map(s => s.dataset.date))].sort();
    const selectedTimes = highlighted.map(s => parseInt(s.dataset.time));
    const minT = Math.min(...selectedTimes);
    const maxT = Math.max(...selectedTimes);

    const startDate = selectedDates[0];
    const endDate = selectedDates[selectedDates.length - 1];

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const selectedDaysOfWeek = selectedDates.map(d => {
      const [y, m, day] = d.split("-").map(Number);
      return dayNames[new Date(y, m - 1, day).getDay()];
    });

    const startEl = document.getElementById("date_start");
    const endEl = document.getElementById("date_end");
    const tsEl = document.getElementById("time_start");
    const teEl = document.getElementById("time_end");

    if (startEl) startEl.value = startDate;
    if (endEl) endEl.value = endDate;
    if (tsEl) tsEl.value = `${String(minT).padStart(2, "0")}:00`;

    let endH = maxT + 1;
    if (teEl) {
      if (endH >= 24) teEl.value = "23:59";
      else teEl.value = `${String(endH).padStart(2, "0")}:00`;
    }

    document.querySelectorAll("input[name='rec_day']").forEach(cb => {
      cb.checked = selectedDaysOfWeek.includes(cb.value);
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (startEl) startEl.dispatchEvent(new Event("change"));
  }
}

async function submitBooking(roomId) {
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> กำลังส่ง...`;

  const purposeEl = document.querySelector("input[name=purp]:checked");
  const purposeType = purposeEl ? purposeEl.value : "teaching";
  const days = [
    ...document.querySelectorAll("input[name=rec_day]:checked"),
  ].map((c) => c.value);

  const dateStart = document.getElementById("date_start").value;
  const dateEnd = document.getElementById("date_end").value;
  const isSingleDay = !dateEnd || dateStart === dateEnd;

  if (isSingleDay && days.length > 0) {
    showToast("เลือกแค่วันเดียวไม่ต้องส่งวัน", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  const payload = {
    room_id: roomId,
    date_start: dateStart,
    date_end: dateEnd || dateStart,
    days_of_week: null,
    time_start: document.getElementById("time_start").value,
    time_end: document.getElementById("time_end").value,
    purpose_type: purposeType,
    skip_conflicts: document.getElementById("skip_conflicts")?.checked || false,
    additional_requests:
      document.getElementById("additional_requests")?.value || "",
  };

  if (isSingleDay) {
    payload.days_of_week = null;
  } else {
    payload.days_of_week =
      days.length === 0
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : days;
  }

  if (purposeType === "teaching") {
    payload.teaching_info = {
      subject_code: document.getElementById("subject_code")?.value || "",
      subject_name: document.getElementById("subject_name")?.value || "",
      program_type: document.getElementById("program_type")?.value || "",
    };
  } else {
    payload.training_info = {
      topic: document.getElementById("training_topic")?.value || "",
    };
  }

  if (!payload.date_start) {
    showToast("กรอกข้อมูลไม่ครบ: กรุณาระบุวันที่เริ่มการจอง", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (purposeType === "teaching") {
    if (
      !payload.teaching_info.subject_code ||
      !payload.teaching_info.subject_name ||
      !payload.teaching_info.program_type
    ) {
      showToast(
        "กรอกข้อมูลไม่ครบ: กรุณาระบุรหัสวิชา ชื่อวิชา และหลักสูตรให้ครบถ้วน",
        "error",
      );
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
      return;
    }
  } else {
    if (!payload.training_info.topic) {
      showToast("กรอกข้อมูลไม่ครบ: กรุณาระบุหัวข้อการอบรมหรือติว", "error");
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
      return;
    }
  }

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const curTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (payload.date_start < todayStr) {
    showToast("ไม่สามารถเลือกวันที่จองย้อนหลังในอดีตได้", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (payload.date_end && payload.date_start > payload.date_end) {
    showToast("วันที่เริ่มต้องไม่เกิดขึ้นหลังวันที่สิ้นสุด", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (payload.date_start === todayStr && payload.time_start < curTimeStr) {
    showToast(
      `ไม่สามารถเลือกเวลาเริ่มย้อนหลังได้ (เวลาปัจจุบันคือ ${curTimeStr} น.)`,
      "error",
    );
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  if (payload.time_start >= payload.time_end) {
    showToast("เวลาเริ่มต้องเกิดขึ้นก่อนเวลาสิ้นสุด", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  // ── Step 1: Pre-flight conflict check ───────────────────────────────────
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> กำลังตรวจสอบ...`;

  let conflictReport = null;
  try {
    conflictReport = await api.post("/api/bookings/check-conflict/", payload);
  } catch (checkErr) {
    // ถ้า check-conflict ล้มเหลว ให้ข้ามไปส่งจองตรงๆ แทน
    console.warn("Conflict pre-check failed, proceeding to submit:", checkErr);
  }

  if (conflictReport?.has_conflict && !payload.skip_conflicts) {
    showConflictAlert(conflictReport);
    showToast("มีเวลาจองที่ชนกัน กรุณาตรวจสอบด้านล่าง", "error");
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
    return;
  }

  // ซ่อน alert เก่า (กรณี skip_conflicts เปิดอยู่ หรือไม่มี conflict)
  const _conflictEl = document.getElementById("conflictAlert");
  if (_conflictEl) _conflictEl.classList.add("hidden");

  // ── Step 2: Submit booking ───────────────────────────────────────────────
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> กำลังส่ง...`;

  try {
    const result = await api.post("/api/bookings/", payload);
    calBookDate = null;
    calBookKey = null;
    calBookLabel = null;
    savedBookingDraft = null;
    activeBookingDraft = null;
    skipNextDraftCapture = true; // do not re-save draft when leaving room-booking after submit
    await Promise.all([loadMyBookings(), loadAllBookings(), loadAllSchedules()]);

    if (result.skipped_dates && result.skipped_dates.length > 0) {
      const skippedStr = result.skipped_dates.map((d) => thaiDateShort(d)).join(", ");
      showToast(
        `จองสำเร็จ ข้ามรายการที่ชนอัตโนมัติ: ${skippedStr}`,
        "warning",
      );
    } else {
      showToast(
        `ส่งคำขอจอง ${result.booking_ids?.length || 1} รายการเรียบร้อย`,
        "check_circle",
      );
    }
    navigate("my-bookings");
  } catch (err) {
    // Safety net: อาจเกิด race condition หลังผ่าน pre-check
    if (err.status === 409) {
      const fallbackReport = err.data?.report
        ? { ...err.data.report, suggested_rooms: [] }
        : null;
      if (fallbackReport) showConflictAlert(fallbackReport);
      showToast(err.data?.error || "มีเวลาจองที่ชนกัน", "error");
    } else {
      showToast(
        err.data?.error || err.message || "เกิดข้อผิดพลาดในการจอง",
        "error",
      );
    }
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span> ส่งคำขอจอง`;
  }
}

function selectSuggestedRoom(newRoomId) {
  const purposeEl = document.querySelector("input[name=purp]:checked");
  const purposeType = purposeEl ? purposeEl.value : "teaching";
  const days = [
    ...document.querySelectorAll("input[name=rec_day]:checked"),
  ].map((c) => c.value);

  activeBookingDraft = {
    purpose_type: purposeType,
    subject_code: document.getElementById("subject_code")?.value || "",
    subject_name: document.getElementById("subject_name")?.value || "",
    program_type: document.getElementById("program_type")?.value || "",
    training_topic: document.getElementById("training_topic")?.value || "",
    date_start: document.getElementById("date_start").value,
    date_end: document.getElementById("date_end").value,
    days_of_week: days,
    time_start: document.getElementById("time_start").value,
    time_end: document.getElementById("time_end").value,
    additional_requests:
      document.getElementById("additional_requests")?.value || "",
    skip_conflicts: document.getElementById("skip_conflicts")?.checked || false,
  };
  navigate("room-booking", { roomId: newRoomId });
}
window.selectSuggestedRoom = selectSuggestedRoom;

/**
 * showConflictAlert — แสดง conflict alert โดยรับ response จาก /api/bookings/check-conflict/ โดยตรง
 * ไม่ต้อง call API ซ้ำ เพราะ suggested_rooms ถูกส่งมาพร้อมกันแล้ว
 */
function showConflictAlert(conflictReport) {
  const el = document.getElementById("conflictAlert");
  if (!el || !conflictReport) return;

  // ── Suggested rooms ──────────────────────────────────────────────────────
  let suggestionsHtml = "";
  const suggestedRooms = conflictReport.suggested_rooms || [];
  if (suggestedRooms.length > 0) {
    const favIds = new Set(favRooms.map((r) => Number(r.room_id)));
    const sorted = [...suggestedRooms].sort((a, b) => {
      const aF = favIds.has(Number(a.room_id)) ? 1 : 0;
      const bF = favIds.has(Number(b.room_id)) ? 1 : 0;
      return bF - aF;
    });

    const cards = sorted
      .map((r) => {
        const isFav = favIds.has(Number(r.room_id));
        return `
<div class="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-primary transition-all">
    <div class="min-w-0 pr-2">
        <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-bold text-slate-800 text-sm">${r.room_name}</span>
            <span class="text-xs text-slate-400 font-bold">(${r.room_code})</span>
            ${isFav ? `<span class="material-symbols-outlined text-[15px] text-amber-500 [font-variation-settings:'FILL'_1]" title="ห้องโปรด">star</span>` : ""}
        </div>
        <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">groups</span>ความจุ: ${r.capacity} ที่นั่ง</p>
    </div>
    <button onclick="selectSuggestedRoom(${r.room_id})" class="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1 flex-shrink-0 shadow-sm"><span class="material-symbols-outlined text-[14px]">add_circle</span>จองห้องนี้</button>
</div>`;
      })
      .join("");

    suggestionsHtml = `
<div class="mt-3.5 space-y-2">
    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><span class="material-symbols-outlined text-[15px] text-primary">meeting_room</span>ห้องอื่นที่สามารถจองได้ครบทุกวันที่เลือก:</p>
    <div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">${cards}</div>
</div>`;
  }

  // ── Conflict list (booking + blackout) ───────────────────────────────────
  const bookingConflicts = (conflictReport.conflicts || []).map(
    (c) =>
      `<li class="text-xs text-red-700">• ${c.date} ${c.start_time}–${c.end_time} (ถูกจองเรียบร้อยแล้ว)</li>`,
  );
  const blackoutConflicts = (conflictReport.blackouts || []).map(
    (c) =>
      `<li class="text-xs text-orange-700">• ${c.date} — ปิดปรับปรุง${c.reason ? `: ${c.reason}` : ""}</li>`,
  );
  const conflictItems = [...bookingConflicts, ...blackoutConflicts].join("");

  const totalCount =
    (conflictReport.summary?.conflict_count || 0) +
    (conflictReport.summary?.blackout_count || 0);

  el.innerHTML = `
<div class="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-4">
    <div>
        <p class="text-sm font-bold text-red-700 flex items-center gap-2 mb-2"><span class="material-symbols-outlined text-[18px]">warning</span>มีวันที่และช่วงเวลาจองชน (${totalCount} วัน)</p>
        <ul class="space-y-0.5 max-h-32 overflow-y-auto pl-1">${conflictItems}</ul>
        <p class="text-[11px] text-slate-500 mt-2">เปิดสวิตช์ "ข้ามวันที่ชน" ด้านบนเพื่อเลือกจองเฉพาะวันที่ว่าง</p>
    </div>
    ${suggestionsHtml}
</div>`;
  el.classList.remove("hidden");
}

async function rebookFromHistory(bookingId) {
  try {
    showToast("กำลังดึงรายละเอียดข้อมูลจองเดิม...", "autorenew");
    const b = await api.get(`/api/bookings/${bookingId}/?_t=${Date.now()}`);
    if (!b) return;

    activeBookingDraft = {
      purpose_type: b.purpose_type,
      subject_code: b.teaching_info?.subject_code || "",
      subject_name: b.teaching_info?.subject_name || "",
      program_type: b.teaching_info?.program_type || "",
      training_topic: b.training_info?.topic || "",
      date_start: "",
      date_end: "",
      days_of_week: [],
      time_start: timeFromISO(b.start_datetime),
      time_end: timeFromISO(b.end_datetime),
      additional_requests: b.additional_requests || "",
      skip_conflicts: false,
    };

    const roomId = b.room?.room_id || b.room_id;
    navigate("room-booking", { roomId: roomId });
  } catch (err) {
    showApiError(err);
  }
}
window.rebookFromHistory = rebookFromHistory;
// ตั้งเวลาสิ้นสุดอัตโนมัติ +1 ชม. เมื่อผู้ใช้เลือกเวลาเริ่ม
function autoSetEndTime() {
  const startEl = document.getElementById("time_start");
  const endEl = document.getElementById("time_end");
  if (!startEl || !endEl) return;
  const [hStr, mStr] = startEl.value.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const newH = h + 1;
  if (newH >= 24) {
    endEl.value = "23:59";
  } else {
    endEl.value = `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}
window.autoSetEndTime = autoSetEndTime;

/**
 * captureFormDraft — อ่านค่าจากฟอร์มปัจจุบัน แล้วคืนเป็น object draft
 * เรียกโดย handleRoute() ใน core.js ก่อนออกจากหน้า room-booking
 * คืนค่า null ถ้าไม่มีฟอร์มในหน้าจอ (เช่น ยังไม่ render)
 */
function captureFormDraft() {
  const dateStartEl = document.getElementById("date_start");
  if (!dateStartEl) return null; // ฟอร์มยังไม่ถูก render

  const purposeEl = document.querySelector("input[name=purp]:checked");
  const days = [...document.querySelectorAll("input[name=rec_day]:checked")].map(
    (c) => c.value,
  );

  return {
    purpose_type: purposeEl ? purposeEl.value : "teaching",
    subject_code: document.getElementById("subject_code")?.value || "",
    subject_name: document.getElementById("subject_name")?.value || "",
    program_type: document.getElementById("program_type")?.value || "",
    training_topic: document.getElementById("training_topic")?.value || "",
    date_start: document.getElementById("date_start")?.value || "",
    date_end: document.getElementById("date_end")?.value || "",
    days_of_week: days,
    time_start: document.getElementById("time_start")?.value || "",
    time_end: document.getElementById("time_end")?.value || "",
    additional_requests:
      document.getElementById("additional_requests")?.value || "",
    skip_conflicts:
      document.getElementById("skip_conflicts")?.checked || false,
  };
}
window.captureFormDraft = captureFormDraft;