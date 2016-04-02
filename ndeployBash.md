

## `ndeploy` bash script

#### ndeploy

This service should `git clone` and `npm install` packages according to a Redis-based request.

###### req

We `brpoplpush` a request `id` and `hget :req:$id` fields:
- the `git` URL
- optional `branch` otherwise defaulted to `master`
- optional `commit` otherwise defaulted to `HEAD`

So the `req` hashes contain the git URL at least:
```
hgetall demo:ndeploy:req:9
1) "git"
2) "https://github.com/evanx/hello-component"
```

Let's implement this service in bash:
```shell
c0pop() {
  $redis1 expire $ns:service:$serviceId 120
  id=`$redis brpoplpush $ns:req $ns:pending 4`
  if [ -n "$id" ]
  then
    hsetnx $ns:res:$id service $serviceId
    git=`$redis hget $ns:req:$id git`
    branch=`$redis hget $ns:req:$id branch`
    commit=`$redis hget $ns:req:$id commit`
    deployDir="$serviceDir/$id"
    mkdir -p $deployDir && cd $deployDir && pwd
    hsetnx $ns:res:$id deployDir $deployDir
```
where we `brpoplpush` with a `4` second timeout.

Incidently, the script should exit in the event of any errors, and so should be automatically restarted.

For example if a new service instance is going to be started by the cron every minute, then its `:service:$id` could expire every 120 seconds, so that we have at most two running at once.


###### git clone

The service must:
- `git clone` the URL e.g. from Github, into the directory `.ndeploy/demo-ndeploy/$id/master`
- `git checkout $commit` if a commit hash is specified in the `:req:$id` hashes

```shell
  git clone $git -b $branch $branch
  cd $branch
  if [ -n "$commit" ]
  then
    git checkout $commit
  fi
  hsetnx $ns:res:$id cloned `stat -c %Z $deployDir`
```
where we set the `cloned` timestamp.

###### npm install

```shell  
  if [ -f package.json ]
  then
    npm --silent install
    hsetnx $ns:res:$id npmInstalled `stat -c %Z node_modules`
  fi
```

Let's manually check the `package.json` for this deployment:
```shell
~/mpush-redis$ cat ~/.ndeploy/demo-ndeploy/9/master/package.json
```
```json
{
  "name": "hello-component",
  "version": "0.1.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "author": "@evanxsummers",
  "license": "ISC",
  "dependencies": {
  }
}
```

###### res

We set `:res:$id` hashes for:
 - the `deployDir` of the `git clone` et al
 - the `actualCommit` SHA according to `git log`

```shell
  actualCommit=`git log | head -1 | cut -d' ' -f2`
  hsetnx $ns:res:$id actualCommit $actualCommit
```
where we `hsetnx` response hashes e.g. `demo:ndeploy:res:9` (matching the `req:9` request).

Finally we pushes the request `id` to the `:res` list.
```shell
  $redis lpush $ns:res $id
```
We can now `lrem :req:pending $id`
```shell
  $redis lrem $ns:req:pending -1 $id
```
where we scan from the tail of the list.


##### Further reading

See: https://github.com/evanx/mpush-redis/blob/master/scripts/ndeploy.sh


#### rquery

I'm imagining a simple `rquery` service will accept an array of Redis commands, and return the requested data.

```shell
redis-cli get rquery:clihelp
Welcome to @rquery from service 1
For request message in YAML format, use #rquery:req:yaml  
```
where we can interact with the service via the Redis CLI e.g. for demo purposes.


##### News/blog article

For example, a news publishing application might query for an article title and section:
```shell
redis-cli lpush rquery:req:yaml "
  meta:
    id: 12345
  paramaters:
    articleId: 7654321
  commands:
  - command: hget article:$articleId section
    save: sectionId
  - name: label
    command: hget section:$section label
"
```

where this might return the following results:
```
redis-cli brpop rquery:res
```
```json
{
   "meta": {
     "id": 12345
  },
   "commands": {
      "label": "News"
   },
   "saved": {
      "sectionId": "news"
   }
}   
```
where this response is `popped` from a Redis "response" queue. We note that the `meta.id` matches our request.

Note that in practice, rather than `brpop,` we must `brpoplpush :req :pending` e.g. so that the message can be recovered from `:pending` e.g. in the event that some new version of the service instance is crashing after popping the message. Incidently, in this scenario, we must detect the faulty instance, deregister it for and schedule its shutdown e.g. `del` its service key.


### Further reading

Related projects and further plans: https://github.com/evanx/mpush-redis/blob/master/related.md
