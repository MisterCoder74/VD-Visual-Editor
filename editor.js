/**
 * VD-Visual-Editor Core
 */

class Settings {
    constructor() {
        // Primary storage key (expected by the app)
        this.apiKeyStorageKey = 'openaiApiKey';
        // Legacy key used by older versions
        this.legacyApiKeyStorageKeys = ['vdve_apiKey'];
        this.defaults = {
            model: 'gpt-4o-mini',
            maxTokens: 2000,
            temperature: 0.7,
            systemPrompt: ''
        };
        this.allowedModels = ['gpt-4o-mini', 'gpt-4', 'gpt-4-turbo'];
    }

    async loadSettings() {
        try {
            const response = await fetch('get_settings.php', {
                method: 'GET',
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to load settings');
            }
            
            return result.data;
        } catch (error) {
            console.error('Failed to load settings:', error);
            return this.defaults;
        }
    }

    async saveSettings(settingsObj) {
        try {
            const response = await fetch('save_settings.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                cache: 'no-store',
                body: JSON.stringify({
                    model: settingsObj.model,
                    maxTokens: settingsObj.maxTokens,
                    temperature: settingsObj.temperature,
                    systemPrompt: settingsObj.systemPrompt
                })
            });
            
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || `HTTP error ${response.status}`);
            }
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to save settings');
            }
            
            return result.data || settingsObj;
        } catch (error) {
            throw error;
        }
    }

    getApiKeyFromStorage() {
        const primary = localStorage.getItem(this.apiKeyStorageKey);
        if (primary && primary.trim()) return primary;

        for (const legacyKey of this.legacyApiKeyStorageKeys) {
            const legacyVal = localStorage.getItem(legacyKey);
            if (legacyVal && legacyVal.trim()) {
                // Migrate forward
                localStorage.setItem(this.apiKeyStorageKey, legacyVal);
                return legacyVal;
            }
        }

        return '';
    }

    setApiKeyInStorage(key) {
        const trimmed = (key || '').trim();

        if (trimmed) {
            localStorage.setItem(this.apiKeyStorageKey, trimmed);
            for (const legacyKey of this.legacyApiKeyStorageKeys) {
                localStorage.setItem(legacyKey, trimmed);
            }
        } else {
            localStorage.removeItem(this.apiKeyStorageKey);
            for (const legacyKey of this.legacyApiKeyStorageKeys) {
                localStorage.removeItem(legacyKey);
            }
        }
    }

    isValidSettings(settingsObj) {
        const apiKey = this.getApiKeyFromStorage();
        if (!apiKey || apiKey.trim().length === 0) return false;
        if (!settingsObj || typeof settingsObj !== 'object') return false;

        const modelOk = typeof settingsObj.model === 'string' && this.allowedModels.includes(settingsObj.model);
        const maxTokensOk = Number.isInteger(settingsObj.maxTokens) && settingsObj.maxTokens >= 100 && settingsObj.maxTokens <= 4000;
        const tempOk = typeof settingsObj.temperature === 'number' && settingsObj.temperature >= 0 && settingsObj.temperature <= 2;
        const promptOk = typeof settingsObj.systemPrompt === 'string' && settingsObj.systemPrompt.length <= 5000;

        return modelOk && maxTokensOk && tempOk && promptOk;
    }
}

class ExportManager {
    constructor(editorState) {
        this.editorState = editorState;
    }

    generateHTML() {
        const baseCss = [
            'html, body { margin: 0; padding: 0; height: 100%; }',
            '* { box-sizing: border-box; }'
        ].join('\n');

        const cssRules = this.extractCSS(this.editorState.domTree);
        const bodyHTML = this.generateBodyHTML(this.editorState.domTree);

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Project</title>
    <style>
${baseCss}

${cssRules}
    </style>
</head>
<body>
${bodyHTML}
</body>
</html>`;

        return this.formatHTML(html);
    }

    normalizeStyleKey(key) {
        if (!key) return key;
        if (key.includes('-')) return key;
        return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    }

    extractCSS(node, cssMap = new Map()) {
        if (node.id && node.styles && Object.keys(node.styles).length > 0) {
            const selector = `#${node.id}`;
            const rules = Object.entries(node.styles)
                .map(([k, v]) => `    ${this.normalizeStyleKey(k)}: ${v};`)
                .join('\n');
            cssMap.set(selector, rules);
        }
        
        if (node.children) {
            node.children.forEach(child => this.extractCSS(child, cssMap));
        }
        
        if (cssMap.size === 0) {
            return '';
        }
        
        const cssLines = [];
        for (const [selector, rules] of cssMap) {
            cssLines.push(`${selector} {\n${rules}\n}`);
        }
        
