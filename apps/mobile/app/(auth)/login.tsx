import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLoginMutation } from '@/hooks/useAuthMutations';
import { theme } from '@/constants/theme';

export default function LoginScreen() {
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
                <Text style={styles.title}>Sign in</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Username"
                    placeholderTextColor={theme.colors.placeholder}
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                />
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Password"
                        placeholderTextColor={theme.colors.placeholder}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                    />
                    <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(prev => !prev)}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off' : 'eye'}
                            size={20}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>

                {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleLogin}
                    disabled={isPending}
                >
                    {isPending ? (
                        <ActivityIndicator color={theme.colors.primaryText} />
                    ) : (
                        <Text style={styles.buttonText}>Log in</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
    },
    form: {
        padding: 32,
        gap: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        color: theme.colors.text,
    },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
        color: theme.colors.text,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 10,
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        fontSize: 16,
        color: theme.colors.text,
    },
    eyeIcon: {
        paddingHorizontal: 14,
    },
    error: {
        color: theme.colors.error,
        fontSize: 14,
    },
    button: {
        backgroundColor: theme.colors.primary,
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: theme.colors.primaryText,
        fontSize: 16,
        fontWeight: '600',
    },
});
