
# mpush-redis

This is a trivial Redis-based message-parallelizing microservice. It supports a persistent pubsub setup via Redis lists, e.g. to support parallel task queues.

It is built for NodeJS, using the Babel transpiler to support async/await.

In practice, some "publisher" pushes a message onto a Redis list. This service pops those messages, and pushes each message onto multiple lists, one for each subscriber. Each subscriber pops messages from their own dedicated Redis list.

Clearly if a subscriber is offline, its incoming messages are "persistent" since they accumulate in Redis, and are available when the subscriber comes online again.

Incidently, it is possible to provision multiple instances of a subscription "microservice," where any instance can pop the next available message off the same subscription list. Such a system offers resilience and scalability. Clearly the service must be "stateless" in this case, e.g. where its state is externalized (and shared) using Redis.

Note that this service will be simplified by removing deprecated message monitoring features. Those will be available in the related service `mdispatch-redis` - see https://github.com/evanx/mdispatch-redis.


### Related projects

While this is a standalone utility for a specific requirement, it is conceptually related to my "Redex" framework for Redis-based messaging - see https://github.com/evanx/redex.

This service was mostly implemented on a weekend. I plan to implement others in a similar vein, perhaps two per month.

The over-arching goal is to implement many common integration patterns, for the purpose of composing Redis-based microservices.


### Implementation

This microservice is performs the following Redis operations:

- `brpoplpush` a message from a "published" list, into a "pending" list.
- `lpush` the message to multiple "subscription" lists.
- Finally, remove the message from the "pending" list.

Herewith a simplified code snippet for illustration:
```javascript
   const message = await this.redisClient.brpoplpushAsync(this.app.config.in,
      this.app.config.pending, this.app.config.popTimeout);
   if (message) {
      const multi = this.redisClient.multi();
      this.app.config.out.forEach(out => multi.lpush(out, message));
      multi.lrem(this.app.config.pending, -1, message);
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
      redisNamespace: 'demo:mpush',
      in: 'demo:mpush:in',
      pending: 'demo:mpush:pending',
      done: 'demo:mpush:done',
      popTimeout: 10,
      out: [ 'demo:mpush:out0', 'demo:mpush:out1' ]
```

We push an incoming message into `:in`

```shell
evans@eowyn:~/mpush-redis$ redis-cli lpush demo:mpush:in one
(integer) 1
```

From the logs, we see that the service performs the following Redis commands.

```
INFO App: brpoplpush demo:mpush:in demo:mpush:pending 10
INFO App: lpush demo:mpush:out0 one
INFO App: lpush demo:mpush:out1 one
```
where the blocking pop operation has a configured timeout of 10 seconds (repeated in a infinite loop). When the pop yields a message, this is pushed into the parallel output queues.

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

Specify the configuration file as a command-line parameter.

```shell
evanx@eowyn:~/mpush-redis$ node index.js ~/config/mpush-redis.js | bunyan
```

The specified config file is loaded via `require()` and so can be a `.js` or a `.json` file.

#### TODO

- Optionally load configuration from Redis hashes.
- Support `SIGHUP` and/or notification via Redis to hot reload an updated configuration.
