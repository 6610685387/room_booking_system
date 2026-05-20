"""
export_service.py
=================
แปลงข้อมูล (headers, rows) เป็น CSV หรือ Excel bytes
ไม่รู้จัก Django / DRF ใดๆ — pure Python เพื่อ testability สูงสุด
"""

import csv
import io

import openpyxl
from openpyxl.styles import (
    Alignment,
    Font,
    PatternFill,
    Border,
    Side,
)
from openpyxl.utils import get_column_letter



# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------

def build_csv_bytes(headers: list[str], rows: list[list], encoding: str = "utf-8-sig") -> bytes:
    """
    สร้าง CSV bytes จาก list ธรรมดา
    ใช้ utf-8-sig เพื่อให้ Excel เปิดได้ถูกต้องโดยไม่ encoding issue
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    # Header row
    if headers:
        writer.writerow(headers)

    # Data rows
    if rows:
        writer.writerows(rows)

    return buffer.getvalue().encode(encoding)


# ---------------------------------------------------------------------------
# Excel Export
# ---------------------------------------------------------------------------

_HEADER_FILL = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
_HEADER_FONT = Font(bold=True, color="FFFFFF", name="TH Sarabun New", size=12)
_DATA_FONT = Font(name="TH Sarabun New", size=11)
_THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
_CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
_LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)

# คอลัมน์ที่ควร center-align (ตรวจสอบจากชื่อ Header ภาษาไทย)
_CENTER_HEADERS = {
    "รหัสการจอง", "รหัสห้อง", "เวลาเริ่มต้น", "เวลาสิ้นสุด",
    "สถานะ", "วัตถุประสงค์", "รหัสวิชา", "หลักสูตร",
}

# ความกว้างคอลัมน์ (ตรวจสอบจากชื่อ Header ภาษาไทย)
_COL_WIDTHS: dict[str, float] = {
    "รหัสการจอง": 12,
    "ผู้จอง": 22,
    "ภาควิชา": 22,
    "รหัสห้อง": 12,
    "ชื่อห้อง": 20,
    "เวลาเริ่มต้น": 18,
    "เวลาสิ้นสุด": 18,
    "วัตถุประสงค์": 16,
    "สถานะ": 14,
    "รหัสวิชา": 14,
    "ชื่อวิชา": 28,
    "หลักสูตร": 16,
    "หัวข้ออบรม": 30,
}


def build_excel_bytes(headers: list[str], rows: list[list], sheet_title: str = "รายงานการจองห้อง") -> bytes:
    """
    สร้าง Excel (.xlsx) bytes จาก list ธรรมดา
    - Header row: พื้นหลังน้ำเงิน, ตัวอักษรขาว, bold
    - Data rows: สลับสีขาว/เทาอ่อน
    - Auto column width
    - Freeze panes ที่ row 2
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title[:31]  # Excel จำกัด sheet name 31 ตัวอักษร

    if not headers:
        return b""

    # --- Header row ---
    for col_idx, header_text in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header_text)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = _CENTER
        cell.border = _THIN_BORDER

    ws.row_dimensions[1].height = 28

    # --- Data rows ---
    alt_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")

    for row_idx, row_data in enumerate(rows, start=2):
        is_alt = (row_idx % 2 == 0)
        for col_idx, (header_text, value) in enumerate(zip(headers, row_data), start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = _DATA_FONT
            cell.border = _THIN_BORDER
            
            # จัดตำแหน่ง
            if header_text in _CENTER_HEADERS:
                cell.alignment = _CENTER
            else:
                cell.alignment = _LEFT
                
            if is_alt:
                cell.fill = alt_fill

    # --- Column widths ---
    for col_idx, header_text in enumerate(headers, start=1):
        width = _COL_WIDTHS.get(header_text, 16)
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    # --- Freeze panes (header row ติดอยู่เสมอเมื่อ scroll) ---
    ws.freeze_panes = "A2"

    # --- Auto filter ---
    ws.auto_filter.ref = ws.dimensions

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()