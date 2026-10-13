import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BOARD_MIN_WIDTH,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  clampChatWidth,
  parseStoredChatWidth,
} from "./layout.ts";

test("clampChatWidth keeps an in-range width", () => {
  assert.equal(clampChatWidth(440, 1600), 440);
});

test("clampChatWidth enforces the minimum chat width", () => {
  assert.equal(clampChatWidth(120, 1600), CHAT_WIDTH_MIN);
});

test("clampChatWidth enforces the maximum chat width", () => {
  assert.equal(clampChatWidth(2000, 1600), CHAT_WIDTH_MAX);
});

test("clampChatWidth always leaves room for the board", () => {
  // Container 900: chat may take at most 900 - BOARD_MIN_WIDTH.
  assert.equal(clampChatWidth(760, 900), 900 - BOARD_MIN_WIDTH);
});

test("clampChatWidth floors at the minimum on tiny containers", () => {
  assert.equal(clampChatWidth(500, 500), CHAT_WIDTH_MIN);
});

test("clampChatWidth rounds fractional widths", () => {
  assert.equal(clampChatWidth(441.6, 1600), 442);
});

test("parseStoredChatWidth accepts a valid stored value", () => {
  assert.equal(parseStoredChatWidth("512"), 512);
});

test("parseStoredChatWidth rejects junk and out-of-range values", () => {
  assert.equal(parseStoredChatWidth(null), null);
  assert.equal(parseStoredChatWidth("abc"), null);
  assert.equal(parseStoredChatWidth("120"), null);
  assert.equal(parseStoredChatWidth("4000"), null);
});
