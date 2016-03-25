
# mpush-redis

This is a trivial Redis-based message-parallelizing microservice. It supports a persistent pubsub setup via Redis lists, e.g. to support parallel task queues.

It is built for NodeJS, using the Babel transpiler to support async/await.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple lists, one for each subscriber. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

Incidently, it is possible to provision multiple instances of a subscription "microservice," where any instance can pop the next available message off the same subscription list. Such a system offers resilience and scalability. Clearly the service must be "stateless" in this case, e.g. where its state is externalized (and shared) using Redis.

Note that this service will be simplified by removing already-deprecated message monitoring features. Those will be available in `mdispatch-redis.`
 

### Related projects

While this is a standalone utility for a specific requirement, it is inspired by "Redex" framework for Redis-based messaging - <a href="https://github.com/evanx/redex">github.com/evanx/redex</a>.

This service was mostly implemented on a weekend. I plan to implement others in a similar vein, perhaps two per month. 


The over-arching goal is to implement many common integration patterns, for the purpose of composing Redis-based microservices.


### Implementation

This microservice is performs the following Redis operations: 

- `brpoplpush` a message from a "published" list, into a "pending" list.
- `lpush` the message to multiple "subscription" lists.
- Finally, remove the message from the "pending" list.


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
evans@eowyn:~/mpush-redis$ redis-cli lpush demo:mpush:in one
(integer) 1
```

From the logs, we see that the service performs the following Redis commands.

```
INFO App: brpoplpush demo:mpush:in demo:mpush:pending 10
INFO App: lpush redis://localhost:6379/0 demo:mpush:out0 one
INFO App: lpush redis://localhost:6379/1 demo:mpush:out1 one
```
where the blocking pop operation has a configured timeout of 10 seconds (repeated in a infinite loop). When the pop yields a message, this is pushed into the parallel output queues.

We check that the message is moved to the parallel output queues.
```shell
evans@eowyn:~/mpush-redis$ redis-cli lrange demo:mpush:out0 0 -1
1) "one"
```
```shell
evans@eowyn:~/mpush-redis$ redis-cli -n 1 lrange demo:mpush:out1 0 -1
1) "one"
```

### Advanced/experimental usage

Additionally, an optional `messageCapacity` can be configured, for monitoring pending messages. Pending messages are assigned an `id` by incrementing a Redis `id` key e.g. `demo:mpush:id` and pushing the pending `id` onto `demo:mpush:ids`.

However, if a message is itself a number, then that is used for the `id.` For example, the publisher might increment `demo:mpush:id,` create the `demo:mpush:message:$id` hashes with `request` content, and push the `id` into `:in`. The subscriber might set the `response` on these hashes, for async response processing, e.g. by the original publisher.

The message `timestamp` is recorded in Redis hashes `demo:mpush:message:$id.` The `:message:$id` hashes expire from Redis after the configured period `messageExpire` (seconds).

The id of a message that has been processed should be pushed to `demo:mpush:done` by the subscriber that processes the message. Otherwise the message will timeout automatically, e.g. see the hashes `demo:mpush:metrics:timeout`.

```
evans@eowyn:~/mpush-redis$ redis-cli hgetall demo:mpush:metrics:timeout
1) "count"
2) "1"
3) "sum"
4) "10"
5) "max"
6) "10"
```
where `sum` and `max` are seconds. The average time is calculated by dividing `sum` by `count.` For `:metrics:timeout,` we expect the average and `max` values to be similar to the configured `messageTimeout` e.g. 10 seconds.

Note that the `messageExpire` should exceed the `messageTimeout` sufficiently, for the service to get the message `timestamp` from the `:message:$id` hashes, in order to update the `:metrics:timeout.`

<b>Note that this message monitoring feature is likely to be deprecated from this service, to keep it simple.</b> It will be supported by a more sophisticated service, namely http://github.com/evanx/mdispatch-redis.


### Configuration

Specify the configuration file as a command-line parameter.

```shell
evanx@eowyn:~/mpush-redis$ node index.js ~/config/mpush-redis.js | bunyan
```

The specified config file is loaded via `require()` and so can be a `.js` or a `.json` file.

#### TODO

- Optionally load configuration from Redis hashes.
- Support `SIGHUP` and/or notification via Redis to hot reload an updated configuration.
