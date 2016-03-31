
set -u

rediscli='redis-cli -n 13'
ns='demo:ndeploy'

c3abort() {
  exitCode=$1
  name=$2
  value=$3
  echo "WARN abort: $name $value"
  exit $exitCode
}

c1abort() {
  message="$1"
  echo "WARN abort: $message"
  exit 1
}

redise() {
  expect=$1
  shift
  rcmd="$@"
  if echo "$rcmd" | grep -qv " $ns:"
  then
    >&2 echo "WARN $rcmd"
    return 1
  elif $rediscli $rcmd | grep -v "^${expect}$"
  then
    >&2 echo "WARN $rcmd"
    return 2
  else
    return 0
  fi
}

redis1() {
  redise 1 $*
}

hsetnx() {
  redis1 hsetnx $*
}

c3hgetd() {
  defaultValue=$1
  key=$2
  field=$3
  value=`$rediscli hget $key $field`
  if [ -z "$value" ]
  then
    echo "$defaultValue"
  else
    echo $value
  fi
}

c1grepq() {
  grep -q "^${1}$"
}

grepe() {
  expect="$1"
  if ! cat | grep -q "$expect"
  then
    echo "WARN $expect"
    return 0
  else
    return 1
  fi
}

c1id() {
  name=$1
  >&2 echo $rediscli incr $ns:$name:id
  id=`$rediscli incr $ns:$name:id`
  redise 0 exists $ns:$name:$id || c1abort "exists $ns:$name:$id"
  echo $id
}

serviceId=`c1id service`
serviceDir=$HOME/.ndeploy/`echo $ns | tr ':' '-'`
echo "INFO service: serviceId $serviceId, ns $ns, serviceDir $serviceDir"
mkdir -p $serviceDir && cd $serviceDir || exit 1
pwd

v1popError() {
  id=$1
  echo "ERROR pop: $*"
  $rediscli lpush $ns:req $id
  $rediscli lrem $ns:req:pending -1 $id
  exit 9
}

pendingId=''

c0exit() {
  if [ -n "$pendingId" ]
  then
    v1popError $pendingId
  fi

}

trap c0exit exit

c0pop() {
  $rediscli expire $ns:service:$serviceId 60 | c1grepq 1
  rcmd="brpoplpush $ns:req $ns:pending 2"
  pendingId=`$rediscli $rcmd`
  id=$pendingId
  if [ -n "$id" ]
  then
    echo hgetall $ns:req:$id
    $rediscli hgetall $ns:req:$id
    set -e
    c1popped $id
    pendingId=''
    set +e
  fi
}

c1popped() {
  id=$1
  git=`$rediscli hget $ns:req:$id git`
  branch=`c3hgetd master $ns:req:$id branch`
  commit=`$rediscli hget $ns:req:$id commit`
  echo "$git" | grep '^http\|git@'
  cd $serviceDir
  ls -lht
  deployDir="$serviceDir/$id"
  [ ! -d $deployDir ] 
  hsetnx $ns:res:$id deployDir $deployDir
  echo "INFO deployDir $deployDir"
  mkdir -p $deployDir && cd $deployDir
  git clone $git -b $branch $branch
  cd $branch 
  if [ -n "$commit" ]
  then
    echo "INFO git checkout $commit -- $git $branch"
    git checkout $commit
  fi
  hsetnx $ns:res:$id cloned `stat -c %Z $deployDir`
  if [ -f package.json ]
  then
    cat package.json
    npm --silent install
    hsetnx $ns:res:$id npmInstalled `stat -c %Z node_modules`
  fi
  actualCommit=`git log | head -1 | cut -d' ' -f2`
  echo "INFO actualCommit $actualCommit"
  hsetnx $ns:res:$id actualCommit $actualCommit
  echo; echo hgetall $ns:res:$id
  $rediscli hgetall $ns:res:$id
}

c0tpush() {
  sleep .5
  id=`$rediscli incr $ns:req:id`
  $rediscli exists $ns:req:$id | c1grepq 0
  $rediscli hset $ns:req:$id git https://github.com/evanx/hello-component
  $rediscli lpush $ns:req $id
}

c0clear13() {
  redis-cli -n 13 keys "$ns:*" | xargs -n1 redis-cli -n 13 del
  rm -rf $HOME/.ndeploy/demo-ndeploy
}

c0test() {
  c0tpush & c0pop
}

c0test
