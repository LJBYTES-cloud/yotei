import { cardShadow, fonts, typeScale, typeLeading } from '../components/typography';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService, USE_REAL_AUTH } from '../auth';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../auth/MockAuthService';
import { useSession } from '../auth/SessionContext';
import { useTheme, useThemedStyles } from '../ThemeContext';
import { InfoButton } from '../components/ui';

/** @param {{ label: string, action?: import('react').ReactNode } & import('react-native').TextInputProps} props */
function Field({ label, action, ...props }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputFocused]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.accent}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          {...props}
        />
        {action}
      </View>
    </View>
  );
}

/** @param {{ message: string }} props */
function ErrorMessage({ message }) {
  const styles = useThemedStyles(createStyles);
  if (!message) return null;
  return (
    <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { restoring, restoreError, retryRestore, acceptUser } = useSession();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);

  /** @param {boolean} signUp */
  function changeMode(signUp) {
    if (submitting.current) return;
    setIsSignUp(signUp);
    setError('');
    setPassword('');
    setShowPassword(false);
  }

  async function authenticate(demo = false) {
    if (submitting.current) return;
    const credentials = {
      email: demo ? DEMO_EMAIL : email.trim().toLowerCase(),
      password: demo ? DEMO_PASSWORD : password,
      rememberMe,
    };
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      setError('Enter a valid email address to continue.');
      return;
    }
    if (!credentials.password) {
      setError('Enter your password to continue.');
      return;
    }
    if (isSignUp && !demo) {
      if (!name.trim()) {
        setError('Enter your name to create an account.');
        return;
      }
      if (credentials.password.length < 8) {
        setError('Choose a password with at least 8 characters.');
        return;
      }
    }
    submitting.current = true;
    setWorking(true);
    Keyboard.dismiss();
    try {
      const nextUser = isSignUp && !demo
        ? await authService.signUp({ ...credentials, name: name.trim() })
        : await authService.signIn(credentials);
      acceptUser(nextUser);
      setPassword('');
      setShowPassword(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.content}>
            <View style={styles.brand}>
              <View style={styles.logo} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.logoLeft} /><View style={styles.logoRight} />
              </View>
              <Text style={styles.brandName}>yotei<Text style={styles.brandDot}>.</Text></Text>
            </View>

            {restoring || restoreError ? (
              <View style={styles.card}>
                {restoring ? (
                  <View style={styles.loading} accessibilityLiveRegion="polite">
                    <ActivityIndicator color={colors.accent} size="large" />
                    <Text style={styles.subtitle}>Restoring session…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>Session Restore Failed</Text>
                    <ErrorMessage message={restoreError} />
                    <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={retryRestore}>
                      <Text style={styles.primaryText}>Retry</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ) : (
              <>
                <View style={styles.intro}>
                  <Text style={styles.eyebrow}>Account</Text>
                  <View style={styles.titleRow}><Text style={[styles.heading, styles.flex]}>{isSignUp ? 'Create Account' : 'Sign In'}</Text><InfoButton title="Your Account" message="Access your subjects, tasks, study sessions, and review queue." /></View>
                </View>
                <View style={styles.card}>
                  <View style={styles.tabs} accessibilityRole="tablist">
                    {[false, true].map(signUp => (
                      <Pressable
                        key={String(signUp)} accessibilityRole="tab"
                        accessibilityState={{ selected: isSignUp === signUp, disabled: working }}
                        disabled={working} onPress={() => changeMode(signUp)}
                        style={[styles.tab, isSignUp === signUp && styles.activeTab]}
                      >
                        <Text style={[styles.tabText, isSignUp === signUp && styles.activeTabText]}>{signUp ? 'Create Account' : 'Sign In'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.cardTitleRow}><Text style={[styles.cardTitle, styles.flex]}>{isSignUp ? 'Account Details' : 'Credentials'}</Text><InfoButton title={isSignUp ? 'Account Details' : 'Credentials'} message={isSignUp ? 'Enter your name, email address, and a password of at least 8 characters.' : 'Enter your email address and password. Remember me keeps the session after an app restart.'} /></View>
                  {isSignUp && <Field label="Your Name" placeholder="Alex Morgan" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={128} editable={!working} />}
                  <Field
                    label="Email Address" placeholder="you@example.com"
                    value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
                    keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
                    maxLength={320} editable={!working}
                  />
                  <Field
                    label="Password" placeholder={isSignUp ? 'At least 8 characters' : 'Enter your password'}
                    value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
                    autoCapitalize="none" autoCorrect={false}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    textContentType={isSignUp ? 'newPassword' : 'password'} maxLength={256}
                    returnKeyType="go" onSubmitEditing={() => void authenticate()} editable={!working}
                    action={
                      <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} disabled={working} onPress={() => setShowPassword(value => !value)} style={styles.showPassword}>
                        <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                      </Pressable>
                    }
                  />
                  <ErrorMessage message={error} />
                  <Pressable
                    accessibilityRole="checkbox" accessibilityLabel="Remember Me"
                    accessibilityState={{ checked: rememberMe, disabled: working }}
                    disabled={working} onPress={() => setRememberMe(value => !value)}
                    style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed, working && styles.disabled]}
                  >
                    <View style={[styles.rememberCheckbox, rememberMe && styles.rememberCheckboxChecked]}>
                      {rememberMe && <Text style={styles.rememberCheck}>✓</Text>}
                    </View>
                    <Text style={styles.rememberLabel}>Remember Me</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button" accessibilityLabel={isSignUp ? 'Create Account' : 'Sign In'}
                    accessibilityState={{ disabled: working, busy: working }} disabled={working}
                    onPress={() => void authenticate()}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, working && styles.disabled]}
                  >
                    {working ? <ActivityIndicator color={colors.onAccent} /> : (
                      <><Text style={styles.primaryText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text><Text style={styles.buttonArrow}>↗</Text></>
                    )}
                  </Pressable>
                  {!USE_REAL_AUTH && (
                    <>
                      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>Mock Authentication</Text><View style={styles.dividerLine} /></View>
                      <Pressable accessibilityRole="button" disabled={working} accessibilityState={{ disabled: working }} onPress={() => void authenticate(true)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, working && styles.disabled]}>
                        <Text style={styles.secondaryText}>Sign In to Demo</Text>
                      </Pressable>
                      <Text style={styles.demoNote}>New mock accounts reset when the app restarts.</Text>
                    </>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** @param {import('../ThemeContext').ThemeColors} colors */
const createStyles = colors => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accent, overflow: 'hidden' },
  logoLeft: { position: 'absolute', width: 5, height: 22, borderRadius: 3, backgroundColor: colors.background, left: 12, top: 7, transform: [{ rotate: '28deg' }] },
  logoRight: { position: 'absolute', width: 5, height: 14, borderRadius: 3, backgroundColor: colors.background, left: 21, top: 14, transform: [{ rotate: '-28deg' }] },
  brandName: { fontFamily: fonts.serifBold, fontSize: typeScale.h1, lineHeight: typeLeading.h1, fontWeight: 'normal', letterSpacing: -1.5, color: colors.text },
  brandDot: { color: colors.accent },
  intro: { marginBottom: 28 },
  eyebrow: { fontFamily: fonts.bold, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', letterSpacing: 2, color: colors.accent, marginBottom: 14 },
  heading: { fontFamily: fonts.serifBold, fontSize: typeScale.h1, lineHeight: typeLeading.h1, fontWeight: 'normal', letterSpacing: -1.6, color: colors.text, marginBottom: 14 },
  accentText: { color: colors.accent },
  subtitle: { fontFamily: fonts.body, fontSize: typeScale.body, lineHeight: typeLeading.body, color: colors.muted },
  card: { ...cardShadow, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 22, marginTop: 6 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, backgroundColor: colors.input, marginBottom: 26 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, minHeight: 44 },
  activeTab: { backgroundColor: colors.raised },
  tabText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: typeScale.button, lineHeight: typeLeading.button, fontWeight: 'normal' },
  activeTabText: { color: colors.text },
  cardTitle: { fontFamily: fonts.serifBold, color: colors.text, fontSize: typeScale.h2, lineHeight: typeLeading.h2, fontWeight: 'normal', letterSpacing: -0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { fontFamily: fonts.semibold, color: colors.text, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal', marginBottom: 9 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.input },
  inputFocused: { borderColor: colors.accent },
  input: { fontFamily: fonts.body, flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, fontSize: typeScale.body, lineHeight: typeLeading.body, color: colors.text },
  showPassword: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, justifyContent: 'center' },
  showPasswordText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, fontWeight: 'normal' },
  primaryButton: { flexDirection: 'row', minHeight: 54, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 14, marginTop: 6, gap: 14 },
  primaryText: { fontFamily: fonts.bold, color: colors.onAccent, fontSize: typeScale.button, lineHeight: typeLeading.button, fontWeight: 'normal' },
  buttonArrow: { fontFamily: fonts.body, color: colors.onAccent, fontSize: typeScale.h2, lineHeight: typeLeading.h2 },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  secondaryText: { fontFamily: fonts.semibold, color: colors.text, fontSize: typeScale.button, lineHeight: typeLeading.button, fontWeight: 'normal' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontFamily: fonts.body, color: colors.muted, fontSize: typeScale.small, lineHeight: typeLeading.small },
  demoNote: { fontFamily: fonts.body, color: colors.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, textAlign: 'center', marginTop: 14 },
  errorBox: { backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 16, marginTop: 6 },
  errorText: { fontFamily: fonts.body, color: colors.error, fontSize: typeScale.body, lineHeight: typeLeading.body },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
  footerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  footerText: { fontFamily: fonts.body, color: colors.muted, fontSize: typeScale.small, lineHeight: typeLeading.small, letterSpacing: 0.2 },
  loading: { alignItems: 'center', gap: 20, paddingVertical: 40 },
  successIcon: { backgroundColor: colors.greenSoft, width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  check: { fontFamily: fonts.body, color: colors.accent, fontSize: typeScale.h2, lineHeight: typeLeading.h2 },
  accountEmail: { fontFamily: fonts.body, color: colors.accent, fontSize: typeScale.body, lineHeight: typeLeading.body, marginTop: -12, marginBottom: 28 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 8, alignSelf: 'flex-start' },
  rememberCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  rememberCheckboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  rememberCheck: { fontFamily: fonts.bold, color: colors.onAccent, fontSize: typeScale.body, lineHeight: typeLeading.body, fontWeight: 'normal' },
  rememberLabel: { fontFamily: fonts.medium, color: colors.muted, fontSize: typeScale.body, lineHeight: typeLeading.body, fontWeight: 'normal' },
});
