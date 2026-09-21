import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/constants/theme';
import { fetchJobTrace, mergePR } from '../../src/services/api';
import * as WebBrowser from 'expo-web-browser';
import CreateIssueModal from '../../src/components/CreateIssueModal';
import AgentTrajectory from '../../src/components/AgentTrajectory';

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [createIssueVisible, setCreateIssueVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  async function handleMergePR() {
    if (!job) return;
    const owner = job.pr_owner || (job.repo?.includes('/') ? job.repo.split('/')[0] : '');
    const repo = job.pr_repo || (job.repo?.includes('/') ? job.repo.split('/')[1] : '');
    const prNum = job.pr_number;
    if (!owner || !repo || !prNum) {
      Alert.alert('Unable to merge', 'PR number or repository information is missing.');
      return;
    }
    const issueId = `gh_pr_${owner}_${repo}_${prNum}`;
    try {
      setMerging(true);
      await mergePR(issueId, 'squash');
      setJob((prev: any) => ({ ...prev, merged: true, status: 'Merged' }));
      Alert.alert('PR Merged! 🎉', `Pull Request #${prNum} was successfully merged into the default branch.`);
    } catch (err: any) {
      Alert.alert('Merge Failed', err?.message || 'Could not merge PR. Branch protections or reviews may be required.');
    } finally {
      setMerging(false);
    }
  }

  useEffect(() => {
    loadTrace();

    const interval = setInterval(() => {
      fetchJobTrace(id as string)
        .then(data => {
          setJob(data);
          // Stop polling once the job reaches a terminal state
          if (data?.status && data.status !== 'Running' && data.status !== 'Pending') {
            clearInterval(interval);
          }
        })
        .catch(err => {
          console.error('Failed to poll trace:', err);
          clearInterval(interval); // Stop polling on any error (e.g. 404 not found)
        });
    }, 2000);

    return () => clearInterval(interval);
  }, [id]);

  async function loadTrace() {
    try {
      setLoading(true);
      const data = await fetchJobTrace(id as string);
      setJob(data);
    } catch {
      setJob(null); // triggers "Session not found" UI
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    if (status === 'Completed') return COLORS.success;
    if (status === 'Pending') return COLORS.textTertiary;
    if (status === 'Running') return COLORS.primary;
    if (status === 'Failed') return '#ef4444';
    return COLORS.textSecondary;
  }

  function formatDuration(seconds: number | undefined) {
    if (seconds === undefined) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#18181B" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Session {id?.slice(0, 8)}</Text>
            {job && (
              <View style={[styles.statusBadge, { borderColor: getStatusColor(job.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(job.status) }]}>{job.status}</Text>
              </View>
            )}
          </View>
          <View style={{ width: 38 }} />
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {loading && !job ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : !job ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>Session not found.</Text>
          </View>
        ) : (
          <View style={styles.traceContainer}>
            <View style={styles.metaBox}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg }}>
                <View style={{ minWidth: '40%' }}>
                  <Text style={styles.metaLabel}>Repository</Text>
                  <Text style={styles.metaValue}>{job.repo}</Text>
                </View>

                <View style={{ minWidth: '40%' }}>
                  <Text style={styles.metaLabel}>Started At</Text>
                  <Text style={styles.metaValue}>
                    {job.created_at ? new Date(job.created_at).toLocaleTimeString([], { hour12: true, hour: 'numeric', minute: '2-digit' }) : '--'}
                  </Text>
                </View>
                
                <View style={{ minWidth: '40%' }}>
                  <Text style={styles.metaLabel}>Execution Time</Text>
                  <Text style={styles.metaValue}>
                    {job.duration_seconds !== undefined ? formatDuration(job.duration_seconds) : (job.status === 'Running' ? 'Running...' : '--')}
                  </Text>
                </View>

                {job.lines_changed !== undefined && (
                  <View style={{ minWidth: '40%' }}>
                    <Text style={styles.metaLabel}>Lines Changed</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Feather name="code" size={12} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={styles.metaValue}>
                        {job.lines_changed > 0 ? `+${job.lines_changed}` : job.lines_changed}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={{ height: 16 }} />
              
              <Text style={styles.metaLabel}>Agent Identity</Text>
              <View style={[
                styles.agentBadge,
                job.agent_type === 'claude_code' && styles.agentBadgeClaude,
                job.agent_type === 'kiro' && styles.agentBadgeKiro,
              ]}>
                {job.agent_type === 'codex' ? (
                  <Feather name="cpu" size={14} color={COLORS.primary} />
                ) : job.agent_type === 'opencode' ? (
                  <Feather name="code" size={14} color={COLORS.secondary} />
                ) : job.agent_type === 'claude_code' ? (
                  <MaterialCommunityIcons name="brain" size={14} color="#E8855A" />
                ) : job.agent_type === 'kiro' ? (
                  <FontAwesome5 name="amazon" size={12} color="#FF9900" />
                ) : (
                  <Feather name="terminal" size={14} color={COLORS.primary} />
                )}
                <Text style={[
                  styles.agentBadgeText,
                  job.agent_type === 'claude_code' && { color: '#E8855A' },
                  job.agent_type === 'kiro' && { color: '#FF9900' },
                ]}>
                  {job.agent_type === 'codex'
                    ? 'OpenAI Codex'
                    : job.agent_type === 'opencode'
                    ? 'OpenCode (GPT-4o)'
                    : job.agent_type === 'claude_code'
                    ? 'Claude Code'
                    : job.agent_type === 'kiro'
                    ? 'Kiro by Amazon'
                    : (job.agent_type || 'Custom Agent').toUpperCase()}
                </Text>
              </View>
            </View>

            {/* PR Info Card — shown when agent followed the new PR format */}
            {job.follow_new_pr_format && (job.pr_url || job.pr_number) && (
              <View style={styles.prInfoCard}>
                <View style={styles.prInfoCardHeader}>
                  <Feather name="git-pull-request" size={14} color="#E8855A" />
                  <Text style={styles.prInfoCardTitle}>Pull Request</Text>
                  {job.pr_number && (
                    <View style={styles.prNumBadge}>
                      <Text style={styles.prNumBadgeText}>#{job.pr_number}</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.prInfoRepo} numberOfLines={1}>{job.repo}</Text>

                <View style={styles.prInfoBadges}>
                  {job.lines_changed !== undefined && (
                    <View style={[styles.prBadge, { borderColor: 'rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)' }]}>
                      <Feather name="code" size={10} color="#34D399" />
                      <Text style={[styles.prBadgeText, { color: '#34D399' }]}>
                        {job.lines_changed > 0 ? `+${job.lines_changed}` : job.lines_changed} lines
                      </Text>
                    </View>
                  )}
                  {job.agent_type && (
                    <View style={[styles.prBadge, { borderColor: 'rgba(96,165,250,0.4)', backgroundColor: 'rgba(96,165,250,0.08)' }]}>
                      <Feather name="cpu" size={10} color="#60A5FA" />
                      <Text style={[styles.prBadgeText, { color: '#60A5FA' }]}>
                        {job.agent_type === 'claude_code' ? 'Claude Code'
                          : job.agent_type === 'kiro' ? 'Kiro'
                          : job.agent_type === 'opencode' ? 'OpenCode'
                          : 'Codex'}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.prBadge, { borderColor: 'rgba(167,139,250,0.4)', backgroundColor: 'rgba(167,139,250,0.08)' }]}>
                    <Feather name="zap" size={10} color="#A78BFA" />
                    <Text style={[styles.prBadgeText, { color: '#A78BFA' }]}>AI Generated</Text>
                  </View>
                </View>

                {job.merged ? (
                  <View style={styles.prMergedBanner}>
                    <Feather name="check-circle" size={14} color="#10B981" />
                    <Text style={styles.prMergedBannerText}>
                      Merged into base branch {job.merge_commit_sha ? `(${job.merge_commit_sha.slice(0, 7)})` : ''}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.prActionsRow}>
                    {job.pr_url && (
                      <Pressable
                        style={[styles.prInfoViewBtn, { flex: 1, marginTop: 0 }]}
                        onPress={() => WebBrowser.openBrowserAsync(job.pr_url)}
                      >
                        <Feather name="github" size={13} color="#000" />
                        <Text style={styles.prInfoViewBtnText}>View PR</Text>
                      </Pressable>
                    )}
                    {job.pr_number && (
                      <Pressable
                        style={[styles.prMergeNowBtn, merging && { opacity: 0.7 }]}
                        onPress={handleMergePR}
                        disabled={merging}
                      >
                        {merging ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Feather name="git-merge" size={13} color="#FFFFFF" />
                            <Text style={styles.prMergeNowBtnText}>Merge PR Now</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}

            {job.structured_summary && job.structured_summary.length > 0 ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Execution Summary</Text>
                <AgentTrajectory steps={job.structured_summary} />
              </View>
            ) : job.summary ? (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Execution Summary</Text>
                <Text style={styles.summaryText}>{job.summary}</Text>
              </View>
            ) : null}

            <View style={styles.terminalWindow}>
              <View style={styles.terminalHeader}>
                <View style={styles.macControls}>
                  <View style={[styles.macDot, { backgroundColor: '#ff5f56' }]} />
                  <View style={[styles.macDot, { backgroundColor: '#ffbd2e' }]} />
                  <View style={[styles.macDot, { backgroundColor: '#27c93f' }]} />
                </View>
                <Text style={styles.terminalTitle}>Live Output</Text>
              </View>
              
              <ScrollView 
                ref={scrollViewRef}
                style={styles.terminalContent}
                contentContainerStyle={{ paddingBottom: 20 }}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {job.traces?.map((trace: any, idx: number) => (
                  <View key={idx} style={styles.traceLine}>
                    <Text style={styles.traceTime}>
                      {new Date(trace.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                    <Text style={styles.traceText}>{trace.step}</Text>
                  </View>
                ))}
                {job.status === 'Running' && (
                  <View style={styles.traceLine}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={[styles.traceText, { color: COLORS.primary, marginLeft: 8 }]}>Agent is thinking...</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {job.status === 'Completed' && (
              <Pressable
                style={styles.prButton}
                onPress={() => {
                  if (job.pr_url) {
                    WebBrowser.openBrowserAsync(job.pr_url);
                  } else {
                    const traceWithUrl = job.traces?.slice().reverse().find((t: any) => t.step.includes('https://github.com/'));
                    if (traceWithUrl) {
                      const urlMatch = traceWithUrl.step.match(/https:\/\/github\.com\/\S+/);
                      if (urlMatch) WebBrowser.openBrowserAsync(urlMatch[0]);
                    }
                  }
                }}
              >
                <Feather name="github" size={20} color="#000" />
                <Text style={styles.prButtonText}>View Pull Request</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {/* Floating Action Pill */}
      {/* {job && (
        <Pressable 
          style={styles.floatingPill}
          onPress={() => setCreateIssueVisible(true)}
        >
          <Feather name="plus-circle" size={18} color={COLORS.primary} />
          <Text style={styles.floatingPillText}>New Job</Text>
        </Pressable>
      )} */}

      {/* Create Issue Modal */}
      <CreateIssueModal
        visible={createIssueVisible}
        onClose={() => setCreateIssueVisible(false)}
        onIssueCreated={() => {
        }}
        onJobAssigned={(jobId) => {
          router.replace(`/session/${jobId}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: '#FAF8F5',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.07)',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  headerCenter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    color: '#18181B',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  traceContainer: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  metaBox: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#71717A',
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  metaValue: {
    color: '#18181B',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  agentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
    gap: 6,
  },
  agentBadgeClaude: {
    backgroundColor: 'rgba(232, 133, 90, 0.12)',
    borderColor: 'rgba(232, 133, 90, 0.35)',
  },
  agentBadgeKiro: {
    backgroundColor: 'rgba(255, 153, 0, 0.12)',
    borderColor: 'rgba(255, 153, 0, 0.35)',
  },
  agentBadgeText: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  summaryTitle: {
    color: '#18181B',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  terminalWindow: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  macControls: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 16,
  },
  macDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  terminalTitle: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'Courier New',
  },
  terminalContent: {
    flex: 1,
    padding: 12,
  },
  traceLine: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  traceTime: {
    color: '#444',
    fontFamily: 'Courier New',
    fontSize: 12,
    marginRight: 12,
    marginTop: 2,
  },
  traceText: {
    color: '#00ff00',
    fontFamily: 'Courier New',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  prButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  prButtonText: {
    color: '#000',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  floatingPill: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5, 5, 5, 0.95)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingPillText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },

  // PR info card
  prInfoCard: {
    backgroundColor: 'rgba(232, 133, 90, 0.06)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(232, 133, 90, 0.25)',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  prInfoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  prInfoCardTitle: {
    color: '#E8855A',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    flex: 1,
  },
  prNumBadge: {
    backgroundColor: 'rgba(232, 133, 90, 0.15)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(232, 133, 90, 0.4)',
  },
  prNumBadgeText: {
    color: '#E8855A',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Courier New',
  },
  prInfoRepo: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontFamily: 'Courier New',
  },
  prInfoBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  prBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  prInfoViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  prInfoViewBtnText: {
    color: '#000',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  prMergedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    marginTop: SPACING.xs,
  },
  prMergedBannerText: {
    color: '#10B981',
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  prActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  prMergeNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: '#10B981',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
  },
  prMergeNowBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
});
