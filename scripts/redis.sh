
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

c0end() {
  id=`redis-cli lrange demo:mpush:ids -1 -1`
  if [ -n "$id" ]
  then
    key="demo:mpush:$id"
    echo "del $key"
    redis-cli del $key
  fi
}

c0kill() {
  id=`redis-cli lrange demo:mpush:ids -1 -1`
  if [ -n "$id" ]
  then
    pid=`redis-cli hget demo:mpush:$id pid`
    echo "kill $pid for $id"
    kill $pid 
  fi
}

c0state() {
  echo
  redis-cli keys 'demo:mpush*' | sort
  for list in in pending out0 out1
  do
    key="demo:mpush:$list"
    echo "llen $key" `redis-cli llen $key`
  done
  id=`redis-cli lrange demo:mpush:ids -1 -1`
  if [ -n "$id" ]
  then
    echo "hgetall demo:mpush:$id"
    redis-cli hgetall demo:mpush:$id
  fi
  echo out0 `redis-cli lrange demo:mpush:out0 0 -1`
  echo out1 `redis-cli lrange demo:mpush:out1 0 -1`
}

c1push() {
  redis-cli lpush "demo:mpush:in" $1
  sleep .1
  c0state
}

c0default() {
  redis-cli lpush "demo:mpush:in" one
  redis-cli lpush "demo:mpush:in" two
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
