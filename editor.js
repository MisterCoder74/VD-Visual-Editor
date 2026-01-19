/**
 * VD-Visual-Editor Core
 */

class Settings {
    constructor() {
        this.apiKeyStorageKey = 'vdve_apiKey';
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
        return localStorage.getItem(this.apiKeyStorageKey) || '';
    }

    setApiKeyInStorage(key) {
        if (key) {
            localStorage.setItem(this.apiKeyStorageKey, key);
        } else {
            localStorage.removeItem(this.apiKeyStorageKey);
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

    updateUI(element) {
        if (!element) {
            this.form.classList.add('hidden');
            this.breadcrumb.textContent = 'No element selected';
            return;
        }

        this.form.classList.remove('hidden');
        this.breadcrumb.textContent = this.getElementPath(element.id);

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
        // Deeply update styles to avoid losing existing ones not in the updates
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
