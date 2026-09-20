// Minimal collaboration relay: every message a client sends is forwarded to all the other clients.
// The clients themselves resolve conflicts (last write wins per entity) and elect the oldest session
// as the source of truth for newcomers, so the server can stay completely stateless.
//
//   npm run ws            → ws://localhost:8080
//   PORT=9000 npm run ws  → ws://localhost:9000
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT ?? 8080);
const wss = new WebSocketServer({ port });

wss.on('connection', (socket) => {
  socket.on('message', (data) => {
    const frame = data.toString();
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === 1) client.send(frame);
    }
  });
});

console.log(`SpaceForge relay listening on ws://localhost:${port}`);
