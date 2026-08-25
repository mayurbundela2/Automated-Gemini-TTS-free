import os
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Batch, Paragraph, MediaAsset, AppSetting, Generation
from backend.services.media_service import MediaService
from backend.services.sequence_aligner import SequenceAligner
from backend.services.video_render_service import VideoRenderService
from backend.services.delivery_provider import LocalDeliveryProvider, sanitize_filename
from backend.config.settings import settings

router = APIRouter(tags=["Sequences & Media"])


@router.post("/api/batches/{batch_id}/media/upload")
async def upload_batch_media(
    batch_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads multiple image and video assets for a batch and extracts metadata/tags.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    project = batch.project
    output_dir_setting = db.query(AppSetting).filter(AppSetting.key == "OUTPUT_FOLDER").first()
    output_base = output_dir_setting.value if output_dir_setting else settings.OUTPUT_FOLDER

    media_dir = MediaService.get_media_dir(output_base, project.name, batch.batch_number)

    saved_assets = []
    for file in files:
        safe_name = sanitize_filename(file.filename)
        dest_path = media_dir / safe_name

        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Inspect format and extract semantic tokens
        meta = MediaService.inspect_media_file(str(dest_path))

        asset = MediaAsset(
            batch_id=batch.id,
            filename=safe_name,
            file_path=str(dest_path),
            file_type=meta["media_type"],
            mime_type=file.content_type,
            duration=meta["duration"],
            width=meta["width"],
            height=meta["height"],
            size_bytes=meta["size_bytes"],
            tags=meta["tags"]
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        saved_assets.append({
            "id": asset.id,
            "filename": asset.filename,
            "file_type": asset.file_type,
            "duration": asset.duration,
            "width": asset.width,
            "height": asset.height,
            "tags": asset.tags,
            "url": f"/api/media/{asset.id}/file"
        })

    return {"uploaded_count": len(saved_assets), "assets": saved_assets}


@router.get("/api/batches/{batch_id}/media")
def list_batch_media(batch_id: int, db: Session = Depends(get_db)):
    """
    Lists all media assets uploaded for this batch.
    """
    assets = db.query(MediaAsset).filter(MediaAsset.batch_id == batch_id).order_by(MediaAsset.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "filename": a.filename,
            "file_type": a.file_type,
            "duration": a.duration,
            "width": a.width,
            "height": a.height,
            "size_bytes": a.size_bytes,
            "tags": a.tags,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "url": f"/api/media/{a.id}/file"
        }
        for a in assets
    ]


@router.delete("/api/media/{asset_id}")
def delete_media_asset(asset_id: int, db: Session = Depends(get_db)):
    """
    Deletes a media asset from database and local disk.
    """
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    if os.path.exists(asset.file_path):
        try:
            os.remove(asset.file_path)
        except Exception:
            pass

    db.delete(asset)
    db.commit()
    return {"status": "DELETED", "asset_id": asset_id}


@router.get("/api/media/{asset_id}/file")
def get_media_file(asset_id: int, db: Session = Depends(get_db)):
    """
    Streams media file for live canvas/video preview in the browser.
    """
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id).first()
    if not asset or not os.path.exists(asset.file_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    media_type = asset.mime_type or ("video/mp4" if asset.file_type == "video" else "image/jpeg")
    return FileResponse(path=asset.file_path, media_type=media_type)


@router.post("/api/batches/{batch_id}/sequence/auto-align")
def auto_align_batch_sequence(
    batch_id: int,
    track_type: str = "master",
    db: Session = Depends(get_db)
):
    """
    Executes the 3-Layer Auto-Alignment Engine across all paragraphs and media assets.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    paragraphs = db.query(Paragraph).filter(Paragraph.batch_id == batch_id).order_by(Paragraph.paragraph_number.asc(), Paragraph.id.asc()).all()
    media_assets = db.query(MediaAsset).filter(MediaAsset.batch_id == batch_id).order_by(MediaAsset.id.asc()).all()

    paras_data = []
    for p in paragraphs:
        latest_gen = db.query(Generation).filter(Generation.paragraph_id == p.id, Generation.status == "COMPLETED").order_by(Generation.created_at.desc()).first()
        dur = latest_gen.duration if (latest_gen and latest_gen.duration) else max(2.5, p.word_count * 0.35)
        paras_data.append({
            "id": p.id,
            "paragraph_number": p.paragraph_number,
            "part_number": p.part_number,
            "transcript": p.transcript,
            "scene": p.scene or "",
            "duration": dur
        })

    assets_data = [
        {
            "id": a.id,
            "filename": a.filename,
            "file_type": a.file_type,
            "file_path": a.file_path,
            "tags": a.tags
        }
        for a in media_assets
    ]

    existing_cuts = []
    if batch.timeline_data:
        try:
            existing_cuts = json.loads(batch.timeline_data)
        except Exception:
            existing_cuts = []

    timeline_cuts = SequenceAligner.auto_align_sequence(
        paragraphs_data=paras_data,
        media_assets=assets_data,
        existing_cuts=existing_cuts,
        audio_track_type=track_type
    )

    batch.timeline_data = json.dumps(timeline_cuts, ensure_ascii=False)
    db.commit()

    return {
        "status": "ALIGNED",
        "batch_id": batch.id,
        "track_type": track_type,
        "total_scenes": len(timeline_cuts),
        "timeline_cuts": timeline_cuts
    }


@router.get("/api/batches/{batch_id}/sequence")
def get_batch_sequence(batch_id: int, db: Session = Depends(get_db)):
    """
    Retrieves the current timeline sequence of visual cuts for a batch.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if not batch.timeline_data:
        # Auto-align first if empty
        return auto_align_batch_sequence(batch_id, "master", db)

    try:
        cuts = json.loads(batch.timeline_data)
        return {
            "status": "LOADED",
            "batch_id": batch.id,
            "timeline_cuts": cuts
        }
    except Exception:
        return auto_align_batch_sequence(batch_id, "master", db)


@router.put("/api/batches/{batch_id}/sequence")
def update_batch_sequence(
    batch_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Saves manual adjustments / reordering made in the frontend Sequence Editor.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    timeline_cuts = payload.get("timeline_cuts", [])
    batch.timeline_data = json.dumps(timeline_cuts, ensure_ascii=False)
    db.commit()

    return {"status": "SAVED", "total_scenes": len(timeline_cuts)}


@router.post("/api/batches/{batch_id}/render-video")
def trigger_render_timeline_video(
    batch_id: int,
    track_type: str = "tight",
    db: Session = Depends(get_db)
):
    """
    Renders the timeline sequence into a 1080p MP4 master video.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    project = batch.project
    output_dir_setting = db.query(AppSetting).filter(AppSetting.key == "OUTPUT_FOLDER").first()
    ffmpeg_path_setting = db.query(AppSetting).filter(AppSetting.key == "FFMPEG_PATH").first()
    output_base = output_dir_setting.value if output_dir_setting else settings.OUTPUT_FOLDER
    ffmpeg_path = ffmpeg_path_setting.value if ffmpeg_path_setting else settings.FFMPEG_PATH

    delivery = LocalDeliveryProvider(base_output_dir=output_base)
    batch_dir = delivery.base_dir / sanitize_filename(project.name) / f"Batch_{batch.batch_number:02d}"

    audio_path = batch.tight_wav_path if (track_type == "tight" and batch.tight_wav_path) else batch.combined_wav_path
    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail="Combined batch audio not found. Please generate batch narration first.")

    cuts = []
    if batch.timeline_data:
        try:
            cuts = json.loads(batch.timeline_data)
        except Exception:
            cuts = []

    if not cuts:
        auto_res = auto_align_batch_sequence(batch_id, track_type, db)
        cuts = auto_res["timeline_cuts"]

    output_mp4 = str(batch_dir / "final_video_1080p.mp4")

    render_res = VideoRenderService.render_timeline_video(
        timeline_cuts=cuts,
        audio_path=audio_path,
        output_mp4_path=output_mp4,
        ffmpeg_path=ffmpeg_path
    )

    batch.rendered_video_path = output_mp4
    db.commit()

    return {
        "status": "COMPLETED",
        "video_path": output_mp4,
        "duration": render_res["duration"],
        "file_size": render_res["file_size"],
        "download_url": f"/api/batches/{batch.id}/rendered-video?download=true"
    }


@router.get("/api/batches/{batch_id}/rendered-video")
def get_rendered_video(
    batch_id: int,
    download: bool = False,
    db: Session = Depends(get_db)
):
    """
    Downloads or streams the rendered 1080p MP4 video.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    project = batch.project
    if not batch.rendered_video_path or not os.path.exists(batch.rendered_video_path):
        raise HTTPException(status_code=404, detail="Rendered video not found. Please click 'Render 1080p Video' first.")

    download_name = f"{sanitize_filename(project.name)}_Batch_{batch.batch_number:02d}_1080p.mp4"
    disposition = "attachment" if download else "inline"

    return FileResponse(
        path=batch.rendered_video_path,
        media_type="video/mp4",
        filename=download_name,
        headers={"Content-Disposition": f"{disposition}; filename=\"{download_name}\""}
    )
