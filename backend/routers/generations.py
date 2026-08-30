import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Generation, Paragraph
from backend.schemas import GenerationResponse
from backend.services.waveform_service import WaveformService

router = APIRouter(prefix="/api/generations", tags=["Generations"])


@router.get("", response_model=List[GenerationResponse])
def list_generations(limit: int = 50, db: Session = Depends(get_db)):
    gens = db.query(Generation).order_by(Generation.created_at.desc()).limit(limit).all()
    results = []
    for g in gens:
        waveform = WaveformService.extract_peaks_from_wav(g.wav_path) if g.wav_path else None
        results.append(GenerationResponse(
            id=g.id,
            paragraph_id=g.paragraph_id,
            project_name=g.project_name,
            batch_number=g.batch_number,
            paragraph_number=g.paragraph_number,
            part_number=g.part_number,
            voice=g.voice,
            model=g.model,
            duration=g.duration,
            wav_path=g.wav_path,
            mp3_path=g.mp3_path,
            metadata_path=g.metadata_path,
            status=g.status,
            error_message=g.error_message,
            created_at=g.created_at,
            waveform=waveform
        ))
    return results


@router.get("/{gen_id}", response_model=GenerationResponse)
def get_generation(gen_id: int, db: Session = Depends(get_db)):
    g = db.query(Generation).filter(Generation.id == gen_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Generation record not found")

    waveform = WaveformService.extract_peaks_from_wav(g.wav_path) if g.wav_path else None
    return GenerationResponse(
        id=g.id,
        paragraph_id=g.paragraph_id,
        project_name=g.project_name,
        batch_number=g.batch_number,
        paragraph_number=g.paragraph_number,
        part_number=g.part_number,
        voice=g.voice,
        model=g.model,
        duration=g.duration,
        wav_path=g.wav_path,
        mp3_path=g.mp3_path,
        metadata_path=g.metadata_path,
        status=g.status,
        error_message=g.error_message,
        created_at=g.created_at,
        waveform=waveform
    )


@router.get("/{gen_id}/audio")
def get_audio_file(gen_id: int, format: str = Query("wav", enum=["wav", "mp3"]), download: bool = False, db: Session = Depends(get_db)):
    g = db.query(Generation).filter(Generation.id == gen_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Generation record not found")

    file_path = g.mp3_path if format == "mp3" and g.mp3_path else g.wav_path
    if not file_path or not os.path.exists(file_path):
        # Fallback to wav if mp3 requested but not available
        file_path = g.wav_path
        format = "wav"

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Audio file ({format}) not found on disk at {file_path}")

    media_type = "audio/mpeg" if format == "mp3" else "audio/wav"
    filename = f"narration_{g.project_name or 'project'}_B{g.batch_number or 1}_P{g.paragraph_number or 1}.{format}"
    disposition = "attachment" if download else "inline"

    with open(file_path, "rb") as f:
        content = f.read()

    from fastapi import Response
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"{disposition}; filename=\"{filename}\"",
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(content)),
        }
    )


@router.get("/{gen_id}/waveform")
def get_generation_waveform(gen_id: int, db: Session = Depends(get_db)):
    g = db.query(Generation).filter(Generation.id == gen_id).first()
    if not g or not g.wav_path:
        raise HTTPException(status_code=404, detail="Generation audio not found")
    return WaveformService.extract_peaks_from_wav(g.wav_path)


@router.get("/{gen_id}/metadata")
def get_generation_metadata(gen_id: int, db: Session = Depends(get_db)):
    g = db.query(Generation).filter(Generation.id == gen_id).first()
    if not g or not g.metadata_path or not os.path.exists(g.metadata_path):
        raise HTTPException(status_code=404, detail="Metadata file not found")
    return FileResponse(path=g.metadata_path, media_type="application/json", filename="metadata.json")


@router.delete("/{gen_id}")
def delete_generation(gen_id: int, db: Session = Depends(get_db)):
    g = db.query(Generation).filter(Generation.id == gen_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Generation record not found")
    db.delete(g)
    db.commit()
    return {"status": "deleted", "id": gen_id}
