import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';

export interface MediaItem {
  id: string;
  type: 'photo' | 'voice';
  uri: string;
  category: string;
  farmId?: string;
  farmName?: string;
  visitId?: string;
  visitType?: string;
  size: number;
  timestamp: string;
  mimeType: string;
}

interface MediaPreviewProps {
  items: MediaItem[];
  onRemove: (id: string) => void;
  onUploadAll: () => Promise<void>;
  isUploading: boolean;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  items,
  onRemove,
  onUploadAll,
  isUploading,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const playSound = async (item: MediaItem) => {
    try {
      if (playingId === item.id && sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingId(null);
        return;
      }

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync({ uri: item.uri });
      setSound(newSound);
      setPlayingId(item.id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          newSound.unloadAsync().catch(() => {});
          setSound(null);
          setPlayingId(null);
        }
      });

      await newSound.playAsync();
    } catch (error) {
      console.error('Playback error:', error);
      setPlayingId(null);
    }
  };

  const renderItem = ({ item }: { item: MediaItem }) => (
    <View style={styles.itemCard}>
      {item.type === 'photo' ? (
        <Image source={{ uri: item.uri }} style={styles.photoPreview} resizeMode="cover" />
      ) : (
        <TouchableOpacity
          style={[
            styles.voicePlayer,
            playingId === item.id && styles.voicePlayerActive,
          ]}
          onPress={() => playSound(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.voiceIcon}>{playingId === item.id ? '⏸' : '▶'}</Text>
          <Text style={styles.voiceLabel}>
            {playingId === item.id ? 'Playing...' : 'Tap to play'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.metadata}>
        <View style={styles.metaRow}>
          <Text style={styles.categoryBadge}>{item.category}</Text>
          <Text style={styles.typeLabel}>{item.type === 'photo' ? 'Photo' : 'Voice'}</Text>
        </View>

        {item.farmName && (
          <Text style={styles.metaText}>Farm: {item.farmName}</Text>
        )}
        {item.visitType && (
          <Text style={styles.metaText}>Visit: {item.visitType}</Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaDetail}>{formatFileSize(item.size)}</Text>
          <Text style={styles.metaDetail}>{formatTimestamp(item.timestamp)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemove(item.id)}
        activeOpacity={0.6}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No media to preview</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {items.length} item{items.length !== 1 ? 's' : ''} ready
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
        onPress={onUploadAll}
        disabled={isUploading}
        activeOpacity={0.7}
      >
        {isUploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadButtonText}>Upload All ({items.length})</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  separator: {
    height: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 200,
  },
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f0f4f0',
    gap: 12,
  },
  voicePlayerActive: {
    backgroundColor: '#e0ebe0',
  },
  voiceIcon: {
    fontSize: 24,
    color: '#2f5a37',
  },
  voiceLabel: {
    fontSize: 16,
    color: '#2f5a37',
    fontWeight: '500',
  },
  metadata: {
    padding: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2f5a37',
    backgroundColor: '#e8f0e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: 'capitalize',
  },
  typeLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
  },
  metaText: {
    fontSize: 14,
    color: '#444',
    marginTop: 6,
  },
  metaDetail: {
    fontSize: 12,
    color: '#888',
    marginTop: 6,
  },
  removeButton: {
    margin: 12,
    marginTop: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc3545',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadButton: {
    margin: 16,
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: '#2f5a37',
    borderRadius: 12,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#6a8a6f',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});
