
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
npm demo
```
