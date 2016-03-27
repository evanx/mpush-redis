
# mpush-redis

Note: the correct repo is: https://github.com/evanx/mpush-redis

This is a trivial Redis-based message-parallelizing microservice. It supports a persistent pubsub setup via Redis lists, e.g. to support parallel task queues.

It is built for NodeJS, using the Babel transpiler to support async/await.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple lists, one for each subscriber. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

Incidently, a "subscriber" could be comprised of redundant microservices consuming the same subscription list. Such a system offers resilience and scalability. Clearly the service must be "stateless" in this case, e.g. where its state is externalized (and shared) using Redis.


### Implementation

This microservice is performs the following Redis operations.

- `brpoplpush` a message from a "publication" list, into a "pending" list.
- `lpush` the message to multiple "subscription" lists.
- Finally, remove the message from the "pending" list.

These operations are performed atomically, via Redis `multi.`

Herewith a simplified code snippet for illustration:
```javascript
   const message = await this.redisClient.brpoplpushAsync(this.props.in,
      this.props.pending, this.props.popTimeout);
   if (message) {
      const multi = this.redisClient.multi();
      this.props.out.forEach(out => multi.lpush(out, message));
      multi.lrem(this.props.pending, -1, message);
      await multi.execAsync();
   }
```
where we use `bluebird.promisifyAll` which mixes in async functions e.g. `execAsync` et al.

The blocking pop operation has a configured `popTimeout.` It is performed in a loop, until the service is "ended," so it can shutdown gracefully, after a period no longer than `popTimeout,` e.g. in the event of a `SIGTERM` signal.


### Installation

```shell
git clone https://github.com/evanx/mpush-redis
cd mpush-redis
npm install
```
Let's run the demo.
```shell
npm run demo
```
We see the demo configuration in the logs.
```shell
INFO App: config {
      redis: 'redis://localhost:6379/0',
      in: 'demo:mpush:in',
      pending: 'demo:mpush:pending',
      popTimeout: 10,
      out: [ 'demo:mpush:out0', 'demo:mpush:out1' ]
```

#### Blocking pop

From the logs, we deduce that the service performs the following command.

```
brpoplpush demo:mpush:in demo:mpush:pending 5
```
where the blocking pop operation has a configured timeout of 5 seconds (repeated in a infinite loop).

Note that this time determines the duration of a graceful shutdown, because we can only quit when this operation yields.

When the pop yields a message, this service must push this message into the parallel output queues.


#### Publish a message

Let's manually test this by pushing an incoming message into `:in`

```shell
redis-cli lpush demo:mpush:in one
(integer) 1
```

From the logs, we deduce that the service performs the following Redis commands.
```
lpush demo:mpush:out0 one
lpush demo:mpush:out1 one
```


#### Check subscription queues

We check that the message is moved to the parallel output queues.
```shell
redis-cli lrange demo:mpush:out0 0 -1
1) "one"
```

```shell
redis-cli lrange demo:mpush:out1 0 -1
1) "one"
```


### Configuration

Specify the configuration file via the `propsFile` environment variable.

```shell
propsFile=~/config/mpush-redis.js npm start
```

The specified config file is loaded via `require()` and so can be a `.js` or a `.json` file.

For example the following configuration specifies a `serviceRedis` and `serviceNamespace` to enable "advanced" features e.g. service registration, message timeouts, and other metrics.

```javascript
module.exports = {
   redis: 'redis://localhost:6379/0',
   serviceRedis: 'redis://localhost:6379/1',
   serviceNamespace: 'demo:mpush',
   popTimeout: 10,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   out: ['demo:mpush:out0', 'demo:mpush:out1'],
   done: 'demo:mpush:done'
};
```

#### Default props

Default values for props are reported in the logs as follows:
```
INFO Service:
    defaultProps {
      serviceExpire: 60,
      serviceRenew: 15,
      serviceCapacity: 10,
      messageExpire: 60,
      messageTimeout: 10,
      messageCapacity: 1000 }
```

