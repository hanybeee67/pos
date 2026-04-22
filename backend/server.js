require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'] }
});

// ── 미들웨어 ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── 정적 파일 제공 (프론트엔드) ──────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API 라우터 ────────────────────────────────────────────────────
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/branches',   require('./src/routes/branches'));
app.use('/api/categories', require('./src/routes/categories'));
app.use('/api/menus',      require('./src/routes/menus'));
app.use('/api/tables',     require('./src/routes/tables'));
app.use('/api/orders',     require('./src/routes/orders'));
app.use('/api/payments',   require('./src/routes/payments'));
app.use('/api/closing',    require('./src/routes/closing'));
app.use('/api/torder',     require('./src/routes/torder'));
app.use('/api/members',    require('./src/routes/members'));
app.use('/api/staff',      require('./src/routes/staff'));

// ── 헬스체크 ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '에베레스트 POS API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── SPA 폴백 ─────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── 오류 핸들러 ──────────────────────────────────────────────────
app.use(require('./src/middleware/errorHandler'));

// ── WebSocket (실시간 테이블 동기화) ─────────────────────────────
io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  console.log(`🔌 클라이언트 연결: ${socket.id} (${clientIp})`);

  // 지점별 룸 참여
  socket.on('join-branch', (branchId) => {
    socket.join(`branch-${branchId}`);
    console.log(`  → branch-${branchId} 룸 참여`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 클라이언트 연결 종료: ${socket.id}`);
  });
});

// io 인스턴스를 라우터에서 사용 가능하게
app.set('io', io);

// ── 서버 시작 ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('⛰️  ══════════════════════════════════════════');
  console.log(`    에베레스트 POS 서버 실행 중`);
  console.log(`    http://localhost:${PORT}`);
  console.log('    ══════════════════════════════════════════');
  console.log('');
});

module.exports = { app, io };
