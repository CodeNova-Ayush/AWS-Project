"""
Backend API Tests for CodeTok
Tests all endpoints including auth, issues, save/unsave, apply, share, and chat
"""
import pytest
import requests
import time

class TestHealthAndSetup:
    """Basic health checks and data seeding"""
    
    def test_seed_data(self, base_url, api_client):
        """Ensure seed data exists"""
        response = api_client.post(f"{base_url}/api/seed")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Seed status: {data}")

class TestIssuesPublic:
    """Public endpoints - no auth required"""
    
    def test_get_all_issues(self, base_url, api_client):
        """GET /api/issues - should return 6 seeded issues"""
        response = api_client.get(f"{base_url}/api/issues")
        assert response.status_code == 200
        
        issues = response.json()
        assert isinstance(issues, list)
        assert len(issues) >= 6
        
        # Verify structure of first issue
        issue = issues[0]
        required_fields = ["issue_id", "project", "branch", "type", "title", 
                          "description", "language", "diff_lines", "trajectory_steps"]
        for field in required_fields:
            assert field in issue, f"Missing field: {field}"
        
        print(f"✓ Fetched {len(issues)} issues")

    def test_get_specific_issue(self, base_url, api_client):
        """GET /api/issues/issue_001 - should return specific issue"""
        response = api_client.get(f"{base_url}/api/issues/issue_001")
        assert response.status_code == 200
        
        issue = response.json()
        assert issue["issue_id"] == "issue_001"
        assert issue["project"] == "replay-web"
        assert issue["type"] == "bug"
        assert "diff_lines" in issue
        assert len(issue["diff_lines"]) > 0
        assert "trajectory_steps" in issue
        assert len(issue["trajectory_steps"]) > 0
        
        print(f"✓ Fetched issue: {issue['title']}")

    def test_get_nonexistent_issue(self, base_url, api_client):
        """GET /api/issues/nonexistent - should return 404"""
        response = api_client.get(f"{base_url}/api/issues/nonexistent")
        assert response.status_code == 404
        
        error = response.json()
        assert "detail" in error
        print(f"✓ 404 error handled correctly")

class TestAuthEndpoints:
    """Authentication endpoints"""
    
    def test_auth_me_without_token(self, base_url, api_client):
        """GET /api/auth/me without auth - should return 401"""
        response = api_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 401
        
        error = response.json()
        assert "detail" in error
        print(f"✓ Unauthorized access blocked")

    def test_auth_me_with_token(self, base_url, auth_client, test_user_id):
        """GET /api/auth/me with valid token - should return user data"""
        response = auth_client.get(f"{base_url}/api/auth/me")
        assert response.status_code == 200
        
        user = response.json()
        assert user["user_id"] == test_user_id
        assert "email" in user
        assert "name" in user
        assert "_id" not in user  # MongoDB _id should be excluded
        
        print(f"✓ Authenticated user: {user['email']}")

class TestSaveUnsaveEndpoints:
    """Save/unsave issue endpoints - require auth"""
    
    def test_save_issue_without_auth(self, base_url, api_client):
        """POST /api/issues/issue_001/save without auth - should return 401"""
        response = api_client.post(f"{base_url}/api/issues/issue_001/save")
        assert response.status_code == 401
        print(f"✓ Save without auth blocked")

    def test_save_and_unsave_flow(self, base_url, auth_client):
        """Test complete save → verify → unsave flow"""
        test_issue_id = "issue_002"
        
        # 1. Save the issue
        save_response = auth_client.post(f"{base_url}/api/issues/{test_issue_id}/save")
        assert save_response.status_code == 200
        save_data = save_response.json()
        assert save_data["saved"] == True
        print(f"✓ Issue saved")
        
        # 2. Verify it appears in saved IDs
        ids_response = auth_client.get(f"{base_url}/api/user/saved-ids")
        assert ids_response.status_code == 200
        saved_ids = ids_response.json()
        assert test_issue_id in saved_ids
        print(f"✓ Issue appears in saved IDs: {saved_ids}")
        
        # 3. Verify it appears in saved issues list
        list_response = auth_client.get(f"{base_url}/api/saved-issues")
        assert list_response.status_code == 200
        saved_issues = list_response.json()
        issue_ids = [issue["issue_id"] for issue in saved_issues]
        assert test_issue_id in issue_ids
        print(f"✓ Issue appears in saved issues list")
        
        # 4. Unsave the issue
        unsave_response = auth_client.delete(f"{base_url}/api/issues/{test_issue_id}/save")
        assert unsave_response.status_code == 200
        unsave_data = unsave_response.json()
        assert unsave_data["saved"] == False
        print(f"✓ Issue unsaved")
        
        # 5. Verify it's removed from saved IDs
        ids_after = auth_client.get(f"{base_url}/api/user/saved-ids")
        assert ids_after.status_code == 200
        saved_ids_after = ids_after.json()
        assert test_issue_id not in saved_ids_after
        print(f"✓ Issue removed from saved IDs")

    def test_get_saved_issues_without_auth(self, base_url, api_client):
        """GET /api/saved-issues without auth - should return 401"""
        response = api_client.get(f"{base_url}/api/saved-issues")
        assert response.status_code == 401
        print(f"✓ Saved issues without auth blocked")

    def test_get_saved_ids_without_auth(self, base_url, api_client):
        """GET /api/user/saved-ids without auth - should return 401"""
        response = api_client.get(f"{base_url}/api/user/saved-ids")
        assert response.status_code == 401
        print(f"✓ Saved IDs without auth blocked")

