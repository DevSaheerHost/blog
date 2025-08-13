import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';

const NUM_COLUMNS = 3;
const IMAGE_SPACING = 2;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ITEM_SIZE = Math.floor(
  (SCREEN_WIDTH - IMAGE_SPACING * (NUM_COLUMNS + 1)) / NUM_COLUMNS
);

type ScreenName = 'gallery' | 'camera' | 'viewer';

export default function App() {
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(
    null
  );
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState<boolean>(false);
  const [screen, setScreen] = useState<ScreenName>('gallery');
  const [selectedAsset, setSelectedAsset] = useState<MediaLibrary.Asset | null>(
    null
  );

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      const current = await MediaLibrary.getPermissionsAsync();
      if (current.status !== 'granted') {
        const result = await MediaLibrary.requestPermissionsAsync();
        setHasMediaPermission(result.granted);
      } else {
        setHasMediaPermission(true);
      }
    })();
  }, []);

  const loadInitialAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const first = 60;
      const result = await MediaLibrary.getAssetsAsync({
        first,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: MediaLibrary.MediaType.photo,
      });
      setAssets(result.assets);
      setEndCursor(result.endCursor ?? null);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      Alert.alert('Error', 'Failed to load photos.');
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  const loadMoreAssets = useCallback(async () => {
    if (!hasNextPage || isLoadingAssets) return;
    setIsLoadingAssets(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 60,
        sortBy: [MediaLibrary.SortBy.creationTime],
        mediaType: MediaLibrary.MediaType.photo,
        after: endCursor ?? undefined,
      });
      setAssets((prev) => [...prev, ...result.assets]);
      setEndCursor(result.endCursor ?? null);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      Alert.alert('Error', 'Failed to load more photos.');
    } finally {
      setIsLoadingAssets(false);
    }
  }, [endCursor, hasNextPage, isLoadingAssets]);

  const refreshAssets = useCallback(async () => {
    setEndCursor(null);
    setHasNextPage(true);
    await loadInitialAssets();
  }, [loadInitialAssets]);

  useEffect(() => {
    if (hasMediaPermission) {
      loadInitialAssets();
    }
  }, [hasMediaPermission, loadInitialAssets]);

  const openCamera = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not supported', 'Camera is not supported on web in this demo.');
      return;
    }
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Permission required', 'Camera access is needed to take photos.');
        return;
      }
    }
    setScreen('camera');
  }, [cameraPermission, requestCameraPermission]);

  const onSelectAsset = useCallback((asset: MediaLibrary.Asset) => {
    setSelectedAsset(asset);
    setScreen('viewer');
  }, []);

  const onShareSelected = useCallback(async () => {
    if (!selectedAsset) return;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Unavailable', 'Sharing is not available on this platform.');
        return;
      }
      await Sharing.shareAsync(selectedAsset.uri);
    } catch (error) {
      Alert.alert('Share failed', 'Unable to share this photo.');
    }
  }, [selectedAsset]);

  const onDeleteSelected = useCallback(async () => {
    if (!selectedAsset) return;
    try {
      await MediaLibrary.deleteAssetsAsync([selectedAsset.id]);
      setAssets((prev) => prev.filter((a) => a.id !== selectedAsset.id));
      setSelectedAsset(null);
      setScreen('gallery');
    } catch (error) {
      Alert.alert('Delete failed', 'Unable to delete this photo.');
    }
  }, [selectedAsset]);

  if (hasMediaPermission === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.mutedText}>Checking permissions…</Text>
      </SafeAreaView>
    );
  }

  if (hasMediaPermission === false) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>Permission needed</Text>
        <Text style={styles.mutedText}>
          Allow photo library access in system settings to view and save photos.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {screen === 'gallery' && (
        <View style={styles.flex}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>My Gallery</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={refreshAssets}>
                <Text style={styles.headerButtonText}>Refresh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerButton, styles.primaryButton]}
                onPress={openCamera}
              >
                <Text style={[styles.headerButtonText, styles.primaryButtonText]}>Camera</Text>
              </TouchableOpacity>
            </View>
          </View>

          {assets.length === 0 && !isLoadingAssets ? (
            <View style={styles.centered}>
              <Text style={styles.mutedText}>No photos yet</Text>
            </View>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(item) => item.id}
              numColumns={NUM_COLUMNS}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => onSelectAsset(item)}
                  style={{ margin: IMAGE_SPACING }}
                >
                  <Image
                    source={{ uri: item.uri }}
                    style={{
                      width: ITEM_SIZE,
                      height: ITEM_SIZE,
                      backgroundColor: '#eee',
                      borderRadius: 6,
                    }}
                    contentFit="cover"
                    transition={100}
                  />
                </TouchableOpacity>
              )}
              onEndReachedThreshold={0.3}
              onEndReached={loadMoreAssets}
              ListFooterComponent={
                isLoadingAssets ? <ActivityIndicator style={{ padding: 16 }} /> : null
              }
              contentContainerStyle={{ padding: IMAGE_SPACING }}
            />
          )}
        </View>
      )}

      {screen === 'camera' && (
        <CameraScreen
          onClose={() => setScreen('gallery')}
          onShotSaved={async () => {
            await refreshAssets();
            setScreen('gallery');
          }}
        />
      )}

      {screen === 'viewer' && selectedAsset && (
        <View style={styles.flex}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedAsset(null);
                setScreen('gallery');
              }}
              style={styles.viewerAction}
            >
              <Text style={styles.headerButtonText}>Back</Text>
            </TouchableOpacity>

            <View style={styles.viewerActionRow}>
              <TouchableOpacity onPress={onShareSelected} style={styles.viewerAction}>
                <Text style={styles.headerButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDeleteSelected} style={styles.viewerAction}>
                <Text style={[styles.headerButtonText, { color: '#d9534f' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.viewerBody}>
            <Image source={{ uri: selectedAsset.uri }} style={styles.viewerImage} contentFit="contain" />
          </View>
        </View>
      )}

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

