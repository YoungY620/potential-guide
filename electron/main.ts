import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const win = new BrowserWindow({
    width: Number(process.env.WINDOW_W ?? 1920),
    height: Number(process.env.WINDOW_H ?? 1080),
    minWidth: 1280,
    minHeight: 720,
    title: 'AI Defense RTS',
    backgroundColor: '#06090f',
    // QA capture runs stay invisible to avoid interrupting the user.
    show: !process.env.CAPTURE_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.removeMenu();

  if (DEV_URL) {
    void win.loadURL(DEV_URL);
  } else {
    // QUERY env (QA) overrides; otherwise AUTO_START/DEMO compose the query.
    const search =
      process.env.QUERY ??
      (process.env.AUTO_START ? 'autostart' + (process.env.DEMO ? '&demo' : '') : '');
    void win.loadFile(path.join(__dirname, '../dist/index.html'), { search });
  }

  // Dev/QA hook: capture a screenshot and quit.
  if (process.env.CAPTURE_PATH) {
    const ms = Number(process.env.CAPTURE_MS ?? 6000);
    setTimeout(() => {
      void win.webContents
        .capturePage()
        .then((img) => {
          fs.writeFileSync(process.env.CAPTURE_PATH!, img.toPNG());
          app.quit();
        })
        .catch(() => app.quit());
    }, ms);
  }
}

app.whenReady().then(() => {
  // Bake mode: export procedural material textures as PNG files, then quit.
  if (process.env.BAKE_MATERIALS) {
    const win = new BrowserWindow({ show: false, width: 800, height: 600 });
    const outDir = process.env.BAKE_MATERIALS;
    win.webContents.on('did-finish-load', () => {
      void win.webContents
        .executeJavaScript('window.__exportMaterialTextures && window.__exportMaterialTextures()')
        .then((textures: Record<string, string> | undefined) => {
          if (textures) {
            fs.mkdirSync(outDir, { recursive: true });
            for (const [kind, dataUrl] of Object.entries(textures)) {
              const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
              fs.writeFileSync(path.join(outDir, `${kind}.png`), Buffer.from(b64, 'base64'));
            }
            console.log('baked materials:', Object.keys(textures).join(','));
          }
          app.quit();
        })
        .catch((err) => {
          console.error(err);
          app.quit();
        });
    });
    void win.loadFile(path.join(__dirname, '../dist/index.html'));
    return;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
