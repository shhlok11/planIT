import hashlib
import hmac
import secrets
from datetime import datetime, timedelta

from jose import JWTError, jwt
from core.config import settings


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None


PASSWORD_SALT_BYTES = 16
PASSWORD_ITERATIONS = 100_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(PASSWORD_SALT_BYTES)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_ITERATIONS,
    )
    return f"{PASSWORD_ITERATIONS}${salt.hex()}${derived_key.hex()}"


def verify_password(password: str, hashed_password: str | None) -> bool:
    if not hashed_password:
        return False

    try:
        iterations_str, salt_hex, expected_hex = hashed_password.split("$", 2)
        iterations = int(iterations_str)
    except (ValueError, AttributeError):
        return False

    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt_hex),
        iterations,
    )
    return hmac.compare_digest(derived_key.hex(), expected_hex)
