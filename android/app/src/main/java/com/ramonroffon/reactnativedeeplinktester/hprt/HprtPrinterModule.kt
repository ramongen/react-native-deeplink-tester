package com.ramonroffon.reactnativedeeplinktester.hprt

import android.app.Application
import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.lang.reflect.Method

class HprtPrinterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "HprtPrinterModule"
        private val PRINTER_HELPER_CLASS_NAMES = listOf(
            "com.prt.esc.PrinterHelper",
            "HPRTAndroidSDK.PrinterHelper",
            "HPRTPrinterSDK.PrinterHelper"
        )
    }

    private val preferences by lazy {
        reactContext.getSharedPreferences("hprt_printer", Context.MODE_PRIVATE)
    }

    private val printerHelperClass: Class<*> by lazy { resolvePrinterHelperClass() }
    private val barcodeConstant: Any? by lazy { resolveBarcodeConstant() }
    private var helperInitialized = false

    override fun getName(): String = "HprtPrinter"

    @ReactMethod
    fun printQrWithText(macAddress: String, qrContent: String, extraText: String, promise: Promise) {
        try {
            saveMac(macAddress)
            ensureHelperInitialized()
            val opened = openPortIfAvailable(macAddress)
            try {
                executePrintCommands(qrContent, extraText)
                promise.resolve(null)
            } finally {
                if (opened) {
                    closePortIfAvailable()
                }
            }
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

    private fun ensureHelperInitialized() {
        if (helperInitialized) {
            return
        }
        val application = reactContext.applicationContext as? Application
        if (application != null) {
            tryInvokeHelper("init", listOf(args(application)))
        }
        helperInitialized = true
    }

    private fun executePrintCommands(qrContent: String, extraText: String) {
        requireInvokeHelper(
            "printAreaSize",
            listOf(
                args("0", "200", "200", "100", "1"),
                args("100", "200"),
                args(0, 200, 200, 100, 1),
                args(100, 200)
            )
        )

        val qrArgsOptions = mutableListOf<Array<Any?>>()
        barcodeConstant?.let {
            qrArgsOptions.add(args(it, "0", "0", "2", "6", qrContent))
            if (it is Number) {
                qrArgsOptions.add(args(it, 0, 0, 2, 6, qrContent))
            }
        }
        qrArgsOptions.add(args("0", "0", "2", "6", qrContent))
        qrArgsOptions.add(args(0, 0, 2, 6, qrContent))
        qrArgsOptions.add(args(qrContent))

        requireInvokeHelper("PrintQR", qrArgsOptions)

        if (extraText.isNotBlank()) {
            val textArgs = listOf(args(extraText), args(extraText + "\n"))
            val printed = tryInvokeHelper("PrintText", textArgs)
            if (!printed) {
                Log.w(TAG, "PrinterHelper.PrintText not available in SDK; skipping text content")
            }
        }

        requireInvokeHelper("Form", listOf(emptyArray<Any?>()))

        requireInvokeHelper(
            "Print",
            listOf(
                emptyArray<Any?>(),
                args("1", "1"),
                args(1, 1),
                args("1")
            )
        )
    }

    private fun resolvePrinterHelperClass(): Class<*> {
        for (name in PRINTER_HELPER_CLASS_NAMES) {
            try {
                return Class.forName(name)
            } catch (_: ClassNotFoundException) {
                // Try next
            }
        }
        throw ClassNotFoundException("PrinterHelper class not found. Please ensure the SDK jar is present in libs/.")
    }

    private fun resolveBarcodeConstant(): Any? {
        return try {
            printerHelperClass.fields.firstOrNull { it.name.equals("BARCODE", ignoreCase = true) }?.get(null)
        } catch (_: Exception) {
            null
        }
    }

    private fun openPortIfAvailable(address: String): Boolean {
        val options = listOf(
            args(reactContext as Context, "Bluetooth", address),
            args("Bluetooth", address),
            args(address)
        )
        for (args in options) {
            val method = findMethodOrNull("PortOpen", args)
            if (method != null) {
                val result = method.invoke(null, *args)
                val success = isSuccessResult(result)
                if (!success) {
                    throw IllegalStateException("PrinterHelper.PortOpen failed with result $result")
                }
                return true
            }
        }
        return false
    }

    private fun closePortIfAvailable() {
        val method = findMethodOrNull("PortClose", emptyArray<Any?>())
        try {
            method?.invoke(null)
        } catch (e: Exception) {
            Log.w(TAG, "PrinterHelper.PortClose invocation failed", e)
        }
    }

    private fun requireInvokeHelper(methodName: String, options: List<Array<Any?>>) {
        if (!tryInvokeHelper(methodName, options)) {
            throw IllegalStateException("PrinterHelper.$methodName not available in SDK.")
        }
    }

    private fun tryInvokeHelper(methodName: String, options: List<Array<Any?>>): Boolean {
        for (args in options) {
            val method = findMethodOrNull(methodName, args)
            if (method != null) {
                method.invoke(null, *args)
                return true
            }
        }
        return false
    }

    private fun findMethodOrNull(methodName: String, args: Array<Any?>): Method? {
        val candidates = printerHelperClass.methods.filter { it.name.equals(methodName, ignoreCase = true) }
        for (method in candidates) {
            if (parametersMatch(method.parameterTypes, args)) {
                return method
            }
        }
        return null
    }

    private fun parametersMatch(parameterTypes: Array<Class<*>>, args: Array<Any?>): Boolean {
        if (parameterTypes.size != args.size) {
            return false
        }
        for (index in parameterTypes.indices) {
            val param = wrapPrimitive(parameterTypes[index])
            val arg = args[index]
            if (arg == null) {
                if (param.isPrimitive) {
                    return false
                }
                continue
            }
            if (!param.isAssignableFrom(arg.javaClass)) {
                if (param == String::class.java && arg is CharSequence) {
                    continue
                }
                if (Number::class.java.isAssignableFrom(param) && arg is Number) {
                    continue
                }
                if (param == Any::class.java) {
                    continue
                }
                return false
            }
        }
        return true
    }

    private fun args(vararg values: Any?): Array<Any?> = arrayOf(*values)

    private fun wrapPrimitive(clazz: Class<*>): Class<*> {
        return when (clazz) {
            java.lang.Integer.TYPE -> java.lang.Integer::class.java
            java.lang.Long.TYPE -> java.lang.Long::class.java
            java.lang.Short.TYPE -> java.lang.Short::class.java
            java.lang.Byte.TYPE -> java.lang.Byte::class.java
            java.lang.Float.TYPE -> java.lang.Float::class.java
            java.lang.Double.TYPE -> java.lang.Double::class.java
            java.lang.Boolean.TYPE -> java.lang.Boolean::class.java
            java.lang.Character.TYPE -> java.lang.Character::class.java
            else -> clazz
        }
    }

    private fun isSuccessResult(result: Any?): Boolean {
        return when (result) {
            null -> true
            is Boolean -> result
            is Number -> result.toInt() == 0
            else -> true
        }
    }

    private fun saveMac(address: String) {
        preferences.edit().putString("saved_mac", address).apply()
    }

    private fun getSavedMac(): String? = preferences.getString("saved_mac", null)
}
