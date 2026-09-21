import AsyncStorage from '@react-native-async-storage/async-storage';
import { CodeIssue, ChatMessage, User, ProviderModelsResponse } from '../constants/types';

export function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL && !process.env.EXPO_PUBLIC_BACKEND_URL.includes('10.20.16.188')) {
    return process.env.EXPO_PUBLIC_BACKEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol || 'http:';
    // Local development fallback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^10\.|^192\.168\./.test(hostname)) {
      return `${protocol}//${hostname}:8000`;
    }
    // Production Cloud Deployment (AWS App Runner / CloudFront / Custom Domain)
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
}

const API_BASE = getApiBase();

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('session_token');
  if (token) {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}

export async function fetchIssues(): Promise<CodeIssue[]> {
  const res = await fetch(`${API_BASE}/api/issues`);
  if (!res.ok) throw new Error('Failed to fetch issues');
  return res.json();
}

export async function fetchIssue(issueId: string): Promise<CodeIssue> {
  const res = await fetch(`${API_BASE}/api/issues/${issueId}`);
  if (!res.ok) throw new Error('Failed to fetch issue');
  return res.json();
}

export async function saveIssue(issueId: string): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_BASE}/api/issues/${issueId}/save`, { method: 'POST', headers, credentials: 'include' });
}

export async function unsaveIssue(issueId: string): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_BASE}/api/issues/${issueId}/save`, { method: 'DELETE', headers, credentials: 'include' });
}

export async function fetchSavedIssues(): Promise<CodeIssue[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/saved-issues`, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch saved issues');
  return res.json();
}

export async function fetchSavedIds(): Promise<string[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/saved-ids`, { headers, credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function applyIssue(issueId: string): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_BASE}/api/issues/${issueId}/apply`, { method: 'POST', headers, credentials: 'include' });
}

export async function shareIssue(issueId: string): Promise<{ share_url: string }> {
  const res = await fetch(`${API_BASE}/api/issues/${issueId}/share`, { method: 'POST' });
  return res.json();
}

export async function fetchChatHistory(issueId: string): Promise<ChatMessage[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/issues/${issueId}/chat`, { headers, credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function sendChatMessage(
  issueId: string,
  message: string,
  issueContext?: Record<string, any>,
  provider?: string,
  model?: string,
): Promise<ChatMessage> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/issues/${issueId}/chat`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      message,
      issue_context: issueContext ?? null,
      provider: provider || null,
      model: model || null,
    }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function exchangeSession(sessionId: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error('Auth failed');
  const user = await res.json();
  // Store the session token from cookie fallback
  if (user.session_token) {
    await AsyncStorage.setItem('session_token', user.session_token);
  }
  return user;
}

export async function demoLogin(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Demo login failed');
  const user = await res.json();
  if (user.session_token) {
    await AsyncStorage.setItem('session_token', user.session_token);
  }
  return user;
}

export async function fetchMe(): Promise<User | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers, credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', headers, credentials: 'include' });
  await AsyncStorage.removeItem('session_token');
}

// GitHub PR functions
export async function fetchPersonalPRs(force = false): Promise<CodeIssue[]> {
  const headers = await getAuthHeaders();
  const url = `${API_BASE}/api/prs/personal${force ? '?force=true' : ''}`;
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch personal PRs');
  return res.json();
}

export async function fetchOrgPRs(force = false): Promise<CodeIssue[]> {
  const headers = await getAuthHeaders();
  const url = `${API_BASE}/api/prs/org${force ? '?force=true' : ''}`;
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch org PRs');
  return res.json();
}

export async function fetchMixedIssues(): Promise<CodeIssue[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/issues/mixed`, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch mixed issues');
  return res.json();
}

export async function fetchPersonalIssues(force = false): Promise<CodeIssue[]> {
  const headers = await getAuthHeaders();
  const url = `${API_BASE}/api/issues/personal${force ? '?force=true' : ''}`;
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch personal issues');
  return res.json();
}

export async function fetchOrgIssues(force = false): Promise<CodeIssue[]> {
  const headers = await getAuthHeaders();
  const url = `${API_BASE}/api/issues/org${force ? '?force=true' : ''}`;
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch org issues');
  return res.json();
}



export async function approvePR(issueId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/prs/${issueId}/approve`, {
    method: 'POST',
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to approve PR');
}

export async function rejectPR(issueId: string, comment?: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/prs/${issueId}/reject`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ comment: comment || 'Changes requested via MergeDeck' }),
  });
  if (!res.ok) throw new Error('Failed to reject PR');
}

