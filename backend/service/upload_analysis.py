from fastapi import Response
from sqlalchemy.orm import Session

from core.conflict_engine import detect_conflicts
from core.ics_builder import build_calendar_ics
from core.pdf_builder import build_plan_summary_pdf, build_upload_summary_pdf
from core.priority_scoring import score_upload_events
from core.scheduler_engine import generate_study_blocks
from db.models import Plan, StudyBlock, Upload, UserPreference
from schemas.conflict import UploadConflictsResponse
from schemas.priority import UploadPriorityScoresResponse
from schemas.plan import (
    PlanConflictsResponse,
    PlanCoursesResponse,
    PlanPriorityScoresResponse,
    PlanRead,
    PlanScheduleResponse,
)
from schemas.extraction import CourseRead
from schemas.study_block import StudyBlockRead, UploadScheduleResponse


def get_latest_preference(db: Session) -> UserPreference | None:
    return (
        db.query(UserPreference)
        .order_by(UserPreference.created_at.desc(), UserPreference.id.desc())
        .first()
    )


def collect_upload_events(upload: Upload):
    return [
        event
        for course in upload.courses
        for event in course.events
    ]


def collect_plan_courses(plan: Plan):
    return [
        course
        for upload in plan.uploads
        for course in upload.courses
    ]


def collect_plan_events(plan: Plan):
    return [
        event
        for course in collect_plan_courses(plan)
        for event in course.events
    ]


def collect_plan_study_blocks(plan: Plan):
    return sorted(
        [
            block
            for upload in plan.uploads
            for block in upload.study_blocks
        ],
        key=lambda item: item.start_time,
    )


def build_priority_scores_response(
    upload: Upload,
    preference: UserPreference | None,
) -> UploadPriorityScoresResponse:
    return UploadPriorityScoresResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        scores=score_upload_events(upload.courses, preference),
    )


def build_plan_read(plan: Plan) -> PlanRead:
    return PlanRead.model_validate(plan)


def build_plan_courses_response(plan: Plan) -> PlanCoursesResponse:
    return PlanCoursesResponse(
        plan_id=plan.id,
        courses=[CourseRead.model_validate(course) for course in collect_plan_courses(plan)],
    )


def build_plan_priority_scores_response(
    plan: Plan,
    preference: UserPreference | None,
) -> PlanPriorityScoresResponse:
    return PlanPriorityScoresResponse(
        plan_id=plan.id,
        preference_id=preference.id if preference else None,
        scores=score_upload_events(collect_plan_courses(plan), preference),
    )


def build_conflicts_response(upload: Upload) -> UploadConflictsResponse:
    return UploadConflictsResponse(
        upload_id=upload.id,
        conflicts=detect_conflicts(collect_upload_events(upload)),
    )


def build_plan_conflicts_response(plan: Plan) -> PlanConflictsResponse:
    return PlanConflictsResponse(
        plan_id=plan.id,
        conflicts=detect_conflicts(collect_plan_events(plan)),
    )


def build_study_blocks_response(
    upload: Upload,
    preference: UserPreference | None,
) -> UploadScheduleResponse:
    return UploadScheduleResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        study_blocks=[
            StudyBlockRead.model_validate(block)
            for block in sorted(upload.study_blocks, key=lambda item: item.start_time)
        ],
    )


def build_plan_study_blocks_response(
    plan: Plan,
    preference: UserPreference | None,
) -> PlanScheduleResponse:
    return PlanScheduleResponse(
        plan_id=plan.id,
        preference_id=preference.id if preference else None,
        study_blocks=[
            StudyBlockRead.model_validate(block)
            for block in collect_plan_study_blocks(plan)
        ],
    )


def build_and_save_schedule(
    upload: Upload,
    db: Session,
    *,
    preference: UserPreference | None,
) -> UploadScheduleResponse:
    priority_scores = score_upload_events(upload.courses, preference)
    conflicts = detect_conflicts(collect_upload_events(upload))
    generated_blocks = generate_study_blocks(
        courses=upload.courses,
        preference=preference,
        priority_scores=priority_scores,
        conflicts=conflicts,
    )

    for existing_block in list(upload.study_blocks):
        db.delete(existing_block)
    db.flush()

    saved_blocks = []
    for block in generated_blocks:
        study_block = StudyBlock(**block.model_dump())
        db.add(study_block)
        saved_blocks.append(study_block)

    db.commit()
    for block in saved_blocks:
        db.refresh(block)

    return UploadScheduleResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        study_blocks=[StudyBlockRead.model_validate(block) for block in saved_blocks],
    )


def build_and_save_plan_schedule(
    plan: Plan,
    db: Session,
    *,
    preference: UserPreference | None,
) -> PlanScheduleResponse:
    courses = collect_plan_courses(plan)
    priority_scores = score_upload_events(courses, preference)
    conflicts = detect_conflicts(collect_plan_events(plan))
    generated_blocks = generate_study_blocks(
        courses=courses,
        preference=preference,
        priority_scores=priority_scores,
        conflicts=conflicts,
    )

    for upload in plan.uploads:
        for existing_block in list(upload.study_blocks):
            db.delete(existing_block)
    db.flush()

    saved_blocks = []
    for block in generated_blocks:
        study_block = StudyBlock(**block.model_dump())
        db.add(study_block)
        saved_blocks.append(study_block)

    db.commit()
    for block in saved_blocks:
        db.refresh(block)

    return PlanScheduleResponse(
        plan_id=plan.id,
        preference_id=preference.id if preference else None,
        study_blocks=[StudyBlockRead.model_validate(block) for block in saved_blocks],
    )


def build_ics_response(upload: Upload) -> Response:
    ics_content = build_calendar_ics(
        courses=upload.courses,
        study_blocks=upload.study_blocks,
    )
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="planit-upload-{upload.id}.ics"'
        },
    )


def build_plan_ics_response(plan: Plan) -> Response:
    ics_content = build_calendar_ics(
        courses=collect_plan_courses(plan),
        study_blocks=collect_plan_study_blocks(plan),
    )
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="planit-plan-{plan.id}.ics"'
        },
    )


def build_pdf_response(
    upload: Upload,
    preference: UserPreference | None,
    *,
    theme: str = "dark",
) -> Response:
    priority_scores = score_upload_events(upload.courses, preference)
    conflicts = detect_conflicts(collect_upload_events(upload))
    pdf_content = build_upload_summary_pdf(
        upload=upload,
        preference=preference,
        priority_scores=priority_scores,
        conflicts=conflicts,
        theme=theme,
    )
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="planit-upload-{upload.id}.pdf"'
        },
    )


def build_plan_pdf_response(
    plan: Plan,
    preference: UserPreference | None,
    *,
    theme: str = "dark",
) -> Response:
    courses = collect_plan_courses(plan)
    priority_scores = score_upload_events(courses, preference)
    conflicts = detect_conflicts(collect_plan_events(plan))
    pdf_content = build_plan_summary_pdf(
        plan=plan,
        courses=courses,
        study_blocks=collect_plan_study_blocks(plan),
        preference=preference,
        priority_scores=priority_scores,
        conflicts=conflicts,
        theme=theme,
    )
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="planit-plan-{plan.id}.pdf"'
        },
    )
