import {Pool, QueryResult} from "pg";
import dotenv from "dotenv"
import {GameWord, GameState, GameType, GAME_STATUS, PlayerScore, Player} from "spellbee";

export { create_game_row, get_game_by_id, update_row_after_word_found, update_row_end_game };

const SETUP_GAME_QUERY =  'INSERT INTO games(valid_words, middle_letter, outer_letters, max_score, game_type, scores) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
const GET_GAME_QUERY = 'SELECT * FROM games where id = $1';
const SUBMIT_WORD_QUERY = 'UPDATE games SET found_words = $1, scores = $2 where id = $3';
const END_GAME_QUERY = 'UPDATE games SET status = 1 where id = $1 RETURNING *';

// represents a row in the DB
export interface GameDto {
    id: number,
    game_type: GameType,
    valid_words: GameWord[],
    middle_letter: string,
    outer_letters: string,
    found_words: GameWord[],
    score: number,
    max_score: number,
    status: GAME_STATUS,
    scores: Record<string, number>
}

dotenv.config()
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10)
})

pool.on('error', (err, client) => {
    console.error("Error: ", err)
});

async function create_game_row(outerLetters: string, middleLetter: string, validWords: GameWord[], maxScore: number, gameType: number, player: Player = ""): Promise<GameDto> {
    const playerScores: Record<string, number> = {};
    playerScores[player] = 0;
    const result = await query(SETUP_GAME_QUERY, [JSON.stringify(validWords), middleLetter, outerLetters, maxScore, gameType, JSON.stringify(playerScores)]);
    return to_game_dto(result);
}

async function get_game_by_id(id: number) {
    const result = await query(GET_GAME_QUERY, [id]);
    return to_game_dto(result);
}

async function update_row_after_word_found(game: GameState) {
    return await query(SUBMIT_WORD_QUERY, [JSON.stringify(game.found_words), JSON.stringify(game.scores), game.id]);
}

async function update_row_end_game(gameId: number) {
    const result = await query(END_GAME_QUERY, [gameId]);
    console.log(result);
    return to_game_dto(result);
}

async function query(text: string, values: any[]) {
    try {
        return pool.query(text, values)
        // console.log(res)
    } catch (err) {
        console.log(err.stack)
    }
}

function to_game_dto(result: QueryResult) {
    const row = result.rows[0];
    const game: GameDto = {
        id: row.id,
        game_type: row.game_type,
        valid_words: row.valid_words,
        middle_letter: row.middle_letter,
        outer_letters: row.outer_letters,
        found_words: Object.keys(row.found_words).length === 0 ? [] : row.found_words,
        score: row.score,
        max_score: row.max_score,
        status: row.status,
        scores: row.scores
    };
    return game;
}