import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { assignAgent } from '../services/api';

interface Props {
  issueId: string;
  repoName: string;
  visible: boolean;
  onClose: () => void;
  onAssigned: (jobId: string) => void;
}

type AgentType = 'codex' | 'opencode' | 'claude_code' | 'kiro';

export default function AssignAgentModal({ issueId, repoName, visible, onClose, onAssigned }: Props) {
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('codex');

  async function handleAssign() {
    try {
      setLoading(true);
      const res = await assignAgent(issueId, selectedAgent, repoName);
      onAssigned(res.job_id);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to assign agent. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Assign Agent to Issue</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={24} color={COLORS.textTertiary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>Select the background agent to investigate and resolve this issue.</Text>

          <Pressable
            style={[styles.agentRow, selectedAgent === 'codex' && styles.agentRowSelected]}
            onPress={() => setSelectedAgent('codex')}
          >
            <View style={styles.agentIconWrapper}>
              <Feather name="terminal" size={20} color={selectedAgent === 'codex' ? COLORS.primary : COLORS.textTertiary} />
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentTitle}>Codex Agent</Text>
              <Text style={styles.agentDesc}>OpenAI&apos;s Codex CLI. Fast code generation.</Text>
            </View>
            {selectedAgent === 'codex' && <Feather name="check-circle" size={20} color={COLORS.primary} />}
          </Pressable>

          <Pressable
            style={[styles.agentRow, selectedAgent === 'opencode' && styles.agentRowSelected]}
            onPress={() => setSelectedAgent('opencode')}
          >
            <View style={styles.agentIconWrapper}>
              <Feather name="code" size={20} color={selectedAgent === 'opencode' ? COLORS.secondary : COLORS.textTertiary} />
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentTitle}>OpenCode Agent</Text>
              <Text style={styles.agentDesc}>Multi-model coding agent powered by GPT-4o.</Text>
            </View>
            {selectedAgent === 'opencode' && <Feather name="check-circle" size={20} color={COLORS.secondary} />}
          </Pressable>

          <Pressable
            style={[styles.agentRow, selectedAgent === 'claude_code' && styles.agentRowSelectedClaude]}
            onPress={() => setSelectedAgent('claude_code')}
          >
            <View style={[styles.agentIconWrapper, selectedAgent === 'claude_code' && { backgroundColor: 'rgba(205, 130, 80, 0.15)' }]}>
              <MaterialCommunityIcons name="brain" size={20} color={selectedAgent === 'claude_code' ? '#E8855A' : COLORS.textTertiary} />
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentTitle}>Claude Code</Text>
              <Text style={styles.agentDesc}>Anthropic&apos;s agentic CLI. BYOK via Anthropic API key.</Text>
            </View>
            {selectedAgent === 'claude_code' && <Feather name="check-circle" size={20} color="#E8855A" />}
          </Pressable>

          <Pressable
            style={[styles.agentRow, selectedAgent === 'kiro' && styles.agentRowSelectedKiro]}
            onPress={() => setSelectedAgent('kiro')}
          >
            <View style={[styles.agentIconWrapper, selectedAgent === 'kiro' && { backgroundColor: 'rgba(255, 153, 0, 0.15)' }]}>
              <FontAwesome5 name="amazon" size={18} color={selectedAgent === 'kiro' ? '#FF9900' : COLORS.textTertiary} />
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentTitle}>Kiro</Text>
              <Text style={styles.agentDesc}>Amazon&apos;s agentic CLI. Requires one-time login on the VM.</Text>
            </View>
            {selectedAgent === 'kiro' && <Feather name="check-circle" size={20} color="#FF9900" />}
          </Pressable>

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.assignButton, loading && styles.buttonDisabled]} onPress={handleAssign} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.assignButtonText}>Assign Agent</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1E1E1E',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#2A2A2A',
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  agentRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(208, 253, 62, 0.05)',
  },
  agentRowSelectedClaude: {
    borderColor: '#E8855A',
    backgroundColor: 'rgba(232, 133, 90, 0.05)',
  },
  agentRowSelectedKiro: {
    borderColor: '#FF9900',
    backgroundColor: 'rgba(255, 153, 0, 0.05)',
  },
  agentIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3A3A3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  agentInfo: {
    flex: 1,
  },
  agentTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  agentDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
  },
  cancelButton: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#333',
  },
  cancelButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  assignButton: {
    flex: 1,
    padding: SPACING.lg,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  assignButtonText: {
    color: '#000',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});
