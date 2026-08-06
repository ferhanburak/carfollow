import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LocalizedPressable as Pressable, LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/localized-text';
import { firebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/providers/auth-provider';
import { useAppLanguage } from '@/providers/language-provider';
import { colors, createThemedStyles, fonts } from '@/theme/colors';

type AuthTab = 'login' | 'register';

const initialRegisterForm = {
  email: '',
  password: '',
  fullName: '',
  plate: '',
  model: '',
  odometer: '',
  vehicleType: 'car' as 'car' | 'motorcycle',
  termsAccepted: false,
};

export default function LoginScreen() {
  const router = useRouter();
  const { clearError, error, login, register } = useAuth();
  const { language, setLanguage, t } = useAppLanguage();
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [localError, setLocalError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const changeTab = (nextTab: AuthTab) => {
    void Haptics.selectionAsync();
    clearError();
    setLocalError('');
    setResetNotice('');
    setTab(nextTab);
  };

  const resetPassword = async () => {
    const accountEmail = email.trim();
    setResetNotice('');
    if (!accountEmail) {
      setLocalError(t('auth.resetEmailRequired'));
      return;
    }

    setResettingPassword(true);
    setLocalError('');
    try {
      await sendPasswordResetEmail(firebaseAuth, accountEmail);
      setResetNotice(t('auth.resetSent'));
    } catch {
      setLocalError(t('auth.resetError'));
    } finally {
      setResettingPassword(false);
    }
  };

  const submitLogin = async () => {
    if (!email.trim() || !password) {
      setLocalError(t('auth.errorRequired'));
      return;
    }
    setSubmitting(true);
    setLocalError('');
    const succeeded = await login(email, password);
    setSubmitting(false);
    if (succeeded) router.replace('/(tabs)/forum');
  };

  const submitRegister = async () => {
    const odometer = Number(registerForm.odometer);
    if (
      !registerForm.email.trim() ||
      !registerForm.password ||
      !registerForm.fullName.trim() ||
      !registerForm.plate.trim() ||
      !registerForm.model.trim() ||
      registerForm.odometer.trim() === ''
    ) {
      setLocalError(t('auth.errorRequired'));
      return;
    }
    if (registerForm.password.length < 8) {
      setLocalError(t('auth.errorPassword'));
      return;
    }
    if (!Number.isFinite(odometer) || odometer < 0) {
      setLocalError(t('auth.errorOdometer'));
      return;
    }
    if (!registerForm.termsAccepted) {
      setLocalError(t('auth.errorConsent'));
      return;
    }

    setSubmitting(true);
    setLocalError('');
    const succeeded = await register({ ...registerForm, odometer });
    setSubmitting(false);
    if (succeeded) router.replace('/(tabs)/forum');
  };

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundRaised, colors.background]}
      style={styles.root}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.languageSwitcher}>
                {(['tr', 'en'] as const).map((option) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: language === option }}
                    key={option}
                    onPress={() => setLanguage(option)}
                    style={({ pressed }) => [
                      styles.languageOption,
                      language === option && styles.languageOptionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[
                      styles.languageOptionText,
                      language === option && styles.languageOptionTextActive,
                    ]}>
                      {option.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.logoFrame}>
                <Image
                  contentFit="contain"
                  source={require('../../../assets/images/cruiser-road-mark.png')}
                  style={styles.logo}
                />
              </View>
              <Text style={styles.eyebrow}>{t('auth.eyebrow')}</Text>
              <Text style={styles.heroTitle}>{t('auth.heroTitle')}</Text>
              <Text style={styles.heroCopy}>{t('auth.heroCopy')}</Text>
            </View>

            <View style={styles.panel}>
              <View style={styles.tabs}>
                <TabButton active={tab === 'login'} label={t('auth.login')} onPress={() => changeTab('login')} />
                <TabButton active={tab === 'register'} label={t('auth.register')} onPress={() => changeTab('register')} />
              </View>

              {tab === 'login' ? (
                <View style={styles.form}>
                  <Field
                    autoCapitalize="none"
                    keyboardType="email-address"
                    label={t('auth.email')}
                    onChangeText={setEmail}
                    placeholder="surucu@ornek.com"
                    value={email}
                  />
                  <Field
                    label={t('auth.password')}
                    onChangeText={setPassword}
                    placeholder={t('auth.passwordPlaceholder')}
                    secureTextEntry
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={resettingPassword}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      void resetPassword();
                    }}
                    style={({ pressed }) => [
                      styles.forgotButton,
                      pressed && styles.pressed,
                      resettingPassword && styles.disabled,
                    ]}
                  >
                    {resettingPassword ? (
                      <ActivityIndicator color={colors.lime} size="small" />
                    ) : (
                      <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
                    )}
                  </Pressable>
                  <SubmitButton
                    icon="arrow-forward"
                    label={t('auth.enter')}
                    loading={submitting}
                    onPress={submitLogin}
                  />
                </View>
              ) : (
                <View style={styles.form}>
                  <Text style={styles.requiredHint}>
                    <Text style={styles.requiredMark}>*</Text> {t('auth.required')}
                  </Text>
                  <Field
                    autoCapitalize="none"
                    keyboardType="email-address"
                    label={t('auth.email')}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, email: value }))}
                    value={registerForm.email}
                  />
                  <Field
                    label={t('auth.fullName')}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, fullName: value }))}
                    value={registerForm.fullName}
                  />
                  <Field
                    autoCapitalize="characters"
                    label={t('auth.plate')}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, plate: value.toUpperCase() }))}
                    placeholder="06 ABC 123"
                    value={registerForm.plate}
                  />
                  <View style={styles.field}>
                    <Text style={styles.label}>{t('auth.vehicleType')}</Text>
                    <View style={styles.vehicleTypeRow}>
                      <VehicleTypeButton
                        active={registerForm.vehicleType === 'car'}
                        icon="car-sport"
                        label={t('auth.car')}
                        onPress={() => setRegisterForm((current) => ({
                          ...current,
                          vehicleType: 'car',
                        }))}
                      />
                      <VehicleTypeButton
                        active={registerForm.vehicleType === 'motorcycle'}
                        icon="bicycle"
                        label={t('auth.motorcycle')}
                        onPress={() => setRegisterForm((current) => ({
                          ...current,
                          vehicleType: 'motorcycle',
                        }))}
                      />
                    </View>
                  </View>
                  <Field
                    label={t('auth.vehicleModel')}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, model: value }))}
                    placeholder="Seat Ibiza"
                    value={registerForm.model}
                  />
                  <Field
                    keyboardType="number-pad"
                    label={t('auth.odometer')}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, odometer: value.replace(/\D/g, '') }))}
                    placeholder="12000"
                    value={registerForm.odometer}
                  />
                  <Field
                    label={t('auth.password')}
                    onChangeText={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
                    secureTextEntry
                    value={registerForm.password}
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: registerForm.termsAccepted }}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setRegisterForm((current) => ({
                        ...current,
                        termsAccepted: !current.termsAccepted,
                      }));
                    }}
                    style={({ pressed }) => [styles.consent, pressed && styles.pressed]}
                  >
                    <View style={[
                      styles.checkbox,
                      registerForm.termsAccepted && styles.checkboxActive,
                    ]}>
                      {registerForm.termsAccepted ? (
                        <Ionicons name="checkmark" size={16} color={colors.black} />
                      ) : null}
                    </View>
                    <Text style={styles.consentText}>
                      {t('auth.consent')}
                    </Text>
                  </Pressable>
                  <SubmitButton
                    icon="sparkles"
                    label={t('auth.createAccount')}
                    loading={submitting}
                    onPress={submitRegister}
                  />
                </View>
              )}

              {localError || error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={colors.rose} />
                  <Text style={styles.errorText}>{localError || error}</Text>
                </View>
              ) : null}
              {resetNotice ? (
                <View style={styles.successBox}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.lime} />
                  <Text style={styles.successText}>{resetNotice}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.lime}
        style={styles.input}
      />
    </View>
  );
}

