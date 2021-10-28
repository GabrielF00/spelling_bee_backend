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
    GameState, GameUpdate, GameUpdatePlayerJoined, GameUpdatePlayerLeft, GameUpdateWordFound,
    GameWord, JoinGameFailed,
    JoinGameResponse, MPGameWord,
    StartGameRequest, SubmitWordFailed,
    SubmitWordResponse
} from "spellbee";
import parse from "csv-parse/lib/sync"
import {update_subscribers} from "./index";

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
    const gameNumber = get_random_int(GAMES.length);
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
    try {
        const game: GameDto = await get_game_by_code(gameCode);

        if (game.status === GAME_STATUS.ENDED) {
            return generate_failure_response("Game has ended.");
        } else if (game.game_type === 0) {
            return generate_failure_response("Cannot join single-player game.");
        } else if (Object.keys(game.scores).length >= 4) {
            return generate_failure_response("Game already has max number of players.");
        }

        game.scores[playerName] = 0;
        try {
            const updatedGameState = to_game_state(await update_row_join_game(game));
            update_other_players_player_joined(updatedGameState, playerName);
            return {
                state: "success",
                response: {
                    game_state: updatedGameState
                }
            }
        } catch (RangeError) {
            return generate_failure_response("Game not found.");
        }
    } catch (err) {
        return generate_failure_response(err.message);
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
        const wordScore = score_word(word, isPangram);
        const foundWordObj = {word, is_pangram: isPangram, player: playerName, score: wordScore};
        game.found_words.push(foundWordObj);
        game.team_score += wordScore;
        game.scores[playerName] = game.scores[playerName] += wordScore;
        const gameState: GameState = to_game_state(game);
        await update_row_after_word_found(gameState);
        update_other_players_word_found(gameState, playerName, foundWordObj);
        return {
            state: "success",
            response: {
                word,
                word_score: wordScore,
                is_pangram: isPangram,
                game_state: gameState
            }
        };
    } else {
        return generate_failure_response("Invalid word");
    }
}

async function update_other_players_word_found(game: GameState, playerName: string, foundWord: MPGameWord) {
    const data: GameUpdateWordFound = {
        type: "word_found",
        update: {
            found_word: foundWord,
            finder_score: game.scores[playerName],
            team_score: game.team_score,
            current_rank: game.current_rank
        }
    }
    update_other_players(game, playerName, data);
}

async function update_other_players_player_joined(game: GameState, playerName: string) {
    const message: GameUpdatePlayerJoined = {
        type: "player_joined",
        update: {
            player_name: playerName
        }
    }
    update_other_players(game, playerName, message);
}

async function update_other_players_player_left(game: GameState, playerName: string) {
    const message: GameUpdatePlayerLeft = {
        type: "player_left",
        update: {
            player_name: playerName
        }
    }
    update_other_players(game, playerName, message);
}

async function update_other_players(game: GameState, playerName: string, message: GameUpdate) {
    const otherPlayers = Object.keys(game.scores).filter(player => player !== playerName);
    for (const player of otherPlayers) {
        update_subscribers(`${game.game_code}-${player}`, message);
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
        scores: game.scores,
        game_code: game.game_code
    }
    return gameState;
}

function generate_game_code(): string {
    const nWords = DICT.length;
    const w1 = DICT[get_random_int(nWords)];
    const w2 = DICT[get_random_int(nWords)];
    const w3 = DICT[get_random_int(nWords)];
    return w1 + "-" + w2 + "-" + w3;
}

function get_random_int(max: number) {
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