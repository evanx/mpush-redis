
set -u

c0clear() {
  for key in `redis-cli keys 'demo:mpush:*'`
  do
    echo "del $key" `redis-cli del $key`
  done
  for list in in pending ids out1 out2
  do
    key="demo:mpush:$list"
    echo "del $key" `redis-cli del $key`
  done
}

c0state() {
  echo
  redis-cli keys 'demo:*' | sort
  echo "lrange demo:mpush:pending:ids 0 -1"
  redis-cli lrange demo:mpush:ids 0 -1 | grep '^[0-9]'
  echo 'hgetall demo:mpush:metrics:done'
  redis-cli hgetall demo:mpush:metrics:done
  echo 'hgetall demo:mpush:metrics:timeout'
  redis-cli hgetall demo:mpush:metrics:timeout
  id=`redis-cli lpop demo:mpush:ids`
  if echo "$id" | grep -q '^[0-9][0-9]*$'
  then
    echo "hgetall demo:mpush:message:$id"
    redis-cli hgetall demo:mpush:message:$id
  fi
  for list in in pending ids out1 out2
  do
    key="demo:mpush:$list"
    llen=`redis-cli llen $key`
    echo "llen $key $llen"
    if [ "$llen" != '0' ]
    then
      echo `redis-cli lrange $key 0 -1`
    fi
  done
}

c0default() {
  redis-cli lpush 'demo:mpush:in' one
  redis-cli lpush 'demo:mpush:in' two
  sleep 1
  id=`redis-cli lpop demo:mpush:ids`
  redis-cli lpush 'demo:mpush:done' $id
}

command=default
if [ $# -ge 1 ]
then
  command=$1
  shift
fi
c$#$command $@