function SubmitButton({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  loading: boolean;
  onPress: () => Promise<void>;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        void onPress();
      }}
      style={({ pressed }) => [
        styles.submit,
        pressed && styles.submitPressed,
        loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.black} />
      ) : (
        <>
          <Text style={styles.submitText}>{label}</Text>
          <Ionicons name={icon} size={19} color={colors.black} />
        </>
      )}
    </Pressable>
  );
}

function VehicleTypeButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.vehicleType,
        active && styles.vehicleTypeActive,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons color={active ? colors.black : colors.textMuted} name={icon} size={19} />
      <Text style={[
        styles.vehicleTypeText,
        active && styles.vehicleTypeTextActive,
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = createThemedStyles(() => ({
  root: { flex: 1 },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  languageSwitcher: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    padding: 3,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  languageOption: {
    minWidth: 42,
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageOptionActive: { backgroundColor: colors.lime },
  languageOptionText: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1,
  },
  languageOptionTextActive: { color: colors.black },
  logoFrame: {
    width: 94,
    height: 94,
    marginBottom: 14,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: colors.lime,
    shadowOpacity: 0.3,
    shadowRadius: 22,
  },
  logo: { width: 76, height: 76 },
  eyebrow: {
    color: colors.lime,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 3,
  },
  heroTitle: {
    marginTop: 10,
    color: colors.text,
    fontFamily: fonts.extraBold,
    fontSize: 30,
    letterSpacing: -1,
  },
  heroCopy: {
    marginTop: 7,
    maxWidth: 310,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  panel: {
    padding: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 20,
    backgroundColor: colors.backgroundRaised,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.lime,
    shadowColor: colors.lime,
    shadowOpacity: 0.32,
    shadowRadius: 14,
  },
  tabLabel: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  tabLabelActive: { color: colors.black },
  form: {
    padding: 10,
    paddingTop: 18,
    gap: 14,
  },
  requiredHint: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  requiredMark: { color: colors.rose, fontFamily: fonts.bold },
  field: { gap: 7 },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  forgotButton: {
    minHeight: 48,
    marginTop: -5,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  forgotText: {
    color: colors.lime,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  vehicleTypeRow: { flexDirection: 'row', gap: 8 },
  vehicleType: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  vehicleTypeActive: {
    borderColor: colors.lime,
    backgroundColor: colors.lime,
  },
  vehicleTypeText: {
    color: colors.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  vehicleTypeTextActive: { color: colors.black },
  consent: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: colors.lime,
    backgroundColor: colors.lime,
  },
  consentText: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  submit: {
    minHeight: 54,
    marginTop: 2,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: colors.lime,
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  submitPressed: { transform: [{ scale: 0.975 }], opacity: 0.9 },
  submitText: {
    color: colors.black,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  errorBox: {
    margin: 10,
    marginTop: 4,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.35)',
    backgroundColor: 'rgba(244,63,94,0.09)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  errorText: {
    flex: 1,
    color: '#fda4af',
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
  successBox: {
    margin: 10,
    marginTop: 4,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(163,230,53,0.35)',
    backgroundColor: 'rgba(163,230,53,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  successText: {
    flex: 1,
    color: colors.lime,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
}));
