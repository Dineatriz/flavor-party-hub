const roomManager = require('./roomManager');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const gameLogic = require('./gameLogic');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});


app.use(cors());
app.use(express.json());

app.use('/tv', express.static(path.join(__dirname, '../tv-client')));
app.use('/mobile', express.static(path.join(__dirname, '../mobile-client')));

const PORT = 3000;
app.post('/api/room/create', async (req, res) => {
    const room = roomManager.createRoom();
    const mobileUrl = `http://${getLocalIP()}:3000/mobile/?room=${room.code}`;
    const qr = await QRCode.toDataURL(mobileUrl);
    res.json({ code: room.code, qr, mobileUrl });
});

io.on('connection', (socket) => {
    console.log('New connection: ' + socket.id);

    socket.on('tv:register', ({ roomCode }) => {
        socket.join('tv:' + roomCode);
        socket.data.role = 'tv';
        socket.data.roomCode = roomCode;
        console.log('TV registered in room ' + roomCode);
    });

    socket.on('player:join', ({ roomCode, name }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return socket.emit('error', { msg: 'Room not found!' });

        const player = roomManager.addPlayer(roomCode, socket.id, name);
        socket.join('room:' + roomCode);
        socket.data.role = 'player';
        socket.data.roomCode = roomCode;

        socket.emit('player:joined', { player, roomCode });

        io.to('tv:' + roomCode).emit('tv:player_joined', {
            player,
            players: roomManager.getPlayersArray(roomCode),
        });
    });

    socket.on('disconnect', () => {
        const { role, roomCode } = socket.data || {};
        if (role === 'player' && roomCode) {
            roomManager.removePlayer(roomCode, socket.id);
            io.to('tv:' + roomCode).emit('tv:player_left', {
                players: roomManager.getPlayersArray(roomCode),
            });
        }
    });

    socket.on('host:start_game', ({ roomCode, game }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;

        room.players.forEach(p => { p.roundScore = p.score; });

        if (game === 'quiz') {
            const initData = gameLogic.startQuiz(room);
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('game:start', { game: 'quiz', data: initData });
            let count = 3;
            const countInterval = setInterval(() => {
                io.to('room:' + roomCode).to('tv:' + roomCode).emit('quiz:countdown', { count });
                count--;
                if (count < 0) {
                    clearInterval(countInterval);
                    sendQuizQuestion(roomCode);
                }
            }, 1000);
        }

        if (game === 'nitro') {
            const initData = gameLogic.startNitro(room);
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('game:start', { game: 'nitro', data: initData });
            setTimeout(() => startNitroRound(roomCode), 2000);
        }

        if (game === 'doodle') {
            const initData = gameLogic.startDoodle(room);
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('game:start', { game: 'doodle', data: initData });
            io.to(initData.drawerId).emit('doodle:your_word', { word: room.gameState.word });

            setTimeout(() => {
                io.to('room:' + roomCode).to('tv:' + roomCode).emit('game:results', {
                    results: [...room.players.values()].sort((a, b) => b.score - a.score),
                });
            }, 60000);
        }
    });

    socket.on('quiz:answer', ({ roomCode, answerIndex }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        const result = gameLogic.quizSubmitAnswer(room, socket.id, answerIndex);
        if (result.alreadyAnswered) return;
        socket.emit('quiz:answer_received', { position: result.position });
        io.to('tv:' + roomCode).emit('tv:player_answered', { playerId: socket.id });
    });

    socket.on('nitro:click', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        const result = gameLogic.nitroClick(room, socket.id);
        if (result.falseStart) {
            socket.emit('nitro:false_start');
            io.to('tv:' + roomCode).emit('tv:nitro_false_start', { playerId: socket.id });
        } else if (result.reaction) {
            socket.emit('nitro:clicked', { reaction: result.reaction });
        }
    });

    socket.on('doodle:draw', ({ roomCode, stroke }) => {
        io.to('tv:' + roomCode).emit('tv:doodle_stroke', { stroke });
    });

    socket.on('doodle:guess', ({ roomCode, guess }) => {
        const room = roomManager.getRoom(roomCode);
        if (!room) return;
        const result = gameLogic.doodleGuess(room, socket.id, guess);
        if (!result || result.ignored || result.alreadyGuessed) return;

        const player = room.players.get(socket.id)
        if (result.correct) {
            socket.emit('doodle:correct', { points: result.points });
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('doodle:guess_broadcast', {
                playerName: player?.name,
                guess: '✅ Correct!',
                correct: true,
            });
        } else {
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('doodle:guess_broadcast', {
                playerName: player?.name,
                guess,
                correct: false,
            });
        }
    });

    socket.on('back:lobby', ({ roomCode }) => {
        const room = roomManager.getRoom(roomCode);
        if (room) {
            room.state = 'LOBBY';
        }
        io.to('room:' + roomCode).emit('game:back_to_lobby');
    });
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function sendQuizQuestion(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    const qData = gameLogic.quizNextQuestion(room);
    io.to('room:' + roomCode).to('tv:' + roomCode).emit('quiz:question', qData);

    setTimeout(() => revealQuizAnswer(roomCode), gameLogic.QUIZ_TIME * 1000);
}

function revealQuizAnswer(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;
    const reveal = gameLogic.quizReveal(room);
    io.to('room:' + roomCode).to('tv:' + roomCode).emit('quiz:reveal', reveal);

    setTimeout(() => {
        const finished = gameLogic.quizAdvance(room);
        if (finished) {
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('game:results', {
                results: [...room.players.values()].sort((a, b) => b.score - a.score),
            });
        } else {
            sendQuizQuestion(roomCode);
        }
    }, 4000);
}

function startNitroRound(roomCode) {
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    gameLogic.nitroArm(room);
    io.to('room:' + roomCode).to('tv:' + roomCode).emit('nitro:armed');

    const delay = 2000 + Math.random() * 4000;
    setTimeout(() => {
        gameLogic.nitroGo(room);
        io.to('room:' + roomCode).to('tv:' + roomCode).emit('nitro:go');

        setTimeout(() => {
            const reveal = gameLogic.nitroReveal(room);
            io.to('room:' + roomCode).to('tv:' + roomCode).emit('nitro:reveal', reveal);

            if (reveal.finished) {
                io.to('room:' + roomCode).to('tv:' + roomCode).emit('game:results', {
                    results: [...room.players.values()].sort((a, b) => b.score - a.score),
                });
            } else {
                setTimeout(() => startNitroRound(roomCode), 3000);
            }
        }, 3000);
    }, delay);
}

server.listen(PORT, () => {
    console.log(`Servidor a correr em http://localhost:${PORT}`);
});