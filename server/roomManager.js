const rooms = new Map();

const AVATARS = ['🦊','🐼','🦁','🐸','🦋','🐙','🦄','🐺','🐯','🦜','🐻'];
const COLORS = ['#FF6B6B','#4ECDC4','#FFE66D','#A8E6CF','#FF8B94','#B39DDB','#80DEEA','#FFCC02','#F48FB1','#C5E1A5'];

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "FT-";
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function createRoom() {
    let code;
    do { code = generateRoomCode(); } while (rooms.has(code));

    const room = {
    code,
    state: 'LOBBY',
    players: new Map(),
    hostId: null,
    createAt: Date.now(),
    };

    rooms.set(code, room);
    return room;
}

function getRoom(code) {
    return rooms.get(code) || null;
}

function addPlayer(roomCode, socketId, name) {
    const room = rooms.get(roomCode);
    if(!room) return null;

    const colorIndex = room.players.size % COLORS.length;
    const avatarIndex = room.players.size % AVATARS.length;

    const player = {
        id: socketId,
        name: name,
        avatar: AVATARS[avatarIndex],
        color: COLORS[colorIndex],
        score: 0,
        roundScore: 0,
        isHost: room.players.size === 0,
    };

    room.players.set(socketId, player);
    if (!room.hostId) room.hostId = socketId;

    return player;
}

function removePlayer(roomCode, socketId) {
    const room = rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.get(socketId);
    room.players.delete(socketId);
    if (room.players.size === 0) rooms.delete(roomCode);
    return player;
}

function getPlayersArray(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return [];
    return [...room.players.values()];
}

module.exports = { createRoom, getRoom, addPlayer, removePlayer, getPlayersArray };


