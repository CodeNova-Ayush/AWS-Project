import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../src/constants/theme';
import { CodeIssue } from '../src/constants/types';
import { fetchSavedIssues } from '../src/services/api';

const TYPE_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string }> = {
  bug: { icon: 'alert-circle', color: COLORS.error },
  performance: { icon: 'zap', color: COLORS.warning },
  suggestion: { icon: 'message-square', color: COLORS.info },
};

export default function SavedScreen() {
  const router = useRouter();
  const [issues, setIssues] = useState<CodeIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSaved();
  }, []);

  async function loadSaved() {
    try {
      const data = await fetchSavedIssues();
      setIssues(data);
    } catch {}
    setLoading(false);
  }

  return (
    <View style={styles.container} testID="saved-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
            <Feather name="arrow-left" size={22} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Saved Issues</Text>
          <View style={{ width: 22 }} />
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : issues.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bookmark" size={48} color={COLORS.textTertiary} />
          <Text style={styles.emptyTitle}>No saved issues yet</Text>
          <Text style={styles.emptySubtext}>Save issues from the feed to review later</Text>
        </View>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={(item) => item.issue_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.bug;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                testID={`saved-issue-${item.issue_id}`}
              >
                <View style={styles.cardHeader}>
                  <Feather name={cfg.icon} size={16} color={cfg.color} />
                  <Text style={styles.cardProject}>{item.project}</Text>
                  <Text style={styles.cardType}>{item.type_label}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.cardFooter}>
                  <Feather name="git-branch" size={12} color={COLORS.textTertiary} />
                  <Text style={styles.cardBranch}>{item.branch}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  emptySubtext: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
  },
  list: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardProject: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  cardType: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    marginLeft: 'auto',
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  cardDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  cardBranch: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontFamily: 'Courier New',
  },
});