Note that the `service*` and `message*` props are only required if the `serviceNamespace` is set.


### Lifecycle management

An optional `serviceNamespace` configuration property e.g. `"demo:mpush"` is used for lifecycle management, and metrics.

This can be complemented with an optional `serviceRedis` URL, for the related keys. Otherwise they are stored in the default Redis database, i.e. the same instance as the target `:in` and `:out` queues.


#### Registration and renewal

At startup, the service will perform the following Redis commands to "register" itself:
- `incr :id` to obtain a unique service instance `id`
- `hmset :$id` to record `{host, pid, started}` et al
- `expire :$id $serviceExpire` but renew at an interval sufficiently less than `$serviceExpire`

For example, the `serviceExpire` is defaulted to 60 seconds, whereas the renewal period is 15 seconds.
```
INFO renew: started demo:mpush:service:9 15
```
So every 15 seconds, the TTL of the `:service:9` hashes will be renewed to 60 seconds. If the service stops running, then its hashes will automatically expire after 60 seconds.

```
redis-cli ttl demo:mpush:service:9
(integer) 54
```
where the `TTL` is 54 seconds, i.e. it was renewed 6 seconds ago.

```
redis-cli hkeys demo:mpush:service:9
1) "host"
2) "pid"
3) "started"
4) "renewed"
```
The `renewed` field above, is the heartbeat timestamp. Suffice it to say that if a service fails to renew its hashes, i.e. its heartbeat fails, then it must exit. Incidently, services should perform a startup assert that its key does not exist. The service should routinely ensure the existence of its key, e.g. before its `brpoplpush` operation, and otherwise exit. As a further sanity check, the renewal heartbeat validates that the `renewed` timestamp is unchanged from its previous setting.

Additionally, we enlist registered ids as follows:
- `lpush :ids $id`
- `ltrim :ids 0 $serviceCapacity` to ensure that `:service:ids` is bounded.

```
INFO Service: registered demo:mpush:service:9 { host: 'eowyn', pid: 19897, started: 1458970058 }
```

We can get the latest service id:
```
redis-cli lrange demo:mpush:service:ids -1 -1
1) "9"
```

And inspect its hashes:
```
redis-cli hgetall demo:mpush:service:9
1) "host"
2) "eowyn"
3) "pid"
4) "32534"
5) "started"
6) "1459049541"
```

#### SIGTERM

`SIGTERM` should result in a clean shutdown:
- `del :$id`
- `lrem :ids -1 $id` i.e. scanning from the tail

```
INFO Service: ended demo:mpush:service:9 { del: 1, lrem: 0 }
```

#### pid

Test this using `kill $pid`
```
id=`redis-cli lrange demo:mpush:service:ids -1 -1`
pid=`redis-cli hget demo:mpush:service:$id pid`
kill $pid
```

#### Remote shutdown via Redis

Services must monitor and ensure the existence of their key e.g. before each `brpoplpush` operation, and otherwise exit.

Therefore services can be shutdown via Redis by deleting their key:
```
redis-cli del demo:mpush:service:9
(integer) 0
```

#### Startup

At startup, the service instance must perform garbage-collection on behalf of other expired instances in the same `serviceNamespace.`

In particular, the service compacts the listed `:service:ids` as follows.
- iterate over `:service:ids`
- if any `:service:$id` does not exist, i.e. has expired or was deleted, then `lrem :service:ids -1 $id`

Therefore in the event of a service not shutting down gracefully, the stale `id` will be removed from the `:service:ids` list automatically at a later time.

Let's illustrate this process. Firstly, we iterate over `:service:ids`
```
redis-cli lrange demo:mpush:service:ids 0 -1
1) 9
```
For each `id` we check if key has expired (or was deleted):
```
redis-cli exists demo:mpush:service:9
(integer) 1
```
Finally, we remove any expired service ids from `:service:ids`
```
redis-cli lrem demo:mpush:service:ids -1 9
(integer) 1
```
which scans `:service:ids` from the tail.


