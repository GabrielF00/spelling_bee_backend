import assert = require("assert");
import {
    score_word,
    is_pangram,
    generate_word_list,
    calculate_max_score,
    setup_game,
    get_current_rank
} from "../src/game";
import dotenv from "dotenv";

before(async () => {
    dotenv.config();
});

describe('Validate game logic', () => {
    it("four point words should score 1 point", () => {
        assert.equal(1, score_word("test", false));
    });
    it("the score of longer words should equal their length", () => {
        assert.equal(6, score_word("kaboom", false))
    });
    it("the score of pangrams should equal their length + 7", () => {
        assert.equal(15, score_word("flexible", true))
    });
    it("pangrams are detected properly", () => {
        assert.equal(true, is_pangram("menfolk", new Set(["f","e","o","m","l","k","n"])));
        assert.equal(false, is_pangram("menfol", new Set(["f","e","o","m","l","k","n"])));
        assert.equal(false, is_pangram("abcdefg", new Set(["f","e","o","m","l","k","n"])));
        let test = ["e","c","p","o","m","l"];
        assert.equal(true, is_pangram("complete", new Set([...test, "t"])));
        let test2 = "ecpoml";
        assert.equal(true, is_pangram("complete", new Set([...test2, "t"])));

    });
    it('validate that generate_word_list generates the correct words', () => {
        const valid_words = generate_word_list(["e", "c", "p", "o", "m", "l"], "t");
        const expected = ['clot', 'collect', 'collet', 'colt', 'comet', 'compete', 'complete', 'compote', 'coot', 'cote', 'elect', 'emote', 'loot', 'meet', 'melt', 'mete', 'mettle', 'molt', 'moot', 'mote', 'motel', 'motet', 'mottle', 'motto', 'ocelot', 'octet', 'omelet', 'omelette', 'pellet', 'pelt', 'plot', 'poet', 'teem', 'teepee', 'telecom', 'tell', 'temp', 'temple', 'tempo', 'tempt', 'tepee', 'toll', 'tome', 'tool', 'toot', 'tootle', 'tope', 'topple', 'tote', 'totem'];
        assert.equal(expected.length, valid_words.length);
        for (let i = 0 ; i < expected.length ; i++) {
            assert.equal(expected[i], valid_words[i]);
        }
    });
    it("max score is calculated correctly", () => {
        const valid_words = ['clot', 'collect', 'collet', 'colt', 'comet', 'compete', 'complete'];
        const actual_max_score = calculate_max_score(valid_words, new Set(["e", "c", "p", "o", "m", "l", "t"]));
        assert.equal(actual_max_score, 42);
    });
    it("current rank is calculated correctly", () => {
        assert.equal("EGG", get_current_rank(0, 101));
        assert.equal("LARVA", get_current_rank(11, 101));
        assert.equal("QUEEN", get_current_rank(101, 101));
    });
    // it("test", () => {
    //     setup_game("ecpoml", "t");
    // })

});