import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import {end_game, handle_join_game, handle_submit_word, leave_game, setup_game} from "./game";
import {
    EndGameRequest,
    EndGameState, GameUpdate,
    JoinGameRequest,
    JoinGameResponse,
    StartGameRequest,
    SubmitWordRequest,
    SubmitWordResponse
} from "spellbee";
import * as http from "http";

dotenv.config();
const app = express();
const port = 8080; // default port to listen

const corsOptions = {
    origin: ['http://localhost:3000', 'https://bee-genius.onrender.com'],
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const subscribers = new Map<string, http.ServerResponse>();

app.post('/createGame', async (req, res) => {
    const request: StartGameRequest = req.body;
    const response = await setup_game(request);
    res.json(response);
});

app.post('/joinGame', async (req, res) => {
    const request: JoinGameRequest = req.body;
    const response: JoinGameResponse = await handle_join_game(request.game_id, request.player_name);
    res.json(response);
});

app.post('/submitWord', async (req, res) => {
    const request: SubmitWordRequest = req.body;
    const response: SubmitWordResponse = await handle_submit_word(request.gameId, request.word, request.player_name);
    res.json(response);
});

app.post('/endGame', async (req, res) => {
    const gameId = req.body.gameId;
    const response: EndGameState = await end_game(gameId);
    res.json(response);
})

app.post('/leaveGame', async (req, res) => {
    const request: EndGameRequest = req.body;
    const response: EndGameState = await leave_game(request.gameId, request.player_name);
    res.json(response);
})

app.get('/subscribeToUpdates/game/:gameCode/player/:playerName', (req, res) => {
    const gameCode = req.params.gameCode;
    const playerName = req.params.playerName;
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);
    const data = `data: \n\n`;
    res.write(data);
    const clientId = gameCode + "-" + playerName;
    subscribers.set(clientId, res);

    req.on('close', () => {
        console.log(`${clientId} connection closed`);
        subscribers.delete(clientId);
    });
});

export function update_subscribers(clientId: string, data: GameUpdate) {
    if (!subscribers.has(clientId)) {
        console.log(`No subscriber ${clientId}`);
    } else {
        subscribers.get(clientId).write(`data: ${JSON.stringify(data)}\n\n`);
    }
}

// start the Express server
app.listen( port, () => {
    // tslint:disable-next-line:no-console
    console.log( `server started at http://localhost:${ port }` );
} );