import dotenv from "dotenv";
import {GameDto, update_row_join_game} from "../src/db";
import {GAME_STATUS} from "spellbee";
import assert = require("assert");

const TEST_GAME: GameDto = {
    id: 99999,
    game_type: 0,
    middle_letter: "t",
    outer_letters: "ecpoml",
    found_words: [],
    team_score: 0,
    max_score: 100,
    scores: {},
    valid_words: [],
    status: GAME_STATUS.IN_PROGRESS,
    game_code: ""
}

before(async () => {
    dotenv.config();
});

describe('Validate db interactions', () => {

    it("test error handling when joining a non-existent game", () => {
        assert.rejects(() => update_row_join_game(TEST_GAME), /^RangeError: Game not found\.$/);
    });
});
