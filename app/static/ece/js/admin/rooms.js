/**
 * rooms.js — Rooms management, save/edit form handlers & custom styled delete modals
 */
"use strict";

let editRoomId = null;
let pendingDeleteRoomId = null;

function vRooms() {
  const cards = rooms
    .map(
      (r) => `
<div onclick="openEditRoom(${r.room_id})" class="room-card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-red-800 transition-all">
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
            <span>${{ "Meeting Room": "ห้องประชุม", "Classroom": "ห้องเรียน" }[r.room_type] || "ไม่ทราบ"}</span>
        </div>
        <div class="flex gap-2 mt-3">
            <button onclick="event.stopPropagation(); openEditRoom(${r.room_id})"
                class="flex-1 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[14px]">edit</span>แก้ไข
            </button>
            <button onclick="event.stopPropagation(); toggleRoomActive(${r.room_id}, ${r.is_active !== false})"
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
    await renderCurrentView();
    showToast(
      !currentlyActive ? "เปิดใช้งานห้องแล้ว" : "ปิดห้องชั่วคราวแล้ว",
      "check_circle",
    );
  } catch (err) {
    showApiError(err);
  }
}

function openAddRoom() {
  editRoomId = null;
  document.getElementById("roomModalTitle").textContent = "เพิ่มห้องใหม่";
  ["rmCode", "rmName", "rmSeats"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const imgEl = document.getElementById("rmImage");
  if (imgEl) imgEl.value = "";

  const btnDelete = document.getElementById("btnDeleteRoom");
  if (btnDelete) btnDelete.classList.add("hidden");

  document.getElementById("rmType").value = "Meeting Room";
  const isBlackoutEl = document.getElementById("isBlackout");
  if (isBlackoutEl) isBlackoutEl.checked = false;
  if (typeof toggleBlackoutFields === "function") toggleBlackoutFields();
  document.getElementById("roomModal").classList.remove("hidden");
}

function openEditRoom(roomId) {
  const r = rooms.find(
    (x) => x.room_id === roomId || String(x.room_id) === String(roomId),
  );
  if (!r) return;
  editRoomId = roomId;

  // 1. จัดการข้อมูลพื้นฐานของห้อง (เช็คก่อนเซ็ตค่า)
  const elTitle = document.getElementById("roomModalTitle");
  if (elTitle) elTitle.textContent = "แก้ไขห้อง";

  const elCode = document.getElementById("rmCode");
  if (elCode) elCode.value = r.room_code || "";

  const elName = document.getElementById("rmName");
  if (elName) elName.value = r.room_name || "";

  const elType = document.getElementById("rmType");
  if (elType) elType.value = r.room_type || "Meeting Room";

  const elSeats = document.getElementById("rmSeats");
  if (elSeats) elSeats.value = r.capacity || "";

  // 2. รีเซ็ต Blackout checkbox (แต่ละการแก้ไขเริ่มต้นใหม่)
  const elBlackout = document.getElementById("isBlackout");
  if (elBlackout) elBlackout.checked = false;

  // 3. จัดการฟอร์ม Blackout (ป้องกัน Error ถ้ายังไม่ได้ใส่ HTML)
  const boStart = document.getElementById("modalBoStart");
  if (boStart) boStart.value = "";

  const boEnd = document.getElementById("modalBoEnd");
  if (boEnd) boEnd.value = "";

  const boReason = document.getElementById("modalBoReason");
  if (boReason) boReason.value = "";

  // 4. เรียกฟังก์ชันซ่อน/แสดงฟอร์ม Blackout (ต้องมีฟังก์ชันนี้ในไฟล์ด้วย)
  if (typeof toggleBlackoutFields === 'function') {
    toggleBlackoutFields();
  }

  // 5. จัดการรูปภาพและปุ่มลบ
  const imgEl = document.getElementById("rmImage");
  if (imgEl) imgEl.value = "";

  const btnDelete = document.getElementById("btnDeleteRoom");
  if (btnDelete) btnDelete.classList.remove("hidden");

  // 6. เปิด Modal
  const modal = document.getElementById("roomModal");
  if (modal) modal.classList.remove("hidden");
}

function toggleBlackoutFields() {
  const elActive = document.getElementById("isBlackout");
  const blackoutDiv = document.getElementById("blackoutFields");

  if (elActive && blackoutDiv) {
    if (elActive.checked) {
      blackoutDiv.classList.remove("hidden");
    } else {
      blackoutDiv.classList.add("hidden");

      const boStart = document.getElementById("modalBoStart");
      const boEnd = document.getElementById("modalBoEnd");
      const boReason = document.getElementById("modalBoReason");
      if (boStart) boStart.value = "";
      if (boEnd) boEnd.value = "";
      if (boReason) boReason.value = "";
    }
  }
}

function saveRoom() {
  const code = document.getElementById("rmCode").value.trim();
  const name = document.getElementById("rmName").value.trim();

  if (!code || !name) {
    showToast("กรุณากรอกข้อมูลรหัสห้องและชื่อห้องให้ครบ", "error");
    return;
  }

  const isBlackout = document.getElementById("isBlackout")?.checked ?? false;

  if (isBlackout) {
    const startVal = document.getElementById("modalBoStart").value;
    const endVal = document.getElementById("modalBoEnd").value;
    const reasonVal = document.getElementById("modalBoReason").value;

    if (!startVal || !endVal || !reasonVal) {
      showToast("กรุณากรอกเวลาเริ่ม เวลาสิ้นสุด และเหตุผลให้ครบถ้วน", "error");
      return;
    }

    const startDate = new Date(startVal);
    const endDate = new Date(endVal);

    if (endDate <= startDate) {
      showToast("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น", "error");
      return;
    }
  }

  const isEdit = !!editRoomId;
  document.getElementById("saveConfirmTitle").textContent = isEdit
    ? "ยืนยันการแก้ไขข้อมูล"
    : "ยืนยันการเพิ่มห้องใหม่";
  document.getElementById("saveConfirmBody").textContent = isEdit
    ? "คุณต้องการยืนยันบันทึกการแก้ไขข้อมูลห้องเรียนนี้ใช่หรือไม่?"
    : "คุณต้องการยืนยันการสร้างห้องเรียนใหม่นี้ใช่หรือไม่?";

  document.getElementById("roomModal").classList.add("hidden");
  document.getElementById("saveRoomConfirmModal").classList.remove("hidden");
}

function closeSaveConfirmModal() {
  document.getElementById("saveRoomConfirmModal").classList.add("hidden");
  document.getElementById("roomModal").classList.remove("hidden");
}

async function executeSaveRoom() {
  document.getElementById("saveRoomConfirmModal").classList.add("hidden");

  const code = document.getElementById("rmCode").value.trim();
  const name = document.getElementById("rmName").value.trim();
  const type = document.getElementById("rmType").value;
  const seats = document.getElementById("rmSeats").value.trim();
  const isBlackout = document.getElementById("isBlackout")?.checked ?? false;
  const imageInput = document.getElementById("rmImage");

  const formData = new FormData();
  formData.append("room_code", code);
  formData.append("room_name", name);
  formData.append("room_type", type);
  formData.append("capacity", seats !== "" ? Number(seats) : "");

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
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("jwt");
    if (token) headers["Authorization"] = `Bearer ${token}`;

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
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;

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

    const resData = await response.json();

    if (isBlackout) {
      const boData = new FormData();
      // ปรับ id ให้ตรงกับที่ backend ส่งกลับมา (เช่น resData.id หรือ resData.room_id)
      boData.append("room", editRoomId || resData.id || resData.room_id);
      boData.append("start_datetime", document.getElementById("modalBoStart").value);
      boData.append("end_datetime", document.getElementById("modalBoEnd").value);
      boData.append("reason", document.getElementById("modalBoReason").value);

      const boResponse = await fetch("/api/admin/blackout/", {
        method: "POST",
        headers: headers,
        body: boData,
        credentials: "same-origin",
      });

      if (!boResponse.ok) {
        const errorDetail = await boResponse.text();
        console.error("Blackout Error:", errorDetail);
        throw new Error(`บันทึกห้องสำเร็จ แต่สร้าง Blackout ไม่สำเร็จ\nสาเหตุจาก Backend: ${errorDetail}`);
      }
    }

    showToast(
      editRoomId ? "แก้ไขห้องเรียบร้อยแล้ว" : "เพิ่มห้องเรียบร้อยแล้ว",
      "check_circle",
    );

    closeModals();
    await loadRooms();
    await renderCurrentView();
  } catch (err) {
    alert("ไม่สามารถบันทึกข้อมูลได้เนื่องจาก:\n" + err.message);
    document.getElementById("roomModal").classList.remove("hidden");
  }
}

function deleteRoom(roomId) {
  pendingDeleteRoomId = roomId;
  document.getElementById("roomModal").classList.add("hidden");
  document.getElementById("deleteRoomConfirmModal").classList.remove("hidden");
}

function closeDeleteConfirmModal() {
  pendingDeleteRoomId = null;
  document.getElementById("deleteRoomConfirmModal").classList.add("hidden");
  document.getElementById("roomModal").classList.remove("hidden");
}

async function executeDeleteRoom() {
  if (!pendingDeleteRoomId) return;
  document.getElementById("deleteRoomConfirmModal").classList.add("hidden");
  try {
    await api.delete(`/api/admin/req/room/${pendingDeleteRoomId}/`);
    closeModals();
    await loadRooms();
    showToast("ลบห้องเรียบร้อยแล้ว", "delete");
    await renderCurrentView();
  } catch (err) {
    showApiError(err);
    document.getElementById("roomModal").classList.remove("hidden");
  }
}

window.closeSaveConfirmModal = closeSaveConfirmModal;
window.executeSaveRoom = executeSaveRoom;
window.closeDeleteConfirmModal = closeDeleteConfirmModal;
window.executeDeleteRoom = executeDeleteRoom;