class TestApplyEndpoint:
    """Apply fix endpoint - requires auth"""
    
    def test_apply_without_auth(self, base_url, api_client):
        """POST /api/issues/issue_001/apply without auth - should return 401"""
        response = api_client.post(f"{base_url}/api/issues/issue_001/apply")
        assert response.status_code == 401
        print(f"✓ Apply without auth blocked")

    def test_apply_issue(self, base_url, auth_client):
        """POST /api/issues/issue_003/apply with auth - should succeed"""
        response = auth_client.post(f"{base_url}/api/issues/issue_003/apply")
        assert response.status_code == 200
        
        data = response.json()
        assert data["applied"] == True
        print(f"✓ Issue applied successfully")

class TestShareEndpoint:
    """Share endpoint - public, no auth required"""
    
    def test_share_issue(self, base_url, api_client):
        """POST /api/issues/issue_001/share - should return share URL"""
        response = api_client.post(f"{base_url}/api/issues/issue_001/share")
        assert response.status_code == 200
        
        data = response.json()
        assert "share_url" in data
        assert "issue_001" in data["share_url"]
        print(f"✓ Share URL generated: {data['share_url']}")

class TestChatEndpoints:
    """AI Chat endpoints - require auth"""
    
    def test_get_chat_history_without_auth(self, base_url, api_client):
        """GET /api/issues/issue_001/chat without auth - should return 401"""
        response = api_client.get(f"{base_url}/api/issues/issue_001/chat")
        assert response.status_code == 401
        print(f"✓ Chat history without auth blocked")

    def test_send_chat_without_auth(self, base_url, api_client):
        """POST /api/issues/issue_001/chat without auth - should return 401"""
        response = api_client.post(
            f"{base_url}/api/issues/issue_001/chat",
            json={"message": "test"}
        )
        assert response.status_code == 401
        print(f"✓ Send chat without auth blocked")

    def test_chat_flow_with_ai(self, base_url, auth_client):
        """Test complete chat flow: send message → get AI response → verify history"""
        test_issue_id = "issue_004"
        test_message = "What is the performance issue here?"
        
        # 1. Send chat message
        print("Sending chat message to AI...")
        send_response = auth_client.post(
            f"{base_url}/api/issues/{test_issue_id}/chat",
            json={"message": test_message}
        )
        assert send_response.status_code == 200
        
        ai_response = send_response.json()
        assert "role" in ai_response
        assert "content" in ai_response
        assert "timestamp" in ai_response
        assert ai_response["role"] == "assistant"
        assert len(ai_response["content"]) > 0
        
        print(f"✓ AI response received: {ai_response['content'][:100]}...")
        
        # 2. Verify chat history contains both messages
        history_response = auth_client.get(f"{base_url}/api/issues/{test_issue_id}/chat")
        assert history_response.status_code == 200
        
        history = history_response.json()
        assert isinstance(history, list)
        assert len(history) >= 2  # At least user message + AI response
        
        # Find our messages
        user_messages = [msg for msg in history if msg["role"] == "user" and msg["content"] == test_message]
        assert len(user_messages) >= 1
        
        ai_messages = [msg for msg in history if msg["role"] == "assistant"]
        assert len(ai_messages) >= 1
        
        print(f"✓ Chat history verified: {len(history)} messages total")

    def test_chat_nonexistent_issue(self, base_url, auth_client):
        """POST /api/issues/nonexistent/chat - should return 404"""
        response = auth_client.post(
            f"{base_url}/api/issues/nonexistent/chat",
            json={"message": "test"}
        )
        assert response.status_code == 404
        
        error = response.json()
        assert "detail" in error
        print(f"✓ Chat for nonexistent issue returns 404")

