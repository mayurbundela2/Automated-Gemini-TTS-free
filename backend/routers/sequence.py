import os
import re
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Batch, Paragraph, SceneAsset, AppSetting, Generation
from backend.services.media_service import MediaService
from backend.services.compositor_service import CompositorService
from backend.services.subtitle_service import SubtitleService
from backend.services.delivery_provider import LocalDeliveryProvider, sanitize_filename
from backend.config.settings import settings

router = APIRouter(prefix="/api/batches/{batch_id}/sequence", tags=["Visual Sequencer"])


def get_batch_assets_dir(batch: Batch, db: Session) -> Path:
    output_dir_setting = db.query(AppSetting).filter(AppSetting.key == "OUTPUT_FOLDER").first()
    output_base = output_dir_setting.value if output_dir_setting else settings.OUTPUT_FOLDER
    delivery = LocalDeliveryProvider(base_output_dir=output_base)
    assets_dir = delivery.base_dir / sanitize_filename(batch.project.name) / f"Batch_{batch.batch_number:02d}" / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    return assets_dir


def calculate_tight_paragraph_timings(batch: Batch, db: Session) -> List[Dict[str, Any]]:
    """
    Calculates tight-timeline start_ms and end_ms for each paragraph using tight audio scaling.
    """
    paragraphs = db.query(Paragraph).filter(Paragraph.batch_id == batch.id).order_by(
        Paragraph.paragraph_number.asc(), Paragraph.id.asc()
    ).all()

    # Get individual paragraph durations
    para_durations = []
    for p in paragraphs:
        latest_gen = db.query(Generation).filter(
            Generation.paragraph_id == p.id, Generation.status == "COMPLETED"
        ).order_by(Generation.created_at.desc()).first()
        dur = latest_gen.duration if (latest_gen and latest_gen.duration) else max(2.5, p.word_count * 0.35)
        para_durations.append(dur)

    orig_total = sum(para_durations) or 1.0
    tight_total = batch.tight_duration or batch.combined_duration or orig_total
    scale = tight_total / orig_total

    timings = []
    curr_ms = 0

    for idx, p in enumerate(paragraphs):
        p_tight_dur_ms = int(round(para_durations[idx] * scale * 1000))
        start_ms = curr_ms
        end_ms = curr_ms + p_tight_dur_ms
        curr_ms = end_ms

        timings.append({
            "paragraph_id": p.id,
            "paragraph_number": p.paragraph_number,
            "part_title": p.part_number or f"Paragraph {p.paragraph_number}",
            "transcript": SubtitleService.clean_transcript(p.transcript),
            "start_ms": start_ms,
            "end_ms": end_ms,
            "duration_ms": p_tight_dur_ms
        })

    return timings


