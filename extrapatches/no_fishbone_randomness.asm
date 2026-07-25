;
; delay is the number of frames fishbone spends in its initial acceleration phase before beginning to decelerate
;
org $01858E
  LDA.b 15
  BRA $02
