import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Spacing, Typography } from '@/constants/theme';

const LABELS = [
  {
    title: 'Tambal sekarang',
    description:
      'Ada bukti eksploitasi nyata, atau tingkat keparahan Kritis dengan peluang eksploitasi tinggi.',
    trigger: 'Contoh pemicu: CVE tercatat di katalog CISA KEV.',
  },
  {
    title: 'Jadwalkan',
    description:
      'Risiko tinggi, tetapi belum ada bukti eksploitasi yang kuat. Perbaiki pada siklus kerja berikutnya.',
    trigger: 'Contoh pemicu: tingkat keparahan Tinggi tanpa bukti eksploitasi nyata.',
  },
  {
    title: 'Pantau',
    description:
      'Belum ada indikasi eksploitasi dan tingkat keparahan relatif rendah. Pantau sampai ada pembaruan.',
    trigger: 'Contoh pemicu: tingkat keparahan Sedang tanpa pemicu label di atas.',
  },
];

const SOURCES = [
  {
    title: 'OSV',
    body: 'Sumber laporan kerentanan dan tingkat keparahan (CVSS) untuk paket npm. Sebagian laporan tidak punya tingkat keparahan atau CVE.',
  },
  {
    title: 'CISA KEV',
    body: 'Katalog kerentanan yang sudah dieksploitasi nyata. Satu kecocokan CVE sudah cukup untuk label Tambal sekarang.',
  },
  {
    title: 'EPSS',
    body: 'Perkiraan peluang eksploitasi dalam 30 hari dari FIRST. Nilainya berupa sinyal, bukan bukti serangan.',
  },
  {
    title: 'GitHub',
    body: 'Berkas package.json dan package-lock.json dari cabang utama repositori publik.',
  },
];

const LIMITATIONS = [
  'Hanya repositori GitHub publik pada cabang utama; repositori privat dan cabang lain tidak didukung.',
  'Hanya berkas dependensi di folder utama dan ekosistem npm dengan package-lock.json v2/v3. Yarn atau pnpm diperlakukan sebagai mode perkiraan.',
  'Mode perkiraan hanya memeriksa dependensi langsung dengan versi teoretis, bukan versi yang benar-benar terpasang.',
  'Tingkat keparahan bergantung pada kelengkapan data OSV. Laporan tanpa tingkat keparahan atau CVE tidak dapat dicocokkan dengan KEV dan EPSS.',
  'KEV dan EPSS adalah sinyal, bukan bukti bahwa proyek tertentu diserang. Tidak ada analisis konteks kode.',
  'EPSS yang tidak tersedia diperlakukan 0 saat menentukan label, sehingga prioritas bisa sementara lebih rendah.',
  'Katalog KEV dapat tertinggal hingga 24 jam dan singgahan OSV dapat menahan laporan baru sampai masa berlakunya berakhir.',
  'Perintah perbaikan mengasumsikan proyek memakai npm dan belum mempertimbangkan konflik antar dependensi atau versi.',
  'Hasil bergantung pada ketersediaan GitHub, OSV, KEV, dan EPSS. Saat sumber gagal, aplikasi menampilkan hasil parsial atau data singgahan.',
  'Tidak ada notifikasi, pemantauan berkala, ekspor, atau perbandingan hasil pada versi ini.',
  'Tidak ada jaminan bebas positif palsu atau negatif palsu. PatchRadar bukan pengganti audit keamanan profesional.',
];

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScreenHeader
        subtitle="Arti label, sumber data, dan batas penggunaan."
        title="Tentang PatchRadar"
      />

      <Text style={styles.intro}>
        PatchRadar memeriksa dependensi repositori GitHub dan mengurutkan temuan berdasarkan risiko
        yang dapat ditindaklanjuti. Hasilnya berupa bahan prioritas, bukan keputusan akhir.
      </Text>

      <Section title="Arti label">
        <View style={styles.cards}>
          {LABELS.map((label) => (
            <GlassSurface key={label.title} style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                {label.title}
              </Text>
              <Text style={styles.cardBody}>{label.description}</Text>
              <Text style={styles.cardMeta}>{label.trigger}</Text>
            </GlassSurface>
          ))}
        </View>
      </Section>

      <Section title="Sumber data">
        <View style={styles.cards}>
          {SOURCES.map((source) => (
            <GlassSurface key={source.title} style={styles.card}>
              <Text accessibilityRole="header" style={styles.cardTitle}>
                {source.title}
              </Text>
              <Text style={styles.cardBody}>{source.body}</Text>
            </GlassSurface>
          ))}
        </View>
      </Section>

      <GlassSurface style={styles.warningCard} variant="strong">
        <Text accessibilityRole="header" style={styles.warningTitle}>
          Hasil bersifat potensial
        </Text>
        <Text style={styles.warningBody}>
          Label dan alasan adalah perkiraan berdasarkan data publik saat pemindaian. PatchRadar
          tidak menganalisis kode proyek dan tidak menjamin proyek aman atau tidak akan diserang.
          Gunakan hasil ini sebagai bahan prioritas, bukan pengganti audit keamanan.
        </Text>
      </GlassSurface>

      <Section title="Privasi dan identitas anonim">
        <GlassSurface style={styles.card}>
          <Text style={styles.cardBody}>
            PatchRadar tidak meminta login. Sesi anonim dibuat otomatis untuk memakai layanan, dan
            hanya repositori publik yang dapat dipindai. Tautan repositori serta hasil pemindaian
            dikirim ke server PatchRadar untuk diproses.
          </Text>
          <Text style={styles.cardBody}>
            Riwayat saat ini hanya bertahan selama sesi aplikasi. Setelah riwayat cloud aktif, data
            terikat pada identitas anonim dan tidak dapat dipulihkan setelah aplikasi dihapus atau
            data aplikasi dibersihkan. Pindai ulang repositori untuk mendapatkan hasil baru.
          </Text>
          <Text style={styles.cardBody}>
            Tidak ada telemetri produk pada versi ini; masukan validasi dikumpulkan secara manual
            dari sesi pengujian terbatas.
          </Text>
        </GlassSurface>
      </Section>

      <Section title="Keterbatasan utama">
        <GlassSurface style={styles.card}>
          {LIMITATIONS.map((limitation) => (
            <Text key={limitation} style={styles.bullet}>
              • {limitation}
            </Text>
          ))}
        </GlassSurface>
      </Section>

      <Text style={styles.version}>Versi {version}</Text>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  cards: {
    gap: Spacing.gap,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  cardBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  cardMeta: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  warningCard: {
    padding: Spacing.three,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: Colors.light.warning,
  },
  warningTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  warningBody: {
    ...Typography.body,
    color: Colors.light.text,
  },
  bullet: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  version: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
});