interface CameraScreenProps {
  onClose: () => void;
  onShotSaved: () => Promise<void> | void;
}

const CameraScreen: React.FC<CameraScreenProps> = ({ onClose, onShotSaved }) => {
  const cameraRef = useRef<CameraView | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Camera is not supported on web.</Text>
        <TouchableOpacity style={[styles.headerButton, styles.primaryButton]} onPress={onClose}>
          <Text style={[styles.headerButtonText, styles.primaryButtonText]}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.mutedText}>Grant camera permission to continue.</Text>
        <TouchableOpacity
          style={[styles.headerButton, styles.primaryButton]}
          onPress={requestPermission as any}
        >
          <Text style={[styles.headerButtonText, styles.primaryButtonText]}>Grant</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton} onPress={onClose}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const onTakeShot = async () => {
    if (isSaving) return;
    try {
      const camera = cameraRef.current;
      if (!camera) return;

      // Take a picture and save it to the device library
      const photo = await camera.takePictureAsync();
      if (!photo?.uri) return;

      setIsSaving(true);
      await MediaLibrary.saveToLibraryAsync(photo.uri);
      await onShotSaved();
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />

      <View style={styles.cameraOverlay}>
        <TouchableOpacity style={styles.roundButton} onPress={onClose}>
          <Text style={styles.roundButtonText}>✕</Text>
        </TouchableOpacity>

        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.smallRoundButton}
            onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.roundButtonText}>↺</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={onTakeShot}>
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <View style={styles.smallRoundButtonSpacer} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  mutedText: {
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  headerButtonText: {
    fontSize: 14,
    color: '#111827',
  },
  primaryButtonText: {
    color: '#fff',
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  viewerAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginLeft: 8,
  },
  viewerActionRow: {
    flexDirection: 'row',
  },
  viewerBody: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 24,
  },
  roundButton: {
    alignSelf: 'flex-start',
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(17,24,39,0.6)',
    borderRadius: 999,
  },
  roundButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraControls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  smallRoundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(17,24,39,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallRoundButtonSpacer: {
    width: 44,
    height: 44,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
  },
});
