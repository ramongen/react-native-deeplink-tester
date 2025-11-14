import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

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
  connectBluetooth(address: string): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getBluetoothDevices(): Promise<BluetoothDeviceInfo[]>;
  printQrWithText(macAddress: string, qrContent: string, extraText: string): Promise<void>;
  savePrinterMac(address: string): Promise<void>;
  getSavedPrinterMac(): Promise<string | null>;
};

const { HprtPrinter } = NativeModules as { HprtPrinter: HprtPrinterNativeModule };

if (!HprtPrinter) {
  throw new Error('HprtPrinter native module not found.');
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
  const devices = await HprtPrinter.getBluetoothDevices();
  return devices ?? [];
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
  await HprtPrinter.printQrWithText(savedMac, qrContent, extraText);
}
