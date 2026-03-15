const QUIZ_QUESTIONS = [
    { q: "What is the capital of Portugal?", opts: ["Lisbon", "Porto", "Faro", "Braga"], correct: 0 },
    { q: "How many sides does a hexagon have?", opts: ["5", "6", "7", "8"], correct: 1 },
    { q: "What is the largest planet in the solar system?", opts: ["Saturn", "Neptune", "Jupiter", "Uranus"], correct: 2 },
    { q: "In what year did man land on the Moon?", opts: ["1965", "1971", "1969", "1972"], correct: 2 },
    { q: "How many players are on a football team?", opts: ["10", "11", "12", "9"], correct: 1 },
    { q: "What is the longest river in the world?", opts: ["Amazon", "Nile", "Yangtze", "Mississippi"], correct: 1 },
    { q: "How many colors are in a rainbow?", opts: ["5", "6", "7", "8"], correct: 2 },
    { q: "What is the chemical symbol for gold?", opts: ["Go", "Ag", "Au", "Or"], correct: 2 },
    { q: "What is the fastes land animal?", opts: ["Lion", "Cheetah", "Horse", "Leopard"], correct: 1 },
    { q: "How many continents are there?", opts: ["5", "6", "7", "8"], correct: 2 },
    { q: "What is the smallest planet in the solar system?", opts: ["Mars", "Venus", "Mercury", "Pluto"], correct: 2 },
    { q: "How many strings does a standard guitar have?", opts: ["4", "5", "6", "7"], correct: 2 },
    { q: "What gas do plants absorb?", opts: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correct: 2 },
    { q: "What is the capital of Japan?", opts: ["Osaka", "Kyoto", "Hiroshima", "Tokyo"], correct: 3 },
    { q: "How many bones are in the human body?", opts: ["196", "206", "216", "226"], correct: 1 },
    { q: "What is the longest river in the world?", opts: ["Amazon", "Nile", "Yangtze", "Mississippi"], correct: 1 },
    { q: "What is the hardest natural substance?", opts: ["Gold", "Iron", "Diamond", "Quartz"], correct: 2 },
    { q: "How many players are on a basketball team?", opts: ["4", "5", "6", "7"], correct: 1 },
    { q: "What is the capital of Australia?", opts: ["Sydney", "Melbourne", "Brisbane", "Canberra"], correct: 3 },
    { q: "How many hours are in a week?", opts: ["144", "156", "168", "172"], correct: 2 },
    { q: "What is the largest ocean?", opts: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3 },
    { q: "How many teeth does an adult human have?", opts: ["28", "30", "32", "34"], correct: 2 },
    { q: "What color is the sun?", opts: ["Yellow", "Orange", "Red", "White"], correct: 3 },
    { q: "What is the square root of 144?", opts: ["11", "12", "13", "14"], correct: 1 },
    { q: "Which planet has the most moons?", opts: ["Jupiter", "Saturn", "Uranus", "Neptune"], correct: 1 },
    { q: "How many sides does an octagon have?", opts: ["6", "7", "8", "9"], correct: 2 },
    { q: "What is the capital of Brazil?", opts: ["Rio de Janeiro", "São Paulo", "Salvador", "Brasília"], correct: 3 },
    { q: "What is the chemical symbol for water?", opts: ["WA", "H2O", "HO2", "W2O"], correct: 1 },
];

const QUIZ_SYMBOLS = [
    { symbol: '▲', color: '#4ECDC4' },
    { symbol: '●', color: '#FF6B6B' },
    { symbol: '■', color: '#FFE66D' },
    { symbol: '★', color: '#A8E6CF'},
];

const QUIZ_TIME = 5;

function startQuiz(room) {
    const shuffled = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
    room.gameState = {
        game: 'quiz',
        questions: shuffled,
        currentQ: 0,
        answers: new Map(),
        questionStartTime: null,
    };
    room.state = 'IN_GAME';
    return { total: shuffled.length, symbols: QUIZ_SYMBOLS };
}

function quizNextQuestion(room) {
    const gs = room.gameState;
    gs.answers = new Map();
    gs.questionStartTime = Date.now();
    const q = gs.questions[gs.currentQ];
    return {
        index: gs.currentQ,
        total: gs.questions.length,
        question: q.q,
        opts: q.opts,
        timeLimit: QUIZ_TIME,
    };
}

function quizSubmitAnswer(room, playerId, answerIndex) {
    const gs = room.gameState;
    if (gs.answers.has(playerId)) return { alreadyAnswered: true };
    const elapsed = (Date.now() - gs.questionStartTime) / 1000;
    gs.answers.set(playerId, { answerIndex, elapsed });
    return { position: gs.answers.size }; 
}

