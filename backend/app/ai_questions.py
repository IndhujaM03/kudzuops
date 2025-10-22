"""
AI Questions Routes for Kudzu Operations
======================================

This module provides AI-powered interview question generation and management.
"""

import os
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
import psycopg

try:
    from ..config import settings
    DATABASE_DSN = settings.database_url
except Exception:
    DATABASE_DSN = os.getenv(
        "DATABASE_URL",
        "postgresql://kudzuops:kudzu%40%402025@127.0.0.1:5432/kudzuops",
    )

router = APIRouter(prefix="/api", tags=["ai-questions"])


def _ensure_tables() -> None:
    """Ensure AI questions table exists"""
    with psycopg.connect(DATABASE_DSN) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS tbl_ai_questions (
                  id BIGSERIAL PRIMARY KEY,
                  demand_id BIGINT NOT NULL,
                  recruiter_id BIGINT NOT NULL,
                  question TEXT NOT NULL,
                  category TEXT NOT NULL,
                  difficulty TEXT NOT NULL,
                  is_generated BOOLEAN DEFAULT FALSE,
                  created_at TIMESTAMPTZ DEFAULT NOW(),
                  updated_at TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            conn.commit()


@router.get("/demand/{demand_id}/questions")
def get_demand_questions(demand_id: int, recruiter_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get questions for a specific demand"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                if recruiter_id:
                    # Get questions for specific recruiter
                    cur.execute(
                        """
                        SELECT id, question, category, difficulty, is_generated, created_at
                        FROM tbl_ai_questions
                        WHERE demand_id = %s AND recruiter_id = %s
                        ORDER BY created_at DESC
                        """,
                        (demand_id, recruiter_id)
                    )
                else:
                    # Get all questions for the demand
                    cur.execute(
                        """
                        SELECT id, question, category, difficulty, is_generated, created_at
                        FROM tbl_ai_questions
                        WHERE demand_id = %s
                        ORDER BY created_at DESC
                        """,
                        (demand_id,)
                    )
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, row)) for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {e}")


