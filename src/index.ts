import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import {handleSubmitWord, setup_game} from "./game";
import {SubmitWordResponse} from "spellbee";

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
    const response = await setup_game();
    res.json(response);
});

app.post('/submitWord', async (req, res) => {
    const gameId = req.body.gameId;
    const word = req.body.word;
    const response: SubmitWordResponse = await handleSubmitWord(gameId, word);
    res.json(response);
});

// start the Express server
app.listen( port, () => {
    // tslint:disable-next-line:no-console
    console.log( `server started at http://localhost:${ port }` );
} );