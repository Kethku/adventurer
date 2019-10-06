if exists("b:current_syntax")
  finish
endif

syntax match balsamicDirectory "\v.*\\\w*$"
highlight link balsamicDirectory Directory

syntax match balsamicId "\v^.*:"
highlight link balsamicId Comment

let b:current_syntax = "balsamic"
