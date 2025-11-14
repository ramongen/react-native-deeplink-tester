import React, { useCallback, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import BluetoothPrinterScreen from './BluetoothPrinterScreen';
import { printQrCode } from './HprtPrinter';

const PrintQrExample: React.FC = () => {
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(async () => {
    try {
      setPrinting(true);
      await printQrCode({
        qrContent: 'https://example.com',
        extraText: 'Thank you!',
      });
      Alert.alert('Print Started', 'QR code print command sent.');
    } catch (error: any) {
      Alert.alert('Print Failed', String(error?.message ?? error));
    } finally {
      setPrinting(false);
    }
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>HPRT Bluetooth Printer</Text>
      <Text style={styles.description}>
        Select a paired Bluetooth printer below, then press “Print Sample QR” to send a test QR
        code and message.
      </Text>
      <BluetoothPrinterScreen />
      <View style={styles.buttonContainer}>
        <Button title={printing ? 'Printing…' : 'Print Sample QR'} onPress={handlePrint} disabled={printing} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 16,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
});

export default PrintQrExample;
