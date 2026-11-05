import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState, type ComponentRef, type RefObject } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppText, Button, TextField } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { useSignupMutation } from '@/hooks/useAuthMutations';

const useStyles = makeStyles(t => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    padding: t.space.xxl,
    gap: t.space.md,
  },
  heading: {
    marginBottom: t.space.md,
    gap: t.space.xs,
  },
  birthday: {
    gap: t.space.xs,
  },
  birthdayRow: {
    flexDirection: 'row',
    gap: t.space.sm,
  },
  datePart: {
    flex: 1,
  },
  yearPart: {
    flex: 1.5,
  },
  button: {
    marginTop: t.space.sm,
  },
}));

/** `day`/`month`/`year` as YYYY-MM-DD, or null unless they make a real date between 1900 and today. */
function toDateOfBirth(day: string, month: string, year: string): string | null {
  const d = Number(day), m = Number(month), y = Number(year);
  if (!d || !m || year.length !== 4) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC rolls 30/02 over to March, so a changed day means it wasn't a real date.
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || date.getTime() > Date.now()) return null;
  return date.toISOString().slice(0, 10);
}

export default function SignupScreen() {
    const t = useTheme();
    const styles = useStyles();
    const router = useRouter();
    const { mutate: signup, isPending, error } = useSignupMutation();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [validationError, setValidationError] = useState('');

    const monthRef = useRef<ComponentRef<typeof TextInput>>(null);
    const yearRef = useRef<ComponentRef<typeof TextInput>>(null);

    // Digits only, and move on to the next part once this one is full.
    function datePartHandler(set: (v: string) => void, length: number, next?: RefObject<ComponentRef<typeof TextInput> | null>) {
        return (text: string) => {
            const digits = text.replace(/\D/g, '').slice(0, length);
            set(digits);
            if (digits.length === length) next?.current?.focus();
        };
    }

    function handleSignup() {
        if (!username.trim() || !email.trim() || !password || !day || !month || !year) {
            setValidationError('Fill in every field to get started');
            return;
        }
        if (!email.includes('@')) {
            setValidationError("That email doesn't look right");
            return;
        }
        const dateOfBirth = toDateOfBirth(day, month, year);
        if (!dateOfBirth) {
            setValidationError("That birthday doesn't look right");
            return;
        }
        setValidationError('');
        signup({ username: username.trim(), email: email.trim(), password, dateOfBirth });
    }

    const displayError = validationError || (error as Error)?.message;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <View style={styles.form}>
                    <View style={styles.heading}>
                        <AppText variant="display">Join the fun</AppText>
                        <AppText color="textSecondary">Make an account, then make your avatar.</AppText>
                    </View>

                    <TextField
                        leftIcon="person-outline"
                        placeholder="Username"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="username-new"
                        value={username}
                        onChangeText={setUsername}
                    />
                    <TextField
                        leftIcon="mail-outline"
                        placeholder="Email"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                    <TextField
                        leftIcon="lock-closed-outline"
                        placeholder="Password"
                        autoComplete="new-password"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        right={
                            <Pressable
                                onPress={() => setShowPassword(prev => !prev)}
                                hitSlop={8}
                                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={20}
                                    color={t.colors.textSecondary}
                                />
                            </Pressable>
                        }
                    />

                    <View style={styles.birthday}>
                        <AppText variant="label" color="textSecondary">Birthday · only you can see this</AppText>
                        <View style={styles.birthdayRow}>
                            <TextField
                                placeholder="DD"
                                keyboardType="number-pad"
                                maxLength={2}
                                value={day}
                                onChangeText={datePartHandler(setDay, 2, monthRef)}
                                containerStyle={styles.datePart}
                                accessibilityLabel="Birth day"
                            />
                            <TextField
                                ref={monthRef}
                                placeholder="MM"
                                keyboardType="number-pad"
                                maxLength={2}
                                value={month}
                                onChangeText={datePartHandler(setMonth, 2, yearRef)}
                                containerStyle={styles.datePart}
                                accessibilityLabel="Birth month"
                            />
                            <TextField
                                ref={yearRef}
                                placeholder="YYYY"
                                keyboardType="number-pad"
                                maxLength={4}
                                value={year}
                                onChangeText={datePartHandler(setYear, 4)}
                                onSubmitEditing={handleSignup}
                                containerStyle={styles.yearPart}
                                accessibilityLabel="Birth year"
                            />
                        </View>
                    </View>

                    {displayError ? <AppText variant="label" color="error">{displayError}</AppText> : null}

                    <Button title="Create account" size="lg" fullWidth loading={isPending} onPress={handleSignup} style={styles.button} />
                    <Button title="I already have an account" variant="ghost" fullWidth onPress={() => router.back()} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
