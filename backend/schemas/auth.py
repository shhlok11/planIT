from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    id:         int
    email:      str
    name:       str | None
    avatar_url: str | None
    is_active:  bool

    class Config:
        from_attributes = True