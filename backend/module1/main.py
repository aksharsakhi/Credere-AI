"""
Module 1 — Data Ingestor API
==============================
Enterprise-grade financial document processing system.

Endpoints:
  POST   /api/upload           Upload & process a PDF document
  GET    /api/documents        List all uploaded documents
  DELETE /api/documents/{id}   Delete a document
  GET    /api/completeness     Check data completeness
  GET    /api/analysis/trends  Run trend analysis
  GET    /api/analysis/cross-verify   Run GST-Bank cross verification
  GET    /api/analysis/ratios  Run financial ratio analysis
  GET    /api/analysis/full    Run complete analysis pipeline
  POST   /api/reset            Reset all data
"""

import os
import logging
import sys

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .services.pdf_processor import PDFProcessorService
from .models.responses import (
    APIResponse,
    ExtractionResponse,
    TrendAnalysisResponse,
    CrossVerificationResponse,
    RatioAnalysisResponse,
    CompletenessResponse,
    FullAnalysisResponse,
)

# Module 2 import
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# ── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── FastAPI App ─────────────────────────────────────────────────────────
app = FastAPI(
    title="Credere AI — Credit Intelligence Platform",
    description="Enterprise Financial Document Intelligence & Research System",
    version="2.0.0",
)

# ── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Service Instance (singleton) ────────────────────────────────────────
processor = PDFProcessorService()


# ── Static Files (Frontend) ────────────────────────────────────────────
frontend_dir = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend"
)
dist_dir = os.path.join(frontend_dir, "dist")
assets_dir = os.path.join(dist_dir, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# ── Include Module 2 Router ────────────────────────────────────────────
try:
    from module2.main import router as module2_router
    app.include_router(module2_router)
    logger.info("Module 2 (Research Agent) loaded successfully")
except ImportError as e:
    logger.warning(f"Module 2 not available: {e}")


# ── Include Module 3 Router ────────────────────────────────────────────
try:
    from module3.main import router as module3_router
    app.include_router(module3_router)
    logger.info("Module 3 (Financial Intelligence Engine) loaded successfully")
except ImportError as e:
    logger.warning(f"Module 3 not available: {e}")


# ═══════════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════


@app.get("/")
async def root():
    """Serve frontend SPA."""
    index_path = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "service": "Module 1 — Data Ingestor",
        "version": "2.0.0",
        "status": "running",
        "note": (
            "Frontend not built. Run: "
            "cd frontend && npm install && npm run build"
        ),
    }


@app.post("/api/upload", response_model=ExtractionResponse)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
):
    """
    Upload a PDF document and extract financial data.

    Category must be one of:
            annual_report, financial_statement, bank_statement,
            gst_filing, rating_report
    """
    # Validate category
    if category not in settings.DOCUMENT_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid category '{category}'. Must be one of: "
                f"{list(settings.DOCUMENT_CATEGORIES.keys())}"
            ),
        )

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    # Save file
    file_path = os.path.join(
        settings.UPLOAD_DIR,
        f"{category}_{file.filename}",
    )
    try:
        with open(file_path, "wb") as f:
            content = await file.read()
            if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"File size exceeds {settings.MAX_FILE_SIZE_MB}MB "
                        "limit."
                    ),
                )
            f.write(content)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}",
        )

    # Process
    try:
        result = await processor.upload_and_process(
            file_path,
            file.filename,
            category,
        )
        return ExtractionResponse(
            success=True,
            message=f"Successfully processed {file.filename}",
            document_id=result["document_id"],
            financial_data=result["financial_data"],
            tables=result["tables"],
            raw_text_preview=result["raw_text_preview"],
            confidence_score=result["confidence_score"],
        )
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}",
        )


@app.get("/api/documents")
async def list_documents():
    """List all uploaded documents with their extraction status."""
    docs = processor.get_all_documents()
    return APIResponse(
        success=True,
        message=f"{len(docs)} document(s) uploaded",
        data=[
            {
                "document_id": d.document_id,
                "filename": d.filename,
                "category": d.category.value,
                "upload_time": d.upload_time.isoformat(),
                "page_count": d.page_count,
                "extraction_status": d.extraction_status,
            }
            for d in docs
        ],
    )


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete an uploaded document."""
    if processor.delete_document(doc_id):
        return APIResponse(success=True, message=f"Document {doc_id} deleted")
    raise HTTPException(status_code=404, detail="Document not found")


@app.get("/api/completeness", response_model=CompletenessResponse)
async def check_completeness():
    """
    Check data completeness and get suggestions for missing documents.
    This endpoint proactively tells the user what's missing.
    """
    report = processor.check_completeness()
    readiness_message = (
        "Ready for analysis"
        if report.can_proceed_with_analysis
        else "More data needed"
    )
    return CompletenessResponse(
        success=True,
        message=(
            f"Data completeness: {report.completeness_percentage}% — "
            f"{readiness_message}"
        ),
        report=report,
    )


@app.get("/api/consolidated")
async def get_consolidated_data():
    """Get consolidated financial data from all uploaded documents."""
    data = processor.get_consolidated_financials()
    return APIResponse(
        success=True,
        message="Consolidated financial data",
        data=data.model_dump(),
    )


@app.get("/api/analysis/trends", response_model=TrendAnalysisResponse)
async def run_trend_analysis():
    """Run trend analysis on extracted financial tables."""
    trends = processor.run_trend_analysis()
    tables = processor.get_all_tables()
    return TrendAnalysisResponse(
        success=True,
        message=f"Found {len(trends)} trend(s) across {len(tables)} table(s)",
        trends=trends,
        tables=tables,
    )


@app.get(
    "/api/analysis/cross-verify",
    response_model=CrossVerificationResponse,
)
async def run_cross_verification():
    """Run GST-Bank cross-verification to detect anomalies."""
    result = processor.run_cross_verification()
    return result


@app.get("/api/analysis/ratios", response_model=RatioAnalysisResponse)
async def run_ratio_analysis():
    """Compute financial ratios (D/E, ICR, CR, PM, RG)."""
    ratios = processor.run_ratio_analysis()
    return RatioAnalysisResponse(
        success=True,
        message=(
            "Financial ratios computed — "
            f"Overall health: {ratios.overall_health.value}"
        ),
        ratios=ratios,
    )


@app.get("/api/analysis/full", response_model=FullAnalysisResponse)
async def run_full_analysis():
    """
    Run the complete Module 1 analysis pipeline.
    Combines all engines into a comprehensive financial assessment.
    """
    result = await processor.run_full_analysis()
    return result


@app.post("/api/reset")
async def reset_data():
    """Reset all uploaded documents and extracted data."""
    processor.reset()
    return APIResponse(success=True, message="All data reset successfully")


# ── Health Check ────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "documents_count": len(processor.documents),
        "upload_dir": settings.UPLOAD_DIR,
    }


# ── SPA Fallback (must be last) ─────────────────────────────────────────
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    """Serve the React SPA for all non-API routes (client-side routing)."""
    index_path = os.path.join(dist_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(
        status_code=404,
        detail="Frontend not built. Run: cd frontend && npm run build",
    )
