export interface DiffLine {
  type: 'add' | 'del' | 'context';
  content: string;
}

export interface TrajectoryStep {
  text: string;
  phase?: 'analysis' | 'implement' | 'test' | 'git' | 'pr' | 'other';
  details?: string[];
}

export interface CodeIssue {
  issue_id: string;
  project: string;
  branch: string;
  type: 'bug' | 'performance' | 'suggestion';
  type_label: string;
  title: string;
  description: string;
  language: string;
  diff_lines: DiffLine[];
  trajectory_steps: TrajectoryStep[];
  created_at: string;
  github_pr_number?: number;
  github_owner?: string;
  github_repo?: string;
  github_pr_url?: string;
  github_state?: string;
  github_labels?: Array<{ name: string; color: string }>;
  github_issue_number?: number;
  github_issue_url?: string;
  agent_job_id?: string;
  agent_summary?: string;
  agent_traces?: TrajectoryStep[];
  agent_duration?: number;
  agent_lines_changed?: number;
  agent_type?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture: string;
  github_username?: string;
}

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
  tag: string;
}

export interface ProviderModelsResponse {
  provider: string;
  is_live: boolean;
  count?: number;
  models: ProviderModel[];
  default_model: string;
  message?: string;
  error?: string;
}