function quizReveal(room) {
    const gs = room.gameState;
    const q = gs.questions[gs.currentQ];
    const results = [];


for (const [pid, ans] of gs.answers) {
    const player = room.players.get(pid);
    if (!player) continue;
    const correct = ans.answerIndex === q.correct;
    const timeRemaining = Math.max(0, QUIZ_TIME - ans.elapsed);
    const points = correct ? Math.round(timeRemaining * 10) + 100 : 0;
    if (points > 0) player.score += points;
    results.push({ playerId: pid, name: player.name, avatar: player.avatar, color: player.color, correct, points });
}

return {
    correctIndex: q.correct,
    results,
    scores: [...room.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: p.score})),
};
}

function quizAdvance(room) {
    room.gameState.currentQ++;
    return room.gameState.currentQ >= room.gameState.questions.length;
}

function startNitro(room) {
    room.gameState = {
        game: 'nitro',
        round: 0,
        maxRounds: 5,
        greenTime: null,
        clicks: new Map(),
        eliminated: new Set(),
    };
    room.state = 'IN_GAME';
    return { maxRounds: 5 };
}

function nitroArm(room) {
    room.gameState.greenTime = null;
    room.gameState.clicks = new Map();
    room.gameState.eliminated = new Set();
    room.gameState.round++;
}

function nitroGo(room) {
    room.gameState.greenTime = Date.now();
}

function nitroClick(room, playerId) {
    const gs = room.gameState;
    if (gs.eliminated.has(playerId)) return { eliminated: true };
    if (gs.clicks.has(playerId)) return { alreadyClicked: true };

    if (!gs.greenTime) {
        gs.eliminated.add(playerId);
        return { falseStart: true };
    }

    const reaction = Date.now() - gs.greenTime;
    gs.clicks.set(playerId, reaction);
    return { reaction };
}

function nitroReveal(room) {
    const gs = room.gameState;
    const sorted = [...gs.clicks.entries()].sort((a, b) => a[1] - b[1]);
    const results = sorted.map(([pid, ms], i) => {
        const player = room.players.get(pid);
        const points = Math.max(0, 500 - ms);
        if (i === 0) player.score += Math.round(points / 2);
        return { playerId: pid, name: player.name, avatar: player.avatar, color: player.color, ms, rank: i + 1 };
    });
    const eliminated = [...gs.eliminated].map(pid => {
        const player = room.players.get(pid);
        return { playerId: pid, name: player?.name, avatar: player?.avatar, color: player?.color, ms: null, rank: null, eliminated: true };
    });

    return {
        results,
        eliminated,
        finished: gs.round >= gs.maxRounds,
        scores: [...room.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: p.score })),
    };
}

const DOODLE_WORDS = [
    'cat', 'airplane', 'house', 'sun', 'fish', 'bicycle', 'tree', 'phone',
    'pizza', 'rocket', 'beach', 'mountain', 'guitar', 'octopus', 'mushroom',
    'giraffe', 'castle', 'ballon', 'star', 'turtle', 'robot', 'volcano',
    'umbrella', 'penguin', 'dragon', 'sandwich', 'cactus', 'rainbow',
];

function startDoodle(room) {
    const players = [...room.players.values()];
    const drawerIndex = Math.floor(Math.random() * players.length);
    const word = DOODLE_WORDS[Math.floor(Math.random() * DOODLE_WORDS.length)];

    room.gameState = {
        game: 'doodle',
        word,
        drawerId: players[drawerIndex].id,
        correctGuessers: new Set(),
        startTime: Date.now(),
        timeLimit: 60,
    };
    room.state = 'IN_GAME';

    return {
        drawerId: players[drawerIndex].id,
        drawerName: players[drawerIndex].name,
        drawerAvatar: players[drawerIndex].avatar,
        timeLimit: 60,
    };
}

function doodleGuess(room, playerId, guess) {
    const gs = room.gameState;
    if (playerId === gs.drawerId) return { ignored: true };
    if (gs.correctGuessers.has(playerId)) return { alreadyGuessed: true};

    const clean = guess.trim().toLowerCase();
    const correct = clean === gs.word.toLowerCase();

    if (correct) {
        gs.correctGuessers.add(playerId);
        const elapsed = (Date.now() - gs.startTime) / 1000;
        const timeRemaining = Math.max(0, gs.timeLimit - elapsed);
        const points = Math.round(timeRemaining * 10) + 100;
        const player = room.players.get(playerId);
        if (player) player.score += points;
        const drawer = room.players.get(gs.drawerId);
        if (drawer) drawer.score += 50;
        return { correct: true, points };
    }

    return { correct: false };
}

module.exports = { startQuiz, quizNextQuestion, quizSubmitAnswer, quizReveal, quizAdvance, QUIZ_SYMBOLS, QUIZ_TIME, startNitro, nitroArm, nitroGo, nitroClick, nitroReveal, startDoodle, doodleGuess };