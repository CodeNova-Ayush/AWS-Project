import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { createIssueRemote, assignAgent, fetchUserRepos } from '../services/api';

type IssueType = 'bug' | 'suggestion' | 'performance';

interface Repo {
  full_name: string;
  name: string;
  private: boolean;
  description: string;
}

interface CreateIssueModalProps {
  visible: boolean;
  onClose: () => void;
  onIssueCreated: () => void;
  onJobAssigned: (jobId: string) => void;
}

export default function CreateIssueModal({ visible, onClose, onIssueCreated, onJobAssigned }: CreateIssueModalProps) {
  const [repo, setRepo] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<IssueType>('bug');

  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);

  // Load repos when modal opens
  useEffect(() => {
    if (!visible) return;
    setReposLoading(true);
    fetchUserRepos()
      .then(setRepos)
      .catch(() => setRepos([]))
      .finally(() => setReposLoading(false));
  }, [visible]);

  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  function selectRepo(r: Repo) {
    setRepo(r.full_name);
    setPickerOpen(false);
    setRepoSearch('');
  }

  async function handleCreate(runAgent: boolean) {
    if (!repo.trim() || !title.trim()) {
      Alert.alert('Missing Fields', 'Repository and Title are required.');
      return;
    }

    try {
      if (runAgent) setLoadingJob(true);
      else setLoading(true);

      const result = await createIssueRemote(repo, title, description, type);

      if (runAgent && result.issue_id) {
        const agentResult = await assignAgent(result.issue_id, 'claude_code', repo);
        onJobAssigned(agentResult.job_id);
      } else {
        onIssueCreated();
      }

      // Reset form
      setRepo('');
      setTitle('');
      setDescription('');
      setType('bug');
      setPickerOpen(false);
      setRepoSearch('');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create issue');
    } finally {
      setLoading(false);
      setLoadingJob(false);
    }
  }

  const TypeButton = ({ label, isSelected, onSelect, icon }: any) => (
    <Pressable
      style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
      onPress={onSelect}
    >
      <Feather name={icon} size={14} color={isSelected ? COLORS.primary : COLORS.textSecondary} />
      <Text style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Launch Agent</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Feather name="x" size={24} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {/* Repo Picker */}
            <Text style={styles.label}>Repository</Text>
            <Pressable
              style={[styles.repoPicker, pickerOpen && styles.repoPickerOpen]}
              onPress={() => setPickerOpen(v => !v)}
            >
              {reposLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Feather name="github" size={15} color={repo ? COLORS.textPrimary : COLORS.textSecondary} />
                  <Text style={[styles.repoPickerText, !repo && styles.repoPickerPlaceholder]} numberOfLines={1}>
                    {repo || 'Select a repository…'}
                  </Text>
                  <Feather name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.textSecondary} />
                </>
              )}
            </Pressable>

            {pickerOpen && (
              <View style={styles.pickerDropdown}>
                <View style={styles.searchRow}>
                  <Feather name="search" size={14} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search repos…"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={repoSearch}
                    onChangeText={setRepoSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <ScrollView style={styles.repoList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {filteredRepos.length === 0 ? (
                    <Text style={styles.noReposText}>No repos found</Text>
                  ) : (
                    filteredRepos.map(r => (
                      <Pressable
                        key={r.full_name}
                        style={({ pressed }) => [styles.repoItem, pressed && { opacity: 0.7 }, repo === r.full_name && styles.repoItemSelected]}
                        onPress={() => selectRepo(r)}
                      >
                        <View style={styles.repoItemLeft}>
                          <Feather name={r.private ? 'lock' : 'book'} size={13} color={repo === r.full_name ? COLORS.primary : COLORS.textSecondary} />
                          <Text style={[styles.repoItemName, repo === r.full_name && { color: COLORS.primary }]} numberOfLines={1}>
                            {r.full_name}
                          </Text>
                        </View>
                        {repo === r.full_name && <Feather name="check" size={13} color={COLORS.primary} />}
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>
            )}

            <Text style={[styles.label, { marginTop: SPACING.lg }]}>Issue Type</Text>
            <View style={styles.typeRow}>
              <TypeButton
                label="Bug Fix"
                icon="alert-circle"
                isSelected={type === 'bug'}
                onSelect={() => setType('bug')}
              />
              <TypeButton
                label="Feature"
                icon="plus-circle"
                isSelected={type === 'suggestion'}
                onSelect={() => setType('suggestion')}
              />
              <TypeButton
                label="Perf"
                icon="zap"
                isSelected={type === 'performance'}
                onSelect={() => setType('performance')}
              />
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief description of the issue"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Steps to reproduce, expected behaviour, context…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.actions}>
              <Pressable
                style={[styles.submitButton, styles.jobButton, (loading || loadingJob) && { opacity: 0.7 }]}
                onPress={() => handleCreate(true)}
                disabled={loading || loadingJob}
              >
                {loadingJob ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Feather name="cpu" size={20} color="#000" />
                    <Text style={[styles.submitText, { color: '#000' }]}>Fire Agent</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={[styles.submitButton, styles.onlyIssueButton, (loading || loadingJob) && { opacity: 0.7 }]}
                onPress={() => handleCreate(false)}
                disabled={loading || loadingJob}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Feather name="github" size={20} color={COLORS.primary} />
                    <Text style={[styles.submitText, { color: COLORS.primary }]}>Create Issue Only</Text>
                  </>
                )}
              </Pressable>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    height: '88%',
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  formContainer: {
    flex: 1,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  // Repo picker
  repoPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: 0,
  },
  repoPickerOpen: {
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  repoPickerText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
  },
  repoPickerPlaceholder: {
    color: 'rgba(255,255,255,0.3)',
  },
  pickerDropdown: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
    borderBottomLeftRadius: BORDER_RADIUS.md,
    borderBottomRightRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
  },
  repoList: {
    maxHeight: 200,
  },
  repoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  repoItemSelected: {
    backgroundColor: 'rgba(208,253,62,0.06)',
  },
  repoItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  repoItemName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  noReposText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    padding: SPACING.lg,
  },
  // Form
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  textArea: {
    height: 110,
  },
  typeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  typeButtonSelected: {
    backgroundColor: 'rgba(208, 253, 62, 0.1)',
    borderColor: COLORS.primary,
  },
  typeButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  typeButtonTextSelected: {
    color: COLORS.primary,
  },
  actions: {
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  jobButton: {
    backgroundColor: COLORS.primary,
  },
  onlyIssueButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  submitText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});
