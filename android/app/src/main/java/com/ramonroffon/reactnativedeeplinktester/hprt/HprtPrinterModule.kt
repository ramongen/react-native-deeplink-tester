package com.ramonroffon.reactnativedeeplinktester.hprt

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import HPRTAndroidSDK.HPRTPrinterHelper

class HprtPrinterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val preferences by lazy {
        reactContext.getSharedPreferences("hprt_printer", Context.MODE_PRIVATE)
    }

    private var connectedAddress: String? = null

    override fun getName(): String = "HprtPrinter"

    @ReactMethod
    fun connectBluetooth(address: String, promise: Promise) {
        try {
            val result = HPRTPrinterHelper.PortOpen(reactContext, "Bluetooth", address)
            if (result == 0) {
                connectedAddress = address
                saveMac(address)
                promise.resolve(true)
            } else {
                promise.reject("E_CONNECT", "Failed to connect to Bluetooth device: $address")
            }
        } catch (e: Exception) {
            promise.reject("E_CONNECT", e)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            HPRTPrinterHelper.PortClose()
            connectedAddress = null
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_DISCONNECT", e)
        }
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        try {
            val connected = try {
                HPRTPrinterHelper.IsOpened()
            } catch (ignored: NoSuchMethodError) {
                connectedAddress != null
            }
            promise.resolve(connected)
        } catch (e: Exception) {
            promise.reject("E_STATUS", e)
        }
    }

    @ReactMethod
    fun getBluetoothDevices(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val connectGranted = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.BLUETOOTH_CONNECT
                ) == PackageManager.PERMISSION_GRANTED
                val scanGranted = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.BLUETOOTH_SCAN
                ) == PackageManager.PERMISSION_GRANTED
                if (!connectGranted || !scanGranted) {
                    promise.reject("E_PERMISSION", "Bluetooth permissions not granted")
                    return
                }
            }
            val adapter = getBluetoothAdapter(reactContext)
            if (adapter == null) {
                promise.reject("E_ADAPTER", "Bluetooth adapter not available")
                return
            }
            val devices = WritableNativeArray()
            @SuppressLint("MissingPermission")
            val bonded: Set<BluetoothDevice>? = adapter.bondedDevices
            bonded?.forEach { device ->
                val map = WritableNativeMap()
                map.putString("name", device.name ?: "Unknown")
                map.putString("address", device.address)
                devices.pushMap(map)
            }
            promise.resolve(devices)
        } catch (e: Exception) {
            promise.reject("E_DEVICES", e)
        }
    }

    @ReactMethod
    fun printQrWithText(macAddress: String, qrContent: String, extraText: String, promise: Promise) {
        try {
            if (!ensureConnection(macAddress)) {
                promise.reject("E_CONNECT", "Unable to connect to printer: $macAddress")
                return
            }
            saveMac(macAddress)
            HPRTPrinterHelper.printAreaSize("100", "200")
            HPRTPrinterHelper.CLS()
            HPRTPrinterHelper.printQRcode("0", "0", "M", "6", "A", "0", qrContent)
            HPRTPrinterHelper.PrintText(extraText + "\n")
            HPRTPrinterHelper.Print("1", "1")
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_PRINT", e)
        }
    }

    @ReactMethod
    fun savePrinterMac(address: String, promise: Promise) {
        try {
            saveMac(address)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_SAVE", e)
        }
    }

    @ReactMethod
    fun getSavedPrinterMac(promise: Promise) {
        try {
            promise.resolve(getSavedMac())
        } catch (e: Exception) {
            promise.reject("E_GET_SAVED", e)
        }
    }

    private fun getBluetoothAdapter(context: Context): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return manager?.adapter ?: BluetoothAdapter.getDefaultAdapter()
    }

    private fun ensureConnection(macAddress: String): Boolean {
        return try {
            val isOpened = try {
                HPRTPrinterHelper.IsOpened()
            } catch (ignored: NoSuchMethodError) {
                connectedAddress != null
            }
            if (isOpened && connectedAddress.equals(macAddress, ignoreCase = true)) {
                true
            } else {
                val result = HPRTPrinterHelper.PortOpen(reactContext, "Bluetooth", macAddress)
                if (result == 0) {
                    connectedAddress = macAddress
                    true
                } else {
                    false
                }
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun saveMac(address: String) {
        preferences.edit().putString("saved_mac", address).apply()
    }

    private fun getSavedMac(): String? = preferences.getString("saved_mac", null)
}
