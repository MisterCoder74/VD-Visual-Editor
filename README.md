# VD-Visual-Editor

A minimalistic, yet powerful online visual HTML/CSS/JavaScript editor — think Wix Editor but lightweight and open-source. Build and design web pages visually without writing code, powered by AI-assisted code modifications.

## Project Vision

VD-Visual-Editor is designed for users who want to create custom web pages visually, with real-time preview and the ability to request AI-powered code modifications in natural language. It combines a drag-and-drop visual interface with intelligent code generation and modification.

## Key Functionalities

### 1. Visual Element Editing

**Drag & Drop Element Library**
- A comprehensive library of HTML elements organized by category:
  - **Structuring**: div, section, header, footer, nav, main, article, aside
  - **Formatting**: h1-h6, p, span, strong, em, u, code, pre, blockquote, hr
  - **Media**: img, video, audio, iframe
  - **Forms & Tables**: form, input (text, password, email, checkbox, radio), button, textarea, select, label, ul, ol, li, table, tr, td, th
  - **Content**: links, line breaks, buttons
- Drag elements directly from the library onto the canvas to add them to your page
- Support for nested elements (drop elements inside other elements to create hierarchy)
- Delete, clone, and reorder elements easily

**Visual Properties Panel**
- Select any element on the canvas to edit its properties
- Modify CSS properties in real-time:
  - Dimensions (width, height)
  - Spacing (padding, margin)
  - Colors (text color, background color)
  - Typography (font size, text alignment)
  - Display (flex, grid, block)
  - Borders (border style, border radius)
- Text content editing for text-based elements (paragraphs, headings, buttons, etc.)
- Visual element path (breadcrumb) showing the selected element's hierarchy

**Element Management**
- Select elements by clicking on them in the preview
- Visual highlighting of selected elements
- Delete unwanted elements with confirmation
- Clone elements to create duplicates
- Full undo/redo support (Ctrl+Z / Ctrl+Y) up to 20 actions

### 2. Real-Time Preview

**Live Canvas Preview**
- All changes are reflected instantly in the preview iframe
- See your design as users will see it
- Preview updates in real-time as you edit properties
- Blank canvas to start with — build from scratch

### 3. HTML Export

**Download Your Project**
- Export your complete project as a self-contained HTML file
- All CSS is inlined within the `<style>` tag
- All JavaScript is inlined within `<script>` tags
- No external dependencies — the exported file is completely standalone
- Download to your local PC with a custom filename
- Perfect for sharing, hosting, or further development

### 4. AI-Powered Code Modifications

**Conversational Design with AI Assistant**
- Use natural language to request design changes
- Examples of requests:
  - "Make the button blue and larger"
  - "Add a form field for email"
  - "Change the heading color to red"
  - "Make the text italic and bold"
  - "Add a background image"
- The AI analyzes your request and automatically updates the canvas
- All changes are applied in real-time to the preview

**Chat Interface**
- Bottom collapsible chat panel for interacting with the AI
- Send messages with natural language requests
- See the AI's responses and code modifications in the chat
- Conversation history during your session (clears on page reload)
- Support for multiline messages (max 500 characters)
- Send with button click or Ctrl+Enter shortcut

**How It Works**
- Describe what you want to change in plain English
- The AI understands your request and modifies the code
- Changes include:
  - CSS property updates (colors, sizes, fonts, spacing)
  - Adding new HTML elements
  - Removing elements
  - Changing text content
- Visual feedback shows when code is successfully updated
- Error messages explain if something went wrong

### 5. Configuration Panel

**Customize AI Behavior**
- Access settings from the toolbar to configure how the AI works
- Settings saved globally for the application:
  - **API Key**: Your OpenAI API key (stored securely in browser, never on server)
  - **Model Selection**: Choose between gpt-4o-mini, gpt-4, or gpt-4-turbo
  - **Max Tokens**: Control the length of AI responses (100-4000 tokens)
  - **Temperature**: Adjust AI creativity (0-2 scale, 0=precise, 2=creative)
  - **System Prompt**: Custom instructions for the AI (optional, up to 5000 characters)
- All settings persist between sessions

## Workflow Example

1. **Start**: Open the editor with a blank canvas
2. **Build Visually**: Drag elements from the library to create your layout
3. **Style**: Select elements and adjust colors, sizes, spacing, typography
4. **Request Changes**: Use the AI chat to request modifications ("Make the button green")
5. **Preview**: See all changes in real-time in the canvas
6. **Export**: Download your finished project as a standalone HTML file
7. **Share**: Use the HTML file anywhere — no dependencies, no installation needed

## Perfect For

- Rapid prototyping of web designs
- Non-developers who want to build custom web pages
- Designers who prefer visual editing over code
- Quick landing pages and promotional sites
- Learning web design principles
- Experimenting with HTML and CSS without memorizing syntax

---

**VD-Visual-Editor**: Where visual design meets intelligent AI assistance.
