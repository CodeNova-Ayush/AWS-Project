import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { CodeIssue } from '../constants/types';
import DiffViewer from './DiffViewer';
import AgentTrajectory from './AgentTrajectory';
import MarkdownSpecs from './MarkdownSpecs';
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
  onAssignAgent?: () => void;
  onChat?: () => void;
}

function getCleanMarkdownPreview(md?: string): string {
  if (!md || !md.trim()) return 'No specifications provided.';
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, '[code snippet]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/\n+/g, ' ')
    .trim();
}

export default function CodeIssueCard({
  issue,
  onOpenCI,
  onOpenFullDiff,
  onAssignAgent,
  onChat,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const horizontalScrollRef = useRef<ScrollView>(null);

  const isPR =
    issue.issue_id.startsWith('gh_pr_') ||
    (!issue.issue_id.startsWith('gh_issue_') &&
      ((issue.diff_lines && issue.diff_lines.length > 0) ||
        Boolean(issue.github_pr_number && !issue.github_issue_number)));

  const issueNumber =
    issue.github_issue_number ||
    issue.github_pr_number ||
    (issue.issue_id.includes('_') ? issue.issue_id.split('_').pop() : null);

  const issueType = issue.type || 'bug';
  const typeLabel =
    issue.type_label ||
    (issueType === 'bug'
      ? 'Bug Fix'
      : issueType === 'performance'
      ? 'Performance'
      : 'Feature');

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

  const branchName = issue.branch || 'main';

  const formattedDate = issue.created_at
    ? (() => {
        try {
          const d = new Date(issue.created_at);
          return isNaN(d.getTime())
            ? 'Recently'
            : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
          return 'Recently';
        }
      })()
    : 'Recently';

  const githubUrl = issue.github_pr_url || issue.github_issue_url;

  function goToDetails() {
    horizontalScrollRef.current?.scrollTo({ x: width, animated: true });
  }

  function goToFeed() {
    horizontalScrollRef.current?.scrollTo({ x: 0, animated: true });
  }

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

  function handleOpenGitHub() {
    if (githubUrl) {
      Linking.openURL(githubUrl).catch(() => {});
    }
  }

  return (
    <View
      style={[
        styles.container,
        { height },
        Platform.OS === 'web' && ({
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
        } as any),
      ]}
      // @ts-ignore
      dataSet={{ snapCard: 'true' }}
      testID={`issue-card-${issue.issue_id}`}
    >
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ flex: 1 }}
      >
        {/* ==================================================================== */}
        {/* Page 1: Main Reel Card */}
        {/* ==================================================================== */}
        <View style={[{ width, height }, styles.frontPage]}>
          <View
            style={[
              styles.frontPageInner,
              {
                paddingTop: insets.top + 64,
                paddingBottom: Math.max(insets.bottom + 65, 80),
              },
            ]}
          >
            {isPR ? (
              /* PR Reel View */
              <>
                {/* 1. CI Status & Diff Scope Pill */}
                <View style={styles.topMetaRow}>
                  <Pressable
                    onPress={handleCIPress}
                    style={[
                      styles.ciPill,
                      {
                        borderColor:
                          ciInfo.status === 'passed'
                            ? 'rgba(5, 150, 105, 0.25)'
                            : 'rgba(225, 29, 72, 0.25)',
                        backgroundColor:
                          ciInfo.status === 'passed'
                            ? 'rgba(5, 150, 105, 0.08)'
                            : 'rgba(225, 29, 72, 0.08)',
                      },
                    ]}
                    hitSlop={6}
                  >
                    <View
                      style={[
                        styles.ciIndicatorDot,
                        {
                          backgroundColor:
                            ciInfo.status === 'passed' ? '#059669' : '#E11D48',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.ciText,
                        {
                          color:
                            ciInfo.status === 'passed' ? '#059669' : '#E11D48',
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

                  {Boolean(issue.has_conflicts || issue.github_mergeable === false || issue.github_mergeable_state === 'dirty') && (
                    <>
                      <Text style={styles.metaBullet}>•</Text>
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(225, 29, 72, 0.12)',
                        borderWidth: 1,
                        borderColor: 'rgba(225, 29, 72, 0.3)',
                        borderRadius: 20,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        gap: 4,
                      }}>
                        <Feather name="alert-triangle" size={11} color="#E11D48" />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#E11D48' }}>Conflict</Text>
                      </View>
                    </>
                  )}
                </View>

                {/* 2. Repository Identifier */}
                <View style={styles.repoRow}>
                  <Feather name="folder" size={12} color="#71717A" />
                  <Text style={styles.repoText} numberOfLines={1}>
                    {repoName}
                  </Text>
                </View>

                {/* 3. Branch Name & Author with Avatar */}
                <View style={styles.branchAuthorBlock}>
                  <Text style={styles.branchText} numberOfLines={2}>
                    {issue.title || branchName}
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
                      {
                        backgroundColor:
                          aiRisk.level === 'LOW'
                            ? 'rgba(5, 150, 105, 0.08)'
                            : aiRisk.level === 'HIGH'
                            ? 'rgba(225, 29, 72, 0.08)'
                            : 'rgba(217, 119, 6, 0.08)',
                        borderColor:
                          aiRisk.level === 'LOW'
                            ? 'rgba(5, 150, 105, 0.2)'
                            : aiRisk.level === 'HIGH'
                            ? 'rgba(225, 29, 72, 0.2)'
                            : 'rgba(217, 119, 6, 0.2)',
                      },
                    ]}
                  >
                    <Feather
                      name="shield"
                      size={12}
                      color={
                        aiRisk.level === 'LOW'
                          ? '#059669'
                          : aiRisk.level === 'HIGH'
                          ? '#E11D48'
                          : '#D97706'
                      }
                    />
                    <Text
                      style={[
                        styles.riskText,
                        {
                          color:
                            aiRisk.level === 'LOW'
                              ? '#059669'
                              : aiRisk.level === 'HIGH'
                              ? '#E11D48'
                              : '#D97706',
                        },
                      ]}
                    >
                      {aiRisk.level} RISK
                    </Text>
                  </View>
                </View>

                {/* 5. AI Summary Section */}
                <View style={styles.aiSummaryContainer}>
                  <View style={styles.aiSummaryHeader}>
                    <Feather name="cpu" size={13} color="#4F46E5" />
                    <Text style={styles.aiSummaryTitle}>AI SUMMARY</Text>
                  </View>
                  {aiBullets.map((bullet, idx) => (
                    <View key={idx} style={styles.bulletItem}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.bulletText}>{bullet}</Text>
                    </View>
                  ))}
                </View>

                {/* Spacer */}
                <View style={{ flex: 1, minHeight: 8 }} />

                {/* 6. Tap-to-Expand Code Snippet Box */}
                <Pressable
                  style={({ pressed }) => [
                    styles.codeSnippetBox,
                    pressed && styles.codeSnippetBoxPressed,
                  ]}
                  onPress={handleDiffBoxPress}
                  testID="diff-preview-box"
                >
                  <View style={styles.snippetHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Feather name="file-text" size={13} color="#4F46E5" />
                      <Text style={styles.snippetFilename} numberOfLines={1}>
                        {primaryFile.filename}
                      </Text>
                    </View>
                    <Feather name="maximize-2" size={12} color="#71717A" />
                  </View>

                  <View style={styles.snippetContent}>
                    {previewSnippetLines.map((line, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.snippetLineRow,
                          line.type === 'add' && styles.lineRowAdd,
                          line.type === 'del' && styles.lineRowDel,
                        ]}
                      >
                        <Text
                          style={[
                            styles.snippetPrefix,
                            line.type === 'add' && { color: '#059669' },
                            line.type === 'del' && { color: '#E11D48' },
                          ]}
                        >
                          {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                        </Text>
                        <Text
                          style={[
                            styles.snippetCodeText,
                            line.type === 'add' && { color: '#047857' },
                            line.type === 'del' && { color: '#BE123C' },
                          ]}
                          numberOfLines={1}
                        >
                          {line.content}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.snippetFooter}>
                    <Text style={styles.snippetFooterText}>Tap to view full diff</Text>
                    <Feather name="arrow-right" size={11} color="#4F46E5" />
                  </View>
                </Pressable>
              </>
            ) : (
              /* Issue Reel View */
              <>
                {/* 1. Issue Status & Branch Tag Row */}
                <View style={styles.topMetaRow}>
                  <View style={styles.issueStatusPill}>
                    <View style={styles.issueStatusDot} />
                    <Text style={styles.issueStatusText}>
                      Open Issue {issueNumber ? `#${issueNumber}` : ''}
                    </Text>
                  </View>

                  <Text style={styles.metaBullet}>•</Text>

                  <View style={styles.issueTypePill}>
                    <Feather
                      name={issueType === 'bug' ? 'alert-circle' : issueType === 'performance' ? 'zap' : 'compass'}
                      size={11}
                      color={issueType === 'bug' ? '#E11D48' : '#4F46E5'}
                    />
                    <Text
                      style={[
                        styles.issueTypeText,
                        { color: issueType === 'bug' ? '#E11D48' : '#4F46E5' },
                      ]}
                    >
                      {typeLabel}
                    </Text>
                  </View>

                  <Text style={styles.metaBullet}>•</Text>

                  <View style={styles.branchPill}>
                    <Feather name="git-branch" size={11} color="#71717A" />
                    <Text style={styles.branchPillText}>{branchName}</Text>
                  </View>
                </View>

                {/* 2. Repository Identifier */}
                <View style={styles.repoRow}>
                  <Feather name="folder" size={12} color="#71717A" />
                  <Text style={styles.repoText} numberOfLines={1}>
                    {repoName}
                  </Text>
                </View>

                {/* 3. Title & Author with Avatar */}
                <View style={styles.branchAuthorBlock}>
                  <Text style={styles.branchText} numberOfLines={2}>
                    {issue.title}
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

                {/* 4. Priority / Readiness Badge */}
                <View style={styles.riskRow}>
                  <View style={styles.issueReadinessPill}>
                    <Feather name="zap" size={11} color="#059669" />
                    <Text style={styles.issueReadinessText}>AI SOLVER READY</Text>
                  </View>
                </View>

                {/* 5. AI Resolution Strategy Container */}
                <View style={styles.aiSummaryContainer}>
                  <View style={styles.aiSummaryHeader}>
                    <Feather name="cpu" size={13} color="#4F46E5" />
                    <Text style={styles.aiSummaryTitle}>AI RESOLUTION STRATEGY</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>
                      Locate root cause in{' '}
                      <Text
                        style={{
                          color: '#18181B',
                          fontWeight: '600',
                          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        }}
                      >
                        {branchName}
                      </Text>{' '}
                      for "{issue.title}"
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>
                      Synthesize zero-shot patch and execute validation checks
                    </Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>
                      Create verified pull request and link issue specs
                    </Text>
                  </View>
                </View>

                {/* Spacer */}
                <View style={{ flex: 1, minHeight: 8 }} />

                {/* 6. Tap-to-Inspect Issue & Dispatch Box */}
                <Pressable
                  style={({ pressed }) => [
                    styles.issueDispatchBox,
                    pressed && styles.codeSnippetBoxPressed,
                  ]}
                  onPress={goToDetails}
                  testID="issue-preview-box"
                >
                  <View style={styles.snippetHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <Feather name="align-left" size={13} color="#4F46E5" />
                      <Text style={styles.snippetFilename} numberOfLines={1}>
                        Issue Specifications
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 11, color: '#71717A', fontWeight: '500' }}>Details</Text>
                      <Feather name="chevron-right" size={12} color="#71717A" />
                    </View>
                  </View>

                  <Text style={styles.issueDescriptionPreview} numberOfLines={2}>
                    {getCleanMarkdownPreview(issue.description)}
                  </Text>

                  <View style={styles.issueDispatchFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Feather name="zap" size={12} color="#4F46E5" />
                      <Text style={styles.snippetFooterText}>Swipe or tap for full specs & AI solver</Text>
                    </View>
                    <Feather name="arrow-right" size={11} color="#4F46E5" />
                  </View>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* ==================================================================== */}
        {/* Page 2: Detailed expanded view on horizontal swipe */}
        {/* ==================================================================== */}
        <View style={[{ width, height }, styles.detailedPage]}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[
              styles.scrollInner,
              { paddingTop: insets.top + 64, paddingBottom: 110 },
            ]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Top Back Nav Row */}
            <View style={styles.detailsNavRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.detailsBackBtn,
                  pressed && styles.detailsBackBtnPressed,
                ]}
                onPress={goToFeed}
                hitSlop={8}
              >
                <Feather name="arrow-left" size={14} color="#18181B" />
                <Text style={styles.detailsBackText}>Feed</Text>
              </Pressable>

              <View style={styles.detailsPill}>
                <Text style={styles.detailsPillText}>
                  {isPR ? 'PR Specs' : 'Issue Specs'}
                </Text>
              </View>
            </View>

            {/* Badges Header Row */}
            <View style={styles.detailsMetaRow}>
              <View
                style={[
                  styles.statusBadge,
                  isPR
                    ? { backgroundColor: 'rgba(79, 70, 229, 0.08)', borderColor: 'rgba(79, 70, 229, 0.25)' }
                    : { backgroundColor: 'rgba(5, 150, 105, 0.08)', borderColor: 'rgba(5, 150, 105, 0.25)' },
                ]}
              >
                <View
                  style={[
                    styles.statusBadgeDot,
                    { backgroundColor: isPR ? '#4F46E5' : '#059669' },
                  ]}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    { color: isPR ? '#4F46E5' : '#059669' },
                  ]}
                >
                  {isPR
                    ? 'Open Pull Request'
                    : `Open Issue ${issueNumber ? `#${issueNumber}` : ''}`}
                </Text>
              </View>

              <View style={styles.detailsTypeBadge}>
                <Feather
                  name={issueType === 'bug' ? 'alert-circle' : issueType === 'performance' ? 'zap' : 'tag'}
                  size={11}
                  color={issueType === 'bug' ? '#E11D48' : '#4F46E5'}
                />
                <Text
                  style={[
                    styles.detailsTypeText,
                    { color: issueType === 'bug' ? '#E11D48' : '#4F46E5' },
                  ]}
                >
                  {typeLabel}
                </Text>
              </View>

              <View style={styles.detailsBranchBadge}>
                <Feather name="git-branch" size={11} color="#71717A" />
                <Text style={styles.detailsBranchText}>{branchName}</Text>
              </View>
            </View>

            {/* Repo Identifier */}
            <View style={styles.detailsRepoRow}>
              <Feather name="folder" size={13} color="#71717A" />
              <Text style={styles.detailsRepoText}>{repoName}</Text>
            </View>

            {/* Title */}
            <Text style={styles.detailsTitle}>{issue.title}</Text>

            {/* Author & Timestamp */}
            <View style={styles.detailsAuthorRow}>
              {author.avatarUrl ? (
                <Image source={{ uri: author.avatarUrl }} style={styles.detailsAuthorAvatar} />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Text style={styles.authorInitials}>
                    {author.handle.replace('@', '').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.detailsAuthorText}>
                Opened by <Text style={styles.authorHandleHighlight}>{author.handle}</Text> •{' '}
                {formattedDate}
              </Text>
            </View>

            {/* Description Card (Markdown Parsed with Special Bold & Code Blocks) */}
            <View style={styles.detailsDescCard}>
              <View style={styles.detailsDescHeader}>
                <Feather name="file-text" size={13} color="#4F46E5" />
                <Text style={styles.detailsDescHeaderTitle}>
                  {isPR ? 'PR SPECIFICATIONS & CONTEXT' : 'ISSUE SPECIFICATIONS'}
                </Text>
              </View>

              {/* Rich Markdown Specs Renderer */}
              <MarkdownSpecs content={issue.description || 'No specifications provided.'} />

              {/* GitHub Labels if present */}
              {issue.github_labels && issue.github_labels.length > 0 && (
                <View style={styles.detailsLabelsContainer}>
                  {issue.github_labels.map((lbl, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.githubLabelBadge,
                        {
                          backgroundColor: `#${lbl.color}15`,
                          borderColor: `#${lbl.color}40`,
                        },
                      ]}
                    >
                      <Text style={[styles.githubLabelText, { color: `#${lbl.color}` }]}>
                        {lbl.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Autonomous Agent Solver Card (When issue has no diff lines yet) */}
            {(!issue.diff_lines || issue.diff_lines.length === 0) && (
              <View style={styles.agentSolverCard}>
                <View style={styles.agentSolverHeader}>
                  <View style={styles.agentBadge}>
                    <Feather name="cpu" size={13} color="#4F46E5" />
                    <Text style={styles.agentBadgeText}>AUTONOMOUS AGENT SOLVER</Text>
                  </View>
                  <View style={styles.agentReadyPill}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.agentReadyText}>Ready to Run</Text>
                  </View>
                </View>

                <Text style={styles.agentSolverHeadline}>
                  Dispatch an AI engineer to clone <Text style={styles.monoHighlight}>{branchName}</Text>, diagnose root cause, and open a pull request.
                </Text>

                <View style={styles.agentFeatureList}>
                  <View style={styles.agentFeatureItem}>
                    <Feather name="check-circle" size={13} color="#059669" />
                    <Text style={styles.agentFeatureText}>
                      Isolated container sandbox with auto-branching
                    </Text>
                  </View>
                  <View style={styles.agentFeatureItem}>
                    <Feather name="check-circle" size={13} color="#059669" />
                    <Text style={styles.agentFeatureText}>
                      Zero-shot bug resolution & AST syntax verification
                    </Text>
                  </View>
                  <View style={styles.agentFeatureItem}>
                    <Feather name="check-circle" size={13} color="#059669" />
                    <Text style={styles.agentFeatureText}>
                      Automated CI regression tests & clean PR submission
                    </Text>
                  </View>
                </View>

                {/* Primary Action Buttons */}
                <View style={styles.agentSolverButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dispatchButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onAssignAgent}
                    testID="assign-agent-button"
                  >
                    <Feather name="zap" size={15} color="#FFFFFF" />
                    <Text style={styles.dispatchButtonText}>Assign AI Agent to Solve</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.chatDiscussButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onChat}
                    testID="chat-agent-button"
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color="#18181B" />
                    <Text style={styles.chatDiscussButtonText}>Discuss with AI Assistant</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Diff Viewer (if PR or diff lines exist) */}
            {issue.diff_lines && issue.diff_lines.length > 0 && (
              <View style={styles.diffSection}>
                <View style={styles.sectionHeader}>
                  <Feather name="code" size={13} color="#4F46E5" />
                  <Text style={styles.sectionHeaderTitle}>PROPOSED CHANGES</Text>
                </View>
                <DiffViewer lines={issue.diff_lines} language={issue.language} />
              </View>
            )}

            {/* Trajectory Steps (if available) */}
            {issue.trajectory_steps && issue.trajectory_steps.length > 0 && (
              <View style={styles.trajectorySection}>
                <View style={styles.sectionHeader}>
                  <Feather name="activity" size={13} color="#4F46E5" />
                  <Text style={styles.sectionHeaderTitle}>AGENT EXECUTION TRACE</Text>
                </View>
                <AgentTrajectory steps={issue.trajectory_steps} />
              </View>
            )}

            {/* Workflow & History Card */}
            <View style={styles.workflowCard}>
              <View style={styles.workflowHeader}>
                <Feather name="clock" size={12} color="#71717A" />
                <Text style={styles.workflowTitle}>ISSUE WORKFLOW LIFECYCLE</Text>
              </View>

              <View style={styles.workflowStep}>
                <View style={[styles.stepDot, styles.stepDotDone]} />
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Issue Created</Text>
                  <Text style={styles.stepSub}>
                    Filed by {author.handle} • {formattedDate}
                  </Text>
                </View>
              </View>

              <View style={styles.stepLine} />

              <View style={styles.workflowStep}>
                <View style={[styles.stepDot, styles.stepDotActive]} />
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>AI Autonomous Resolution</Text>
                  <Text style={styles.stepSub}>
                    {issue.diff_lines && issue.diff_lines.length > 0
                      ? 'Patch generated • Awaiting review'
                      : 'Ready to dispatch autonomous solver'}
                  </Text>
                </View>
              </View>

              <View style={styles.stepLine} />

              <View style={styles.workflowStep}>
                <View
                  style={[
                    styles.stepDot,
                    issue.diff_lines && issue.diff_lines.length > 0 ? styles.stepDotActive : {},
                  ]}
                />
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Pull Request & CI Verification</Text>
                  <Text style={styles.stepSub}>
                    {isPR ? 'CI suite verified' : 'Pending agent completion'}
                  </Text>
                </View>
              </View>
            </View>

            {/* GitHub External Link Button */}
            {githubUrl ? (
              <Pressable
                style={({ pressed }) => [
                  styles.githubExternalBtn,
                  pressed && styles.githubExternalBtnPressed,
                ]}
                onPress={handleOpenGitHub}
              >
                <Feather name="github" size={14} color="#18181B" />
                <Text style={styles.githubExternalText}>View on GitHub</Text>
                <Feather name="external-link" size={12} color="#71717A" />
              </Pressable>
            ) : null}

            {/* Return to feed button */}
            <Pressable
              style={({ pressed }) => [
                styles.returnToFeedBtn,
                pressed && styles.returnToFeedBtnPressed,
              ]}
              onPress={goToFeed}
            >
              <Feather name="arrow-left" size={13} color="#4F46E5" />
              <Text style={styles.returnToFeedText}>Return to Feed Reel</Text>
            </Pressable>
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
    paddingRight: 74, // Generous spacing so ActionSidebar never overlaps text/diff
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  ciPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  ciIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ciText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  issueStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    gap: 5,
  },
  issueStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  issueStatusText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  issueTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  issueTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#F4F0E8',
  },
  branchPillText: {
    color: '#4B5563',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  metaBullet: {
    color: '#A1A1AA',
    fontSize: 12,
  },
  diffScopePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  diffScopeText: {
    color: '#4B5563',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  repoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  repoText: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  branchAuthorBlock: {
    marginBottom: 10,
  },
  branchText: {
    color: '#18181B',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    marginBottom: 5,
    letterSpacing: -0.3,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  authorAvatarPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(79, 70, 229, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
  },
  authorInitials: {
    color: '#4F46E5',
    fontSize: 9,
    fontWeight: '700',
  },
  authorHandle: {
    color: '#71717A',
    fontSize: 11,
  },
  authorHandleHighlight: {
    color: '#18181B',
    fontWeight: '600',
  },
  riskRow: {
    marginBottom: 10,
  },
  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  issueReadinessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    gap: 5,
  },
  issueReadinessText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiSummaryContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 12,
    marginBottom: 10,
    // @ts-ignore
    backdropFilter: 'blur(20px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiSummaryTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  bulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4F46E5',
    marginTop: 7,
  },
  bulletText: {
    color: '#27272A',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  codeSnippetBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  codeSnippetBoxPressed: {
    borderColor: 'rgba(79, 70, 229, 0.4)',
    backgroundColor: '#FBFBFB',
  },
  snippetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  snippetFilename: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  snippetContent: {
    gap: 2,
    marginBottom: 6,
  },
  snippetLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  lineRowAdd: {
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
  },
  lineRowDel: {
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
  },
  snippetPrefix: {
    width: 14,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  snippetCodeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  snippetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 6,
  },
  snippetFooterText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '600',
  },
  issueDispatchBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  issueDescriptionPreview: {
    color: '#3F3F46',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  issueDispatchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 6,
  },
  detailedPage: {
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: SPACING.lg,
    paddingRight: 74,
  },
  detailsNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  detailsBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailsBackBtnPressed: {
    backgroundColor: '#F4F4F5',
  },
  detailsBackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  detailsPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 70, 229, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
  },
  detailsPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: 0.3,
  },
  detailsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detailsTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  detailsTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailsBranchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: '#F4F0E8',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  detailsBranchText: {
    color: '#4B5563',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  detailsRepoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  detailsRepoText: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsTitle: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  detailsAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  detailsAuthorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailsAuthorText: {
    color: '#71717A',
    fontSize: 12,
  },
  detailsDescCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.07)',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  detailsDescHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  detailsDescHeaderTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  detailsLabelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  githubLabelBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  githubLabelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  agentSolverCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.25)',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  agentSolverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  agentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentBadgeText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  agentReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  agentReadyText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '700',
  },
  agentSolverHeadline: {
    color: '#18181B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
    fontWeight: '500',
  },
  monoHighlight: {
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  agentFeatureList: {
    gap: 6,
    marginBottom: 14,
  },
  agentFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentFeatureText: {
    color: '#4B5563',
    fontSize: 12,
    flex: 1,
  },
  agentSolverButtons: {
    gap: 8,
  },
  dispatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#18181B',
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  dispatchButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chatDiscussButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 10,
    borderRadius: 10,
  },
  chatDiscussButtonText: {
    color: '#18181B',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  diffSection: {
    marginBottom: 14,
  },
  trajectorySection: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  workflowCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  workflowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  workflowTitle: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  workflowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    marginTop: 4,
  },
  stepDotDone: {
    backgroundColor: '#059669',
  },
  stepDotActive: {
    backgroundColor: '#4F46E5',
  },
  stepLine: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginLeft: 3.5,
    marginVertical: 2,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  stepSub: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 1,
  },
  githubExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  githubExternalBtnPressed: {
    backgroundColor: '#F4F4F5',
  },
  githubExternalText: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '600',
  },
  returnToFeedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 16,
  },
  returnToFeedBtnPressed: {
    opacity: 0.7,
  },
  returnToFeedText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '600',
  },
});
