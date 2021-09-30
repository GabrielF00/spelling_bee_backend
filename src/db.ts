import {Pool, QueryResult} from "pg";
import dotenv from "dotenv"
import {GameState} from "spellbee";

export { create_game_row, get_game_by_id, update_row_after_word_found };

const SETUP_GAME_QUERY = 'INSERT INTO games(valid_words, middle_letter, outer_letters, max_score) VALUES ($1::Text[], $2, $3, $4) RETURNING id';
const GET_GAME_QUERY = 'SELECT * FROM games where id = $1';
const SUBMIT_WORD_QUERY = 'UPDATE games SET found_words = $1, score = $2 where id = $3';

// represents a row in the DB
export interface GameDto {
    id: number,
    valid_words: string[],
    middle_letter: string,
    outer_letters: string,
    found_words: string[],
    score: number,
    max_score: number
}

dotenv.config()
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    port: parseInt(process.env.DB_PORT, 10)
})

pool.on('error', (err, client) => {
    console.error("Error: ", err)
});

async function create_game_row(outerLetters: string, middleLetter: string, validWords: string[], maxScore: number): Promise<number> {
    const result = await query(SETUP_GAME_QUERY, [validWords, middleLetter, outerLetters, maxScore]);
    return result.rows[0].id;
}

async function get_game_by_id(id: number) {
    const result = await query(GET_GAME_QUERY, [id]);
    return to_game_dto(result);
}

async function update_row_after_word_found(game: GameState) {
    const result = await query(SUBMIT_WORD_QUERY, [game.found_words, game.score, game.id]);
}

async function query(text: string, values: any[]) {
    try {
        return pool.query(text, values)
        // console.log(res)
    } catch (err) {
        console.log(err.stack)
    }
}

function to_game_dto(result: QueryResult<any>) {
    const row = result.rows[0];
    const game: GameDto = {
        id: row.id,
        valid_words: row.valid_words,
        middle_letter: row.middle_letter,
        outer_letters: row.outer_letters,
        found_words: row.found_words,
        score: row.score,
        max_score: row.max_score
    };
    return game;
}