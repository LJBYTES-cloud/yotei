import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { USE_REAL_AUTH } from '../auth';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, Message } from '../components/ui';

export default function SettingsScreen() {
  const { user, blocked, disabled, seeding, loadDemoData, backupAction, manageBackup, signOut, signingOut, signOutError } = useStudy();
  const { colors: p, isDark, toggleTheme } = useTheme();
  const s = useThemedStyles(createStudyStyles);
  const t = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title="Settings" edition="ACCOUNT & APPEARANCE" subtitle="Manage your account, appearance, and local data." />
        <View style={[s.card, t.profile]}><View style={t.avatar}><Text style={t.initial}>{user.name.charAt(0).toUpperCase() || 'Y'}</Text></View><View style={s.flex}><Text style={t.name}>{user.name}</Text><Text style={s.hint}>{user.email}</Text></View></View>
        <Text style={t.label}>01 / APPEARANCE</Text>
        <View style={s.card}>
          <View style={t.row}><View style={s.flex}><Text style={t.title}>Light mode</Text><Text style={t.description}>{isDark ? 'Dark background with purple accents.' : 'Light background with black text.'}</Text></View>
            <Switch accessibilityLabel="Light mode" accessibilityHint="Switch between dark purple and monochrome light themes" value={!isDark} onValueChange={toggleTheme} trackColor={{ false: p.line, true: p.accent }} thumbColor={isDark ? p.muted : p.surface} ios_backgroundColor={p.line} />
          </View>
          <View style={t.themePreview}><View style={t.previewPage}><View style={t.previewLine} /><View style={[t.previewLine, t.shortLine]} /><View style={t.previewButton} /></View><View style={s.flex}><Text style={s.eyebrow}>{isDark ? 'DARK / VIOLET' : 'LIGHT / MONOCHROME'}</Text><Text style={s.hint}>Applies to all screens and dialogs.</Text></View></View>
        </View>
        <Feedback />
        <Text style={t.label}>02 / DATA MANAGEMENT</Text>
        <View style={s.card}>
          <Text accessibilityRole="header" style={t.title}>Data Management</Text>
          <Text style={t.body}>Export your study data as JSON or restore a Yotei backup to this account.</Text>
          <View style={t.backupActions}>
            <Button label="Export Backup" disabled={disabled || blocked} busy={backupAction === 'export'} onPress={() => void manageBackup('export')} />
            <Button label="Import Backup" tone="outline" disabled={disabled || blocked} busy={backupAction === 'import'} onPress={() => void manageBackup('import')} />
          </View>
          <Text style={t.warning}>Warning: Importing will overwrite your current local data.</Text>
          <Text style={t.footnote}>Includes material notes and file paths. Attached files and login sessions are not included.</Text>
        </View>
        {!USE_REAL_AUTH && <>
          <Text style={t.label}>03 / DEMO DATA</Text>
          <View style={s.card}><Text style={t.title}>Demo study data</Text><Text style={t.body}>Load three subjects, six tasks, three due reviews, and four hours of study sessions.</Text><Button label="Load Demo Data" tone="outline" disabled={disabled || blocked} busy={seeding} onPress={() => void loadDemoData()} /><Text style={t.footnote}>Replaces only this demo account’s local study data.</Text></View>
        </>}
        <Text style={t.label}>{USE_REAL_AUTH ? '03' : '04'} / YOUR ACCOUNT</Text>
        <View style={s.card}><Text style={t.title}>Sign out</Text><Text style={t.body}>Your study data remains stored on this device.</Text><Message text={signOutError} /><Button label="Sign Out ↗" busy={signingOut} disabled={blocked} onPress={signOut} /></View>
      </ScrollView>
      <View style={t.mottoBar}><Text style={t.mottoText}>By students, for students.</Text></View>
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  mottoBar: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: p.line, backgroundColor: p.surface },
  mottoText: { color: p.text, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }, initial: { color: p.accent, fontSize: 23, fontWeight: '500' }, name: { color: p.text, fontSize: 18, fontWeight: '500', marginBottom: 4 },
  label: { color: p.muted, fontSize: 10, letterSpacing: 1.7, fontWeight: '700', marginTop: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, title: { color: p.text, fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
  description: { color: p.muted, fontSize: 12, lineHeight: 20, marginTop: 6 }, body: { color: p.muted, fontSize: 14, lineHeight: 23, marginTop: 12, marginBottom: 24 },
  footnote: { color: p.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 16 },
  backupActions: { gap: 12 },
  warning: { color: p.text, fontSize: 12, lineHeight: 20, marginTop: 16, fontWeight: '600' },
  themePreview: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: p.line },
  previewPage: { height: 80, width: 62, borderRadius: 8, borderWidth: 1, borderColor: p.line, backgroundColor: p.background, padding: 10, gap: 6 },
  previewLine: { height: 3, borderRadius: 2, backgroundColor: p.text, marginTop: 4 }, shortLine: { width: '65%', backgroundColor: p.muted, marginTop: 0 }, previewButton: { height: 14, borderRadius: 4, backgroundColor: p.accent, marginTop: 12 },
});
