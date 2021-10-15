import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import {end_game, handle_submit_word, setup_game} from "./game";
import {EndGameState, StartGameRequest, SubmitWordRequest, SubmitWordResponse} from "spellbee";

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

app.post('/createGame', async (req, res) => {
    const request: StartGameRequest = req.body;
    const response = await setup_game(request);
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

// start the Express server
app.listen( port, () => {
    // tslint:disable-next-line:no-console
    console.log( `server started at http://localhost:${ port }` );
} );