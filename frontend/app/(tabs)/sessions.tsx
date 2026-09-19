import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../src/constants/theme';
import { fetchJobs } from '../../src/services/api';
import AgentTrajectory from '../../src/components/AgentTrajectory';
import CreateIssueModal from '../../src/components/CreateIssueModal';

export default function SessionsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  useEffect(() => {
    loadJobs();

    // Poll every 3 seconds for live track updates
    const interval = setInterval(() => {
      fetchJobs().then(jobsData => {
        setJobs(jobsData);
      }).catch(err => console.error('Failed to poll jobs:', err));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  async function loadJobs() {
    try {
      setLoading(true);
      const jobsData = await fetchJobs();
      setJobs(jobsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function getStatusColor(status: string) {
    if (status === 'Completed') return COLORS.success;
    if (status === 'Pending') return COLORS.textTertiary;
    if (status === 'Running') return COLORS.primary;
    if (status === 'Failed') return COLORS.error;
    return COLORS.textSecondary;
  }

  function formatDuration(seconds: number | undefined) {
    if (seconds === undefined) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const renderJob = ({ item }: { item: any }) => (
    <Pressable style={styles.jobCard} onPress={() => router.push(`/session/${item.job_id}`)}>
      <View style={styles.jobHeader}>
        <Feather name={item.agent_type === 'opencode' ? 'code' : 'cpu'} size={18} color={COLORS.secondary} />
        <Text style={styles.jobTitle}>{item.repo} #{item.issue_id}</Text>
        <View style={[styles.statusBadge, { borderColor: getStatusColor(item.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.xs }}>
        <View style={[styles.metaBadge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start' }]}>
          <Feather name="clock" size={10} color={COLORS.textSecondary} />
          <Text style={styles.metaText}>
            {item.duration_seconds !== undefined ? formatDuration(item.duration_seconds) : (item.status === 'Running' ? 'Running...' : '--')}
          </Text>
        </View>

        {item.lines_changed !== undefined && (
          <View style={[styles.metaBadge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start' }]}>
            <Feather name="code" size={10} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{item.lines_changed > 0 ? `+${item.lines_changed}` : item.lines_changed} lines</Text>
          </View>
        )}
      </View>
      
      {item.summary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Execution Summary</Text>
          <Text style={styles.summaryText}>{item.summary}</Text>
        </View>
      )}

      {item.traces && item.traces.length > 0 && (
        <AgentTrajectory steps={item.traces.map((t: any) => ({ text: t.step }))} />
      )}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={24} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Sessions</Text>
          <Pressable
            onPress={() => setCreateVisible(true)}
            hitSlop={8}
            style={styles.launchPill}
          >
            <Feather name="cpu" size={13} color="#000" />
            <Text style={styles.launchPillText}>Launch Agent</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : jobs.length === 0 ? (
          <Text style={styles.emptyText}>No background agents running yet.</Text>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={j => j.job_id}
            renderItem={renderJob}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadJobs(); }} tintColor={COLORS.primary} />}
          />
        )}
      </View>

      <CreateIssueModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onIssueCreated={() => {
          setCreateVisible(false);
          loadJobs();
        }}
        onJobAssigned={(jobId) => {
          setCreateVisible(false);
          setTimeout(() => router.push(`/session/${jobId}`), 400);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: 'rgba(5, 5, 5, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginTop: 100,
  },
  jobCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  jobTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    gap: 4,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  summaryBox: {
    backgroundColor: 'rgba(208, 253, 62, 0.05)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  summaryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  launchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  launchPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: '#000',
  },
});
