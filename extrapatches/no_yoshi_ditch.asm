if read1($00FFD5) == $23
    sa1rom
    !addr = $6000
    !bank = $000000
    !FastMirror = $000000
else
    lorom
    !addr = $0000
    !bank = $000000
    !FastMirror = $800000
    !Hundreds = $0F31
    !Tens = $0F32
    !Ones = $0F33
endif	
!PowerupAddress = $19|!addr
!OnYoshiAddr = $187A|!addr
!OnYoshiOW = $0DC1|!addr
!Hundreds = $0F31|!addr
!Tens = $0F32|!addr
!Ones = $0F33|!addr

org $01AC80
autoclean jsl Main3
;JSR $A4AE

freecode
Main3:
    LDA $009E,X
    CMP.B #$35 
    BNE Next
    JSL $00F5B7
    LDA #00
    STA !Hundreds
    STA !Tens
    LDA #$09
    STA !Ones
Next:
    LDA $009E,X
    CMP.B #$1F 
    RTL

    ;stz.w $14C8,X

    ;rts

