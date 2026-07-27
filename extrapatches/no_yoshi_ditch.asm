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
;   GNU Affero General Public License for more details.
;
;    You should have received a copy of the GNU Affero General Public License
;    along with this program.  If not, see <https://gnu.org>.

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

