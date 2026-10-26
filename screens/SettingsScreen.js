import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { USE_REAL_AUTH } from '../auth';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, FieldLabel, Message } from '../components/ui';

export default function SettingsScreen() {
  const { user, blocked, disabled, seeding, loadDemoData, backupAction, manageBackup, signOut, signingOut, signOutError } = useStudy();
  const { colors: p, isDark, toggleTheme } = useTheme();
  const themeLabel = isDark ? 'Dark Mode' : 'Light Mode';
  const switchThumb = isDark ? p.muted : '#FFFFFF';
  const s = useThemedStyles(createStudyStyles);
  const t = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title="Settings" edition="ACCOUNT & APPEARANCE" subtitle="Manage your account, appearance, and local data." />
        <View style={[s.card, t.profile]}><View style={t.avatar}><Text style={t.initial}>{user.name.charAt(0).toUpperCase() || 'Y'}</Text></View><View style={s.flex}><Text style={t.name}>{user.name}</Text><Text style={s.hint}>{user.email}</Text></View></View>
        <Text style={t.label}>01 / APPEARANCE</Text>
        <View style={s.card}>
          <View style={t.row}><View style={s.flex}><FieldLabel label={themeLabel} textStyle={t.title} help="Your theme is remembered on this device. Books keep their field colors in both themes; other light-mode screens use monochrome colors." /></View>
            <Switch accessibilityLabel={themeLabel} accessibilityHint={`Switch to ${isDark ? 'Light Mode' : 'Dark Mode'}`} value={!isDark} onValueChange={toggleTheme}
              trackColor={{ false: isDark ? p.line : '#E0E0E0', true: isDark ? p.accent : '#000000' }}
              thumbColor={switchThumb} ios_backgroundColor={isDark ? p.line : '#E0E0E0'}
              {...(Platform.OS === 'web' ? { activeThumbColor: switchThumb } : {})} />
          </View>
          <View style={t.themePreview}><View style={t.previewPage}><View style={t.previewLine} /><View style={[t.previewLine, t.shortLine]} /><View style={t.previewButton} /></View><View style={s.flex}><Text style={s.eyebrow}>{isDark ? 'DARK / VIOLET' : 'LIGHT / MONOCHROME'}</Text></View></View>
        </View>
        <Feedback />
        <Text style={t.label}>02 / DATA MANAGEMENT</Text>
        <View style={s.card}>
          <FieldLabel label="Data Management" textStyle={t.title} help="Export your study data as JSON or restore a Yotei backup. Material notes and paths are included; attached file contents and login sessions are excluded." />
          <View style={t.backupActions}>
            <Button label="Export Backup" disabled={disabled || blocked} busy={backupAction === 'export'} onPress={() => void manageBackup('export')} />
            <Button label="Import Backup" tone="outline" disabled={disabled || blocked} busy={backupAction === 'import'} onPress={() => void manageBackup('import')} />
          </View>
          <Text style={t.warning}>Warning: Importing will overwrite your current local data.</Text>
        </View>
        {!USE_REAL_AUTH && <>
          <Text style={t.label}>03 / DEMO DATA</Text>
          <View style={s.card}><FieldLabel label="Demo study data" textStyle={t.title} help="Load three subjects, six tasks, three due reviews, and four hours of study sessions for today." /><Button label="Load Demo Data" tone="outline" disabled={disabled || blocked} busy={seeding} onPress={() => void loadDemoData()} /><Text style={t.footnote}>Replaces this demo account’s local data.</Text></View>
        </>}
        <Text style={t.label}>{USE_REAL_AUTH ? '03' : '04'} / YOUR ACCOUNT</Text>
        <View style={s.card}><FieldLabel label="Sign out" textStyle={t.title} help="Signing out clears the login session. Your study data remains stored on this device." /><Message text={signOutError} /><Button label="Sign Out ↗" busy={signingOut} disabled={blocked} onPress={signOut} /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }, initial: { color: p.accent, fontSize: 23, fontWeight: '500' }, name: { color: p.text, fontSize: 18, fontWeight: '500', marginBottom: 4 },
  label: { color: p.muted, fontSize: 10, letterSpacing: 1.7, fontWeight: '700', marginTop: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, title: { color: p.text, fontSize: 19, lineHeight: 26, fontWeight: '700', letterSpacing: -0.4 },
  footnote: { color: p.muted, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 16 },
  backupActions: { gap: 12 },
  warning: { color: p.text, fontSize: 12, lineHeight: 20, marginTop: 16, fontWeight: '600' },
  themePreview: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: p.line },
  previewPage: { height: 80, width: 62, borderRadius: 8, borderWidth: 1, borderColor: p.line, backgroundColor: p.background, padding: 10, gap: 6 },
  previewLine: { height: 3, borderRadius: 2, backgroundColor: p.text, marginTop: 4 }, shortLine: { width: '65%', backgroundColor: p.muted, marginTop: 0 }, previewButton: { height: 14, borderRadius: 4, backgroundColor: p.accent, marginTop: 12 },
});
