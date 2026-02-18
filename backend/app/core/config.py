from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://adhd:adhd_secret@localhost:5432/adhd_calendar"
    SECRET_KEY: str = "supersecretkey_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    DEMO_USER_EMAIL: str = "demo@adhd.local"
    DEMO_USER_PASSWORD: str = "demo1234"

    class Config:
        env_file = ".env"


settings = Settings()
