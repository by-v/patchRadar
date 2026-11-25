import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';
import type { SavedRepo } from '@/lib/saved-repo';
import { formatLocalDateTime } from '@/lib/time';

type SavedRepoCardProps = {
  repo: SavedRepo;
  copied: boolean;
  editing: boolean;
  pendingDelete: boolean;
  onUse: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
};

/** Kartu satu repo tersimpan beserta aksi Gunakan/Salin/Ubah/Hapus. */
export function SavedRepoCard({
  repo,
  copied,
  editing,
  pendingDelete,
  onUse,
  onCopy,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: SavedRepoCardProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.cardTop}>
        <Ionicons color={theme.textSecondary} name="logo-github" size={18} />
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[styles.repoName, { color: theme.text }]}>
          {repo.repoFullName}
        </Text>
      </View>

      <Text numberOfLines={1} style={[styles.repoUrl, { color: theme.textSecondary }]}>
        {repo.repoUrl}
      </Text>

      {repo.note ? (
        <Text style={[styles.repoNote, { color: theme.text }]}>{repo.note}</Text>
      ) : null}

      <Text style={[styles.repoTime, { color: theme.textSecondary }]}>
        Diperbarui {formatLocalDateTime(repo.updatedAt)}
      </Text>

      {pendingDelete ? (
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmText, { color: theme.text }]}>
            Hapus repo ini dari daftar?
          </Text>
          <Pressable
            accessibilityLabel="Batal menghapus repo"
            accessibilityRole="button"
            onPress={onCancelDelete}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.secondaryText, { color: theme.text }]}>Batal</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Hapus ${repo.repoFullName}`}
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [
              styles.dangerButton,
              { borderColor: theme.danger },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.secondaryText, { color: theme.danger }]}>Hapus</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityHint="Mengisi kolom tautan di layar Pindai"
            accessibilityLabel={`Gunakan ${repo.repoFullName} di layar Pindai`}
            accessibilityRole="button"
            onPress={onUse}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.darkAccent },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={theme.textOnDark} name="scan-outline" size={16} />
            <Text style={[styles.primaryText, { color: theme.textOnDark }]}>Gunakan</Text>
          </Pressable>

          <Pressable
            accessibilityLabel={copied ? 'Tautan tersalin' : `Salin tautan ${repo.repoFullName}`}
            accessibilityRole="button"
            onPress={onCopy}
            style={({ pressed }) => [
              styles.iconAction,
              { borderColor: theme.hairline },
              pressed && styles.pressed,
            ]}>
            <Ionicons
              color={copied ? theme.success : theme.text}
              name={copied ? 'checkmark' : 'copy-outline'}
              size={16}
            />
            <Text
              style={[
                styles.iconActionText,
                { color: copied ? theme.success : theme.text },
              ]}>
              {copied ? 'Tersalin' : 'Salin'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityLabel={`Ubah ${repo.repoFullName}`}
            accessibilityRole="button"
            onPress={onEdit}
            style={({ pressed }) => [
              styles.iconButton,
              { borderColor: theme.hairline },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={theme.text} name="create-outline" size={18} />
          </Pressable>

          <Pressable
            accessibilityLabel={`Hapus ${repo.repoFullName}`}
            accessibilityRole="button"
            onPress={onRequestDelete}
            style={({ pressed }) => [
              styles.iconButton,
              { borderColor: theme.hairline },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={theme.danger} name="trash-outline" size={18} />
          </Pressable>
        </View>
      )}

      {editing ? (
        <Text style={[styles.editingNote, { color: theme.textSecondary }]}>
          Sedang diubah di formulir atas.
        </Text>
      ) : null}
    </GlassSurface>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    card: {
      padding: Spacing.three,
      gap: Spacing.two,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
    },
    repoName: {
      ...Typography.sectionTitle,
      flex: 1,
    },
    repoUrl: {
      ...Typography.meta,
    },
    repoNote: {
      ...Typography.body,
    },
    repoTime: {
      ...Typography.meta,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    primaryButton: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
    },
    primaryText: {
      ...Typography.body,
      fontWeight: '600',
    },
    secondaryButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    secondaryText: {
      ...Typography.body,
      fontWeight: '600',
    },
    dangerButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    iconAction: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one,
      paddingHorizontal: Spacing.two,
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    iconActionText: {
      ...Typography.meta,
      fontWeight: '600',
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    confirmRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.one,
    },
    confirmText: {
      ...Typography.body,
      flexBasis: '100%',
    },
    editingNote: {
      ...Typography.meta,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
