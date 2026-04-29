import sqlite3
from contextlib import contextmanager
from fastapi import APIRouter, HTTPException, Path, Body
from pydantic import BaseModel
from datetime import date
from typing import Optional

router = APIRouter(prefix="/api/v1", tags=["events"])

DB_PATH = "database.db"


# --- DB Setup ---

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row 
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS course_events (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id     INTEGER NOT NULL,
                title         TEXT    NOT NULL,
                type          TEXT    NOT NULL,
                date          TEXT    NOT NULL,
                weight        INTEGER,
                source_text   TEXT    NOT NULL,
                is_user_edited INTEGER NOT NULL DEFAULT 0
            )
        """)

init_db()


# --- Models ---

class EventCreateRequest(BaseModel):
    title: str
    type: str
    date: date
    weight: Optional[int] = None
    source_text: str


class EventDeleteResponse(BaseModel):
    deleted: bool
    event_id: int


class EventResponse(BaseModel):
    id: int
    title: str
    type: str
    date: date
    weight: Optional[int]
    is_user_edited: bool
    source_text: str


# --- Helpers ---

def row_to_event(row: sqlite3.Row) -> EventResponse:
    return EventResponse(
        id=row["id"],
        title=row["title"],
        type=row["type"],
        date=date.fromisoformat(row["date"]),
        weight=row["weight"],
        is_user_edited=bool(row["is_user_edited"]),
        source_text=row["source_text"],
    )


# --- Routes ---

@router.delete("/events/{event_id}", response_model=EventDeleteResponse)
async def delete_event(event_id: int = Path(..., gt=0)) -> EventDeleteResponse:
    """Remove a false-positive extracted event."""
    with get_db() as conn:
        # Check the event exists first
        row = conn.execute(
            "SELECT id FROM course_events WHERE id = ?", (event_id,)
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

        conn.execute("DELETE FROM course_events WHERE id = ?", (event_id,))

    return EventDeleteResponse(deleted=True, event_id=event_id)


@router.post("/courses/{course_id}/events", response_model=EventResponse, status_code=201)
async def create_course_event(
    course_id: int = Path(..., gt=0),
    event: EventCreateRequest = Body(...),
) -> EventResponse:
    """Add a missing event manually for a course."""
    with get_db() as conn:
        # Check the course exists
        course = conn.execute(
            "SELECT id FROM courses WHERE id = ?", (course_id,)
        ).fetchone()

        if not course:
            raise HTTPException(status_code=404, detail=f"Course {course_id} not found")

        cursor = conn.execute(
            """
            INSERT INTO course_events (course_id, title, type, date, weight, source_text, is_user_edited)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (course_id, event.title, event.type, event.date.isoformat(), event.weight, event.source_text),
        )

        new_id = cursor.lastrowid

        row = conn.execute(
            "SELECT * FROM course_events WHERE id = ?", (new_id,)
        ).fetchone()

    return row_to_event(row)