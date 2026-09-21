import pytest
import requests
import os

@pytest.fixture(scope="session")
def base_url():
    """Get base URL from environment, defaulting to local port 8000"""
    url = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8000')
    return url.rstrip('/')

@pytest.fixture(scope="session")
def test_session_token(base_url):
    """Obtain dynamic session token via demo-login"""
    try:
        res = requests.post(f"{base_url}/api/auth/demo-login")
        if res.status_code == 200:
            return res.json().get("session_token", "test_session_fallback")
    except Exception:
        pass
    return "test_session_fallback"

@pytest.fixture(scope="session")
def test_user_id():
    """Pre-created test user ID"""
    return "user_demo_local"

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_client(base_url, test_session_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_session_token}"
    })
    return session
