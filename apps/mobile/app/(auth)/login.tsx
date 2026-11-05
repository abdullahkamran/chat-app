import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { AppText, Button, TextField } from '@/components/ui';
import { makeStyles, useTheme } from '@/constants/theme';
import { useLoginMutation } from '@/hooks/useAuthMutations';

const useStyles = makeStyles(t => ({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
    justifyContent: 'center',
  },
  form: {
    padding: t.space.xxl,
    gap: t.space.md,
  },
  // Stand-in art until there's a logo: three tilted tiles.
  hero: {
    flexDirection: 'row',
    gap: t.space.sm,
    marginBottom: t.space.lg,
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: t.borderWidth.thick,
    borderColor: t.colors.outline,
    ...t.shadows.sticker,
  },
  heading: {
    marginBottom: t.space.md,
    gap: t.space.xs,
  },
  button: {
    marginTop: t.space.sm,
  },
}));

export default function LoginScreen() {
    const t = useTheme();
    const styles = useStyles();
    const { mutate: login, isPending, error } = useLoginMutation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [validationError, setValidationError] = useState('');

    function handleLogin() {
        if (!username.trim() || !password.trim()) {
            setValidationError('Username and password are required');
            return;
        }
        setValidationError('');
        login({ username: username.trim(), password });
    }

    const displayError = validationError || (error as Error)?.message;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.form}>
                <View style={styles.hero}>
                    <View style={[styles.tile, { backgroundColor: t.colors.primary, transform: [{ rotate: '-8deg' }] }]}>
                        <Ionicons name="chatbubbles" size={26} color={t.colors.onPrimary} />
                    </View>
                    <View style={[styles.tile, { backgroundColor: t.colors.secondary, transform: [{ rotate: '5deg' }] }]}>
                        <Ionicons name="happy" size={26} color={t.colors.onSecondary} />
                    </View>
                    <View style={[styles.tile, { backgroundColor: t.colors.reward, transform: [{ rotate: '-3deg' }] }]}>
                        <Ionicons name="sparkles" size={26} color={t.colors.onReward} />
                    </View>
                </View>

                <View style={styles.heading}>
                    <AppText variant="display">Welcome back</AppText>
                    <AppText color="textSecondary">Sign in and come hang out.</AppText>
                </View>

                <TextField
                    leftIcon="person-outline"
                    placeholder="Username"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={username}
                    onChangeText={setUsername}
                />
                <TextField
                    leftIcon="lock-closed-outline"
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                    returnKeyType="go"
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

                {displayError ? <AppText variant="label" color="error">{displayError}</AppText> : null}

                <Button title="Log in" size="lg" fullWidth loading={isPending} onPress={handleLogin} style={styles.button} />
            </View>
        </KeyboardAvoidingView>
    );
}