#### Bug mitigation

Incidently, to mitigate the risk of services colliding in Redis due to undetected bugs and/or misconfiguration, one can configure a `serviceRedis` URL together with the `serviceNamespace`, and so provision dedicated Redis instances for various pods of services.

Further efforts will be taken, as follows:
- employ a `redisClient` mock for e2e tests
- introduce a `redisClient` safety wrapper e.g. with keyspace constraints


### Message tracking for timeouts and retries

We provide optional components to monitor:
- timeouts, for metrics and retries
- expiry, for garbage-collection

A similar mechanism as that described above for tracking services, is used for tracking messages, as follows:
- `incr :message:id` to obtain a sequential unique message `$id`
- `exists :message:$id` to check that the message key does not exist.
- `hmset :message:$id {fields}` for meta info
- `expire :message:$id $messageExpire` for automatic "garbage-collection"
- `lpush :message:ids $id` to register the new `$id`

Before we push a message, let's check the current sequential `:message:id`
```
redis-cli get demo:mpush:message:id
1) "2"
```
So the next message will be assigned an `id` of `3.`

Let's push a message, namely the number `12345.`
```
redis-cli lpush demo:mpush:in 12345
```

We check the latest message id:
```
redis-cli lrange demo:mpush:message:ids 0 -1
1) 3
```

And the `:message:$id` hashes:
```
redis-cli hgetall demo:mpush:message:3
1) "deadline"
2) "1459103237"
3) "timestamp"
4) "1459103227"
5) "xid"
6) "12345"
```
We record the "deadline" time calculated as `timestamp + timeout.` Suffice it to say that replica instances might have different timeouts, e.g. during rolling reconfigurations.

#### xid

We determine the `xid` as follows:
```javascript
async registerMessage(message) {
   const id = await this.redisClient.incrAsync(this.redisKey('id'));
   logger.debug('registerMessage', id);
   let xid;
   let xidMeta = {id};
   if (/^[0-9]+$/.test(message)) {
      xid = message;
      xidMeta.type = 'number';
   } else if (message.meta && message.meta.id) {
      xid = message.meta.id;
      xidMeta.type = 'meta';
   } else {
      xid = this.service.sha1(message);
      xidMeta.type = 'sha1';
   }
```
where `xid` is the "extracted" intrinsic id of the message as follows:
- if the message itself is a number, then take this as the `xid`
- otherwise `message.meta.id` if this exists
- failing the above, the SHA1 hash of the message as the `xid`


We set a cross-referencing key for a subscriber worker to lookup the message id:
```
redis-cli hgetall demo:mpush:message:xid:12345
1) "id"
2) "3"
3) "type"
4) "number"
```
where the `type` indicates the incoming message itself was a number, i.e. `12345.`

The `:message:xid:$xid` key enables a subscriber worker to lookup the message `id` in order to push it into `:message:done.` Otherwise it will be counted as a timeout i.e. in the `:metrics:timeout` hashes:

```
redis-cli hget demo:mpush:metrics:timeout count
"3"
```

#### Timeout monitor

The `:message:$id` hashes include the `timestamp` of the message. This value is required to detect message timeouts.

The worker microservice which actually handles the message, pushes its id into a `:message:done` list. This list is monitored by our Redis microservice, to detect timeouts i.e. not "done" after the `messageTimeout` period.

Clearly `messageExpire` must be longer than `messageTimeout` to give our monitor sufficient time to detect timeouts.

The "timeout monitor" performs the following:
- `lrange :message:done 0 -1` to check processed messages and update `:metrics:done {count, sum, max}` (hashes)
- `hget :message:$id timestamp` to get the original timestamp of a message
- `hset :metrics:done max $max` to update the peak response time
- `lrem :message:ids -1 $id` to delist expired message ids

