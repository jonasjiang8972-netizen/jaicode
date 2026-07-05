import { render } from 'solid-js/web';
import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface AppState {
    connected: boolean;
    provider: string;
    mode: string;
    language: string;
}

function App() {
    const [messages, setMessages] = createSignal<Message[]>([]);
    const [input, setInput] = createSignal('');
    const [isStreaming, setIsStreaming] = createSignal(false);
    const [state, setState] = createSignal<AppState>({
        connected: false,
        provider: 'anthropic',
        mode: 'auto',
        language: 'zh',
    });
    const [activeTab, setActiveTab] = createSignal<'chat' | 'files' | 'git'>('chat');

    // Check backend health on mount
    onMount(async () => {
        await checkHealth();
    });

    async function checkHealth() {
        try {
            const healthy = await invoke<boolean>('check_health');
            setState(s => ({ ...s, connected: healthy }));
        } catch {
            setState(s => ({ ...s, connected: false }));
        }
    }

    async function sendMessage() {
        const text = input().trim();
        if (!text || isStreaming()) return;

        const userMsg: Message = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };
        setMessages(msgs => [...msgs, userMsg]);
        setInput('');
        setIsStreaming(true);

        try {
            // In production, this would stream from backend
            const response = await invoke<string>('proxy_chat', {
                request: {
                    message: text,
                    mode: state().mode,
                    provider: state().provider,
                    messages: messages().map(m => ({ role: m.role, content: m.content })),
                },
            });

            const assistantMsg: Message = {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: Date.now(),
            };
            setMessages(msgs => [...msgs, assistantMsg]);
        } catch (err) {
            const errorMsg: Message = {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Error: ${err}`,
                timestamp: Date.now(),
            };
            setMessages(msgs => [...msgs, errorMsg]);
        }

        setIsStreaming(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    return (
        <div class="chat-container">
            <div class="status-bar">
                <div>
                    <span class={`status-dot ${state().connected ? 'connected' : 'disconnected'}`}></span>
                    Jaicode v1.0.0
                    {state().connected ? '  ● Connected' : '  ● Disconnected'}
                </div>
                <div>
                    Mode: {state().mode.toUpperCase()} | Provider: {state().provider} | {state().language === 'zh' ? '中英' : 'EN'}
                </div>
            </div>

            <div style={{ display: 'flex', 'flex': 1, 'overflow': 'hidden' }}>
                <div class="sidebar" style={{ 'padding': '16px' }}>
                    <h3 style={{ margin: '0 0 12px', color: '#00B8D9' }}>⬡ Jaicode</h3>

                    <div class="tabs">
                        <div class={`tab ${activeTab() === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Chat</div>
                        <div class={`tab ${activeTab() === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>Files</div>
                        <div class={`tab ${activeTab() === 'git' ? 'active' : ''}`} onClick={() => setActiveTab('git')}>Git</div>
                    </div>

                    <div style={{ 'margin-top': '16px' }}>
                        <button class="btn" style={{ width: '100%', 'margin-bottom': '8px' }} onClick={checkHealth}>
                            Check Backend
                        </button>
                        <button class="btn" style={{ width: '100%' }} onClick={() => setState(s => ({ ...s, provider: s.provider === 'anthropic' ? 'openai' : 'anthropic' }))}>
                            Switch: {state().provider === 'anthropic' ? 'OpenAI' : 'Anthropic'}
                        </button>
                    </div>

                    <div style={{ 'margin-top': 'auto', 'font-size': '12px', color: '#8b949e' }}>
                        <p>Shortcuts:</p>
                        <p>Enter - Send</p>
                        <p>Shift+Enter - New line</p>
                    </div>
                </div>

                <div class="main-content">
                    <Show when={activeTab() === 'chat'}>
                        <div class="messages" style={{ 'flex': 1, 'overflow-y': 'auto', padding: '20px' }}>
                            <For each={messages()}>
                                {(msg) => (
                                    <div class={`message ${msg.role}`}>
                                        <strong>{msg.role === 'user' ? '❯ You' : msg.role === 'assistant' ? '⬡ Jaicode' : '⚙ System'}</strong>
                                        <pre style={{ 'white-space': 'pre-wrap', 'margin-top': '8px' }}>{msg.content}</pre>
                                    </div>
                                )}
                            </For>
                            <Show when={isStreaming()}>
                                <div class="message assistant">
                                    <span class="spinner"></span> Thinking...
                                </div>
                            </Show>
                        </div>

                        <div class="input-area">
                            <textarea
                                class="input-box"
                                placeholder={state().language === 'zh' ? '输入任务描述...' : 'Type a task...'}
                                value={input()}
                                onInput={(e) => setInput(e.currentTarget.value)}
                                onKeyDown={handleKeyDown}
                            />
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'margin-top': '8px' }}>
                                <div>
                                    <button class="btn" onClick={() => setState(s => ({ ...s, mode: s.mode === 'code' ? 'debug' : s.mode === 'debug' ? 'ask' : 'code' }))}>
                                        Mode: {state().mode.toUpperCase()}
                                    </button>
                                </div>
                                <button class="btn btn-primary" onClick={sendMessage} disabled={isStreaming()}>
                                    {isStreaming() ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </Show>

                    <Show when={activeTab() === 'files'}>
                        <div style={{ padding: '20px' }}>
                            <h3>File Explorer</h3>
                            <p>接入 Go 后端文件系统服务</p>
                        </div>
                    </Show>

                    <Show when={activeTab() === 'git'}>
                        <div style={{ padding: '20px' }}>
                            <h3>Git 状态</h3>
                            <p>接入 Go 后端 Git 操作</p>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
}

render(() => App(), document.getElementById('root')!);
