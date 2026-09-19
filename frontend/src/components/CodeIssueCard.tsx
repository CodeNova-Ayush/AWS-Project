import React from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { CodeIssue } from '../constants/types';
import DiffViewer from './DiffViewer';
import AgentTrajectory from './AgentTrajectory';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  issue: CodeIssue;
}

const TYPE_CONFIG = {
  bug: { icon: 'alert-circle' as const, color: COLORS.error, bg: COLORS.errorBg, label: 'Bug Fix' },
  performance: { icon: 'zap' as const, color: COLORS.warning, bg: 'rgba(245, 158, 11, 0.1)', label: 'Performance' },
  suggestion: { icon: 'message-square' as const, color: COLORS.info, bg: 'rgba(59, 130, 246, 0.1)', label: 'Suggestion' },
};

export default function CodeIssueCard({ issue }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const config = TYPE_CONFIG[issue.type] || TYPE_CONFIG.bug;

  return (
    <View style={[styles.container, { height }]} testID={`issue-card-${issue.issue_id}`}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ flex: 1 }}
      >
        {/* Page 1: Abstract / Bottom overlay */}
        <View style={[{ width, height }, styles.frontPage]}>
          <View style={[styles.frontPageInner, { paddingTop: insets.top + 120, paddingBottom: Math.max(insets.bottom + 80, 100) }]}>
            {/* Top Metadata */}
            <View style={{ marginBottom: 20 }}>
              <View style={[styles.typeBadge, { backgroundColor: config.bg, marginBottom: 12 }]}>
                <Feather name={config.icon} size={13} color={config.color} />
                <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
              </View>

              <Text style={[styles.branchName, { color: '#FFFFFF', marginBottom: 6, fontSize: FONT_SIZES.sm, opacity: 0.9 }]} numberOfLines={1}>
                {issue.branch}
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <View style={[styles.projectBadge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start' }]}>
                  <Feather name="github" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.projectName}>{issue.project}</Text>
                </View>

                {issue.agent_lines_changed !== undefined && (
                  <View style={[styles.projectBadge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start' }]}>
                    <Feather name="code" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.projectName}>{issue.agent_lines_changed > 0 ? `+${issue.agent_lines_changed}` : issue.agent_lines_changed} lines</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Spacer to push title/description to bottom */}
            <View style={{ flex: 1 }} />
            <Text style={[styles.title, { textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]} numberOfLines={2}>
              {issue.title}
            </Text>
            
            <Text style={[styles.description, { marginBottom: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }]} numberOfLines={3}>
              {issue.description}
            </Text>

            {issue.created_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Feather name="clock" size={12} color={COLORS.textTertiary} style={{ marginRight: 6 }} />
                <Text style={{ color: COLORS.textTertiary, fontSize: FONT_SIZES.xs, fontWeight: '500' }}>
                  {new Date(issue.created_at).toLocaleString(undefined, { 
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                  })}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: COLORS.textSecondary, fontWeight: '600', fontSize: FONT_SIZES.sm, marginRight: 4 }}>
                Swipe right for full details
              </Text>
              <Feather name="chevron-right" size={16} color={COLORS.textSecondary} />
            </View>
          </View>
        </View>

        {/* Page 2: Detailed expanded view */}
        <View style={[{ width, height }, styles.detailedPage]}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[styles.scrollInner, { paddingTop: insets.top + 130 }]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={[styles.typeBadge, { backgroundColor: config.bg, marginBottom: 20 }]}>
              <Feather name={config.icon} size={13} color={config.color} />
              <Text style={[styles.typeLabel, { color: config.color }]}>{config.label}</Text>
            </View>

            <View style={{ marginBottom: SPACING.lg }}>
              <Text style={[styles.branchName, { marginBottom: 4, fontSize: FONT_SIZES.sm }]} numberOfLines={1}>
                {issue.branch}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <View style={[styles.projectBadge, { alignSelf: 'flex-start' }]}>
                  <Feather name="github" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.projectName}>{issue.project}</Text>
                </View>

                {issue.agent_lines_changed !== undefined && (
                  <View style={[styles.projectBadge, { alignSelf: 'flex-start' }]}>
                    <Feather name="code" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.projectName}>{issue.agent_lines_changed > 0 ? `+${issue.agent_lines_changed}` : issue.agent_lines_changed} lines</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.title}>{issue.title}</Text>
            
            {issue.created_at && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md }}>
                <Feather name="clock" size={12} color={COLORS.textTertiary} style={{ marginRight: 6 }} />
                <Text style={{ color: COLORS.textTertiary, fontSize: FONT_SIZES.xs, fontWeight: '500' }}>
                  {new Date(issue.created_at).toLocaleString(undefined, { 
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' 
                  })}
                </Text>
              </View>
            )}
            
            <Text style={styles.description}>{issue.description}</Text>

            {issue.diff_lines && issue.diff_lines.length > 0 && (
              <View style={styles.diffSection}>
                <DiffViewer lines={issue.diff_lines} language={issue.language} />
              </View>
            )}

            {issue.github_labels && issue.github_labels.length > 0 && (
              <View style={styles.labelsRow}>
                {issue.github_labels.map((label, idx) => (
                  <View key={idx} style={[styles.labelChip, { backgroundColor: `#${label.color}33`, borderColor: `#${label.color}` }]}>
                    <Text style={[styles.labelText, { color: `#${label.color}` }]}>{label.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {issue.trajectory_steps && issue.trajectory_steps.length > 0 && (
              <AgentTrajectory steps={issue.trajectory_steps} />
            )}

            <View style={{ height: 100 }} />
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
    paddingRight: 72, 
  },
  detailedPage: {
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    paddingRight: 72,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  projectName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  branchName: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontFamily: 'Courier New',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
    marginBottom: SPACING.md,
  },
  typeLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: SPACING.md,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  diffSection: {
    marginBottom: SPACING.sm,
  },
  labelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  labelChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  labelText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
});
