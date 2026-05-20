const API_BASE = "";

const api = (() => {
  function getCsrf() {
    const cookie = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("csrftoken="));
    return cookie ? cookie.split("=")[1].trim() : "";
  }

  async function request(method, path, body = null) {
    const headers = { "Content-Type": "application/json" };
    const csrf = getCsrf();
    if (csrf) headers["X-CSRFToken"] = csrf;

    const opts = { method, headers, credentials: "same-origin" };
    if (body !== null) opts.body = JSON.stringify(body);

    let resp;
    try {
      resp = await fetch(API_BASE + path, opts);
    } catch (err) {
      throw new Error(
        "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต",
      );
    }

    if (resp.status === 401 || resp.status === 403) {
      window.location.href = "/login/";
      return;
    }

    if (resp.status === 204) return null;

    let data;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const msg =
        data?.detail ||
        data?.error ||
        data?.message ||
        `เกิดข้อผิดพลาด (${resp.status})`;
      throw Object.assign(new Error(msg), { status: resp.status, data });
    }
    return data;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),
  };
})();

function showToast(msg, icon = "check_circle") {
  const t = document.getElementById("toast");
  if (!t) return;
  document.getElementById("toastMsg").textContent = msg;
  document.getElementById("toastIcon").textContent = icon;
  t.style.opacity = "1";
  t.style.pointerEvents = "auto";
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.pointerEvents = "none";
  }, 3000);
}

function showApiError(err) {
  console.error(err);
  showToast(err.message || "เกิดข้อผิดพลาด", "error");
}

const MONTHS_TH = [
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
const MONTHS_TH_S = [
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
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const DAYS_TH_L = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

function toBE(y) {
  return y + 543;
}
function isToday(y, m, d) {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
}
function thaiDateShort(isoStr) {
  const d = new Date(isoStr);
  return `${d.getDate()} ${MONTHS_TH_S[d.getMonth()]} ${toBE(d.getFullYear())}`;
}
function thaiDateTime(isoStr) {
  const d = new Date(isoStr);
  return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${toBE(d.getFullYear())} เวลา ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} น.`;
}
function timeFromISO(isoStr) {
  const d = new Date(isoStr);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function badge(status) {
  const cfg = {
    Pending: ["badge-pending", "pending", "รออนุมัติ"],
    Approved: ["badge-approved", "check_circle", "อนุมัติแล้ว"],
    Rejected: ["badge-rejected", "cancel", "ไม่อนุมัติ"],
    Cancelled: ["badge-rejected", "block", "ยกเลิกแล้ว"],
  }[status] || ["badge-pending", "help", "ไม่ทราบ"];
  return `<span class="${cfg[0]} px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
        <span class="material-symbols-outlined text-[12px]">${cfg[1]}</span>${cfg[2]}</span>`;
}

// ═══════════════════════════════════════════════════════════════════
// CANCEL GROUP MODAL  (recurring group booking)
// ═══════════════════════════════════════════════════════════════════
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
    // ยิง PATCH คำขอเพื่อยกเลิกการจองแบบกลุ่มไปยังระบบหลังบ้าน
    await api.patch(`/api/bookings/recurring/${cancelGroupId}/cancel/`, {});
    await loadMyBookings();
    showToast("ยกเลิกการจองแบบกลุ่มเรียบร้อยแล้ว", "cancel");
    navigate(curView === "detail" ? "my-bookings" : curView);
  } catch (err) {
    showApiError(err);
  }
}

// ฟังก์ชันดึงรายการห้องโปรดจากเซิร์ฟเวอร์
async function loadFavRooms() {
  try {
    const data = await api.get("/api/rooms/favourites/");
    favRooms = data || [];
  } catch (err) {
    favRooms = [];
    console.error("Failed to load favourites:", err);
  }
}

// ฟังก์ชันสลับสถานะบันทึกห้องโปรด (POST /api/rooms/{id}/favourite/)
async function toggleFavourite(roomId, event) {
  if (event) event.stopPropagation(); // ป้องกันการเปลี่ยนหน้าจอเมื่อกดดาว
  try {
    await api.post(`/api/rooms/${roomId}/favourite/`, {});
    // อัปเดตรายการห้องโปรดใหม่และสั่งวาดห้องบนแดชบอร์ดใหม่ทันที
    await loadFavRooms();
    redrawRooms();
    showToast("อัปเดตห้องโปรดเรียบร้อยแล้ว", "grade");
  } catch (err) {
    showApiError(err);
  }
}

// ผูกฟังก์ชันเข้ากับ window เพื่อความปลอดภัยในการเรียกใช้งานจากแบบฟอร์มภายนอก
window.toggleFavourite = toggleFavourite;
