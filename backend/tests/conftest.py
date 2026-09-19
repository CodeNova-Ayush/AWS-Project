import pytest
import requests
import os

@pytest.fixture(scope="session")
def base_url():
    """Get base URL from environment"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
    if not url:
        pytest.fail("EXPO_PUBLIC_BACKEND_URL environment variable not set")
    return url.rstrip('/')

@pytest.fixture(scope="session")
def test_session_token():
    """Pre-created test session token"""
    return "test_session_1771504385538"

@pytest.fixture(scope="session")
def test_user_id():
    """Pre-created test user ID"""
    return "test-user-1771504385538"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_client(test_session_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_session_token}"
    })
    return session
