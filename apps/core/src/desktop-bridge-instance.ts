import type { DesktopBridge } from '@titan/websocket';

let _bridge: DesktopBridge | null = null;

export function setDesktopBridge(bridge: DesktopBridge): void {
  _bridge = bridge;
}

export function getDesktopBridge(): DesktopBridge | null {
  return _bridge;
}
