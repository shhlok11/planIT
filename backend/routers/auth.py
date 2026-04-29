from urllib.parse import urlencode

from authlib.integrations.base_client.errors import OAuthError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.orm import Session
from core.config import settings
from core.security import create_access_token, hash_password, verify_password
from core.dependencies import get_current_user
from core.rate_limit import rate_limit
from db.models.user import User
from db.models.oauth_account import OAuthAccount
from db.session import get_db
from schemas.auth import LocalLoginRequest, LocalRegisterRequest, TokenResponse, UserRead

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

oauth = OAuth()
_google_enabled = all(
    [
        settings.GOOGLE_CLIENT_ID,
        settings.GOOGLE_CLIENT_SECRET,
        settings.GOOGLE_REDIRECT_URI,
    ]
)
_github_enabled = all(
    [
        settings.GITHUB_CLIENT_ID,
        settings.GITHUB_CLIENT_SECRET,
        settings.GITHUB_REDIRECT_URI,
    ]
)

if _google_enabled:
    oauth.register(
        name="google",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if _github_enabled:
    oauth.register(
        name="github",
        client_id=settings.GITHUB_CLIENT_ID,
        client_secret=settings.GITHUB_CLIENT_SECRET,
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )


def _get_or_create_user(
    db: Session,
    provider: str,
    provider_user_id: str,
    email: str,
    name: str | None,
    avatar_url: str | None,
) -> User:
    # Check if OAuth account already exists
    oauth_account = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
        .first()
    )
    if oauth_account:
        return oauth_account.user

    # Check if user with same email exists (e.g. signed up with other provider)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, name=name, avatar_url=avatar_url)
        db.add(user)
        db.flush()  # get user.id before commit

    # Link OAuth account to user
    db.add(OAuthAccount(
        user_id=user.id,
        provider=provider,
        provider_user_id=str(provider_user_id),
        provider_email=email,
    ))
    db.commit()
    db.refresh(user)
    return user


def _ensure_provider_enabled(provider: str):
    enabled = _google_enabled if provider == "google" else _github_enabled
    if not enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider.title()} OAuth is not configured",
        )


def _build_success_response(token: str):
    if settings.AUTH_SUCCESS_REDIRECT_URI:
        return RedirectResponse(
            f"{settings.AUTH_SUCCESS_REDIRECT_URI}#"
            + urlencode({"access_token": token, "token_type": "bearer"})
        )
    return TokenResponse(access_token=token)


def _build_failure_response(detail: str, status_code: int):
    if settings.AUTH_FAILURE_REDIRECT_URI:
        return RedirectResponse(
            f"{settings.AUTH_FAILURE_REDIRECT_URI}#" + urlencode({"error": detail})
        )
    raise HTTPException(status_code=status_code, detail=detail)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register_local_user(
    payload: LocalRegisterRequest,
    db: Session = Depends(get_db),
    _: None = rate_limit("auth:register", limit=5, window_seconds=60),
):
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="A user with that email already exists")

    user = User(
        email=payload.email,
        name=payload.name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login_local_user(
    payload: LocalLoginRequest,
    db: Session = Depends(get_db),
    _: None = rate_limit("auth:login", limit=10, window_seconds=60),
):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(access_token=create_access_token(user.id))


# --- Google ---

@router.get("/google/login")
async def google_login(
    request: Request,
    _: None = rate_limit("auth:google-login", limit=10, window_seconds=60),
):
    _ensure_provider_enabled("google")
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    _ensure_provider_enabled("google")
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as exc:
        return _build_failure_response(f"Google login failed: {exc.error}", 400)

    profile = token.get("userinfo")
    if not profile:
        return _build_failure_response("Failed to fetch Google profile", 400)

    user = _get_or_create_user(
        db,
        provider="google",
        provider_user_id=profile["sub"],
        email=profile["email"],
        name=profile.get("name"),
        avatar_url=profile.get("picture"),
    )
    return _build_success_response(create_access_token(user.id))


# --- GitHub ---

@router.get("/github/login")
async def github_login(
    request: Request,
    _: None = rate_limit("auth:github-login", limit=10, window_seconds=60),
):
    _ensure_provider_enabled("github")
    return await oauth.github.authorize_redirect(request, settings.GITHUB_REDIRECT_URI)


@router.get("/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    _ensure_provider_enabled("github")
    try:
        token = await oauth.github.authorize_access_token(request)
    except OAuthError as exc:
        return _build_failure_response(f"GitHub login failed: {exc.error}", 400)

    resp = await oauth.github.get("user", token=token)
    profile = resp.json()

    # GitHub may not expose email publicly — fetch separately
    email = profile.get("email")
    if not email:
        email_resp = await oauth.github.get("user/emails", token=token)
        emails = email_resp.json()
        primary = next((e["email"] for e in emails if e["primary"] and e["verified"]), None)
        if not primary:
            return _build_failure_response("No verified email on GitHub account", 400)
        email = primary

    user = _get_or_create_user(
        db,
        provider="github",
        provider_user_id=str(profile["id"]),
        email=email,
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
    )
    return _build_success_response(create_access_token(user.id))


# --- Shared ---

@router.get("/providers")
def auth_providers():
    return {
        "google": {
            "enabled": _google_enabled,
            "login_url": "/api/v1/auth/google/login" if _google_enabled else None,
        },
        "github": {
            "enabled": _github_enabled,
            "login_url": "/api/v1/auth/github/login" if _github_enabled else None,
        },
    }

@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    # client drops the token
    return {"detail": "Logged out"}
