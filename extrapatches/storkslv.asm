; Storks level selector patch
; Extracted from myzidya old rhtools asm.1
;   https://raw.githubusercontent.com/Belthasaran/rhtools/a9efda3c7d4a8a4926043dbb94687fb25ec10c39/asm1.py
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

