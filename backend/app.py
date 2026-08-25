import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.database import init_db
from backend.routers.projects import router as projects_router
from backend.routers.batches import router as batches_router
from backend.routers.paragraphs import router as paragraphs_router
from backend.routers.generations import router as generations_router
from backend.routers.settings import router as settings_router
from backend.routers.voices import voices_router, system_router

# Initialize database tables and migrations
init_db()

app = FastAPI(
    title="Gemini TTS Generator",
    description="Localhost Google Gemini Text-to-Speech narration generator with AI Studio voice controls",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(projects_router)
app.include_router(batches_router)
app.include_router(paragraphs_router)
app.include_router(generations_router)
app.include_router(settings_router)
app.include_router(voices_router)
app.include_router(system_router)

# Mount frontend static distribution if available
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIST_DIR = BASE_DIR / "frontend" / "dist"

if FRONTEND_DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST_DIR / "assets")), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept /api routes
        if full_path.startswith("api"):
            return JSONResponse(status_code=404, content={"detail": "API endpoint not found"})
        
        file_path = FRONTEND_DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")
else:
    @app.get("/")
    async def index_fallback():
        return {
            "message": "Gemini TTS Generator API is active.",
            "frontend": "Frontend build not yet detected. Run 'npm run build' inside frontend/ or use Vite dev server.",
            "docs": "/docs"
        }
