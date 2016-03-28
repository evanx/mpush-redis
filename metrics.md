

## Metrics

An optional `serviceNamespace` configuration property e.g. `"demo:mpush"` is used for metrics.

This can be complemented with an optional `serviceRedis` URL, for the related keys. Otherwise they are stored in the default Redis database, i.e. the same instance as the target `:in` and `:out` queues.

### Implementation

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

We plan to include histogram data e.g. counting the response times falling between 10% intervals of the timeout:
- `histo0` - `[0.0, 0.1)` inclusive of `0` but exclusive of `0.1`
- `histo10` - `[0.1, 0.2)`
- etc
- `histo90` - `[0.9, 1)`
- `histo100` - `[1, 1]` i.e. the number of values greater or equal to the `timeout` interval

Here is a code sample:
```javascript
const [redisTime] = await this.redisClient.timeAsync();
const interval = parseInt(redisTime) - messageTimestamp;
await this.components.metrics.sum('timeout', interval, id);
await this.components.metrics.histo('timeout', Math.min(1, interval/this.props.messageTimeout), id);
```
where we count timeout durations exceeding the `messageTimeout` as having a `normalizedValue` of `1.`

Let's check the timeout metrics:
```
redis-cli hgetall demo:mpush:metrics:timeout
1) "count"
2) "5"
3) "sum"
4) "50"
5) "max"
6) "10"
7) "histo100"
8) "5"
```
where since all timeout durations equal or exceed the `messageTimout` (10 seconds) we only have `histo100` counts (100%).

As mentioned before, the average is calculated as `sum/count`
```
ave=$[ 657/63 ]
10
```

In the case of response times (according to the `:message:done` notification queue), we see other histogram intervals e.g. `histo20` counts the number of response times between 20% to 30% of the `messageTimeout`
```
redis-cli hgetall demo:mpush:metrics:done
 1) "histo20"
 2) "2"
 3) "count"
 4) "6"
 5) "sum"
 6) "42"
 7) "max"
 8) "8"
 9) "histo70"
10) "2"
11) "histo60"
12) "2"
````


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

My "holy grail" goal would be demonstrating a resilient auto-scaling distributed webserver. I believe that this can be implemented relatively easily by leveraging a Redis Cluster for persistent message storage, shared memory/state for "stateless" microservices, metrics/monitoring, and "declarative" service orchestration.

For example, setting the number of replicas for a service in Redis, should enable the activation of standby instances, the automatic provisioning of additional instances, and/or the shutdown of excess instances. The performance and health of services (and hosts) will be monitored via metrics published via Redis, e.g. to rollback faulty updates.

I don't argue that using nginx, Kubernetes, Prometheus etc, is the sane approach. Nevertheless, building a demo as described would be a insane learning experience.


#### rquery

I'm imagine a `rquery` service will accept an array of Redis commands, and return the requested data.

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
