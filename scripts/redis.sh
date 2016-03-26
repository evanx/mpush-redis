
ns='demo:mpush'
dbn=1

echo "$dbn $ns"

rediscli="redis-cli -n $dbn"


c0flush() {
  $rediscli keys "$ns:*" | xargs -n1 $rediscli del
}

c0clear() {
  for list in in pending ids out0 out1
  do
    key="$ns:$list"
    echo "del $key" `$rediscli del $key`
  done
}

c0end() {
  id=`$rediscli lrange $ns:ids -1 -1`
  if [ -n "$id" ]
  then
    key="$ns:$id"
    echo "del $key"
    $rediscli del $key
  fi
}

c0kill() {
  id=`$rediscli lrange $ns:ids -1 -1`
  if [ -n "$id" ]
  then
    pid=`$rediscli hget $ns:$id pid`
    echo "kill $pid for $id"
    kill $pid 
  fi
}

c0state() {
  echo
  $rediscli keys '$ns*' | sort
  for list in in ids pending out0 out1 
  do
    key="$ns:$list"
    echo "llen $key" `$rediscli llen $key` '--' `$rediscli lrange $key 0 99`
  done
  id=`$rediscli lrange $ns:ids -1 -1`
  if [ -n "$id" ]
  then
    echo "hgetall $ns:$id"
    $rediscli hgetall $ns:$id
  fi
}

c1push() {
  $rediscli lpush "$ns:in" $1
  sleep .1
  c0state
}

c0default() {
  $rediscli lpush "$ns:in" one
  $rediscli lpush "$ns:in" two
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
