import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AuthSession } from '../auth/session';

interface Farm {
  id: string;
  name: string;
}

interface Visit {
  id: string;
  type: string;
  scheduledAt: string;
}

export interface FarmVisitSelectorProps {
  session: AuthSession | null;
  selectedFarmId?: string;
  selectedVisitId?: string;
  onFarmChange: (farmId: string | undefined) => void;
  onVisitChange: (visitId: string | undefined) => void;
}

const MOCK_FARMS: Farm[] = [
  { id: 'farm-1', name: 'Green Valley Farm' },
  { id: 'farm-2', name: 'Sunrise Orchard' },
  { id: 'farm-3', name: 'Hillside Gardens' },
];

const MOCK_VISITS: Record<string, Visit[]> = {
  'farm-1': [
    { id: 'visit-1', type: 'ethics', scheduledAt: '2026-04-01T10:00:00Z' },
    { id: 'visit-2', type: 'peer_evaluation', scheduledAt: '2026-04-05T14:00:00Z' },
  ],
  'farm-2': [
    { id: 'visit-3', type: 'surprise', scheduledAt: '2026-04-02T09:00:00Z' },
  ],
  'farm-3': [],
};

async function fetchFarms(session: AuthSession | null): Promise<Farm[]> {
  if (!session?.accessToken) {
    return MOCK_FARMS;
  }
  try {
    const response = await fetch('http://10.0.2.2:3000/farms', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to fetch farms');
    return response.json();
  } catch {
    return MOCK_FARMS;
  }
}

async function fetchVisits(
  session: AuthSession | null,
  farmId: string,
): Promise<Visit[]> {
  if (!session?.accessToken) {
    return MOCK_VISITS[farmId] ?? [];
  }
  try {
    const response = await fetch(
      `http://10.0.2.2:3000/visits?farmId=${farmId}`,
      {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      },
    );
    if (!response.ok) throw new Error('Failed to fetch visits');
    return response.json();
  } catch {
    return MOCK_VISITS[farmId] ?? [];
  }
}

function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatVisitType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function FarmVisitSelector({
  session,
  selectedFarmId,
  selectedVisitId,
  onFarmChange,
  onVisitChange,
}: FarmVisitSelectorProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [loadingVisits, setLoadingVisits] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingFarms(true);
    fetchFarms(session).then((data) => {
      if (!cancelled) {
        setFarms(data);
        setLoadingFarms(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!selectedFarmId) {
      setVisits([]);
      return;
    }
    let cancelled = false;
    setLoadingVisits(true);
    fetchVisits(session, selectedFarmId).then((data) => {
      if (!cancelled) {
        setVisits(data);
        setLoadingVisits(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, selectedFarmId]);

  const handleFarmSelect = (farmId: string | undefined) => {
    onFarmChange(farmId);
    onVisitChange(undefined);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionLabel}>Farm</Text>
      {loadingFarms ? (
        <ActivityIndicator color="#2f5a37" />
      ) : (
        <View style={styles.card}>
          <TouchableOpacity
            style={[
              styles.optionRow,
              !selectedFarmId && styles.optionRowSelected,
            ]}
            onPress={() => handleFarmSelect(undefined)}
          >
            <Text
              style={[
                styles.optionText,
                !selectedFarmId && styles.optionTextSelected,
              ]}
            >
              No farm selected
            </Text>
            {!selectedFarmId && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <View style={styles.divider} />
          <FlatList
            data={farms}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionRow,
                  selectedFarmId === item.id && styles.optionRowSelected,
                ]}
                onPress={() => handleFarmSelect(item.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedFarmId === item.id && styles.optionTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
                {selectedFarmId === item.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <Text style={styles.sectionLabel}>Visit</Text>
      {!selectedFarmId ? (
        <Text style={styles.hintText}>Select a farm first to see visits</Text>
      ) : loadingVisits ? (
        <ActivityIndicator color="#2f5a37" />
      ) : visits.length === 0 ? (
        <View style={styles.card}>
          <TouchableOpacity
            style={[
              styles.optionRow,
              !selectedVisitId && styles.optionRowSelected,
            ]}
            onPress={() => onVisitChange(undefined)}
          >
            <Text
              style={[
                styles.optionText,
                !selectedVisitId && styles.optionTextSelected,
              ]}
            >
              No visit selected
            </Text>
            {!selectedVisitId && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <TouchableOpacity
            style={[
              styles.optionRow,
              !selectedVisitId && styles.optionRowSelected,
            ]}
            onPress={() => onVisitChange(undefined)}
          >
            <Text
              style={[
                styles.optionText,
                !selectedVisitId && styles.optionTextSelected,
              ]}
            >
              No visit selected
            </Text>
            {!selectedVisitId && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <View style={styles.divider} />
          <FlatList
            data={visits}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.optionRow,
                  selectedVisitId === item.id && styles.optionRowSelected,
                ]}
                onPress={() => onVisitChange(item.id)}
              >
                <View style={styles.visitInfo}>
                  <Text
                    style={[
                      styles.optionText,
                      selectedVisitId === item.id && styles.optionTextSelected,
                    ]}
                  >
                    {formatVisitType(item.type)}
                  </Text>
                  <Text style={styles.visitDate}>
                    {formatVisitDate(item.scheduledAt)}
                  </Text>
                </View>
                {selectedVisitId === item.id && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2f5a37',
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionRowSelected: {
    backgroundColor: '#e8f0ea',
  },
  optionText: {
    fontSize: 15,
    color: '#333',
  },
  optionTextSelected: {
    color: '#2f5a37',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#2f5a37',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  hintText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    marginLeft: 4,
  },
  visitInfo: {
    flex: 1,
  },
  visitDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
