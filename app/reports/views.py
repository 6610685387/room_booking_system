"""
reports/views.py
================
Endpoints:
  GET /api/reports/summary/        → สถิติ JSON (FR-RPT-04)
  GET /api/reports/export/csv/     → ดาวน์โหลด CSV (FR-RPT-03)
  GET /api/reports/export/excel/   → ดาวน์โหลด Excel (FR-RPT-03)

ทุก endpoint ต้องการ session login และ role == "admin"
"""

from datetime import date

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from reports.filters import ReportFilterParams
from reports.permissions import IsAdminRole
from reports.services.export_service import build_csv_bytes, build_excel_bytes
from reports.services.report_query_service import get_export_rows, get_summary_statistics

# Permission classes ที่ใช้ร่วมกันทุก view
_ADMIN_PERMISSIONS = [IsAuthenticated, IsAdminRole]


def _filename_suffix(f: ReportFilterParams) -> str:
    """สร้าง suffix สำหรับชื่อไฟล์ export เช่น _2024-01-01_to_2024-03-31"""
    parts = []
    if f.date_from:
        parts.append(f"from_{f.date_from}")
    if f.date_to:
        parts.append(f"to_{f.date_to}")
    if f.purpose_type:
        parts.append(f.purpose_type)
    return ("_" + "_".join(parts)) if parts else ""


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes(_ADMIN_PERMISSIONS)
def report_summary(request):
    """
    GET /api/reports/summary/

    Query params (ทั้งหมด optional):
      date_from     : YYYY-MM-DD
      date_to       : YYYY-MM-DD
      purpose_type  : teaching | training
      program_type  : Bachelor | Master | TEP-TEPE | TU-PINE
      room_id       : int
      status        : Pending | Approved | Rejected | Cancelled

    Response: JSON สถิติรวม
    """
    f = ReportFilterParams.from_query_params(request.query_params)
    data = get_summary_statistics(f)

    return Response(
        {
            "filters_applied": {
                "date_from": str(f.date_from) if f.date_from else None,
                "date_to": str(f.date_to) if f.date_to else None,
                "purpose_type": f.purpose_type,
                "program_type": f.program_type,
                "room_id": f.room_id,
                "status": f.status,
            },
            "statistics": data,
        }
    )


# ---------------------------------------------------------------------------
# Export CSV
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes(_ADMIN_PERMISSIONS)
def export_csv(request):
    """
    GET /api/reports/export/csv/

    Query params: เหมือนกับ /summary/
    Response: file download (.csv, utf-8-sig)
    """
    f = ReportFilterParams.from_query_params(request.query_params)
    
    # 🌟 แก้ให้รับค่า headers กลับมาด้วย
    headers, rows = get_export_rows(f)
    
    # 🌟 ส่ง headers เข้าไปในฟังก์ชันสร้างไฟล์
    csv_bytes = build_csv_bytes(headers, rows)

    filename = f"room_booking_report{_filename_suffix(f)}.csv"
    response = HttpResponse(csv_bytes, content_type="text/csv; charset=utf-8-sig")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# ---------------------------------------------------------------------------
# Export Excel
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes(_ADMIN_PERMISSIONS)
def export_excel(request):
    """
    GET /api/reports/export/excel/

    Query params: เหมือนกับ /summary/
    Response: file download (.xlsx)
    """
    f = ReportFilterParams.from_query_params(request.query_params)
    
    # 🌟 แก้ให้รับค่า headers กลับมาด้วย
    headers, rows = get_export_rows(f)
    
    # 🌟 ส่ง headers เข้าไปในฟังก์ชันสร้างไฟล์
    excel_bytes = build_excel_bytes(headers, rows)

    filename = f"room_booking_report{_filename_suffix(f)}.xlsx"
    response = HttpResponse(
        excel_bytes,
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response