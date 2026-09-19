import pytest
import time

class TestAgentJobs:
    """Agent Job Manager Endpoints"""

    def test_assign_agent_without_auth(self, base_url, api_client):
        """POST /api/agents/assign without auth - should return 401"""
        response = api_client.post(
            f"{base_url}/api/agents/assign",
            json={"issue_id": "issue_001", "agent_type": "opencode", "repo": "owner/repo"}
        )
        assert response.status_code == 401

    def test_assign_agent_and_check_job(self, base_url, auth_client):
        """Test complete assign agent -> get jobs -> trace flow"""
        # Assign agent
        assign_response = auth_client.post(
            f"{base_url}/api/agents/assign",
            json={"issue_id": "issue_001", "agent_type": "opencode", "repo": "owner/repo"}
        )
        assert assign_response.status_code == 200
        assign_data = assign_response.json()
        assert "job_id" in assign_data
        
        job_id = assign_data["job_id"]
        
        # Get jobs list
        jobs_response = auth_client.get(f"{base_url}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        assert any(job["job_id"] == job_id for job in jobs)
        
        # Get specific job trace
        trace_response = auth_client.get(f"{base_url}/api/jobs/{job_id}/trace")
        assert trace_response.status_code == 200
        trace_data = trace_response.json()
        
        assert trace_data["job_id"] == job_id
        assert trace_data["status"] in ["Pending", "Running", "Completed", "Failed"]
        assert "traces" in trace_data