export async function mergePR(
  issueId: string,
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge',
  commitTitle?: string,
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/prs/${issueId}/merge`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      merge_method: mergeMethod,
      commit_title: commitTitle || '',
      commit_message: 'Merged via MergeDeck',
    }),
  });
  if (!res.ok) throw new Error('Failed to merge PR');
}

export async function mergeAllPRs(
  issueIds: string[],
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'
): Promise<{ success: boolean; total: number; merged_count: number; results: any[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/prs/merge-all`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ issue_ids: issueIds, merge_method: mergeMethod }),
  });
  if (!res.ok) throw new Error('Failed to bulk merge PRs');
  return res.json();
}

export async function assignAgent(
  issueId: string,
  agentType: "opencode" | "claude_code" | "codex" | "kiro",
  repo: string,
  autoMerge: boolean = false,
): Promise<{job_id: string}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/agents/assign`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ issue_id: issueId, agent_type: agentType, repo, auto_merge: autoMerge })
  });
  if (!res.ok) throw new Error('Failed to assign agent');
  return res.json();
}

export async function fetchJobTrace(jobId: string): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/trace`, {
    method: 'GET',
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch job trace');
  return res.json();
}

export async function fetchJobs(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: 'GET',
    headers,
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export interface ProviderStatus {
  configured: boolean;
  name: string;
  base_url: string;
  model: string;
}

export interface UserKeysStatus {
  providers: Record<string, ProviderStatus>;
  active_provider: string;
  active_model: string;
  has_openai_key: boolean;
  has_anthropic_key: boolean;
}

export async function saveProviderKey(
  provider: string,
  apiKey: string,
  model?: string,
  baseUrl?: string,
  setActive: boolean = true,
): Promise<{ message: string; provider: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/keys`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      provider,
      api_key: apiKey,
      model: model || '',
      base_url: baseUrl || '',
      set_active: setActive,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save provider key');
  }
  return res.json();
}

export async function setActiveProvider(provider: string, model?: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/keys/active`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify({ provider, model: model || '' }),
  });
  if (!res.ok) throw new Error('Failed to set active provider');
}

export async function deleteProviderKey(provider: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/keys/${provider}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete provider key');
}

export async function saveUserKeys(openaiKey: string, anthropicKey: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/keys`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify({ openai_key: openaiKey, anthropic_key: anthropicKey }),
  });
  if (!res.ok) throw new Error('Failed to save API keys');
}

export async function getUserKeyStatus(): Promise<UserKeysStatus> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/keys`, { headers, credentials: 'include' });
  if (!res.ok) {
    return {
      providers: {},
      active_provider: '',
      active_model: '',
      has_openai_key: false,
      has_anthropic_key: false,
    };
  }
  return res.json();
}

export async function fetchProviderModels(
  provider: string,
  apiKey?: string,
  baseUrl?: string
): Promise<ProviderModelsResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ provider });
  if (apiKey) params.append('api_key', apiKey);
  if (baseUrl) params.append('base_url', baseUrl);

  const res = await fetch(`${API_BASE}/api/user/models?${params.toString()}`, {
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.statusText}`);
  }
  return res.json();
}

export async function testProviderConnection(
  provider: string,
  apiKey?: string,
  model?: string,
  baseUrl?: string
): Promise<{ success: boolean; message?: string; error?: string; provider: string; model?: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/test-key`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      provider,
      api_key: apiKey || '',
      model: model || '',
      base_url: baseUrl || '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.detail || 'Connection test failed', provider, model };
  }
  return res.json();
}

export async function deleteUserKeys(): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_BASE}/api/user/keys`, { method: 'DELETE', headers, credentials: 'include' });
}

export async function fetchUserRepos(): Promise<Array<{ full_name: string; name: string; private: boolean; description: string }>> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/user/repos`, { headers, credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function createIssueRemote(
  repo: string,
  title: string,
  description: string,
  type: string,
  autoMerge: boolean = false,
): Promise<{ success: boolean; issue_url?: string; issue_number?: number; issue_id?: string; issue?: any }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/issues/create`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ repo, title, description, type, auto_merge: autoMerge }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to create issue');
  }
  return res.json();
}
