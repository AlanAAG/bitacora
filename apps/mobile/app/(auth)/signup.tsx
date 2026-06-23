import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Typography } from '../../constants/typography';

export default function SignupScreen() {
  const referralCode = useLocalSearchParams<{ ref?: string }>().ref;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    setLoading(true); setError('');
    // Referral is applied server-side in handle_new_user from this metadata, so it works
    // even with email confirmation on (no client session yet) and can't be tampered with.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, referral_code: referralCode ?? undefined } },
    });
    if (error) { setError(error.message); }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[Typography.heading, { marginBottom: Spacing.sm }]}>Crear cuenta</Text>
      <TextInput label="Nombre" value={name} onChangeText={setName} style={styles.input} />
      <TextInput label="Email" value={email} onChangeText={setEmail}
        keyboardType="email-address" autoCapitalize="none" style={styles.input} />
      <TextInput label="Contraseña" value={password} onChangeText={setPassword}
        secureTextEntry style={styles.input} />
      {referralCode ? <Text style={styles.referral}>Código de invitación: {referralCode}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button mode="contained" onPress={handleSignup} loading={loading} style={styles.btn}>
        Crear cuenta gratis
      </Button>
      <Button mode="text" onPress={() => router.back()}>Volver</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl, justifyContent: 'center', backgroundColor: Colors.surface },
  input: { marginBottom: Spacing.sm },
  btn: { marginTop: Spacing.sm, borderRadius: 50 },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  referral: { color: Colors.accent, marginBottom: Spacing.sm },
});
