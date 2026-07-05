package ai.jaidea

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.ui.Messages
import java.net.HttpURLConnection
import java.net.URL

class JaicodeFixAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val selectedText = editor.selectionModel.selectedText ?: return

        try {
            val url = URL("http://localhost:3003/api/chat")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true

            val body = """{"message":"Fix: $selectedText","mode":"debug"}""".trimIndent()
            conn.outputStream.use { it.write(body.toByteArray()) }

            if (conn.responseCode == 200) {
                val response = conn.inputStream.bufferedReader().readText()
                Messages.showInfoMessage("Jaicode: $response", "Jaicode Fix")
            }
        } catch (ex: Exception) {
            Messages.showErrorDialog("Jaicode backend not running: ${ex.message}", "Error")
        }
    }
}
