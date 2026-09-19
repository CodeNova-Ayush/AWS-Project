import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/constants/theme';
import { fetchMe, logout, fetchSavedIssues, saveUserKeys, getUserKeyStatus, deleteUserKeys } from '../../src/services/api';
import { CodeIssue } from '../../src/constants/types';

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
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [keyStatus, setKeyStatus] = useState({ has_openai_key: false, has_anthropic_key: false });
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    try {
      const data = await fetchMe();
      if (data) {
        setUser(data);
        const [savedData, keyData] = await Promise.all([fetchSavedIssues(), getUserKeyStatus()]);
        setSavedIssues(savedData);
        setKeyStatus(keyData);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleSaveKeys() {
    if (!openaiKey && !anthropicKey) {
      Alert.alert('No keys entered', 'Please enter at least one API key.');
      return;
    }
    setSavingKeys(true);
    try {
      await saveUserKeys(openaiKey, anthropicKey);
      const status = await getUserKeyStatus();
      setKeyStatus(status);
      setOpenaiKey('');
      setAnthropicKey('');
      Alert.alert('Saved', 'API keys saved securely.');
    } catch {
      Alert.alert('Error', 'Failed to save keys.');
    } finally {
      setSavingKeys(false);
    }
  }

  async function handleDeleteKeys() {
    Alert.alert('Remove Keys', 'Delete all stored API keys?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteUserKeys();
        setKeyStatus({ has_openai_key: false, has_anthropic_key: false });
      }},
    ]);
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {user ? (
          <View>
            {/* ── Profile Card ── */}
            <View style={styles.profileCard}>
              {/* lime left-accent bar */}
              <View style={styles.profileAccentBar} />
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

            {/* ── API Keys ── */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.sectionTitle}>API Keys</Text>
            </View>
            <View style={styles.keysCard}>
              <View style={styles.keyStatusGrid}>
                <View style={[styles.keyBadge, keyStatus.has_openai_key && styles.keyBadgeActive]}>
                  <Feather name="cpu" size={13} color={keyStatus.has_openai_key ? COLORS.primary : COLORS.textTertiary} />
                  <Text style={[styles.keyBadgeText, keyStatus.has_openai_key && styles.keyBadgeTextActive]}>
                    OpenAI {keyStatus.has_openai_key ? '✓' : 'not set'}
                  </Text>
                </View>
                <View style={[styles.keyBadge, keyStatus.has_anthropic_key && styles.keyBadgeActiveAnthropic]}>
                  <Feather name="zap" size={13} color={keyStatus.has_anthropic_key ? COLORS.secondary : COLORS.textTertiary} />
                  <Text style={[styles.keyBadgeText, keyStatus.has_anthropic_key && styles.keyBadgeTextAnthropic]}>
                    Anthropic {keyStatus.has_anthropic_key ? '✓' : 'not set'}
                  </Text>
                </View>
              </View>

              <View style={styles.keysDivider} />

              <Pressable style={styles.toggleRow} onPress={() => setShowKeys(v => !v)}>
                <Feather name={showKeys ? 'eye-off' : 'edit-2'} size={13} color={COLORS.textSecondary} />
                <Text style={styles.toggleText}>{showKeys ? 'Hide inputs' : 'Update keys'}</Text>
                <Feather name={showKeys ? 'chevron-up' : 'chevron-down'} size={13} color={COLORS.textTertiary} style={{ marginLeft: 'auto' }} />
              </Pressable>

              {showKeys && (
                <View style={styles.keyInputsWrapper}>
                  <Text style={styles.inputLabel}>OpenAI API Key</Text>
                  <TextInput
                    style={styles.keyInput}
                    placeholder="sk-..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={openaiKey}
                    onChangeText={setOpenaiKey}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Anthropic API Key</Text>
                  <TextInput
                    style={styles.keyInput}
                    placeholder="sk-ant-..."
                    placeholderTextColor={COLORS.textTertiary}
                    value={anthropicKey}
                    onChangeText={setAnthropicKey}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <View style={styles.keyActions}>
                    <Pressable style={styles.saveKeyBtn} onPress={handleSaveKeys} disabled={savingKeys}>
                      {savingKeys
                        ? <ActivityIndicator size="small" color="#000" />
                        : <Text style={styles.saveKeyBtnText}>Save Keys</Text>}
                    </Pressable>
                    {(keyStatus.has_openai_key || keyStatus.has_anthropic_key) && (
                      <Pressable style={styles.deleteKeyBtn} onPress={handleDeleteKeys}>
                        <Feather name="trash-2" size={16} color={COLORS.error} />
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
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
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: SPACING.xs },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },

  // ── Profile Card ──
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  profileAccentBar: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  profileInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    flex: 1,
    width: '100%',
    borderRadius: 999,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  nameText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  emailText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
  },
  githubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  githubChipText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.error}30`,
  },

  // ── Section headers ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    flex: 1,
  },
  countBadge: {
    backgroundColor: `${COLORS.accent}20`,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${COLORS.accent}40`,
  },
  countText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.accent,
    fontWeight: '700',
  },

  // ── API Keys Card ──
  keysCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyStatusGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  keyBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyBadgeActive: {
    borderColor: `${COLORS.primary}50`,
    backgroundColor: `${COLORS.primary}12`,
  },
  keyBadgeActiveAnthropic: {
    borderColor: `${COLORS.secondary}50`,
    backgroundColor: `${COLORS.secondary}12`,
  },
  keyBadgeText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  keyBadgeTextActive: { color: COLORS.primary },
  keyBadgeTextAnthropic: { color: COLORS.secondary },
  keysDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  keyInputsWrapper: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  keyInput: {
    backgroundColor: COLORS.surfaceHighlight,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keyActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  saveKeyBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveKeyBtnText: {
    color: '#000',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  deleteKeyBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.error}30`,
  },

  // ── Saved Work ──
  savedList: {
    gap: SPACING.md,
  },
  savedCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  savedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
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
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  langBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  langText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  savedCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  savedCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaChipText: {
    fontSize: 10,
    color: COLORS.textTertiary,
    maxWidth: 120,
  },
  savedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  prNum: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textTertiary,
    fontWeight: '500',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: `${COLORS.primary}15`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}30`,
  },
  viewBtnText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  emptySaved: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${COLORS.accent}15`,
    borderWidth: 1,
    borderColor: `${COLORS.accent}30`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  emptyDesc: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    lineHeight: 18,
  },

  // ── Logged-out empty state ──
  emptyState: {
    marginTop: SPACING.xxxl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  primaryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.md,
  },
  primaryBtnText: {
    color: COLORS.background,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});
