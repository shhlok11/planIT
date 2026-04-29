from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = f"sqlite:///{PROJECT_ROOT / 'syllabus.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_runtime_schema():
    inspector = inspect(engine)
    if "uploads" not in inspector.get_table_names():
        return

    upload_columns = {column["name"] for column in inspector.get_columns("uploads")}
    if "clean_text" not in upload_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE uploads ADD COLUMN clean_text TEXT"))
    if "user_id" not in upload_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE uploads ADD COLUMN user_id INTEGER"))

    if "user_preferences" not in inspector.get_table_names():
        user_pref_exists = False
    else:
        user_pref_exists = True

    if "users" in inspector.get_table_names():
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "hashed_password" not in user_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR"))

    if user_pref_exists:
        preference_columns = {
            column["name"] for column in inspector.get_columns("user_preferences")
        }
        if "user_id" not in preference_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE user_preferences ADD COLUMN user_id INTEGER"))
        if "updated_at" not in preference_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE user_preferences ADD COLUMN updated_at DATETIME"))
