import assert from "node:assert/strict";
import test from "node:test";

import { getFlagUrl } from "../src/flags.js";

test("getFlagUrl maps FIFA team ids to FlagCDN urls", () => {
  assert.equal(getFlagUrl("mex"), "https://flagcdn.com/mx.svg");
  assert.equal(getFlagUrl("eng"), "https://flagcdn.com/gb-eng.svg");
  assert.equal(getFlagUrl("sco"), "https://flagcdn.com/gb-sct.svg");
});

test("getFlagUrl returns empty string for unknown teams", () => {
  assert.equal(getFlagUrl("tbd"), "");
});
