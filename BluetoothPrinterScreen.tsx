import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BluetoothDeviceInfo,
  ensureBluetoothPermissions,
  getSavedPrinterMac,
  listBluetoothDevices,
  savePrinterMac,
} from './HprtPrinter';

const BluetoothPrinterScreen: React.FC = () => {
  const [devices, setDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [savedMac, setSavedMac] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const hasPermission = await ensureBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Bluetooth permissions are required to list printers.');
        return;
      }
      const list = await listBluetoothDevices();
      setDevices(list);
    } catch (error: any) {
      Alert.alert('Error', String(error?.message ?? error));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSavedMac = useCallback(async () => {
    const mac = await getSavedPrinterMac();
    setSavedMac(mac);
  }, []);

  useEffect(() => {
    loadSavedMac();
    loadDevices();
  }, [loadDevices, loadSavedMac]);

  const handleSelect = useCallback(async (device: BluetoothDeviceInfo) => {
    try {
      await savePrinterMac(device.address);
      setSavedMac(device.address);
      Alert.alert('Printer Saved', `${device.name ?? 'Printer'} selected.`);
    } catch (error: any) {
      Alert.alert('Error', String(error?.message ?? error));
    }
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: BluetoothDeviceInfo }) => {
      const isSelected = savedMac?.toLowerCase() === item.address.toLowerCase();
      return (
        <TouchableOpacity
          style={[styles.deviceItem, isSelected ? styles.deviceItemSelected : null]}
          onPress={() => handleSelect(item)}
        >
          <Text style={styles.deviceName}>{item.name || 'Unknown'}</Text>
          <Text style={styles.deviceAddress}>{item.address}</Text>
          {isSelected ? <Text style={styles.selectedLabel}>Saved</Text> : null}
        </TouchableOpacity>
      );
    },
    [handleSelect, savedMac]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Bluetooth Printers</Text>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.address}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDevices} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No paired Bluetooth printers found.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  deviceItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
  },
  deviceItemSelected: {
    borderColor: '#4C6FFF',
    backgroundColor: '#EDF2FF',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  deviceAddress: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  selectedLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
  },
  emptyState: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});

export default BluetoothPrinterScreen;
