;===========================================
; SMW Overworld Level Force + Relocation Patch (3lvno)
; Forces all overworld tiles to enter level !val (same as 2lvno), AND -
; when the host supplies the level's overworld tile coordinates - relocates
; the overworld player onto that level's tile/submap so that:
;   * exiting the forced level returns Mario to the correct tile, and
;   * re-entry after a midway/checkpoint resumes naturally (vanilla logic).
;
; Goal: Compatibility with Lunar Magic + various Retry Systems.
;
; Strategy:
;   - Keep 2lvno's forcing hooks ($05D89B GetTargetLevel, $05DCDD OverrideLevel)
;     so the *correct level always loads* regardless of where the player stands.
;     These also serve as the not-found fallback when no coordinates are given.
;   - In OverrideLevel (which fires on every overworld->level entry) also write
;     the player's overworld submap + tile + pixel position to the target tile.
;     Because this runs at entry time, the values are in place before the next
;     overworld load (level exit / death), so the natural OW load drops Mario on
;     the right tile and brings up the right submap. No fragile new OW-load hook
;     and no faked $1EA2/$13CF midway flags are needed.
;
; Host-injected parameters (substituted before asar):
;   {ow_have}   -> !ow_have   : 1 if coordinates were provided, else 0
;   {ow_submap} -> !ow_submap : target submap 0-6 ($1F11)
;   {ow_x}      -> !ow_x      : target tile X 0-31 ($1F1F)
;   {ow_y}      -> !ow_y      : target tile Y 0-31 ($1F21)
; When !ow_have == 0 the relocation code is not assembled and behavior is
; identical to 2lvno.
;===========================================

;===========================================
; CONFIGURATION: Target level (0x000-0x1FF), injected by host
;===========================================
!val = ${level_number}

;===========================================
; Overworld relocation parameters, injected by host (decimal literals)
;===========================================
!ow_have   = {ow_have}
!ow_submap = {ow_submap}
!ow_x      = {ow_x}
!ow_y      = {ow_y}

;===========================================
; Calculate level components
; Use #= for assembly-time calculations (no spaces around operators)
;===========================================
; For levels >= $25, SMW uses a special calculation
; Levels 0x00-0x24: use directly
; Levels 0x25+: subtract $DC to get translevel number
; This applies to both 0x25-0x5F and extended levels (>= 0x100)
if !val >= $25
    !anumber #= !val-$DC  ; For levels >= $25, subtract $DC to get translevel
else
    !anumber #= !val
endif

; Calculate high byte flag for extended levels
if !val >= $100
    !high_byte_flag = $01  ; High bit set for extended levels
else
    !high_byte_flag = $00
endif

; Precompute overworld pixel positions (tile * 16); always in range 0-$1F0
!ow_x_px #= !ow_x*$10
!ow_y_px #= !ow_y*$10

; SA-1 detection
!addr = $0000
if read1($00FFD5) == $23
    sa1rom
    !addr = $6000
endif

; Skip intro and short timer
org $9CB1
    db $00

org $00A09C
    db $10

; Hook at $05D89B - This is where the game reads the level number from $7ED000
; Original: LDA.L $7ED000,X (4 bytes) followed by STA.W $13BF (3 bytes)
; We replace the LDA with JSL, and our routine will execute the STA
org $05D89B
    autoclean JSL GetTargetLevel
    ; The STA.W $13BF instruction is now in our routine

; Hook at $05DCDD - This is AFTER Lunar Magic's GetLevelHighByte runs
; This ensures the level is set correctly even if something overrides it
org $05DCDD
    autoclean JSL OverrideLevel
    NOP

; Free space for code
freedata

GetTargetLevel:
    ; Replaces: LDA.L $7ED000,X  (then original STA.W $13BF)
    ; At entry: X = tile index, Y = player index, 8-bit accumulator mode.
    PHX
    PHY

    ; Calculate the value to return.
    ; The code at $05D8A2 subtracts $24 if >= $25, so for levels >= $25 we
    ; return !anumber + $24 so the post-subtraction value is correct, then we
    ; fix $13BF authoritatively in OverrideLevel.
    if !val >= $25
        LDA.b #(!anumber+$24)
    else
        LDA.b #!anumber
    endif

    ; Execute the STA.W $13BF instruction that we overwrote.
    STA $13BF|!addr

    PLY
    PLX
    RTL

OverrideLevel:
    ; Hooks at $05DCDD. Lunar Magic's GetLevelHighByte has already run.
    ; 1) Force $13BF (+$0F for extended levels) to the target level.
    ; 2) When coordinates are supplied, relocate the overworld player.
    PHX
    PHP

    ; --- 8-bit: force the level number (guarantees correct entry) ---
    SEP #$20

    LDA.b #!anumber
    STA $13BF|!addr

    if !val >= $100
        ; Extended level - set high byte directly (avoids relying on $1F11)
        LDA.b #$01
        STA $0F|!addr
    endif

if !ow_have
    ; --- Overworld relocation -------------------------------------------
    ; Set the player's submap so the next OW load brings up the right map and
    ; indexes $7ED000 in the correct submap block.
    LDA.b #!ow_submap
    STA $1F11|!addr        ; Mario current submap
    STA $1F12|!addr        ; Luigi/secondary submap
    STA $13C3|!addr        ; current player's submap

    ; --- 16-bit: tile pointers (0-31) and pixel positions (tile*16) ---
    REP #$20
    LDA.w #!ow_x
    STA $1F1F|!addr        ; Mario OW X tile (= X pixel / $10)
    STA $1F23|!addr        ; Luigi OW X tile
    LDA.w #!ow_y
    STA $1F21|!addr        ; Mario OW Y tile (= Y pixel / $10)
    STA $1F25|!addr        ; Luigi OW Y tile
    LDA.w #!ow_x_px
    STA $1F17|!addr        ; Mario OW X position (pixels)
    STA $1F1B|!addr        ; Luigi OW X position (pixels)
    LDA.w #!ow_y_px
    STA $1F19|!addr        ; Mario OW Y position (pixels)
    STA $1F1D|!addr        ; Luigi OW Y position (pixels)
    SEP #$20
    ; --------------------------------------------------------------------
endif

    ; Restore A to the level number (mirrors 2lvno's tail) and return.
    LDA.b #!anumber

    PLP
    PLX
    RTL
