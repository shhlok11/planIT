from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from core.config import settings
from core.dependencies import get_current_user
from db.base import Base
from db.session import engine, ensure_runtime_schema
from routers.auth import router as auth_router
from routers.courses import router as courses_router
from routers.events import router as events_router
from routers.preferences import router as preferences_router
from routers.uploads import router as uploads_router

Base.metadata.create_all(bind=engine)
ensure_runtime_schema()

app = FastAPI(title="Syllabus Architect API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=settings.JWT_SECRET_KEY)

# Public
app.include_router(auth_router)

# Protected — get_current_user applied to every route in these routers
app.include_router(uploads_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(events_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(courses_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(preferences_router, prefix="/api/v1", dependencies=[Depends(get_current_user)])

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
