/** net.js —— Socket.io 客户端封装 */
const NET = {
  socket: null,
  state: null,       // 服务器最新房间状态
  myId: null,
  onState: null,     // 当前活跃场景注册的回调

  connect() {
    if (this.socket) return;
    this.socket = io();
    this.socket.on('connect', () => { this.myId = this.socket.id; });
    this.socket.on('state', s => {
      this.state = s;
      if (this.onState) this.onState(s);
    });
  },
  createRoom(name, mode, cb) { this.socket.emit('createRoom', { name, mode }, cb); },
  joinRoom(roomId, name, cb) { this.socket.emit('joinRoom', { roomId, name }, cb); },
  start()   { this.socket.emit('startGame'); },
  action(a) { this.socket.emit('action', a); },
  restart() { this.socket.emit('restart'); },
  leave()   { this.socket.emit('leaveRoom'); this.state = null; },

  me() { return this.state ? this.state.players.find(p => p.id === this.myId) : null; },
  isHost() { return this.state && this.state.hostId === this.myId; },
  isMyTurn() { return this.state && this.state.turnId === this.myId; }
};
