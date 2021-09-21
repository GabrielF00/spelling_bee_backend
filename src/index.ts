import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import {handleSubmitWord} from "./game";
import {SubmitWordResponse} from "spellbee";

dotenv.config();
const app = express();
const port = 8080; // default port to listen

const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/submitWord', async (req, res) => {
    const word = req.body.word;
    const response: SubmitWordResponse = await handleSubmitWord(9, word);
    res.json(response);
});

// start the Express server
app.listen( port, () => {
    // tslint:disable-next-line:no-console
    console.log( `server started at http://localhost:${ port }` );
} );