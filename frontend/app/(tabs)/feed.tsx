import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
  useWindowDimensions, Alert, Share, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/constants/theme';
import { CodeIssue } from '../../src/constants/types';
import {
  fetchIssues, fetchMe, saveIssue, unsaveIssue, fetchSavedIds,
  applyIssue, logout, fetchMixedIssues, fetchPersonalPRs, fetchOrgPRs,
  fetchOrgIssues, fetchPersonalIssues,
  approvePR, rejectPR, mergePR,
} from '../../src/services/api';
import CodeIssueCard from '../../src/components/CodeIssueCard';
import ActionSidebar from '../../src/components/ActionSidebar';
import AIChatSheet from '../../src/components/AIChatSheet';
import AssignAgentModal from '../../src/components/AssignAgentModal';
import CodeBackground from '../../src/components/CodeBackground';
import Toast, { ToastType } from '../../src/components/Toast';
import PRActionModal, { PRActionMode, MergeMethod } from '../../src/components/PRActionModal';
import CreateIssueModal from '../../src/components/CreateIssueModal';
import CILogModal from '../../src/components/CILogModal';
import FullDiffModal from '../../src/components/FullDiffModal';
import { CIInfo, ParsedDiffFile, DiffMetrics } from '../../src/utils/cardHelpers';

