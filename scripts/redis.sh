
c0flush() {
  redis-cli keys 'demo:mpush:*' | xargs -n1 redis-cli del
}

c0clear() {
  for list in in pending out0 out1
  do
    key="demo:mpush:$list"
    echo "del $key" `redis-cli del $key`
  done
}

c0state() {
  echo
  redis-cli keys 'demo:mpush*' | sort
  for list in in pending out0 out1
  do
    key="demo:mpush:$list"
    echo "llen $key" `redis-cli llen $key`
  done
  echo out0 `redis-cli lrange demo:mpush:out0 0 -1`
  echo out1 `redis-cli lrange demo:mpush:out1 0 -1`
}

c1push() {
  redis-cli lpush 'demo:mpush:in' $1
  sleep .1
  c0state
}

c0default() {
  redis-cli lpush 'demo:mpush:in' one
  redis-cli lpush 'demo:mpush:in' two
  sleep .1
  c0state
}

command=default
if [ $# -ge 1 ]
then
  command=$1
  shift
fi
c$#$command $@
