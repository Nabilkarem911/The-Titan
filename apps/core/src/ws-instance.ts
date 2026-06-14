import type { TitanWebSocketServer } from '@titan/websocket';

let _wsServer: TitanWebSocketServer | null = null;

export function setWsServer(server: TitanWebSocketServer): void {
  _wsServer = server;
}

export function getWsServer(): TitanWebSocketServer | null {
  return _wsServer;
}