export default function FeedScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [chatVisible, setChatVisible] = useState(false);
  const [assignAgentVisible, setAssignAgentVisible] = useState(false);
  const [createIssueVisible, setCreateIssueVisible] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'org' | 'repos'>('repos');
  const [filterType, setFilterType] = useState<'prs' | 'issues'>('prs');
  const [forceReloading, setForceReloading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // CI Log modal state
  const [ciModalVisible, setCiModalVisible] = useState(false);
  const [selectedCIInfo, setSelectedCIInfo] = useState<CIInfo | null>(null);
  const [ciRepoName, setCiRepoName] = useState('');
  const [ciBranchName, setCiBranchName] = useState('');

  // Full Diff modal state
  const [fullDiffModalVisible, setFullDiffModalVisible] = useState(false);
  const [diffModalFiles, setDiffModalFiles] = useState<ParsedDiffFile[]>([]);
  const [diffModalMetrics, setDiffModalMetrics] = useState<DiffMetrics>({
    additions: 13,
    deletions: 0,
    filesCount: 1,
    summaryText: '+13 -0 • 1 file',
  });
  const [diffModalTitle, setDiffModalTitle] = useState('');

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');

  // PR action modal state
  const [prModalVisible, setPrModalVisible] = useState(false);
  const [prModalMode, setPrModalMode] = useState<PRActionMode>('approve');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      loadIssuesForTab(activeTab, filterType);
    }
  }, [activeTab, filterType]);

  async function loadIssuesForTab(tab: 'org' | 'repos', type: 'prs' | 'issues', force = false) {
    try {
      setLoading(true);
      console.log(`🔵 Loading ${type} for tab:`, tab);
      let issuesData: CodeIssue[];
      if (tab === 'org') {
        issuesData = type === 'prs' ? await fetchOrgPRs(force) : await fetchOrgIssues(force);
      } else {
        issuesData = type === 'prs' ? await fetchPersonalPRs(force) : await fetchPersonalIssues(force);
      }
      setIssues(issuesData);
      setCurrentIndex(0);
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      }
    } catch (error) {
      console.error(`❌ Failed to load ${type} for tab:`, tab, error);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      const userData = await fetchMe().catch(() => null);
      setUser(userData);

      let issuesData: CodeIssue[];
      if (userData) {
        issuesData = filterType === 'prs' ? await fetchPersonalPRs() : await fetchPersonalIssues();
        const ids = await fetchSavedIds();
        setSavedIds(new Set(ids));
      } else {
        issuesData = await fetchIssues();
      }

      setIssues(issuesData);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  const currentIssue = issues[currentIndex];

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  function showToast(message: string, type: ToastType = 'success') {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }

  async function handleSave() {
    if (!currentIssue) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to save issues.', [
        { text: 'Cancel' },
        { text: 'Sign In', onPress: () => router.push('/') },
      ]);
      return;
    }
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const id = currentIssue.issue_id;
    if (savedIds.has(id)) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      await unsaveIssue(id).catch(() => {});
      showToast('Removed from saved', 'info');
    } else {
      setSavedIds(prev => new Set(prev).add(id));
      await saveIssue(id).catch(() => {});
      showToast('Saved to your list!', 'success');
    }
  }

  async function handleApply() {
    if (!currentIssue) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to apply fixes.');
      return;
    }
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const id = currentIssue.issue_id;
    setAppliedIds(prev => new Set(prev).add(id));
    await applyIssue(id).catch(() => {});
    Alert.alert('Fix Applied', `"${currentIssue.title}" has been applied to your codebase.`);
  }

  async function handleShare() {
    if (!currentIssue) return;
    try {
      await Share.share({
        message: `Check out this code fix on MergeDeck: "${currentIssue.title}" in ${currentIssue.project}`,
      });
    } catch {}
  }

  function handleChat(targetIssue?: CodeIssue) {
    const issueToUse = targetIssue || currentIssue;
    if (!issueToUse) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to chat with AI.');
      return;
    }
    const idx = issues.findIndex((i) => i.issue_id === issueToUse.issue_id);
    if (idx !== -1) setCurrentIndex(idx);
    setChatVisible(true);
  }

  function handleAssignAgent(targetIssue?: CodeIssue) {
    const issueToUse = targetIssue || currentIssue;
    if (!issueToUse) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to assign background agents.');
      return;
    }
    const idx = issues.findIndex((i) => i.issue_id === issueToUse.issue_id);
    if (idx !== -1) setCurrentIndex(idx);
    setAssignAgentVisible(true);
  }

  async function handleForceReload() {
    setForceReloading(true);
    await loadIssuesForTab(activeTab, filterType, true);
    setForceReloading(false);
  }

  async function handleUserPress() {
    if (!user) {
      router.push('/');
    } else {
      router.push('/profile');
    }
  }

  function handleApprovePR() {
    if (!currentIssue) return;
    setPrModalMode('approve');
    setPrModalVisible(true);
  }

  function handleRejectPR() {
    if (!currentIssue) return;
    setPrModalMode('reject');
    setPrModalVisible(true);
  }

  function handleMergePR() {
    if (!currentIssue) return;
    setPrModalMode('merge');
    setPrModalVisible(true);
  }

  function removeCurrentPR() {
    if (!currentIssue) return;
    const removedId = currentIssue.issue_id;
    setIssues(prev => prev.filter(i => i.issue_id !== removedId));
  }

  async function executePRApprove() {
    if (!currentIssue) return;
    try {
      await approvePR(currentIssue.issue_id);
      removeCurrentPR();
      showToast('PR approved!', 'success');
    } catch {
      showToast('Failed to approve PR', 'error');
      throw new Error('approve failed');
    }
  }

  async function executePRReject(comment: string) {
    if (!currentIssue) return;
    try {
      await rejectPR(currentIssue.issue_id, comment);
      removeCurrentPR();
      showToast('Changes requested', 'info');
    } catch {
      showToast('Failed to request changes', 'error');
      throw new Error('reject failed');
    }
  }

  async function executePRMerge(method: MergeMethod, commitTitle: string) {
    if (!currentIssue) return;
    try {
      await mergePR(currentIssue.issue_id, method, commitTitle);
      removeCurrentPR();
      showToast('PR merged!', 'success');
    } catch {
      showToast('Failed to merge PR', 'error');
      throw new Error('merge failed');
    }
  }

  function handleOpenCI(ciInfo: CIInfo, repo: string, branch: string) {
    setSelectedCIInfo(ciInfo);
    setCiRepoName(repo);
    setCiBranchName(branch);
    setCiModalVisible(true);
  }

  function handleOpenFullDiff(files: ParsedDiffFile[], metrics: DiffMetrics, prTitle: string) {
    setDiffModalFiles(files);
    setDiffModalMetrics(metrics);
    setDiffModalTitle(prTitle);
    setFullDiffModalVisible(true);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  const TYPE_RGB_MAP: Record<string, string> = {
    bug: '239, 68, 68',
    performance: '245, 158, 11',
    suggestion: '59, 130, 246',
  };

  const activeColorRGB = currentIssue && currentIssue.type 
    ? (TYPE_RGB_MAP[currentIssue.type] || '120, 130, 140')
    : '120, 130, 140';

  return (
    <View style={styles.container} testID="feed-screen">
      <CodeBackground activeColorRGB={activeColorRGB} />

      {/* Feed */}
      <FlatList
        ref={flatListRef}
        data={issues}
        keyExtractor={(item) => item.issue_id}
        renderItem={({ item }) => (
          <CodeIssueCard
            issue={item}
            onOpenCI={handleOpenCI}
            onOpenFullDiff={handleOpenFullDiff}
            onAssignAgent={() => handleAssignAgent(item)}
            onChat={() => handleChat(item)}
          />
        )}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        snapToAlignment="start"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: height,
          offset: height * index,
          index,
        })}
        ListEmptyComponent={() => (
          <View style={[styles.emptyContainer, { width, height }]}>
            <Feather name="coffee" size={64} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>
              {filterType === 'prs' ? "Damn, you're all clear with the PRs!" : "Damn dude, no issues found!"}
            </Text>
            <Text style={styles.emptyDesc}>
              {user
                ? `No ${filterType === 'prs' ? 'open PRs' : 'open issues'} found for @${user.github_username || user.name || 'you'}.`
                : 'Go touch some grass or switch filters.'}
            </Text>
          </View>
        )}
        testID="issue-feed"
      />

      {/* Sleek Ultra-Compact Top Navigation (< 42px height, gives >85% to PR card) */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.compactHeaderRow}>
          {/* Org vs Repos scope pill */}
          <View style={styles.scopeSegment}>
            <Pressable
              onPress={() => setActiveTab('org')}
              style={[styles.scopeBtn, activeTab === 'org' && styles.scopeBtnActive]}
              testID="tab-organisation"
            >
              <Text style={[styles.scopeText, activeTab === 'org' && styles.scopeTextActive]}>
                Org
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('repos')}
              style={[styles.scopeBtn, activeTab === 'repos' && styles.scopeBtnActive]}
              testID="tab-repos"
            >
              <Text style={[styles.scopeText, activeTab === 'repos' && styles.scopeTextActive]}>
                My Repos
              </Text>
            </Pressable>
          </View>

          {/* PRs vs Issues pill */}
          <View style={styles.typeSegment}>
            <Pressable
              onPress={() => setFilterType('prs')}
              style={[styles.typeBtn, filterType === 'prs' && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, filterType === 'prs' && styles.typeBtnTextActive]}>
                PRs
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFilterType('issues')}
              style={[styles.typeBtn, filterType === 'issues' && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, filterType === 'issues' && styles.typeBtnTextActive]}>
                Issues
              </Text>
            </Pressable>
          </View>

          <View style={{ flex: 1 }} />

          {/* + Request & Refresh buttons */}
          <View style={styles.actionGroup}>
            <Pressable
              style={styles.compactCreateBtn}
              onPress={() => {
                if (!user) {
                  Alert.alert('Sign in required', 'Please sign in to create an issue.');
                  return;
                }
                setCreateIssueVisible(true);
              }}
              hitSlop={6}
            >
              <Feather name="plus" size={13} color={COLORS.primary} />
              <Text style={styles.compactCreateText}>Request</Text>
            </Pressable>

            <Pressable
              onPress={handleForceReload}
              style={styles.compactReloadBtn}
              hitSlop={8}
            >
              {forceReloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="refresh-cw" size={12} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Action Sidebar */}
      {currentIssue && (
        <ActionSidebar
          isSaved={savedIds.has(currentIssue.issue_id)}
          isApplied={appliedIds.has(currentIssue.issue_id)}
          onChat={handleChat}
          onSave={handleSave}
          onApply={handleApply}
          onShare={handleShare}
          onAssignAgent={handleAssignAgent}
          isPR={currentIssue.issue_id.startsWith('gh_pr_')}
          isAgentPR={!!currentIssue.agent_job_id}
          onViewAgentTrace={() => {
            if (currentIssue?.agent_job_id) {
              router.push(`/session/${currentIssue.agent_job_id}`);
            }
          }}
          onApprovePR={handleApprovePR}
          onRejectPR={handleRejectPR}
          onMergePR={handleMergePR}
        />
      )}

      {/* AI Chat Sheet */}
      {currentIssue && (
        <AIChatSheet
          issueId={currentIssue.issue_id}
          issue={currentIssue}
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
        />
      )}

      {/* Assign Agent Modal */}
      {currentIssue && (
        <AssignAgentModal
          issueId={currentIssue.issue_id}
          repoName={currentIssue.github_owner && currentIssue.github_repo ? `${currentIssue.github_owner}/${currentIssue.github_repo}` : currentIssue.project || 'owner/repo'}
          visible={assignAgentVisible}
          onClose={() => setAssignAgentVisible(false)}
          onAssigned={(jobId) => {
             router.push(`/session/${jobId}`);
          }}
        />
      )}

      {/* Toast notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />

      {/* PR Action Modal */}
      {currentIssue && (
        <PRActionModal
          visible={prModalVisible}
          mode={prModalMode}
          prTitle={currentIssue.title}
          prNumber={currentIssue.github_pr_number || 2}
          baseBranch={currentIssue.base_branch || 'main'}
          onClose={() => setPrModalVisible(false)}
          onApprove={executePRApprove}
          onReject={executePRReject}
          onMerge={executePRMerge}
        />
      )}

      {/* CI / CD Log Modal */}
      {selectedCIInfo && (
        <CILogModal
          visible={ciModalVisible}
          onClose={() => setCiModalVisible(false)}
          ciInfo={selectedCIInfo}
          repoName={ciRepoName}
          branchName={ciBranchName}
        />
      )}

      {/* Tap-to-Expand Full Diff Modal */}
      <FullDiffModal
        visible={fullDiffModalVisible}
        onClose={() => setFullDiffModalVisible(false)}
        files={diffModalFiles}
        metrics={diffModalMetrics}
        prTitle={diffModalTitle}
      />

      {/* Create Issue Modal */}
      <CreateIssueModal
        visible={createIssueVisible}
        onClose={() => setCreateIssueVisible(false)}
        onIssueCreated={() => {
          showToast('Issue created successfully!', 'success');
          handleForceReload(); // Reload to fetch the newly created issue
        }}
        onJobAssigned={(jobId) => {
          showToast('Job assigned! Opening session...', 'success');
          setTimeout(() => {
            router.push(`/session/${jobId}`);
          }, 500);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    backgroundColor: 'rgba(9, 10, 15, 0.82)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    // @ts-ignore
    backdropFilter: 'blur(20px)',
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 10,
  },
  scopeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BORDER_RADIUS.full,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scopeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  scopeBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  scopeText: {
    color: COLORS.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  scopeTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  typeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  typeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    position: 'relative',
  },
  typeBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primaryLight,
  },
  typeBtnText: {
    color: COLORS.textTertiary,
    fontSize: 12,
    fontWeight: '500',
  },
  typeBtnTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.28)',
  },
  compactCreateText: {
    color: COLORS.primaryLight,
    fontSize: 11,
    fontWeight: '600',
  },
  compactReloadBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  }
});