@router.post("/demand/{demand_id}/questions")
def create_question(demand_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new question for a demand"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tbl_ai_questions 
                    (demand_id, recruiter_id, question, category, difficulty, is_generated)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """,
                    (
                        demand_id,
                        payload.get("recruiter_id"),
                        payload.get("question"),
                        payload.get("category"),
                        payload.get("difficulty"),
                        payload.get("is_generated", False)
                    )
                )
                question_id = cur.fetchone()[0]
                conn.commit()
        
        return {"message": "Question created successfully", "question_id": question_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create question: {e}")


@router.delete("/questions/{question_id}")
def delete_question(question_id: int, recruiter_id: int) -> Dict[str, Any]:
    """Delete a question"""
    _ensure_tables()
    try:
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM tbl_ai_questions 
                    WHERE id = %s AND recruiter_id = %s
                    """,
                    (question_id, recruiter_id)
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Question not found")
                conn.commit()
        
        return {"message": "Question deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {e}")


@router.post("/ai/generate_questions")
def generate_questions_simple(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generate AI questions based on job description text"""
    _ensure_tables()
    try:
        print(f"AI Questions Debug - Received payload: {payload}")
        
        jd_text = payload.get("jd_text", "")
        count = payload.get("count", 5)
        difficulty = payload.get("difficulty", "medium")
        
        print(f"AI Questions Debug - jd_text: '{jd_text}', count: {count}, difficulty: {difficulty}")
        
        if not jd_text or jd_text.strip() == "":
            raise HTTPException(status_code=400, detail="jd_text is required and cannot be empty")
        
        # Generate questions based on job description
        generated_questions = _generate_questions_for_job(
            job_title="Software Developer",  # Default title
            skill="General",  # Default skill
            job_description=jd_text,
            experience_level="Mid-level"  # Default experience
        )
        
        # Limit to requested count
        generated_questions = generated_questions[:count]
        
        print(f"AI Questions Debug - Generated {len(generated_questions)} questions")
        
        return {
            "message": f"Generated {len(generated_questions)} questions",
            "questions": generated_questions
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"AI Questions Debug - Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {e}")


# Lightweight, query-param based generator for UI refreshes
@router.get("/generate-questions")
def generate_questions_min(title: Optional[str] = None, description: Optional[str] = None, count: int = 5) -> Dict[str, Any]:
    """Return a compact list of interview questions based on title and description.
    Designed for quick UI refreshes; can be replaced with an AI provider later.
    """
    try:
        title_s = (title or "the role").strip() or "the role"
        desc = (description or "").strip()

        base_pool: List[str] = [
            f"What core skills are essential for {title_s}?",
            f"Describe the candidate's relevant experience for {title_s}.",
            f"Which recent project best proves fit for {title_s}?",
            f"What gaps versus the JD should be discussed for {title_s}?",
            f"How would the candidate ramp up quickly for {title_s}?",
            "What is the candidate's notice period and start availability?",
            "What are the candidate's compensation expectations and flexibility?",
        ]
        if desc:
            base_pool.extend([
                "List the top three JD requirements the candidate matches strongly.",
                "Which JD items may need mentoring or support?",
                "Propose two follow-up probes tailored to the JD.",
            ])

        import random
        random.shuffle(base_pool)
        selected = base_pool[: max(1, min(count, 5))]
        # Ensure exactly 5 if pool is small
        while len(selected) < 5:
            selected.append("Describe the candidate's relevant experience.")

        return {"questions": selected[:5]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {e}")


@router.post("/demand/{demand_id}/generate-questions")
def generate_questions(demand_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Generate AI questions for a demand based on job description"""
    _ensure_tables()
    try:
        # Get demand details
        with psycopg.connect(DATABASE_DSN) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT job_title, skill, job_description, experience_level, requirements
                    FROM tbl_demand_sheet
                    WHERE id = %s
                    """,
                    (demand_id,)
                )
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Demand not found")
                
                job_title, skill, job_description, experience_level, requirements = row
                
                # Generate questions based on job details
                generated_questions = _generate_questions_for_job(
                    job_title, skill, job_description, experience_level, requirements
                )
                
                # Save generated questions
                recruiter_id = payload.get("recruiter_id")
                question_ids = []
                
                for question_data in generated_questions:
                    cur.execute(
                        """
                        INSERT INTO tbl_ai_questions 
                        (demand_id, recruiter_id, question, category, difficulty, is_generated)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            demand_id,
                            recruiter_id,
                            question_data["question"],
                            question_data["category"],
                            question_data["difficulty"],
                            True
                        )
                    )
                    question_ids.append(cur.fetchone()[0])
                
                conn.commit()
        
        return {
            "message": f"Generated {len(generated_questions)} questions",
            "question_ids": question_ids,
            "questions": generated_questions
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {e}")


def _generate_questions_for_job(job_title: str, skill: str, job_description: str, 
                               experience_level: str, requirements: str) -> List[Dict[str, Any]]:
    """Generate questions based on job details"""
    
    # This is a simplified question generation - in a real implementation,
    # you would integrate with an AI service like OpenAI, Anthropic, etc.
    
    questions = []
    
    # Technical questions based on skill
    if skill:
        skill_lower = skill.lower()
        
        if any(tech in skill_lower for tech in ['react', 'angular', 'vue', 'javascript']):
            questions.extend([
                {
                    "question": f"Can you explain the difference between React and Angular? Which would you choose for a {job_title} role and why?",
                    "category": "technical",
                    "difficulty": "medium"
                },
                {
                    "question": "How do you handle state management in large-scale applications?",
                    "category": "technical",
                    "difficulty": "hard"
                }
            ])
        
        if any(tech in skill_lower for tech in ['python', 'java', 'c#', 'node']):
            questions.extend([
                {
                    "question": f"Describe your experience with {skill}. What are the key advantages and challenges?",
                    "category": "technical",
                    "difficulty": "medium"
                },
                {
                    "question": "How do you approach debugging complex issues in production?",
                    "category": "technical",
                    "difficulty": "hard"
                }
            ])
    
    # Experience level based questions
    if experience_level:
        if experience_level.lower() in ['senior', 'lead', 'principal']:
            questions.extend([
                {
                    "question": "How do you mentor junior developers and help them grow?",
                    "category": "behavioral",
                    "difficulty": "medium"
                },
                {
                    "question": "Describe a time when you had to make a difficult technical decision that affected the entire team.",
                    "category": "situational",
                    "difficulty": "hard"
                }
            ])
        else:
            questions.extend([
                {
                    "question": "What motivates you to learn new technologies?",
                    "category": "behavioral",
                    "difficulty": "easy"
                },
                {
                    "question": "How do you stay updated with the latest trends in technology?",
                    "category": "general",
                    "difficulty": "easy"
                }
            ])
    
    # General questions
    questions.extend([
        {
            "question": "Why are you interested in this position and our company?",
            "category": "general",
            "difficulty": "easy"
        },
        {
            "question": "Describe a challenging project you worked on and how you overcame the obstacles.",
            "category": "behavioral",
            "difficulty": "medium"
        },
        {
            "question": "How do you handle tight deadlines and multiple competing priorities?",
            "category": "situational",
            "difficulty": "medium"
        }
    ])
    
    # Limit to 8 questions
    return questions[:8]