from fastapi import Response
from sqlalchemy.orm import Session

from core.conflict_engine import detect_conflicts
from core.ics_builder import build_calendar_ics
from core.priority_scoring import score_upload_events
from core.scheduler_engine import generate_study_blocks
from db.models import StudyBlock, Upload, UserPreference
from schemas.conflict import UploadConflictsResponse
from schemas.priority import UploadPriorityScoresResponse
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


def build_priority_scores_response(
    upload: Upload,
    preference: UserPreference | None,
) -> UploadPriorityScoresResponse:
    return UploadPriorityScoresResponse(
        upload_id=upload.id,
        preference_id=preference.id if preference else None,
        scores=score_upload_events(upload.courses, preference),
    )


def build_conflicts_response(upload: Upload) -> UploadConflictsResponse:
    return UploadConflictsResponse(
        upload_id=upload.id,
        conflicts=detect_conflicts(collect_upload_events(upload)),
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


def build_and_save_schedule(
    upload: Upload,
    db: Session,
    *,
    preference: UserPreference | None,
) -> UploadScheduleResponse:
    priority_scores = score_upload_events(upload.courses, preference)
    conflicts = detect_conflicts(collect_upload_events(upload))
    generated_blocks = generate_study_blocks(
        upload_id=upload.id,
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