class TestDataValidation:
    """Test data structure and validation"""
    
    def test_issue_diff_lines_structure(self, base_url, api_client):
        """Verify diff_lines have correct structure with type and content"""
        response = api_client.get(f"{base_url}/api/issues/issue_001")
        assert response.status_code == 200
        
        issue = response.json()
        diff_lines = issue["diff_lines"]
        
        for line in diff_lines:
            assert "type" in line
            assert "content" in line
            assert line["type"] in ["add", "del", "context"]
        
        # Verify there are add and del lines (red/green highlighting)
        types = [line["type"] for line in diff_lines]
        assert "add" in types, "No 'add' lines found for green highlighting"
        assert "del" in types, "No 'del' lines found for red highlighting"
        
        print(f"✓ Diff lines structure validated: {len(diff_lines)} lines")

    def test_trajectory_steps_structure(self, base_url, api_client):
        """Verify trajectory_steps have correct structure"""
        response = api_client.get(f"{base_url}/api/issues/issue_001")
        assert response.status_code == 200
        
        issue = response.json()
        trajectory = issue["trajectory_steps"]
        
        assert len(trajectory) > 0, "No trajectory steps found"
        
        for step in trajectory:
            assert "text" in step
            assert len(step["text"]) > 0
        
        print(f"✓ Trajectory steps validated: {len(trajectory)} steps")

    def test_no_mongodb_id_in_responses(self, base_url, api_client):
        """Verify MongoDB _id is excluded from all responses"""
        # Test issues endpoint
        issues = api_client.get(f"{base_url}/api/issues").json()
        for issue in issues:
            assert "_id" not in issue
        
        print(f"✓ No MongoDB _id in responses")


class TestPRActions:
    """Test PR action endpoints (approve, reject, merge)."""

    def test_pr_actions_require_auth(self, base_url, api_client):
        """PR action endpoints require authentication."""
        for endpoint in ["approve", "reject", "merge"]:
            resp = api_client.post(f"{base_url}/api/prs/gh_pr_owner_repo_1/{endpoint}")
            assert resp.status_code == 401, f"{endpoint} should require auth"
            assert "detail" in resp.json()

    @pytest.mark.anyio
    async def test_pr_id_resolver(self):
        """Verify _resolve_pr_info parses different valid formats."""
        from app.services.pr_service import _resolve_pr_info
        
        # Standard gh_pr_ format
        owner, repo, num = await _resolve_pr_info("gh_pr_CodeNova-Ayush_AWS-Project_10")
        assert owner == "CodeNova-Ayush"
        assert repo == "AWS-Project"
        assert num == 10

        # With underscores in repo
        owner, repo, num = await _resolve_pr_info("gh_pr_octocat_hello_world_repo_42")
        assert owner == "octocat"
        assert repo == "hello_world_repo"
        assert num == 42

        # Invalid format
        with pytest.raises(ValueError):
            await _resolve_pr_info("invalid_format_pr")

    @pytest.mark.anyio
    async def test_filter_out_merged_prs(self):
        """Verify _filter_out_merged_prs excludes closed, merged, and local-merged PRs."""
        from app.services.pr_service import _filter_out_merged_prs
        from unittest.mock import AsyncMock, MagicMock

        mock_db = MagicMock()
        mock_db.agent_jobs.find.return_value.to_list = AsyncMock(return_value=[
            {"pr_owner": "ownerA", "pr_repo": "repoA", "pr_number": 10}
        ])
        mock_db.issues.find.return_value.to_list = AsyncMock(return_value=[
            {"issue_id": "gh_pr_ownerB_repoB_20"}
        ])

        sample_issues = [
            {"issue_id": "gh_pr_ownerA_repoA_10", "github_owner": "ownerA", "github_repo": "repoA", "github_pr_number": 10, "github_state": "open"},
            {"issue_id": "gh_pr_ownerB_repoB_20", "github_owner": "ownerB", "github_repo": "repoB", "github_pr_number": 20, "github_state": "open"},
            {"issue_id": "gh_pr_ownerC_repoC_30", "github_owner": "ownerC", "github_repo": "repoC", "github_pr_number": 30, "github_state": "closed"},
            {"issue_id": "gh_pr_ownerD_repoD_40", "github_owner": "ownerD", "github_repo": "repoD", "github_pr_number": 40, "github_state": "open", "merged": True},
            {"issue_id": "gh_pr_ownerE_repoE_50", "github_owner": "ownerE", "github_repo": "repoE", "github_pr_number": 50, "github_state": "open", "status": "Merged"},
            {"issue_id": "gh_pr_ownerF_repoF_60", "github_owner": "ownerF", "github_repo": "repoF", "github_pr_number": 60, "github_state": "open"},
        ]

        filtered = await _filter_out_merged_prs(mock_db, sample_issues)
        assert len(filtered) == 1
        assert filtered[0]["issue_id"] == "gh_pr_ownerF_repoF_60"


