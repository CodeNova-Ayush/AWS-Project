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
  const [activeTab, setActiveTab] = useState<'org' | 'repos'>('org');
  const [filterType, setFilterType] = useState<'prs' | 'issues'>('prs');
  const [forceReloading, setForceReloading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

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
        issuesData = filterType === 'prs' ? await fetchOrgPRs() : await fetchOrgIssues();
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
        message: `Check out this code fix on CodeTok: "${currentIssue.title}" in ${currentIssue.project}`,
      });
    } catch {}
  }

  function handleChat() {
    if (!currentIssue) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to chat with AI.');
      return;
    }
    setChatVisible(true);
  }

  function handleAssignAgent() {
    if (!currentIssue) return;
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to assign background agents.');
      return;
    }
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
        renderItem={({ item }) => <CodeIssueCard issue={item} />}
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
            <Text style={styles.emptyDesc}>Go touch some grass or switch filters.</Text>
          </View>
        )}
        testID="issue-feed"
      />

      {/* Top Navigation */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.topBarInner}>
          <View style={{ flexDirection: 'column', gap: 4, position: 'relative' }}>
            <View style={[styles.tabRow, { paddingRight: 40 }]}>
              <Pressable
                onPress={() => setActiveTab('org')}
                style={[styles.tab, activeTab === 'org' && styles.tabActive]}
                testID="tab-organisation"
              >
                <Text style={[styles.tabText, activeTab === 'org' && styles.tabTextActive]}>
                  Organisation
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('repos')}
                style={[styles.tab, activeTab === 'repos' && styles.tabActive]}
                testID="tab-repos"
              >
                <Text style={[styles.tabText, activeTab === 'repos' && styles.tabTextActive]}>
                  My Repos
                </Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={handleForceReload}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: -2,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: COLORS.error,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                hitSlop={8}
              >
                {forceReloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="refresh-cw" size={14} color="#fff" />
                )}
              </Pressable>
            </View>
            <View style={[styles.tabRow, { gap: 16, marginTop: 16 }]}>
              <Pressable onPress={() => setFilterType('prs')}>
                <Text style={[styles.subTabText, filterType === 'prs' && styles.subTabTextActive]}>
                  PRs
                </Text>
              </Pressable>
              <Pressable onPress={() => setFilterType('issues')}>
                <Text style={[styles.subTabText, filterType === 'issues' && styles.subTabTextActive]}>
                  Issues
                </Text>
              </Pressable>
              
              <View style={{ flex: 1 }} />
              
              <Pressable 
                style={styles.createIssueBtn} 
                onPress={() => {
                  if (!user) {
                    Alert.alert('Sign in required', 'Please sign in to create an issue.');
                    return;
                  }
                  setCreateIssueVisible(true);
                }}
              >
                <Feather name="plus-circle" size={14} color={COLORS.primary} />
                <Text style={styles.createIssueBtnText}>Create Request</Text>
              </Pressable>
            </View>
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
          onClose={() => setPrModalVisible(false)}
          onApprove={executePRApprove}
          onReject={executePRReject}
          onMerge={executePRMerge}
        />
      )}

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
    backgroundColor: 'rgba(5, 5, 5, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  tab: {
    paddingVertical: SPACING.sm,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  subTabText: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  subTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  createIssueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(208, 253, 62, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.3)',
  },
  createIssueBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 100, // accommodate bottom nav
    gap: SPACING.lg,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  emptyDesc: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  }
});
