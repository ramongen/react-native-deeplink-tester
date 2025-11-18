declare module 'react-native-ble-manager' {
  export type Peripheral = {
    id: string;
    name?: string | null;
    advertising?: Record<string, unknown> | null;
    rssi?: number;
  };

  export interface StartOptions {
    showAlert?: boolean;
    restoreIdentifierKey?: string;
    queueIdentifierKey?: string;
    forceLegacy?: boolean;
  }

  export interface ScanOptions {
    numberOfMatches?: number;
    matchMode?: number;
    scanMode?: number;
    reportDelay?: number;
  }

  export interface BleManagerInterface {
    start(options?: StartOptions): Promise<void>;
    enableBluetooth(): Promise<void>;
    scan(
      serviceUUIDs: string[],
      seconds: number,
      allowDuplicates?: boolean,
      scanOptions?: ScanOptions
    ): Promise<void>;
    stopScan(): Promise<void>;
    connect(peripheralId: string): Promise<void>;
    disconnect(peripheralId: string): Promise<void>;
    isPeripheralConnected(peripheralId: string, serviceUUIDs?: string[]): Promise<boolean>;
    retrieveServices(peripheralId: string): Promise<void>;
    getBondedPeripherals(): Promise<Peripheral[]>;
    getDiscoveredPeripherals(): Promise<Peripheral[]>;
    getConnectedPeripherals(serviceUUIDs: string[]): Promise<Peripheral[]>;
    checkState(): void;
  }

  const BleManager: BleManagerInterface;
  export default BleManager;
}
