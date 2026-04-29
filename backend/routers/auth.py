from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.orm import Session
from core.config import settings
from core.security import create_access_token
from core.dependencies import get_current_user
from db.models.user import User
from db.models.oauth_account import OAuthAccount
from db.session import get_db
from schemas.auth import TokenResponse, UserRead

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

oauth = OAuth()

oauth.register(
    name="google",
    client_id=settings.GOOGLE_CLIENT_ID,
    client_secret=settings.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

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


# --- Google ---

@router.get("/google/login")
async def google_login(request: Request):
    return await oauth.google.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    profile = token.get("userinfo")
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to fetch Google profile")

    user = _get_or_create_user(
        db,
        provider="google",
        provider_user_id=profile["sub"],
        email=profile["email"],
        name=profile.get("name"),
        avatar_url=profile.get("picture"),
    )
    return TokenResponse(access_token=create_access_token(user.id))


# --- GitHub ---

@router.get("/github/login")
async def github_login(request: Request):
    return await oauth.github.authorize_redirect(request, settings.GITHUB_REDIRECT_URI)


@router.get("/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get("user", token=token)
    profile = resp.json()

    # GitHub may not expose email publicly — fetch separately
    email = profile.get("email")
    if not email:
        email_resp = await oauth.github.get("user/emails", token=token)
        emails = email_resp.json()
        primary = next((e["email"] for e in emails if e["primary"] and e["verified"]), None)
        if not primary:
            raise HTTPException(status_code=400, detail="No verified email on GitHub account")
        email = primary

    user = _get_or_create_user(
        db,
        provider="github",
        provider_user_id=str(profile["id"]),
        email=email,
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
    )
    return TokenResponse(access_token=create_access_token(user.id))


# --- Shared ---

@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout():
    # client drops the token
    return {"detail": "Logged out"}