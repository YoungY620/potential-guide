// Preload: keep the surface minimal; the game needs no Node APIs in the renderer.
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('aiDefense', {
  platform: process.platform
});
