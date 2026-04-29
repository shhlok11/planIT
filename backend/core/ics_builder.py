from datetime import datetime, time, timedelta

from icalendar import Alarm, Calendar, Event

from db.models import Course, StudyBlock


def build_calendar_ics(*, courses: list[Course], study_blocks: list[StudyBlock]) -> bytes:
    calendar = Calendar()
    calendar.add("prodid", "-//planIT//Syllabus Planner//EN")
    calendar.add("version", "2.0")
    calendar.add("calscale", "GREGORIAN")

    for course in courses:
        for deadline in course.events:
            if deadline.date is None:
                continue
            calendar.add_component(_deadline_event(course, deadline))

    for block in study_blocks:
        calendar.add_component(_study_block_event(block))

    return calendar.to_ical()


def _deadline_event(course: Course, deadline) -> Event:
    event = Event()
    event.add("uid", f"deadline-{deadline.id}@planit.local")
    event.add("summary", f"{course.course_code}: {deadline.title}")
    event.add("dtstart", datetime.combine(deadline.date, time(23, 59)))
    event.add("dtend", datetime.combine(deadline.date, time(23, 59)) + timedelta(minutes=1))
    event.add("description", _deadline_description(course.course_code, deadline))
    event.add_component(_alarm(timedelta(days=-1)))
    return event


def _study_block_event(block: StudyBlock) -> Event:
    event = Event()
    event.add("uid", f"study-block-{block.id}@planit.local")
    event.add("summary", block.title)
    event.add("dtstart", block.start_time)
    event.add("dtend", block.end_time)
    event.add("description", block.reason or "Generated study block")
    event.add_component(_alarm(timedelta(minutes=-30)))
    return event


def _deadline_description(course_code: str, deadline) -> str:
    parts = [f"Course: {course_code}", f"Type: {deadline.type}"]
    if deadline.weight is not None:
        parts.append(f"Weight: {deadline.weight:g}%")
    if deadline.source_text:
        parts.append(f"Source: {deadline.source_text}")
    return "\n".join(parts)


def _alarm(trigger: timedelta) -> Alarm:
    alarm = Alarm()
    alarm.add("action", "DISPLAY")
    alarm.add("description", "planIT reminder")
    alarm.add("trigger", trigger)
    return alarm
