slurp
=====

Slurp is a lightweight asynchronous dependency injector. Slurp makes unit testing and mocking easier, and makes networked service discovery easier.

Purpose
-------

Create a tiny asynchronous dependency injector, one which would not fail if a dependency didn't exist, but instead wait for it to exist.

Install
-------

[npm][]
-------

```sh
$ npm install slurp
```

[github][]
----------

```sh
$ git clone https://github.com/skeggse/slurp.git
```

Test
----

Run any of the following.

```sh
$ mocha
$ npm test
$ make test
```

_remember to_ `npm install`!

API
---

### value(name, value)

Registers a static value which is passed to the service or factory callback.

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['speed'], function(speed) {
  console.log(speed); // 88
});

slurp.value('speed', 88);
```

### constructor(name, constructor, [context])

Register a constructor directly, without dependency injection. Use this for networked service discovery when the constructor has already been injected on the remote end. Remote services usually consist of static objects with methods, so value is usually more appropriate for remote services.

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['bleep'], function(bleep) {
  bleep.listen(console.log.bind(console, 'go'));

  for (var i = 0; i < 100; i++) {
    bleep.next();
  }

  // 'go' printed 10 times
});

slurp.constructor('bleep', function() {
  var service = {}, count = 10, listeners = [];

  service.next = function() {
    if (!--count) {
      count = 10;
      listeners.forEach(function(listener) {
        listener();
      });
    }
  };

  service.listen = function(fn) {
    listeners.push(fn);
  };

  // we can't use the this trick because the context is static across instances
  return service;
});
```

### exec(dependencies, callback, [context])

The backbone of Slurp, exec invokes the `callback` with the requested dependencies once all requested dependencies exist.

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['hello'], function(hello) {
  console.log(hello); // prints "hi there" a second after script start
});

setTimeout(function() {
  slurp.value('hello', 'hi there');
}, 1000);
```

### service(name, dependencies, callback, [context])

Register a service for all to see. The provided callback is executed once, and never again. The returned object will be used until/unless it is re-defined.

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['userservice'], function(user) {
  console.log(user.auth()); // prints "hi there" a second after script start
});

slurp.service('userservice', ['hello'], function(hello) {
  this.auth = function() {
    return hello;
  };

  // the this object is defined just below as the context parameter
  return this;
}, {});

setTimeout(function() {
  slurp.value('hello', 'hi there');
}, 1000);
```

The benefit of using `service` over `factory` is the persistent closure without the work:

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['common'], function(common) {
  console.log(common.increment()); // 5
});

slurp.exec(['common'], function(common) {
  console.log(common.increment()); // 6
});

slurp.service('common', ['initial'], function(value) {
  this.increment = function() {
    return value++;
  };

  return this;
}, {});

slurp.value('initial', 4);
```

### factory(name, dependencies, callback, [context])

Register a service factory. The provided callback should return the service constructor function when provided the requested dependencies. Similar to Slurp.service, callback will be called once, but the returned constructor will play again and again.

The context is only applied to the callback, not to the constructor function.

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['userservice'], function(user) {
  console.log(user.auth()); // prints "hi there" a second after script start
});

slurp.service('userservice', ['hello'], function(hello) {
  this.auth = function() {
    return hello;
  };

  // the this object is defined just below as the context parameter
  return this;
}, {});

setTimeout(function() {
  slurp.value('hello', 'hi there');
}, 1000);
```

You can still have a persistent closure, but you have the overhead of creating a new instance of your service every time:

```js
var create = require('slurp');
var slurp = create();

slurp.exec(['common'], function(common) {
  console.log(common.increment()); // 5
});

slurp.exec(['common'], function(common) {
  console.log(common.increment()); // 6
});

// more complicated than it needs to be, use a service
slurp.factory('common', ['initial'], function(value) {
  return function() {
    var service = {};

    service.increment = function() {
      return value++;
    };

    return service;
  };
});

slurp.value('initial', 4);
```

### intercept(fn)

Register an intercept. The provided function should take a `name` and return the module (not factorys) for that instance of the module. If the function returns a falsy value, control passes to the next intercept or to the internal registry.

### resolve(name, callback)

Resolves a single module, calls back with a module instance. Guaranteed asynchronous.

Browser Compatibility
=====================

This is a Node module, and relies on Node's `require`, the built-in `events` library, and the `inherits` function from the built-in `util` library. Browser compatibility not provided to reduce complexity.

TODO
====

* asynchronous intercepts?

Unlicense / Public Domain
=========================

> This is free and unencumbered software released into the public domain.

> Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software, either in source code form or as a compiled binary, for any purpose, commercial or non-commercial, and by any means.

> In jurisdictions that recognize copyright laws, the author or authors of this software dedicate any and all copyright interest in the software to the public domain. We make this dedication for the benefit of the public at large and to the detriment of our heirs and successors. We intend this dedication to be an overt act of relinquishment in perpetuity of all present and future rights to this software under copyright law.

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

> For more information, please refer to <[http://unlicense.org/](http://unlicense.org/)>

[npm]: http://npmjs.org/package/slurp "slurp on npm"
[github]: https://github.com/skeggse/slurp "slurp on github"
