
c0flush() {
  redis-cli keys 'demo:mpush:*' | xargs -n1 redis-cli del 
  redis-cli -n 1 keys 'demo:mpush:*' | xargs -n1 redis-cli -n 1 del 
  redis-cli keys 'demo:mpush:*' 
  redis-cli -n 1 keys 'demo:mpush:*' 
}

c0clear() {
  for list in in pending out0 out1
  do
    key="demo:mpush:$list"
    echo "0 del $key" `redis-cli del $key`
    echo "1 del $key" `redis-cli -n 1 del $key`
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
  for list in in pending done out0 out1
  do
    key="demo:mpush:$list"
    echo "0 llen $key" `redis-cli llen $key`
    echo "1 llen $key" `redis-cli -n 1 llen $key`
  done
  echo out0 `redis-cli lrange demo:mpush:out0 0 -1`
  echo out1 `redis-cli -n 1 lrange demo:mpush:out1 0 -1`
}

c0default() {
  redis-cli lpush 'demo:mpush:in' one
  redis-cli lpush 'demo:mpush:in' two
  sleep 1
  id=`redis-cli lpop demo:mpush:ids`
  if [ -z "$id" ]
  then
    echo "empty id"
  else
    redis-cli lpush 'demo:mpush:done' $id
  fi
  echo out0 `redis-cli lrange demo:mpush:out0 0 -1`
  echo out1 `redis-cli -n 1 lrange demo:mpush:out1 0 -1`
}

command=default
if [ $# -ge 1 ]
then
  command=$1
  shift
fi
c$#$command $0

