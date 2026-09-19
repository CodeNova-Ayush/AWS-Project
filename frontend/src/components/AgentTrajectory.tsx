import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { TrajectoryStep } from '../constants/types';

// ─── Phase configuration ───────────────────────────────────────────────────

type Phase = 'analysis' | 'implement' | 'test' | 'git' | 'pr' | 'other';

interface PhaseConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}

const PHASE_CONFIG: Record<Phase, PhaseConfig> = {
  analysis: {
    label: 'Analysis',
    color: '#60A5FA',  // blue-400
    bg: 'rgba(96, 165, 250, 0.08)',
    border: 'rgba(96, 165, 250, 0.25)',
    icon: <Feather name="search" size={13} color="#60A5FA" />,
  },
  implement: {
    label: 'Implementation',
    color: '#34D399',  // emerald-400
    bg: 'rgba(52, 211, 153, 0.08)',
    border: 'rgba(52, 211, 153, 0.25)',
    icon: <Feather name="code" size={13} color="#34D399" />,
  },
  test: {
    label: 'Testing',
    color: '#A78BFA',  // violet-400
    bg: 'rgba(167, 139, 250, 0.08)',
    border: 'rgba(167, 139, 250, 0.25)',
    icon: <Feather name="check-square" size={13} color="#A78BFA" />,
  },
  git: {
    label: 'Git Operations',
    color: '#F97316',  // orange-500
    bg: 'rgba(249, 115, 22, 0.08)',
    border: 'rgba(249, 115, 22, 0.25)',
    icon: <Feather name="git-commit" size={13} color="#F97316" />,
  },
  pr: {
    label: 'Pull Request',
    color: '#E8855A',  // brand orange
    bg: 'rgba(232, 133, 90, 0.08)',
    border: 'rgba(232, 133, 90, 0.25)',
    icon: <Feather name="git-pull-request" size={13} color="#E8855A" />,
  },
  other: {
    label: 'Other',
    color: '#9CA3AF',  // gray-400
    bg: 'rgba(156, 163, 175, 0.08)',
    border: 'rgba(156, 163, 175, 0.2)',
    icon: <Feather name="terminal" size={13} color="#9CA3AF" />,
  },
};

/** Infer phase from step text when backend doesn't provide one. */
function resolvePhase(step: TrajectoryStep): Phase {
  if (step.phase && step.phase in PHASE_CONFIG) return step.phase;
  const t = step.text.toLowerCase();
  if (/analyz|search|read|inspect|explore|scan|grep|find|look/.test(t)) return 'analysis';
  if (/implement|edit|write|creat|fix|add|remov|refactor|updat|modif/.test(t)) return 'implement';
  if (/test|spec|assert|verify|pass|fail|lint|check/.test(t)) return 'test';
  if (/git|commit|push|branch|checkout|merge|stash/.test(t)) return 'git';
  if (/pull request|pr |raised pr|open pr|creat.*pr|github\.com.*pull/.test(t)) return 'pr';
  return 'other';
}

// ─── Detail line classifier ────────────────────────────────────────────────

type DetailKind = 'file' | 'code' | 'error' | 'test_pass' | 'test_fail' | 'text';

function classifyDetail(detail: string): DetailKind {
  const d = detail.trim();
  // File paths: starts with ./ ../ / or looks like path/to/file.ext
  if (/^(\.\.?\/|\/)[^\s]+\.\w+/.test(d) || /^[\w\-]+\/[\w\-./]+\.\w+/.test(d)) return 'file';
  // Error / exception lines
  if (/error|exception|traceback|failed|fatal/i.test(d)) return 'error';
  // Test pass/fail indicators
  if (/✓|passed|✅|\d+\/\d+\s*(pass|test)/i.test(d)) return 'test_pass';
  if (/✗|failed|❌|\bfail\b/i.test(d)) return 'test_fail';
  // Code-like: starts with `git `, backtick, command syntax
  if (/^`.*`$/.test(d) || /^(git |npm |pip |pytest |python |node |curl )/.test(d)) return 'code';
  return 'text';
}

function DetailIcon({ kind }: { kind: DetailKind }) {
  switch (kind) {
    case 'file':      return <Feather name="file-text" size={10} color="#60A5FA" style={styles.detailIcon} />;
    case 'code':      return <Feather name="terminal" size={10} color="#34D399" style={styles.detailIcon} />;
    case 'error':     return <Feather name="alert-circle" size={10} color="#F87171" style={styles.detailIcon} />;
    case 'test_pass': return <Feather name="check-circle" size={10} color="#34D399" style={styles.detailIcon} />;
    case 'test_fail': return <Feather name="x-circle" size={10} color="#F87171" style={styles.detailIcon} />;
    default:          return <Feather name="chevron-right" size={10} color="#6B7280" style={styles.detailIcon} />;
  }
}

function detailTextStyle(kind: DetailKind) {
  const base = styles.detailText;
  if (kind === 'file' || kind === 'code') return [base, styles.detailMono];
  if (kind === 'error' || kind === 'test_fail') return [base, { color: '#F87171' }];
  if (kind === 'test_pass') return [base, { color: '#34D399' }];
  return base;
}

// ─── Component ─────────────────────────────────────────────────────────────

