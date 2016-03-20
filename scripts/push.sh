
c0clear() {
  for list in in pending out1 out2
  do
    key="demo:mpush:$list"
    echo "del $key" `redis-cli del $key`
  done
}

c0state() {
  echo
  for list in in pending out1 out2
  do
    key="demo:mpush:$list"
    echo "llen $key" `redis-cli llen $key`
  done
}

c0state
c0clear
redis-cli lpush 'demo:mpush:in' one
redis-cli lpush 'demo:mpush:in' two
c0state
