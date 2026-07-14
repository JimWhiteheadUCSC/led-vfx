#!/usr/bin/env node
'use strict';

// Wall-label server: a tiny standalone process (independent of
// host/daemon.js - see currentPieceStore.js for why) that serves the
// title-card page in host/wallLabel/page/ and pushes the currently-
// running piece's title/rationale to it over WebSocket whenever
// run/current-piece.json changes. Meant to run under a browser in
// kiosk mode on the secondary HDMI screen; see host/wallLabel/autostart.sh.
//
//   node host/wallLabel/server.js [--port 8081]

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { readCurrentPiece, watchCurrentPiece } = require('./currentPieceStore');

const PAGE_DIR = path.join(__dirname, 'page');
const DEFAULT_PORT = 8081; // distinct from SimDisplay's 8080, so both can run on one machine

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

class WallLabelServer {
  constructor({ port = DEFAULT_PORT } = {}) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.unwatch = null;
  }

  async init() {
    this.server = http.createServer((req, res) => this._handleRequest(req, res));
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'hello', piece: readCurrentPiece() }));
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });

    this.unwatch = watchCurrentPiece((piece) => this._broadcast(piece));

    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, () => resolve());
    });

    console.log(`[wallLabel] serving http://localhost:${this.port}`);
  }

  _broadcast(piece) {
    const message = JSON.stringify({ type: 'piece', piece });
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(message);
    }
  }

  _handleRequest(req, res) {
    const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = path.join(PAGE_DIR, urlPath);

    // Refuse anything that escapes the page directory.
    if (!filePath.startsWith(PAGE_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }

  async close() {
    if (this.unwatch) this.unwatch();
    for (const ws of this.clients) ws.terminate();
    this.clients.clear();
    if (this.wss) await new Promise((resolve) => this.wss.close(() => resolve()));
    if (this.server) await new Promise((resolve) => this.server.close(() => resolve()));
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let port = DEFAULT_PORT;

  const portIdx = args.indexOf('--port');
  if (portIdx !== -1) {
    port = Number(args[portIdx + 1]);
    if (!Number.isFinite(port)) throw new Error('--port requires a numeric argument');
  }

  return { port };
}

async function main() {
  const { port } = parseArgs(process.argv);
  const server = new WallLabelServer({ port });
  await server.init();

  process.on('SIGINT', async () => {
    console.log('\n[wallLabel] shutting down...');
    await server.close();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[wallLabel] fatal:', err);
    process.exit(1);
  });
}

module.exports = { WallLabelServer };
