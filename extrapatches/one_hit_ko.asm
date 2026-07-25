; Experimental  new version of OhKo based on   Kevinskie555/Smallhacker  knockback patch

;Sound effect to play when hurt
!sfx = $20
!sfxPort = $1DF9|!addr

;Speed to be knocked back with
!knockSpeed = $40

        !addr = $0000
if read1($00FFD5) == $23
	sa1rom
	!addr = $6000
endif

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

; Hijack the hurt routine
org $00F5D5
    autoclean JML NewRoutine


freecode
NewRoutine:
	LDA #!sfx
	STA !sfxPort

	LDA.b #($100-!knockSpeed)
	STA $7D

	LDA $76
	BNE Other

	LDA #!knockSpeed
	BRA Continue
    
Other:
	LDA.b #($100-!knockSpeed)
Continue:
	STA $7B

MarioFlash:
	LDA #$7F
	STA $1497|!addr
;;
        jml $00F606
	RTL


;;;;

;
org $01F719
db $00		; Disable "Yoshi runs away" sound effect?
;
org $01F71D
JSL $00F5B7	; Hurt Mario instead of losing Yoshi
BRA +		; \
NOP #39		;  | Remove "Yoshi runs away" routine
+		;  |
RTS		; /
;
org $02A47D	;extended sprite related
db $00		;disable sfx
;
org $02A481	;extended sprite related
JSR $A4AE	; Hurt Mario instead of losing Yoshi
BRA +
NOP #38		;nullify code
+
;;


