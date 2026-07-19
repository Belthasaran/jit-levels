# jit-levels

Generates a similarity fingerprint in attempt to compare different levels in a SMW ROM based on expanded L1 level tiles information.

For example,  Level numbers 133 and  138  in Acid Tapes,    are both test levels.
Each of them has 3 non-empty screens.

Therefore, the two levels should have 3 near-identical fingerprints
The originality score should then be 0%.
Filter out level.

node jstools/level_fingerprint.js --rom=../rhplay/lmlevelinfo/test/acidtapes/acidtapes.sfc --gameid=41504 --levels=133,138 | egrep '138,2,|133,2,'