// Cap how many phases we render in the feed card — prevents freezing when
// raw traces (thousands of lines) slip through as trajectory_steps.
const MAX_VISIBLE_STEPS = 20;

interface Props {
  steps: TrajectoryStep[];
}

export default function AgentTrajectory({ steps }: Props) {
  // Start all collapsed so the initial render is lightweight
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const visibleSteps = steps.slice(0, MAX_VISIBLE_STEPS);
  const allExpanded = expandedSet.size === visibleSteps.length && visibleSteps.length > 0;

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedSet(new Set());
    } else {
      setExpandedSet(new Set(visibleSteps.map((_, i) => i)));
    }
  };

  const toggle = (i: number) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  if (!steps || steps.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="timeline-outline" size={15} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Execution Trajectory</Text>
          <View style={styles.phasePill}>
            <Text style={styles.phasePillText}>{steps.length} phases</Text>
          </View>
        </View>
        <Pressable onPress={toggleAll} style={styles.toggleAllBtn} hitSlop={6}>
          <Feather name={allExpanded ? 'minimize-2' : 'maximize-2'} size={12} color={COLORS.textTertiary} />
          <Text style={styles.toggleAllText}>{allExpanded ? 'Collapse all' : 'Expand all'}</Text>
        </Pressable>
      </View>

      {/* ── Phase cards ── */}
      <View style={styles.phases}>
        {visibleSteps.map((step, i) => {
          const phase = resolvePhase(step);
          const cfg = PHASE_CONFIG[phase];
          const hasDetails = (step.details?.length ?? 0) > 0;
          const isExpanded = expandedSet.has(i);
          const isLast = i === steps.length - 1;

          return (
            <View key={i} style={styles.phaseWrapper}>
              {/* Vertical track connecting phases */}
              {!isLast && <View style={[styles.track, { borderColor: cfg.border }]} />}

              <View style={[styles.phaseCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                {/* Phase header row */}
                <Pressable
                  style={styles.phaseHeader}
                  onPress={() => hasDetails && toggle(i)}
                  disabled={!hasDetails}
                >
                  {/* Phase number badge */}
                  <View style={[styles.phaseBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
                    <Text style={[styles.phaseBadgeNum, { color: cfg.color }]}>{String(i + 1).padStart(2, '0')}</Text>
                  </View>

                  {/* Phase icon + label */}
                  <View style={styles.phaseIconLabel}>
                    {cfg.icon}
                    <Text style={[styles.phaseLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>

                  {/* Phase title */}
                  <Text style={styles.phaseTitle} numberOfLines={isExpanded ? undefined : 2}>
                    {step.text}
                  </Text>

                  {/* Expand chevron */}
                  {hasDetails && (
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={cfg.color}
                      style={{ marginLeft: SPACING.xs }}
                    />
                  )}
                </Pressable>

                {/* Detail rows */}
                {isExpanded && hasDetails && (
                  <View style={styles.detailsBlock}>
                    <View style={[styles.detailDivider, { backgroundColor: cfg.border }]} />
                    {(step.details ?? []).map((detail, j) => {
                      const kind = classifyDetail(detail);
                      const isDetailLast = j === (step.details?.length ?? 0) - 1;
                      return (
                        <View key={j} style={styles.detailRow}>
                          {/* Tree connector */}
                          <Text style={styles.treeConnector}>{isDetailLast ? '└─' : '├─'}</Text>
                          <DetailIcon kind={kind} />
                          <Text style={detailTextStyle(kind)} numberOfLines={3}>
                            {detail}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── "N more phases" hint when capped ── */}
      {steps.length > MAX_VISIBLE_STEPS && (
        <View style={styles.moreHint}>
          <Feather name="more-horizontal" size={12} color={COLORS.textTertiary} />
          <Text style={styles.moreHintText}>
            +{steps.length - MAX_VISIBLE_STEPS} more phases — view full trace on the session page
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  phasePill: {
    backgroundColor: 'rgba(208, 253, 62, 0.12)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.25)',
  },
  phasePillText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  toggleAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleAllText: {
    color: COLORS.textTertiary,
    fontSize: 11,
  },

  // Phase list
  phases: {
    gap: SPACING.sm,
  },
  phaseWrapper: {
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 18,  // aligns with badge center
    top: '100%',
    height: SPACING.sm,
    width: 0,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
  },

  // Phase card
  phaseCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  phaseBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  phaseBadgeNum: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Courier New',
  },
  phaseIconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  phaseLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  phaseTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Details
  detailsBlock: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  detailDivider: {
    height: 1,
    marginBottom: SPACING.xs,
    opacity: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  treeConnector: {
    color: '#4B5563',  // gray-600
    fontFamily: 'Courier New',
    fontSize: 11,
    marginRight: 4,
    lineHeight: 16,
    marginTop: 1,
  },
  detailIcon: {
    marginRight: 5,
    marginTop: 2,
    flexShrink: 0,
  },
  detailText: {
    color: '#9CA3AF',  // gray-400
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  detailMono: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: '#D1D5DB',
  },
  moreHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  moreHintText: {
    color: COLORS.textTertiary,
    fontSize: 11,
    fontStyle: 'italic',
  },
});
