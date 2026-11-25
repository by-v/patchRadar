import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { GlassSurface } from '@/components/glass-surface';
import { PillInput } from '@/components/pill-input';
import { SavedRepoCard } from '@/components/saved-repo-card';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { openDatabaseSafely } from '@/db/access';
import {
  deleteSavedRepo,
  listSavedRepos,
  saveSavedRepo,
  updateSavedRepo,
} from '@/db/repository';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { setPendingRepoUrl } from '@/lib/repo-picker';
import {
  createSavedRepoId,
  findDuplicateSavedRepo,
  parseSavedRepoFields,
  SAVED_REPO_LIMIT,
  SAVED_REPO_NOTE_MAX_LENGTH,
  type SavedRepo,
} from '@/lib/saved-repo';

const COPY_FEEDBACK_MS = 2_500;

export default function SavedReposScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [repos, setRepos] = useState<SavedRepo[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<SavedRepo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const db = await openDatabaseSafely();
      if (!active) return;
      if (!db) {
        setLoadFailed(true);
        setRepos([]);
        return;
      }

      try {
        const stored = await listSavedRepos(db);
        if (active) setRepos(stored);
      } catch {
        if (active) {
          setLoadFailed(true);
          setRepos([]);
        }
      }
    })();

    return () => {
      active = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  function closeScreen() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  function resetForm() {
    setEditing(null);
    setUrl('');
    setNote('');
    setFormError(null);
  }

  function startEditing(repo: SavedRepo) {
    setEditing(repo);
    setUrl(repo.repoUrl);
    setNote(repo.note);
    setFormError(null);
    setNotice(null);
    setActionError(null);
  }

  async function handleSave() {
    if (saving) return;
    if (repos === null) {
      setFormError('Tunggu daftar repo selesai dimuat.');
      return;
    }

    const parsed = parseSavedRepoFields(url, note);
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }

    const current = repos;
    const duplicate = findDuplicateSavedRepo(current, parsed.value.repoUrl, editing?.id);
    if (duplicate) {
      setFormError('Repositori ini sudah ada di daftar.');
      return;
    }

    if (!editing && current.length >= SAVED_REPO_LIMIT) {
      setFormError(`Maksimal ${SAVED_REPO_LIMIT} repo tersimpan.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    setActionError(null);
    setNotice(null);

    try {
      const db = await openDatabaseSafely();
      if (!db) {
        setFormError('Penyimpanan lokal tidak tersedia. Coba lagi.');
        return;
      }

      const now = new Date().toISOString();
      if (editing) {
        await updateSavedRepo(db, { ...editing, ...parsed.value, updatedAt: now });
        setNotice('Perubahan tersimpan.');
      } else {
        const next: SavedRepo = {
          id: createSavedRepoId(),
          ...parsed.value,
          createdAt: now,
          updatedAt: now,
        };
        await saveSavedRepo(db, next);
        setNotice('Repo berhasil disimpan.');
      }

      setRepos(await listSavedRepos(db));
      resetForm();
    } catch {
      setFormError('Gagal menyimpan repo. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(repo: SavedRepo) {
    setPendingDeleteId(null);
    setNotice(null);
    setActionError(null);

    const db = await openDatabaseSafely();
    if (!db) {
      setActionError('Penyimpanan lokal tidak tersedia. Coba lagi.');
      return;
    }

    try {
      await deleteSavedRepo(db, repo.id);
      setRepos(await listSavedRepos(db));
      if (editing?.id === repo.id) resetForm();
      setNotice('Repo dihapus.');
    } catch {
      setActionError('Gagal menghapus repo. Coba lagi.');
    }
  }

  async function handleCopy(repo: SavedRepo) {
    setActionError(null);

    try {
      await Clipboard.setStringAsync(repo.repoUrl);
      setCopiedId(repo.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), COPY_FEEDBACK_MS);
    } catch {
      setActionError('Gagal menyalin tautan.');
    }
  }

  function handleUse(repo: SavedRepo) {
    setPendingRepoUrl(repo.repoUrl);
    router.dismissTo('/');
  }

  const atLimit = !editing && (repos?.length ?? 0) >= SAVED_REPO_LIMIT;

  return (
    <Screen avoidKeyboard hasTabBar={false}>
      <ScreenHeader
        onBack={closeScreen}
        subtitle="Simpan tautan repositori agar tidak perlu menyalin ulang dari GitHub."
        title="Repo tersimpan"
      />

      {loadFailed ? (
        <Banner
          message="Daftar repo lokal tidak dapat dibuka. Coba tutup lalu buka kembali layar ini."
          title="Penyimpanan lokal bermasalah"
          variant="error"
        />
      ) : null}

      {notice ? <Banner message={notice} variant="success" /> : null}
      {actionError ? <Banner message={actionError} variant="error" /> : null}

      <GlassSurface style={styles.formCard}>
        <Text style={styles.formTitle}>
          {editing ? 'Ubah repo tersimpan' : 'Tambah repo'}
        </Text>

        <PillInput
          accessibilityLabel="Tautan repositori GitHub"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          icon="logo-github"
          keyboardType="url"
          onChangeText={(value) => {
            setUrl(value);
            setFormError(null);
          }}
          placeholder="https://github.com/pemilik/repositori"
          value={url}
        />

        <View
          style={[
            styles.noteField,
            { backgroundColor: theme.inputFill, borderColor: theme.inputBorder },
          ]}>
          <TextInput
            accessibilityLabel="Catatan repo (opsional)"
            editable={!saving}
            maxLength={SAVED_REPO_NOTE_MAX_LENGTH}
            multiline
            onChangeText={(value) => {
              setNote(value);
              setFormError(null);
            }}
            placeholder="Catatan singkat (opsional)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.noteInput, { color: theme.text }]}
            textAlignVertical="top"
            value={note}
          />
          <Text style={[styles.noteCount, { color: theme.textSecondary }]}>
            {note.length}/{SAVED_REPO_NOTE_MAX_LENGTH}
          </Text>
        </View>

        {formError ? (
          <Text accessibilityRole="alert" style={[styles.formError, { color: theme.danger }]}>
            {formError}
          </Text>
        ) : null}

        <View style={styles.formActions}>
          <Pressable
            accessibilityLabel={editing ? 'Simpan perubahan repo' : 'Simpan repo'}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.darkAccent },
              pressed && styles.pressed,
              saving && styles.disabled,
            ]}>
            <Text style={[styles.primaryText, { color: theme.textOnDark }]}>
              {saving ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Simpan repo'}
            </Text>
          </Pressable>

          {editing ? (
            <Pressable
              accessibilityLabel="Batalkan perubahan"
              accessibilityRole="button"
              disabled={saving}
              onPress={resetForm}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.hairline },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.secondaryText, { color: theme.text }]}>Batal</Text>
            </Pressable>
          ) : null}
        </View>

        {atLimit ? (
          <Text style={[styles.noteText, { color: theme.textSecondary }]}>
            Daftar sudah penuh. Hapus salah satu repo untuk menambah yang baru.
          </Text>
        ) : null}
      </GlassSurface>

      <View style={styles.list}>
        <View style={styles.listHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Daftar repo ({repos?.length ?? 0}/{SAVED_REPO_LIMIT})
          </Text>
        </View>

        {repos === null ? (
          <Text style={[styles.loading, { color: theme.textSecondary }]}>
            Memuat repo tersimpan…
          </Text>
        ) : repos.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            message="Tambahkan tautan repositori di atas. Daftar ini tersimpan di perangkat dan bisa dipakai lagi tanpa membuka GitHub."
            title="Belum ada repo tersimpan"
          />
        ) : (
          repos.map((repo) => (
            <SavedRepoCard
              copied={copiedId === repo.id}
              editing={editing?.id === repo.id}
              key={repo.id}
              onCancelDelete={() => setPendingDeleteId(null)}
              onCopy={() => void handleCopy(repo)}
              onDelete={() => void handleDelete(repo)}
              onEdit={() => startEditing(repo)}
              onRequestDelete={() => setPendingDeleteId(repo.id)}
              onUse={() => handleUse(repo)}
              pendingDelete={pendingDeleteId === repo.id}
              repo={repo}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    formCard: {
      padding: Spacing.four,
      gap: Spacing.three,
    },
    formTitle: {
      ...Typography.sectionTitle,
      color: theme.text,
    },
    noteField: {
      gap: Spacing.one,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radius.banner,
      borderWidth: 1,
    },
    noteInput: {
      ...Typography.body,
      minHeight: 72,
      paddingTop: 0,
    },
    noteCount: {
      ...Typography.meta,
      alignSelf: 'flex-end',
    },
    formError: {
      ...Typography.meta,
      paddingHorizontal: Spacing.one,
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
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
    disabled: {
      opacity: 0.55,
    },
    noteText: {
      ...Typography.meta,
    },
    list: {
      gap: Spacing.three,
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    sectionTitle: {
      ...Typography.sectionTitle,
    },
    loading: {
      ...Typography.body,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
