;
;    Copyright (C) 2019-2026 Myzidya
;
;    This program is free software: you can redistribute it and/or modify
;    it under the terms of the GNU Affero General Public License as published by
;    the Free Software Foundation, either version 3 of the License, or
;    (at your option) any later version.
;
;    This program is distributed in the hope that it will be useful,
;    but WITHOUT ANY WARRANTY; without even the implied warranty of
;    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
;    GNU Affero General Public License for more details.
;
;    You should have received a copy of the GNU Affero General Public License
;    along with this program.  If not, see <https://gnu.org>.


;===========================================
; SMW Overworld Level Force + Early Relocation (4lvno)
; Forces all overworld tiles to enter level !val (same as 2lvno/3lvno), AND -
; when the host supplies the level's overworld tile coordinates:
;   * Patches Mario/Luigi ROM start table at $009EF0 (LM "map start position")
;   * Relocates runtime OW position as soon as the overworld loads ($00A126),
;     so instant-retry systems that snapshot coords at level entry see the
;     correct tile (3lvno only wrote coords inside OverrideLevel / $05DCDD).
;   * One-shot auto-enters the forced level from OW main ($0E -> $0F) via
;     freeram latch (does not re-enter after a normal level exit).
;
; When !ow_have == 0 the early-relocate / start-table / auto-enter code is not
; assembled and behavior matches 2lvno.
;
; Host-injected parameters (substituted before asar):
;   {ow_have}   -> !ow_have   : 1 if coordinates were provided, else 0
;   {ow_submap} -> !ow_submap : target submap 0-6 ($1F11)
;   {ow_x}      -> !ow_x      : target tile X 0-31 ($1F1F)
;   {ow_y}      -> !ow_y      : target tile Y 0-31 ($1F21)
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

; One-shot auto-enter latch (WRAM $7F; not cleared on level exit).
!4lvno_auto_latch = $7FB510

;===========================================
; Calculate level components
;===========================================
if !val >= $25
    !anumber #= !val-$DC
else
    !anumber #= !val
endif

if !val >= $100
    !high_byte_flag = $01
else
    !high_byte_flag = $00
endif

; Precompute overworld pixel positions (tile center = tile * 16 + 8).
!ow_x_px #= !ow_x*$10+$08
!ow_y_px #= !ow_y*$10+$08

; SA-1 detection
!addr = $0000
if read1($00FFD5) == $23
    sa1rom
    !addr = $6000
endif

; Capture original long targets BEFORE we overwrite the JSL sites.
!OWLayerLoad = read3($00A127)
!OWMainPrim  = read3($00A1C8)

; Skip intro and short timer
org $9CB1
    db $00

org $00A09C
    db $10

; Hook at $05D89B - force tile->level read (same as 2lvno/3lvno)
org $05D89B
    autoclean JSL GetTargetLevel

; Hook at $05DCDD - authoritative level force (+ belt-and-suspenders relocate)
org $05DCDD
    autoclean JSL OverrideLevel
    NOP

if !ow_have
;---------------------------------------------------------------------------
; ROM start position table ($009EF0) — LM "Mario start position" / new save.
; Layout matches $1F11-$1F26 (22 bytes). Anim words keep vanilla $0002.
;---------------------------------------------------------------------------
org $009EF0
    db !ow_submap          ; $1F11 Mario submap
    db !ow_submap          ; $1F12 Luigi submap
    dw $0002               ; $1F13 Mario animation
    dw $0002               ; $1F15 Luigi animation
    dw !ow_x_px            ; $1F17 Mario X pixel
    dw !ow_y_px            ; $1F19 Mario Y pixel
    dw !ow_x_px            ; $1F1B Luigi X pixel
    dw !ow_y_px            ; $1F1D Luigi Y pixel
    dw !ow_x               ; $1F1F Mario X tile
    dw !ow_y               ; $1F21 Mario Y tile
    dw !ow_x               ; $1F23 Luigi X tile
    dw !ow_y               ; $1F25 Luigi Y tile

; OW load: before layer load uses $1F11 for camera/submap ($00A126).
org $00A126
    autoclean JSL OWLoadHook

; OW main ($0E): one-shot fade-to-level ($0F).
org $00A1C7
    autoclean JSL OWMainHook
endif

; Free space for code
freedata

GetTargetLevel:
    PHX
    PHY

    if !val >= $25
        LDA.b #(!anumber+$24)
    else
        LDA.b #!anumber
    endif

    STA $13BF|!addr

    PLY
    PLX
    RTL

OverrideLevel:
    PHX
    PHP

    SEP #$20

    LDA.b #!anumber
    STA $13BF|!addr

    if !val >= $100
        LDA.b #$01
        STA $0F|!addr
    endif

if !ow_have
    ; Belt-and-suspenders: also relocate at level entry (same as 3lvno).
    JSL RelocateOW
endif

    LDA.b #!anumber

    PLP
    PLX
    RTL

if !ow_have
;---------------------------------------------------------------------------
; Early OW load: relocate, then call original layer-load JSL.
;---------------------------------------------------------------------------
OWLoadHook:
    JSL RelocateOW
    JSL.l !OWLayerLoad
    RTL

;---------------------------------------------------------------------------
; OW main: one-shot auto-enter via game mode $0F (fade to level).
;---------------------------------------------------------------------------
OWMainHook:
    ;LDA.l !4lvno_auto_latch
    ;BNE .run_ow
    ;LDA #$01
    ;STA.l !4lvno_auto_latch
    LDA #$0f ;TRY b
    STA $0100|!addr
    RTL
.run_ow:
    JSL.l !OWMainPrim
    RTL

;---------------------------------------------------------------------------
; Shared relocate: submap + tile + centered pixels for Mario and Luigi.
; JSL-callable from freecode or OverrideLevel (RTL).
;---------------------------------------------------------------------------
RelocateOW:
    PHP
    SEP #$20
    LDA.b #!ow_submap
    STA $1F11|!addr
    STA $1F12|!addr
    STA $13C3|!addr

    REP #$20
    LDA.w #!ow_x
    STA $1F1F|!addr
    STA $1F23|!addr
    LDA.w #!ow_y
    STA $1F21|!addr
    STA $1F25|!addr
    LDA.w #!ow_x_px
    STA $1F17|!addr
    STA $1F1B|!addr
    LDA.w #!ow_y_px
    STA $1F19|!addr
    STA $1F1D|!addr
    PLP
    RTL
endif