The `lrem` command is performed by the monitor when it detects expired ids, i.e. where the `:message:$id` hashes key does not exist e.g. because it was expired by Redis after the configured `$messageExpire` period.


### Metrics

We update `:metrics:$name` hashes with fields `{count, sum, max}.`

```
redis-cli hgetall demo:mpush:metrics:timeout
1) "count"
2) "3"
3) "sum"
4) "30"
5) "max"
6) "10"
```

The average time can be calculated by dividing `sum/count.`

We plan to include histogram data e.g. counting the response times falling between various factors of the timeout:
- `[0, 0.1]`
- `[0.1, 0.2]`
- and similar intervals up to a `[0, 1]`
- as well as the number of timeouts.


### Related projects


#### vpush-redis

An upcoming `vpush-redis` service will "reliably" move messages to a "remote" Redis queue.

That name is an acronym for "value push," since it's purpose is to push a Redis value

The `vpush` microservice must:
- be configured with one input and one output queue on different Redis URLs
- retry delivery of each message indefinitely
- process at most one message at a time, across all replica service instances


#### lpush-redis

We will implement another microservice, namely `lpush,` for the case where input and output queues are on the same Redis instance. This implementation will use `multi.`


### Multiple repos vs a unified toolkit

It might make more sense to combine the various services e.g. `mpush` vs `lpush` et al, into a toolkit, i.e. in one repo.

However, the idea of "immutable microservices" appeals to me. We'll see how it goes.


### Further plans

The over-arching goal is to implement many such microservices for common integration and messaging patterns, for the purpose of composing stateless Redis-based microservices.

- v-push - transport messages to a remote Redis instance
- m-dispatch - tracking messages for response handling, e.g. building a distributed web server
- m-balance - push a message to a work queue with the lowest queue length
- s-register - service self-registration for service discovery
- c-scale - service orchestration triggered by Redis-based messaging
- h-importer - import an HTTP request into a Redis queue for subsequent routing and processing
- h-router - route an HTTP message by matching its URL (using regex)
- h-assets - static webserver for serving assets
- h-react - render a React template
- r-query - retrieve application data from Redis

While Node.js might not be as performant as Go or Rust for example, we nevertheless benefit from the underlying performance of Redis.

"Universal JavaScript" is of course compelling for web development. As a web developer, I favour JavaScript, especially now with ES6 (arrow functions et al) and ES2016 (async/await sugaring of ES6 promises/generators).

I believe that Redis, Node, ES2016, React and stateless microservices are relatively simple, pragmatic and productive. Moreover they are complementary technologies:
- Redis is great for shared state and asynchronous messaging, to enable stateless microservices
- microservices are simple to write
- Node is great for small codebases like microservices
- ES2016 async/await is great for Node

My "stretch goal" would be demonstrating a resilient auto-scaling distributed webserver. I believe that this can be implemented relatively easily by leveraging a Redis Cluster for persistent message storage and shared memory/state for "stateless" microservices. I also favour Redis as a tool for metrics/monitoring and service orchestration.

I'd interested in applying that to a news publishing platform, that retrieves article data stored in Redis, and uses React "templating" to render web pages.


#### rquery

It is envisaged that `rquery` service will accept an array of Redis commands, and return the requested data.

```javascript
{
   paramaters: {
      articleId: 12345
   },
   commands: [
      {
         command: "hget article:$articleId section"
         save: "section"
      },
      {
         command: "hget section:$section label"
         save: "label"
      }
   ]
}
```
where this might return the following results:
```
{
   values: {
      section: 'news',
      label: 'News'
   }
}   
```

### Further reading

#### Redex

While this repo presents a standalone utility for a specific requirement, it is conceptually related to my "Redex" framework for Redis-based messaging - see https://github.com/evanx/redex.
