import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { CodeIssue } from '../constants/types';
import DiffViewer from './DiffViewer';
import AgentTrajectory from './AgentTrajectory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getCardCIInfo,
  getCardAuthorInfo,
  getCardDiffMetrics,
  getCardAIRisk,
  getCardAISummaryBullets,
  getCardFiles,
  CIInfo,
  ParsedDiffFile,
  DiffMetrics,
} from '../utils/cardHelpers';

interface Props {
  issue: CodeIssue;
  onOpenCI?: (ciInfo: CIInfo, repo: string, branch: string) => void;
  onOpenFullDiff?: (files: ParsedDiffFile[], metrics: DiffMetrics, prTitle: string) => void;
}

export default function CodeIssueCard({
  issue,
  onOpenCI,
  onOpenFullDiff,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const ciInfo = getCardCIInfo(issue);
  const author = getCardAuthorInfo(issue);
  const diffMetrics = getCardDiffMetrics(issue);
  const aiRisk = getCardAIRisk(issue);
  const aiBullets = getCardAISummaryBullets(issue);
  const diffFiles = getCardFiles(issue);

  const primaryFile = diffFiles[0] || {
    filename: 'index.html',
    lines: [
      { type: 'add', content: '<!DOCTYPE html>' },
      { type: 'add', content: '<html lang="en">' },
    ],
  };

  const previewSnippetLines = primaryFile.lines.slice(0, 3);

  const repoName =
    issue.github_owner && issue.github_repo
      ? `${issue.github_owner}/${issue.github_repo}`
      : issue.project || 'CodeNova-Ayush/demo';

  const branchName = issue.branch || 'Features/nothing';

  function handleCIPress() {
    if (onOpenCI) {
      onOpenCI(ciInfo, repoName, branchName);
    }
  }

  function handleDiffBoxPress() {
    if (onOpenFullDiff) {
      onOpenFullDiff(diffFiles, diffMetrics, issue.title || branchName);
    }
  }

  return (
    <View style={[styles.container, { height }]} testID={`issue-card-${issue.issue_id}`}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ flex: 1 }}
      >
        {/* Page 1: Main Reel Card (Matches exact requested ASCII layout) */}
        <View style={[{ width, height }, styles.frontPage]}>
          <View
            style={[
              styles.frontPageInner,
              {
                paddingTop: insets.top + 60,
                paddingBottom: Math.max(insets.bottom + 70, 85),
              },
            ]}
          >
            {/* 1. CI Status & Diff Scope Pill */}
            <View style={styles.topMetaRow}>
              <Pressable
                onPress={handleCIPress}
                style={[
                  styles.ciPill,
                  {
                    borderColor:
                      ciInfo.status === 'passed'
                        ? 'rgba(34, 197, 94, 0.35)'
                        : 'rgba(239, 68, 68, 0.35)',
                    backgroundColor:
                      ciInfo.status === 'passed'
                        ? 'rgba(34, 197, 94, 0.12)'
                        : 'rgba(239, 68, 68, 0.12)',
                  },
                ]}
                hitSlop={6}
              >
                <View
                  style={[
                    styles.ciIndicatorDot,
                    {
                      backgroundColor:
                        ciInfo.status === 'passed' ? COLORS.success : COLORS.error,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.ciText,
                    {
                      color:
                        ciInfo.status === 'passed' ? COLORS.success : COLORS.error,
                    },
                  ]}
                >
                  {ciInfo.label}
                </Text>
              </Pressable>

              <Text style={styles.metaBullet}>•</Text>

              {/* Diff Scope Pill */}
              <View style={styles.diffScopePill}>
                <Text style={styles.diffScopeText}>{diffMetrics.summaryText}</Text>
              </View>
            </View>

            {/* 2. Repository Identifier */}
            <Text style={styles.repoText} numberOfLines={1}>
              {repoName}
            </Text>

            {/* 3. Branch Name & Author with Avatar */}
            <View style={styles.branchAuthorBlock}>
              <Text style={styles.branchText} numberOfLines={1}>
                {branchName}
              </Text>
              <View style={styles.authorRow}>
                {author.avatarUrl ? (
                  <Image source={{ uri: author.avatarUrl }} style={styles.authorAvatar} />
                ) : (
                  <View style={styles.authorAvatarPlaceholder}>
                    <Text style={styles.authorInitials}>
                      {author.handle.replace('@', '').slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.authorHandle}>
                  by <Text style={styles.authorHandleHighlight}>{author.handle}</Text> •{' '}
                  {author.timeFormatted}
                </Text>
              </View>
            </View>

            {/* 4. AI Risk Pill */}
            <View style={styles.riskRow}>
              <View
                style={[
                  styles.riskPill,
                  { backgroundColor: aiRisk.bg, borderColor: `${aiRisk.color}55` },
                ]}
              >
                <Feather name="shield" size={13} color={aiRisk.color} />
                <Text style={[styles.riskText, { color: aiRisk.color }]}>
                  Risk: {aiRisk.level}
                </Text>
              </View>
            </View>

            {/* 5. AI Summary Section */}
            <View style={styles.aiSummaryContainer}>
              <View style={styles.aiSummaryHeader}>
                <Text style={styles.aiBrainIcon}>🧠</Text>
                <Text style={styles.aiSummaryTitle}>AI Summary:</Text>
              </View>
              {aiBullets.map((bullet, idx) => (
                <View key={idx} style={styles.bulletItem}>
                  <Text style={styles.bulletSymbol}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            {/* Spacer to align code snippet box cleanly with action buttons */}
            <View style={{ flex: 1, minHeight: 12 }} />

            {/* 6. Tap-to-Expand Code Snippet Box */}
            <Pressable
              style={({ pressed }) => [
                styles.codeSnippetBox,
                pressed && styles.codeSnippetBoxPressed,
              ]}
              onPress={handleDiffBoxPress}
              testID="diff-preview-box"
            >
              {/* File header bar */}
              <View style={styles.snippetHeader}>
                <Feather name="file-text" size={12} color="#86efac" />
                <Text style={styles.snippetFilename} numberOfLines={1}>
                  {primaryFile.filename}
                </Text>
                <Feather name="maximize-2" size={12} color={COLORS.textTertiary} />
              </View>

              {/* Code lines */}
              <View style={styles.snippetContent}>
                {previewSnippetLines.map((line, idx) => (
                  <View key={idx} style={styles.snippetLineRow}>
                    <Text
                      style={[
                        styles.snippetPrefix,
                        line.type === 'add' && { color: COLORS.success },
                        line.type === 'del' && { color: COLORS.error },
                      ]}
                    >
                      {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                    </Text>
                    <Text
                      style={[
                        styles.snippetCodeText,
                        line.type === 'add' && { color: '#86efac' },
                        line.type === 'del' && { color: '#fca5a5' },
                      ]}
                      numberOfLines={1}
                    >
                      {line.content}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Tap to expand prompt */}
              <View style={styles.snippetFooter}>
                <Text style={styles.snippetFooterText}>(Tap to view full diff)</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Page 2: Detailed expanded view on horizontal swipe */}
        <View style={[{ width, height }, styles.detailedPage]}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[
              styles.scrollInner,
              { paddingTop: insets.top + 70, paddingBottom: 100 },
            ]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsHeaderRepo}>{repoName}</Text>
              <Text style={styles.detailsHeaderBranch}>{branchName}</Text>
            </View>

            <Text style={styles.detailsTitle}>{issue.title}</Text>
            <Text style={styles.detailsDesc}>{issue.description}</Text>

            {issue.diff_lines && issue.diff_lines.length > 0 && (
              <View style={styles.diffSection}>
                <DiffViewer lines={issue.diff_lines} language={issue.language} />
              </View>
            )}

            {issue.trajectory_steps && issue.trajectory_steps.length > 0 && (
              <AgentTrajectory steps={issue.trajectory_steps} />
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  frontPage: {
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  frontPageInner: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingRight: 76, // Generous spacing so ActionSidebar never overlaps text/diff
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  ciPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  ciIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  ciText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaBullet: {
    color: COLORS.textTertiary,
    fontSize: 12,
  },
  diffScopePill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  diffScopeText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  repoText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  branchAuthorBlock: {
    marginBottom: 14,
  },
  branchText: {
    color: '#ffffff',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  authorAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(208, 253, 62, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.4)',
  },
  authorInitials: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '700',
  },
  authorHandle: {
    color: COLORS.textTertiary,
    fontSize: 12,
  },
  authorHandleHighlight: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  riskRow: {
    marginBottom: 12,
  },
  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  aiSummaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    marginBottom: 12,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  aiBrainIcon: {
    fontSize: 14,
  },
  aiSummaryTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 3,
  },
  bulletSymbol: {
    color: COLORS.primary,
    fontSize: 12,
    lineHeight: 18,
  },
  bulletText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  codeSnippetBox: {
    backgroundColor: '#0a1017',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    padding: 10,
    overflow: 'hidden',
  },
  codeSnippetBoxPressed: {
    borderColor: COLORS.primary,
    backgroundColor: '#0d1520',
  },
  snippetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  snippetFilename: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  snippetContent: {
    gap: 2,
    marginBottom: 6,
  },
  snippetLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  snippetPrefix: {
    width: 14,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  snippetCodeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#e2e8f0',
  },
  snippetFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 6,
    alignItems: 'center',
  },
  snippetFooterText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  detailedPage: {
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: SPACING.lg,
    paddingRight: 76,
  },
  detailsHeader: {
    marginBottom: 10,
  },
  detailsHeaderRepo: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  detailsHeaderBranch: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  detailsTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    marginBottom: 8,
  },
  detailsDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
    marginBottom: 16,
  },
  diffSection: {
    marginBottom: 20,
  },
});
