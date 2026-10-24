import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { initOverlay } from "./overlay";
import { initToolbar } from "./toolbar";

async function bootstrap() {
  const hash = window.location.hash;
  let isToolbar = hash === "#toolbar";

  // Also check Tauri window label if hash is empty
  if (!isToolbar) {
    try {
      const currentWindow = getCurrentWebviewWindow();
      if (currentWindow && currentWindow.label === "toolbar") {
        isToolbar = true;
      }
    } catch {
      // Running in standard browser
    }
  }

  if (isToolbar) {
    document.body.classList.add("toolbar-mode");
    initToolbar();
  } else {
    document.body.classList.add("overlay-mode");
    initOverlay();
  }
}

bootstrap();
