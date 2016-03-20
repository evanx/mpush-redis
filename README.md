
# redex-mpush

INCOMPLETE WORK IN PROGRESS - DO NOT USE

This is a Redis-based message-parallelizing microservice. Specifically, it supports a persistent pubsub setup via Redis lists, for pre-defined static subscribers, or pipelines.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple "subscriber" lists. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

The implementation detail is that this microservice will `brpop` from a "publishing" list, and `lpush` to multiple "subscribing" lists, as per its configuration file.

Incidently, it is advisable to provision multiple instances of a subscriber "microservice," where each instance can pop off the same subscription list. Such a system can provide resilience and scalability.


#### Installation

```shell
git clone https://github.com/evanx/redex-mpush
cd redex-mpush
npm install
```

```shell
npm demo
```

```shell
INFO App:
    start { redis: 'redis://localhost:6379',
      redisNamespace: 'demo:mpush',
      popTimeout: 10,
      in: 'demo:mpush:in',
      pending: 'demo:mpush:pending',
      out: [ 'demo:mpush:out1', 'demo:mpush:out2' ] }
```

```shell
evans@eowyn:~/redex-mpush$ redis-cli lpush demo:mpush:in one
(integer) 1
```

```
INFO App: brpoplpush demo:mpush:in demo:mpush:pending 10
INFO App: lpush one demo:mpush:out1 demo:mpush:out2
INFO App: lpush demo:mpush:out1 one
INFO App: lpush demo:mpush:out2 one
```

```shell
evans@eowyn:~/redex-mpush$ redis-cli lrange demo:mpush:out1 0 -1
1) "one"
```
