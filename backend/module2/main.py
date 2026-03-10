"""
Module 2 — Research Agent API Router
======================================
Endpoints for the Digital Credit Manager research module.

Endpoints:
  POST  /api/module2/research       Run research on a company
  GET   /api/module2/last-result    Get last research result
  POST  /api/module2/reset          Reset research data
  GET   /api/module2/health         Health check
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .models.research_data import ResearchInput, ResearchResponse
from .services.research_service import ResearchService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/module2", tags=["Module 2 — Research Agent"])

# Singleton service instance
research_service = ResearchService()


class CompanySearchRequest(BaseModel):
    company_name: str


@router.post("/research", response_model=ResearchResponse)
async def run_research(inp: ResearchInput):
    """
    Run comprehensive credit intelligence research.

    Accepts company name, promoters, directors, industry, location,
    and optionally manual observations and financial context from Module 1.
    """
    if not research_service.is_ready:
        raise HTTPException(
            status_code=503,
            detail="Research engine not ready. Ensure GEMINI_API_KEY is set.",
        )

    try:
        result = await research_service.run_research(inp)
        return ResearchResponse(
            success=True,
            message=f"Research completed for {inp.company_name}",
            data=result,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Research failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Research failed: {str(e)}",
        )


@router.get("/last-result", response_model=ResearchResponse)
async def get_last_result():
    """Get the last research result (if any)."""
    result = research_service.get_last_result()
    if not result:
        return ResearchResponse(
            success=False,
            message="No research has been run yet",
        )
    return ResearchResponse(
        success=True,
        message=f"Last research: {result.company_name}",
        data=result,
    )


@router.post("/reset")
async def reset_research():
    """Reset all Module 2 research data."""
    research_service.reset()
    return {"success": True, "message": "Module 2 data reset"}


@router.get("/health")
async def health_check():
    """Module 2 health check."""
    return {
        "status": "healthy" if research_service.is_ready else "degraded",
        "gemini_configured": research_service.is_ready,
        "has_results": research_service.get_last_result() is not None,
    }


@router.post("/search-company")
async def search_company_online(inp: CompanySearchRequest):
    """Search company details online and prefill Module 2 form."""
    if not research_service.is_ready:
        raise HTTPException(
            status_code=503,
            detail="Research engine not ready. Ensure GEMINI_API_KEY is set.",
        )

    if not inp.company_name.strip():
        raise HTTPException(status_code=400, detail="company_name is required")

    try:
        data = await research_service.search_company_online(
            inp.company_name.strip()
        )
        return {
            "success": True,
            "message": (
                "Company profile fetched for "
                f"{inp.company_name.strip()}"
            ),
            "data": data,
        }
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Company search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Company search failed: {str(e)}",
        )
