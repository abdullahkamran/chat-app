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
import { useLoginMutation } from '@/lib/auth';

export default function LoginScreen() {
    const { mutate: login, isPending, error } = useLoginMutation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
                    placeholderTextColor="#888"
                    autoCapitalize="none"
                    value={username}
                    onChangeText={setUsername}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#888"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                {displayError ? <Text style={styles.error}>{displayError}</Text> : null}

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleLogin}
                    disabled={isPending}
                >
                    {isPending ? (
                        <ActivityIndicator color="#fff" />
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
        backgroundColor: '#fff',
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
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
    },
    error: {
        color: '#e53e3e',
        fontSize: 14,
    },
    button: {
        backgroundColor: '#000',
        borderRadius: 10,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
