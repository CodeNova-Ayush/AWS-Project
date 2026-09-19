from pydantic import BaseModel, Field
from typing import List, Optional


class UserModel(BaseModel):
    user_id: str
    email: str
    name: str
    picture: str = ""
    created_at: str = ""
    github_username: str = ""
    github_access_token: str = ""


class ChatMessageIn(BaseModel):
    message: str
    issue_context: Optional[dict] = None  # Full issue data sent from frontend


class ChatMessageOut(BaseModel):
    role: str
    content: str
    timestamp: str


class AgentAssignRequest(BaseModel):
    issue_id: str
    agent_type: str = Field(..., description="E.g., opencode or claude_code")
    repo: str = Field(..., description="Repository full name, e.g., owner/repo")


class JobTraceResponse(BaseModel):
    job_id: str
    status: str
    summary: Optional[str] = None
    traces: List[dict] = []
