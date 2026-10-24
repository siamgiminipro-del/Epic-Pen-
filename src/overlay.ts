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
  pressure: number;
  time: number;
  width: number;
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
  let currentSize = 6;
  let isPressureEnabled = true;
  let smoothedWidth = currentSize;
  let isDrawing = false;
  let startPoint: Point = { x: 0, y: 0, pressure: 0.5, time: 0, width: currentSize };
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

  // Compute point with hardware pressure or speed dynamics
  function createPoint(e: PointerEvent, prev?: Point): Point {
    let p = 0.5;
    if (isPressureEnabled) {
      // 1. Hardware Stylus / Apple Pencil / Force Touch Trackpad
      if (e.pointerType === "pen" || (e.pressure > 0 && e.pressure !== 0.5)) {
        p = Math.max(0.1, Math.min(1.0, e.pressure));
      } else if (prev) {
        // 2. Velocity-based pressure dynamics fallback for standard mouse
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        const dist = Math.hypot(dx, dy);
        const dt = Math.max(1, Date.now() - prev.time);
        const speed = dist / dt; // pixels per ms
        // Faster mouse stroke -> thinner line; slower -> thicker line
        p = Math.max(0.2, Math.min(1.0, 1.0 - speed * 0.22));
      }
    }

    // Dynamic width calculated from pressure
    const targetWidth = isPressureEnabled
      ? Math.max(1.5, currentSize * (0.25 + p * 1.5))
      : currentSize;

    // Smooth transition using exponential moving average
    smoothedWidth = prev
      ? smoothedWidth * 0.65 + targetWidth * 0.35
      : targetWidth;

    return {
      x: e.clientX,
      y: e.clientY,
      pressure: p,
      time: Date.now(),
      width: smoothedWidth,
    };
  }

  // Pointer event handlers
  canvas.addEventListener("pointerdown", (e) => {
    if (currentTool === "cursor") return;
    isDrawing = true;
    startPoint = createPoint(e);
    points = [startPoint];

    if (currentTool === "pen" || currentTool === "highlighter") {
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, startPoint.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = currentTool === "highlighter" ? hexToRgba(currentColor, 0.35) : currentColor;
      ctx.fill();
    } else if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, (currentSize * 4) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDrawing || currentTool === "cursor") return;
    const prev = points[points.length - 1];
    const current = createPoint(e, prev);
    points.push(current);

    if (currentTool === "pen") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = currentColor;
      drawSmoothCurve(points, false);
    } else if (currentTool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(currentColor, 0.35);
      drawSmoothCurve(points, true);
    } else if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = currentSize * 4;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
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
    const prev = points[points.length - 1];
    const endPoint = createPoint(e, prev);
    points.push(endPoint);

    if (currentTool === "pen") {
      finishSmoothCurve(points, false);
    } else if (currentTool === "highlighter") {
      finishSmoothCurve(points, true);
    } else if (
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

  // Smooth curve rendering with Bézier midpoints and variable width
  function drawSmoothCurve(pts: Point[], isHighlighter = false) {
    if (pts.length < 2) return;
    const p1 = pts[pts.length - 2];
    const p2 = pts[pts.length - 1];

    ctx.lineWidth = isHighlighter ? currentSize * 3 : p2.width;
    ctx.beginPath();
    if (pts.length === 2) {
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
    } else {
      const p0 = pts[pts.length - 3];
      const prevMidX = (p0.x + p1.x) / 2;
      const prevMidY = (p0.y + p1.y) / 2;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.moveTo(prevMidX, prevMidY);
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    ctx.stroke();
  }

  function finishSmoothCurve(pts: Point[], isHighlighter = false) {
    if (pts.length >= 2) {
      const pPrev = pts[pts.length - 2];
      const pLast = pts[pts.length - 1];
      const midX = (pPrev.x + pLast.x) / 2;
      const midY = (pPrev.y + pLast.y) / 2;
      ctx.lineWidth = isHighlighter ? currentSize * 3 : pLast.width;
      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(pLast.x, pLast.y);
      ctx.stroke();
    }
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

  listen<{ enabled: boolean }>("toggle-pressure", (event) => {
    isPressureEnabled = event.payload.enabled;
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
