import fs from "fs";
import {
    create_game_row,
    GameDto,
    get_game_by_id,
    update_row_join_game,
    update_row_after_word_found,
    update_row_end_game,
    get_game_by_code
} from "./db";
import {
    EndGameState,
    GAME_STATUS,
    GameState,
    GameWord, JoinGameFailed,
    JoinGameResponse,
    StartGameRequest, SubmitWordFailed,
    SubmitWordResponse
} from "spellbee";
import parse from "csv-parse/lib/sync"

export { score_word, is_pangram, generate_word_list, setup_game, calculate_max_score };

const DICT = load_dict();
const GAMES = load_games();

const RANKS = new Map([[0, "EGG"], [0.1, "LARVA"], [0.2, "PUPA"], [0.3, "WORKER"], [0.4, "DRONE"],
    [0.5, "POLLINATOR"], [0.75, "GENIUS"], [1, "QUEEN"]]);

function load_dict() {
    try {
        return fs.readFileSync('data/latest-word-list.txt', 'utf8').split("\n");
    } catch (err) {
        throw new Error("Could not read dictionary file.");
    }
}

function load_games() {
    try {
        const gameFile = fs.readFileSync("data/games.csv", "utf8");
        return parse(gameFile, {columns: true});
    } catch (err) {
        throw new Error("Could not parse games file.");
    }
}

async function setup_game(request: StartGameRequest): Promise<GameState> {
    const gameNumber = getRandomInt(GAMES.length);
    const outerLetters = GAMES[gameNumber].outer_letters;
    const middleLetter = GAMES[gameNumber].middle_letter;
    const validWords = generate_word_list(outerLetters.split(''), middleLetter);
    const maxScore = calculate_max_score(validWords, new Set([...outerLetters.split(''), middleLetter]));
    const gameCode = generate_game_code();

    let gameDto: GameDto;
    switch(request.game_type) {
        case 0:
            gameDto = await create_game_row(outerLetters, middleLetter, validWords, maxScore, request.game_type, gameCode);
            break;
        case 1:
        case 2:
            gameDto = await create_game_row(outerLetters, middleLetter, validWords, maxScore, request.game_type, gameCode, request.player_name);
            break;
    }
    return to_game_state(gameDto);
}

export async function handle_join_game(gameCode: string, playerName: string): Promise<JoinGameResponse> {
    const game: GameDto = await get_game_by_code(gameCode);

    if (game.status === GAME_STATUS.ENDED) {
        return generate_failure_response("Game has ended.");
    } else if (game.game_type === 0) {
        return generate_failure_response("Cannot join single-player game.");
    }

    game.scores[playerName] = 0;
    try {
        const updatedGameState = to_game_state(await update_row_join_game(game));
        return {
            state: "success",
            response: {
                game_state: updatedGameState
            }
        }
    } catch(RangeError) {
        return generate_failure_response("Game not found.")
    }
}

function generate_failure_response(errorMessage: string): JoinGameFailed | SubmitWordFailed {
    return {
        state: "failed",
        error_message: errorMessage
    }
}

export async function handle_submit_word(gameId: number, word: string, playerName: string): Promise<SubmitWordResponse> {
    // TODO: make this a transaction
    const game: GameDto = await get_game_by_id(gameId);

    if (game.status === GAME_STATUS.ENDED) {
        return generate_failure_response("Game has ended.");
    }
    const validWords = get_words_from_words_objs(game.valid_words);
    const foundWords = get_words_from_words_objs(game.found_words);
    if (validWords.includes(word)) {
        if (foundWords.includes(word)) {
            return generate_failure_response("Word already found");
        }
        const isPangram = is_pangram(word, new Set([...game.outer_letters, game.middle_letter]));
        const score = score_word(word, isPangram);
        game.found_words.push({word, is_pangram: isPangram});
        game.team_score += score;
        game.scores[playerName] = game.scores[playerName] += score;
        const gameState: GameState = to_game_state(game);
        await update_row_after_word_found(gameState);
        return {
            state: "success",
            response: {
                word,
                word_score: score,
                is_pangram: isPangram,
                game_state: gameState
            }
        };
    } else {
        return generate_failure_response("Invalid word");
    }
}

export async function end_game(gameId: number): Promise<EndGameState> {
    const game = await update_row_end_game(gameId);
    return {
        response: {
            game_state: to_game_state(game),
            all_words: game.valid_words
        }
    };
}

function get_words_from_words_objs(foundWords: GameWord[]) {
    return foundWords.map(fw => fw.word);
}

function to_game_state(game: GameDto) {
    const gameState: GameState = {
        id: game.id,
        game_type: game.game_type,
        middle_letter: game.middle_letter,
        outer_letters: game.outer_letters,
        found_words: game.found_words,
        team_score: game.team_score,
        max_score: game.max_score,
        current_rank: get_current_rank(game.team_score, game.max_score),
        ranks: calculate_ranks(game.max_score),
        scores: game.scores
    }
    return gameState;
}

function generate_game_code(): string {
    const nWords = DICT.length;
    const w1 = DICT[getRandomInt(nWords)];
    const w2 = DICT[getRandomInt(nWords)];
    const w3 = DICT[getRandomInt(nWords)];
    return w1 + "-" + w2 + "-" + w3;
}

function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

function generate_word_list(outerLetters: string[], middleLetter: string): GameWord[] {
    const allLetters = outerLetters.join('') + middleLetter;
    const letterSet = new Set(allLetters);
    const pattern = new RegExp(`^([${allLetters}])*${middleLetter}([${allLetters}])*$`);
    return DICT.filter(word => pattern.test(word)).map( word => {
        return {
            word,
            is_pangram: is_pangram(word, letterSet)
        }
    });
}

function calculate_max_score(validWords: GameWord[], letters: Set<string>) {
    let score = 0;
    for (const word of validWords) {
        score += score_word(word.word, is_pangram(word.word, letters));
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

export function calculate_ranks(maxScore: number) {
    const ranks: Record<string, number> = {};
    for (const [key, value] of RANKS.entries()) {
        ranks[value] = Math.ceil(key * maxScore);
    }
    return ranks;
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