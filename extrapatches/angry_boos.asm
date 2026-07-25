if read1($00FFD5) == $23                        ;standard sa-1 check stuff
    sa1rom
    !bank = $000000
else
    lorom
    !bank = $800000
endif

org $01F90E
autoclean JML Check

freecode

Check:
  ;LDA $74                                        
  ;BNE JumpTo01F914                              ;chase
  ;BEQ JumpTo01F914

   ; JumpTo01F914:
   JML $01F914|!bank

