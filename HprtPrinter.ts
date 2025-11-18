import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type NativeModule,
} from 'react-native';
import BleManager, { type Peripheral } from 'react-native-ble-manager';

export type BluetoothDeviceInfo = {
  name: string;
  address: string;
};

type PrintOptions = {
  printerMacAddress?: string;
  qrContent: string;
  extraText: string;
};

type AndroidPermission =
  (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];

type HprtPrinterNativeModule = {
  printQrWithText(macAddress: string, qrContent: string, extraText: string): Promise<void>;
  savePrinterMac(address: string): Promise<void>;
  getSavedPrinterMac(): Promise<string | null>;
};

const NativeHprtPrinter = NativeModules.HprtPrinter as HprtPrinterNativeModule | undefined;
const NativeBleManager = NativeModules.BleManager as NativeModule | undefined;

if (!NativeHprtPrinter) {
  throw new Error('HprtPrinter native module not found.');
}

if (!NativeBleManager) {
  throw new Error('BleManager native module not found. Please install react-native-ble-manager.');
}

const HprtPrinter = NativeHprtPrinter;
const BleManagerEmitter = new NativeEventEmitter(NativeBleManager);

let bleManagerStarted = false;

const SCAN_DURATION_SECONDS = 8;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBleManagerStarted(): Promise<void> {
  if (!bleManagerStarted) {
    await BleManager.start({ showAlert: false });
    bleManagerStarted = true;
  }
}

async function ensureBleReady(): Promise<void> {
  await ensureBleManagerStarted();
  if (Platform.OS === 'android') {
    await BleManager.enableBluetooth();
  }
}

function mapPeripheral(peripheral: Peripheral | undefined | null): BluetoothDeviceInfo | null {
  if (!peripheral?.id) {
    return null;
  }
  return {
    name: peripheral.name ?? 'Unknown',
    address: peripheral.id,
  };
}

async function collectBondedDevices(store: Map<string, BluetoothDeviceInfo>): Promise<void> {
  try {
    const bonded = await BleManager.getBondedPeripherals();
    bonded?.forEach((peripheral) => {
      const mapped = mapPeripheral(peripheral);
      if (mapped) {
        store.set(mapped.address, mapped);
      }
    });
  } catch (error) {
    console.warn('Unable to read bonded peripherals', error);
  }
}

async function ensurePeripheralConnection(address: string): Promise<void> {
  const granted = await ensureBluetoothPermissions();
  if (!granted) {
    throw new Error('Bluetooth permissions not granted');
  }
  await ensureBleReady();
  const isConnected = await BleManager.isPeripheralConnected(address, []).catch(() => false);
  if (!isConnected) {
    await BleManager.connect(address);
    await BleManager.retrieveServices(address).catch(() => undefined);
    await delay(500);
  }
}

export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const permissions: AndroidPermission[] = [
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ];
  if (Platform.Version >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
  }

  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function listBluetoothDevices(): Promise<BluetoothDeviceInfo[]> {
  const granted = await ensureBluetoothPermissions();
  if (!granted) {
    throw new Error('Bluetooth permissions not granted');
  }
  await ensureBleReady();

  const discovered = new Map<string, BluetoothDeviceInfo>();

  const handlePeripheral = (peripheral: Peripheral) => {
    const mapped = mapPeripheral(peripheral);
    if (mapped) {
      discovered.set(mapped.address, mapped);
    }
  };

  const discoveryListener = BleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handlePeripheral);
  const connectListener = BleManagerEmitter.addListener('BleManagerConnectPeripheral', handlePeripheral);

  try {
    await BleManager.scan([], SCAN_DURATION_SECONDS, true);
    await delay((SCAN_DURATION_SECONDS + 1) * 1000);
  } finally {
    discoveryListener.remove();
    connectListener.remove();
    try {
      await BleManager.stopScan();
    } catch (_) {
      // ignored
    }
  }

  const cached = await BleManager.getDiscoveredPeripherals().catch(() => []);
  cached?.forEach(handlePeripheral);

  await collectBondedDevices(discovered);

  const saved = await getSavedPrinterMac();
  if (saved && !discovered.has(saved)) {
    discovered.set(saved, {
      name: 'Saved Printer',
      address: saved,
    });
  }

  return Array.from(discovered.values());
}

export async function connectPrinter(macAddress: string): Promise<void> {
  await ensurePeripheralConnection(macAddress);
}

export async function savePrinterMac(address: string): Promise<void> {
  await HprtPrinter.savePrinterMac(address);
}

export async function getSavedPrinterMac(): Promise<string | null> {
  return HprtPrinter.getSavedPrinterMac();
}

export async function printQrCode({
  printerMacAddress,
  qrContent,
  extraText,
}: PrintOptions): Promise<void> {
  const savedMac = printerMacAddress ?? (await getSavedPrinterMac());
  if (!savedMac) {
    throw new Error('No printer MAC address saved.');
  }
  await ensurePeripheralConnection(savedMac);
  await HprtPrinter.printQrWithText(savedMac, qrContent, extraText);
}
