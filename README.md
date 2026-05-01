<div align="center">
  <img src="public/icon.svg" width="128" height="128" alt="Eridian Logo" />
  <h1>Eridian</h1>
  <p><strong>The Brutalist AI Workspace for Deep Thinking & Focused Design.</strong></p>
</div>

Eridian is a local-first, high-performance sketchboard engineered for those who think in lines, shapes, and architectural logic. It strips away the clutter of modern SaaS to provide a raw, high-contrast environment where human creativity meets machine intelligence.

## 💎 The Innovation: Why Eridian?

Eridian isn't just another whiteboard. It is a **Spectral Workspace** designed for the "Local-First" era.

### 🌑 Spectral Brutalism
Inspired by architectural brutalism and high-contrast digital aesthetics, Eridian uses a signature **Spectral Yellow-Green** accent against deep blacks and frosted glass. It’s designed to eliminate UI fatigue and keep your focus entirely on the canvas.

### 🤖 AI-Integrated, Not Just AI-Adjacent
While most tools treat AI as a chat box, Eridian treats it as a **Canvas Agent**.
- **Sidebar Integration**: Access local or remote LLMs to help plan, structure, and generate ideas.
- **MCP Protocol (Model Context Protocol)**: Eridian exposes a standard SSE server on port `3333`. This allows external terminal agents (like Gemini CLI or Claude) to "see" and "draw" on your canvas in real-time.

### 🏠 Local-First & Sovereign
Your data never leaves your machine. Eridian uses a local SQLite backbone for storage, ensuring that your most sensitive plans, designs, and notes remain under your total control.

---

## 🎯 Who is it for?

- **Systems Architects**: Visualize complex logic flows with zero friction.
- **Creative Thinkers**: Map out ideas in a focused, minimalist environment.
- **Developers**: Use AI agents to programmatically draw diagrams and plan sprints.
- **Designers**: Prototype layouts and import PDFs for annotation without cloud lag.

---

## 🚀 How to Use

### 🖥️ Desktop (Electron)
For the most robust experience, run Eridian as a native desktop app.
1. Download the latest release for Windows, Mac, or Linux.
2. Launch to enjoy native performance, local file system access, and the built-in MCP server.

### 📱 iPad & Mobile (PWA)
Eridian is fully optimized as a Progressive Web App.
1. Open Eridian in **Safari** on your iPad.
2. Tap **Share** → **Add to Home Screen**.
3. Launch from your home screen for a full-screen, native-feel experience with `black-translucent` status bars.

### ⚡ AI Tooling
- **PDF Annotation**: Drag and drop any PDF into the canvas to start sketching over it.
- **Command Palette**: Press `Ctrl/Cmd + K` to search through your local workspace or trigger AI actions.
- **Agent Connection**: Point your terminal agents to `http://localhost:3333/sse` to give them control over your sketchboard.

---

## 🛠️ Technical Stack

- **Core**: Next.js 15 (Turbopack)
- **Canvas Engine**: Excalidraw (Heavily Custom Styled)
- **Desktop**: Electron with SSE MCP Server
- **Styling**: Vanilla CSS with Brutalist Tokens
- **Database**: Node.js SQLite (Experimental Sync)

---

## 📜 License

Eridian is built with a focus on privacy and user sovereignty. See [LICENSE](LICENSE) for details.

---

*“Focused thought requires a focused canvas.” — The Eridian Philosophy*
