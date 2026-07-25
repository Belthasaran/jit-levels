; Clear RAM on reset
assert read1($00FFD5) != $23,   "This patch isn't necessary for SA-1."

lorom

org $00801D
    REP #$28
    autoclean JML reset_clear

org $00805B
    if read4($0E8000) == $4B4D4140
        BRA $01 : NOP
    else
        ;   as time wasting as it is to clear twice, this is needed to not stall the SPC700.
        JSR $8A4E
    endif

;---

freedata

reset_clear:
    ;   on entry A = 16-bit
    SEP #$10                    ;   to be safe
zero:
    LDA #$0000
    TCD

    LDA #$8008
    STA $4300
    LDA.w #zero+1
    STA $4302
    LDY.b #bank(zero)
    STY $4304
    STZ $4305
    STZ $2181
    LDX #$7E
    STX $2183
    LDY #$01
    STY $420B
    STZ $2181
    INX
    STX $2183
    STY $420B

    LDA #$00FF
    STA $7F837D

    REP #$10

    JML $808023                 ;   we nuked the stack. gotta JML
