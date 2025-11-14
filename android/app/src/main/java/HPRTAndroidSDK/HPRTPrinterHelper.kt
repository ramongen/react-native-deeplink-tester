package HPRTAndroidSDK

import android.app.Application
import android.content.Context
import com.prt.esc.PrinterHelper
import com.prt.esc.printer.Printer

object HPRTPrinterHelper {
    private var printer: Printer? = null
    private var initialized = false

    private fun ensureInitialized(context: Context) {
        if (!initialized) {
            val application = context.applicationContext as? Application
                ?: throw IllegalStateException("Application context required")
            PrinterHelper.init(application)
            initialized = true
        }
    }

    @JvmStatic
    fun PortOpen(context: Context, portType: String, address: String): Int {
        return try {
            ensureInitialized(context)
            val printerInstance = when (portType.lowercase()) {
                "bluetooth" -> PrinterHelper.connectBT(address)
                "wifi" -> PrinterHelper.connectWifi(address)
                else -> null
            }
            if (printerInstance != null && printerInstance.isConnect()) {
                printerInstance.setLanguageEncode("UTF-8")
                printer = printerInstance
                0
            } else {
                printer = null
                -1
            }
        } catch (e: Exception) {
            printer = null
            -1
        }
    }

    @JvmStatic
    fun PortClose(): Int {
        val hadPrinter = printer != null
        val closed = try {
            printer?.closeOperator() == true
        } catch (_: Exception) {
            false
        }
        printer = null
        return if (!hadPrinter || closed) 0 else -1
    }

    @JvmStatic
    fun IsOpened(): Boolean = try {
        printer?.isConnect() == true
    } catch (_: Exception) {
        false
    }

    @JvmStatic
    fun printAreaSize(width: String, height: String) {
        val w = width.toDoubleOrNull()?.let { (it * 8).toInt() }
            ?: width.toIntOrNull() ?: 0
        val h = height.toDoubleOrNull()?.let { (it * 8).toInt() }
            ?: height.toIntOrNull() ?: 0
        printer?.addSelectPageMode()
        printer?.addPageModePrintArea(0, 0, w, h)
    }

    @JvmStatic
    fun CLS() {
        printer?.addClearPageModePrintAreaData()
    }

    private fun mapErrorCorrection(level: String): Int = when (level.uppercase()) {
        "L" -> 0
        "M" -> 1
        "Q" -> 2
        "H" -> 3
        else -> 1
    }

    @JvmStatic
    fun printQRcode(
        x: String,
        y: String,
        errorLevel: String,
        width: String,
        rotate: String,
        reference: String,
        content: String
    ) {
        val posX = x.toIntOrNull() ?: 0
        val posY = y.toIntOrNull() ?: 0
        val moduleSize = width.toIntOrNull() ?: 4
        val ecc = mapErrorCorrection(errorLevel)
        val version = reference.toIntOrNull() ?: 0
        printer?.addPageModeAbsolutePosition(posX, posY)
        printer?.addQRCode(content, moduleSize, ecc, version)
    }

    @JvmStatic
    fun PrintText(text: String) {
        printer?.addData(text)
    }

    @JvmStatic
    fun Print(x: String, y: String) {
        val feed = y.toIntOrNull() ?: 0
        if (feed > 0) {
            printer?.addFeedLine(feed)
        }
        printer?.addPrintPageModeData()
        printer?.print()
    }
}
