
# mpush-redis

Note: the correct repo is: https://github.com/evanx/mpush-redis

This is a trivial Redis-based message-parallelizing microservice. It supports a persistent pubsub setup via Redis lists, e.g. to support parallel task queues.

It is built for NodeJS, using the Babel transpiler to support async/await.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple lists, one for each subscriber. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

Incidently, it is possible to provision multiple instances of a subscription "microservice," where any instance can pop the next available message off the same subscription list. Such a system offers resilience and scalability. Clearly the service must be "stateless" in this case, e.g. where its state is externalized (and shared) using Redis.


### Related projects

While this is a standalone utility for a specific requirement, it is conceptually related to my "Redex" framework for Redis-based messaging - see https://github.com/evanx/redex.

Note that this service was simplified by removing message monitoring features. Those will be available in the related service - see https://github.com/evanx/mdispatch-redis.

Also, the capability to configure different Redis instances for output lists was removed. In order to guarantee delivery, clearly this service must use `multi` to atomically push the messages to all output queues.

Moving messages to a remote Redis instance, is a different problem, e.g. we want to retry forever in the event of a "delivery error." This will be addressed in an upcoming `vpush-redis` service. That name is an acronym for "value push," since it's purpose is to push a Redis "value" to a remote instance "reliably."


### Further plans

This is a "microservice" not least by the metric that it was initially developed in a day or so, for some weekend fun. I plan to similarly implement other services, perhaps two per month.

The over-arching goal is to implement many common integration patterns, for the purpose of composing Redis-based microservices.

The power of a system is far greater than the sum of its parts - when those are composable.


### Implementation

This microservice is performs the following Redis operations:

- `brpoplpush` a message from a "published" list, into a "pending" list.
- `lpush` the message to multiple "subscription" lists.
- Finally, remove the message from the "pending" list.

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


#### Installation

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

An optional `redisNamespace` property e.g. `demo:mpush,` is used for lifecycle management, and metrics.

At startup, the service will perform the following to "register" itself:
- `incr :id` to obtain a unique service instance `id`
- `hmset :$id` to record `{host, pid, started}` et al
- `expire :$id $serviceExpire` but renew at an interval sufficiently less than `$serviceExpire`

For example, the `serviceExpire` is defaulted to 60 seconds, whereas the renewal period is 15 seconds.
```
INFO renew: started demo:mpush:9 15
```
So every 15 seconds, the service `:id` hashes will be re-expired to 60 seconds. If the service stops running, then its hashes will automatically expire after 60 seconds.

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

At startup, the service compacts the active `:ids` as follows.
- if `:$id` does not exist e.g. has expired or was deleted, then `lrem :ids -1 $id`

Therefore in the event of a service not shutting down gracefully, the stale `id` will be removed from the `:ids` list automatically at a later time. This will occur after its hashes have expired e.g. 60 seconds after the last renewal.
