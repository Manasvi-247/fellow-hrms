from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HRMS API"
    database_url: str = "postgresql+psycopg://hrms:hrms@localhost:5432/hrms"
    timezone: str = "Asia/Kolkata"
    late_after: str = "09:30"
    seed_demo_data: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
