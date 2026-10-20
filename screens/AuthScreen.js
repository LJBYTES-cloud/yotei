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
                    <Text style={styles.cardTitle}>Session restore failed</Text>
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
                  <Text style={styles.eyebrow}>ACCOUNT</Text>
                  <Text style={styles.heading}>{isSignUp ? 'Create account' : 'Sign in'}</Text>
                  <Text style={styles.subtitle}>Access your subjects, tasks, study sessions, and review queue.</Text>
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
                        <Text style={[styles.tabText, isSignUp === signUp && styles.activeTabText]}>{signUp ? 'Create account' : 'Sign in'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.cardTitle}>{isSignUp ? 'Account details' : 'Credentials'}</Text>
                  <Text style={styles.cardDescription}>{isSignUp ? 'Enter your name, email address, and password.' : 'Enter your email address and password.'}</Text>
                  {isSignUp && <Field label="Your name" placeholder="Alex Morgan" value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={128} editable={!working} />}
                  <Field
                    label="Email address" placeholder="you@example.com"
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
                    accessibilityRole="checkbox" accessibilityLabel="Remember me"
                    accessibilityState={{ checked: rememberMe, disabled: working }}
                    disabled={working} onPress={() => setRememberMe(value => !value)}
                    style={({ pressed }) => [styles.rememberRow, pressed && styles.pressed, working && styles.disabled]}
                  >
                    <View style={[styles.rememberCheckbox, rememberMe && styles.rememberCheckboxChecked]}>
                      {rememberMe && <Text style={styles.rememberCheck}>✓</Text>}
                    </View>
                    <Text style={styles.rememberLabel}>Remember me</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button" accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
                    accessibilityState={{ disabled: working, busy: working }} disabled={working}
                    onPress={() => void authenticate()}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, working && styles.disabled]}
                  >
                    {working ? <ActivityIndicator color={colors.onAccent} /> : (
                      <><Text style={styles.primaryText}>{isSignUp ? 'Create account' : 'Sign in'}</Text><Text style={styles.buttonArrow}>↗</Text></>
                    )}
                  </Pressable>
                  {!USE_REAL_AUTH && (
                    <>
                      <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>Mock authentication</Text><View style={styles.dividerLine} /></View>
                      <Pressable accessibilityRole="button" disabled={working} accessibilityState={{ disabled: working }} onPress={() => void authenticate(true)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, working && styles.disabled]}>
                        <Text style={styles.secondaryText}>Sign in to demo</Text>
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
  brandName: { fontSize: 31, fontWeight: '700', letterSpacing: -1.5, color: colors.text },
  brandDot: { color: colors.accent },
  intro: { marginBottom: 28 },
  eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 2, color: colors.accent, marginBottom: 14 },
  heading: { fontSize: 38, lineHeight: 45, fontWeight: '700', letterSpacing: -1.6, color: colors.text, marginBottom: 14 },
  accentText: { color: colors.accent },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 22, marginTop: 6 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, backgroundColor: colors.input, marginBottom: 26 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 9, minHeight: 44 },
  activeTab: { backgroundColor: colors.raised },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  activeTabText: { color: colors.text },
  cardTitle: { color: colors.text, fontSize: 22, lineHeight: 29, fontWeight: '600', letterSpacing: -0.5 },
  cardDescription: { color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 5, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { color: colors.text, fontSize: 12, fontWeight: '600', marginBottom: 9 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.input },
  inputFocused: { borderColor: colors.accent },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: colors.text },
  showPassword: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, justifyContent: 'center' },
  showPasswordText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  primaryButton: { flexDirection: 'row', minHeight: 54, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 14, marginTop: 6, gap: 14 },
  primaryText: { color: colors.onAccent, fontSize: 15, fontWeight: '700' },
  buttonArrow: { color: colors.onAccent, fontSize: 22, lineHeight: 24 },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, fontSize: 11 },
  demoNote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14 },
  errorBox: { backgroundColor: colors.errorSoft, borderColor: colors.errorLine, borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 16, marginTop: 6 },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
  footerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent },
  footerText: { color: colors.muted, fontSize: 11, letterSpacing: 0.2 },
  loading: { alignItems: 'center', gap: 20, paddingVertical: 40 },
  successIcon: { backgroundColor: colors.greenSoft, width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  check: { color: colors.accent, fontSize: 25 },
  accountEmail: { color: colors.accent, fontSize: 15, marginTop: -12, marginBottom: 28 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginBottom: 8, alignSelf: 'flex-start' },
  rememberCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  rememberCheckboxChecked: { borderColor: colors.accent, backgroundColor: colors.accent },
  rememberCheck: { color: colors.onAccent, fontSize: 13, fontWeight: '700' },
  rememberLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
});
