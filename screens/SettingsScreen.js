import { fonts, typeScale, typeLeading } from '../components/typography';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { Feedback, ScreenHeader } from '../components/StudyCards';
import { useStudy } from '../components/StudyWorkspace';
import { createStudyStyles } from '../components/studyStyles';
import { Button, FieldLabel, Message } from '../components/ui';

export default function SettingsScreen() {
  const { user, blocked, disabled, seeding, loadDemoData, backupAction, manageBackup, signOut, signingOut, signOutError } = useStudy();
  const { colors: p, isDark, toggleTheme } = useTheme();
  const themeLabel = isDark ? 'Dark Mode' : 'Light Mode';
  const switchThumb = '#FFFFFF';
  const s = useThemedStyles(createStudyStyles);
  const t = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title="Settings" edition="Account & Appearance" subtitle="Manage your account, appearance, and local data." />
        <View style={[s.card, t.profile]}><View style={t.avatar}><Text style={t.initial}>{user.name.charAt(0).toUpperCase() || 'Y'}</Text></View><View style={s.flex}><Text style={t.name}>{user.name}</Text><Text style={s.hint}>{user.email}</Text></View></View>
        <View style={s.card}>
          <View style={t.row}><View style={s.flex}><FieldLabel label={themeLabel} textStyle={t.title} help="Your theme is remembered on this device. Light uses warm cream and forest green; Dark uses dark paper and soft green. Books retain their field colors." /></View>
            <Switch accessibilityLabel={themeLabel} accessibilityHint={`Switch to ${isDark ? 'Light Mode' : 'Dark Mode'}`} value={!isDark} onValueChange={toggleTheme}
              trackColor={{ false: p.line, true: p.accent }}
              thumbColor={switchThumb} ios_backgroundColor={p.line}
              {...(Platform.OS === 'web' ? { activeThumbColor: switchThumb } : {})} />
          </View>
          <View style={t.themePreview}><View style={t.previewPage}><View style={t.previewLine} /><View style={[t.previewLine, t.shortLine]} /><View style={t.previewButton} /></View><View style={s.flex}><Text style={s.eyebrow}>{isDark ? 'Dark / Sage' : 'Light / Forest'}</Text></View></View>
        </View>
        <Feedback />
        <View style={s.card}>
          <FieldLabel label="Data Management" textStyle={t.title} help="Export your study data as JSON or restore a Yotei backup. Material notes and paths are included; attached file contents and login sessions are excluded." />
          <View style={t.backupActions}>
            <Button label="Export Backup" disabled={disabled || blocked} busy={backupAction === 'export'} onPress={() => void manageBackup('export')} />
            <Button label="Import Backup" tone="outline" disabled={disabled || blocked} busy={backupAction === 'import'} onPress={() => void manageBackup('import')} />
          </View>
          <Text style={t.warning}>Warning: Importing will overwrite your current local data.</Text>
        </View>
          <View style={s.card}><FieldLabel label="Demo Study Data" textStyle={t.title} help="Load three subjects, six tasks, three reflections, three material links, six previous days of completed study, and four hours planned today." /><Button label="Load Demo Data" tone="outline" disabled={disabled || blocked} busy={seeding} onPress={() => void loadDemoData()} /><Text style={t.footnote}>Replaces this account’s local data.</Text></View>
        <Text style={t.label}>04 / Your Account</Text>
        <View style={s.card}><FieldLabel label="Sign Out" textStyle={t.title} help="Signing out clears the login session. Your study data remains stored on this device." /><Message text={signOutError} /><Button label="Sign Out ↗" busy={signingOut} disabled={blocked} onPress={signOut} /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} p */
const createStyles = p => StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { height: 52, width: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }, initial: { fontFamily: fonts.medium, color: p.accent, fontSize: typeScale.h2, lineHeight: typeLeading.h2, fontWeight: 'normal' }, name: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3, fontWeight: 'normal', marginBottom: 4 },
  label: { fontFamily: fonts.bold, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, letterSpacing: 1.7, fontWeight: 'normal', marginTop: 12, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 }, title: { fontFamily: fonts.serifBold, color: p.text, fontSize: typeScale.h3, lineHeight: typeLeading.h3, fontWeight: 'normal', letterSpacing: -0.4 },
  footnote: { fontFamily: fonts.body, color: p.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, textAlign: 'center', marginTop: 16 },
  backupActions: { gap: 12 },
  warning: { fontFamily: fonts.semibold, color: p.text, fontSize: typeScale.small, lineHeight: typeLeading.small, marginTop: 16, fontWeight: 'normal' },
  themePreview: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 28, paddingTop: 24, borderTopWidth: 1, borderTopColor: p.line },
  previewPage: { height: 80, width: 62, borderRadius: 8, borderWidth: 1, borderColor: p.line, backgroundColor: p.background, padding: 10, gap: 6 },
  previewLine: { height: 3, borderRadius: 2, backgroundColor: p.text, marginTop: 4 }, shortLine: { width: '65%', backgroundColor: p.muted, marginTop: 0 }, previewButton: { height: 14, borderRadius: 4, backgroundColor: p.accent, marginTop: 12 },
});
