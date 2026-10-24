# Epic Pen (Rust + Tauri)

A high-performance, lightweight screen annotation and live presentation tool for macOS, inspired by **Epic Pen**. Built with **Rust** for native system window control and **Tauri v2 + HTML5 Canvas** for smooth vector ink rendering.

![Epic Pen Preview](src-tauri/icons/icon.png)

---

## ✨ Features

- 🖥️ **Transparent Fullscreen Canvas**: Draw, write, and highlight directly over any macOS application, presentation, or desktop.
- 🖱️ **Click-Through (Cursor Mode)**: Switch seamlessly between Draw Mode and Mouse Mode. In Cursor Mode, your clicks pass straight through to macOS apps underneath while keeping your drawings visible.
- ✍️ **Drawing Tools**:
  - **Pen**: Freehand drawing with smooth quadratic Bézier curve interpolation.
  - **Pressure Sensitivity**: Full stylus/Apple Pencil, graphics tablet, Mac Force Touch trackpad, and velocity tapering support with toggle on toolbar.
  - **Highlighter**: Semi-transparent highlighter with smooth color blending.
  - **Eraser**: Rub out strokes easily.
  - **Shapes**: Straight Line, Arrow with arrowhead, Rectangle, and Ellipse/Circle.
- 🎨 **Palette & Sizing**:
  - 8 quick-access vibrant colors (Red, Orange, Yellow, Green, Sky Blue, Purple, White, Black).
  - 4 stroke widths (Fine 3px, Medium 6px, Thick 12px, Heavy 20px).
- 🧑‍🏫 **Teaching Board Modes**:
  - Desktop Mode (transparent overlay).
  - Whiteboard Mode (solid white background).
  - Blackboard Mode (solid dark chalkboard background).
- 🔄 **Undo & Redo**: Full action history stack.
- 🧹 **Clear Screen**: One-click screen wipe.
- 👁️ **Hide / Show Ink**: Toggle visibility of all annotations instantly.
- 🪟 **Floating Draggable Toolbar**: Sleek frosted-glass floating palette with dock handle.

---

## ⚡ Performance

- **Tiny binary**: ~9.8 MB (compared to 150MB+ for Electron alternatives).
- **Near-zero idle CPU**: Uses native macOS WebKit with hardware acceleration.
- **Low Memory**: Typically runs at ~30–40 MB RAM.

---

## 🚀 Getting Started

### Prerequisites

- [Rust & Cargo](https://rustup.rs/) (installed via `rustup`)
- [Node.js](https://nodejs.org/) (v18+)

### Development

Run live development with hot reload:

```bash
npm install
npm run tauri dev
```

### Build Production Application

Generate the native macOS application bundle (`Epic Pen.app`):

```bash
npm run tauri build
```

The output application bundle is generated at:
```
src-tauri/target/release/bundle/macos/Epic Pen.app
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `1` | Switch to Cursor (Click-through) Mode |
| `2` | Switch to Pen Tool |
| `3` | Switch to Highlighter |
| `4` | Switch to Eraser |
| `Cmd + Z` | Undo |
| `Cmd + Shift + Z` | Redo |

---

## 🛠️ Architecture

- **Backend**: Rust 1.80+, Tauri v2 (`tauri`, `tao`, `wry`).
- **Frontend**: Vite, TypeScript, HTML5 Canvas 2D with Retina display scaling (`devicePixelRatio`).
- **Communication**: Tauri IPC (`emit` & `listen`) connecting the fullscreen transparent overlay window and the floating toolbar window.
