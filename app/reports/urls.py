from django.urls import path
from reports import views

app_name = "reports"

urlpatterns = [
    # สถิติ JSON (FR-RPT-04)
    path("summary/", views.report_summary, name="summary"),

    # Export (FR-RPT-03)
    path("export/csv/", views.export_csv, name="export_csv"),
    path("export/excel/", views.export_excel, name="export_excel"),
]
