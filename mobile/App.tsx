import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { ApiError, apiClient } from './src/api/client';
import {
  getSession,
  clearSession,
  loginWithPassword,
  type AuthSession,
} from './src/auth/session';
import {
  getQueuedActions,
  queueLocalAction,
  flushLocalQueue,
  type QueuedAction,
} from './src/sync/queue';
import { VoiceRecorder } from './src/media/voice/VoiceRecorder';
import { PhotoCapture } from './src/media/photo/PhotoCapture';
import FarmVisitSelector from './src/media/FarmVisitSelector';

type TabKey = 'voice' | 'photo' | 'context' | 'queue';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(getSession());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginStatus, setLoginStatus] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('voice');
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [selectedFarmId, setSelectedFarmId] = useState<string | undefined>();
  const [selectedVisitId, setSelectedVisitId] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    void getQueuedActions().then((queued) => {
      if (mounted) setQueuedCount(queued.length);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async () => {
    setLoginBusy(true);
    setLoginStatus('');
    try {
      const nextSession = await loginWithPassword({ email, password });
      setSession(nextSession);
      setLoginStatus('');
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginStatus(`Login failed (${error.status}): ${error.message}`);
      } else if (error instanceof Error) {
        setLoginStatus(`Login failed: ${error.message}`);
      } else {
        setLoginStatus('Login failed');
      }
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
    setEmail('');
    setPassword('');
    setActiveTab('voice');
  };

  const handleQueueAction = async () => {
    const total = await queueLocalAction('Field update', {
      queuedBy: session?.user.id ?? 'anonymous',
      synced: false,
    });
    setQueuedCount(total);
    setSyncStatus('Action queued. Tap Sync to push to server.');
  };

  const handleSyncNow = async () => {
    setSyncBusy(true);
    try {
      const drained = await flushLocalQueue(async (action: QueuedAction) => {
        await apiClient.post(
          '/sync/actions',
          {
            actionId: action.id,
            label: action.label,
            createdAt: action.createdAt,
            payload: action.payload ?? null,
          },
          session?.accessToken,
        );
      });
      setQueuedCount((value) => Math.max(0, value - drained));
      setSyncStatus(
        drained > 0
          ? `Synced ${drained} queued action(s).`
          : 'No queued actions to sync.',
      );
    } catch (error) {
      setSyncStatus(
        error instanceof Error ? `Sync failed: ${error.message}` : 'Sync failed',
      );
    } finally {
      setSyncBusy(false);
    }
  };

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView contentContainerStyle={styles.loginContainer}>
          <Text style={styles.loginTitle}>AgriTrace</Text>
          <Text style={styles.loginSubtitle}>
            Field data capture with offline support
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              style={styles.input}
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              style={styles.input}
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loginBusy && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loginBusy}
            activeOpacity={0.8}
          >
            {loginBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {loginStatus ? (
            <Text
              style={[
                styles.statusMessage,
                loginStatus.startsWith('Login failed')
                  ? styles.errorText
                  : styles.successText,
              ]}
            >
              {loginStatus}
            </Text>
          ) : null}

          <Text style={styles.hint}>
            Register a user via the backend API first, then sign in here.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'voice', label: 'Voice', icon: '🎤' },
    { key: 'photo', label: 'Photo', icon: '📷' },
    { key: 'context', label: 'Context', icon: '📍' },
    { key: 'queue', label: 'Queue', icon: '📋' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'voice':
        return (
          <VoiceRecorder
            session={session}
            farmId={selectedFarmId}
            visitId={selectedVisitId}
          />
        );
      case 'photo':
        return (
          <PhotoCapture
            session={session}
            farmId={selectedFarmId}
            visitId={selectedVisitId}
          />
        );
      case 'context':
        return (
          <FarmVisitSelector
            session={session}
            selectedFarmId={selectedFarmId}
            selectedVisitId={selectedVisitId}
            onFarmChange={setSelectedFarmId}
            onVisitChange={setSelectedVisitId}
          />
        );
      case 'queue':
        return (
          <ScrollView contentContainerStyle={styles.queueContainer}>
            <Text style={styles.queueTitle}>Sync Queue</Text>
            <Text style={styles.queueSubtitle}>
              {queuedCount} action{queuedCount !== 1 ? 's' : ''} waiting
            </Text>

            {syncStatus ? (
              <Text
                style={[
                  styles.statusMessage,
                  syncStatus.startsWith('Sync failed')
                    ? styles.errorText
                    : styles.successText,
                ]}
              >
                {syncStatus}
              </Text>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleQueueAction}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Queue Action</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  syncBusy && styles.disabledButton,
                ]}
                onPress={handleSyncNow}
                disabled={syncBusy || queuedCount === 0}
                activeOpacity={0.8}
              >
                {syncBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sync Now</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutButtonText}>
                Sign out ({session.user.name})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AgriTrace</Text>
        <Text style={styles.headerUser}>
          {session.user.name} · {session.user.role}
        </Text>
      </View>

      <View style={styles.content}>{renderContent()}</View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabItem,
              activeTab === tab.key && styles.tabItemActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  loginContainer: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2f5a37',
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  formGroup: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  primaryButton: {
    backgroundColor: '#2f5a37',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: { opacity: 0.6 },
  statusMessage: { marginTop: 16, fontSize: 14, textAlign: 'center' },
  errorText: { color: '#dc3545' },
  successText: { color: '#2f5a37' },
  hint: {
    marginTop: 24,
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#2f5a37',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerUser: { fontSize: 13, color: '#c8e6c9', marginTop: 2 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tabItemActive: { borderTopWidth: 2, borderTopColor: '#2f5a37' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  tabLabelActive: { color: '#2f5a37', fontWeight: '600' },
  queueContainer: { padding: 24 },
  queueTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  queueSubtitle: { fontSize: 16, color: '#666', marginBottom: 16 },
  buttonRow: { gap: 12, marginTop: 16 },
  logoutButton: {
    marginTop: 32,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dc3545',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#dc3545', fontSize: 15, fontWeight: '600' },
});
