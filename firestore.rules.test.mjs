import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

const PROJECT_ID = "scoreflow-rules-test";
const RULES = readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");

function sampleGame(overrides = {}) {
  return {
    homeScore: 12,
    awayScore: 10,
    homeSets: 1,
    awaySets: 0,
    setNumber: 2,
    winBy: 2,
    setsToWin: 2,
    matchFormat: "club",
    matchSets: 3,
    lastAlert: "Race 25",
    homeColor: "#d62828",
    awayColor: "#1565c0",
    matchTitle: "Game Night",
    homeName: "Team 1",
    awayName: "Team 2",
    winner: "",
    setFlashTeam: "",
    setFlashId: 0,
    updatedAtMs: Date.now(),
    ...overrides
  };
}

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES
    }
  });
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test.after(async () => {
  await testEnv?.cleanup();
});

test("denies unauthenticated access", async () => {
  const unauth = testEnv.unauthenticatedContext();
  const ref = doc(unauth.firestore(), "volleyballGames/game-mabc123-xy9z0");

  await assertFails(getDoc(ref));
  await assertFails(setDoc(ref, sampleGame({ ownerUid: "someone" })));
});

test("owner can create, read, update, and delete a live game", async () => {
  const owner = testEnv.authenticatedContext("owner-user");
  const ref = doc(owner.firestore(), "volleyballGames/game-mabc123-xy9z0");

  await assertSucceeds(setDoc(ref, {
    ...sampleGame(),
    ownerUid: "owner-user",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  await assertSucceeds(getDoc(ref));

  await assertSucceeds(updateDoc(ref, {
    ...sampleGame({ homeScore: 13 }),
    updatedAt: serverTimestamp()
  }));

  await assertSucceeds(deleteDoc(ref));
});

test("viewer can read but not write someone else's game", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "volleyballGames/game-mabc123-xy9z0"), {
      ...sampleGame(),
      ownerUid: "owner-user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  const viewer = testEnv.authenticatedContext("viewer-user");
  const ref = doc(viewer.firestore(), "volleyballGames/game-mabc123-xy9z0");

  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, {
    ...sampleGame({ homeScore: 99 }),
    updatedAt: serverTimestamp()
  }));
});

test("legacy game without ownerUid can be claimed once by an authenticated scorer", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "volleyballGames/game-mabc123-legacy1"), {
      ...sampleGame(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  const claimer = testEnv.authenticatedContext("legacy-claimer");
  const ref = doc(claimer.firestore(), "volleyballGames/game-mabc123-legacy1");

  await assertSucceeds(setDoc(ref, {
    ...sampleGame({ homeScore: 14 }),
    ownerUid: "legacy-claimer",
    updatedAt: serverTimestamp()
  }, { merge: true }));

  const intruder = testEnv.authenticatedContext("intruder-user");
  const intruderRef = doc(intruder.firestore(), "volleyballGames/game-mabc123-legacy1");

  await assertFails(updateDoc(intruderRef, {
    ...sampleGame({ homeScore: 0 }),
    updatedAt: serverTimestamp()
  }));
});

test("rejects invalid game ids and malformed score payloads", async () => {
  const badIdOwner = testEnv.authenticatedContext("owner-user-bad-id");
  const badIdRef = doc(badIdOwner.firestore(), "volleyballGames/not-a-valid-id");

  await assertFails(setDoc(badIdRef, {
    ...sampleGame(),
    ownerUid: "owner-user-bad-id",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));

  const invalidScoreOwner = testEnv.authenticatedContext("owner-user-bad-score");
  const ref = doc(invalidScoreOwner.firestore(), "volleyballGames/game-mabc123-bad01");
  await assertFails(setDoc(ref, {
    ...sampleGame({ homeScore: -1 }),
    ownerUid: "owner-user-bad-score",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});