        return cssLines.join('\n\n');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttr(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    generateBodyHTML(node, indent = 0) {
        const spaces = '    '.repeat(indent);
        const tag = node.tag;
        const selfClosing = ['img', 'br', 'hr', 'input'].includes(tag);
        
        let attrString = '';
        if (node.id) {
            attrString += ` id="${this.escapeAttr(node.id)}"`;
        }
        if (node.classes && node.classes.length > 0) {
            attrString += ` class="${this.escapeAttr(node.classes.join(' '))}"`;
        }
        if (node.attributes) {
            for (const [k, v] of Object.entries(node.attributes)) {
                if (v === undefined || v === null) continue;
                attrString += ` ${k}="${this.escapeAttr(String(v))}"`;
            }
        }

        let html = `${spaces}<${tag}${attrString}`;

        if (selfClosing) {
            html += ' />';
        } else {
            html += '>';

            if (node.textContent) {
                html += this.escapeHtml(node.textContent);
            }

            if (node.children && node.children.length > 0) {
                html += '\n';
                node.children.forEach(child => {
                    html += this.generateBodyHTML(child, indent + 1) + '\n';
                });
                html += spaces;
            }

            html += `</${tag}>`;
        }

        return html;
    }

    formatHTML(htmlString) {
        return htmlString;
    }

    downloadFile(htmlString, filename) {
        const blob = new Blob([htmlString], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

class ChatManager {
    constructor(editorInstance) {
        this.editor = editorInstance;
        this.settings = editorInstance.settings;
        this.state = editorInstance.state;
        this.canvas = editorInstance.canvas;
        this.conversationHistory = [];
        this.isProcessing = false;
        this.maxHistoryLength = 20;
        
        // DOM elements
        this.chatPanel = document.getElementById('chat-panel');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.chatCharCounter = document.getElementById('chat-char-counter');
        this.btnSendMessage = document.getElementById('btn-send-message');
        this.btnToggleChat = document.getElementById('btn-chat-toggle');
        this.btnCollapseChat = document.getElementById('btn-collapse-chat');
        this.btnCloseChat = document.getElementById('btn-close-chat');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateCharCounter();
    }
    
    setupEventListeners() {
        // Chat toggle button
        this.btnToggleChat.addEventListener('click', () => {
            this.toggleChat();
        });
        
        // Collapse and close buttons
        this.btnCollapseChat.addEventListener('click', () => {
            this.collapseChat();
        });
        
        this.btnCloseChat.addEventListener('click', () => {
            this.closeChat();
        });
        
        // Send message button
        this.btnSendMessage.addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Chat input events
        this.chatInput.addEventListener('input', () => {
            this.updateCharCounter();
        });
        
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    toggleChat() {
        this.chatPanel.classList.toggle('collapsed');
        
        // Update button text based on panel state
        if (this.chatPanel.classList.contains('collapsed')) {
            this.btnToggleChat.textContent = 'AI Chat';
        } else {
            this.btnToggleChat.textContent = 'Hide Chat';
        }
    }
    
    collapseChat() {
        this.chatPanel.classList.add('collapsed');
        this.btnToggleChat.textContent = 'AI Chat';
    }
    
    closeChat() {
        this.chatPanel.classList.add('collapsed');
        this.btnToggleChat.textContent = 'AI Chat';
    }
    
    updateCharCounter() {
        const length = this.chatInput.value.length;
        const maxLength = 500;
        this.chatCharCounter.textContent = `${length} / ${maxLength}`;
        
        // Update styling based on character count
        this.chatCharCounter.classList.remove('warning', 'critical');
        if (length > maxLength * 0.9) {
            this.chatCharCounter.classList.add('critical');
        } else if (length > maxLength * 0.8) {
            this.chatCharCounter.classList.add('warning');
        }
    }
    
    formatUserMessage(text) {
        return text.trim().substring(0, 500);
    }
    
    async sendMessage() {
        const message = this.formatUserMessage(this.chatInput.value);
        
        if (!message || this.isProcessing) {
            return;
        }
        
        // Check if API key is set
        const apiKey = localStorage.getItem('openaiApiKey') || this.settings.getApiKeyFromStorage();
        if (!apiKey) {
            this.addErrorMessage('Please configure your API key in Settings');
            return;
        }
        
        // Add user message to UI and history
        this.addMessageToUI('user', message);
        this.addMessageToHistory('user', message);
        
        // Clear input
        this.chatInput.value = '';
        this.updateCharCounter();
        
        // Disable input and show typing indicator
        this.setInputState(false);
        this.showTypingIndicator();
        
        try {
            this.isProcessing = true;
            
            // Build system prompt
            const systemPrompt = this.buildSystemPrompt();
            
            // Call OpenAI API
            const response = await this.callOpenAI(systemPrompt, message);
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            // Add AI response to UI and history
            this.addMessageToUI('assistant', response);
            this.addMessageToHistory('assistant', response);
            
            // Parse and apply changes
            await this.parseAndApplyChanges(response);
            
        } catch (error) {
            this.removeTypingIndicator();
            console.error('Chat error:', error);

            let errorMessage = 'An error occurred while processing your request.';

            switch (error.code) {
                case 'MISSING_LOCAL_API_KEY':
                    errorMessage = 'Please configure your API key in Settings';
                    break;
                case 'MISSING_AUTH_HEADER':
                    errorMessage = 'API key not found. Please save Settings first';
                    break;
                case 'INVALID_API_KEY':
                    errorMessage = 'Invalid API key. Please check Settings';
                    break;
                case 'RATE_LIMIT':
                    errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
                    break;
                case 'NETWORK_ERROR':
                    errorMessage = 'Network error. Please check your connection and try again.';
                    break;
                default: {
                    const msg = typeof error.message === 'string' ? error.message : '';
                    const msgLower = msg.toLowerCase();

                    if (msgLower.includes('authorization header')) {
                        errorMessage = 'API key not found. Please save Settings first';
                    } else if (msgLower.includes('invalid api key') || (msgLower.includes('api key') && msgLower.includes('invalid'))) {
                        errorMessage = 'Invalid API key. Please check Settings';
                    } else if (msgLower.includes('rate limit')) {
                        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
                    } else if (msgLower.includes('network')) {
                        errorMessage = 'Network error. Please check your connection and try again.';
                    }
                }
            }

            this.addErrorMessage(errorMessage);
        } finally {
            this.isProcessing = false;
            this.setInputState(true);
        }
    }
    
    buildSystemPrompt() {
        const canvasDescription = this.getCanvasDescription();
        let basePrompt = `You are an AI assistant for a visual HTML editor. You help users modify their canvas design by changing styles, adding elements, and adjusting layouts.

Current Canvas State:
${canvasDescription}

Instructions:
- Respond with a brief acknowledgment followed by specific code modifications
- Use this format for modifications:
  * UPDATE #element-id { property: value; }
  * ADD <element>content</element>
  * DELETE #element-id
  * SET-TEXT #element-id "New text content"
- Only modify existing elements or add new ones
- Keep CSS properties valid
- Be specific and concise in your modifications`;

        // We'll add custom system prompt when we have the settings
        return basePrompt;
    }
    
    getCanvasDescription() {
        const elements = [];
        const describeElement = (node, depth = 0) => {
            const indent = '  '.repeat(depth);
            let description = `${indent}- ${node.tag}`;
            
            if (node.id) description += ` #${node.id}`;
            if (node.textContent) description += ` text: "${node.textContent.substring(0, 50)}"`;
            if (node.styles && Object.keys(node.styles).length > 0) {
                const styleKeys = Object.keys(node.styles).slice(0, 3);
                description += ` styles: {${styleKeys.join(', ')}}`;
            }
            
            elements.push(description);
            
            if (node.children) {
                node.children.forEach(child => describeElement(child, depth + 1));
            }
        };
        
        describeElement(this.state.domTree);
        return elements.join('\n');
    }
    
    async callOpenAI(systemPrompt, userMessage) {
        const settings = await this.settings.loadSettings();
        const apiKey = localStorage.getItem('openaiApiKey') || this.settings.getApiKeyFromStorage();

        if (!apiKey) {
            const err = new Error('API key not configured');
            err.code = 'MISSING_LOCAL_API_KEY';
            throw err;
        }

        // Add custom system prompt from settings
        let fullSystemPrompt = systemPrompt;
        if (settings.systemPrompt && settings.systemPrompt.trim()) {
            fullSystemPrompt += `\n\nCustom Instructions:\n${settings.systemPrompt}`;
        }

        let response;
        try {
            response = await fetch('openai_proxy.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Cache-Control': 'no-store'
                },
                cache: 'no-store',
                body: JSON.stringify({
                    systemPrompt: fullSystemPrompt,
                    userMessage: userMessage,
                    model: settings.model || 'gpt-4o-mini',
                    maxTokens: settings.maxTokens || 2000,
                    temperature: settings.temperature || 0.7
                })
            });
        } catch (e) {
            const err = new Error('Network error');
            err.code = 'NETWORK_ERROR';
            throw err;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const msg = (errorData && errorData.error) ? String(errorData.error) : `HTTP ${response.status}`;

            const err = new Error(msg);

            if (response.status === 401) {
                if (msg.toLowerCase().includes('authorization')) {
                    err.code = 'MISSING_AUTH_HEADER';
                } else {
                    err.code = 'INVALID_API_KEY';
                }
            } else if (response.status === 429) {
                err.code = 'RATE_LIMIT';
            } else if (response.status >= 500) {
                err.code = 'OPENAI_PROXY_ERROR';
            }

            throw err;
        }

        const result = await response.json();

        if (!result.success) {
            const err = new Error(result.error || 'Unknown error from OpenAI API');
            err.code = 'OPENAI_PROXY_ERROR';
            throw err;
        }

        return result.data.response;
    }
    
    async parseAndApplyChanges(aiResponse) {
        // Parse AI response for commands
        const lines = aiResponse.split('\n');
        let appliedChanges = 0;
        let updatedElements = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // UPDATE command: UPDATE #element-id { property: value; }
            const updateMatch = trimmedLine.match(/^UPDATE\s+#(\w+)\s*\{([^}]+)\}/i);
            if (updateMatch) {
                const elementId = updateMatch[1];
                const cssProperties = updateMatch[2];
                
                if (this.updateElementStyles(elementId, cssProperties)) {
                    appliedChanges++;
                    updatedElements.push(elementId);
                }
                continue;
            }
            
            // SET-TEXT command: SET-TEXT #element-id "text content"
            const textMatch = trimmedLine.match(/^SET-TEXT\s+#(\w+)\s+"([^"]+)"/i);
            if (textMatch) {
                const elementId = textMatch[1];
                const textContent = textMatch[2];
                
                if (this.updateElementText(elementId, textContent)) {
                    appliedChanges++;
                    updatedElements.push(elementId);
                }
                continue;
            }
            
            // DELETE command: DELETE #element-id
            const deleteMatch = trimmedLine.match(/^DELETE\s+#(\w+)/i);
            if (deleteMatch) {
                const elementId = deleteMatch[1];
                
                if (this.deleteElementById(elementId)) {
                    appliedChanges++;
                }
                continue;
            }
            
            // ADD command: ADD <element>content</element>
            const addMatch = trimmedLine.match(/^ADD\s+(<[^>]+>.*<\/[^>]+>)/i);
            if (addMatch) {
                const elementHTML = addMatch[1];
                
                if (this.addElementFromHTML(elementHTML)) {
                    appliedChanges++;
                }
                continue;
            }
        }
        
        // Show success message
        if (appliedChanges > 0) {
            this.showSuccessMessage(`Applied ${appliedChanges} changes to your canvas.`);
            
            // Highlight updated elements
            this.highlightElements(updatedElements);
        } else {
            // No changes applied, just acknowledge
            this.showInfoMessage('I understand your request, but no code changes were detected. You can be more specific about what you want to modify.');
        }
    }
    
    updateElementStyles(elementId, cssProperties) {
        const element = this.state.findElementById(elementId);
        if (!element) return false;
        
        this.state.saveState();
        
        // Parse CSS properties
        const properties = cssProperties.split(';').map(prop => prop.trim()).filter(prop => prop);
        const styles = {};
        
        properties.forEach(prop => {
            const colonIndex = prop.indexOf(':');
            if (colonIndex > 0) {
                const key = prop.substring(0, colonIndex).trim();
                const value = prop.substring(colonIndex + 1).trim();
                styles[key] = value;
            }
        });
        
        this.editor.updateElement(elementId, { styles }, false);
        this.canvas.render(this.state); // Ensure canvas re-renders
        return true;
    }
    
    updateElementText(elementId, textContent) {
        const element = this.state.findElementById(elementId);
        if (!element) return false;
        
        this.state.saveState();
        this.editor.updateElement(elementId, { textContent }, false);
        this.canvas.render(this.state); // Ensure canvas re-renders
        return true;
    }
    
    deleteElementById(elementId) {
        const element = this.state.findElementById(elementId);
        if (!element || elementId === 'root-canvas') return false;
        
        this.state.saveState();
        this.state.deleteElement(elementId);
        this.canvas.render(this.state);
        return true;
    }
    
    addElementFromHTML(elementHTML) {
        try {
            // Create a temporary div to parse HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = elementHTML;
            const element = tempDiv.firstChild;
            
            if (!element || element.nodeType !== 1) return false;
            
            // Generate new ID for the element
            const newId = 'el-' + Math.random().toString(36).substr(2, 9);
            element.id = newId;
            
            // Create element object for EditorState
            const newElement = {
                tag: element.tagName.toLowerCase(),
                id: newId,
                styles: {},
                children: [],
                classes: [],
                attributes: {}
            };
            
            // Copy attributes
            for (let attr of element.attributes) {
                if (attr.name !== 'id') {
                    newElement.attributes[attr.name] = attr.value;
                }
            }
            
            // Add text content if it's a text element
            if (element.textContent && !['img', 'input', 'br', 'hr'].includes(element.tagName.toLowerCase())) {
                newElement.textContent = element.textContent;
            }
            
            this.state.saveState();
            this.state.domTree.children.push(newElement);
            this.canvas.render(this.state);
            this.editor.selectElement(newId);
            
            return true;
        } catch (error) {
            console.error('Error adding element:', error);
            return false;
        }
    }
    
    addMessageToHistory(role, content) {
        const message = {
            role: role,
            content: content,
            timestamp: Date.now()
        };
        
        this.conversationHistory.push(message);
        
        // Limit history length
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory.shift();
        }
    }
    
    getConversationHistory() {
        return this.conversationHistory;
    }
    
    clearHistory() {
        this.conversationHistory = [];
        this.chatMessages.innerHTML = `
            <div class="chat-welcome">
                <p>Hello! I'm your AI assistant. I can help you modify your canvas design. Try asking me to:</p>
                <ul>
                    <li>Change colors or fonts</li>
                    <li>Add new elements</li>
                    <li>Modify layout and spacing</li>
                    <li>Style existing elements</li>
                </ul>
                <p>Example: "Make the heading blue and increase its size"</p>
            </div>
        `;
    }
    
    addMessageToUI(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = content;
        
        messageDiv.appendChild(bubble);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    addErrorMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'error-message';
        messageDiv.textContent = content;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    addSuccessMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'success-message';
        messageDiv.textContent = content;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    showInfoMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message assistant';
        messageDiv.innerHTML = `<div class="message-bubble">${content}</div>`;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    showSuccessMessage(content) {
        this.addSuccessMessage(content);
    }
    
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typing-indicator';
        
        typingDiv.innerHTML = `
            <span>AI is thinking</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    setInputState(enabled) {
        this.chatInput.disabled = !enabled;
        this.btnSendMessage.disabled = !enabled;
        
        if (enabled) {
            this.chatInput.focus();
        }
    }
    
    highlightElements(elementIds) {
        // This would highlight elements in the canvas
        // Implementation depends on how the canvas rendering works
        // For now, we'll just show a general success message
        console.log('Highlighted elements:', elementIds);
    }
}

class EditorState {
    constructor() {
        this.domTree = {
            tag: 'div',
            id: 'root-canvas',
            styles: {
                'min-height': '100%',
                'padding': '20px',
                'background-color': '#ffffff'
            },
            children: [],
            classes: []
        };
        this.selectedElementId = null;
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 20;
    }

    saveState() {
        this.undoStack.push(JSON.stringify(this.domTree));
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push(JSON.stringify(this.domTree));
            this.domTree = JSON.parse(this.undoStack.pop());
            return true;
        }
        return false;
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push(JSON.stringify(this.domTree));
            this.domTree = JSON.parse(this.redoStack.pop());
            return true;
        }
        return false;
    }

    findElementById(id, node = this.domTree) {
        if (node.id === id) return node;
        if (node.children) {
            for (let child of node.children) {
                const found = this.findElementById(id, child);
                if (found) return found;
            }
        }
        return null;
    }

    deleteElement(id) {
        if (id === 'root-canvas') return false;
        this.saveState();
        
        const deleteFromParent = (node) => {
            if (node.children) {
                const index = node.children.findIndex(child => child.id === id);
                if (index !== -1) {
                    node.children.splice(index, 1);
                    return true;
                }
                for (let child of node.children) {
                    if (deleteFromParent(child)) return true;
                }
            }
            return false;
        };

        const success = deleteFromParent(this.domTree);
        if (success) {
            this.selectedElementId = null;
        }
        return success;
    }

    cloneElement(id) {
        const original = this.findElementById(id);
        if (!original || id === 'root-canvas') return false;
        
        this.saveState();
        const clone = JSON.parse(JSON.stringify(original));
        
        const regenerateIds = (node) => {
            node.id = 'el-' + Math.random().toString(36).substr(2, 9);
            if (node.children) {
                node.children.forEach(regenerateIds);
            }
        };
        regenerateIds(clone);

        const addToParent = (node) => {
            if (node.children) {
                const index = node.children.findIndex(child => child.id === id);
                if (index !== -1) {
                    node.children.splice(index + 1, 0, clone);
                    return true;
                }
                for (let child of node.children) {
                    if (addToParent(child)) return true;
                }
            }
            return false;
        };

        return addToParent(this.domTree);
    }
}

class DOMRenderer {
    static normalizeStyleKey(key) {
        if (!key) return key;
        if (key.includes('-')) return key;
        return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    }

    static renderToHTML(node, isSelectedId) {
        const styleString = Object.entries(node.styles || {})
            .map(([k, v]) => `${DOMRenderer.normalizeStyleKey(k)}:${v}`)
            .join(';');
        
        const classString = [...(node.classes || []), isSelectedId === node.id ? 'selected-element-highlight' : ''].join(' ').trim();
        
        let attrString = '';
        if (node.attributes) {
            attrString = Object.entries(node.attributes)
                .map(([k, v]) => `${k}="${v}"`)
                .join(' ');
        }

        const tag = node.tag;
        const selfClosing = ['img', 'br', 'hr', 'input'].includes(tag);
        
        let html = `<${tag} id="${node.id}" class="${classString}" style="${styleString}" ${attrString}`;
        
        if (selfClosing) {
            html += ' />';
        } else {
            html += '>';
            if (node.textContent) {
                html += node.textContent;
            }
            if (node.children) {
                node.children.forEach(child => {
                    html += DOMRenderer.renderToHTML(child, isSelectedId);
                });
            }
            html += `</${tag}>`;
        }
        
        return html;
    }

    static getFullHTML(rootNode, isSelectedId) {
        const content = DOMRenderer.renderToHTML(rootNode, isSelectedId);
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body, html { margin: 0; padding: 0; height: 100%; }
                    .selected-element-highlight {
                        outline: 2px solid #007acc !important;
                        outline-offset: -2px !important;
                        box-shadow: 0 0 5px rgba(0,122,204,0.5) !important;
                    }
                    [data-drag-over="true"] {
                        background-color: rgba(0, 122, 204, 0.1) !important;
                        outline: 2px dashed #007acc !important;
                    }
                    /* Ensure all elements are selectable even if empty */
                    *:empty:not(img):not(input):not(br):not(hr) {
                        min-height: 20px;
                        min-width: 20px;
                        outline: 1px dashed #ccc;
                    }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    // Media loading fallbacks
                    const createPlaceholder = (label) => {
                        const svg =
                            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">' +
                            '<rect width="100%" height="100%" fill="#f1f1f1" />' +
                            '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#666" font-family="Arial" font-size="20">' +
                            String(label) +
                            '</text>' +
                            '</svg>';
                        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
                    };

                    const IMG_PLACEHOLDER = createPlaceholder('Invalid image URL');
                    const VIDEO_POSTER_PLACEHOLDER = createPlaceholder('Invalid video URL');

                    const attachMediaFallbacks = () => {
                        document.querySelectorAll('img').forEach((img) => {
                            const currentSrc = img.getAttribute('src') || '';
                            if (!currentSrc.trim()) {
                                img.src = IMG_PLACEHOLDER;
                            }

                            img.addEventListener('error', () => {
                                img.src = IMG_PLACEHOLDER;
                            }, { once: true });

                            // If the image already errored before we attached listeners
                            if (img.complete && img.naturalWidth === 0) {
                                img.src = IMG_PLACEHOLDER;
                            }
                        });

                        document.querySelectorAll('video').forEach((video) => {
                            if (!video.hasAttribute('controls')) {
                                video.setAttribute('controls', '');
                            }

                            const currentSrc = video.getAttribute('src') || '';
                            if (!currentSrc.trim()) {
                                video.setAttribute('poster', VIDEO_POSTER_PLACEHOLDER);
                            }

                            video.addEventListener('error', () => {
                                video.setAttribute('poster', VIDEO_POSTER_PLACEHOLDER);
                            }, { once: true });

                            // If the video already errored before we attached listeners
                            if (video.error) {
                                video.setAttribute('poster', VIDEO_POSTER_PLACEHOLDER);
                            }
                        });
                    };

                    attachMediaFallbacks();

                    // Communication with parent
                    window.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const id = e.target.id;
                        if (id) {
                            window.parent.postMessage({ type: 'SELECT_ELEMENT', id: id }, '*');
                        }
                    });

                    // Drag & Drop handlers
                    window.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        const target = e.target.closest('*');
                        if (target && target.id) {
                            target.setAttribute('data-drag-over', 'true');
                        }
                    });

                    window.addEventListener('dragleave', (e) => {
                        const target = e.target.closest('*');
                        if (target) {
                            target.removeAttribute('data-drag-over');
                        }
                    });

                    window.addEventListener('drop', (e) => {
                        e.preventDefault();
                        const target = e.target.closest('*');
                        if (target) {
                            target.removeAttribute('data-drag-over');
                            const tag = e.dataTransfer.getData('text/plain');
                            const type = e.dataTransfer.getData('text/type');
                            if (tag) {
                                window.parent.postMessage({ 
                                    type: 'ADD_ELEMENT', 
                                    tag: tag, 
                                    parentId: target.id,
                                    inputType: type
                                }, '*');
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}

class ElementLibrary {
    constructor(editor) {
        this.editor = editor;
        this.init();
    }

    init() {
        document.querySelectorAll('.draggable-element').forEach(el => {
            el.setAttribute('draggable', 'true');
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', el.dataset.tag);
                if (el.dataset.type) {
                    e.dataTransfer.setData('text/type', el.dataset.type);
                }
            });

            // Handle clicking for Add Element button (Modal functionality)
            el.addEventListener('click', () => {
                if (document.getElementById('element-modal').classList.contains('hidden') === false) {
                    this.editor.addElement(el.dataset.tag, this.editor.state.selectedElementId || 'root-canvas', el.dataset.type);
                    document.getElementById('element-modal').classList.add('hidden');
                }
            });
        });
    }
}

class PropertiesPanel {
    constructor(editor) {
        this.editor = editor;
        this.inputs = {
            textContent: document.getElementById('prop-text-content'),
            width: document.getElementById('prop-width'),
            height: document.getElementById('prop-height'),
            padding: document.getElementById('prop-padding'),
            margin: document.getElementById('prop-margin'),
            color: document.getElementById('prop-color'),
            background: document.getElementById('prop-background'),
            fontSize: document.getElementById('prop-font-size'),
            textAlign: document.getElementById('prop-text-align'),
            display: document.getElementById('prop-display'),
            border: document.getElementById('prop-border'),
            borderRadius: document.getElementById('prop-border-radius')
        };
        this.breadcrumb = document.getElementById('element-breadcrumb');
        this.form = document.getElementById('properties-form');

        this.mediaSrcGroup = this.createMediaSrcField();
        this.mediaSrcLabel = this.mediaSrcGroup.querySelector('label');
        this.inputs.mediaSrc = this.mediaSrcGroup.querySelector('input');

        this.init();
    }

    init() {
        Object.entries(this.inputs).forEach(([key, input]) => {
            input.addEventListener('input', () => {
                this.updateSelectedElement(false);
            });
            input.addEventListener('change', () => {
                this.updateSelectedElement(true);
            });
        });

        document.getElementById('btn-delete-element').addEventListener('click', () => {
            if (confirm('Delete selected element?')) {
                this.editor.deleteSelected();
            }
        });

        document.getElementById('btn-clone-element').addEventListener('click', () => {
            this.editor.cloneSelected();
        });
    }

    createMediaSrcField() {
        const group = document.createElement('div');
        group.className = 'property-group hidden';
        group.id = 'prop-media-src-group';

        const label = document.createElement('label');
        label.textContent = 'Media URL';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'prop-media-src';
        input.placeholder = 'https://...';

        group.appendChild(label);
        group.appendChild(input);

        const actionsEl = this.form.querySelector('.actions');
        if (actionsEl) {
            this.form.insertBefore(group, actionsEl);
        } else {
            this.form.appendChild(group);
        }

        return group;
    }

    updateUI(element) {
        if (!element) {
            this.form.classList.add('hidden');
            this.breadcrumb.textContent = 'No element selected';
            this.mediaSrcGroup.classList.add('hidden');
            return;
        }

        this.form.classList.remove('hidden');
        this.breadcrumb.textContent = this.getElementPath(element.id);

        this.populateProperties(element);
    }

    populateProperties(element) {
        this.inputs.textContent.value = element.textContent || '';
        this.inputs.width.value = element.styles.width || '';
        this.inputs.height.value = element.styles.height || '';
        this.inputs.padding.value = element.styles.padding || '';
        this.inputs.margin.value = element.styles.margin || '';
        this.inputs.color.value = this.rgbToHex(element.styles.color) || '#000000';
        this.inputs.background.value = element.styles.background || '';
        this.inputs.fontSize.value = element.styles.fontSize || '';
        this.inputs.textAlign.value = element.styles.textAlign || '';
        this.inputs.display.value = element.styles.display || '';
        this.inputs.border.value = element.styles.border || '';
        this.inputs.borderRadius.value = element.styles.borderRadius || '';
        
        // Hide/show text content for non-text elements
        const textTags = ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'button', 'a', 'label', 'li', 'td', 'th', 'strong', 'em', 'u', 'code', 'pre', 'blockquote'];
        if (textTags.includes(element.tag)) {
            this.inputs.textContent.parentElement.classList.remove('hidden');
        } else {
            this.inputs.textContent.parentElement.classList.add('hidden');
        }

        // Media URL for img/video elements
        const isMedia = element.tag === 'img' || element.tag === 'video';
        if (isMedia) {
            this.mediaSrcGroup.classList.remove('hidden');
            this.mediaSrcLabel.textContent = element.tag === 'img' ? 'Image URL' : 'Video URL';
            this.inputs.mediaSrc.value = (element.attributes && element.attributes.src) ? element.attributes.src : '';
        } else {
            this.mediaSrcGroup.classList.add('hidden');
            this.inputs.mediaSrc.value = '';
        }
    }

    rgbToHex(col) {
        if (!col) return '#000000';
        if (col.startsWith('#')) return col;
        // Simple conversion if needed, but for now we assume it's hex or we just return it
        return col;
    }

    getElementPath(id) {
        const path = [];
        const findPath = (node, currentPath) => {
            if (node.id === id) {
                path.push(...currentPath, node.tag);
                return true;
            }
            if (node.children) {
                for (let child of node.children) {
                    if (findPath(child, [...currentPath, node.tag])) return true;
                }
            }
            return false;
        };
        findPath(this.editor.state.domTree, []);
        return path.join(' > ');
    }

    updateSelectedElement(saveState = false) {
        const id = this.editor.state.selectedElementId;
        if (!id) return;

        const element = this.editor.state.findElementById(id);
        if (!element) return;

        const updates = {
            textContent: this.inputs.textContent.value,
            styles: {
                width: this.inputs.width.value,
                height: this.inputs.height.value,
                padding: this.inputs.padding.value,
                margin: this.inputs.margin.value,
                color: this.inputs.color.value,
                background: this.inputs.background.value,
                fontSize: this.inputs.fontSize.value,
                textAlign: this.inputs.textAlign.value,
                display: this.inputs.display.value,
                border: this.inputs.border.value,
                borderRadius: this.inputs.borderRadius.value
            }
        };

        if (element.tag === 'img' || element.tag === 'video') {
            updates.attributes = {
                src: this.inputs.mediaSrc.value.trim()
            };
        }

        this.editor.updateElement(id, updates, saveState);
    }
}

class Canvas {
    constructor(editor) {
        this.editor = editor;
        this.iframe = document.getElementById('preview-frame');
        this.init();
    }

    init() {
        window.addEventListener('message', (e) => {
            if (e.data.type === 'SELECT_ELEMENT') {
                this.editor.selectElement(e.data.id);
            } else if (e.data.type === 'ADD_ELEMENT') {
                this.editor.addElement(e.data.tag, e.data.parentId, e.data.inputType);
            }
        });
    }

    render(state) {
        const html = DOMRenderer.getFullHTML(state.domTree, state.selectedElementId);
        const doc = this.iframe.contentDocument || this.iframe.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
    }
}

class Editor {
    constructor() {
        this.state = new EditorState();
        this.canvas = new Canvas(this);
        this.library = new ElementLibrary(this);
        this.propertiesPanel = new PropertiesPanel(this);
        this.settings = new Settings();
        this.exportManager = new ExportManager(this.state);
        this.chatManager = new ChatManager(this);
        this.init();
    }

    init() {
        this.canvas.render(this.state);
        
        this.initSettings();
        this.initExport();
        
        // Toolbar events
        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-clear').addEventListener('click', () => this.clearCanvas());
        document.getElementById('btn-new').addEventListener('click', () => this.clearCanvas());
        
        // Modal
        const modal = document.getElementById('element-modal');
        const btnAdd = document.getElementById('btn-add-element');
        const closeModal = document.querySelector('.close-modal');
        
        btnAdd.addEventListener('click', () => {
            const modalLibrary = document.getElementById('modal-element-library');
            modalLibrary.innerHTML = document.querySelector('.element-categories').innerHTML;
            modal.classList.remove('hidden');
            // Re-attach listeners to the cloned elements in modal
            modalLibrary.querySelectorAll('.draggable-element').forEach(el => {
                el.addEventListener('click', () => {
                    this.addElement(el.dataset.tag, this.state.selectedElementId || 'root-canvas', el.dataset.type);
                    modal.classList.add('hidden');
                });
            });
        });
        
        closeModal.addEventListener('click', () => modal.classList.add('hidden'));
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                e.preventDefault();
                this.undo();
            } else if (e.ctrlKey && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
        });

        // View options
        const previewContainer = document.getElementById('preview-container');
        document.getElementById('view-desktop').addEventListener('click', (e) => {
            previewContainer.style.width = '100%';
            this.setActiveView(e.target);
        });
        document.getElementById('view-tablet').addEventListener('click', (e) => {
            previewContainer.style.width = '768px';
            this.setActiveView(e.target);
        });
        document.getElementById('view-mobile').addEventListener('click', (e) => {
            previewContainer.style.width = '375px';
            this.setActiveView(e.target);
        });
    }

    async initSettings() {
        const modal = document.getElementById('settings-modal');
        const btnSettings = document.getElementById('btn-settings');
        const closeModal = document.querySelector('.close-settings-modal');
        const btnSave = document.getElementById('btn-save-settings');
        const btnCancel = document.getElementById('btn-cancel-settings');

        const apiKeyInput = document.getElementById('settings-api-key');
        const modelSelect = document.getElementById('settings-model');
        const maxTokensInput = document.getElementById('settings-max-tokens');
        const temperatureInput = document.getElementById('settings-temperature');
        const systemPromptTextarea = document.getElementById('settings-system-prompt');
        const statusDiv = document.getElementById('settings-status');
        const charCountSpan = document.getElementById('settings-prompt-count');
        const togglePassword = document.querySelector('.toggle-password');

        const errorMaxTokens = document.getElementById('error-max-tokens');
        const errorTemperature = document.getElementById('error-temperature');

        togglePassword.addEventListener('click', () => {
            const type = apiKeyInput.type === 'password' ? 'text' : 'password';
            apiKeyInput.type = type;
            togglePassword.textContent = type === 'password' ? 'Show' : 'Hide';
        });

        const validateForm = () => {
            const maxTokens = parseInt(maxTokensInput.value);
            const temperature = parseFloat(temperatureInput.value);
            const systemPrompt = systemPromptTextarea.value;

            let isValid = true;

            if (!this.settings.allowedModels.includes(modelSelect.value)) {
                modelSelect.classList.add('invalid');
                isValid = false;
            } else {
                modelSelect.classList.remove('invalid');
            }

            if (isNaN(maxTokens) || maxTokens < 100 || maxTokens > 4000) {
                maxTokensInput.classList.add('invalid');
                errorMaxTokens.textContent = 'Must be between 100 and 4000';
                isValid = false;
            } else {
                maxTokensInput.classList.remove('invalid');
                errorMaxTokens.textContent = '';
            }

            if (isNaN(temperature) || temperature < 0 || temperature > 2) {
                temperatureInput.classList.add('invalid');
                errorTemperature.textContent = 'Must be between 0 and 2';
                isValid = false;
            } else {
                temperatureInput.classList.remove('invalid');
                errorTemperature.textContent = '';
            }

            if (systemPrompt.length > 5000) {
                systemPromptTextarea.classList.add('invalid');
                isValid = false;
            } else {
                systemPromptTextarea.classList.remove('invalid');
            }

            btnSave.disabled = !isValid;
            return isValid;
        };

        const updatePromptCount = () => {
            const length = systemPromptTextarea.value.length;
            charCountSpan.textContent = `${length} / 5000`;
        };

        const onAnyChange = () => {
            statusDiv.classList.add('hidden');
            statusDiv.classList.remove('success', 'error');
            statusDiv.textContent = '';
            updatePromptCount();
            validateForm();
        };

        systemPromptTextarea.addEventListener('input', onAnyChange);
        maxTokensInput.addEventListener('input', onAnyChange);
        temperatureInput.addEventListener('input', onAnyChange);
        modelSelect.addEventListener('change', onAnyChange);

        btnSettings.addEventListener('click', async () => {
            statusDiv.classList.add('hidden');
            statusDiv.classList.remove('success', 'error');
            statusDiv.textContent = '';

            const storedApiKey = this.settings.getApiKeyFromStorage();
            apiKeyInput.value = storedApiKey;
            apiKeyInput.type = 'password';
            togglePassword.textContent = 'Show';

            try {
                const settings = await this.settings.loadSettings();
                modelSelect.value = settings.model || 'gpt-4o-mini';
                maxTokensInput.value = settings.maxTokens || 2000;
                temperatureInput.value = settings.temperature || 0.7;
                systemPromptTextarea.value = settings.systemPrompt || '';
                updatePromptCount();
                validateForm();
            } catch (error) {
                console.error('Error loading settings:', error);
            }

            modal.classList.remove('hidden');
        });

        const closeModalHandler = () => {
            modal.classList.add('hidden');
        };

        closeModal.addEventListener('click', closeModalHandler);
        btnCancel.addEventListener('click', closeModalHandler);

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalHandler();
            }
        });

        btnSave.addEventListener('click', async () => {
            statusDiv.classList.add('hidden');
            statusDiv.classList.remove('success', 'error');
            statusDiv.textContent = '';

            const apiKey = apiKeyInput.value.trim();
            const model = modelSelect.value;
            const maxTokens = parseInt(maxTokensInput.value);
            const temperature = parseFloat(temperatureInput.value);
            const systemPrompt = systemPromptTextarea.value;

            if (!validateForm()) {
                statusDiv.textContent = 'Please fix validation errors';
                statusDiv.classList.remove('hidden', 'success');
                statusDiv.classList.add('error');
                return;
            }

            btnSave.disabled = true;
            btnSave.textContent = 'Saving...';

            try {
                await this.settings.saveSettings({
                    model,
                    maxTokens,
                    temperature,
                    systemPrompt
                });

                this.settings.setApiKeyInStorage(apiKey);

                statusDiv.textContent = 'Settings saved successfully!';
                statusDiv.classList.remove('hidden', 'error');
                statusDiv.classList.add('success');

                setTimeout(() => {
                    closeModalHandler();
                }, 1000);
            } catch (error) {
                console.error('Error saving settings:', error);
                statusDiv.textContent = `Error: ${error.message}`;
                statusDiv.classList.remove('hidden', 'success');
                statusDiv.classList.add('error');
            } finally {
                btnSave.disabled = false;
                btnSave.textContent = 'Save Settings';
            }
        });
    }

    initExport() {
        const modal = document.getElementById('export-modal');
        const btnExport = document.getElementById('btn-export');
        const closeModal = document.querySelector('.close-export-modal');
        const btnConfirm = document.getElementById('btn-confirm-export');
        const btnCancel = document.getElementById('btn-cancel-export');
        const filenameInput = document.getElementById('export-filename');

        btnExport.addEventListener('click', () => {
            filenameInput.value = 'project.html';
            modal.classList.remove('hidden');
        });

        const closeModalHandler = () => {
            modal.classList.add('hidden');
        };

        closeModal.addEventListener('click', closeModalHandler);
        btnCancel.addEventListener('click', closeModalHandler);

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalHandler();
            }
        });

        btnConfirm.addEventListener('click', () => {
            let filename = filenameInput.value.trim();
            if (!filename) {
                filename = 'project.html';
            }
            if (!filename.endsWith('.html')) {
                filename += '.html';
            }

            try {
                const html = this.exportManager.generateHTML();
                this.exportManager.downloadFile(html, filename);
                closeModalHandler();
            } catch (error) {
                console.error('Export failed:', error);
                alert('Export failed: ' + error.message);
            }
        });
    }

    setActiveView(btn) {
        document.querySelectorAll('.view-options button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    selectElement(id) {
        this.state.selectedElementId = id;
        this.canvas.render(this.state);
        const element = this.state.findElementById(id);
        this.propertiesPanel.updateUI(element);
    }

    addElement(tag, parentId = 'root-canvas', inputType = null) {
        const parent = this.state.findElementById(parentId);
        if (!parent) return;

        this.state.saveState();
        
        const newId = 'el-' + Math.random().toString(36).substr(2, 9);
        const newElement = {
            tag: tag,
            id: newId,
            styles: {},
            children: [],
            classes: [],
            attributes: {}
        };

        if (tag === 'input' && inputType) {
            newElement.attributes.type = inputType;
        }

        // Add default text content for some tags
        const defaultText = {
            h1: 'Heading 1',
            h2: 'Heading 2',
            h3: 'Heading 3',
            p: 'Paragraph text goes here.',
            button: 'Button',
            a: 'Link',
            span: 'Span text',
            label: 'Label',
            li: 'List item'
        };
        if (defaultText[tag]) {
            newElement.textContent = defaultText[tag];
        }

        if (tag === 'img') {
            newElement.attributes.src = 'https://via.placeholder.com/150';
            newElement.styles.width = '150px';
        }

        if (!parent.children) parent.children = [];
        parent.children.push(newElement);
        
        this.state.selectedElementId = newId;
        this.canvas.render(this.state);
        this.propertiesPanel.updateUI(newElement);
    }

    updateElement(id, updates, saveState = true) {
        // Deeply update styles/attributes to avoid losing existing ones not in the updates
        const element = this.state.findElementById(id);
        if (element) {
            if (saveState) this.state.saveState();
            
            if (updates.textContent !== undefined) element.textContent = updates.textContent;

            if (updates.styles) {
                Object.entries(updates.styles).forEach(([k, v]) => {
                    if (v === '' || v === null) {
                        delete element.styles[k];
                    } else {
                        element.styles[k] = v;
                    }
                });
            }

            if (updates.attributes) {
                if (!element.attributes) element.attributes = {};
                Object.entries(updates.attributes).forEach(([k, v]) => {
                    if (v === '' || v === null || v === undefined) {
                        delete element.attributes[k];
                    } else {
                        element.attributes[k] = v;
                    }
                });
            }

            this.canvas.render(this.state);
        }
    }

    deleteSelected() {
        if (this.state.selectedElementId) {
            if (this.state.deleteElement(this.state.selectedElementId)) {
                this.canvas.render(this.state);
                this.propertiesPanel.updateUI(null);
            }
        }
    }

    cloneSelected() {
        if (this.state.selectedElementId) {
            if (this.state.cloneElement(this.state.selectedElementId)) {
                this.canvas.render(this.state);
            }
        }
    }

    clearCanvas() {
        if (confirm('Clear entire canvas?')) {
            this.state.saveState();
            this.state.domTree.children = [];
            this.state.selectedElementId = null;
            this.canvas.render(this.state);
            this.propertiesPanel.updateUI(null);
        }
    }

    undo() {
        if (this.state.undo()) {
            this.canvas.render(this.state);
            const selected = this.state.findElementById(this.state.selectedElementId);
            this.propertiesPanel.updateUI(selected);
        }
    }

    redo() {
        if (this.state.redo()) {
            this.canvas.render(this.state);
            const selected = this.state.findElementById(this.state.selectedElementId);
            this.propertiesPanel.updateUI(selected);
        }
    }
}

// Initialize Editor on load
window.addEventListener('DOMContentLoaded', () => {
    window.editor = new Editor();
});
