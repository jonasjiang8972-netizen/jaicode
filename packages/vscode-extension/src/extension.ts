// Jaicode VS Code Extension
// Connects VS Code to Jaicode CLI backend

import * as vscode from 'vscode'
import { execSync, spawn } from 'child_process'
import path from 'path'

let jaicodeTerminal: vscode.Terminal | undefined
let apiProcess: any = null

export function activate(context: vscode.ExtensionContext) {
    console.log('Jaicode extension activated')

    // Command: Start Jaicode session
    const startCmd = vscode.commands.registerCommand('jaicode.start', async () => {
        const config = vscode.workspace.getConfiguration('jaicode')
        const port = config.get('port', 3002)

        // Start API server if not running
        try {
            execSync(`lsof -i :${port} -t`, { stdio: 'pipe' })
        } catch {
            // Start Jaicode API server
            apiProcess = spawn('node', ['packages/api/src/server.js'], {
                cwd: path.join(__dirname, '../../..'),
                detached: true,
            })
        }

        // Open terminal with Jaicode
        if (jaicodeTerminal) {
            jaicodeTerminal.dispose()
        }

        jaicodeTerminal = vscode.createTerminal({
            name: 'Jaicode',
            cwd: vscode.workspace.rootPath,
        })

        jaicodeTerminal.sendText('jaicode')
        jaicodeTerminal.show()
    })

    // Command: Send selection to Jaicode
    const sendCmd = vscode.commands.registerCommand('jaicode.send', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return

        const selection = editor.document.getText(editor.selection)
        if (!selection) return

        // Send to Jaicode via API
        const config = vscode.workspace.getConfiguration('jaicode')
        const port = config.get('port', 3002)
        const provider = config.get('provider', 'anthropic')

        try {
            const resp = await fetch(`http://localhost:${port}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: selection,
                    mode: 'code',
                    provider,
                }),
            })

            if (resp.ok) {
                vscode.window.showInformationMessage('Sent to Jaicode')
            }
        } catch {
            vscode.window.showErrorMessage('Jaicode server not running. Run /jaicode start first.')
        }
    })

    // Command: Explain code
    const explainCmd = vscode.commands.registerCommand('jaicode.explain', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return

        const selection = editor.document.getText(editor.selection)
        if (!selection) return

        // Create webview panel with explanation
        const panel = vscode.window.createWebviewPanel(
            'jaicodeExplain',
            'Jaicode: Explain',
            vscode.ViewColumn.Beside,
            {}
        )

        panel.webview.html = getWebviewContent('Analyzing...')

        // Call Jaicode API
        const config = vscode.workspace.getConfiguration('jaicode')
        const port = config.get('port', 3002)

        try {
            const resp = await fetch(`http://localhost:${port}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Explain this code:\n\`\`\`\n${selection}\n\`\`\``,
                    mode: 'ask',
                    provider: config.get('provider', 'anthropic'),
                }),
            })

            if (resp.ok) {
                const data = await resp.json()
                panel.webview.html = getWebviewContent(data.response || 'No response')
            }
        } catch {
            panel.webview.html = getWebviewContent('Error: Jaicode server not running')
        }
    })

    // Command: Fix code
    const fixCmd = vscode.commands.registerCommand('jaicode.fix', async () => {
        const editor = vscode.window.activeTextEditor
        if (!editor) return

        const selection = editor.document.getText(editor.selection)
        if (!selection) return

        vscode.window.showInformationMessage('Fix request sent to Jaicode')
    })

    context.subscriptions.push(startCmd, sendCmd, explainCmd, fixCmd)
}

export function deactivate() {
    if (jaicodeTerminal) jaicodeTerminal.dispose()
    if (apiProcess) apiProcess.kill()
}

function getWebviewContent(content: string): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: monospace; padding: 20px; }
        pre { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h2>Jaicode</h2>
    <pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`
}
