from __future__ import annotations

import io
import os
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from pymongo.collection import Collection

from backend.app.auth.dependencies import get_current_user, require_roles
from backend.app.config import PREDICTIONS_PAGE_SIZE, UPLOADS_DIR
from backend.app.db.mongo import get_database
from backend.app.models.user import UserRole
from backend.app.schemas import (
    DoctorReviewInput,
    ReportResponseSchema,
    ReportUpdateSchema,
)

router = APIRouter(prefix="/api/reports", tags=["Reports Management"])


def serialize_report(doc: dict) -> dict:
    """Helper to convert MongoDB report document to matching ReportResponseSchema format."""
    return {
        "report_id": doc["report_id"],
        "user_id": doc["user_id"],
        "predicted_disease": doc["predicted_disease"],
        "predicted_code": doc["predicted_code"],
        "confidence": doc["confidence"],
        "top_predictions": doc["top_predictions"],
        "model_version": doc["model_version"],
        "model_name": doc["model_name"],
        "processing_time_ms": doc["processing_time_ms"],
        "image_filename": doc["image_filename"],
        "capture_source": doc.get("capture_source", "upload"),
        "doctor_review_status": doc.get("doctor_review_status", "pending"),
        "doctor_review": doc.get("doctor_review"),
        "audit_trail": doc.get("audit_trail", []),
        "is_archived": doc.get("is_archived", False),
        "created_at": doc["created_at"],
        "updated_at": doc.get("updated_at", doc["created_at"]),
    }


