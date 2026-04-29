import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Depends, HTTPException, Request, Response, status

from core.security import decode_access_token


_REQUEST_WINDOWS: dict[str, deque[float]] = defaultdict(deque)
_REQUEST_WINDOWS_LOCK = Lock()


def _build_rate_key(
    request: Request,
    scope: str,
    *,
    prefer_authenticated_user: bool,
) -> str:
    if prefer_authenticated_user:
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            user_id = decode_access_token(token)
            if user_id is not None:
                return f"user:{user_id}:{scope}"

    client_host = request.client.host if request.client else "unknown"
    return f"ip:{client_host}:{scope}"


def rate_limit(
    scope: str,
    *,
    limit: int,
    window_seconds: int,
    prefer_authenticated_user: bool = False,
):
    async def dependency(request: Request, response: Response):
        now = time.time()
        window_start = now - window_seconds
        key = _build_rate_key(
            request,
            scope,
            prefer_authenticated_user=prefer_authenticated_user,
        )

        with _REQUEST_WINDOWS_LOCK:
            timestamps = _REQUEST_WINDOWS[key]
            while timestamps and timestamps[0] <= window_start:
                timestamps.popleft()

            if len(timestamps) >= limit:
                retry_after = max(1, int(timestamps[0] + window_seconds - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                    headers={"Retry-After": str(retry_after)},
                )

            timestamps.append(now)
            remaining = max(0, limit - len(timestamps))

        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Window"] = str(window_seconds)

    return Depends(dependency)
