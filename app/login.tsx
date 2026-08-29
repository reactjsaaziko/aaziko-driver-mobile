import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginServiceProvider } from '@/services/auth';

const BLUE = '#12A5E5';
const ERROR = '#D64545';
const BORDER = '#E6E8EB';
const PLACEHOLDER = '#9AA0A6';
const TEXT = '#22262A';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onLogin = async () => {
    if (submitting) return;
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    try {
      setSubmitting(true);
      const result = await loginServiceProvider(email, password);
      if (result.success) {
        router.replace('/orders');
      } else {
        setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.illustration}>
            <Image
              source={require('@/assets/images/delivery.png')}
              style={styles.illustrationImage}
              contentFit="contain"
            />
          </View>

          <View style={styles.form}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={PLACEHOLDER}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              style={styles.input}
              editable={!submitting}
            />

            <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.passwordInput}
                editable={!submitting}
                onSubmitEditing={onLogin}
                returnKeyType="go"
              />
              <TouchableOpacity
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={10}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color={PLACEHOLDER}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.adminLink} hitSlop={8}>
              <Text style={styles.adminLinkText}>Connect with Admin</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={onLogin}
            disabled={submitting}
            style={({ pressed }) => [
              styles.button,
              { opacity: pressed || submitting ? 0.85 : 1 },
            ]}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log in</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  illustration: {
    width: '100%',
    height: 250,
    marginBottom: 44,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  form: {
    width: '100%',
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 18,
    fontSize: 16,
    color: TEXT,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT,
    height: '100%',
  },
  adminLink: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  adminLinkText: {
    color: BLUE,
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F5C6C6',
    backgroundColor: '#FDECEC',
  },
  errorText: {
    flex: 1,
    color: ERROR,
    fontSize: 14,
  },
  button: {
    height: 56,
    borderRadius: 8,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 44,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
