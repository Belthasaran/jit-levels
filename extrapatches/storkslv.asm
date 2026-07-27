; Storks level selector patch
; Extracted from myzidya old rhtools asm.1
;
; Jump to level in storksa
; Parameter mapping JSON: INPUT: {"level_number": {"input": "glevelnum_s"}, "rom_file": {"input": "rom_file"}}
;
!levelnumber = #${level_number}

org $85d856
    JSR Main ;jsr n n   +2 d85a  (length=3)
    BNE $3   ; len=2    (bne,       length=2) ;  bne n
    JMP $d8a5 ; len=3     (jmp $nnnn, length=3) ;  jmp n n   ; +3
org $85f8f0
Main:
    LDA !levelnumber
    STA $13bf
    CPX #$03
    BNE .etest
        LDA $0109
    RTS
    .etest:
    RTS

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

