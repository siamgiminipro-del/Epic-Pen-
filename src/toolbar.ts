import { emit } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Tool, BoardMode } from "./overlay";

export function initToolbar() {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="toolbar" class="toolbar-container">
      <!-- Drag Handle -->
      <div class="drag-handle" data-tauri-drag-region title="Drag toolbar">
        <div class="drag-bar" data-tauri-drag-region></div>
      </div>

      <!-- Main Tools -->
      <button id="btn-cursor" class="tool-btn" data-tool="cursor" title="Mouse / Cursor Mode (Click-through)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          <path d="m13 13 6 6"/>
        </svg>
      </button>

      <button id="btn-pen" class="tool-btn active" data-tool="pen" title="Pen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          <path d="M2 2l7.586 7.586"/>
          <circle cx="11" cy="11" r="2"/>
        </svg>
      </button>

      <button id="btn-highlighter" class="tool-btn" data-tool="highlighter" title="Highlighter">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="m9 11-6 6v3h3l6-6"/>
          <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
        </svg>
      </button>

      <button id="btn-eraser" class="tool-btn" data-tool="eraser" title="Eraser">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
          <path d="M22 21H7"/>
          <path d="m5 11 9 9"/>
        </svg>
      </button>

      <button id="btn-shapes" class="tool-btn" title="Shapes (Line, Arrow, Box, Circle)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect width="14" height="14" x="5" y="5" rx="2"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      <!-- Shapes Popup Submenu -->
      <div id="shapes-popup" class="shapes-popup hidden">
        <button class="tool-btn" data-tool="line" title="Line">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="5" y1="19" x2="19" y2="5"/>
          </svg>
        </button>
        <button class="tool-btn" data-tool="arrow" title="Arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="5" y1="19" x2="19" y2="5"/>
            <polyline points="10 5 19 5 19 14"/>
          </svg>
        </button>
        <button class="tool-btn" data-tool="rectangle" title="Rectangle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
          </svg>
        </button>
        <button class="tool-btn" data-tool="circle" title="Circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="8"/>
          </svg>
        </button>
      </div>

      <div class="divider"></div>

      <!-- Color Swatches -->
      <div class="color-picker-grid">
        <div class="color-dot active" data-color="#ef4444" style="background:#ef4444;" title="Red"></div>
        <div class="color-dot" data-color="#f97316" style="background:#f97316;" title="Orange"></div>
        <div class="color-dot" data-color="#eab308" style="background:#eab308;" title="Yellow"></div>
        <div class="color-dot" data-color="#22c55e" style="background:#22c55e;" title="Green"></div>
        <div class="color-dot" data-color="#0ea5e9" style="background:#0ea5e9;" title="Sky Blue"></div>
        <div class="color-dot" data-color="#a855f7" style="background:#a855f7;" title="Purple"></div>
        <div class="color-dot" data-color="#ffffff" style="background:#ffffff;" title="White"></div>
        <div class="color-dot" data-color="#000000" style="background:#000000; border: 1px solid rgba(255,255,255,0.3);" title="Black"></div>
      </div>

      <div class="divider"></div>

      <!-- Size Selector -->
      <div class="size-picker">
        <button class="size-dot-btn" data-size="3" title="Fine (3px)">
          <div class="size-dot" style="width: 4px; height: 4px;"></div>
        </button>
        <button class="size-dot-btn active" data-size="6" title="Medium (6px)">
          <div class="size-dot" style="width: 7px; height: 7px;"></div>
        </button>
        <button class="size-dot-btn" data-size="12" title="Thick (12px)">
          <div class="size-dot" style="width: 10px; height: 10px;"></div>
        </button>
        <button class="size-dot-btn" data-size="20" title="Heavy (20px)">
          <div class="size-dot" style="width: 14px; height: 14px;"></div>
        </button>
      </div>

      <div class="divider"></div>

      <!-- Actions: Undo, Redo, Clear, Board -->
      <button id="btn-undo" class="tool-btn" title="Undo (Cmd+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
        </svg>
      </button>

      <button id="btn-redo" class="tool-btn" title="Redo (Cmd+Shift+Z)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 7v6h-6"/>
          <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
        </svg>
      </button>

      <button id="btn-clear" class="tool-btn" title="Clear Screen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M3 6h18"/>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      </button>

      <button id="btn-board" class="tool-btn" title="Toggle Whiteboard / Blackboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </button>

      <button id="btn-visibility" class="tool-btn" title="Hide / Show Ink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>

      <div class="divider"></div>

      <!-- Close / Exit App -->
      <button id="btn-close" class="tool-btn" style="color: #ef4444;" title="Quit Epic Pen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;

  // State
  let boardModeIndex = 0;
  const boardModes: BoardMode[] = ["desktop", "whiteboard", "blackboard"];
  let isInkVisible = true;

  const shapesPopup = document.getElementById("shapes-popup")!;
  const btnShapes = document.getElementById("btn-shapes")!;

  // Tool buttons handling
  const allToolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tool]"));

  function selectTool(tool: Tool) {
    allToolButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });

    // Highlight shapes button if a shape is chosen
    const isShape = ["line", "arrow", "rectangle", "circle"].includes(tool);
    btnShapes.classList.toggle("active", isShape);

    shapesPopup.classList.add("hidden");
    emit("change-tool", { tool });
  }

  allToolButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool as Tool;
      selectTool(tool);
    });
  });

  // Shapes button toggles submenu
  btnShapes.addEventListener("click", (e) => {
    e.stopPropagation();
    shapesPopup.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!shapesPopup.contains(e.target as Node) && e.target !== btnShapes) {
      shapesPopup.classList.add("hidden");
    }
  });

  // Color picking
  const colorDots = Array.from(document.querySelectorAll<HTMLDivElement>(".color-dot"));
  colorDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      colorDots.forEach((d) => d.classList.remove("active"));
      dot.classList.add("active");
      const color = dot.dataset.color || "#ef4444";
      emit("change-color", { color });
    });
  });

  // Size picking
  const sizeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".size-dot-btn"));
  sizeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      sizeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const size = parseInt(btn.dataset.size || "6", 10);
      emit("change-size", { size });
    });
  });

  // Action buttons
  document.getElementById("btn-undo")?.addEventListener("click", () => {
    emit("action-undo");
  });

  document.getElementById("btn-redo")?.addEventListener("click", () => {
    emit("action-redo");
  });

  document.getElementById("btn-clear")?.addEventListener("click", () => {
    emit("action-clear");
  });

  document.getElementById("btn-board")?.addEventListener("click", () => {
    boardModeIndex = (boardModeIndex + 1) % boardModes.length;
    const mode = boardModes[boardModeIndex];
    emit("change-board-mode", { mode });
  });

  document.getElementById("btn-visibility")?.addEventListener("click", () => {
    isInkVisible = !isInkVisible;
    emit("toggle-visibility", { visible: isInkVisible });
  });

  document.getElementById("btn-close")?.addEventListener("click", async () => {
    try {
      await invoke("close_app");
    } catch {
      window.close();
    }
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      if (e.shiftKey) {
        emit("action-redo");
      } else {
        emit("action-undo");
      }
    } else if (e.key === "1") {
      selectTool("cursor");
    } else if (e.key === "2") {
      selectTool("pen");
    } else if (e.key === "3") {
      selectTool("highlighter");
    } else if (e.key === "4") {
      selectTool("eraser");
    }
  });
}
