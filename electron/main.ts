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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
