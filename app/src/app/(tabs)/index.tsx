import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { DarkCallToAction } from '@/components/dark-cta';
import { PillInput } from '@/components/pill-input';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type ScanScope = 'production' | 'all';

const SCOPES: { value: ScanScope; label: string }[] = [
  { value: 'production', label: 'Hanya produksi' },
  { value: 'all', label: 'Termasuk dev' },
];

export default function ScanScreen() {
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<ScanScope>('production');
  const canScan = url.trim().length > 0;

  return (
    <Screen avoidKeyboard>
      <Wordmark />

      <View style={styles.heading}>
        <Text style={styles.title}>Pindai repositori</Text>
        <Text style={styles.subtitle}>
          Tempel tautan repositori GitHub untuk memeriksa kerentanan dependensi.
        </Text>
      </View>

      <PillInput
        accessibilityLabel="Tautan repositori GitHub"
        autoCapitalize="none"
        autoCorrect={false}
        icon="logo-github"
        keyboardType="url"
        onChangeText={setUrl}
        placeholder="https://github.com/pemilik/repo"
        returnKeyType="go"
        value={url}
      />

      <View accessibilityRole="radiogroup" style={styles.scope}>
        {SCOPES.map((option) => {
          const selected = scope === option.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => setScope(option.value)}
              style={[styles.scopeItem, selected && styles.scopeItemActive]}>
              <Text style={[styles.scopeLabel, selected && styles.scopeLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <DarkCallToAction
        accessibilityHint="Memulai pemindaian dependensi repositori"
        disabled={!canScan}
        eyebrow="Siap dipindai"
        onPress={() =>
          Alert.alert(
            'Pemindaian belum aktif',
            'Pemanggilan API akan dihubungkan pada tugas berikutnya.',
          )
        }
        title="Mulai pemindaian"
      />

      <Text style={styles.note}>
        Maksimal 1.500 paket unik per pemindaian. Repositori besar dapat memakan waktu hingga 25
        detik.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: Spacing.two,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  scope: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.light.inputFill,
    borderWidth: 1,
    borderColor: Colors.light.inputBorder,
  },
  scopeItem: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
  },
  scopeItemActive: {
    backgroundColor: Colors.light.darkAccent,
  },
  scopeLabel: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  scopeLabelActive: {
    color: Colors.light.textOnDark,
    fontWeight: '600',
  },
  note: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
});
