import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export type Tool =
  | "cursor"
  | "pen"
  | "highlighter"
  | "eraser"
  | "line"
  | "arrow"
  | "rectangle"
  | "circle";

export type BoardMode = "desktop" | "whiteboard" | "blackboard";

interface Point {
  x: number;
  y: number;
}

export function initOverlay() {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <div id="overlay-container" class="overlay-container">
      <canvas id="draw-canvas"></canvas>
    </div>
  `;

  const container = document.getElementById("overlay-container")!;
  const canvas = document.getElementById("draw-canvas") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Drawing state
  let currentTool: Tool = "pen";
  let currentColor = "#ef4444";
  let currentSize = 5;
  let isDrawing = false;
  let startPoint: Point = { x: 0, y: 0 };
  let points: Point[] = [];

  // Undo/Redo stack (offscreen canvas snapshots)
  const undoStack: ImageData[] = [];
  const redoStack: ImageData[] = [];
  const MAX_HISTORY = 30;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Preserve existing drawing when resizing
    let tempImg: ImageData | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        tempImg = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch {
        // ignore
      }
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tempImg) {
      ctx.putImageData(tempImg, 0, 0);
    } else {
      saveSnapshot();
    }
  }

  function saveSnapshot() {
    try {
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStack.push(snapshot);
      if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
      }
      // New action clears redo
      redoStack.length = 0;
    } catch {
      // ignore
    }
  }

  function undo() {
    if (undoStack.length > 1) {
      const current = undoStack.pop()!;
      redoStack.push(current);
      const prev = undoStack[undoStack.length - 1];
      ctx.putImageData(prev, 0, 0);
    } else if (undoStack.length === 1) {
      const current = undoStack.pop()!;
      redoStack.push(current);
      clearCanvas(false);
    }
  }

  function redo() {
    if (redoStack.length > 0) {
      const next = redoStack.pop()!;
      undoStack.push(next);
      ctx.putImageData(next, 0, 0);
    }
  }

  function clearCanvas(save = true) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    if (save) {
      saveSnapshot();
    }
  }

  // Update click-through state
  async function updateClickThrough(isCursorMode: boolean) {
    if (isCursorMode) {
      container.classList.add("click-through");
      try {
        await invoke("set_click_through", { ignore: true });
      } catch (err) {
        console.error("Failed to enable click-through:", err);
      }
    } else {
      container.classList.remove("click-through");
      try {
        await invoke("set_click_through", { ignore: false });
      } catch (err) {
        console.error("Failed to disable click-through:", err);
      }
    }
  }

  // Pointer event handlers
  function getCoordinates(e: PointerEvent): Point {
    return { x: e.clientX, y: e.clientY };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (currentTool === "cursor") return;
    isDrawing = true;
    startPoint = getCoordinates(e);
    points = [startPoint];

    if (currentTool === "pen" || currentTool === "highlighter" || currentTool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDrawing || currentTool === "cursor") return;
    const current = getCoordinates(e);
    points.push(current);

    if (currentTool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
      drawSmoothCurve(points);
    } else if (currentTool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(currentColor, 0.35);
      ctx.lineWidth = currentSize * 3;
      drawSmoothCurve(points);
    } else if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = currentSize * 4;
      ctx.beginPath();
      const p1 = points[points.length - 2] || current;
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
    } else {
      // Shape preview (render last snapshot + preview shape)
      if (undoStack.length > 0) {
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;
      ctx.lineWidth = currentSize;
      renderShape(startPoint, current, currentTool);
    }
  });

  function endDrawing(e: PointerEvent) {
    if (!isDrawing) return;
    isDrawing = false;
    const endPoint = getCoordinates(e);

    if (
      currentTool === "line" ||
      currentTool === "arrow" ||
      currentTool === "rectangle" ||
      currentTool === "circle"
    ) {
      if (undoStack.length > 0) {
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
      }
      renderShape(startPoint, endPoint, currentTool);
    }

    saveSnapshot();
    points = [];
  }

  canvas.addEventListener("pointerup", endDrawing);
  canvas.addEventListener("pointercancel", endDrawing);

  // Smooth curve rendering with Bézier midpoints
  function drawSmoothCurve(pts: Point[]) {
    if (pts.length < 2) return;
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];
    const midPoint = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
    ctx.stroke();
  }

  // Draw geometrical shapes
  function renderShape(from: Point, to: Point, shape: Tool) {
    ctx.beginPath();
    if (shape === "line") {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    } else if (shape === "arrow") {
      // Draw shaft
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // Draw arrowhead
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      const headLength = Math.max(12, currentSize * 2.5);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(
        to.x - headLength * Math.cos(angle - Math.PI / 6),
        to.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        to.x - headLength * Math.cos(angle + Math.PI / 6),
        to.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    } else if (shape === "rectangle") {
      const width = to.x - from.x;
      const height = to.y - from.y;
      ctx.strokeRect(from.x, from.y, width, height);
    } else if (shape === "circle") {
      const radiusX = Math.abs(to.x - from.x) / 2;
      const radiusY = Math.abs(to.y - from.y) / 2;
      const centerX = Math.min(from.x, to.x) + radiusX;
      const centerY = Math.min(from.y, to.y) + radiusY;
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function hexToRgba(hex: string, alpha: number): string {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Window resize handler
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // Listen to IPC events from toolbar
  listen<{ tool: Tool }>("change-tool", (event) => {
    currentTool = event.payload.tool;
    updateClickThrough(currentTool === "cursor");
  });

  listen<{ color: string }>("change-color", (event) => {
    currentColor = event.payload.color;
  });

  listen<{ size: number }>("change-size", (event) => {
    currentSize = event.payload.size;
  });

  listen("action-undo", () => {
    undo();
  });

  listen("action-redo", () => {
    redo();
  });

  listen("action-clear", () => {
    clearCanvas(true);
  });

  listen<{ mode: BoardMode }>("change-board-mode", (event) => {
    const mode = event.payload.mode;
    container.classList.remove("bg-whiteboard", "bg-blackboard");
    if (mode === "whiteboard") {
      container.classList.add("bg-whiteboard");
    } else if (mode === "blackboard") {
      container.classList.add("bg-blackboard");
    }
  });

  listen<{ visible: boolean }>("toggle-visibility", (event) => {
    canvas.style.display = event.payload.visible ? "block" : "none";
  });
}
