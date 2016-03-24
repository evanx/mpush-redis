
# redex-mpush

This is a Redis-based message-parallelizing microservice. Specifically, it supports a persistent pubsub setup via Redis lists, for pre-defined static subscribers.

This can be used for dispatching each incoming message into multiple parallel output work queues.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple lists, one for each subscriber. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

Incidently, it is possible to provision multiple instances of a subscription "microservice," where any instance can pop the next available message off the same subscription list. Such a system offers resilience and scalability. Clearly the service must be "stateless" in this case, e.g. where state is externalized (and shared) using Redis.


### Related

While this is a standalone utility, see my "Redex" framework for Redis-based messaging -
<a href=https://github.com/evanx/redex>github.com/evanx/redex</a>.

### Implementation

This microservice will `brpoplpush` from a "publishing" list, into a "pending" list, and then `lpush` to multiple "subscribing" lists, as per its configuration file. Finally, it will remove the message from the "pending" list.

#### Installation

```shell
git clone https://github.com/evanx/redex-mpush
cd redex-mpush
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
      redisNamespace: 'demo:mpush',
      in: 'demo:mpush:in',
      pending: 'demo:mpush:pending',
      done: 'demo:mpush:done',
      popTimeout: 10,
      out: [ 'demo:mpush:out0', 'redis://localhost:6379/1/demo:mpush:out1' ]
```
where the `out1` queue is configured as `redis://localhost:6379/1` i.e. on a different Redis database (number 1).

We push an incoming message into `:in`

```shell
evans@eowyn:~/redex-mpush$ redis-cli lpush demo:mpush:in one
(integer) 1
```

From the logs, we see that the service performs the following Redis commands.

```
INFO App: brpoplpush demo:mpush:in demo:mpush:pending 10
INFO App: lpush redis://localhost:6379/0 demo:mpush:out0 one
INFO App: lpush redis://localhost:6379/1 demo:mpush:out1 one
```
where the blocking pop operation has a configured timeout of 10 seconds (but is repeated in a infinite loop. When the pop yields a message, this is pushed into the parallel output queues.

We check that the message is moved to the parallel output queues.
```shell
evans@eowyn:~/redex-mpush$ redis-cli lrange demo:mpush:out0 0 -1
1) "one"
```
```shell
evans@eowyn:~/redex-mpush$ redis-cli -n 1 lrange demo:mpush:out1 0 -1
1) "one"
```

Additionally, an optional `messageCapacity` can be configured, for tracking pending messages. Pending messages are assigned an `id` by incrementing a Redis `id` key e.g. `demo:mpush:id` and pushing the pending `id` onto `demo:mpush:ids`.

However, if a message is itself a number, then that is used for the `id.` For example, the publisher might increment `demo:mpush:id,` create the `demo:mpush:message:$id` hashes with `request` content, and push the `id` into `:in`. The subscriber might set the `response` on these hashes, for response processing.

The message `timestamp` is recorded in Redis hashes `demo:mpush:message:$id.` The message hashes expire from Redis after the configured period `messageExpire` (seconds).

The id of a message that has been processed should be pushed to `demo:mpush:done` by the subscriber that processes the message. Otherwise the message will timeout automatically, e.g. see the hashes `demo:mpush:metrics:timeout`.
