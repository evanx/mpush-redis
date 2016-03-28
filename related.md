

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

- vpush - transport messages to a remote Redis instance
- mdispatch - tracking messages for response handling, e.g. building a distributed web server
- mbalance - push a message to a work queue with the lowest queue length
- hfiler - file server for serving static assets i.e. a "static webserver"
- hgateway - import an HTTP request into a Redis queue for subsequent routing and processing
- hrouter - route an HTTP message by matching its URL (using regex)
- hrender - render a React template
- rquery - retrieve application data from Redis
- rdeploy - NPM module installation triggered by Redis-based messaging
- rcontrol - service "orchestration" e.g. control and monitoring, triggered by Redis-based messaging

Where all services interact with each other via Redis. Typically these are microservices that interact internally via Redis, and externally via HTTP.

For example, the `hgateway` and `hfiler` services include a "web server" e.g. ExpressJS.

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

#### hgateway

This implements a "web server", i.e. accepts incoming HTTP requests e.g. via ExpressJS i.e. via TCP/IP socket. However, its purpose however is to merely to publish these into a Redis queue for further processing by other microservices. Those services will accept HTTP-request messages via a Redis queue, rather than a TCP/IP socket.

`hgateway` must:
- discover its configuration, including the HTTP port, via Redis hashes.
- start webserver on the configured port i.e. `listen(PORT)` for incoming HTTP requests.
- implement a request handler e.g. invoked by ExpressJS with `(req, res)`
- schedule a timeout handler e.g. a closure with access to `res`
- construct an HTTP request message i.e. including the URL, HTTP headers and "body content."
- push this "immutable" message into a Redis list e.g. `hgateway:req`
- `brpoplpush` a response message from a Redis list e.g. `hgateway:res`
- respond to the original HTTP request via ExpressJS
- ensure that the timeout handler will

#### hfiler

`hfiler` implements an HTTP service, meaning it processes HTTP messages. However it is not an "HTTP server" in the usual sense i.e. binding to a TCP/IP socket.

Its purpose is to enable a "static webserver" e.g. for serving assets.

`hfiler` must:
- match an HTTP request URL to a file-system based asset
- load this asset from the filesystem into Redis, with flexible expiry
- enable programmable expiry via a configurable Node module path
- optionally gzip the content in Redis


#### rquery

I'm imagining a simple `rquery` service will accept an array of Redis commands, and return the requested data.

```shell
redis-cli get rquery:clihelp
Welcome to @rquery from service 1
For request message in YAML format, use #rquery:req:yaml  
```
where we can interact with the service via the Redis CLI e.g. for demo purposes.


#### News/blog article

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

In practice, we must `brpoplpush :req :pending` e.g. so that crashes can be detected via `:pending` and perhaps even recovered e.g. in the event that some new version of the service instance is crashing after popping the message. In this scenario, we must detect the faulty instance, deregister it and schedule its shutdown e.g. `del` its service key.


### Further reading

Service lifecycle management: https://github.com/evanx/mpush-redis/blob/master/service.md

Message lifecycle management, for timeouts etc: https://github.com/evanx/mpush-redis/blob/master/message.md

Metrics, for timeouts etc: https://github.com/evanx/mpush-redis/blob/master/metrics.md

Related projects and further plans: https://github.com/evanx/mpush-redis/blob/master/related.md

#### Redex

While this repo presents a standalone utility for a specific requirement, it is conceptually related to my "Redex" framework for Redis-based messaging - see https://github.com/evanx/redex.