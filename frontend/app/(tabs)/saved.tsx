import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';
import { CodeIssue } from '../../src/constants/types';
import { fetchSavedIssues, unsaveIssue } from '../../src/services/api';
import CodeBackground from '../../src/components/CodeBackground';

const TYPE_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  bug: { icon: 'alert-circle', color: COLORS.error, label: 'Bug Fix' },
  security: { icon: 'shield', color: '#EC4899', label: 'Security' },
  performance: { icon: 'zap', color: COLORS.warning, label: 'Performance' },
  suggestion: { icon: 'message-square', color: COLORS.info, label: 'Suggestion' },
  refactor: { icon: 'git-commit', color: '#A855F7', label: 'Refactor' },
  feature: { icon: 'plus-circle', color: COLORS.success, label: 'Feature' },
};

export default function BookmarksTabScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  useEffect(() => {
    loadSaved();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [])
  );

  const loadSaved = useCallback(async () => {
    try {
      const data = await fetchSavedIssues();
      setIssues(data || []);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSaved();
  };

  const handleUnsave = async (issueId: string) => {
    try {
      await unsaveIssue(issueId);
      setIssues((prev) => prev.filter((item) => item.issue_id !== issueId));
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
    }
  };

  const filteredIssues = issues.filter((issue) => {
    if (selectedFilter === 'all') return true;
    return issue.type?.toLowerCase() === selectedFilter;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CodeBackground />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.bookmarkIconWrap}>
            <Feather name="bookmark" size={18} color="#4F46E5" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Bookmarks</Text>
            <Text style={styles.headerSubtitle}>Saved pull requests & issues</Text>
          </View>
        </View>

        {issues.length > 0 && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{issues.length} saved</Text>
          </View>
        )}
      </View>

      {/* Filter Chips */}
      {issues.length > 0 && (
        <View style={styles.filterRow}>
          {['all', 'bug', 'performance', 'security', 'refactor'].map((filter) => {
            const isSelected = selectedFilter === filter;
            const label = filter === 'all' ? 'All' : (TYPE_CONFIG[filter]?.label || filter);
            return (
              <Pressable
                key={filter}
                style={[styles.filterChip, isSelected && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : filteredIssues.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIconCircle}>
            <Feather name="bookmark" size={36} color="#71717A" />
          </View>
          <Text style={styles.emptyTitle}>
            {selectedFilter === 'all' ? 'No bookmarks yet' : `No ${selectedFilter} bookmarks`}
          </Text>
          <Text style={styles.emptySubtitle}>
            Tap the bookmark icon on any PR card in the feed to save it here for later review.
          </Text>
          <Pressable style={styles.exploreBtn} onPress={() => router.push('/feed')}>
            <Feather name="layers" size={15} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>Go to PR Feed</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredIssues}
          keyExtractor={(item) => item.issue_id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#4F46E5"
            />
          }
          ListFooterComponent={
            filteredIssues.length > 0 ? (
              <View style={styles.listFooter}>
                <Text style={styles.listFooterText}>No more bookmarks</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.bug;
            return (
              <View style={[styles.card, { borderLeftColor: cfg.color }]}>
                {/* Top Row: Type Tag + Actions */}
                <View style={styles.cardHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: `${cfg.color}15` }]}>
                    <Feather name={cfg.icon} size={11} color={cfg.color} />
                    <Text style={[styles.typeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>

                  <View style={styles.headerRightActions}>
                    {item.language && (
                      <View style={styles.langBadge}>
                        <Text style={styles.langText}>{item.language}</Text>
                      </View>
                    )}
                    <Pressable
                      style={styles.unsaveBtn}
                      onPress={() => handleUnsave(item.issue_id)}
                      hitSlop={8}
                    >
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>

                {/* PR Title */}
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>

                {/* Description */}
                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {/* Meta row: Repo & Branch */}
                <View style={styles.metaRow}>
                  <View style={styles.metaChip}>
                    <Feather name="github" size={11} color="#71717A" />
                    <Text style={styles.metaChipText} numberOfLines={1}>
                      {item.project}
                    </Text>
                  </View>
                  <View style={styles.metaChip}>
                    <Feather name="git-branch" size={11} color="#71717A" />
                    <Text style={styles.metaChipText} numberOfLines={1}>
                      {item.branch}
                    </Text>
                  </View>
                  {item.github_pr_number && (
                    <Text style={styles.prNumText}>#{item.github_pr_number}</Text>
                  )}
                </View>

                {/* Footer Buttons */}
                <View style={styles.cardFooter}>
                  {item.agent_job_id ? (
                    <Pressable
                      style={styles.sessionBtn}
                      onPress={() => router.push(`/session/${item.agent_job_id}`)}
                    >
                      <Feather name="activity" size={13} color="#4F46E5" />
                      <Text style={styles.sessionBtnText}>View Agent Session</Text>
                      <Feather name="arrow-right" size={12} color="#4F46E5" />
                    </Pressable>
                  ) : null}

                  {item.github_pr_url ? (
                    <Pressable
                      style={styles.githubBtn}
                      onPress={() => Linking.openURL(item.github_pr_url!).catch(() => { })}
                    >
                      <Feather name="external-link" size={13} color="#52525B" />
                      <Text style={styles.githubBtnText}>Open GitHub</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookmarkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 1,
  },
  countPill: {
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countPillText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  filterChipActive: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  filterChipText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 130, // Space for bottom pill nav
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langBadge: {
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  langText: {
    fontSize: 11,
    color: '#52525B',
    fontFamily: 'monospace',
  },
  unsaveBtn: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#18181B',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#52525B',
    lineHeight: 18,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF8F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    maxWidth: 160,
  },
  metaChipText: {
    fontSize: 11,
    color: '#52525B',
  },
  prNumText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: 10,
  },
  sessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sessionBtnText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  githubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  githubBtnText: {
    fontSize: 12,
    color: '#18181B',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#18181B',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
    marginBottom: 20,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  exploreBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listFooter: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listFooterText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
