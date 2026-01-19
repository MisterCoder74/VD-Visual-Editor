/**
 * VD-Visual-Editor Core
 */

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
    static renderToHTML(node, isSelectedId) {
        const styleString = Object.entries(node.styles || {})
            .map(([k, v]) => `${k}:${v}`)
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
        this.init();
    }

    init() {
        this.canvas.render(this.state);
        
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
