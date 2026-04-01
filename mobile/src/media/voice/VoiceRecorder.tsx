import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Alert,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import type { AuthSession } from '../../auth/session';

interface VoiceRecording {
  uri: string;
  duration: number;
  size: number;
  timestamp: string;
  isUploading: boolean;
  uploadError?: string;
  farmId?: string;
  visitId?: string;
  category?: string;
}

export const VoiceRecorder = ({
  session,
  farmId,
  visitId,
  onRecordingComplete
}: {
  session: AuthSession | null;
  farmId?: string;
  visitId?: string;
  onRecordingComplete?: () => void;
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        setPermissionGranted(granted);

        if (granted) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
        }
      } catch (err) {
        console.warn('Permission error:', err);
        setPermissionGranted(false);
      }
    })();

    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    if (!permissionGranted) {
      Alert.alert('Permission Required', 'Microphone access is required.');
      return;
    }

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = newRecording;
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      if (!uri) {
        throw new Error('No recording URI');
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error('File not found');
      }

      const newRecording: VoiceRecording = {
        uri,
        duration: 0,
        size: info.size ?? 0,
        timestamp: new Date().toISOString(),
        isUploading: false,
        farmId,
        visitId,
        category: 'voice_note',
      };

      setRecordings(prev => [newRecording, ...prev]);
      recordingRef.current = null;
      setIsRecording(false);

      onRecordingComplete?.();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      recordingRef.current = null;
      setIsRecording(false);
    }
  };

  const uploadRecording = async (item: VoiceRecording) => {
    if (!session) return;

    setRecordings(prev =>
      prev.map(r =>
        r.uri === item.uri ? { ...r, isUploading: true, uploadError: undefined } : r
      )
    );

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: item.uri,
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
      } as unknown as Blob);

      const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/voice-notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? `Upload failed (${response.status})`);
      }

      setRecordings(prev => prev.filter(r => r.uri !== item.uri));
      Alert.alert('Success', 'Voice note uploaded');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setRecordings(prev =>
        prev.map(r =>
          r.uri === item.uri ? { ...r, isUploading: false, uploadError: message } : r
        )
      );
    }
  };

  const deleteRecording = async (uri: string) => {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (e) {
      console.warn('Delete failed:', e);
    }
    setRecordings(prev => prev.filter(r => r.uri !== uri));
  };

  if (!permissionGranted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Microphone permission required</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => Alert.alert('Settings', 'Enable microphone in app settings')}
        >
          <Text style={styles.permissionButtonText}>Enable in Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Notes</Text>

      {!session ? (
        <View style={styles.centered}>
          <Text style={styles.subtext}>Sign in to record voice notes</Text>
        </View>
      ) : (
        <>
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              {isRecording ? 'Recording...' : 'Ready'}
            </Text>
            <Text style={styles.countText}>
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.controlPanel}>
            {!isRecording ? (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={startRecording}
                activeOpacity={0.7}
              >
                <Text style={styles.recordButtonText}>Start Recording</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.recordingControls}>
                <TouchableOpacity
                  style={[styles.controlButton, styles.stopButton]}
                  onPress={stopRecording}
                >
                  <Text style={styles.controlButtonText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {recordings.length > 0 && (
            <View style={styles.listContainer}>
              <Text style={styles.listTitle}>Recent Recordings</Text>
              <FlatList
                data={recordings}
                keyExtractor={item => item.uri}
                renderItem={({ item }) => (
                  <View style={styles.recordingItem}>
                    <View style={styles.recordingInfo}>
                      <Text style={styles.recordingLabel}>Voice Note</Text>
                      <Text style={styles.recordingTime}>
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>

                    <View style={styles.recordingActions}>
                      {item.isUploading ? (
                        <ActivityIndicator size="small" color="#2f5a37" />
                      ) : item.uploadError ? (
                        <Text style={styles.errorText}>{item.uploadError}</Text>
                      ) : null}

                      <TouchableOpacity
                        style={[styles.actionButton, styles.uploadButton]}
                        onPress={() => uploadRecording(item)}
                        disabled={item.isUploading}
                      >
                        <Text style={styles.actionButtonText}>
                          {item.isUploading ? 'Uploading...' : 'Upload'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => deleteRecording(item.uri)}
                      >
                        <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#1a1a1a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statusText: { fontSize: 16, fontWeight: '600' },
  countText: { fontSize: 14, color: '#666' },
  controlPanel: { alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 12, marginBottom: 20 },
  recordButton: { backgroundColor: '#2f5a37', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 25 },
  recordButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  recordingControls: { flexDirection: 'row', gap: 16 },
  controlButton: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 20 },
  stopButton: { backgroundColor: '#dc3545' },
  controlButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  listContainer: { flex: 1 },
  listTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  recordingItem: { padding: 12, backgroundColor: '#fff', borderRadius: 8 },
  recordingInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  recordingLabel: { fontSize: 16, fontWeight: '500' },
  recordingTime: { fontSize: 14, color: '#666' },
  recordingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  uploadButton: { backgroundColor: '#2f5a37' },
  deleteButton: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#ddd' },
  actionButtonText: { fontSize: 14, fontWeight: '500' },
  deleteButtonText: { color: '#dc3545' },
  separator: { height: 8 },
  errorText: { color: '#dc3545', fontSize: 14 },
  subtext: { color: '#666', fontSize: 16, textAlign: 'center' },
  permissionButton: { backgroundColor: '#2f5a37', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 12 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
