from fastapi import APIRouter

from app.api.v1 import (
    auth,
    activity_templates,
    events,
    eisenhower_tasks,
    contacts,
    settings,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(activity_templates.router)
api_router.include_router(events.router)
api_router.include_router(eisenhower_tasks.router)
api_router.include_router(contacts.router)
api_router.include_router(settings.router)
