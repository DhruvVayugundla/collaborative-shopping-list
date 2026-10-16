import http from "node:http";
import { createApp } from "./app.js";
import { attachSocket } from "./realtime/socket.js";
import { config } from "./config.js";

const server = http.createServer(createApp());
attachSocket(server);

server.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});
