
# redex-mpush

This is a Redis-based message-parallelizing microservice. Specifically, it supports a persistent pubsub setup via Redis lists, for pre-defined static subscribers, or pipelines.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple "subscriber" lists. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

Incidently, it is advisable to provision multiple instances of a subscriber "microservice," where any instance can pop the next message off the same subscription list. Such a system offers resilience and scalability.


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
      redis: 'redis://localhost:6379',
      redisNamespace: 'demo:mpush',
      in: 'demo:mpush:in',
      pending: 'demo:mpush:pending',
      popTimeout: 10,
      out: [ 'demo:mpush:out1', 'demo:mpush:out2' ],
      done: 'demo:mpush:done'
```

We push an incoming message into `:in`

```shell
evans@eowyn:~/redex-mpush$ redis-cli lpush demo:mpush:in one
(integer) 1
```

From the logs, we see that the service performs the following Redis commands.

```
INFO App: brpoplpush demo:mpush:in demo:mpush:pending 10
INFO App: lpush demo:mpush:out1 one
INFO App: lpush demo:mpush:out2 one
```

We check that the message is moved to the parallel output queues.
```shell
evans@eowyn:~/redex-mpush$ redis-cli lrange demo:mpush:out1 0 -1
1) "one"
```

Additionally, an optional `messageCapacity` can be configured, for tracking pending messages. Pending messages are assigned an `id` by incrementing a Redis `id` key e.g. `demo:mpush:id` and pushing the pending `id` onto `demo:mpush:ids.`

The message `timestamp` is recorded in Redis hashes `demo:mpush:message:$id.` The message hashes keys expire after the configured period `messageExpire` seconds.

The id of a message that has been processed should be pushed to `demo:mpush:done` by the subscriber that processes the message. Otherwise the message will timeout, e.g. see the hashes `demo:mpush:metrics:timeout.`
