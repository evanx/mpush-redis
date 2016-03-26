
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

From the logs, we deduce that the service performs the following command.

```
brpoplpush demo:mpush:in demo:mpush:pending 5
```
where the blocking pop operation has a configured timeout of 5 seconds (repeated in a infinite loop).

Note that this time determines the duration of a graceful shutdown, because we can only quit when this operation yields.

When the pop yields a message, this service must push this message into the parallel output queues.

Let's manually test this by pushing an incoming message into `:in`

```shell
evans@eowyn:~/mpush-redis$ redis-cli lpush demo:mpush:in one
(integer) 1
```

From the logs, we deduce that the service performs the following Redis commands.
```
lpush demo:mpush:out0 one
lpush demo:mpush:out1 one
```

We check that the message is moved to the parallel output queues.
```shell
evans@eowyn:~/mpush-redis$ redis-cli lrange demo:mpush:out0 0 -1
1) "one"
```
```shell
evans@eowyn:~/mpush-redis$ redis-cli lrange demo:mpush:out1 0 -1
1) "one"
```

### Configuration

Specify the configuration file via the `propsFile` environment variable.

```shell
evanx@eowyn:~/mpush-redis$ propsFile=~/config/mpush-redis.js npm start
```

The specified config file is loaded via `require()` and so can be a `.js` or a `.json` file.


### Lifecycle management

An optional `redisNamespace` configuration property e.g. `"demo:mpush"` is used for lifecycle management, and metrics.

At startup, the service will perform the following to "register" itself:
- `incr :id` to obtain a unique service instance `id`
- `hmset :$id` to record `{host, pid, started}` et al
- `expire :$id $serviceExpire` but renew at an interval sufficiently less than `$serviceExpire`

For example, the `serviceExpire` is defaulted to 60 seconds, whereas the renewal period is 15 seconds.
```
INFO renew: started demo:mpush:9 15
```
So every 15 seconds, expiry of the service `:id` hashes will be renewed to a TTL of 60 seconds. If the service stops running, then its hashes will automatically expire after 60 seconds.

```
redis-cli hkeys demo:mpush:9
1) "host"
2) "pid"
3) "started"
4) "renewed"
```

Additionally, we track activated ids as follows:
- `lpush :ids $id`
- `ltrim :ids 0 $serviceCapacity` to ensure that `:ids` is bounded.

```
INFO Service: registered demo:mpush:9 { host: 'eowyn', pid: 19897, started: 1458970058 }
```

We can get the latest service id as follows:
```
redis-cli lrange demo:mpush:ids -1 -1
1) "9"
```

`SIGTERM` should result in a clean shutdown:
- `del :$id`
- `lrem :ids -1 $id` i.e. scanning from the tail

```
INFO Service: ended demo:mpush:9 { del: 1, lrem: 0 }
```

Test this using `kill $pid`
```
id=`redis-cli lrange demo:mpush:ids -1 -1`
pid=`redis-cli hget demo:mpush:$id pid`
kill $pid
```

Services can be shutdown manually via Redis too:
- `del :$id` to delete the service hashes key, which should cause a shutdown
- `lrem :ids -1 $id`

For example:
```
redis-cli del demo:mpush:9
redis-cli lrem demo:mpush:ids -1 9
```

At startup, the service compacts the listed active `:ids` as follows.
- if any `:$id` (service hashes key) has expired or was deleted, then `lrem :ids -1 $id`

Therefore in the event of a service not shutting down gracefully, the stale `id` will be removed from the `:ids` list automatically at a later time. This will occur after its hashes have expired e.g. 60 seconds after the last renewal.


### Message tracking for timeouts and retries

A similar mechanism as that described above for tracking services, is used for tracking messages, as follows:
- `incr :id` to obrain a sequential unique message `$id`
- `lpush :ids $id` to register the new active `$id`
- `hmset :$id {fields}` for meta info
- `expire :$id $messageExpire` for automatic "garbage-collection"

We require processors to monitor:
- timeouts, for metrics and retries
- expiry, for garbage-collection


#### Expire monitor

The "expired monitor" performs the following garbage-collection:
- `lrange :ids 0 -1` and for each, `exists :$id` to detect expired messages
- `lrem :ids -1 $id` to remove a expired an `id` from the `:ids` list


#### Timeout monitor

The `:$id` hashes includes the `timestamp` of the message. This value is required to detect message timeouts.

The worker microservice which actually handles the message, pushes its id into a `:done` list. This list is monitored by our Redis "message broker" microservice, to detected timeouts i.e. not "done" after the `messageTimeout` period.

Clearly `messageExpire` must be longer than `messageTimeout` to give our monitor sufficient time to detect timeouts.

The "timeout monitor" performs the following:
- `lrange :done 0 -1` to check processed messages and update `:metrics:done {count, sum, max}` hashes
- `hget :$id timestamp` to get the original timestamp of a message
- `hset :metrics:done max $max` to set peak response times
- `lrem :ids -1 $id` for garbage-collection of messages that have expired

The `lrem` command is performed by the monitor when it detects expired ids, i.e. where the `:$id` hashes key does not exist e.g. because it was expired by Redis after the configured `$messageExpire` period.


### Metrics

We update `:metrics:$name` hashes with fields `{count, sum, max}.`

The average time can be calculated by dividing `sum/count.`

We plan to include histogram data e.g. counting the times falling between "tenth percentile" intervals of the timeout, e.g. under 10%, and up to between 90% to 100%, as well as the number of timeouts, i.e. greater than 100%.


### Related projects

While this is a standalone utility for a specific requirement, it is conceptually related to my "Redex" framework for Redis-based messaging - see https://github.com/evanx/redex.

Note that this service was simplified by removing message monitoring features. Those will be available in a related service - see https://github.com/evanx/mdispatch-redis.

Also, the capability to configure different Redis instances for output lists was removed. In order to guarantee delivery, clearly this service must use `multi` to atomically push the messages to all output queues atomically.

Moving messages to a remote Redis instance, is a different problem - namely, reliable/guaranteed delivery. This will be addressed in an upcoming `vpush-redis` service. That name is an acronym for "value push," since it's purpose is to push a Redis "value" to a remote instance "reliably."

#### vpush-redis

The `vpush` microservice must:
- be configured with one input and one output queue on different Redis URLs
- retry delivery of each message indefinitely
- process at most one message at a time, across all shared-state replica service instances

They must be on separate Redis instances, since it would not use `multi.`

##### lpush-redis

As such, we might implement another service, namely `lpush,` for input and output queues that must be on the same Redis instance. This implementation would `multi.`


### Multiple repos vs a unified toolkit

It might make more sense to combine the various services e.g. `mpush` vs `lpush` et al, into a toolkit, i.e. in one repo.

However, the idea of "immutable microservices" appeals to me. We'll see how that goes. Probably I will also combine them into one toolkit to rule them all.

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

My "holy grail" would be a resilient auto-scaling distributed webserver. I believe that this can be implemented relatively easily by leveraging a Redis Cluster for persistent message storage, and shared memory/state for "stateless" microservices. I also favour Redis as a tool for metrics/monitoring, and service orchestration.

I'm interested in applying this to a news publishing platform, that retrieves article data stored in Redis, and uses React "templating" to render web pages.
