
c0flush() {
  redis-cli keys 'demo:mpush:*' | xargs -n1 redis-cli del 
}

c0clear() {
  for list in in pending out1 out2
  do
    key="demo:mpush:$list"
    echo "del $key" `redis-cli del $key`
  done
}

c0state() {
  echo
  redis-cli keys 'demo:mpush*' | sort | grep message | tail 
  redis-cli keys 'demo:mpush*' | sort | grep -v message
  echo "lrange demo:mpush:ids 0 -1"
  echo `redis-cli lrange demo:mpush:ids 0 -1`
  id=`redis-cli lpop demo:mpush:ids`
  if echo "$id" | grep -q '^[0-9]'
  then
    echo redis-cli hgetall demo:mpush:message:$id
    redis-cli hgetall demo:mpush:message:$id
  fi
  for list in in pending done out1 out2
  do
    key="demo:mpush:$list"
    echo "llen $key" `redis-cli llen $key`
  done
  echo out1 `redis-cli lrange demo:mpush:out1 0 -1`
  echo out2 `redis-cli lrange demo:mpush:out2 0 -1`
}

c0default() {
  redis-cli lpush 'demo:mpush:in' one
  redis-cli lpush 'demo:mpush:in' two
  sleep 1
  id=`redis-cli lpop demo:mpush:ids`
  redis-cli lpush 'demo:mpush:done' $id
  echo out1 `redis-cli lrange demo:mpush:out1 0 -1`
  echo out2 `redis-cli lrange demo:mpush:out2 0 -1`
}

command=default
if [ $# -ge 1 ]
then
  command=$1
  shift
fi
c$#$command $0