@router.get("", response_model=list[ReportResponseSchema])
async def list_reports(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    disease: str | None = None,
    min_confidence: float | None = Query(default=None, ge=0.0, le=1.0),
    start_date: str | None = None,
    end_date: str | None = None,
    user_id: str | None = None,
    sort_by: str = Query(default="newest", pattern="^(newest|oldest|confidence)$"),
    skip: int = 0,
    limit: int = PREDICTIONS_PAGE_SIZE,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions

    # Base query logic
    query: dict = {}

    # Enforce Patient privacy: patients can only access their own non-archived reports
    if current_user["role"] == UserRole.PATIENT.value:
        query["user_id"] = str(current_user["_id"])
        query["is_archived"] = False
    else:
        # Doctors & Admins can query any patient's reports (and filter by user_id if given)
        if user_id:
            query["user_id"] = user_id
        # By default only show non-archived reports
        query["is_archived"] = False

    # Search (report_id or disease name)
    if q:
        query["$or"] = [
            {"report_id": q},
            {"predicted_disease": {"$regex": q, "$options": "i"}},
        ]

    # Filters
    if status_filter:
        query["doctor_review_status"] = status_filter

    if disease:
        query["predicted_disease"] = {"$regex": disease, "$options": "i"}

    if min_confidence is not None:
        query["confidence"] = {"$gte": min_confidence}

    # Date Range Filtering
    if start_date or end_date:
        date_query: dict = {}
        if start_date:
            try:
                date_query["$gte"] = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO format.") from exc
        if end_date:
            try:
                date_query["$lte"] = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO format.") from exc
        query["created_at"] = date_query

    # Sorting
    sort_field = "created_at"
    sort_direction = -1
    if sort_by == "oldest":
        sort_direction = 1
    elif sort_by == "confidence":
        sort_field = "confidence"
        sort_direction = -1

    cursor = (
        coll.find(query)
        .sort(sort_field, sort_direction)
        .skip(skip)
        .limit(limit)
    )

    return [serialize_report(doc) for doc in cursor]


@router.get("/search", response_model=list[ReportResponseSchema])
async def search_reports_redirect(
    q: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    disease: str | None = None,
    min_confidence: float | None = Query(default=None, ge=0.0, le=1.0),
    sort_by: str = "newest",
    skip: int = 0,
    limit: int = PREDICTIONS_PAGE_SIZE,
    current_user: dict = Depends(get_current_user),
):
    """Alias search endpoint mapping to GET /api/reports directly for convenience."""
    return await list_reports(
        q=q,
        status_filter=status_filter,
        disease=disease,
        min_confidence=min_confidence,
        sort_by=sort_by,
        skip=skip,
        limit=limit,
        current_user=current_user,
    )


@router.get("/{reportId}", response_model=ReportResponseSchema)
async def get_report_details(
    reportId: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions

    doc = coll.find_one({"report_id": reportId})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical report not found."
        )

    # Privacy verification
    if current_user["role"] == UserRole.PATIENT.value and doc["user_id"] != str(current_user["_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this report."
        )

    return serialize_report(doc)


@router.get("/image/{reportId}")
async def get_report_image(
    reportId: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions

    doc = coll.find_one({"report_id": reportId})
    if not doc:
        raise HTTPException(status_code=404, detail="Medical report not found.")

    # Privacy check
    if current_user["role"] == UserRole.PATIENT.value and doc["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized.")

    file_path = UPLOADS_DIR / f"{reportId}.jpg"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on the server.")

    return FileResponse(file_path, media_type="image/jpeg")


@router.patch("/{reportId}", response_model=ReportResponseSchema)
async def update_report(
    reportId: str,
    review_input: DoctorReviewInput | None = None,
    archive_input: ReportUpdateSchema | None = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions

    doc = coll.find_one({"report_id": reportId})
    if not doc:
        raise HTTPException(status_code=404, detail="Medical report not found.")

    now = datetime.utcnow()
    update_ops: dict = {"$set": {"updated_at": now}}
    audit_entries = []

    # Handle doctor review updates
    if review_input:
        # Enforce that only Doctors or Admins can review reports
        if current_user["role"] not in [UserRole.DOCTOR.value, UserRole.ADMIN.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only doctors or administrators can submit report reviews."
            )

        review_data = {
            "doctor_id": str(current_user["_id"]),
            "doctor_name": current_user["full_name"],
            "doctor_email": current_user["email"],
            "comments": review_input.comments,
            "status": review_input.status,
            "reviewed_at": now,
        }
        update_ops["$set"]["doctor_review"] = review_data
        update_ops["$set"]["doctor_review_status"] = review_input.status
        audit_entries.append({
            "action": "doctor_reviewed",
            "user_id": str(current_user["_id"]),
            "user_email": current_user["email"],
            "timestamp": now,
            "details": f"Doctor review submitted. Status set to: {review_input.status}"
        })

    # Handle soft archival / delete updates
    if archive_input and archive_input.is_archived is not None:
        # Patients can archive their own reports; Doctors and Admins can archive any report.
        if current_user["role"] == UserRole.PATIENT.value and doc["user_id"] != str(current_user["_id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot archive another user's report."
            )

        update_ops["$set"]["is_archived"] = archive_input.is_archived
        action_name = "report_archived" if archive_input.is_archived else "report_unarchived"
        audit_entries.append({
            "action": action_name,
            "user_id": str(current_user["_id"]),
            "user_email": current_user["email"],
            "timestamp": now,
            "details": f"Report archival status updated to: {archive_input.is_archived}"
        })

    if not review_input and (not archive_input or archive_input.is_archived is None):
        raise HTTPException(status_code=400, detail="No valid update operations provided.")

    # Apply updates and append audit entries
    if audit_entries:
        update_ops["$push"] = {"audit_trail": {"$each": audit_entries}}

    coll.update_one({"report_id": reportId}, update_ops)
    updated_doc = coll.find_one({"report_id": reportId})
    return serialize_report(updated_doc)


@router.delete("/{reportId}")
async def delete_report(
    reportId: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions

    doc = coll.find_one({"report_id": reportId})
    if not doc:
        raise HTTPException(status_code=404, detail="Medical report not found.")

    # Enforce RBAC
    if current_user["role"] == UserRole.PATIENT.value:
        if doc["user_id"] != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Unauthorized.")
        # Patients soft-delete (archive)
        coll.update_one(
            {"report_id": reportId},
            {
                "$set": {"is_archived": True, "updated_at": datetime.utcnow()},
                "$push": {
                    "audit_trail": {
                        "action": "report_archived",
                        "user_id": str(current_user["_id"]),
                        "user_email": current_user["email"],
                        "timestamp": datetime.utcnow(),
                        "details": "Patient archived the report."
                    }
                }
            }
        )
        return {"message": "Report archived successfully."}
    else:
        # Doctors / Admins can permanently hard-delete if desired, or archive.
        # Let's support hard delete for Admins, and soft delete for Doctors.
        if current_user["role"] == UserRole.ADMIN.value:
            # Hard delete
            coll.delete_one({"report_id": reportId})
            # Remove image if exists
            img_path = UPLOADS_DIR / f"{reportId}.jpg"
            if img_path.exists():
                try:
                    os.remove(img_path)
                except Exception:
                    pass
            return {"message": "Report permanently deleted by administrator."}
        else:
            # Doctor soft-delete (archive)
            coll.update_one(
                {"report_id": reportId},
                {
                    "$set": {"is_archived": True, "updated_at": datetime.utcnow()},
                    "$push": {
                        "audit_trail": {
                            "action": "report_archived",
                            "user_id": str(current_user["_id"]),
                            "user_email": current_user["email"],
                            "timestamp": datetime.utcnow(),
                            "details": "Doctor archived the report."
                        }
                    }
                }
            )
            return {"message": "Report archived successfully by doctor."}


@router.get("/download/{reportId}")
async def download_pdf_report(
    reportId: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    coll: Collection = db.predictions

    doc = coll.find_one({"report_id": reportId})
    if not doc:
        raise HTTPException(status_code=404, detail="Medical report not found.")

    # Privacy verification
    if current_user["role"] == UserRole.PATIENT.value and doc["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Unauthorized access to report.")

    # Generate PDF dynamically using ReportLab
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buffer = io.BytesIO()
    pdf_doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()
    
    # Custom Brand Colors
    c_forest = colors.HexColor("#1A2D22")
    c_lime = colors.HexColor("#86D61D")
    c_light_bg = colors.HexColor("#F6F7F2")
    c_border = colors.HexColor("#DBE4D9")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.white,
        spaceAfter=10
    )
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=c_forest,
        spaceBefore=15,
        spaceAfter=10
    )
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor("#1F2723"),
        leading=14
    )
    metadata_style = ParagraphStyle(
        'MetadataText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=colors.HexColor("#5C6A60")
    )

    elements = []

    # 1. Header Banner
    banner_data = [
        [Paragraph("SKINGURU CLINICAL ASSESSMENT REPORT", ParagraphStyle('SubText', fontName='Helvetica-Bold', fontSize=10, textColor=c_lime, spaceAfter=4))],
        [Paragraph(f"Analysis: {doc['predicted_disease']}", title_style)],
        [Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} • Model v{doc['model_version']}", ParagraphStyle('Meta', fontName='Helvetica', fontSize=9, textColor=colors.white))]
    ]
    banner_table = Table(banner_data, colWidths=[530])
    banner_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_forest),
        ('PADDING', (0,0), (-1,-1), 16),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 20),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 20))

    # 2. Main details block (Metadata Table & Optional Image)
    metadata_details = [
        [Paragraph("Report Details", section_style), ""],
        [Paragraph("Report ID:", metadata_style), Paragraph(doc["report_id"], body_style)],
        [Paragraph("Scan Timestamp:", metadata_style), Paragraph(str(doc["created_at"]), body_style)],
        [Paragraph("Model / Ensemble Name:", metadata_style), Paragraph(doc["model_name"].upper(), body_style)],
        [Paragraph("Inference Duration:", metadata_style), Paragraph(f"{doc['processing_time_ms']} ms", body_style)],
        [Paragraph("AI Confidence Score:", metadata_style), Paragraph(f"{round(doc['confidence'] * 100, 2)}%", body_style)],
        [Paragraph("Doctor Review Status:", metadata_style), Paragraph(doc.get("doctor_review_status", "pending").upper(), ParagraphStyle('StatusStyle', fontName='Helvetica-Bold', fontSize=10, textColor=c_forest if doc.get("doctor_review_status") == "reviewed" else colors.HexColor("#B57C1E")))]
    ]
    
    meta_table = Table(metadata_details, colWidths=[150, 200])
    meta_table.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('PADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,0), 0),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.white),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))

    # Attempt to include scanned image if exists on server
    img_path = UPLOADS_DIR / f"{reportId}.jpg"
    if img_path.exists():
        try:
            # Resize image to fit neatly in letter size
            rl_img = RLImage(str(img_path), width=160, height=140)
            main_grid_data = [[meta_table, rl_img]]
            main_grid = Table(main_grid_data, colWidths=[355, 175])
            main_grid.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (1,0), (1,0), 15),
            ]))
            elements.append(main_grid)
        except Exception:
            elements.append(meta_table)
    else:
        elements.append(meta_table)

    elements.append(Spacer(1, 20))

    # 3. Differential Diagnosis Table
    elements.append(Paragraph("Differential Diagnosis Ranked Probabilities", section_style))
    diff_headers = [
        Paragraph("<b>Index</b>", metadata_style),
        Paragraph("<b>Code</b>", metadata_style),
        Paragraph("<b>Disease Name</b>", metadata_style),
        Paragraph("<b>Probability Match</b>", metadata_style)
    ]
    diff_rows = [diff_headers]
    for idx, pred in enumerate(doc["top_predictions"]):
        diff_rows.append([
            Paragraph(f"0{idx+1}", body_style),
            Paragraph(pred["code"].upper(), body_style),
            Paragraph(pred["name"], body_style),
            Paragraph(f"{round(pred['probability'] * 100, 2)}%", body_style)
        ])

    diff_table = Table(diff_rows, colWidths=[40, 60, 310, 120])
    diff_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_light_bg),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('PADDING', (0,0), (-1,-1), 8),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(diff_table)
    elements.append(Spacer(1, 20))

    # 4. Doctor Sign-off & Comments (if available)
    elements.append(Paragraph("Doctor Consultation & Sign-off Reviews", section_style))
    review_info = doc.get("doctor_review")
    if review_info:
        review_details = [
            [Paragraph("Attending Clinician:", metadata_style), Paragraph(review_info["doctor_name"], body_style)],
            [Paragraph("Clinician Email:", metadata_style), Paragraph(review_info["doctor_email"], body_style)],
            [Paragraph("Review Date:", metadata_style), Paragraph(str(review_info["reviewed_at"]), body_style)],
            [Paragraph("Clinical Comments & Guidelines:", metadata_style), Paragraph(review_info["comments"], body_style)]
        ]
        review_table = Table(review_details, colWidths=[150, 380])
        review_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
            ('GRID', (0,0), (-1,-1), 0.5, c_border),
            ('PADDING', (0,0), (-1,-1), 10),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        elements.append(review_table)
    else:
        elements.append(Paragraph("<i>This report has not yet been reviewed by an attending physician. Review status remains pending.</i>", body_style))

    # Build PDF
    pdf_doc.build(elements)
    buffer.seek(0)
    
    filename = f"SkinGuru_Report_{doc['predicted_disease'].replace(' ', '_')}_{reportId[:8]}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
