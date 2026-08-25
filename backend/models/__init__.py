import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    batches = relationship("Batch", back_populates="project", cascade="all, delete-orphan", order_by="Batch.batch_number")


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    batch_number = Column(Integer, nullable=False, default=1)
    name = Column(String(255), nullable=False)
    raw_reference = Column(Text, nullable=True)
    status = Column(String(50), default="DRAFT")  # DRAFT, READY, GENERATING, COMPLETED, PARTIAL
    combined_wav_path = Column(String(500), nullable=True)
    combined_mp3_path = Column(String(500), nullable=True)
    combined_duration = Column(Float, nullable=True)
    tight_wav_path = Column(String(500), nullable=True)
    tight_mp3_path = Column(String(500), nullable=True)
    tight_mp4_path = Column(String(500), nullable=True)
    tight_duration = Column(Float, nullable=True)
    timeline_data = Column(Text, nullable=True)  # JSON serialized timeline visual cuts
    rendered_video_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="batches")
    paragraphs = relationship("Paragraph", back_populates="batch", cascade="all, delete-orphan", order_by="Paragraph.paragraph_number, Paragraph.part_number")
    media_assets = relationship("MediaAsset", back_populates="batch", cascade="all, delete-orphan", order_by="desc(MediaAsset.created_at)")
    scene_assets = relationship("SceneAsset", back_populates="batch", cascade="all, delete-orphan", order_by="SceneAsset.sequence_index, SceneAsset.order_index")


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # image, video
    mime_type = Column(String(100), nullable=True)
    duration = Column(Float, nullable=True)  # for video clips
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    tags = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    batch = relationship("Batch", back_populates="media_assets")


class Paragraph(Base):
    __tablename__ = "paragraphs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    paragraph_number = Column(Integer, nullable=False, default=1)
    part_number = Column(String(50), nullable=True)  # e.g., "A", "B" or "Part 1"
    
    # AI Studio style metadata fields
    scene = Column(Text, nullable=True)
    sample_context = Column(Text, nullable=True)
    audio_profile = Column(Text, nullable=True)
    speaker = Column(String(100), nullable=True)
    style = Column(String(100), nullable=True, default="Newscaster")
    pace = Column(String(100), nullable=True, default="Natural")
    accent = Column(String(100), nullable=True, default="Neutral")
    voice = Column(String(100), nullable=True, default="Algenib")
    director_notes = Column(Text, nullable=True)
    additional_notes = Column(Text, nullable=True)
    
    # Spoken transcript
    transcript = Column(Text, nullable=False, default="")
    
    # Custom edited prompt override (if any)
    custom_prompt = Column(Text, nullable=True)
    
    # Stats & Status
    word_count = Column(Integer, default=0)
    character_count = Column(Integer, default=0)
    status = Column(String(50), default="DRAFT")  # DRAFT, READY, OVER_LIMIT, QUEUED, GENERATING, COMPLETED, FAILED
    
    generation_id = Column(Integer, nullable=True)
    parent_paragraph_id = Column(Integer, ForeignKey("paragraphs.id", ondelete="SET NULL"), nullable=True)
    raw_reference = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    batch = relationship("Batch", back_populates="paragraphs")
    generations = relationship("Generation", back_populates="paragraph", cascade="all, delete-orphan", order_by="desc(Generation.created_at)")
    scene_assets = relationship("SceneAsset", back_populates="paragraph", cascade="all, delete-orphan", order_by="SceneAsset.order_index")


class SceneAsset(Base):
    __tablename__ = "scene_assets"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id", ondelete="CASCADE"), nullable=False)
    paragraph_id = Column(Integer, ForeignKey("paragraphs.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False, default=0)       # position within paragraph
    sequence_index = Column(Integer, nullable=False, default=0)    # global position across batch
    asset_type = Column(String(50), nullable=False)                # "photo" or "video"
    file_path = Column(String(500), nullable=False)
    filename = Column(String(255), nullable=True)
    duration_override_ms = Column(Integer, nullable=True)          # null = auto-split segment time
    matched_automatically = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    batch = relationship("Batch", back_populates="scene_assets")
    paragraph = relationship("Paragraph", back_populates="scene_assets")


class Generation(Base):
    __tablename__ = "generations"

    id = Column(Integer, primary_key=True, index=True)
    paragraph_id = Column(Integer, ForeignKey("paragraphs.id", ondelete="CASCADE"), nullable=False)
    project_name = Column(String(255), nullable=True)
    batch_number = Column(Integer, nullable=True)
    paragraph_number = Column(Integer, nullable=True)
    part_number = Column(String(50), nullable=True)
    
    voice = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    duration = Column(Float, nullable=True)
    
    wav_path = Column(String(500), nullable=True)
    mp3_path = Column(String(500), nullable=True)
    metadata_path = Column(String(500), nullable=True)
    
    prompt_used = Column(Text, nullable=True)
    transcript_used = Column(Text, nullable=True)
    
    status = Column(String(50), default="COMPLETED")  # GENERATING, COMPLETED, FAILED
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)

    paragraph = relationship("Paragraph", back_populates="generations")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)
