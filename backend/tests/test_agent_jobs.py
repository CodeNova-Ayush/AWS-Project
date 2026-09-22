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
        assert trace_data["status"] in ["Pending", "Running", "Completed", "Failed", "Merged"]
        assert "traces" in trace_data

    def test_assign_agent_to_pr_with_auto_merge(self, base_url, auth_client):
        """Test assigning agent to an existing PR with auto_merge enabled"""
        assign_response = auth_client.post(
            f"{base_url}/api/agents/assign",
            json={
                "issue_id": "gh_pr_test-owner_test-repo_42",
                "agent_type": "opencode",
                "repo": "test-owner/test-repo",
                "auto_merge": True,
            }
        )
        assert assign_response.status_code == 200
        assign_data = assign_response.json()
        assert "job_id" in assign_data
        job_id = assign_data["job_id"]

        trace_response = auth_client.get(f"{base_url}/api/jobs/{job_id}/trace")
        assert trace_response.status_code == 200
        trace_data = trace_response.json()
        assert trace_data["auto_merge"] is True
        assert trace_data["issue_id"] == "gh_pr_test-owner_test-repo_42"