@router.get("")
def get_batch_sequence(batch_id: int, db: Session = Depends(get_db)):
    """
    Returns ordered paragraph segments with tight-timeline start/end ms, subtitle text, and assigned assets.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    timings = calculate_tight_paragraph_timings(batch, db)
    scene_assets = db.query(SceneAsset).filter(SceneAsset.batch_id == batch_id).order_by(
        SceneAsset.sequence_index.asc(), SceneAsset.order_index.asc()
    ).all()

    assets_by_para = {}
    for a in scene_assets:
        assets_by_para.setdefault(a.paragraph_id, []).append({
            "id": a.id,
            "paragraph_id": a.paragraph_id,
            "filename": a.filename,
            "file_path": a.file_path,
            "asset_type": a.asset_type,
            "order_index": a.order_index,
            "sequence_index": a.sequence_index,
            "duration_override_ms": a.duration_override_ms,
            "matched_automatically": a.matched_automatically,
            "url": f"/api/scene-assets/{a.id}/file"
        })

    segments = []
    for t in timings:
        p_id = t["paragraph_id"]
        segments.append({
            "paragraph_id": p_id,
            "paragraph_number": t["paragraph_number"],
            "part_title": t["part_title"],
            "subtitle_text": t["transcript"],
            "start_ms": t["start_ms"],
            "end_ms": t["end_ms"],
            "duration_ms": t["duration_ms"],
            "assets": assets_by_para.get(p_id, [])
        })

    return {
        "batch_id": batch.id,
        "tight_duration_ms": int((batch.tight_duration or batch.combined_duration or 0) * 1000),
        "total_paragraphs": len(segments),
        "segments": segments
    }


@router.post("/auto-match")
def auto_match_batch_assets(batch_id: int, db: Session = Depends(get_db)):
    """
    Scans the batch's assets/ folder, matches files by naming convention
    (e.g., Paragraph_01_Part_1.png or 01_...), inserts SceneAsset rows, and returns a report.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    paragraphs = db.query(Paragraph).filter(Paragraph.batch_id == batch_id).order_by(
        Paragraph.paragraph_number.asc(), Paragraph.id.asc()
    ).all()

    assets_dir = get_batch_assets_dir(batch, db)
    if not assets_dir.exists():
        assets_dir.mkdir(parents=True, exist_ok=True)

    # Scan files in assets/ folder
    all_files = [f for f in assets_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
    valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".webm"}
    asset_files = [f for f in all_files if f.suffix.lower() in valid_exts]

    matched_count = 0
    seq_counter = 0

    for p in paragraphs:
        p_num = p.paragraph_number
        p_part_str = sanitize_filename(p.part_number or f"Paragraph_{p_num}").lower()

        # Find matching files for this paragraph
        matched_files = []
        for af in asset_files:
            stem = af.stem.lower()

            # Pattern 1: Paragraph_01_Part_1 or Paragraph_1_Part_1
            # Pattern 2: Paragraph_01 or P01_ or 01_
            is_match = False
            if f"paragraph_{p_num:02d}" in stem or f"paragraph_{p_num}" in stem:
                is_match = True
            elif f"p{p_num:02d}" in stem or f"p{p_num}" in stem:
                is_match = True
            elif re.match(rf'^(?:seq_?|part_?)?0*{p_num}(?:_|$)', stem):
                is_match = True
            elif p_part_str and p_part_str in stem:
                is_match = True

            if is_match:
                matched_files.append(af)

        # Sort matched files (e.g. Paragraph_01_Part_1.png before Paragraph_01_Part_1_2.png)
        matched_files.sort(key=lambda x: x.name.lower())

        if matched_files:
            # Delete previous auto-matched assets for this paragraph
            db.query(SceneAsset).filter(
                SceneAsset.paragraph_id == p.id,
                SceneAsset.matched_automatically == True
            ).delete()

            for order_idx, mf in enumerate(matched_files):
                asset_type = "video" if mf.suffix.lower() in {".mp4", ".mov", ".webm"} else "photo"
                scene_asset = SceneAsset(
                    batch_id=batch.id,
                    paragraph_id=p.id,
                    order_index=order_idx,
                    sequence_index=seq_counter,
                    asset_type=asset_type,
                    file_path=str(mf),
                    filename=mf.name,
                    matched_automatically=True
                )
                db.add(scene_asset)
                seq_counter += 1
                matched_count += 1
        else:
            # Keep global sequence counter advancing
            seq_counter += 1

    db.commit()

    # Return refreshed sequence state & report
    seq_state = get_batch_sequence(batch_id, db)
    return {
        "status": "AUTO_MATCHED",
        "scanned_files": len(asset_files),
        "matched_assets_count": matched_count,
        "assets_folder": str(assets_dir),
        "sequence": seq_state
    }


