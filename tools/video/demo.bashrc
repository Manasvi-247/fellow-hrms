export PS1='\[\e[38;5;218m\]manasvi\[\e[0m\]@\[\e[38;5;117m\]fellow\[\e[0m\] \[\e[38;5;183m\]\W\[\e[0m\] $ '
export PROMPT_COMMAND='printf "\033]0;prompt-%s\007" "$RANDOM$RANDOM"'
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=ap-south-1 AWS_PAGER=""
export KUBECTL_EXTERNAL_DIFF=""
alias awsl='aws --endpoint-url http://localhost:4566'
cd "$FELLOW_ROOT"
clear
