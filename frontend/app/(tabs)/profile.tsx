import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import CodeBackground from '../../src/components/CodeBackground';
import {
  fetchMe,
  logout,
  fetchSavedIssues,
  getUserKeyStatus,
  saveProviderKey,
  setActiveProvider,
  deleteProviderKey,
  UserKeysStatus,
} from '../../src/services/api';
import { CodeIssue } from '../../src/constants/types';

export const PROVIDER_PRESETS = [
  {
    id: 'groq',
    name: 'Groq',
    badge: 'Fastest',
    color: '#F55036',
    icon: 'zap',
    defaultModel: 'llama-3.3-70b-versatile',
    popularModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    placeholder: 'gsk_...',
    hint: 'Ultra-low latency inference via Groq LPU',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    badge: 'Code & Reasoning',
    color: '#FF7000',
    icon: 'cpu',
    defaultModel: 'mistral-large-latest',
    popularModels: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest'],
    placeholder: '...',
    hint: 'Frontier European models including Codestral',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    badge: 'Enterprise',
    color: '#76B900',
    icon: 'terminal',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    popularModels: ['meta/llama-3.1-70b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    placeholder: 'nvapi-...',
    hint: 'Accelerated enterprise models on NVIDIA API Catalog',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'Standard',
    color: '#10A37F',
    icon: 'cpu',
    defaultModel: 'gpt-4o-mini',
    popularModels: ['gpt-4o-mini', 'gpt-4o', 'o1-mini'],
    placeholder: 'sk-...',
    hint: 'GPT-4o, GPT-4o-mini, and o1-mini models',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    badge: 'Claude',
    color: '#D97706',
    icon: 'shield',
    defaultModel: 'claude-3-5-sonnet-20241022',
    popularModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    placeholder: 'sk-ant-...',
    hint: 'Claude 3.5 Sonnet & Claude 3.5 Haiku',
    defaultBaseUrl: '',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: '100+ Models',
    color: '#6366F1',
    icon: 'globe',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    popularModels: ['anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-chat'],
    placeholder: 'sk-or-...',
    hint: 'Unified gateway to 100+ AI models & free tiers',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'custom',
    name: 'Custom',
    badge: 'Self-Hosted',
    color: '#A855F7',
    icon: 'server',
    defaultModel: '',
    popularModels: [],
    placeholder: 'API Key or Token...',
    hint: 'Any OpenAI-compatible API (Ollama, vLLM, LMStudio, LocalAI)',
    defaultBaseUrl: '',
  },
];

const TYPE_CONFIG = {
  bug:         { icon: 'alert-circle' as const, color: COLORS.error,   bg: COLORS.errorBg,                    label: 'Bug Fix' },
  performance: { icon: 'zap'          as const, color: COLORS.warning,  bg: 'rgba(245,158,11,0.1)',             label: 'Performance' },
  suggestion:  { icon: 'message-square' as const, color: COLORS.info,  bg: 'rgba(59,130,246,0.1)',             label: 'Suggestion' },
};

function SavedIssueCard({ issue, onPress, canNavigate }: { issue: CodeIssue; onPress: () => void; canNavigate: boolean }) {
  const cfg = TYPE_CONFIG[issue.type] ?? TYPE_CONFIG.bug;

  return (
    <Pressable style={[styles.savedCard, { borderLeftColor: cfg.color }]} onPress={onPress}>
      {/* Type badge + language */}
      <View style={styles.savedCardTop}>
        <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon} size={11} color={cfg.color} />
          <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={styles.langBadge}>
          <Text style={styles.langText}>{issue.language}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.savedCardTitle} numberOfLines={2}>{issue.title}</Text>

      {/* Repo + branch row */}
      <View style={styles.savedCardMeta}>
        <View style={styles.metaChip}>
          <Feather name="github" size={11} color={COLORS.textTertiary} />
          <Text style={styles.metaChipText} numberOfLines={1}>{issue.project}</Text>
        </View>
        <View style={styles.metaChip}>
          <Feather name="git-branch" size={11} color={COLORS.textTertiary} />
          <Text style={styles.metaChipText} numberOfLines={1}>{issue.branch}</Text>
        </View>
        {issue.agent_lines_changed !== undefined && (
          <View style={[styles.metaChip, { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.08)' }]}>
            <Feather name="code" size={11} color={COLORS.success} />
            <Text style={[styles.metaChipText, { color: COLORS.success }]}>
              {issue.agent_lines_changed > 0 ? `+${issue.agent_lines_changed}` : issue.agent_lines_changed} lines
            </Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.savedCardFooter}>
        {issue.github_pr_number && (
          <Text style={styles.prNum}>PR #{issue.github_pr_number}</Text>
        )}
        <View style={{ flex: 1 }} />
        {canNavigate ? (
          <View style={styles.viewBtn}>
            <Text style={styles.viewBtnText}>View session</Text>
            <Feather name="arrow-right" size={12} color={COLORS.primary} />
          </View>
        ) : issue.github_pr_url ? (
          <View style={[styles.viewBtn, { borderColor: `${COLORS.info}30`, backgroundColor: `${COLORS.info}15` }]}>
            <Text style={[styles.viewBtnText, { color: COLORS.info }]}>Open PR</Text>
            <Feather name="external-link" size={12} color={COLORS.info} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savedIssues, setSavedIssues] = useState<CodeIssue[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState('groq');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [keyStatus, setKeyStatus] = useState<UserKeysStatus>({
    providers: {},
    active_provider: 'groq',
    active_model: 'llama-3.3-70b-versatile',
    has_openai_key: false,
    has_anthropic_key: false,
  });

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    try {
      const data = await fetchMe();
      if (data) {
        setUser(data);
        const [savedData, status] = await Promise.all([fetchSavedIssues(), getUserKeyStatus()]);
        setSavedIssues(savedData);
        setKeyStatus(status);
        const initialProvider = status.active_provider || 'groq';
        setSelectedProviderId(initialProvider);
        const preset = PROVIDER_PRESETS.find(p => p.id === initialProvider);
        setModelInput(status.providers?.[initialProvider]?.model || preset?.defaultModel || '');
        setBaseUrlInput(status.providers?.[initialProvider]?.base_url || preset?.defaultBaseUrl || '');
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function handleSelectProvider(pId: string) {
    setSelectedProviderId(pId);
    const conf = keyStatus.providers?.[pId];
    const preset = PROVIDER_PRESETS.find(p => p.id === pId);
    setModelInput(conf?.model || preset?.defaultModel || '');
    setBaseUrlInput(conf?.base_url || preset?.defaultBaseUrl || '');
    setApiKeyInput('');
  }

  async function handleSaveProvider() {
    if (!apiKeyInput.trim()) {
      Alert.alert('Missing API Key', 'Please enter an API key for ' + (currentPreset?.name || 'this provider'));
      return;
    }
    setSavingKeys(true);
    try {
      await saveProviderKey(
        selectedProviderId,
        apiKeyInput.trim(),
        modelInput.trim(),
        baseUrlInput.trim(),
        true,
      );
      const updatedStatus = await getUserKeyStatus();
      setKeyStatus(updatedStatus);
      setApiKeyInput('');
      Alert.alert('Saved & Activated', `${currentPreset?.name || selectedProviderId} is now active for AI chat & agents.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save provider key.');
    } finally {
      setSavingKeys(false);
    }
  }

  async function handleSetActive(pId: string) {
    try {
      const currentModel = keyStatus.providers?.[pId]?.model || PROVIDER_PRESETS.find(p => p.id === pId)?.defaultModel || '';
      await setActiveProvider(pId, currentModel);
      const updatedStatus = await getUserKeyStatus();
      setKeyStatus(updatedStatus);
    } catch {
      Alert.alert('Error', 'Failed to switch active provider.');
    }
  }

  async function handleDeleteProvider(pId: string) {
    const pName = PROVIDER_PRESETS.find(p => p.id === pId)?.name || pId;
    Alert.alert(`Delete ${pName} Key?`, `Remove stored credentials for ${pName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProviderKey(pId);
            const updated = await getUserKeyStatus();
            setKeyStatus(updated);
            if (pId === selectedProviderId) {
              setApiKeyInput('');
            }
          } catch {
            Alert.alert('Error', 'Failed to delete key.');
          }
        },
      },
    ]);
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  const currentPreset = PROVIDER_PRESETS.find(p => p.id === selectedProviderId) || PROVIDER_PRESETS[0];
  const isSelectedConfigured = !!keyStatus.providers?.[selectedProviderId]?.configured;
  const isSelectedActive = keyStatus.active_provider === selectedProviderId;
  const activePreset = PROVIDER_PRESETS.find(p => p.id === keyStatus.active_provider) || PROVIDER_PRESETS[0];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <CodeBackground />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <View>
            {/* ── Profile Card ── */}
            <View style={styles.profileCard}>
              <View style={styles.profileInner}>
                <View style={styles.avatarRing}>
                  <View style={styles.avatarInner}>
                    <Feather name="user" size={26} color={COLORS.primary} />
                  </View>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {user.name || user.github_username || 'Developer'}
                  </Text>
                  {user.email ? (
                    <Text style={styles.emailText} numberOfLines={1}>{user.email}</Text>
                  ) : null}
                  {user.github_username ? (
                    <View style={styles.githubChip}>
                      <Feather name="github" size={11} color={COLORS.primary} />
                      <Text style={styles.githubChipText}>@{user.github_username}</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                  <Feather name="log-out" size={15} color={COLORS.error} />
                </Pressable>
              </View>
            </View>

            {/* ── Active AI Engine Banner ── */}
            <View style={styles.activeEngineCard}>
              <View style={styles.activeEngineTop}>
                <View style={styles.activePill}>
                  <View style={styles.activePillDot} />
                  <Text style={styles.activePillText}>ACTIVE AI ENGINE</Text>
                </View>
                <Text style={styles.activeProviderName}>{activePreset.name}</Text>
              </View>
              <Text style={styles.activeModelText}>
                Model: <Text style={{ color: COLORS.primary, fontFamily: 'monospace' }}>{keyStatus.active_model || activePreset.defaultModel || 'Default'}</Text>
              </Text>
              <Text style={styles.activeHintText}>
                Used automatically for Code Review AI Chat, PR Analysis, and Agent workflows.
              </Text>
            </View>

            {/* ── API Keys / Multi-Provider Section ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.sectionTitle}>AI Providers & API Keys (BYOK)</Text>
            </View>

            {/* Horizontal Provider Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.providerScroll} contentContainerStyle={styles.providerScrollContent}>
              {PROVIDER_PRESETS.map((p) => {
                const isConfigured = !!keyStatus.providers?.[p.id]?.configured;
                const isActive = keyStatus.active_provider === p.id;
                const isSelected = selectedProviderId === p.id;

                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.providerTab,
                      isSelected && styles.providerTabSelected,
                      isActive && styles.providerTabActiveBorder,
                    ]}
                    onPress={() => handleSelectProvider(p.id)}
                  >
                    <View style={styles.providerTabHeader}>
                      <Feather name={p.icon as any} size={14} color={isSelected ? COLORS.primary : p.color} />
                      <Text style={[styles.providerTabText, isSelected && styles.providerTabTextSelected]}>
                        {p.name}
                      </Text>
                      {isConfigured && (
                        <View style={styles.configuredDot} />
                      )}
                    </View>
                    {isActive && (
                      <View style={styles.activeMiniBadge}>
                        <Text style={styles.activeMiniBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Selected Provider Card */}
            <View style={styles.keysCard}>
              <View style={styles.providerConfigHeader}>
                <View style={[styles.providerIconRing, { backgroundColor: `${currentPreset.color}20` }]}>
                  <Feather name={currentPreset.icon as any} size={20} color={currentPreset.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.providerConfigTitle}>{currentPreset.name}</Text>
                    {isSelectedActive && (
                      <View style={styles.activeBadgeLarge}>
                        <Text style={styles.activeBadgeLargeText}>CURRENTLY ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.providerConfigHint}>{currentPreset.hint}</Text>
                </View>

                {isSelectedConfigured && (
                  <Pressable style={styles.trashBtn} onPress={() => handleDeleteProvider(selectedProviderId)}>
                    <Feather name="trash-2" size={16} color={COLORS.error} />
                  </Pressable>
                )}
              </View>

              {/* Status Row */}
              <View style={styles.providerStatusRow}>
                <View style={styles.statusIndicator}>
                  <View style={[styles.statusDot, { backgroundColor: isSelectedConfigured ? '#22C55E' : COLORS.textTertiary }]} />
                  <Text style={styles.statusLabel}>
                    {isSelectedConfigured ? 'API Key Configured & Ready' : 'No Key Configured'}
                  </Text>
                </View>
                {isSelectedConfigured && !isSelectedActive && (
                  <Pressable style={styles.activateBtn} onPress={() => handleSetActive(selectedProviderId)}>
                    <Text style={styles.activateBtnText}>Switch to this Engine</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.keysDivider} />

              {/* Input Form */}
              <View style={styles.keyInputsWrapper}>
                <Text style={styles.inputLabel}>
                  {currentPreset.name} API Key
                </Text>
                <TextInput
                  style={styles.keyInput}
                  placeholder={isSelectedConfigured ? '•••••••••••••••••••••••• (Leave blank to keep)' : currentPreset.placeholder}
                  placeholderTextColor={COLORS.textTertiary}
                  value={apiKeyInput}
                  onChangeText={setApiKeyInput}
                  secureTextEntry
                  autoCapitalize="none"
                />

                {/* Model Selection */}
                <Text style={styles.inputLabel}>Model Name</Text>
                {currentPreset.popularModels.length > 0 && (
                  <View style={styles.modelChipsRow}>
                    {currentPreset.popularModels.map((m) => (
                      <Pressable
                        key={m}
                        style={[styles.modelChip, modelInput === m && styles.modelChipSelected]}
                        onPress={() => setModelInput(m)}
                      >
                        <Text style={[styles.modelChipText, modelInput === m && styles.modelChipTextSelected]}>
                          {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  style={styles.keyInput}
                  placeholder={`e.g. ${currentPreset.defaultModel || 'model-name'}`}
                  placeholderTextColor={COLORS.textTertiary}
                  value={modelInput}
                  onChangeText={setModelInput}
                  autoCapitalize="none"
                />

                {/* Base URL (for Custom or Override) */}
                {(selectedProviderId === 'custom' || currentPreset.defaultBaseUrl) && (
                  <View style={{ marginTop: SPACING.xs }}>
                    <Text style={styles.inputLabel}>API Base URL</Text>
                    <TextInput
                      style={styles.keyInput}
                      placeholder={currentPreset.defaultBaseUrl || 'https://.../v1'}
                      placeholderTextColor={COLORS.textTertiary}
                      value={baseUrlInput}
                      onChangeText={setBaseUrlInput}
                      autoCapitalize="none"
                    />
                  </View>
                )}

                <View style={styles.keyActions}>
                  <Pressable
                    style={styles.saveKeyBtn}
                    onPress={handleSaveProvider}
                    disabled={savingKeys}
                  >
                    {savingKeys ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.saveKeyBtnText}>
                        {isSelectedConfigured ? 'Update & Activate' : 'Save & Set as Active'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>

            {/* ── Saved Work ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.accent }]} />
              <Text style={styles.sectionTitle}>Saved Work</Text>
              {savedIssues.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{savedIssues.length}</Text>
                </View>
              )}
            </View>

            {savedIssues.length === 0 ? (
              <View style={styles.emptySaved}>
                <View style={styles.emptyIconRing}>
                  <Feather name="bookmark" size={24} color={COLORS.accent} />
                </View>
                <Text style={styles.emptyTitle}>Nothing saved yet</Text>
                <Text style={styles.emptyDesc}>Bookmark PRs from the feed to find them here.</Text>
              </View>
            ) : (
              <View style={styles.savedList}>
                {savedIssues.map((issue) => (
                  <SavedIssueCard
                    key={issue.issue_id}
                    issue={issue}
                    canNavigate={!!issue.agent_job_id}
                    onPress={() => {
                      if (issue.agent_job_id) {
                        router.push(`/session/${issue.agent_job_id}`);
                      } else if (issue.github_pr_url) {
                        WebBrowser.openBrowserAsync(issue.github_pr_url);
                      }
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="user-x" size={48} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>Not signed in</Text>
            <Text style={styles.emptyDesc}>Please sign in to view your profile.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => router.replace('/')}>
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: 'rgba(250, 248, 245, 0.85)',
    // @ts-ignore
    backdropFilter: 'blur(20px)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    ...SHADOWS.sm,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },

  // ── Profile Card ──
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    flexDirection: 'row',
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  profileAccentBar: {
    display: 'none',
  },
  profileInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
  },
  avatarInner: {
    flex: 1,
    width: '100%',
    borderRadius: 26,
    backgroundColor: 'rgba(24, 24, 27, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  emailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  githubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FAF8F5',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
  },
  githubChipText: {
    fontSize: 11,
    color: '#27272A',
    fontWeight: '600',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },

  // ── Section headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#FAF8F5',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  countText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // ── Active Engine Card ──
  activeEngineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 16,
    marginTop: 14,
    gap: 6,
    ...SHADOWS.sm,
  },
  activeEngineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
  },
  activePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#27272A',
    letterSpacing: 0.5,
  },
  activeProviderName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeModelText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeHintText: {
    fontSize: 11,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },

  // ── Provider Selector ──
  providerScroll: {
    marginBottom: 12,
  },
  providerScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  providerTab: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    minWidth: 96,
    ...SHADOWS.sm,
  },
  providerTabSelected: {
    borderColor: '#18181B',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    ...SHADOWS.md,
  },
  providerTabActiveBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#18181B',
  },
  providerTabHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  providerTabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  providerTabTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  configuredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeMiniBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  activeMiniBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#059669',
  },

  // ── Provider Config Inside Card ──
  providerConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerIconRing: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerConfigTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  providerConfigHint: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  activeBadgeLarge: {
    backgroundColor: 'rgba(24, 24, 27, 0.06)',
    borderColor: 'rgba(24, 24, 27, 0.12)',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeBadgeLargeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#18181B',
  },
  trashBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  providerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activateBtn: {
    backgroundColor: '#18181B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    ...SHADOWS.sm,
  },
  activateBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ── Model Chips ──
  modelChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  modelChip: {
    backgroundColor: '#FAF8F5',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  modelChipSelected: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  modelChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modelChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // ── API Keys Card ──
  keysCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    ...SHADOWS.md,
  },
  keysDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginVertical: 14,
  },
  keyInputsWrapper: {
    marginTop: 10,
    gap: 8,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  keyInput: {
    backgroundColor: '#FAF8F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: COLORS.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  keyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    alignItems: 'center',
  },
  saveKeyBtn: {
    flex: 1,
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    ...SHADOWS.sm,
  },
  saveKeyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  deleteKeyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },

  // ── Saved Work ──
  savedList: {
    gap: 12,
  },
  savedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    borderLeftWidth: 4,
    padding: 16,
    gap: 10,
    ...SHADOWS.sm,
  },
  savedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  langBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  langText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  savedCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  savedCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  metaChipText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    maxWidth: 120,
    fontWeight: '500',
  },
  savedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  prNum: {
    fontSize: 11,
    color: COLORS.textTertiary,
    fontWeight: '600',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#18181B',
    ...SHADOWS.sm,
  },
  viewBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptySaved: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    ...SHADOWS.sm,
  },
  emptyIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyDesc: {
    color: COLORS.textTertiary,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  // ── Logged-out empty state ──
  emptyState: {
    marginTop: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    marginTop: 16,
    backgroundColor: '#18181B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    ...SHADOWS.sm,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
