import fs from "fs";
import {create_game_row, GameDto, get_game_by_id, update_row_after_word_found} from "./db";
import {GameState, SubmitWordResponse} from "spellbee";

export { score_word, is_pangram, generate_word_list, setup_game, calculate_max_score };

const DICT = load_dict();
const RANKS = new Map([[0, "EGG"], [0.1, "LARVA"], [0.2, "PUPA"], [0.3, "WORKER"], [0.4, "DRONE"],
    [0.5, "POLLEN JOCK"], [0.75, "BEE GENIUS"], [1, "QUEEN"]]);

function load_dict() {
    try {
        return fs.readFileSync('data/latest-word-list.txt', 'utf8').split("\n");
    } catch (err) {
        throw new Error("Could not read dictionary file.");
    }
}

async function setup_game(outerLetters: string, middleLetter: string) {
    const validWords = generate_word_list(outerLetters.split(''), middleLetter);
    const maxScore = calculate_max_score(validWords, new Set([...outerLetters.split(''), middleLetter]));
    const result = await create_game_row(outerLetters, middleLetter, validWords, maxScore);
    console.log(result.rows[0]);
}

export async function handleSubmitWord(gameId: number, word: string): Promise<SubmitWordResponse> {
    // TODO: make this a transaction
    const game = await get_game_by_id(gameId);
    if (game.valid_words.includes(word)) {
        if (game.found_words.includes(word)) {
            return {
                state: "failed",
                error_message: "Word already found"
            }
        }
        const isPangram = is_pangram(word, new Set([...game.outer_letters, game.middle_letter]));
        const score = score_word(word, isPangram);
        game.found_words.push(word);
        game.score += score;
        const gameState: GameState = to_game_state(game);
        await update_row_after_word_found(gameState);
        return {
            state: "success",
            response: {
                word,
                score,
                is_pangram: isPangram,
                game_state: gameState
            }
        };
    } else {
        return {
            state: "failed",
            error_message: "Invalid word"
        }
    }
}

function to_game_state(game: GameDto) {
    const gameState: GameState = {
        id: game.id,
        middle_letter: game.middle_letter,
        outer_letters: game.outer_letters,
        found_words: game.found_words,
        score: game.score,
        max_score: game.max_score,
        rank: get_current_rank(game.score, game.max_score)
    }
    return gameState;
}

function generate_word_list(outerLetters: string[], middleLetter: string) {
    const allLetters = outerLetters.join('') + middleLetter;
    const pattern = new RegExp(`^([${allLetters}])*${middleLetter}([${allLetters}])*$`);
    return DICT.filter(word => pattern.test(word));
}

function calculate_max_score(validWords: string[], letters: Set<string>) {
    let score = 0;
    for (const word of validWords) {
        score += score_word(word, is_pangram(word, letters));
    }
    return score;
}

function score_word(word: string, isPangram: boolean) {
    if (word.length < 4) {
        throw Error("Cannot score a word of < 4 letters.");
    } else if (word.length === 4) {
        return 1;
    } else {
        if (isPangram) {
            return word.length + 7;
        }
        return word.length;
    }
}

function is_pangram(word: string, letters: Set<string>) {
    const wordLetters = new Set(word.split(''));
    return wordLetters.size === letters.size && [...wordLetters].every(value => letters.has(value));
}

export function get_current_rank(currentScore: number, maxScore: number) {
    const percentage = currentScore / maxScore;
    let currentRank = "";
    for (const [key, value] of RANKS.entries()) {
        if (key > percentage) {
            break;
        }
        currentRank = value;
    }
    return currentRank;
}