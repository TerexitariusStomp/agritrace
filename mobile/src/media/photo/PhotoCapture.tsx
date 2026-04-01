import React, { useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  StyleSheet,
  Alert,
  FlatList,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import type { AuthSession } from '../../auth/session';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

const CATEGORIES = ['people', 'tools', 'plants', 'place_before', 'place_after'] as const;
type Category = typeof CATEGORIES[number];

interface CapturedPhoto {
  uri: string;
  fileName: string;
  mimeType: string;
  size: number;
  timestamp: string;
  category: Category;
  isUploading: boolean;
  uploadProgress: number;
  uploadError?: string;
}

interface PhotoCaptureProps {
  session: AuthSession | null;
  onPhotoCaptured?: () => void;
  farmId?: string;
  visitId?: string;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({ 
  session, 
  onPhotoCaptured,
  farmId,
  visitId
}) => {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category>('people');
  const [isCapturing, setIsCapturing] = useState(false);

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo?.uri) {
        throw new Error('No photo URI returned');
      }

      const info = await FileSystem.getInfoAsync(photo.uri);
      if (!info.exists) {
        throw new Error('Photo file not found');
      }

      const mimeType = photo.uri.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const extension = mimeType === 'image/png' ? '.png' : '.jpg';

      const newPhoto: CapturedPhoto = {
        uri: photo.uri,
        fileName: `photo_${Date.now()}${extension}`,
        mimeType,
        size: info.size ?? 0,
        timestamp: new Date().toISOString(),
        category: selectedCategory,
        isUploading: false,
        uploadProgress: 0
      };

      setCapturedPhotos(prev => [newPhoto, ...prev]);
      
      if (onPhotoCaptured) {
        onPhotoCaptured();
      }
    } catch (error) {
      console.error('Failed to take picture:', error);
      Alert.alert('Camera Error', 'Failed to take picture. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, selectedCategory, onPhotoCaptured]);

  const uploadPhoto = useCallback(async (photo: CapturedPhoto, index: number) => {
    if (!session) {
      Alert.alert('Error', 'Please sign in to upload photos');
      return;
    }
    
    setCapturedPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isUploading: true, uploadProgress: 0, uploadError: undefined };
      return updated;
    });

    try {
      const formData = new FormData();
      
      formData.append('file', {
        uri: Platform.OS === 'ios' ? photo.uri.replace('file://', '') : photo.uri,
        name: photo.fileName,
        type: photo.mimeType
      } as any);
      
      formData.append('category', photo.category);
      
      if (farmId) formData.append('farmId', farmId);
      if (visitId) formData.append('visitId', visitId);

      const response = await fetch(`${API_BASE_URL}/media/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error ?? `Upload failed (${response.status})`);
      }

      setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
      Alert.alert('Success', 'Photo uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setCapturedPhotos(prev => {
        const updated = [...prev];
        updated[index] = { 
          ...updated[index], 
          isUploading: false, 
          uploadError: errorMessage 
        };
        return updated;
      });
      Alert.alert('Upload Error', 'Failed to upload photo. Please try again.');
    }
  }, [session, farmId, visitId]);

  const deletePhoto = useCallback((index: number) => {
    setCapturedPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  const cycleCategory = useCallback(() => {
    setSelectedCategory(prev => {
      const currentIndex = CATEGORIES.indexOf(prev);
      const nextIndex = (currentIndex + 1) % CATEGORIES.length;
      return CATEGORIES[nextIndex];
    });
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing(prev => prev === 'back' ? 'front' : 'back');
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Camera permission is required to take photos.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.sessionText}>Please sign in to capture photos</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Photo Capture</Text>
        <TouchableOpacity style={styles.categoryButton} onPress={cycleCategory}>
          <Text style={styles.categoryText}>
            Category: {selectedCategory.replace('_', ' ')}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView 
          ref={cameraRef} 
          style={styles.camera}
          facing={facing}
        />
        
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleFacing}>
            <Text style={styles.controlButtonText}>Flip</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]} 
            onPress={takePicture}
            disabled={isCapturing}
          >
            <Text style={styles.captureButtonText}>
              {isCapturing ? '...' : 'Capture'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {capturedPhotos.length > 0 && (
        <View style={styles.photosSection}>
          <Text style={styles.photosTitle}>
            {capturedPhotos.length} photo{capturedPhotos.length !== 1 ? 's' : ''} captured
          </Text>
          
          <FlatList
            data={capturedPhotos}
            keyExtractor={(item, index) => `${item.timestamp}-${index}`}
            renderItem={({ item, index }) => (
              <View style={styles.photoCard}>
                <Image 
                  source={{ uri: item.uri }} 
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                
                <View style={styles.photoInfo}>
                  <Text style={styles.photoCategory}>{item.category.replace('_', ' ')}</Text>
                  <Text style={styles.photoTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.photoActions}>
                  {item.isUploading ? (
                    <View style={styles.uploadingContainer}>
                      <ActivityIndicator size="small" color="#007aff" />
                      <Text style={styles.uploadProgressText}>{item.uploadProgress}%</Text>
                    </View>
                  ) : item.uploadError ? (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{item.uploadError}</Text>
                      <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => uploadPhoto(item, index)}
                      >
                        <Text style={styles.retryButtonText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.uploadButton}
                      onPress={() => uploadPhoto(item, index)}
                    >
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => deletePhoto(index)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.photoList}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666'
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    color: '#666'
  },
  sessionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666'
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold'
  },
  categoryButton: {
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 8
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500'
  },
  cameraContainer: {
    flex: 1
  },
  camera: {
    flex: 1
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  controlButton: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600'
  },
  captureButton: {
    padding: 16,
    backgroundColor: '#007aff',
    borderRadius: 30,
    minWidth: 100,
    alignItems: 'center'
  },
  captureButtonDisabled: {
    backgroundColor: '#999'
  },
  captureButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff'
  },
  photosSection: {
    maxHeight: 300,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: '600',
    padding: 12
  },
  photoList: {
    paddingHorizontal: 12,
    paddingBottom: 12
  },
  photoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden'
  },
  photoPreview: {
    width: '100%',
    height: 150
  },
  photoInfo: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  photoCategory: {
    fontSize: 14,
    fontWeight: '500'
  },
  photoTime: {
    fontSize: 12,
    color: '#888'
  },
  photoActions: {
    padding: 12,
    paddingTop: 0,
    flexDirection: 'row',
    gap: 8
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  uploadProgressText: {
    fontSize: 12,
    color: '#666'
  },
  errorContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    flex: 1
  },
  retryButton: {
    padding: 6,
    backgroundColor: '#007aff',
    borderRadius: 4
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  uploadButton: {
    padding: 8,
    backgroundColor: '#007aff',
    borderRadius: 6,
    alignItems: 'center',
    flex: 1
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#ff4444',
    borderRadius: 6,
    alignItems: 'center',
    flex: 1
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  separator: {
    height: 8
  },
  button: {
    padding: 12,
    backgroundColor: '#007aff',
    borderRadius: 8,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  }
});