@router.put("")
def update_batch_sequence_order(
    batch_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """
    Bulk saves reordered sequence_index, order_index, and duration_override_ms values.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    reordered_assets = payload.get("assets", [])
    for item in reordered_assets:
        asset_id = item.get("id")
        if not asset_id:
            continue
        asset = db.query(SceneAsset).filter(SceneAsset.id == asset_id, SceneAsset.batch_id == batch_id).first()
        if asset:
            if "sequence_index" in item:
                asset.sequence_index = item["sequence_index"]
            if "order_index" in item:
                asset.order_index = item["order_index"]
            if "duration_override_ms" in item:
                asset.duration_override_ms = item["duration_override_ms"]
            if "paragraph_id" in item:
                asset.paragraph_id = item["paragraph_id"]

    db.commit()
    return {"status": "SAVED", "updated_count": len(reordered_assets)}


@router.post("/assets")
async def upload_paragraph_asset(
    batch_id: int,
    paragraph_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Manual upload fallback for a paragraph that auto-match missed.
    """
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    paragraph = db.query(Paragraph).filter(Paragraph.id == paragraph_id, Paragraph.batch_id == batch_id).first()
    if not paragraph:
        raise HTTPException(status_code=404, detail="Paragraph not found")

    assets_dir = get_batch_assets_dir(batch, db)
    safe_name = sanitize_filename(file.filename)
    dest_path = assets_dir / safe_name

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ext = dest_path.suffix.lower()
    asset_type = "video" if ext in {".mp4", ".mov", ".webm"} else "photo"

    existing_count = db.query(SceneAsset).filter(SceneAsset.paragraph_id == paragraph_id).count()

    scene_asset = SceneAsset(
        batch_id=batch.id,
        paragraph_id=paragraph.id,
        order_index=existing_count,
        sequence_index=paragraph.paragraph_number,
        asset_type=asset_type,
        file_path=str(dest_path),
        filename=safe_name,
        matched_automatically=False
    )
    db.add(scene_asset)
    db.commit()
    db.refresh(scene_asset)

    return {
        "status": "UPLOADED",
        "asset": {
            "id": scene_asset.id,
            "paragraph_id": scene_asset.paragraph_id,
            "filename": scene_asset.filename,
            "file_path": scene_asset.file_path,
            "asset_type": scene_asset.asset_type,
            "order_index": scene_asset.order_index,
            "matched_automatically": False,
            "url": f"/api/scene-assets/{scene_asset.id}/file"
        }
    }


@router.delete("/assets/{asset_id}")
def delete_scene_asset(batch_id: int, asset_id: int, db: Session = Depends(get_db)):
    """
    Removes one asset assignment from the paragraph segment.
    """
    asset = db.query(SceneAsset).filter(SceneAsset.id == asset_id, SceneAsset.batch_id == batch_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Scene asset not found")

    db.delete(asset)
    db.commit()
    return {"status": "DELETED", "asset_id": asset_id}


@router.post("/compose-video")
def compose_final_video(
    batch_id: int,
    burn_subtitles: bool = True,
    db: Session = Depends(get_db)
):
    """
    Runs the FFmpeg compositor, rendering full_batch_final.mp4.
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

    audio_path = batch.tight_wav_path or batch.combined_wav_path
    if not audio_path or not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail="Batch narration audio not found. Please generate narration first.")

    seq_data = get_batch_sequence(batch_id, db)
    segments = seq_data.get("segments", [])

    output_mp4 = str(batch_dir / "full_batch_final.mp4")
    srt_path = str(batch_dir / "full_batch_tight.srt") if burn_subtitles else None

    res = CompositorService.compose_batch_video(
        segments_data=segments,
        audio_path=audio_path,
        output_mp4_path=output_mp4,
        burn_subtitles_srt=srt_path,
        ffmpeg_path=ffmpeg_path
    )

    batch.rendered_video_path = output_mp4
    db.commit()

    return {
        "status": "COMPOSED",
        "video_path": output_mp4,
        "duration": res["duration"],
        "file_size": res["file_size"],
        "download_url": f"/api/batches/{batch.id}/composed-video?download=true"
    }


# Standalone static stream router for scene asset thumbnails
asset_stream_router = APIRouter(prefix="/api/scene-assets", tags=["Scene Assets Stream"])

@asset_stream_router.get("/{asset_id}/file")
def get_scene_asset_file(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(SceneAsset).filter(SceneAsset.id == asset_id).first()
    if not asset or not os.path.exists(asset.file_path):
        raise HTTPException(status_code=404, detail="Scene asset file not found")

    ext = Path(asset.file_path).suffix.lower()
    media_type = "video/mp4" if ext in {".mp4", ".mov", ".webm"} else "image/jpeg"
    return FileResponse(path=asset.file_path, media_type=media_type)


@router.get("/composed-video")
def get_composed_video(batch_id: int, download: bool = False, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    project = batch.project
    delivery = LocalDeliveryProvider(base_output_dir=settings.OUTPUT_FOLDER)
    batch_dir = delivery.base_dir / sanitize_filename(project.name) / f"Batch_{batch.batch_number:02d}"
    video_path = batch_dir / "full_batch_final.mp4"

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Composed video 'full_batch_final.mp4' not found. Please click 'Compose Video' first.")

    download_name = f"{sanitize_filename(project.name)}_Batch_{batch.batch_number:02d}_Final.mp4"
    disposition = "attachment" if download else "inline"

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=download_name,
        headers={"Content-Disposition": f"{disposition}; filename=\"{download_name}\""}
    )
