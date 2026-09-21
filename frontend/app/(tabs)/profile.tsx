import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Switch,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import CodeBackground from '../../src/components/CodeBackground';
import Toast, { ToastType } from '../../src/components/Toast';
import {
  fetchMe,
  logout,
  getUserKeyStatus,
  saveProviderKey,
  setActiveProvider,
  deleteProviderKey,
  UserKeysStatus,
} from '../../src/services/api';
import { User } from '../../src/constants/types';

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

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState('groq');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [keyStatus, setKeyStatus] = useState<UserKeysStatus>({
    providers: {},
    active_provider: '',
    active_model: '',
    has_openai_key: false,
    has_anthropic_key: false,
  });

  const [filterBotPreference, setFilterBotPreference] = useState(true);
  const [trajectoryDetail, setTrajectoryDetail] = useState<'concise' | 'deep'>('deep');
  const [diffDensity, setDiffDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [isStandalonePWA, setIsStandalonePWA] = useState(false);

  // Delete confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  const [isDeletingKey, setIsDeletingKey] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('info');
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(msg: string, type: ToastType = 'info') {
    setToastMessage(msg);
    setToastType(type);
    setToastVisible(true);
  }

  useEffect(() => {
    loadUser();
    loadPreferences();
    checkPWA();
  }, []);

  async function loadPreferences() {
    try {
      const savedBot = await AsyncStorage.getItem('pref_filter_bot');
      if (savedBot !== null) setFilterBotPreference(savedBot === 'true');
      const savedTraj = await AsyncStorage.getItem('pref_trajectory_detail');
      if (savedTraj) setTrajectoryDetail(savedTraj as 'concise' | 'deep');
      const savedDensity = await AsyncStorage.getItem('pref_diff_density');
      if (savedDensity) setDiffDensity(savedDensity as 'compact' | 'comfortable');
    } catch {}
  }

  function checkPWA() {
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalonePWA(!!isStandalone);
    }
  }

  async function toggleBotPreference() {
    const next = !filterBotPreference;
    setFilterBotPreference(next);
    await AsyncStorage.setItem('pref_filter_bot', String(next));
  }

  async function selectTrajectoryDetail(val: 'concise' | 'deep') {
    setTrajectoryDetail(val);
    await AsyncStorage.setItem('pref_trajectory_detail', val);
  }

  async function selectDiffDensity(val: 'compact' | 'comfortable') {
    setDiffDensity(val);
    await AsyncStorage.setItem('pref_diff_density', val);
  }

  async function loadUser() {
    try {
      const data = await fetchMe();
      if (data) {
        setUser(data);
        const status = await getUserKeyStatus();
        setKeyStatus(status);
        const configuredId = (status.active_provider && status.providers?.[status.active_provider]?.configured)
          ? status.active_provider
          : (Object.keys(status.providers || {}).find((k) => status.providers[k]?.configured) || 'groq');
        setSelectedProviderId(configuredId);
        const preset = PROVIDER_PRESETS.find((p) => p.id === configuredId);
        setModelInput(status.providers?.[configuredId]?.model || preset?.defaultModel || '');
        setBaseUrlInput(status.providers?.[configuredId]?.base_url || preset?.defaultBaseUrl || '');
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  function handleSelectProvider(pId: string) {
    setSelectedProviderId(pId);
    const conf = keyStatus.providers?.[pId];
    const preset = PROVIDER_PRESETS.find((p) => p.id === pId);
    setModelInput(conf?.model || preset?.defaultModel || '');
    setBaseUrlInput(conf?.base_url || preset?.defaultBaseUrl || '');
    setApiKeyInput('');
  }

  async function handleSaveProvider() {
    if (!apiKeyInput.trim()) {
      showToast('Please enter an API key for ' + (currentPreset?.name || 'this provider'), 'error');
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
      showToast(`${currentPreset?.name || selectedProviderId} key saved & activated!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save provider key', 'error');
    } finally {
      setSavingKeys(false);
    }
  }

  async function handleSetActive(pId: string) {
    const isConfigured = !!keyStatus.providers?.[pId]?.configured;
    if (!isConfigured) {
      showToast('Please enter and save an API key first before activating this engine', 'error');
      return;
    }
    try {
      const currentModel = keyStatus.providers?.[pId]?.model || PROVIDER_PRESETS.find((p) => p.id === pId)?.defaultModel || '';
      await setActiveProvider(pId, currentModel);
      const updatedStatus = await getUserKeyStatus();
      setKeyStatus(updatedStatus);
      const pName = PROVIDER_PRESETS.find((p) => p.id === pId)?.name || pId;
      showToast(`Switched active engine to ${pName}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to switch active provider', 'error');
    }
  }

  function handleDeleteProvider(pId: string) {
    setProviderToDelete(pId);
    setDeleteModalVisible(true);
  }

  async function confirmDeleteProvider() {
    if (!providerToDelete) return;
    setIsDeletingKey(true);
    const pName = PROVIDER_PRESETS.find((p) => p.id === providerToDelete)?.name || providerToDelete;
    try {
      await deleteProviderKey(providerToDelete);
      const updated = await getUserKeyStatus();
      setKeyStatus(updated);
      if (providerToDelete === selectedProviderId) {
        setApiKeyInput('');
      }
      showToast(`${pName} credentials removed`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete key', 'error');
    } finally {
      setIsDeletingKey(false);
      setDeleteModalVisible(false);
      setProviderToDelete(null);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  const currentPreset = PROVIDER_PRESETS.find((p) => p.id === selectedProviderId) || PROVIDER_PRESETS[0];
  const isSelectedConfigured = !!keyStatus.providers?.[selectedProviderId]?.configured;
  const isSelectedActive = isSelectedConfigured && keyStatus.active_provider === selectedProviderId;
  const hasActiveEngine = Boolean(
    keyStatus.active_provider && keyStatus.providers?.[keyStatus.active_provider]?.configured
  );
  const activePreset = hasActiveEngine
    ? (PROVIDER_PRESETS.find((p) => p.id === keyStatus.active_provider) || null)
    : null;

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
          <Feather name="arrow-left" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Account</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <View>
            {/* ── Profile Card ── */}
            <View style={styles.profileCard}>
              <View style={styles.profileInner}>
                <View style={styles.avatarRing}>
                  {user.picture ? (
                    <Image source={{ uri: user.picture }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarInner}>
                      <Feather name="user" size={24} color={COLORS.primary} />
                    </View>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {user.name || user.github_username || 'Developer'}
                  </Text>
                  {user.email ? (
                    <Text style={styles.emailText} numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                  <View style={styles.profileBadgeRow}>
                    {user.github_username ? (
                      <Pressable
                        style={styles.githubChip}
                        onPress={() => WebBrowser.openBrowserAsync(`https://github.com/${user.github_username}`)}
                      >
                        <Feather name="github" size={11} color={COLORS.primary} />
                        <Text style={styles.githubChipText}>@{user.github_username}</Text>
                        <Feather name="external-link" size={10} color={COLORS.textTertiary} />
                      </Pressable>
                    ) : null}
                    <View style={styles.verifiedBadge}>
                      <Feather name="check-circle" size={10} color="#10B981" />
                      <Text style={styles.verifiedText}>OAuth Connected</Text>
                    </View>
                  </View>
                </View>
                <Pressable style={styles.logoutBtn} onPress={handleLogout} accessibilityLabel="Sign Out">
                  <Feather name="log-out" size={16} color={COLORS.error} />
                </Pressable>
              </View>
            </View>

            {/* ── Active AI Engine Banner ── */}
            {hasActiveEngine && activePreset ? (
              <View style={styles.activeEngineCard}>
                <View style={styles.activeEngineTop}>
                  <View style={styles.activePill}>
                    <View style={styles.activePillDot} />
                    <Text style={styles.activePillText}>ACTIVE AI ENGINE</Text>
                  </View>
                  <View style={styles.activeProviderTag}>
                    <Feather name={activePreset.icon as any} size={13} color={activePreset.color} />
                    <Text style={styles.activeProviderName}>{activePreset.name}</Text>
                  </View>
                </View>
                <Text style={styles.activeModelText}>
                  Model: <Text style={styles.activeModelHighlight}>{keyStatus.active_model || activePreset.defaultModel || 'Default'}</Text>
                </Text>
                <Text style={styles.activeHintText}>
                  Powers code review AI chat, PR reasoning analysis, and autonomous background agent workflows.
                </Text>
              </View>
            ) : (
              <View style={styles.inactiveEngineCard}>
                <View style={styles.activeEngineTop}>
                  <View style={styles.inactivePill}>
                    <View style={styles.inactivePillDot} />
                    <Text style={styles.inactivePillText}>NO ACTIVE ENGINE</Text>
                  </View>
                  <View style={styles.inactiveProviderTag}>
                    <Feather name="shield-off" size={13} color="#71717A" />
                    <Text style={styles.inactiveProviderName}>No Key Configured</Text>
                  </View>
                </View>
                <Text style={styles.inactiveEngineTitle}>Bring Your Own Key (BYOK)</Text>
                <Text style={styles.activeHintText}>
                  No AI engine is active by default. Enter your API key below and save it to activate AI features (code review chat, PR reasoning, and background agents).
                </Text>
              </View>
            )}

            {/* ── API Keys / Multi-Provider Section ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.sectionTitle}>AI Providers & API Keys (BYOK)</Text>
            </View>

            {/* Horizontal Provider Selector (Uniform Pill Row) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.providerScroll}
              contentContainerStyle={styles.providerScrollContent}
            >
              {PROVIDER_PRESETS.map((p) => {
                const isConfigured = !!keyStatus.providers?.[p.id]?.configured;
                const isActive = isConfigured && keyStatus.active_provider === p.id;
                const isSelected = selectedProviderId === p.id;

                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.providerPill,
                      isSelected && styles.providerPillSelected,
                    ]}
                    onPress={() => handleSelectProvider(p.id)}
                  >
                    <Feather name={p.icon as any} size={14} color={isSelected ? COLORS.primary : p.color} />
                    <Text style={[styles.providerPillText, isSelected && styles.providerPillTextSelected]}>
                      {p.name}
                    </Text>
                    {isActive ? (
                      <View style={styles.activePillInline}>
                        <View style={styles.activeDotInline} />
                        <Text style={styles.activeTextInline}>ACTIVE</Text>
                      </View>
                    ) : isConfigured ? (
                      <View style={styles.configuredDotInline} />
                    ) : null}
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
                  <Pressable
                    style={styles.trashBtn}
                    onPress={() => handleDeleteProvider(selectedProviderId)}
                    hitSlop={10}
                    testID="delete-provider-btn"
                    accessibilityLabel={`Delete ${currentPreset.name} API Key`}
                  >
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
                <Text style={styles.inputLabel}>{currentPreset.name} API Key</Text>
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

            {/* ── Review & Feed Preferences ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.sectionTitle}>Review & Feed Preferences</Text>
            </View>

            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.settingLabel}>Highlight Agent PRs</Text>
                  <Text style={styles.settingDesc}>
                    Prioritize PRs opened or updated by autonomous AI agents (Claude, Copilot, Dependabot) in the reel deck.
                  </Text>
                </View>
                <Switch
                  value={filterBotPreference}
                  onValueChange={toggleBotPreference}
                  trackColor={{ false: 'rgba(0,0,0,0.1)', true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.settingDivider} />

              <View style={styles.settingBlock}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.settingLabel}>Agent Trajectory Detail</Text>
                  <Text style={styles.settingDesc}>
                    Choose how deep the agent intent, reasoning trace, and tool call breakdown appear on PR cards.
                  </Text>
                </View>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[styles.segmentBtn, trajectoryDetail === 'concise' && styles.segmentBtnActive]}
                    onPress={() => selectTrajectoryDetail('concise')}
                  >
                    <Text style={[styles.segmentBtnText, trajectoryDetail === 'concise' && styles.segmentBtnTextActive]}>
                      Concise
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segmentBtn, trajectoryDetail === 'deep' && styles.segmentBtnActive]}
                    onPress={() => selectTrajectoryDetail('deep')}
                  >
                    <Text style={[styles.segmentBtnText, trajectoryDetail === 'deep' && styles.segmentBtnTextActive]}>
                      Deep Trace (Recommended)
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.settingDivider} />

              <View style={styles.settingBlock}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.settingLabel}>Diff Density</Text>
                  <Text style={styles.settingDesc}>
                    Display micro-diff blocks in comfortable or compact high-density mode.
                  </Text>
                </View>
                <View style={styles.segmentedControl}>
                  <Pressable
                    style={[styles.segmentBtn, diffDensity === 'comfortable' && styles.segmentBtnActive]}
                    onPress={() => selectDiffDensity('comfortable')}
                  >
                    <Text style={[styles.segmentBtnText, diffDensity === 'comfortable' && styles.segmentBtnTextActive]}>
                      Comfortable
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.segmentBtn, diffDensity === 'compact' && styles.segmentBtnActive]}
                    onPress={() => selectDiffDensity('compact')}
                  >
                    <Text style={[styles.segmentBtnText, diffDensity === 'compact' && styles.segmentBtnTextActive]}>
                      Compact
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* ── Reviewer Shortcuts & Gestures Guide ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.sectionTitle}>Reviewer Gestures & Quick Guide</Text>
            </View>

            <View style={styles.guideCard}>
              <View style={styles.guideRow}>
                <View style={styles.guideKeyBadge}>
                  <Feather name="arrow-up" size={12} color={COLORS.textPrimary} />
                  <Feather name="arrow-down" size={12} color={COLORS.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideLabel}>Reel Swipe Navigation</Text>
                  <Text style={styles.guideDesc}>Swipe or scroll up/down for snappy 1-PR reel transitions.</Text>
                </View>
              </View>

              <View style={styles.guideRow}>
                <View style={styles.guideKeyBadge}>
                  <Feather name="message-square" size={13} color={COLORS.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideLabel}>Instant AI Chat</Text>
                  <Text style={styles.guideDesc}>Tap the AI button on any PR card to ask questions about the diff.</Text>
                </View>
              </View>

              <View style={styles.guideRow}>
                <View style={styles.guideKeyBadge}>
                  <Feather name="play-circle" size={13} color={COLORS.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideLabel}>Dispatch Background Agent</Text>
                  <Text style={styles.guideDesc}>Launch automated test runs or refinement agents with one tap.</Text>
                </View>
              </View>
            </View>

            {/* ── App Runtime & Diagnostics ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.sectionTitle}>Client & System Diagnostics</Text>
            </View>

            <View style={styles.diagnosticsCard}>
              <View style={styles.diagRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diagLabel}>Runtime Environment</Text>
                  <Text style={styles.diagValue}>
                    {isStandalonePWA ? 'Installed Standalone PWA' : 'Web Browser Client'}
                  </Text>
                </View>
                <View style={[styles.diagStatusPill, { backgroundColor: isStandalonePWA ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)' }]}>
                  <View style={[styles.diagStatusDot, { backgroundColor: isStandalonePWA ? '#10B981' : '#3B82F6' }]} />
                  <Text style={[styles.diagStatusText, { color: isStandalonePWA ? '#10B981' : '#3B82F6' }]}>
                    {isStandalonePWA ? 'STANDALONE' : 'BROWSER'}
                  </Text>
                </View>
              </View>

              {!isStandalonePWA && (
                <Pressable
                  style={styles.installPwaRowBtn}
                  onPress={() => {
                    if (typeof window !== 'undefined') {
                      const ua = navigator.userAgent.toLowerCase();
                      const isIos = /iphone|ipad|ipod/.test(ua);
                      if (isIos) {
                        Alert.alert(
                          'Install on iPhone / iPad',
                          '1. In Safari, tap the Share button (square with arrow pointing up).\n2. Scroll down and tap "Add to Home Screen".\n3. Tap "Add" in the top right.\n\nMergeDeck will launch full-screen from your home screen!',
                          [{ text: 'Got it' }]
                        );
                      } else {
                        Alert.alert(
                          'Install on Android / Chrome',
                          '1. In Chrome, tap the three dots menu (⋮) in the top-right corner.\n2. Tap "Install app" or "Add to Home screen".\n3. Tap "Install".\n\nMergeDeck will appear in your app drawer and home screen!',
                          [{ text: 'Got it' }]
                        );
                      }
                    }
                  }}
                >
                  <Feather name="download" size={12} color={COLORS.primary} />
                  <Text style={styles.installPwaRowText}>Install PWA on this Device →</Text>
                </Pressable>
              )}

              <View style={styles.diagDivider} />

              <View style={styles.diagRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diagLabel}>Service Worker Cache</Text>
                  <Text style={styles.diagValue}>Offline Ready & Synced</Text>
                </View>
                <View style={[styles.diagStatusPill, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                  <View style={[styles.diagStatusDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.diagStatusText, { color: '#10B981' }]}>ACTIVE</Text>
                </View>
              </View>

              <View style={styles.diagDivider} />

              <View style={styles.diagRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.diagLabel}>MergeDeck Client Version</Text>
                  <Text style={styles.diagValue}>v1.4.2 (Edge Build)</Text>
                </View>
                <Text style={styles.diagBuildText}>AWS Docker</Text>
              </View>
            </View>
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

      {/* Delete Provider Key Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeletingKey) {
            setDeleteModalVisible(false);
            setProviderToDelete(null);
          }
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (!isDeletingKey) {
              setDeleteModalVisible(false);
              setProviderToDelete(null);
            }
          }}
        >
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconWrap}>
              <Feather name="trash-2" size={24} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>
              Remove {PROVIDER_PRESETS.find((p) => p.id === providerToDelete)?.name || 'Provider'} Key?
            </Text>
            <Text style={styles.modalDesc}>
              This will remove your stored API credentials for {PROVIDER_PRESETS.find((p) => p.id === providerToDelete)?.name || 'this provider'}. If this is your active engine, MergeDeck will automatically fallback to an available provider.
            </Text>

            <View style={styles.modalActionRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setProviderToDelete(null);
                }}
                disabled={isDeletingKey}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalDeleteBtn, isDeletingKey && { opacity: 0.7 }]}
                onPress={confirmDeleteProvider}
                disabled={isDeletingKey}
                testID="confirm-delete-key-btn"
              >
                {isDeletingKey ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="trash-2" size={14} color="#FFFFFF" />
                    <Text style={styles.modalDeleteText}>Delete Key</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Toast notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
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
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  profileInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  githubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  verifiedText: {
    fontSize: 10,
    color: '#10B981',
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

  // ── Active AI Engine Banner ──
  activeEngineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 16,
    marginTop: 14,
    gap: 7,
    ...SHADOWS.sm,
  },
  inactiveEngineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 16,
    marginTop: 14,
    gap: 7,
    ...SHADOWS.sm,
  },
  inactivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(113, 113, 122, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(113, 113, 122, 0.2)',
  },
  inactivePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#71717A',
  },
  inactivePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.5,
  },
  inactiveProviderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  inactiveProviderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  inactiveEngineTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeEngineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
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
    color: '#059669',
    letterSpacing: 0.5,
  },
  activeProviderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  activeProviderName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  activeModelText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeModelHighlight: {
    color: COLORS.primary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  activeHintText: {
    fontSize: 11,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },

  // ── Section headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
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

  // ── Provider Selector (Uniform Height Pill Row) ──
  providerScroll: {
    marginBottom: 14,
  },
  providerScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 14,
    height: 38,
    ...SHADOWS.sm,
  },
  providerPillSelected: {
    borderColor: '#18181B',
    backgroundColor: '#FAF8F5',
    borderWidth: 1.5,
  },
  providerPillText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  providerPillTextSelected: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  activePillInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  activeDotInline: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  activeTextInline: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.3,
  },
  configuredDotInline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  // ── Provider Config Inside Card ──
  keysCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 18,
    gap: 14,
    ...SHADOWS.sm,
  },
  providerConfigHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  activeBadgeLarge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activeBadgeLargeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 0.5,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  activateBtn: {
    backgroundColor: '#18181B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  activateBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  keysDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  keyInputsWrapper: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  keyInput: {
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modelChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  modelChip: {
    backgroundColor: '#FAF8F5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modelChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  modelChipText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modelChipTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  keyActions: {
    marginTop: 4,
  },
  saveKeyBtn: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  saveKeyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Preferences Card ──
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 16,
    ...SHADOWS.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  settingDesc: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 14,
  },
  settingBlock: {
    gap: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  segmentBtnTextActive: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // ── Guide Card ──
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 16,
    gap: 14,
    ...SHADOWS.sm,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideKeyBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  guideLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  guideDesc: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 1,
  },

  // ── Diagnostics Card ──
  diagnosticsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 16,
    ...SHADOWS.sm,
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  diagValue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  diagStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  diagStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  diagStatusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  diagDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 12,
  },
  diagBuildText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: COLORS.textTertiary,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  installPwaRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
  },
  installPwaRowText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // ── Logged-out empty state ──
  emptyState: {
    marginTop: 48,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyDesc: {
    color: COLORS.textTertiary,
    fontSize: 13,
    textAlign: 'center',
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

  // ── Delete Confirmation Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    // @ts-ignore
    backdropFilter: 'blur(8px)',
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#18181B',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 22,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#71717A',
  },
  modalDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
