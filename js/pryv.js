(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.pryv = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (process){
/*!
 * async
 * https://github.com/caolan/async
 *
 * Copyright 2010-2014 Caolan McMahon
 * Released under the MIT license
 */
/*jshint onevar: false, indent:4 */
/*global setImmediate: false, setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root, previous_async;

    root = this;
    if (root != null) {
      previous_async = root.async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _toString = Object.prototype.toString;

    var _isArray = Array.isArray || function (obj) {
        return _toString.call(obj) === '[object Array]';
    };

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _each(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _each(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = function (fn) {
              // not a direct alias for IE10 compatibility
              setImmediate(fn);
            };
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.each = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _each(arr, function (x) {
            iterator(x, only_once(done) );
        });
        function done(err) {
          if (err) {
              callback(err);
              callback = function () {};
          }
          else {
              completed += 1;
              if (completed >= arr.length) {
                  callback();
              }
          }
        }
    };
    async.forEach = async.each;

    async.eachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };
    async.forEachSeries = async.eachSeries;

    async.eachLimit = function (arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
    };
    async.forEachLimit = async.eachLimit;

    var _eachLimit = function (limit) {

        return function (arr, iterator, callback) {
            callback = callback || function () {};
            if (!arr.length || limit <= 0) {
                return callback();
            }
            var completed = 0;
            var started = 0;
            var running = 0;

            (function replenish () {
                if (completed >= arr.length) {
                    return callback();
                }

                while (running < limit && started < arr.length) {
                    started += 1;
                    running += 1;
                    iterator(arr[started - 1], function (err) {
                        if (err) {
                            callback(err);
                            callback = function () {};
                        }
                        else {
                            completed += 1;
                            running -= 1;
                            if (completed >= arr.length) {
                                callback();
                            }
                            else {
                                replenish();
                            }
                        }
                    });
                }
            })();
        };
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.each].concat(args));
        };
    };
    var doParallelLimit = function(limit, fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.eachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        if (!callback) {
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err) {
                    callback(err);
                });
            });
        } else {
            var results = [];
            eachfn(arr, function (x, callback) {
                iterator(x.value, function (err, v) {
                    results[x.index] = v;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);
    async.mapLimit = function (arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
    };

    var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
    };

    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.eachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.each(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        var remainingTasks = keys.length
        if (!remainingTasks) {
            return callback();
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            remainingTasks--
            _each(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (!remainingTasks) {
                var theCallback = callback;
                // prevent final callback from calling itself if it errors
                callback = function () {};

                theCallback(null, results);
            }
        });

        _each(keys, function (k) {
            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
            var taskCallback = function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                    args = args[0];
                }
                if (err) {
                    var safeResults = {};
                    _each(_keys(results), function(rkey) {
                        safeResults[rkey] = results[rkey];
                    });
                    safeResults[k] = args;
                    callback(err, safeResults);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    results[k] = args;
                    async.setImmediate(taskComplete);
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        // Use defaults if times not passed
        if (typeof times === 'function') {
            callback = task;
            task = times;
            times = DEFAULT_TIMES;
        }
        // Make sure times is a number
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
            var retryAttempt = function(task, finalAttempt) {
                return function(seriesCallback) {
                    task(function(err, result){
                        seriesCallback(!err || finalAttempt, {err: err, result: result});
                    }, wrappedResults);
                };
            };
            while (times) {
                attempts.push(retryAttempt(task, !(times-=1)));
            }
            async.series(attempts, function(done, data){
                data = data[data.length - 1];
                (wrappedCallback || callback)(data.err, data.result);
            });
        }
        // If a callback is passed, run this as a controll flow
        return callback ? wrappedTask() : wrappedTask
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!_isArray(tasks)) {
          var err = new Error('First argument to waterfall must be an array of functions');
          return callback(err);
        }
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback.apply(null, arguments);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.setImmediate(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            eachfn.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            eachfn.each(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.parallel = function (tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
    };

    async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (_isArray(tasks)) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.eachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doWhilst = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (test.apply(null, args)) {
                async.doWhilst(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.doUntil = function (iterator, test, callback) {
        iterator(function (err) {
            if (err) {
                return callback(err);
            }
            var args = Array.prototype.slice.call(arguments, 1);
            if (!test.apply(null, args)) {
                async.doUntil(iterator, test, callback);
            }
            else {
                callback();
            }
        });
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            started: false,
            paused: false,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            kill: function () {
              q.drain = null;
              q.tasks = [];
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (!q.paused && workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            },
            idle: function() {
                return q.tasks.length + workers === 0;
            },
            pause: function () {
                if (q.paused === true) { return; }
                q.paused = true;
                q.process();
            },
            resume: function () {
                if (q.paused === false) { return; }
                q.paused = false;
                q.process();
            }
        };
        return q;
    };
    
    async.priorityQueue = function (worker, concurrency) {
        
        function _compareTasks(a, b){
          return a.priority - b.priority;
        };
        
        function _binarySearch(sequence, item, compare) {
          var beg = -1,
              end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + ((end - beg + 1) >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        
        function _insert(q, data, priority, callback) {
          if (!q.started){
            q.started = true;
          }
          if (!_isArray(data)) {
              data = [data];
          }
          if(data.length == 0) {
             // call drain immediately if there are no tasks
             return async.setImmediate(function() {
                 if (q.drain) {
                     q.drain();
                 }
             });
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  priority: priority,
                  callback: typeof callback === 'function' ? callback : null
              };
              
              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

              if (q.saturated && q.tasks.length === q.concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }
        
        // Start with a normal queue
        var q = async.queue(worker, concurrency);
        
        // Override push to accept second parameter representing priority
        q.push = function (data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        
        // Remove unshift function
        delete q.unshift;

        return q;
    };

    async.cargo = function (worker, payload) {
        var working     = false,
            tasks       = [];

        var cargo = {
            tasks: tasks,
            payload: payload,
            saturated: null,
            empty: null,
            drain: null,
            drained: true,
            push: function (data, callback) {
                if (!_isArray(data)) {
                    data = [data];
                }
                _each(data, function(task) {
                    tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    cargo.drained = false;
                    if (cargo.saturated && tasks.length === payload) {
                        cargo.saturated();
                    }
                });
                async.setImmediate(cargo.process);
            },
            process: function process() {
                if (working) return;
                if (tasks.length === 0) {
                    if(cargo.drain && !cargo.drained) cargo.drain();
                    cargo.drained = true;
                    return;
                }

                var ts = typeof payload === 'number'
                            ? tasks.splice(0, payload)
                            : tasks.splice(0, tasks.length);

                var ds = _map(ts, function (task) {
                    return task.data;
                });

                if(cargo.empty) cargo.empty();
                working = true;
                worker(ds, function () {
                    working = false;

                    var args = arguments;
                    _each(ts, function (data) {
                        if (data.callback) {
                            data.callback.apply(null, args);
                        }
                    });

                    process();
                });
            },
            length: function () {
                return tasks.length;
            },
            running: function () {
                return working;
            }
        };
        return cargo;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _each(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                async.nextTick(function () {
                    callback.apply(null, memo[key]);
                });
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

    async.times = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.map(counter, iterator, callback);
    };

    async.timesSeries = function (count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
            counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
    };

    async.seq = function (/* functions... */) {
        var fns = arguments;
        return function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            async.reduce(fns, args, function (newargs, fn, cb) {
                fn.apply(that, newargs.concat([function () {
                    var err = arguments[0];
                    var nextargs = Array.prototype.slice.call(arguments, 1);
                    cb(err, nextargs);
                }]))
            },
            function (err, results) {
                callback.apply(that, [err].concat(results));
            });
        };
    };

    async.compose = function (/* functions... */) {
      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
    };

    var _applyEach = function (eachfn, fns /*args...*/) {
        var go = function () {
            var that = this;
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            },
            callback);
        };
        if (arguments.length > 2) {
            var args = Array.prototype.slice.call(arguments, 2);
            return go.apply(this, args);
        }
        else {
            return go;
        }
    };
    async.applyEach = doParallel(_applyEach);
    async.applyEachSeries = doSeries(_applyEach);

    async.forever = function (fn, callback) {
        function next(err) {
            if (err) {
                if (callback) {
                    return callback(err);
                }
                throw err;
            }
            fn(next);
        }
        next();
    };

    // Node.js
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    // AMD / RequireJS
    else if (typeof define !== 'undefined' && define.amd) {
        define([], function () {
            return async;
        });
    }
    // included directly via <script> tag
    else {
        root.async = async;
    }

}());

}).call(this,require('_process'))
},{"_process":21}],2:[function(require,module,exports){
(function (process,Buffer){
var CombinedStream = require('combined-stream');
var util = require('util');
var path = require('path');
var http = require('http');
var https = require('https');
var parseUrl = require('url').parse;
var fs = require('fs');
var mime = require('mime');
var async = require('async');

module.exports = FormData;
function FormData() {
  this._overheadLength = 0;
  this._valueLength = 0;
  this._lengthRetrievers = [];

  CombinedStream.call(this);
}
util.inherits(FormData, CombinedStream);

FormData.LINE_BREAK = '\r\n';

FormData.prototype.append = function(field, value, options) {
  options = options || {};

  var append = CombinedStream.prototype.append.bind(this);

  // all that streamy business can't handle numbers
  if (typeof value == 'number') value = ''+value;

  // https://github.com/felixge/node-form-data/issues/38
  if (util.isArray(value)) {
    // Please convert your array into string
    // the way web server expects it
    this._error(new Error('Arrays are not supported.'));
    return;
  }

  var header = this._multiPartHeader(field, value, options);
  var footer = this._multiPartFooter(field, value, options);

  append(header);
  append(value);
  append(footer);

  // pass along options.knownLength
  this._trackLength(header, value, options);
};

FormData.prototype._trackLength = function(header, value, options) {
  var valueLength = 0;

  // used w/ getLengthSync(), when length is known.
  // e.g. for streaming directly from a remote server,
  // w/ a known file a size, and not wanting to wait for
  // incoming file to finish to get its size.
  if (options.knownLength != null) {
    valueLength += +options.knownLength;
  } else if (Buffer.isBuffer(value)) {
    valueLength = value.length;
  } else if (typeof value === 'string') {
    valueLength = Buffer.byteLength(value);
  }

  this._valueLength += valueLength;

  // @check why add CRLF? does this account for custom/multiple CRLFs?
  this._overheadLength +=
    Buffer.byteLength(header) +
    + FormData.LINE_BREAK.length;

  // empty or either doesn't have path or not an http response
  if (!value || ( !value.path && !(value.readable && value.hasOwnProperty('httpVersion')) )) {
    return;
  }

  // no need to bother with the length
  if (!options.knownLength)
  this._lengthRetrievers.push(function(next) {

    if (value.hasOwnProperty('fd')) {

      // take read range into a account
      // `end` = Infinity –> read file till the end
      //
      // TODO: Looks like there is bug in Node fs.createReadStream
      // it doesn't respect `end` options without `start` options
      // Fix it when node fixes it.
      // https://github.com/joyent/node/issues/7819
      if (value.end != undefined && value.end != Infinity && value.start != undefined) {

        // when end specified
        // no need to calculate range
        // inclusive, starts with 0
        next(null, value.end+1 - (value.start ? value.start : 0));

      // not that fast snoopy
      } else {
        // still need to fetch file size from fs
        fs.stat(value.path, function(err, stat) {

          var fileSize;

          if (err) {
            next(err);
            return;
          }

          // update final size based on the range options
          fileSize = stat.size - (value.start ? value.start : 0);
          next(null, fileSize);
        });
      }

    // or http response
    } else if (value.hasOwnProperty('httpVersion')) {
      next(null, +value.headers['content-length']);

    // or request stream http://github.com/mikeal/request
    } else if (value.hasOwnProperty('httpModule')) {
      // wait till response come back
      value.on('response', function(response) {
        value.pause();
        next(null, +response.headers['content-length']);
      });
      value.resume();

    // something else
    } else {
      next('Unknown stream');
    }
  });
};

FormData.prototype._multiPartHeader = function(field, value, options) {
  var boundary = this.getBoundary();
  var header = '';

  // custom header specified (as string)?
  // it becomes responsible for boundary
  // (e.g. to handle extra CRLFs on .NET servers)
  if (options.header != null) {
    header = options.header;
  } else {
    header += '--' + boundary + FormData.LINE_BREAK +
      'Content-Disposition: form-data; name="' + field + '"';

    // fs- and request- streams have path property
    // or use custom filename and/or contentType
    // TODO: Use request's response mime-type
    if (options.filename || value.path) {
      header +=
        '; filename="' + path.basename(options.filename || value.path) + '"' + FormData.LINE_BREAK +
        'Content-Type: ' +  (options.contentType || mime.lookup(options.filename || value.path));

    // http response has not
    } else if (value.readable && value.hasOwnProperty('httpVersion')) {
      header +=
        '; filename="' + path.basename(value.client._httpMessage.path) + '"' + FormData.LINE_BREAK +
        'Content-Type: ' + value.headers['content-type'];
    }

    header += FormData.LINE_BREAK + FormData.LINE_BREAK;
  }

  return header;
};

FormData.prototype._multiPartFooter = function(field, value, options) {
  return function(next) {
    var footer = FormData.LINE_BREAK;

    var lastPart = (this._streams.length === 0);
    if (lastPart) {
      footer += this._lastBoundary();
    }

    next(footer);
  }.bind(this);
};

FormData.prototype._lastBoundary = function() {
  return '--' + this.getBoundary() + '--';
};

FormData.prototype.getHeaders = function(userHeaders) {
  var formHeaders = {
    'content-type': 'multipart/form-data; boundary=' + this.getBoundary()
  };

  for (var header in userHeaders) {
    formHeaders[header.toLowerCase()] = userHeaders[header];
  }

  return formHeaders;
}

FormData.prototype.getCustomHeaders = function(contentType) {
    contentType = contentType ? contentType : 'multipart/form-data';

    var formHeaders = {
        'content-type': contentType + '; boundary=' + this.getBoundary(),
        'content-length': this.getLengthSync()
    };

    return formHeaders;
}

FormData.prototype.getBoundary = function() {
  if (!this._boundary) {
    this._generateBoundary();
  }

  return this._boundary;
};

FormData.prototype._generateBoundary = function() {
  // This generates a 50 character boundary similar to those used by Firefox.
  // They are optimized for boyer-moore parsing.
  var boundary = '--------------------------';
  for (var i = 0; i < 24; i++) {
    boundary += Math.floor(Math.random() * 10).toString(16);
  }

  this._boundary = boundary;
};

// Note: getLengthSync DOESN'T calculate streams length
// As workaround one can calculate file size manually
// and add it as knownLength option
FormData.prototype.getLengthSync = function(debug) {
  var knownLength = this._overheadLength + this._valueLength;

  // Don't get confused, there are 3 "internal" streams for each keyval pair
  // so it basically checks if there is any value added to the form
  if (this._streams.length) {
    knownLength += this._lastBoundary().length;
  }

  // https://github.com/felixge/node-form-data/issues/40
  if (this._lengthRetrievers.length) {
    // Some async length retrivers are present
    // therefore synchronous length calculation is false.
    // Please use getLength(callback) to get proper length
    this._error(new Error('Cannot calculate proper length in synchronous way.'));
  }

  return knownLength;
};

FormData.prototype.getLength = function(cb) {
  var knownLength = this._overheadLength + this._valueLength;

  if (this._streams.length) {
    knownLength += this._lastBoundary().length;
  }

  if (!this._lengthRetrievers.length) {
    process.nextTick(cb.bind(this, null, knownLength));
    return;
  }

  async.parallel(this._lengthRetrievers, function(err, values) {
    if (err) {
      cb(err);
      return;
    }

    values.forEach(function(length) {
      knownLength += length;
    });

    cb(null, knownLength);
  });
};

FormData.prototype.submit = function(params, cb) {

  var request
    , options
    , defaults = {
        method : 'post'
    };

  // parse provided url if it's string
  // or treat it as options object
  if (typeof params == 'string') {
    params = parseUrl(params);

    options = populate({
      port: params.port,
      path: params.pathname,
      host: params.hostname
    }, defaults);
  }
  else // use custom params
  {
    options = populate(params, defaults);
    // if no port provided use default one
    if (!options.port) {
      options.port = options.protocol == 'https:' ? 443 : 80;
    }
  }

  // put that good code in getHeaders to some use
  options.headers = this.getHeaders(params.headers);

  // https if specified, fallback to http in any other case
  if (params.protocol == 'https:') {
    request = https.request(options);
  } else {
    request = http.request(options);
  }

  // get content length and fire away
  this.getLength(function(err, length) {

    // TODO: Add chunked encoding when no length (if err)

    // add content length
    request.setHeader('Content-Length', length);

    this.pipe(request);
    if (cb) {
      request.on('error', cb);
      request.on('response', cb.bind(this, null));
    }
  }.bind(this));

  return request;
};

FormData.prototype._error = function(err) {
  if (this.error) return;

  this.error = err;
  this.pause();
  this.emit('error', err);
};

/*
 * Santa's little helpers
 */

// populates missing values
function populate(dst, src) {
  for (var prop in src) {
    if (!dst[prop]) dst[prop] = src[prop];
  }
  return dst;
}

}).call(this,require('_process'),require("buffer").Buffer)
},{"_process":21,"async":1,"buffer":8,"combined-stream":3,"fs":6,"http":13,"https":17,"mime":5,"path":20,"url":39,"util":41}],3:[function(require,module,exports){
(function (Buffer){
var util = require('util');
var Stream = require('stream').Stream;
var DelayedStream = require('delayed-stream');

module.exports = CombinedStream;
function CombinedStream() {
  this.writable = false;
  this.readable = true;
  this.dataSize = 0;
  this.maxDataSize = 2 * 1024 * 1024;
  this.pauseStreams = true;

  this._released = false;
  this._streams = [];
  this._currentStream = null;
}
util.inherits(CombinedStream, Stream);

CombinedStream.create = function(options) {
  var combinedStream = new this();

  options = options || {};
  for (var option in options) {
    combinedStream[option] = options[option];
  }

  return combinedStream;
};

CombinedStream.isStreamLike = function(stream) {
  return (typeof stream !== 'function')
    && (typeof stream !== 'string')
    && (typeof stream !== 'boolean')
    && (typeof stream !== 'number')
    && (!Buffer.isBuffer(stream));
};

CombinedStream.prototype.append = function(stream) {
  var isStreamLike = CombinedStream.isStreamLike(stream);

  if (isStreamLike) {
    if (!(stream instanceof DelayedStream)) {
      var newStream = DelayedStream.create(stream, {
        maxDataSize: Infinity,
        pauseStream: this.pauseStreams,
      });
      stream.on('data', this._checkDataSize.bind(this));
      stream = newStream;
    }

    this._handleErrors(stream);

    if (this.pauseStreams) {
      stream.pause();
    }
  }

  this._streams.push(stream);
  return this;
};

CombinedStream.prototype.pipe = function(dest, options) {
  Stream.prototype.pipe.call(this, dest, options);
  this.resume();
  return dest;
};

CombinedStream.prototype._getNext = function() {
  this._currentStream = null;
  var stream = this._streams.shift();


  if (typeof stream == 'undefined') {
    this.end();
    return;
  }

  if (typeof stream !== 'function') {
    this._pipeNext(stream);
    return;
  }

  var getStream = stream;
  getStream(function(stream) {
    var isStreamLike = CombinedStream.isStreamLike(stream);
    if (isStreamLike) {
      stream.on('data', this._checkDataSize.bind(this));
      this._handleErrors(stream);
    }

    this._pipeNext(stream);
  }.bind(this));
};

CombinedStream.prototype._pipeNext = function(stream) {
  this._currentStream = stream;

  var isStreamLike = CombinedStream.isStreamLike(stream);
  if (isStreamLike) {
    stream.on('end', this._getNext.bind(this));
    stream.pipe(this, {end: false});
    return;
  }

  var value = stream;
  this.write(value);
  this._getNext();
};

CombinedStream.prototype._handleErrors = function(stream) {
  var self = this;
  stream.on('error', function(err) {
    self._emitError(err);
  });
};

CombinedStream.prototype.write = function(data) {
  this.emit('data', data);
};

CombinedStream.prototype.pause = function() {
  if (!this.pauseStreams) {
    return;
  }

  if(this.pauseStreams && this._currentStream && typeof(this._currentStream.pause) == 'function') this._currentStream.pause();
  this.emit('pause');
};

CombinedStream.prototype.resume = function() {
  if (!this._released) {
    this._released = true;
    this.writable = true;
    this._getNext();
  }

  if(this.pauseStreams && this._currentStream && typeof(this._currentStream.resume) == 'function') this._currentStream.resume();
  this.emit('resume');
};

CombinedStream.prototype.end = function() {
  this._reset();
  this.emit('end');
};

CombinedStream.prototype.destroy = function() {
  this._reset();
  this.emit('close');
};

CombinedStream.prototype._reset = function() {
  this.writable = false;
  this._streams = [];
  this._currentStream = null;
};

CombinedStream.prototype._checkDataSize = function() {
  this._updateDataSize();
  if (this.dataSize <= this.maxDataSize) {
    return;
  }

  var message =
    'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.';
  this._emitError(new Error(message));
};

CombinedStream.prototype._updateDataSize = function() {
  this.dataSize = 0;

  var self = this;
  this._streams.forEach(function(stream) {
    if (!stream.dataSize) {
      return;
    }

    self.dataSize += stream.dataSize;
  });

  if (this._currentStream && this._currentStream.dataSize) {
    this.dataSize += this._currentStream.dataSize;
  }
};

CombinedStream.prototype._emitError = function(err) {
  this._reset();
  this.emit('error', err);
};

}).call(this,require("buffer").Buffer)
},{"buffer":8,"delayed-stream":4,"stream":37,"util":41}],4:[function(require,module,exports){
var Stream = require('stream').Stream;
var util = require('util');

module.exports = DelayedStream;
function DelayedStream() {
  this.source = null;
  this.dataSize = 0;
  this.maxDataSize = 1024 * 1024;
  this.pauseStream = true;

  this._maxDataSizeExceeded = false;
  this._released = false;
  this._bufferedEvents = [];
}
util.inherits(DelayedStream, Stream);

DelayedStream.create = function(source, options) {
  var delayedStream = new this();

  options = options || {};
  for (var option in options) {
    delayedStream[option] = options[option];
  }

  delayedStream.source = source;

  var realEmit = source.emit;
  source.emit = function() {
    delayedStream._handleEmit(arguments);
    return realEmit.apply(source, arguments);
  };

  source.on('error', function() {});
  if (delayedStream.pauseStream) {
    source.pause();
  }

  return delayedStream;
};

DelayedStream.prototype.__defineGetter__('readable', function() {
  return this.source.readable;
});

DelayedStream.prototype.resume = function() {
  if (!this._released) {
    this.release();
  }

  this.source.resume();
};

DelayedStream.prototype.pause = function() {
  this.source.pause();
};

DelayedStream.prototype.release = function() {
  this._released = true;

  this._bufferedEvents.forEach(function(args) {
    this.emit.apply(this, args);
  }.bind(this));
  this._bufferedEvents = [];
};

DelayedStream.prototype.pipe = function() {
  var r = Stream.prototype.pipe.apply(this, arguments);
  this.resume();
  return r;
};

DelayedStream.prototype._handleEmit = function(args) {
  if (this._released) {
    this.emit.apply(this, args);
    return;
  }

  if (args[0] === 'data') {
    this.dataSize += args[1].length;
    this._checkIfMaxDataSizeExceeded();
  }

  this._bufferedEvents.push(args);
};

DelayedStream.prototype._checkIfMaxDataSizeExceeded = function() {
  if (this._maxDataSizeExceeded) {
    return;
  }

  if (this.dataSize <= this.maxDataSize) {
    return;
  }

  this._maxDataSizeExceeded = true;
  var message =
    'DelayedStream#maxDataSize of ' + this.maxDataSize + ' bytes exceeded.'
  this.emit('error', new Error(message));
};

},{"stream":37,"util":41}],5:[function(require,module,exports){
(function (process,__dirname){
var path = require('path');
var fs = require('fs');

function Mime() {
  // Map of extension -> mime type
  this.types = Object.create(null);

  // Map of mime type -> extension
  this.extensions = Object.create(null);
}

/**
 * Define mimetype -> extension mappings.  Each key is a mime-type that maps
 * to an array of extensions associated with the type.  The first extension is
 * used as the default extension for the type.
 *
 * e.g. mime.define({'audio/ogg', ['oga', 'ogg', 'spx']});
 *
 * @param map (Object) type definitions
 */
Mime.prototype.define = function (map) {
  for (var type in map) {
    var exts = map[type];

    for (var i = 0; i < exts.length; i++) {
      if (process.env.DEBUG_MIME && this.types[exts]) {
        console.warn(this._loading.replace(/.*\//, ''), 'changes "' + exts[i] + '" extension type from ' +
          this.types[exts] + ' to ' + type);
      }

      this.types[exts[i]] = type;
    }

    // Default extension is the first one we encounter
    if (!this.extensions[type]) {
      this.extensions[type] = exts[0];
    }
  }
};

/**
 * Load an Apache2-style ".types" file
 *
 * This may be called multiple times (it's expected).  Where files declare
 * overlapping types/extensions, the last file wins.
 *
 * @param file (String) path of file to load.
 */
Mime.prototype.load = function(file) {

  this._loading = file;
  // Read file and split into lines
  var map = {},
      content = fs.readFileSync(file, 'ascii'),
      lines = content.split(/[\r\n]+/);

  lines.forEach(function(line) {
    // Clean up whitespace/comments, and split into fields
    var fields = line.replace(/\s*#.*|^\s*|\s*$/g, '').split(/\s+/);
    map[fields.shift()] = fields;
  });

  this.define(map);

  this._loading = null;
};

/**
 * Lookup a mime type based on extension
 */
Mime.prototype.lookup = function(path, fallback) {
  var ext = path.replace(/.*[\.\/\\]/, '').toLowerCase();

  return this.types[ext] || fallback || this.default_type;
};

/**
 * Return file extension associated with a mime type
 */
Mime.prototype.extension = function(mimeType) {
  var type = mimeType.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase();
  return this.extensions[type];
};

// Default instance
var mime = new Mime();

// Load local copy of
// http://svn.apache.org/repos/asf/httpd/httpd/trunk/docs/conf/mime.types
mime.load(path.join(__dirname, 'types/mime.types'));

// Load additional types from node.js community
mime.load(path.join(__dirname, 'types/node.types'));

// Default type
mime.default_type = mime.lookup('bin');

//
// Additional API specific to the default instance
//

mime.Mime = Mime;

/**
 * Lookup a charset based on mime type.
 */
mime.charsets = {
  lookup: function(mimeType, fallback) {
    // Assume text types are utf8
    return (/^text\//).test(mimeType) ? 'UTF-8' : fallback;
  }
};

module.exports = mime;

}).call(this,require('_process'),"/node_modules/form-data/node_modules/mime")
},{"_process":21,"fs":6,"path":20}],6:[function(require,module,exports){

},{}],7:[function(require,module,exports){
arguments[4][6][0].apply(exports,arguments)
},{"dup":6}],8:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff
var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number') {
    length = +subject
  } else if (type === 'string') {
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length
  } else {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  if (length < 0)
    length = 0
  else
    length >>>= 0 // Coerce to uint32.

  var self = this
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    /*eslint-disable consistent-this */
    self = Buffer._augment(new Uint8Array(length))
    /*eslint-enable consistent-this */
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    self.length = length
    self._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    self._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        self[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        self[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    self.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      self[i] = 0
    }
  }

  if (length > 0 && length <= Buffer.poolSize)
    self.parent = rootParent

  return self
}

function SlowBuffer (subject, encoding, noZero) {
  if (!(this instanceof SlowBuffer))
    return new SlowBuffer(subject, encoding, noZero)

  var buf = new Buffer(subject, encoding, noZero)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  if (a === b) return 0

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0

  if (length < 0 || offset < 0 || offset > this.length)
    throw new RangeError('attempt to write outside buffer bounds')

  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length)
    newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul

  return val
}

Buffer.prototype.readUIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100))
    val += this[offset + --byteLength] * mul

  return val
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100))
    val += this[offset + --i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var self = this // source

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (target_start >= target.length) target_start = target.length
  if (!target_start) target_start = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || self.length === 0) return 0

  // Fatal error conditions
  if (target_start < 0)
    throw new RangeError('targetStart out of bounds')
  if (start < 0 || start >= self.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []
  var i = 0

  for (; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (leadSurrogate) {
        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        } else {
          // valid surrogate pair
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      } else {
        // no lead yet

        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else {
          // valid lead
          leadSurrogate = codePoint
          continue
        }
      }
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":9,"ieee754":10,"is-array":11}],9:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],10:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],11:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],12:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],13:[function(require,module,exports){
var http = module.exports;
var EventEmitter = require('events').EventEmitter;
var Request = require('./lib/request');
var url = require('url')

http.request = function (params, cb) {
    if (typeof params === 'string') {
        params = url.parse(params)
    }
    if (!params) params = {};
    if (!params.host && !params.port) {
        params.port = parseInt(window.location.port, 10);
    }
    if (!params.host && params.hostname) {
        params.host = params.hostname;
    }

    if (!params.protocol) {
        if (params.scheme) {
            params.protocol = params.scheme + ':';
        } else {
            params.protocol = window.location.protocol;
        }
    }

    if (!params.host) {
        params.host = window.location.hostname || window.location.host;
    }
    if (/:/.test(params.host)) {
        if (!params.port) {
            params.port = params.host.split(':')[1];
        }
        params.host = params.host.split(':')[0];
    }
    if (!params.port) params.port = params.protocol == 'https:' ? 443 : 80;
    
    var req = new Request(new xhrHttp, params);
    if (cb) req.on('response', cb);
    return req;
};

http.get = function (params, cb) {
    params.method = 'GET';
    var req = http.request(params, cb);
    req.end();
    return req;
};

http.Agent = function () {};
http.Agent.defaultMaxSockets = 4;

var xhrHttp = (function () {
    if (typeof window === 'undefined') {
        throw new Error('no window object present');
    }
    else if (window.XMLHttpRequest) {
        return window.XMLHttpRequest;
    }
    else if (window.ActiveXObject) {
        var axs = [
            'Msxml2.XMLHTTP.6.0',
            'Msxml2.XMLHTTP.3.0',
            'Microsoft.XMLHTTP'
        ];
        for (var i = 0; i < axs.length; i++) {
            try {
                var ax = new(window.ActiveXObject)(axs[i]);
                return function () {
                    if (ax) {
                        var ax_ = ax;
                        ax = null;
                        return ax_;
                    }
                    else {
                        return new(window.ActiveXObject)(axs[i]);
                    }
                };
            }
            catch (e) {}
        }
        throw new Error('ajax not supported in this browser')
    }
    else {
        throw new Error('ajax not supported in this browser');
    }
})();

http.STATUS_CODES = {
    100 : 'Continue',
    101 : 'Switching Protocols',
    102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
    200 : 'OK',
    201 : 'Created',
    202 : 'Accepted',
    203 : 'Non-Authoritative Information',
    204 : 'No Content',
    205 : 'Reset Content',
    206 : 'Partial Content',
    207 : 'Multi-Status',               // RFC 4918
    300 : 'Multiple Choices',
    301 : 'Moved Permanently',
    302 : 'Moved Temporarily',
    303 : 'See Other',
    304 : 'Not Modified',
    305 : 'Use Proxy',
    307 : 'Temporary Redirect',
    400 : 'Bad Request',
    401 : 'Unauthorized',
    402 : 'Payment Required',
    403 : 'Forbidden',
    404 : 'Not Found',
    405 : 'Method Not Allowed',
    406 : 'Not Acceptable',
    407 : 'Proxy Authentication Required',
    408 : 'Request Time-out',
    409 : 'Conflict',
    410 : 'Gone',
    411 : 'Length Required',
    412 : 'Precondition Failed',
    413 : 'Request Entity Too Large',
    414 : 'Request-URI Too Large',
    415 : 'Unsupported Media Type',
    416 : 'Requested Range Not Satisfiable',
    417 : 'Expectation Failed',
    418 : 'I\'m a teapot',              // RFC 2324
    422 : 'Unprocessable Entity',       // RFC 4918
    423 : 'Locked',                     // RFC 4918
    424 : 'Failed Dependency',          // RFC 4918
    425 : 'Unordered Collection',       // RFC 4918
    426 : 'Upgrade Required',           // RFC 2817
    428 : 'Precondition Required',      // RFC 6585
    429 : 'Too Many Requests',          // RFC 6585
    431 : 'Request Header Fields Too Large',// RFC 6585
    500 : 'Internal Server Error',
    501 : 'Not Implemented',
    502 : 'Bad Gateway',
    503 : 'Service Unavailable',
    504 : 'Gateway Time-out',
    505 : 'HTTP Version Not Supported',
    506 : 'Variant Also Negotiates',    // RFC 2295
    507 : 'Insufficient Storage',       // RFC 4918
    509 : 'Bandwidth Limit Exceeded',
    510 : 'Not Extended',               // RFC 2774
    511 : 'Network Authentication Required' // RFC 6585
};
},{"./lib/request":14,"events":12,"url":39}],14:[function(require,module,exports){
var Stream = require('stream');
var Response = require('./response');
var Base64 = require('Base64');
var inherits = require('inherits');

var Request = module.exports = function (xhr, params) {
    var self = this;
    self.writable = true;
    self.xhr = xhr;
    self.body = [];
    
    self.uri = (params.protocol || 'http:') + '//'
        + params.host
        + (params.port ? ':' + params.port : '')
        + (params.path || '/')
    ;
    
    if (typeof params.withCredentials === 'undefined') {
        params.withCredentials = true;
    }

    try { xhr.withCredentials = params.withCredentials }
    catch (e) {}
    
    if (params.responseType) try { xhr.responseType = params.responseType }
    catch (e) {}
    
    xhr.open(
        params.method || 'GET',
        self.uri,
        true
    );

    xhr.onerror = function(event) {
        self.emit('error', new Error('Network error'));
    };

    self._headers = {};
    
    if (params.headers) {
        var keys = objectKeys(params.headers);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (!self.isSafeRequestHeader(key)) continue;
            var value = params.headers[key];
            self.setHeader(key, value);
        }
    }
    
    if (params.auth) {
        //basic auth
        this.setHeader('Authorization', 'Basic ' + Base64.btoa(params.auth));
    }

    var res = new Response;
    res.on('close', function () {
        self.emit('close');
    });
    
    res.on('ready', function () {
        self.emit('response', res);
    });

    res.on('error', function (err) {
        self.emit('error', err);
    });
    
    xhr.onreadystatechange = function () {
        // Fix for IE9 bug
        // SCRIPT575: Could not complete the operation due to error c00c023f
        // It happens when a request is aborted, calling the success callback anyway with readyState === 4
        if (xhr.__aborted) return;
        res.handle(xhr);
    };
};

inherits(Request, Stream);

Request.prototype.setHeader = function (key, value) {
    this._headers[key.toLowerCase()] = value
};

Request.prototype.getHeader = function (key) {
    return this._headers[key.toLowerCase()]
};

Request.prototype.removeHeader = function (key) {
    delete this._headers[key.toLowerCase()]
};

Request.prototype.write = function (s) {
    this.body.push(s);
};

Request.prototype.destroy = function (s) {
    this.xhr.__aborted = true;
    this.xhr.abort();
    this.emit('close');
};

Request.prototype.end = function (s) {
    if (s !== undefined) this.body.push(s);

    var keys = objectKeys(this._headers);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = this._headers[key];
        if (isArray(value)) {
            for (var j = 0; j < value.length; j++) {
                this.xhr.setRequestHeader(key, value[j]);
            }
        }
        else this.xhr.setRequestHeader(key, value)
    }

    if (this.body.length === 0) {
        this.xhr.send('');
    }
    else if (typeof this.body[0] === 'string') {
        this.xhr.send(this.body.join(''));
    }
    else if (isArray(this.body[0])) {
        var body = [];
        for (var i = 0; i < this.body.length; i++) {
            body.push.apply(body, this.body[i]);
        }
        this.xhr.send(body);
    }
    else if (/Array/.test(Object.prototype.toString.call(this.body[0]))) {
        var len = 0;
        for (var i = 0; i < this.body.length; i++) {
            len += this.body[i].length;
        }
        var body = new(this.body[0].constructor)(len);
        var k = 0;
        
        for (var i = 0; i < this.body.length; i++) {
            var b = this.body[i];
            for (var j = 0; j < b.length; j++) {
                body[k++] = b[j];
            }
        }
        this.xhr.send(body);
    }
    else if (isXHR2Compatible(this.body[0])) {
        this.xhr.send(this.body[0]);
    }
    else {
        var body = '';
        for (var i = 0; i < this.body.length; i++) {
            body += this.body[i].toString();
        }
        this.xhr.send(body);
    }
};

// Taken from http://dxr.mozilla.org/mozilla/mozilla-central/content/base/src/nsXMLHttpRequest.cpp.html
Request.unsafeHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "content-transfer-encoding",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via"
];

Request.prototype.isSafeRequestHeader = function (headerName) {
    if (!headerName) return false;
    return indexOf(Request.unsafeHeaders, headerName.toLowerCase()) === -1;
};

var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) keys.push(key);
    return keys;
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var indexOf = function (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (xs[i] === x) return i;
    }
    return -1;
};

var isXHR2Compatible = function (obj) {
    if (typeof Blob !== 'undefined' && obj instanceof Blob) return true;
    if (typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) return true;
    if (typeof FormData !== 'undefined' && obj instanceof FormData) return true;
};

},{"./response":15,"Base64":16,"inherits":18,"stream":37}],15:[function(require,module,exports){
var Stream = require('stream');
var util = require('util');

var Response = module.exports = function (res) {
    this.offset = 0;
    this.readable = true;
};

util.inherits(Response, Stream);

var capable = {
    streaming : true,
    status2 : true
};

function parseHeaders (res) {
    var lines = res.getAllResponseHeaders().split(/\r?\n/);
    var headers = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line === '') continue;
        
        var m = line.match(/^([^:]+):\s*(.*)/);
        if (m) {
            var key = m[1].toLowerCase(), value = m[2];
            
            if (headers[key] !== undefined) {
            
                if (isArray(headers[key])) {
                    headers[key].push(value);
                }
                else {
                    headers[key] = [ headers[key], value ];
                }
            }
            else {
                headers[key] = value;
            }
        }
        else {
            headers[line] = true;
        }
    }
    return headers;
}

Response.prototype.getResponse = function (xhr) {
    var respType = String(xhr.responseType).toLowerCase();
    if (respType === 'blob') return xhr.responseBlob || xhr.response;
    if (respType === 'arraybuffer') return xhr.response;
    return xhr.responseText;
}

Response.prototype.getHeader = function (key) {
    return this.headers[key.toLowerCase()];
};

Response.prototype.handle = function (res) {
    if (res.readyState === 2 && capable.status2) {
        try {
            this.statusCode = res.status;
            this.headers = parseHeaders(res);
        }
        catch (err) {
            capable.status2 = false;
        }
        
        if (capable.status2) {
            this.emit('ready');
        }
    }
    else if (capable.streaming && res.readyState === 3) {
        try {
            if (!this.statusCode) {
                this.statusCode = res.status;
                this.headers = parseHeaders(res);
                this.emit('ready');
            }
        }
        catch (err) {}
        
        try {
            this._emitData(res);
        }
        catch (err) {
            capable.streaming = false;
        }
    }
    else if (res.readyState === 4) {
        if (!this.statusCode) {
            this.statusCode = res.status;
            this.emit('ready');
        }
        this._emitData(res);
        
        if (res.error) {
            this.emit('error', this.getResponse(res));
        }
        else this.emit('end');
        
        this.emit('close');
    }
};

Response.prototype._emitData = function (res) {
    var respBody = this.getResponse(res);
    if (respBody.toString().match(/ArrayBuffer/)) {
        this.emit('data', new Uint8Array(respBody, this.offset));
        this.offset = respBody.byteLength;
        return;
    }
    if (respBody.length > this.offset) {
        this.emit('data', respBody.slice(this.offset));
        this.offset = respBody.length;
    }
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

},{"stream":37,"util":41}],16:[function(require,module,exports){
;(function () {

  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
  object.btoa = function (input) {
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next input index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      input.charAt(idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = input.charCodeAt(idx += 3/4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
  object.atob = function (input) {
    input = input.replace(/=+$/, '');
    if (input.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = input.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  });

}());

},{}],17:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    return http.request.call(this, params, cb);
}

},{"http":13}],18:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],19:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],20:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":21}],21:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],22:[function(require,module,exports){
(function (global){
/*! http://mths.be/punycode v1.2.4 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings.
	 * @private
	 * @param {String} domain The domain name.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <http://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols to a Punycode string of ASCII-only
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name to Unicode. Only the
	 * Punycoded parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it on a string that has already been converted to
	 * Unicode.
	 * @memberOf punycode
	 * @param {String} domain The Punycode domain name to convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name to Punycode. Only the
	 * non-ASCII parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it with a domain that's already in ASCII.
	 * @memberOf punycode
	 * @param {String} domain The domain name to convert, as a Unicode string.
	 * @returns {String} The Punycode representation of the given domain name.
	 */
	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.2.4',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <http://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],23:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],24:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],25:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":23,"./encode":24}],26:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":27}],27:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require('_process'))
},{"./_stream_readable":29,"./_stream_writable":31,"_process":21,"core-util-is":32,"inherits":18}],28:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":30,"core-util-is":32,"inherits":18}],29:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;


/*<replacement>*/
var debug = require('util');
if (debug && debug.debuglog) {
  debug = debug.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/


util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  var Duplex = require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (util.isString(chunk) && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (util.isNullOrUndefined(chunk)) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || util.isNull(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (!util.isNumber(n) || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (util.isNull(ret)) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (!util.isNull(ret))
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      process.nextTick(function() {
        emitReadable_(stream);
      });
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      debug('false write response, pause',
            src._readableState.awaitDrain);
      src._readableState.awaitDrain++;
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        var self = this;
        process.nextTick(function() {
          debug('readable nexttick read 0');
          self.read(0);
        });
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    if (!state.reading) {
      debug('resume read 0');
      this.read(0);
    }
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    process.nextTick(function() {
      resume_(stream, state);
    });
  }
}

function resume_(stream, state) {
  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
},{"./_stream_duplex":27,"_process":21,"buffer":8,"core-util-is":32,"events":12,"inherits":18,"isarray":19,"stream":37,"string_decoder/":38,"util":7}],30:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (!util.isNullOrUndefined(data))
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('prefinish', function() {
    if (util.isFunction(this._flush))
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":27,"core-util-is":32,"inherits":18}],31:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (util.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (!util.isFunction(cb))
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.buffer.length)
      clearBuffer(this, state);
  }
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      util.isString(chunk)) {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (util.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, false, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      state.pendingcb--;
      cb(er);
    });
  else {
    state.pendingcb--;
    cb(er);
  }

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.buffer.length) {
      clearBuffer(stream, state);
    }

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  if (stream._writev && state.buffer.length > 1) {
    // Fast case, write everything using _writev()
    var cbs = [];
    for (var c = 0; c < state.buffer.length; c++)
      cbs.push(state.buffer[c].callback);

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
    state.buffer = [];
  } else {
    // Slow case, write chunks one-by-one
    for (var c = 0; c < state.buffer.length; c++) {
      var entry = state.buffer[c];
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);

      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        c++;
        break;
      }
    }

    if (c < state.buffer.length)
      state.buffer = state.buffer.slice(c);
    else
      state.buffer.length = 0;
  }

  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));

};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (util.isFunction(chunk)) {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (!util.isNullOrUndefined(chunk))
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else
      prefinish(stream, state);
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
},{"./_stream_duplex":27,"_process":21,"buffer":8,"core-util-is":32,"inherits":18,"stream":37}],32:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,require("buffer").Buffer)
},{"buffer":8}],33:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":28}],34:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = require('stream');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":27,"./lib/_stream_passthrough.js":28,"./lib/_stream_readable.js":29,"./lib/_stream_transform.js":30,"./lib/_stream_writable.js":31,"stream":37}],35:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":30}],36:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":31}],37:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":12,"inherits":18,"readable-stream/duplex.js":26,"readable-stream/passthrough.js":33,"readable-stream/readable.js":34,"readable-stream/transform.js":35,"readable-stream/writable.js":36}],38:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":8}],39:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":22,"querystring":25}],40:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],41:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":40,"_process":21,"inherits":18}],42:[function(require,module,exports){
/*! Socket.IO.js build:0.9.17, development. Copyright(c) 2011 LearnBoost <dev@learnboost.com> MIT Licensed */

var io = ('undefined' === typeof module ? {} : module.exports);
(function() {

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, global) {

  /**
   * IO namespace.
   *
   * @namespace
   */

  var io = exports;

  /**
   * Socket.IO version
   *
   * @api public
   */

  io.version = '0.9.17';

  /**
   * Protocol implemented.
   *
   * @api public
   */

  io.protocol = 1;

  /**
   * Available transports, these will be populated with the available transports
   *
   * @api public
   */

  io.transports = [];

  /**
   * Keep track of jsonp callbacks.
   *
   * @api private
   */

  io.j = [];

  /**
   * Keep track of our io.Sockets
   *
   * @api private
   */
  io.sockets = {};


  /**
   * Manages connections to hosts.
   *
   * @param {String} uri
   * @Param {Boolean} force creation of new socket (defaults to false)
   * @api public
   */

  io.connect = function (host, details) {
    var uri = io.util.parseUri(host)
      , uuri
      , socket;

    if (global && global.location) {
      uri.protocol = uri.protocol || global.location.protocol.slice(0, -1);
      uri.host = uri.host || (global.document
        ? global.document.domain : global.location.hostname);
      uri.port = uri.port || global.location.port;
    }

    uuri = io.util.uniqueUri(uri);

    var options = {
        host: uri.host
      , secure: 'https' == uri.protocol
      , port: uri.port || ('https' == uri.protocol ? 443 : 80)
      , query: uri.query || ''
    };

    io.util.merge(options, details);

    if (options['force new connection'] || !io.sockets[uuri]) {
      socket = new io.Socket(options);
    }

    if (!options['force new connection'] && socket) {
      io.sockets[uuri] = socket;
    }

    socket = socket || io.sockets[uuri];

    // if path is different from '' or /
    return socket.of(uri.path.length > 1 ? uri.path : '');
  };

})('object' === typeof module ? module.exports : (this.io = {}), this);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, global) {

  /**
   * Utilities namespace.
   *
   * @namespace
   */

  var util = exports.util = {};

  /**
   * Parses an URI
   *
   * @author Steven Levithan <stevenlevithan.com> (MIT license)
   * @api public
   */

  var re = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;

  var parts = ['source', 'protocol', 'authority', 'userInfo', 'user', 'password',
               'host', 'port', 'relative', 'path', 'directory', 'file', 'query',
               'anchor'];

  util.parseUri = function (str) {
    var m = re.exec(str || '')
      , uri = {}
      , i = 14;

    while (i--) {
      uri[parts[i]] = m[i] || '';
    }

    return uri;
  };

  /**
   * Produces a unique url that identifies a Socket.IO connection.
   *
   * @param {Object} uri
   * @api public
   */

  util.uniqueUri = function (uri) {
    var protocol = uri.protocol
      , host = uri.host
      , port = uri.port;

    if ('document' in global) {
      host = host || document.domain;
      port = port || (protocol == 'https'
        && document.location.protocol !== 'https:' ? 443 : document.location.port);
    } else {
      host = host || 'localhost';

      if (!port && protocol == 'https') {
        port = 443;
      }
    }

    return (protocol || 'http') + '://' + host + ':' + (port || 80);
  };

  /**
   * Mergest 2 query strings in to once unique query string
   *
   * @param {String} base
   * @param {String} addition
   * @api public
   */

  util.query = function (base, addition) {
    var query = util.chunkQuery(base || '')
      , components = [];

    util.merge(query, util.chunkQuery(addition || ''));
    for (var part in query) {
      if (query.hasOwnProperty(part)) {
        components.push(part + '=' + query[part]);
      }
    }

    return components.length ? '?' + components.join('&') : '';
  };

  /**
   * Transforms a querystring in to an object
   *
   * @param {String} qs
   * @api public
   */

  util.chunkQuery = function (qs) {
    var query = {}
      , params = qs.split('&')
      , i = 0
      , l = params.length
      , kv;

    for (; i < l; ++i) {
      kv = params[i].split('=');
      if (kv[0]) {
        query[kv[0]] = kv[1];
      }
    }

    return query;
  };

  /**
   * Executes the given function when the page is loaded.
   *
   *     io.util.load(function () { console.log('page loaded'); });
   *
   * @param {Function} fn
   * @api public
   */

  var pageLoaded = false;

  util.load = function (fn) {
    if ('document' in global && document.readyState === 'complete' || pageLoaded) {
      return fn();
    }

    util.on(global, 'load', fn, false);
  };

  /**
   * Adds an event.
   *
   * @api private
   */

  util.on = function (element, event, fn, capture) {
    if (element.attachEvent) {
      element.attachEvent('on' + event, fn);
    } else if (element.addEventListener) {
      element.addEventListener(event, fn, capture);
    }
  };

  /**
   * Generates the correct `XMLHttpRequest` for regular and cross domain requests.
   *
   * @param {Boolean} [xdomain] Create a request that can be used cross domain.
   * @returns {XMLHttpRequest|false} If we can create a XMLHttpRequest.
   * @api private
   */

  util.request = function (xdomain) {

    if (xdomain && 'undefined' != typeof XDomainRequest && !util.ua.hasCORS) {
      return new XDomainRequest();
    }

    if ('undefined' != typeof XMLHttpRequest && (!xdomain || util.ua.hasCORS)) {
      return new XMLHttpRequest();
    }

    if (!xdomain) {
      try {
        return new window[(['Active'].concat('Object').join('X'))]('Microsoft.XMLHTTP');
      } catch(e) { }
    }

    return null;
  };

  /**
   * XHR based transport constructor.
   *
   * @constructor
   * @api public
   */

  /**
   * Change the internal pageLoaded value.
   */

  if ('undefined' != typeof window) {
    util.load(function () {
      pageLoaded = true;
    });
  }

  /**
   * Defers a function to ensure a spinner is not displayed by the browser
   *
   * @param {Function} fn
   * @api public
   */

  util.defer = function (fn) {
    if (!util.ua.webkit || 'undefined' != typeof importScripts) {
      return fn();
    }

    util.load(function () {
      setTimeout(fn, 100);
    });
  };

  /**
   * Merges two objects.
   *
   * @api public
   */

  util.merge = function merge (target, additional, deep, lastseen) {
    var seen = lastseen || []
      , depth = typeof deep == 'undefined' ? 2 : deep
      , prop;

    for (prop in additional) {
      if (additional.hasOwnProperty(prop) && util.indexOf(seen, prop) < 0) {
        if (typeof target[prop] !== 'object' || !depth) {
          target[prop] = additional[prop];
          seen.push(additional[prop]);
        } else {
          util.merge(target[prop], additional[prop], depth - 1, seen);
        }
      }
    }

    return target;
  };

  /**
   * Merges prototypes from objects
   *
   * @api public
   */

  util.mixin = function (ctor, ctor2) {
    util.merge(ctor.prototype, ctor2.prototype);
  };

  /**
   * Shortcut for prototypical and static inheritance.
   *
   * @api private
   */

  util.inherit = function (ctor, ctor2) {
    function f() {};
    f.prototype = ctor2.prototype;
    ctor.prototype = new f;
  };

  /**
   * Checks if the given object is an Array.
   *
   *     io.util.isArray([]); // true
   *     io.util.isArray({}); // false
   *
   * @param Object obj
   * @api public
   */

  util.isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
  };

  /**
   * Intersects values of two arrays into a third
   *
   * @api public
   */

  util.intersect = function (arr, arr2) {
    var ret = []
      , longest = arr.length > arr2.length ? arr : arr2
      , shortest = arr.length > arr2.length ? arr2 : arr;

    for (var i = 0, l = shortest.length; i < l; i++) {
      if (~util.indexOf(longest, shortest[i]))
        ret.push(shortest[i]);
    }

    return ret;
  };

  /**
   * Array indexOf compatibility.
   *
   * @see bit.ly/a5Dxa2
   * @api public
   */

  util.indexOf = function (arr, o, i) {

    for (var j = arr.length, i = i < 0 ? i + j < 0 ? 0 : i + j : i || 0;
         i < j && arr[i] !== o; i++) {}

    return j <= i ? -1 : i;
  };

  /**
   * Converts enumerables to array.
   *
   * @api public
   */

  util.toArray = function (enu) {
    var arr = [];

    for (var i = 0, l = enu.length; i < l; i++)
      arr.push(enu[i]);

    return arr;
  };

  /**
   * UA / engines detection namespace.
   *
   * @namespace
   */

  util.ua = {};

  /**
   * Whether the UA supports CORS for XHR.
   *
   * @api public
   */

  util.ua.hasCORS = 'undefined' != typeof XMLHttpRequest && (function () {
    try {
      var a = new XMLHttpRequest();
    } catch (e) {
      return false;
    }

    return a.withCredentials != undefined;
  })();

  /**
   * Detect webkit.
   *
   * @api public
   */

  util.ua.webkit = 'undefined' != typeof navigator
    && /webkit/i.test(navigator.userAgent);

   /**
   * Detect iPad/iPhone/iPod.
   *
   * @api public
   */

  util.ua.iDevice = 'undefined' != typeof navigator
      && /iPad|iPhone|iPod/i.test(navigator.userAgent);

})('undefined' != typeof io ? io : module.exports, this);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.EventEmitter = EventEmitter;

  /**
   * Event emitter constructor.
   *
   * @api public.
   */

  function EventEmitter () {};

  /**
   * Adds a listener
   *
   * @api public
   */

  EventEmitter.prototype.on = function (name, fn) {
    if (!this.$events) {
      this.$events = {};
    }

    if (!this.$events[name]) {
      this.$events[name] = fn;
    } else if (io.util.isArray(this.$events[name])) {
      this.$events[name].push(fn);
    } else {
      this.$events[name] = [this.$events[name], fn];
    }

    return this;
  };

  EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  /**
   * Adds a volatile listener.
   *
   * @api public
   */

  EventEmitter.prototype.once = function (name, fn) {
    var self = this;

    function on () {
      self.removeListener(name, on);
      fn.apply(this, arguments);
    };

    on.listener = fn;
    this.on(name, on);

    return this;
  };

  /**
   * Removes a listener.
   *
   * @api public
   */

  EventEmitter.prototype.removeListener = function (name, fn) {
    if (this.$events && this.$events[name]) {
      var list = this.$events[name];

      if (io.util.isArray(list)) {
        var pos = -1;

        for (var i = 0, l = list.length; i < l; i++) {
          if (list[i] === fn || (list[i].listener && list[i].listener === fn)) {
            pos = i;
            break;
          }
        }

        if (pos < 0) {
          return this;
        }

        list.splice(pos, 1);

        if (!list.length) {
          delete this.$events[name];
        }
      } else if (list === fn || (list.listener && list.listener === fn)) {
        delete this.$events[name];
      }
    }

    return this;
  };

  /**
   * Removes all listeners for an event.
   *
   * @api public
   */

  EventEmitter.prototype.removeAllListeners = function (name) {
    if (name === undefined) {
      this.$events = {};
      return this;
    }

    if (this.$events && this.$events[name]) {
      this.$events[name] = null;
    }

    return this;
  };

  /**
   * Gets all listeners for a certain event.
   *
   * @api publci
   */

  EventEmitter.prototype.listeners = function (name) {
    if (!this.$events) {
      this.$events = {};
    }

    if (!this.$events[name]) {
      this.$events[name] = [];
    }

    if (!io.util.isArray(this.$events[name])) {
      this.$events[name] = [this.$events[name]];
    }

    return this.$events[name];
  };

  /**
   * Emits an event.
   *
   * @api public
   */

  EventEmitter.prototype.emit = function (name) {
    if (!this.$events) {
      return false;
    }

    var handler = this.$events[name];

    if (!handler) {
      return false;
    }

    var args = Array.prototype.slice.call(arguments, 1);

    if ('function' == typeof handler) {
      handler.apply(this, args);
    } else if (io.util.isArray(handler)) {
      var listeners = handler.slice();

      for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i].apply(this, args);
      }
    } else {
      return false;
    }

    return true;
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Based on JSON2 (http://www.JSON.org/js.html).
 */

(function (exports, nativeJSON) {
  "use strict";

  // use native JSON if it's available
  if (nativeJSON && nativeJSON.parse){
    return exports.JSON = {
      parse: nativeJSON.parse
    , stringify: nativeJSON.stringify
    };
  }

  var JSON = exports.JSON = {};

  function f(n) {
      // Format integers to have at least two digits.
      return n < 10 ? '0' + n : n;
  }

  function date(d, key) {
    return isFinite(d.valueOf()) ?
        d.getUTCFullYear()     + '-' +
        f(d.getUTCMonth() + 1) + '-' +
        f(d.getUTCDate())      + 'T' +
        f(d.getUTCHours())     + ':' +
        f(d.getUTCMinutes())   + ':' +
        f(d.getUTCSeconds())   + 'Z' : null;
  };

  var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      gap,
      indent,
      meta = {    // table of character substitutions
          '\b': '\\b',
          '\t': '\\t',
          '\n': '\\n',
          '\f': '\\f',
          '\r': '\\r',
          '"' : '\\"',
          '\\': '\\\\'
      },
      rep;


  function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

      escapable.lastIndex = 0;
      return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
          var c = meta[a];
          return typeof c === 'string' ? c :
              '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + string + '"';
  }


  function str(key, holder) {

// Produce a string from holder[key].

      var i,          // The loop counter.
          k,          // The member key.
          v,          // The member value.
          length,
          mind = gap,
          partial,
          value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

      if (value instanceof Date) {
          value = date(key);
      }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

      if (typeof rep === 'function') {
          value = rep.call(holder, key, value);
      }

// What happens next depends on the value's type.

      switch (typeof value) {
      case 'string':
          return quote(value);

      case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

          return isFinite(value) ? String(value) : 'null';

      case 'boolean':
      case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

          return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

      case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

          if (!value) {
              return 'null';
          }

// Make an array to hold the partial results of stringifying this object value.

          gap += indent;
          partial = [];

// Is the value an array?

          if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

              length = value.length;
              for (i = 0; i < length; i += 1) {
                  partial[i] = str(i, value) || 'null';
              }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

              v = partial.length === 0 ? '[]' : gap ?
                  '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                  '[' + partial.join(',') + ']';
              gap = mind;
              return v;
          }

// If the replacer is an array, use it to select the members to be stringified.

          if (rep && typeof rep === 'object') {
              length = rep.length;
              for (i = 0; i < length; i += 1) {
                  if (typeof rep[i] === 'string') {
                      k = rep[i];
                      v = str(k, value);
                      if (v) {
                          partial.push(quote(k) + (gap ? ': ' : ':') + v);
                      }
                  }
              }
          } else {

// Otherwise, iterate through all of the keys in the object.

              for (k in value) {
                  if (Object.prototype.hasOwnProperty.call(value, k)) {
                      v = str(k, value);
                      if (v) {
                          partial.push(quote(k) + (gap ? ': ' : ':') + v);
                      }
                  }
              }
          }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

          v = partial.length === 0 ? '{}' : gap ?
              '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
              '{' + partial.join(',') + '}';
          gap = mind;
          return v;
      }
  }

// If the JSON object does not yet have a stringify method, give it one.

  JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

      var i;
      gap = '';
      indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

      if (typeof space === 'number') {
          for (i = 0; i < space; i += 1) {
              indent += ' ';
          }

// If the space parameter is a string, it will be used as the indent string.

      } else if (typeof space === 'string') {
          indent = space;
      }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

      rep = replacer;
      if (replacer && typeof replacer !== 'function' &&
              (typeof replacer !== 'object' ||
              typeof replacer.length !== 'number')) {
          throw new Error('JSON.stringify');
      }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

      return str('', {'': value});
  };

// If the JSON object does not yet have a parse method, give it one.

  JSON.parse = function (text, reviver) {
  // The parse method takes a text and an optional reviver function, and returns
  // a JavaScript value if the text is a valid JSON text.

      var j;

      function walk(holder, key) {

  // The walk method is used to recursively walk the resulting structure so
  // that modifications can be made.

          var k, v, value = holder[key];
          if (value && typeof value === 'object') {
              for (k in value) {
                  if (Object.prototype.hasOwnProperty.call(value, k)) {
                      v = walk(value, k);
                      if (v !== undefined) {
                          value[k] = v;
                      } else {
                          delete value[k];
                      }
                  }
              }
          }
          return reviver.call(holder, key, value);
      }


  // Parsing happens in four stages. In the first stage, we replace certain
  // Unicode characters with escape sequences. JavaScript handles many characters
  // incorrectly, either silently deleting them, or treating them as line endings.

      text = String(text);
      cx.lastIndex = 0;
      if (cx.test(text)) {
          text = text.replace(cx, function (a) {
              return '\\u' +
                  ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          });
      }

  // In the second stage, we run the text against regular expressions that look
  // for non-JSON patterns. We are especially concerned with '()' and 'new'
  // because they can cause invocation, and '=' because it can cause mutation.
  // But just to be safe, we want to reject all unexpected forms.

  // We split the second stage into 4 regexp operations in order to work around
  // crippling inefficiencies in IE's and Safari's regexp engines. First we
  // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
  // replace all simple value tokens with ']' characters. Third, we delete all
  // open brackets that follow a colon or comma or that begin the text. Finally,
  // we look to see that the remaining characters are only whitespace or ']' or
  // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

      if (/^[\],:{}\s]*$/
              .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                  .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                  .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

  // In the third stage we use the eval function to compile the text into a
  // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
  // in JavaScript: it can begin a block or an object literal. We wrap the text
  // in parens to eliminate the ambiguity.

          j = eval('(' + text + ')');

  // In the optional fourth stage, we recursively walk the new structure, passing
  // each name/value pair to a reviver function for possible transformation.

          return typeof reviver === 'function' ?
              walk({'': j}, '') : j;
      }

  // If the text is not JSON parseable, then a SyntaxError is thrown.

      throw new SyntaxError('JSON.parse');
  };

})(
    'undefined' != typeof io ? io : module.exports
  , typeof JSON !== 'undefined' ? JSON : undefined
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Parser namespace.
   *
   * @namespace
   */

  var parser = exports.parser = {};

  /**
   * Packet types.
   */

  var packets = parser.packets = [
      'disconnect'
    , 'connect'
    , 'heartbeat'
    , 'message'
    , 'json'
    , 'event'
    , 'ack'
    , 'error'
    , 'noop'
  ];

  /**
   * Errors reasons.
   */

  var reasons = parser.reasons = [
      'transport not supported'
    , 'client not handshaken'
    , 'unauthorized'
  ];

  /**
   * Errors advice.
   */

  var advice = parser.advice = [
      'reconnect'
  ];

  /**
   * Shortcuts.
   */

  var JSON = io.JSON
    , indexOf = io.util.indexOf;

  /**
   * Encodes a packet.
   *
   * @api private
   */

  parser.encodePacket = function (packet) {
    var type = indexOf(packets, packet.type)
      , id = packet.id || ''
      , endpoint = packet.endpoint || ''
      , ack = packet.ack
      , data = null;

    switch (packet.type) {
      case 'error':
        var reason = packet.reason ? indexOf(reasons, packet.reason) : ''
          , adv = packet.advice ? indexOf(advice, packet.advice) : '';

        if (reason !== '' || adv !== '')
          data = reason + (adv !== '' ? ('+' + adv) : '');

        break;

      case 'message':
        if (packet.data !== '')
          data = packet.data;
        break;

      case 'event':
        var ev = { name: packet.name };

        if (packet.args && packet.args.length) {
          ev.args = packet.args;
        }

        data = JSON.stringify(ev);
        break;

      case 'json':
        data = JSON.stringify(packet.data);
        break;

      case 'connect':
        if (packet.qs)
          data = packet.qs;
        break;

      case 'ack':
        data = packet.ackId
          + (packet.args && packet.args.length
              ? '+' + JSON.stringify(packet.args) : '');
        break;
    }

    // construct packet with required fragments
    var encoded = [
        type
      , id + (ack == 'data' ? '+' : '')
      , endpoint
    ];

    // data fragment is optional
    if (data !== null && data !== undefined)
      encoded.push(data);

    return encoded.join(':');
  };

  /**
   * Encodes multiple messages (payload).
   *
   * @param {Array} messages
   * @api private
   */

  parser.encodePayload = function (packets) {
    var decoded = '';

    if (packets.length == 1)
      return packets[0];

    for (var i = 0, l = packets.length; i < l; i++) {
      var packet = packets[i];
      decoded += '\ufffd' + packet.length + '\ufffd' + packets[i];
    }

    return decoded;
  };

  /**
   * Decodes a packet
   *
   * @api private
   */

  var regexp = /([^:]+):([0-9]+)?(\+)?:([^:]+)?:?([\s\S]*)?/;

  parser.decodePacket = function (data) {
    var pieces = data.match(regexp);

    if (!pieces) return {};

    var id = pieces[2] || ''
      , data = pieces[5] || ''
      , packet = {
            type: packets[pieces[1]]
          , endpoint: pieces[4] || ''
        };

    // whether we need to acknowledge the packet
    if (id) {
      packet.id = id;
      if (pieces[3])
        packet.ack = 'data';
      else
        packet.ack = true;
    }

    // handle different packet types
    switch (packet.type) {
      case 'error':
        var pieces = data.split('+');
        packet.reason = reasons[pieces[0]] || '';
        packet.advice = advice[pieces[1]] || '';
        break;

      case 'message':
        packet.data = data || '';
        break;

      case 'event':
        try {
          var opts = JSON.parse(data);
          packet.name = opts.name;
          packet.args = opts.args;
        } catch (e) { }

        packet.args = packet.args || [];
        break;

      case 'json':
        try {
          packet.data = JSON.parse(data);
        } catch (e) { }
        break;

      case 'connect':
        packet.qs = data || '';
        break;

      case 'ack':
        var pieces = data.match(/^([0-9]+)(\+)?(.*)/);
        if (pieces) {
          packet.ackId = pieces[1];
          packet.args = [];

          if (pieces[3]) {
            try {
              packet.args = pieces[3] ? JSON.parse(pieces[3]) : [];
            } catch (e) { }
          }
        }
        break;

      case 'disconnect':
      case 'heartbeat':
        break;
    };

    return packet;
  };

  /**
   * Decodes data payload. Detects multiple messages
   *
   * @return {Array} messages
   * @api public
   */

  parser.decodePayload = function (data) {
    // IE doesn't like data[i] for unicode chars, charAt works fine
    if (data.charAt(0) == '\ufffd') {
      var ret = [];

      for (var i = 1, length = ''; i < data.length; i++) {
        if (data.charAt(i) == '\ufffd') {
          ret.push(parser.decodePacket(data.substr(i + 1).substr(0, length)));
          i += Number(length) + 1;
          length = '';
        } else {
          length += data.charAt(i);
        }
      }

      return ret;
    } else {
      return [parser.decodePacket(data)];
    }
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.Transport = Transport;

  /**
   * This is the transport template for all supported transport methods.
   *
   * @constructor
   * @api public
   */

  function Transport (socket, sessid) {
    this.socket = socket;
    this.sessid = sessid;
  };

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(Transport, io.EventEmitter);


  /**
   * Indicates whether heartbeats is enabled for this transport
   *
   * @api private
   */

  Transport.prototype.heartbeats = function () {
    return true;
  };

  /**
   * Handles the response from the server. When a new response is received
   * it will automatically update the timeout, decode the message and
   * forwards the response to the onMessage function for further processing.
   *
   * @param {String} data Response from the server.
   * @api private
   */

  Transport.prototype.onData = function (data) {
    this.clearCloseTimeout();

    // If the connection in currently open (or in a reopening state) reset the close
    // timeout since we have just received data. This check is necessary so
    // that we don't reset the timeout on an explicitly disconnected connection.
    if (this.socket.connected || this.socket.connecting || this.socket.reconnecting) {
      this.setCloseTimeout();
    }

    if (data !== '') {
      // todo: we should only do decodePayload for xhr transports
      var msgs = io.parser.decodePayload(data);

      if (msgs && msgs.length) {
        for (var i = 0, l = msgs.length; i < l; i++) {
          this.onPacket(msgs[i]);
        }
      }
    }

    return this;
  };

  /**
   * Handles packets.
   *
   * @api private
   */

  Transport.prototype.onPacket = function (packet) {
    this.socket.setHeartbeatTimeout();

    if (packet.type == 'heartbeat') {
      return this.onHeartbeat();
    }

    if (packet.type == 'connect' && packet.endpoint == '') {
      this.onConnect();
    }

    if (packet.type == 'error' && packet.advice == 'reconnect') {
      this.isOpen = false;
    }

    this.socket.onPacket(packet);

    return this;
  };

  /**
   * Sets close timeout
   *
   * @api private
   */

  Transport.prototype.setCloseTimeout = function () {
    if (!this.closeTimeout) {
      var self = this;

      this.closeTimeout = setTimeout(function () {
        self.onDisconnect();
      }, this.socket.closeTimeout);
    }
  };

  /**
   * Called when transport disconnects.
   *
   * @api private
   */

  Transport.prototype.onDisconnect = function () {
    if (this.isOpen) this.close();
    this.clearTimeouts();
    this.socket.onDisconnect();
    return this;
  };

  /**
   * Called when transport connects
   *
   * @api private
   */

  Transport.prototype.onConnect = function () {
    this.socket.onConnect();
    return this;
  };

  /**
   * Clears close timeout
   *
   * @api private
   */

  Transport.prototype.clearCloseTimeout = function () {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  };

  /**
   * Clear timeouts
   *
   * @api private
   */

  Transport.prototype.clearTimeouts = function () {
    this.clearCloseTimeout();

    if (this.reopenTimeout) {
      clearTimeout(this.reopenTimeout);
    }
  };

  /**
   * Sends a packet
   *
   * @param {Object} packet object.
   * @api private
   */

  Transport.prototype.packet = function (packet) {
    this.send(io.parser.encodePacket(packet));
  };

  /**
   * Send the received heartbeat message back to server. So the server
   * knows we are still connected.
   *
   * @param {String} heartbeat Heartbeat response from the server.
   * @api private
   */

  Transport.prototype.onHeartbeat = function (heartbeat) {
    this.packet({ type: 'heartbeat' });
  };

  /**
   * Called when the transport opens.
   *
   * @api private
   */

  Transport.prototype.onOpen = function () {
    this.isOpen = true;
    this.clearCloseTimeout();
    this.socket.onOpen();
  };

  /**
   * Notifies the base when the connection with the Socket.IO server
   * has been disconnected.
   *
   * @api private
   */

  Transport.prototype.onClose = function () {
    var self = this;

    /* FIXME: reopen delay causing a infinit loop
    this.reopenTimeout = setTimeout(function () {
      self.open();
    }, this.socket.options['reopen delay']);*/

    this.isOpen = false;
    this.socket.onClose();
    this.onDisconnect();
  };

  /**
   * Generates a connection url based on the Socket.IO URL Protocol.
   * See <https://github.com/learnboost/socket.io-node/> for more details.
   *
   * @returns {String} Connection url
   * @api private
   */

  Transport.prototype.prepareUrl = function () {
    var options = this.socket.options;

    return this.scheme() + '://'
      + options.host + ':' + options.port + '/'
      + options.resource + '/' + io.protocol
      + '/' + this.name + '/' + this.sessid;
  };

  /**
   * Checks if the transport is ready to start a connection.
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  Transport.prototype.ready = function (socket, fn) {
    fn.call(this);
  };
})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   */

  exports.Socket = Socket;

  /**
   * Create a new `Socket.IO client` which can establish a persistent
   * connection with a Socket.IO enabled server.
   *
   * @api public
   */

  function Socket (options) {
    this.options = {
        port: 80
      , secure: false
      , document: 'document' in global ? document : false
      , resource: 'socket.io'
      , transports: io.transports
      , 'connect timeout': 10000
      , 'try multiple transports': true
      , 'reconnect': true
      , 'reconnection delay': 500
      , 'reconnection limit': Infinity
      , 'reopen delay': 3000
      , 'max reconnection attempts': 10
      , 'sync disconnect on unload': false
      , 'auto connect': true
      , 'flash policy port': 10843
      , 'manualFlush': false
    };

    io.util.merge(this.options, options);

    this.connected = false;
    this.open = false;
    this.connecting = false;
    this.reconnecting = false;
    this.namespaces = {};
    this.buffer = [];
    this.doBuffer = false;

    if (this.options['sync disconnect on unload'] &&
        (!this.isXDomain() || io.util.ua.hasCORS)) {
      var self = this;
      io.util.on(global, 'beforeunload', function () {
        self.disconnectSync();
      }, false);
    }

    if (this.options['auto connect']) {
      this.connect();
    }
};

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(Socket, io.EventEmitter);

  /**
   * Returns a namespace listener/emitter for this socket
   *
   * @api public
   */

  Socket.prototype.of = function (name) {
    if (!this.namespaces[name]) {
      this.namespaces[name] = new io.SocketNamespace(this, name);

      if (name !== '') {
        this.namespaces[name].packet({ type: 'connect' });
      }
    }

    return this.namespaces[name];
  };

  /**
   * Emits the given event to the Socket and all namespaces
   *
   * @api private
   */

  Socket.prototype.publish = function () {
    this.emit.apply(this, arguments);

    var nsp;

    for (var i in this.namespaces) {
      if (this.namespaces.hasOwnProperty(i)) {
        nsp = this.of(i);
        nsp.$emit.apply(nsp, arguments);
      }
    }
  };

  /**
   * Performs the handshake
   *
   * @api private
   */

  function empty () { };

  Socket.prototype.handshake = function (fn) {
    var self = this
      , options = this.options;

    function complete (data) {
      if (data instanceof Error) {
        self.connecting = false;
        self.onError(data.message);
      } else {
        fn.apply(null, data.split(':'));
      }
    };

    var url = [
          'http' + (options.secure ? 's' : '') + ':/'
        , options.host + ':' + options.port
        , options.resource
        , io.protocol
        , io.util.query(this.options.query, 't=' + +new Date)
      ].join('/');

    if (this.isXDomain() && !io.util.ua.hasCORS) {
      var insertAt = document.getElementsByTagName('script')[0]
        , script = document.createElement('script');

      script.src = url + '&jsonp=' + io.j.length;
      insertAt.parentNode.insertBefore(script, insertAt);

      io.j.push(function (data) {
        complete(data);
        script.parentNode.removeChild(script);
      });
    } else {
      var xhr = io.util.request();

      xhr.open('GET', url, true);
      if (this.isXDomain()) {
        xhr.withCredentials = true;
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
          xhr.onreadystatechange = empty;

          if (xhr.status == 200) {
            complete(xhr.responseText);
          } else if (xhr.status == 403) {
            self.onError(xhr.responseText);
          } else {
            self.connecting = false;            
            !self.reconnecting && self.onError(xhr.responseText);
          }
        }
      };
      xhr.send(null);
    }
  };

  /**
   * Find an available transport based on the options supplied in the constructor.
   *
   * @api private
   */

  Socket.prototype.getTransport = function (override) {
    var transports = override || this.transports, match;

    for (var i = 0, transport; transport = transports[i]; i++) {
      if (io.Transport[transport]
        && io.Transport[transport].check(this)
        && (!this.isXDomain() || io.Transport[transport].xdomainCheck(this))) {
        return new io.Transport[transport](this, this.sessionid);
      }
    }

    return null;
  };

  /**
   * Connects to the server.
   *
   * @param {Function} [fn] Callback.
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.connect = function (fn) {
    if (this.connecting) {
      return this;
    }

    var self = this;
    self.connecting = true;
    
    this.handshake(function (sid, heartbeat, close, transports) {
      self.sessionid = sid;
      self.closeTimeout = close * 1000;
      self.heartbeatTimeout = heartbeat * 1000;
      if(!self.transports)
          self.transports = self.origTransports = (transports ? io.util.intersect(
              transports.split(',')
            , self.options.transports
          ) : self.options.transports);

      self.setHeartbeatTimeout();

      function connect (transports){
        if (self.transport) self.transport.clearTimeouts();

        self.transport = self.getTransport(transports);
        if (!self.transport) return self.publish('connect_failed');

        // once the transport is ready
        self.transport.ready(self, function () {
          self.connecting = true;
          self.publish('connecting', self.transport.name);
          self.transport.open();

          if (self.options['connect timeout']) {
            self.connectTimeoutTimer = setTimeout(function () {
              if (!self.connected) {
                self.connecting = false;

                if (self.options['try multiple transports']) {
                  var remaining = self.transports;

                  while (remaining.length > 0 && remaining.splice(0,1)[0] !=
                         self.transport.name) {}

                    if (remaining.length){
                      connect(remaining);
                    } else {
                      self.publish('connect_failed');
                    }
                }
              }
            }, self.options['connect timeout']);
          }
        });
      }

      connect(self.transports);

      self.once('connect', function (){
        clearTimeout(self.connectTimeoutTimer);

        fn && typeof fn == 'function' && fn();
      });
    });

    return this;
  };

  /**
   * Clears and sets a new heartbeat timeout using the value given by the
   * server during the handshake.
   *
   * @api private
   */

  Socket.prototype.setHeartbeatTimeout = function () {
    clearTimeout(this.heartbeatTimeoutTimer);
    if(this.transport && !this.transport.heartbeats()) return;

    var self = this;
    this.heartbeatTimeoutTimer = setTimeout(function () {
      self.transport.onClose();
    }, this.heartbeatTimeout);
  };

  /**
   * Sends a message.
   *
   * @param {Object} data packet.
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.packet = function (data) {
    if (this.connected && !this.doBuffer) {
      this.transport.packet(data);
    } else {
      this.buffer.push(data);
    }

    return this;
  };

  /**
   * Sets buffer state
   *
   * @api private
   */

  Socket.prototype.setBuffer = function (v) {
    this.doBuffer = v;

    if (!v && this.connected && this.buffer.length) {
      if (!this.options['manualFlush']) {
        this.flushBuffer();
      }
    }
  };

  /**
   * Flushes the buffer data over the wire.
   * To be invoked manually when 'manualFlush' is set to true.
   *
   * @api public
   */

  Socket.prototype.flushBuffer = function() {
    this.transport.payload(this.buffer);
    this.buffer = [];
  };
  

  /**
   * Disconnect the established connect.
   *
   * @returns {io.Socket}
   * @api public
   */

  Socket.prototype.disconnect = function () {
    if (this.connected || this.connecting) {
      if (this.open) {
        this.of('').packet({ type: 'disconnect' });
      }

      // handle disconnection immediately
      this.onDisconnect('booted');
    }

    return this;
  };

  /**
   * Disconnects the socket with a sync XHR.
   *
   * @api private
   */

  Socket.prototype.disconnectSync = function () {
    // ensure disconnection
    var xhr = io.util.request();
    var uri = [
        'http' + (this.options.secure ? 's' : '') + ':/'
      , this.options.host + ':' + this.options.port
      , this.options.resource
      , io.protocol
      , ''
      , this.sessionid
    ].join('/') + '/?disconnect=1';

    xhr.open('GET', uri, false);
    xhr.send(null);

    // handle disconnection immediately
    this.onDisconnect('booted');
  };

  /**
   * Check if we need to use cross domain enabled transports. Cross domain would
   * be a different port or different domain name.
   *
   * @returns {Boolean}
   * @api private
   */

  Socket.prototype.isXDomain = function () {

    var port = global.location.port ||
      ('https:' == global.location.protocol ? 443 : 80);

    return this.options.host !== global.location.hostname 
      || this.options.port != port;
  };

  /**
   * Called upon handshake.
   *
   * @api private
   */

  Socket.prototype.onConnect = function () {
    if (!this.connected) {
      this.connected = true;
      this.connecting = false;
      if (!this.doBuffer) {
        // make sure to flush the buffer
        this.setBuffer(false);
      }
      this.emit('connect');
    }
  };

  /**
   * Called when the transport opens
   *
   * @api private
   */

  Socket.prototype.onOpen = function () {
    this.open = true;
  };

  /**
   * Called when the transport closes.
   *
   * @api private
   */

  Socket.prototype.onClose = function () {
    this.open = false;
    clearTimeout(this.heartbeatTimeoutTimer);
  };

  /**
   * Called when the transport first opens a connection
   *
   * @param text
   */

  Socket.prototype.onPacket = function (packet) {
    this.of(packet.endpoint).onPacket(packet);
  };

  /**
   * Handles an error.
   *
   * @api private
   */

  Socket.prototype.onError = function (err) {
    if (err && err.advice) {
      if (err.advice === 'reconnect' && (this.connected || this.connecting)) {
        this.disconnect();
        if (this.options.reconnect) {
          this.reconnect();
        }
      }
    }

    this.publish('error', err && err.reason ? err.reason : err);
  };

  /**
   * Called when the transport disconnects.
   *
   * @api private
   */

  Socket.prototype.onDisconnect = function (reason) {
    var wasConnected = this.connected
      , wasConnecting = this.connecting;

    this.connected = false;
    this.connecting = false;
    this.open = false;

    if (wasConnected || wasConnecting) {
      this.transport.close();
      this.transport.clearTimeouts();
      if (wasConnected) {
        this.publish('disconnect', reason);

        if ('booted' != reason && this.options.reconnect && !this.reconnecting) {
          this.reconnect();
        }
      }
    }
  };

  /**
   * Called upon reconnection.
   *
   * @api private
   */

  Socket.prototype.reconnect = function () {
    this.reconnecting = true;
    this.reconnectionAttempts = 0;
    this.reconnectionDelay = this.options['reconnection delay'];

    var self = this
      , maxAttempts = this.options['max reconnection attempts']
      , tryMultiple = this.options['try multiple transports']
      , limit = this.options['reconnection limit'];

    function reset () {
      if (self.connected) {
        for (var i in self.namespaces) {
          if (self.namespaces.hasOwnProperty(i) && '' !== i) {
              self.namespaces[i].packet({ type: 'connect' });
          }
        }
        self.publish('reconnect', self.transport.name, self.reconnectionAttempts);
      }

      clearTimeout(self.reconnectionTimer);

      self.removeListener('connect_failed', maybeReconnect);
      self.removeListener('connect', maybeReconnect);

      self.reconnecting = false;

      delete self.reconnectionAttempts;
      delete self.reconnectionDelay;
      delete self.reconnectionTimer;
      delete self.redoTransports;

      self.options['try multiple transports'] = tryMultiple;
    };

    function maybeReconnect () {
      if (!self.reconnecting) {
        return;
      }

      if (self.connected) {
        return reset();
      };

      if (self.connecting && self.reconnecting) {
        return self.reconnectionTimer = setTimeout(maybeReconnect, 1000);
      }

      if (self.reconnectionAttempts++ >= maxAttempts) {
        if (!self.redoTransports) {
          self.on('connect_failed', maybeReconnect);
          self.options['try multiple transports'] = true;
          self.transports = self.origTransports;
          self.transport = self.getTransport();
          self.redoTransports = true;
          self.connect();
        } else {
          self.publish('reconnect_failed');
          reset();
        }
      } else {
        if (self.reconnectionDelay < limit) {
          self.reconnectionDelay *= 2; // exponential back off
        }

        self.connect();
        self.publish('reconnecting', self.reconnectionDelay, self.reconnectionAttempts);
        self.reconnectionTimer = setTimeout(maybeReconnect, self.reconnectionDelay);
      }
    };

    this.options['try multiple transports'] = false;
    this.reconnectionTimer = setTimeout(maybeReconnect, this.reconnectionDelay);

    this.on('connect', maybeReconnect);
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.SocketNamespace = SocketNamespace;

  /**
   * Socket namespace constructor.
   *
   * @constructor
   * @api public
   */

  function SocketNamespace (socket, name) {
    this.socket = socket;
    this.name = name || '';
    this.flags = {};
    this.json = new Flag(this, 'json');
    this.ackPackets = 0;
    this.acks = {};
  };

  /**
   * Apply EventEmitter mixin.
   */

  io.util.mixin(SocketNamespace, io.EventEmitter);

  /**
   * Copies emit since we override it
   *
   * @api private
   */

  SocketNamespace.prototype.$emit = io.EventEmitter.prototype.emit;

  /**
   * Creates a new namespace, by proxying the request to the socket. This
   * allows us to use the synax as we do on the server.
   *
   * @api public
   */

  SocketNamespace.prototype.of = function () {
    return this.socket.of.apply(this.socket, arguments);
  };

  /**
   * Sends a packet.
   *
   * @api private
   */

  SocketNamespace.prototype.packet = function (packet) {
    packet.endpoint = this.name;
    this.socket.packet(packet);
    this.flags = {};
    return this;
  };

  /**
   * Sends a message
   *
   * @api public
   */

  SocketNamespace.prototype.send = function (data, fn) {
    var packet = {
        type: this.flags.json ? 'json' : 'message'
      , data: data
    };

    if ('function' == typeof fn) {
      packet.id = ++this.ackPackets;
      packet.ack = true;
      this.acks[packet.id] = fn;
    }

    return this.packet(packet);
  };

  /**
   * Emits an event
   *
   * @api public
   */
  
  SocketNamespace.prototype.emit = function (name) {
    var args = Array.prototype.slice.call(arguments, 1)
      , lastArg = args[args.length - 1]
      , packet = {
            type: 'event'
          , name: name
        };

    if ('function' == typeof lastArg) {
      packet.id = ++this.ackPackets;
      packet.ack = 'data';
      this.acks[packet.id] = lastArg;
      args = args.slice(0, args.length - 1);
    }

    packet.args = args;

    return this.packet(packet);
  };

  /**
   * Disconnects the namespace
   *
   * @api private
   */

  SocketNamespace.prototype.disconnect = function () {
    if (this.name === '') {
      this.socket.disconnect();
    } else {
      this.packet({ type: 'disconnect' });
      this.$emit('disconnect');
    }

    return this;
  };

  /**
   * Handles a packet
   *
   * @api private
   */

  SocketNamespace.prototype.onPacket = function (packet) {
    var self = this;

    function ack () {
      self.packet({
          type: 'ack'
        , args: io.util.toArray(arguments)
        , ackId: packet.id
      });
    };

    switch (packet.type) {
      case 'connect':
        this.$emit('connect');
        break;

      case 'disconnect':
        if (this.name === '') {
          this.socket.onDisconnect(packet.reason || 'booted');
        } else {
          this.$emit('disconnect', packet.reason);
        }
        break;

      case 'message':
      case 'json':
        var params = ['message', packet.data];

        if (packet.ack == 'data') {
          params.push(ack);
        } else if (packet.ack) {
          this.packet({ type: 'ack', ackId: packet.id });
        }

        this.$emit.apply(this, params);
        break;

      case 'event':
        var params = [packet.name].concat(packet.args);

        if (packet.ack == 'data')
          params.push(ack);

        this.$emit.apply(this, params);
        break;

      case 'ack':
        if (this.acks[packet.ackId]) {
          this.acks[packet.ackId].apply(this, packet.args);
          delete this.acks[packet.ackId];
        }
        break;

      case 'error':
        if (packet.advice){
          this.socket.onError(packet);
        } else {
          if (packet.reason == 'unauthorized') {
            this.$emit('connect_failed', packet.reason);
          } else {
            this.$emit('error', packet.reason);
          }
        }
        break;
    }
  };

  /**
   * Flag interface.
   *
   * @api private
   */

  function Flag (nsp, name) {
    this.namespace = nsp;
    this.name = name;
  };

  /**
   * Send a message
   *
   * @api public
   */

  Flag.prototype.send = function () {
    this.namespace.flags[this.name] = true;
    this.namespace.send.apply(this.namespace, arguments);
  };

  /**
   * Emit an event
   *
   * @api public
   */

  Flag.prototype.emit = function () {
    this.namespace.flags[this.name] = true;
    this.namespace.emit.apply(this.namespace, arguments);
  };

})(
    'undefined' != typeof io ? io : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   */

  exports.websocket = WS;

  /**
   * The WebSocket transport uses the HTML5 WebSocket API to establish an
   * persistent connection with the Socket.IO server. This transport will also
   * be inherited by the FlashSocket fallback as it provides a API compatible
   * polyfill for the WebSockets.
   *
   * @constructor
   * @extends {io.Transport}
   * @api public
   */

  function WS (socket) {
    io.Transport.apply(this, arguments);
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(WS, io.Transport);

  /**
   * Transport name
   *
   * @api public
   */

  WS.prototype.name = 'websocket';

  /**
   * Initializes a new `WebSocket` connection with the Socket.IO server. We attach
   * all the appropriate listeners to handle the responses from the server.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.open = function () {
    var query = io.util.query(this.socket.options.query)
      , self = this
      , Socket


    if (!Socket) {
      Socket = global.MozWebSocket || global.WebSocket;
    }

    this.websocket = new Socket(this.prepareUrl() + query);

    this.websocket.onopen = function () {
      self.onOpen();
      self.socket.setBuffer(false);
    };
    this.websocket.onmessage = function (ev) {
      self.onData(ev.data);
    };
    this.websocket.onclose = function () {
      self.onClose();
      self.socket.setBuffer(true);
    };
    this.websocket.onerror = function (e) {
      self.onError(e);
    };

    return this;
  };

  /**
   * Send a message to the Socket.IO server. The message will automatically be
   * encoded in the correct message format.
   *
   * @returns {Transport}
   * @api public
   */

  // Do to a bug in the current IDevices browser, we need to wrap the send in a 
  // setTimeout, when they resume from sleeping the browser will crash if 
  // we don't allow the browser time to detect the socket has been closed
  if (io.util.ua.iDevice) {
    WS.prototype.send = function (data) {
      var self = this;
      setTimeout(function() {
         self.websocket.send(data);
      },0);
      return this;
    };
  } else {
    WS.prototype.send = function (data) {
      this.websocket.send(data);
      return this;
    };
  }

  /**
   * Payload
   *
   * @api private
   */

  WS.prototype.payload = function (arr) {
    for (var i = 0, l = arr.length; i < l; i++) {
      this.packet(arr[i]);
    }
    return this;
  };

  /**
   * Disconnect the established `WebSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */

  WS.prototype.close = function () {
    this.websocket.close();
    return this;
  };

  /**
   * Handle the errors that `WebSocket` might be giving when we
   * are attempting to connect or send messages.
   *
   * @param {Error} e The error.
   * @api private
   */

  WS.prototype.onError = function (e) {
    this.socket.onError(e);
  };

  /**
   * Returns the appropriate scheme for the URI generation.
   *
   * @api private
   */
  WS.prototype.scheme = function () {
    return this.socket.options.secure ? 'wss' : 'ws';
  };

  /**
   * Checks if the browser has support for native `WebSockets` and that
   * it's not the polyfill created for the FlashSocket transport.
   *
   * @return {Boolean}
   * @api public
   */

  WS.check = function () {
    return ('WebSocket' in global && !('__addTask' in WebSocket))
          || 'MozWebSocket' in global;
  };

  /**
   * Check if the `WebSocket` transport support cross domain communications.
   *
   * @returns {Boolean}
   * @api public
   */

  WS.xdomainCheck = function () {
    return true;
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('websocket');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.flashsocket = Flashsocket;

  /**
   * The FlashSocket transport. This is a API wrapper for the HTML5 WebSocket
   * specification. It uses a .swf file to communicate with the server. If you want
   * to serve the .swf file from a other server than where the Socket.IO script is
   * coming from you need to use the insecure version of the .swf. More information
   * about this can be found on the github page.
   *
   * @constructor
   * @extends {io.Transport.websocket}
   * @api public
   */

  function Flashsocket () {
    io.Transport.websocket.apply(this, arguments);
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(Flashsocket, io.Transport.websocket);

  /**
   * Transport name
   *
   * @api public
   */

  Flashsocket.prototype.name = 'flashsocket';

  /**
   * Disconnect the established `FlashSocket` connection. This is done by adding a 
   * new task to the FlashSocket. The rest will be handled off by the `WebSocket` 
   * transport.
   *
   * @returns {Transport}
   * @api public
   */

  Flashsocket.prototype.open = function () {
    var self = this
      , args = arguments;

    WebSocket.__addTask(function () {
      io.Transport.websocket.prototype.open.apply(self, args);
    });
    return this;
  };
  
  /**
   * Sends a message to the Socket.IO server. This is done by adding a new
   * task to the FlashSocket. The rest will be handled off by the `WebSocket` 
   * transport.
   *
   * @returns {Transport}
   * @api public
   */

  Flashsocket.prototype.send = function () {
    var self = this, args = arguments;
    WebSocket.__addTask(function () {
      io.Transport.websocket.prototype.send.apply(self, args);
    });
    return this;
  };

  /**
   * Disconnects the established `FlashSocket` connection.
   *
   * @returns {Transport}
   * @api public
   */

  Flashsocket.prototype.close = function () {
    WebSocket.__tasks.length = 0;
    io.Transport.websocket.prototype.close.call(this);
    return this;
  };

  /**
   * The WebSocket fall back needs to append the flash container to the body
   * element, so we need to make sure we have access to it. Or defer the call
   * until we are sure there is a body element.
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  Flashsocket.prototype.ready = function (socket, fn) {
    function init () {
      var options = socket.options
        , port = options['flash policy port']
        , path = [
              'http' + (options.secure ? 's' : '') + ':/'
            , options.host + ':' + options.port
            , options.resource
            , 'static/flashsocket'
            , 'WebSocketMain' + (socket.isXDomain() ? 'Insecure' : '') + '.swf'
          ];

      // Only start downloading the swf file when the checked that this browser
      // actually supports it
      if (!Flashsocket.loaded) {
        if (typeof WEB_SOCKET_SWF_LOCATION === 'undefined') {
          // Set the correct file based on the XDomain settings
          WEB_SOCKET_SWF_LOCATION = path.join('/');
        }

        if (port !== 843) {
          WebSocket.loadFlashPolicyFile('xmlsocket://' + options.host + ':' + port);
        }

        WebSocket.__initialize();
        Flashsocket.loaded = true;
      }

      fn.call(self);
    }

    var self = this;
    if (document.body) return init();

    io.util.load(init);
  };

  /**
   * Check if the FlashSocket transport is supported as it requires that the Adobe
   * Flash Player plug-in version `10.0.0` or greater is installed. And also check if
   * the polyfill is correctly loaded.
   *
   * @returns {Boolean}
   * @api public
   */

  Flashsocket.check = function () {
    if (
        typeof WebSocket == 'undefined'
      || !('__initialize' in WebSocket) || !swfobject
    ) return false;

    return swfobject.getFlashPlayerVersion().major >= 10;
  };

  /**
   * Check if the FlashSocket transport can be used as cross domain / cross origin 
   * transport. Because we can't see which type (secure or insecure) of .swf is used
   * we will just return true.
   *
   * @returns {Boolean}
   * @api public
   */

  Flashsocket.xdomainCheck = function () {
    return true;
  };

  /**
   * Disable AUTO_INITIALIZATION
   */

  if (typeof window != 'undefined') {
    WEB_SOCKET_DISABLE_AUTO_INITIALIZATION = true;
  }

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('flashsocket');
})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);
/*	SWFObject v2.2 <http://code.google.com/p/swfobject/> 
	is released under the MIT License <http://www.opensource.org/licenses/mit-license.php> 
*/
if ('undefined' != typeof window) {
var swfobject=function(){var D="undefined",r="object",S="Shockwave Flash",W="ShockwaveFlash.ShockwaveFlash",q="application/x-shockwave-flash",R="SWFObjectExprInst",x="onreadystatechange",O=window,j=document,t=navigator,T=false,U=[h],o=[],N=[],I=[],l,Q,E,B,J=false,a=false,n,G,m=true,M=function(){var aa=typeof j.getElementById!=D&&typeof j.getElementsByTagName!=D&&typeof j.createElement!=D,ah=t.userAgent.toLowerCase(),Y=t.platform.toLowerCase(),ae=Y?/win/.test(Y):/win/.test(ah),ac=Y?/mac/.test(Y):/mac/.test(ah),af=/webkit/.test(ah)?parseFloat(ah.replace(/^.*webkit\/(\d+(\.\d+)?).*$/,"$1")):false,X=!+"\v1",ag=[0,0,0],ab=null;if(typeof t.plugins!=D&&typeof t.plugins[S]==r){ab=t.plugins[S].description;if(ab&&!(typeof t.mimeTypes!=D&&t.mimeTypes[q]&&!t.mimeTypes[q].enabledPlugin)){T=true;X=false;ab=ab.replace(/^.*\s+(\S+\s+\S+$)/,"$1");ag[0]=parseInt(ab.replace(/^(.*)\..*$/,"$1"),10);ag[1]=parseInt(ab.replace(/^.*\.(.*)\s.*$/,"$1"),10);ag[2]=/[a-zA-Z]/.test(ab)?parseInt(ab.replace(/^.*[a-zA-Z]+(.*)$/,"$1"),10):0}}else{if(typeof O[(['Active'].concat('Object').join('X'))]!=D){try{var ad=new window[(['Active'].concat('Object').join('X'))](W);if(ad){ab=ad.GetVariable("$version");if(ab){X=true;ab=ab.split(" ")[1].split(",");ag=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}}catch(Z){}}}return{w3:aa,pv:ag,wk:af,ie:X,win:ae,mac:ac}}(),k=function(){if(!M.w3){return}if((typeof j.readyState!=D&&j.readyState=="complete")||(typeof j.readyState==D&&(j.getElementsByTagName("body")[0]||j.body))){f()}if(!J){if(typeof j.addEventListener!=D){j.addEventListener("DOMContentLoaded",f,false)}if(M.ie&&M.win){j.attachEvent(x,function(){if(j.readyState=="complete"){j.detachEvent(x,arguments.callee);f()}});if(O==top){(function(){if(J){return}try{j.documentElement.doScroll("left")}catch(X){setTimeout(arguments.callee,0);return}f()})()}}if(M.wk){(function(){if(J){return}if(!/loaded|complete/.test(j.readyState)){setTimeout(arguments.callee,0);return}f()})()}s(f)}}();function f(){if(J){return}try{var Z=j.getElementsByTagName("body")[0].appendChild(C("span"));Z.parentNode.removeChild(Z)}catch(aa){return}J=true;var X=U.length;for(var Y=0;Y<X;Y++){U[Y]()}}function K(X){if(J){X()}else{U[U.length]=X}}function s(Y){if(typeof O.addEventListener!=D){O.addEventListener("load",Y,false)}else{if(typeof j.addEventListener!=D){j.addEventListener("load",Y,false)}else{if(typeof O.attachEvent!=D){i(O,"onload",Y)}else{if(typeof O.onload=="function"){var X=O.onload;O.onload=function(){X();Y()}}else{O.onload=Y}}}}}function h(){if(T){V()}else{H()}}function V(){var X=j.getElementsByTagName("body")[0];var aa=C(r);aa.setAttribute("type",q);var Z=X.appendChild(aa);if(Z){var Y=0;(function(){if(typeof Z.GetVariable!=D){var ab=Z.GetVariable("$version");if(ab){ab=ab.split(" ")[1].split(",");M.pv=[parseInt(ab[0],10),parseInt(ab[1],10),parseInt(ab[2],10)]}}else{if(Y<10){Y++;setTimeout(arguments.callee,10);return}}X.removeChild(aa);Z=null;H()})()}else{H()}}function H(){var ag=o.length;if(ag>0){for(var af=0;af<ag;af++){var Y=o[af].id;var ab=o[af].callbackFn;var aa={success:false,id:Y};if(M.pv[0]>0){var ae=c(Y);if(ae){if(F(o[af].swfVersion)&&!(M.wk&&M.wk<312)){w(Y,true);if(ab){aa.success=true;aa.ref=z(Y);ab(aa)}}else{if(o[af].expressInstall&&A()){var ai={};ai.data=o[af].expressInstall;ai.width=ae.getAttribute("width")||"0";ai.height=ae.getAttribute("height")||"0";if(ae.getAttribute("class")){ai.styleclass=ae.getAttribute("class")}if(ae.getAttribute("align")){ai.align=ae.getAttribute("align")}var ah={};var X=ae.getElementsByTagName("param");var ac=X.length;for(var ad=0;ad<ac;ad++){if(X[ad].getAttribute("name").toLowerCase()!="movie"){ah[X[ad].getAttribute("name")]=X[ad].getAttribute("value")}}P(ai,ah,Y,ab)}else{p(ae);if(ab){ab(aa)}}}}}else{w(Y,true);if(ab){var Z=z(Y);if(Z&&typeof Z.SetVariable!=D){aa.success=true;aa.ref=Z}ab(aa)}}}}}function z(aa){var X=null;var Y=c(aa);if(Y&&Y.nodeName=="OBJECT"){if(typeof Y.SetVariable!=D){X=Y}else{var Z=Y.getElementsByTagName(r)[0];if(Z){X=Z}}}return X}function A(){return !a&&F("6.0.65")&&(M.win||M.mac)&&!(M.wk&&M.wk<312)}function P(aa,ab,X,Z){a=true;E=Z||null;B={success:false,id:X};var ae=c(X);if(ae){if(ae.nodeName=="OBJECT"){l=g(ae);Q=null}else{l=ae;Q=X}aa.id=R;if(typeof aa.width==D||(!/%$/.test(aa.width)&&parseInt(aa.width,10)<310)){aa.width="310"}if(typeof aa.height==D||(!/%$/.test(aa.height)&&parseInt(aa.height,10)<137)){aa.height="137"}j.title=j.title.slice(0,47)+" - Flash Player Installation";var ad=M.ie&&M.win?(['Active'].concat('').join('X')):"PlugIn",ac="MMredirectURL="+O.location.toString().replace(/&/g,"%26")+"&MMplayerType="+ad+"&MMdoctitle="+j.title;if(typeof ab.flashvars!=D){ab.flashvars+="&"+ac}else{ab.flashvars=ac}if(M.ie&&M.win&&ae.readyState!=4){var Y=C("div");X+="SWFObjectNew";Y.setAttribute("id",X);ae.parentNode.insertBefore(Y,ae);ae.style.display="none";(function(){if(ae.readyState==4){ae.parentNode.removeChild(ae)}else{setTimeout(arguments.callee,10)}})()}u(aa,ab,X)}}function p(Y){if(M.ie&&M.win&&Y.readyState!=4){var X=C("div");Y.parentNode.insertBefore(X,Y);X.parentNode.replaceChild(g(Y),X);Y.style.display="none";(function(){if(Y.readyState==4){Y.parentNode.removeChild(Y)}else{setTimeout(arguments.callee,10)}})()}else{Y.parentNode.replaceChild(g(Y),Y)}}function g(ab){var aa=C("div");if(M.win&&M.ie){aa.innerHTML=ab.innerHTML}else{var Y=ab.getElementsByTagName(r)[0];if(Y){var ad=Y.childNodes;if(ad){var X=ad.length;for(var Z=0;Z<X;Z++){if(!(ad[Z].nodeType==1&&ad[Z].nodeName=="PARAM")&&!(ad[Z].nodeType==8)){aa.appendChild(ad[Z].cloneNode(true))}}}}}return aa}function u(ai,ag,Y){var X,aa=c(Y);if(M.wk&&M.wk<312){return X}if(aa){if(typeof ai.id==D){ai.id=Y}if(M.ie&&M.win){var ah="";for(var ae in ai){if(ai[ae]!=Object.prototype[ae]){if(ae.toLowerCase()=="data"){ag.movie=ai[ae]}else{if(ae.toLowerCase()=="styleclass"){ah+=' class="'+ai[ae]+'"'}else{if(ae.toLowerCase()!="classid"){ah+=" "+ae+'="'+ai[ae]+'"'}}}}}var af="";for(var ad in ag){if(ag[ad]!=Object.prototype[ad]){af+='<param name="'+ad+'" value="'+ag[ad]+'" />'}}aa.outerHTML='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000"'+ah+">"+af+"</object>";N[N.length]=ai.id;X=c(ai.id)}else{var Z=C(r);Z.setAttribute("type",q);for(var ac in ai){if(ai[ac]!=Object.prototype[ac]){if(ac.toLowerCase()=="styleclass"){Z.setAttribute("class",ai[ac])}else{if(ac.toLowerCase()!="classid"){Z.setAttribute(ac,ai[ac])}}}}for(var ab in ag){if(ag[ab]!=Object.prototype[ab]&&ab.toLowerCase()!="movie"){e(Z,ab,ag[ab])}}aa.parentNode.replaceChild(Z,aa);X=Z}}return X}function e(Z,X,Y){var aa=C("param");aa.setAttribute("name",X);aa.setAttribute("value",Y);Z.appendChild(aa)}function y(Y){var X=c(Y);if(X&&X.nodeName=="OBJECT"){if(M.ie&&M.win){X.style.display="none";(function(){if(X.readyState==4){b(Y)}else{setTimeout(arguments.callee,10)}})()}else{X.parentNode.removeChild(X)}}}function b(Z){var Y=c(Z);if(Y){for(var X in Y){if(typeof Y[X]=="function"){Y[X]=null}}Y.parentNode.removeChild(Y)}}function c(Z){var X=null;try{X=j.getElementById(Z)}catch(Y){}return X}function C(X){return j.createElement(X)}function i(Z,X,Y){Z.attachEvent(X,Y);I[I.length]=[Z,X,Y]}function F(Z){var Y=M.pv,X=Z.split(".");X[0]=parseInt(X[0],10);X[1]=parseInt(X[1],10)||0;X[2]=parseInt(X[2],10)||0;return(Y[0]>X[0]||(Y[0]==X[0]&&Y[1]>X[1])||(Y[0]==X[0]&&Y[1]==X[1]&&Y[2]>=X[2]))?true:false}function v(ac,Y,ad,ab){if(M.ie&&M.mac){return}var aa=j.getElementsByTagName("head")[0];if(!aa){return}var X=(ad&&typeof ad=="string")?ad:"screen";if(ab){n=null;G=null}if(!n||G!=X){var Z=C("style");Z.setAttribute("type","text/css");Z.setAttribute("media",X);n=aa.appendChild(Z);if(M.ie&&M.win&&typeof j.styleSheets!=D&&j.styleSheets.length>0){n=j.styleSheets[j.styleSheets.length-1]}G=X}if(M.ie&&M.win){if(n&&typeof n.addRule==r){n.addRule(ac,Y)}}else{if(n&&typeof j.createTextNode!=D){n.appendChild(j.createTextNode(ac+" {"+Y+"}"))}}}function w(Z,X){if(!m){return}var Y=X?"visible":"hidden";if(J&&c(Z)){c(Z).style.visibility=Y}else{v("#"+Z,"visibility:"+Y)}}function L(Y){var Z=/[\\\"<>\.;]/;var X=Z.exec(Y)!=null;return X&&typeof encodeURIComponent!=D?encodeURIComponent(Y):Y}var d=function(){if(M.ie&&M.win){window.attachEvent("onunload",function(){var ac=I.length;for(var ab=0;ab<ac;ab++){I[ab][0].detachEvent(I[ab][1],I[ab][2])}var Z=N.length;for(var aa=0;aa<Z;aa++){y(N[aa])}for(var Y in M){M[Y]=null}M=null;for(var X in swfobject){swfobject[X]=null}swfobject=null})}}();return{registerObject:function(ab,X,aa,Z){if(M.w3&&ab&&X){var Y={};Y.id=ab;Y.swfVersion=X;Y.expressInstall=aa;Y.callbackFn=Z;o[o.length]=Y;w(ab,false)}else{if(Z){Z({success:false,id:ab})}}},getObjectById:function(X){if(M.w3){return z(X)}},embedSWF:function(ab,ah,ae,ag,Y,aa,Z,ad,af,ac){var X={success:false,id:ah};if(M.w3&&!(M.wk&&M.wk<312)&&ab&&ah&&ae&&ag&&Y){w(ah,false);K(function(){ae+="";ag+="";var aj={};if(af&&typeof af===r){for(var al in af){aj[al]=af[al]}}aj.data=ab;aj.width=ae;aj.height=ag;var am={};if(ad&&typeof ad===r){for(var ak in ad){am[ak]=ad[ak]}}if(Z&&typeof Z===r){for(var ai in Z){if(typeof am.flashvars!=D){am.flashvars+="&"+ai+"="+Z[ai]}else{am.flashvars=ai+"="+Z[ai]}}}if(F(Y)){var an=u(aj,am,ah);if(aj.id==ah){w(ah,true)}X.success=true;X.ref=an}else{if(aa&&A()){aj.data=aa;P(aj,am,ah,ac);return}else{w(ah,true)}}if(ac){ac(X)}})}else{if(ac){ac(X)}}},switchOffAutoHideShow:function(){m=false},ua:M,getFlashPlayerVersion:function(){return{major:M.pv[0],minor:M.pv[1],release:M.pv[2]}},hasFlashPlayerVersion:F,createSWF:function(Z,Y,X){if(M.w3){return u(Z,Y,X)}else{return undefined}},showExpressInstall:function(Z,aa,X,Y){if(M.w3&&A()){P(Z,aa,X,Y)}},removeSWF:function(X){if(M.w3){y(X)}},createCSS:function(aa,Z,Y,X){if(M.w3){v(aa,Z,Y,X)}},addDomLoadEvent:K,addLoadEvent:s,getQueryParamValue:function(aa){var Z=j.location.search||j.location.hash;if(Z){if(/\?/.test(Z)){Z=Z.split("?")[1]}if(aa==null){return L(Z)}var Y=Z.split("&");for(var X=0;X<Y.length;X++){if(Y[X].substring(0,Y[X].indexOf("="))==aa){return L(Y[X].substring((Y[X].indexOf("=")+1)))}}}return""},expressInstallCallback:function(){if(a){var X=c(R);if(X&&l){X.parentNode.replaceChild(l,X);if(Q){w(Q,true);if(M.ie&&M.win){l.style.display="block"}}if(E){E(B)}}a=false}}}}();
}
// Copyright: Hiroshi Ichikawa <http://gimite.net/en/>
// License: New BSD License
// Reference: http://dev.w3.org/html5/websockets/
// Reference: http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol

(function() {
  
  if ('undefined' == typeof window || window.WebSocket) return;

  var console = window.console;
  if (!console || !console.log || !console.error) {
    console = {log: function(){ }, error: function(){ }};
  }
  
  if (!swfobject.hasFlashPlayerVersion("10.0.0")) {
    console.error("Flash Player >= 10.0.0 is required.");
    return;
  }
  if (location.protocol == "file:") {
    console.error(
      "WARNING: web-socket-js doesn't work in file:///... URL " +
      "unless you set Flash Security Settings properly. " +
      "Open the page via Web server i.e. http://...");
  }

  /**
   * This class represents a faux web socket.
   * @param {string} url
   * @param {array or string} protocols
   * @param {string} proxyHost
   * @param {int} proxyPort
   * @param {string} headers
   */
  WebSocket = function(url, protocols, proxyHost, proxyPort, headers) {
    var self = this;
    self.__id = WebSocket.__nextId++;
    WebSocket.__instances[self.__id] = self;
    self.readyState = WebSocket.CONNECTING;
    self.bufferedAmount = 0;
    self.__events = {};
    if (!protocols) {
      protocols = [];
    } else if (typeof protocols == "string") {
      protocols = [protocols];
    }
    // Uses setTimeout() to make sure __createFlash() runs after the caller sets ws.onopen etc.
    // Otherwise, when onopen fires immediately, onopen is called before it is set.
    setTimeout(function() {
      WebSocket.__addTask(function() {
        WebSocket.__flash.create(
            self.__id, url, protocols, proxyHost || null, proxyPort || 0, headers || null);
      });
    }, 0);
  };

  /**
   * Send data to the web socket.
   * @param {string} data  The data to send to the socket.
   * @return {boolean}  True for success, false for failure.
   */
  WebSocket.prototype.send = function(data) {
    if (this.readyState == WebSocket.CONNECTING) {
      throw "INVALID_STATE_ERR: Web Socket connection has not been established";
    }
    // We use encodeURIComponent() here, because FABridge doesn't work if
    // the argument includes some characters. We don't use escape() here
    // because of this:
    // https://developer.mozilla.org/en/Core_JavaScript_1.5_Guide/Functions#escape_and_unescape_Functions
    // But it looks decodeURIComponent(encodeURIComponent(s)) doesn't
    // preserve all Unicode characters either e.g. "\uffff" in Firefox.
    // Note by wtritch: Hopefully this will not be necessary using ExternalInterface.  Will require
    // additional testing.
    var result = WebSocket.__flash.send(this.__id, encodeURIComponent(data));
    if (result < 0) { // success
      return true;
    } else {
      this.bufferedAmount += result;
      return false;
    }
  };

  /**
   * Close this web socket gracefully.
   */
  WebSocket.prototype.close = function() {
    if (this.readyState == WebSocket.CLOSED || this.readyState == WebSocket.CLOSING) {
      return;
    }
    this.readyState = WebSocket.CLOSING;
    WebSocket.__flash.close(this.__id);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket.prototype.addEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) {
      this.__events[type] = [];
    }
    this.__events[type].push(listener);
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {string} type
   * @param {function} listener
   * @param {boolean} useCapture
   * @return void
   */
  WebSocket.prototype.removeEventListener = function(type, listener, useCapture) {
    if (!(type in this.__events)) return;
    var events = this.__events[type];
    for (var i = events.length - 1; i >= 0; --i) {
      if (events[i] === listener) {
        events.splice(i, 1);
        break;
      }
    }
  };

  /**
   * Implementation of {@link <a href="http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-registration">DOM 2 EventTarget Interface</a>}
   *
   * @param {Event} event
   * @return void
   */
  WebSocket.prototype.dispatchEvent = function(event) {
    var events = this.__events[event.type] || [];
    for (var i = 0; i < events.length; ++i) {
      events[i](event);
    }
    var handler = this["on" + event.type];
    if (handler) handler(event);
  };

  /**
   * Handles an event from Flash.
   * @param {Object} flashEvent
   */
  WebSocket.prototype.__handleEvent = function(flashEvent) {
    if ("readyState" in flashEvent) {
      this.readyState = flashEvent.readyState;
    }
    if ("protocol" in flashEvent) {
      this.protocol = flashEvent.protocol;
    }
    
    var jsEvent;
    if (flashEvent.type == "open" || flashEvent.type == "error") {
      jsEvent = this.__createSimpleEvent(flashEvent.type);
    } else if (flashEvent.type == "close") {
      // TODO implement jsEvent.wasClean
      jsEvent = this.__createSimpleEvent("close");
    } else if (flashEvent.type == "message") {
      var data = decodeURIComponent(flashEvent.message);
      jsEvent = this.__createMessageEvent("message", data);
    } else {
      throw "unknown event type: " + flashEvent.type;
    }
    
    this.dispatchEvent(jsEvent);
  };
  
  WebSocket.prototype.__createSimpleEvent = function(type) {
    if (document.createEvent && window.Event) {
      var event = document.createEvent("Event");
      event.initEvent(type, false, false);
      return event;
    } else {
      return {type: type, bubbles: false, cancelable: false};
    }
  };
  
  WebSocket.prototype.__createMessageEvent = function(type, data) {
    if (document.createEvent && window.MessageEvent && !window.opera) {
      var event = document.createEvent("MessageEvent");
      event.initMessageEvent("message", false, false, data, null, null, window, null);
      return event;
    } else {
      // IE and Opera, the latter one truncates the data parameter after any 0x00 bytes.
      return {type: type, data: data, bubbles: false, cancelable: false};
    }
  };
  
  /**
   * Define the WebSocket readyState enumeration.
   */
  WebSocket.CONNECTING = 0;
  WebSocket.OPEN = 1;
  WebSocket.CLOSING = 2;
  WebSocket.CLOSED = 3;

  WebSocket.__flash = null;
  WebSocket.__instances = {};
  WebSocket.__tasks = [];
  WebSocket.__nextId = 0;
  
  /**
   * Load a new flash security policy file.
   * @param {string} url
   */
  WebSocket.loadFlashPolicyFile = function(url){
    WebSocket.__addTask(function() {
      WebSocket.__flash.loadManualPolicyFile(url);
    });
  };

  /**
   * Loads WebSocketMain.swf and creates WebSocketMain object in Flash.
   */
  WebSocket.__initialize = function() {
    if (WebSocket.__flash) return;
    
    if (WebSocket.__swfLocation) {
      // For backword compatibility.
      window.WEB_SOCKET_SWF_LOCATION = WebSocket.__swfLocation;
    }
    if (!window.WEB_SOCKET_SWF_LOCATION) {
      console.error("[WebSocket] set WEB_SOCKET_SWF_LOCATION to location of WebSocketMain.swf");
      return;
    }
    var container = document.createElement("div");
    container.id = "webSocketContainer";
    // Hides Flash box. We cannot use display: none or visibility: hidden because it prevents
    // Flash from loading at least in IE. So we move it out of the screen at (-100, -100).
    // But this even doesn't work with Flash Lite (e.g. in Droid Incredible). So with Flash
    // Lite, we put it at (0, 0). This shows 1x1 box visible at left-top corner but this is
    // the best we can do as far as we know now.
    container.style.position = "absolute";
    if (WebSocket.__isFlashLite()) {
      container.style.left = "0px";
      container.style.top = "0px";
    } else {
      container.style.left = "-100px";
      container.style.top = "-100px";
    }
    var holder = document.createElement("div");
    holder.id = "webSocketFlash";
    container.appendChild(holder);
    document.body.appendChild(container);
    // See this article for hasPriority:
    // http://help.adobe.com/en_US/as3/mobile/WS4bebcd66a74275c36cfb8137124318eebc6-7ffd.html
    swfobject.embedSWF(
      WEB_SOCKET_SWF_LOCATION,
      "webSocketFlash",
      "1" /* width */,
      "1" /* height */,
      "10.0.0" /* SWF version */,
      null,
      null,
      {hasPriority: true, swliveconnect : true, allowScriptAccess: "always"},
      null,
      function(e) {
        if (!e.success) {
          console.error("[WebSocket] swfobject.embedSWF failed");
        }
      });
  };
  
  /**
   * Called by Flash to notify JS that it's fully loaded and ready
   * for communication.
   */
  WebSocket.__onFlashInitialized = function() {
    // We need to set a timeout here to avoid round-trip calls
    // to flash during the initialization process.
    setTimeout(function() {
      WebSocket.__flash = document.getElementById("webSocketFlash");
      WebSocket.__flash.setCallerUrl(location.href);
      WebSocket.__flash.setDebug(!!window.WEB_SOCKET_DEBUG);
      for (var i = 0; i < WebSocket.__tasks.length; ++i) {
        WebSocket.__tasks[i]();
      }
      WebSocket.__tasks = [];
    }, 0);
  };
  
  /**
   * Called by Flash to notify WebSockets events are fired.
   */
  WebSocket.__onFlashEvent = function() {
    setTimeout(function() {
      try {
        // Gets events using receiveEvents() instead of getting it from event object
        // of Flash event. This is to make sure to keep message order.
        // It seems sometimes Flash events don't arrive in the same order as they are sent.
        var events = WebSocket.__flash.receiveEvents();
        for (var i = 0; i < events.length; ++i) {
          WebSocket.__instances[events[i].webSocketId].__handleEvent(events[i]);
        }
      } catch (e) {
        console.error(e);
      }
    }, 0);
    return true;
  };
  
  // Called by Flash.
  WebSocket.__log = function(message) {
    console.log(decodeURIComponent(message));
  };
  
  // Called by Flash.
  WebSocket.__error = function(message) {
    console.error(decodeURIComponent(message));
  };
  
  WebSocket.__addTask = function(task) {
    if (WebSocket.__flash) {
      task();
    } else {
      WebSocket.__tasks.push(task);
    }
  };
  
  /**
   * Test if the browser is running flash lite.
   * @return {boolean} True if flash lite is running, false otherwise.
   */
  WebSocket.__isFlashLite = function() {
    if (!window.navigator || !window.navigator.mimeTypes) {
      return false;
    }
    var mimeType = window.navigator.mimeTypes["application/x-shockwave-flash"];
    if (!mimeType || !mimeType.enabledPlugin || !mimeType.enabledPlugin.filename) {
      return false;
    }
    return mimeType.enabledPlugin.filename.match(/flashlite/i) ? true : false;
  };
  
  if (!window.WEB_SOCKET_DISABLE_AUTO_INITIALIZATION) {
    if (window.addEventListener) {
      window.addEventListener("load", function(){
        WebSocket.__initialize();
      }, false);
    } else {
      window.attachEvent("onload", function(){
        WebSocket.__initialize();
      });
    }
  }
  
})();

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   *
   * @api public
   */

  exports.XHR = XHR;

  /**
   * XHR constructor
   *
   * @costructor
   * @api public
   */

  function XHR (socket) {
    if (!socket) return;

    io.Transport.apply(this, arguments);
    this.sendBuffer = [];
  };

  /**
   * Inherits from Transport.
   */

  io.util.inherit(XHR, io.Transport);

  /**
   * Establish a connection
   *
   * @returns {Transport}
   * @api public
   */

  XHR.prototype.open = function () {
    this.socket.setBuffer(false);
    this.onOpen();
    this.get();

    // we need to make sure the request succeeds since we have no indication
    // whether the request opened or not until it succeeded.
    this.setCloseTimeout();

    return this;
  };

  /**
   * Check if we need to send data to the Socket.IO server, if we have data in our
   * buffer we encode it and forward it to the `post` method.
   *
   * @api private
   */

  XHR.prototype.payload = function (payload) {
    var msgs = [];

    for (var i = 0, l = payload.length; i < l; i++) {
      msgs.push(io.parser.encodePacket(payload[i]));
    }

    this.send(io.parser.encodePayload(msgs));
  };

  /**
   * Send data to the Socket.IO server.
   *
   * @param data The message
   * @returns {Transport}
   * @api public
   */

  XHR.prototype.send = function (data) {
    this.post(data);
    return this;
  };

  /**
   * Posts a encoded message to the Socket.IO server.
   *
   * @param {String} data A encoded message.
   * @api private
   */

  function empty () { };

  XHR.prototype.post = function (data) {
    var self = this;
    this.socket.setBuffer(true);

    function stateChange () {
      if (this.readyState == 4) {
        this.onreadystatechange = empty;
        self.posting = false;

        if (this.status == 200){
          self.socket.setBuffer(false);
        } else {
          self.onClose();
        }
      }
    }

    function onload () {
      this.onload = empty;
      self.socket.setBuffer(false);
    };

    this.sendXHR = this.request('POST');

    if (global.XDomainRequest && this.sendXHR instanceof XDomainRequest) {
      this.sendXHR.onload = this.sendXHR.onerror = onload;
    } else {
      this.sendXHR.onreadystatechange = stateChange;
    }

    this.sendXHR.send(data);
  };

  /**
   * Disconnects the established `XHR` connection.
   *
   * @returns {Transport}
   * @api public
   */

  XHR.prototype.close = function () {
    this.onClose();
    return this;
  };

  /**
   * Generates a configured XHR request
   *
   * @param {String} url The url that needs to be requested.
   * @param {String} method The method the request should use.
   * @returns {XMLHttpRequest}
   * @api private
   */

  XHR.prototype.request = function (method) {
    var req = io.util.request(this.socket.isXDomain())
      , query = io.util.query(this.socket.options.query, 't=' + +new Date);

    req.open(method || 'GET', this.prepareUrl() + query, true);

    if (method == 'POST') {
      try {
        if (req.setRequestHeader) {
          req.setRequestHeader('Content-type', 'text/plain;charset=UTF-8');
        } else {
          // XDomainRequest
          req.contentType = 'text/plain';
        }
      } catch (e) {}
    }

    return req;
  };

  /**
   * Returns the scheme to use for the transport URLs.
   *
   * @api private
   */

  XHR.prototype.scheme = function () {
    return this.socket.options.secure ? 'https' : 'http';
  };

  /**
   * Check if the XHR transports are supported
   *
   * @param {Boolean} xdomain Check if we support cross domain requests.
   * @returns {Boolean}
   * @api public
   */

  XHR.check = function (socket, xdomain) {
    try {
      var request = io.util.request(xdomain),
          usesXDomReq = (global.XDomainRequest && request instanceof XDomainRequest),
          socketProtocol = (socket && socket.options && socket.options.secure ? 'https:' : 'http:'),
          isXProtocol = (global.location && socketProtocol != global.location.protocol);
      if (request && !(usesXDomReq && isXProtocol)) {
        return true;
      }
    } catch(e) {}

    return false;
  };

  /**
   * Check if the XHR transport supports cross domain requests.
   *
   * @returns {Boolean}
   * @api public
   */

  XHR.xdomainCheck = function (socket) {
    return XHR.check(socket, true);
  };

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);
/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io) {

  /**
   * Expose constructor.
   */

  exports.htmlfile = HTMLFile;

  /**
   * The HTMLFile transport creates a `forever iframe` based transport
   * for Internet Explorer. Regular forever iframe implementations will 
   * continuously trigger the browsers buzy indicators. If the forever iframe
   * is created inside a `htmlfile` these indicators will not be trigged.
   *
   * @constructor
   * @extends {io.Transport.XHR}
   * @api public
   */

  function HTMLFile (socket) {
    io.Transport.XHR.apply(this, arguments);
  };

  /**
   * Inherits from XHR transport.
   */

  io.util.inherit(HTMLFile, io.Transport.XHR);

  /**
   * Transport name
   *
   * @api public
   */

  HTMLFile.prototype.name = 'htmlfile';

  /**
   * Creates a new Ac...eX `htmlfile` with a forever loading iframe
   * that can be used to listen to messages. Inside the generated
   * `htmlfile` a reference will be made to the HTMLFile transport.
   *
   * @api private
   */

  HTMLFile.prototype.get = function () {
    this.doc = new window[(['Active'].concat('Object').join('X'))]('htmlfile');
    this.doc.open();
    this.doc.write('<html></html>');
    this.doc.close();
    this.doc.parentWindow.s = this;

    var iframeC = this.doc.createElement('div');
    iframeC.className = 'socketio';

    this.doc.body.appendChild(iframeC);
    this.iframe = this.doc.createElement('iframe');

    iframeC.appendChild(this.iframe);

    var self = this
      , query = io.util.query(this.socket.options.query, 't='+ +new Date);

    this.iframe.src = this.prepareUrl() + query;

    io.util.on(window, 'unload', function () {
      self.destroy();
    });
  };

  /**
   * The Socket.IO server will write script tags inside the forever
   * iframe, this function will be used as callback for the incoming
   * information.
   *
   * @param {String} data The message
   * @param {document} doc Reference to the context
   * @api private
   */

  HTMLFile.prototype._ = function (data, doc) {
    // unescape all forward slashes. see GH-1251
    data = data.replace(/\\\//g, '/');
    this.onData(data);
    try {
      var script = doc.getElementsByTagName('script')[0];
      script.parentNode.removeChild(script);
    } catch (e) { }
  };

  /**
   * Destroy the established connection, iframe and `htmlfile`.
   * And calls the `CollectGarbage` function of Internet Explorer
   * to release the memory.
   *
   * @api private
   */

  HTMLFile.prototype.destroy = function () {
    if (this.iframe){
      try {
        this.iframe.src = 'about:blank';
      } catch(e){}

      this.doc = null;
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;

      CollectGarbage();
    }
  };

  /**
   * Disconnects the established connection.
   *
   * @returns {Transport} Chaining.
   * @api public
   */

  HTMLFile.prototype.close = function () {
    this.destroy();
    return io.Transport.XHR.prototype.close.call(this);
  };

  /**
   * Checks if the browser supports this transport. The browser
   * must have an `Ac...eXObject` implementation.
   *
   * @return {Boolean}
   * @api public
   */

  HTMLFile.check = function (socket) {
    if (typeof window != "undefined" && (['Active'].concat('Object').join('X')) in window){
      try {
        var a = new window[(['Active'].concat('Object').join('X'))]('htmlfile');
        return a && io.Transport.XHR.check(socket);
      } catch(e){}
    }
    return false;
  };

  /**
   * Check if cross domain requests are supported.
   *
   * @returns {Boolean}
   * @api public
   */

  HTMLFile.xdomainCheck = function () {
    // we can probably do handling for sub-domains, we should
    // test that it's cross domain but a subdomain here
    return false;
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('htmlfile');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {

  /**
   * Expose constructor.
   */

  exports['xhr-polling'] = XHRPolling;

  /**
   * The XHR-polling transport uses long polling XHR requests to create a
   * "persistent" connection with the server.
   *
   * @constructor
   * @api public
   */

  function XHRPolling () {
    io.Transport.XHR.apply(this, arguments);
  };

  /**
   * Inherits from XHR transport.
   */

  io.util.inherit(XHRPolling, io.Transport.XHR);

  /**
   * Merge the properties from XHR transport
   */

  io.util.merge(XHRPolling, io.Transport.XHR);

  /**
   * Transport name
   *
   * @api public
   */

  XHRPolling.prototype.name = 'xhr-polling';

  /**
   * Indicates whether heartbeats is enabled for this transport
   *
   * @api private
   */

  XHRPolling.prototype.heartbeats = function () {
    return false;
  };

  /** 
   * Establish a connection, for iPhone and Android this will be done once the page
   * is loaded.
   *
   * @returns {Transport} Chaining.
   * @api public
   */

  XHRPolling.prototype.open = function () {
    var self = this;

    io.Transport.XHR.prototype.open.call(self);
    return false;
  };

  /**
   * Starts a XHR request to wait for incoming messages.
   *
   * @api private
   */

  function empty () {};

  XHRPolling.prototype.get = function () {
    if (!this.isOpen) return;

    var self = this;

    function stateChange () {
      if (this.readyState == 4) {
        this.onreadystatechange = empty;

        if (this.status == 200) {
          self.onData(this.responseText);
          self.get();
        } else {
          self.onClose();
        }
      }
    };

    function onload () {
      this.onload = empty;
      this.onerror = empty;
      self.retryCounter = 1;
      self.onData(this.responseText);
      self.get();
    };

    function onerror () {
      self.retryCounter ++;
      if(!self.retryCounter || self.retryCounter > 3) {
        self.onClose();  
      } else {
        self.get();
      }
    };

    this.xhr = this.request();

    if (global.XDomainRequest && this.xhr instanceof XDomainRequest) {
      this.xhr.onload = onload;
      this.xhr.onerror = onerror;
    } else {
      this.xhr.onreadystatechange = stateChange;
    }

    this.xhr.send(null);
  };

  /**
   * Handle the unclean close behavior.
   *
   * @api private
   */

  XHRPolling.prototype.onClose = function () {
    io.Transport.XHR.prototype.onClose.call(this);

    if (this.xhr) {
      this.xhr.onreadystatechange = this.xhr.onload = this.xhr.onerror = empty;
      try {
        this.xhr.abort();
      } catch(e){}
      this.xhr = null;
    }
  };

  /**
   * Webkit based browsers show a infinit spinner when you start a XHR request
   * before the browsers onload event is called so we need to defer opening of
   * the transport until the onload event is called. Wrapping the cb in our
   * defer method solve this.
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  XHRPolling.prototype.ready = function (socket, fn) {
    var self = this;

    io.util.defer(function () {
      fn.call(self);
    });
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('xhr-polling');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);

/**
 * socket.io
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

(function (exports, io, global) {
  /**
   * There is a way to hide the loading indicator in Firefox. If you create and
   * remove a iframe it will stop showing the current loading indicator.
   * Unfortunately we can't feature detect that and UA sniffing is evil.
   *
   * @api private
   */

  var indicator = global.document && "MozAppearance" in
    global.document.documentElement.style;

  /**
   * Expose constructor.
   */

  exports['jsonp-polling'] = JSONPPolling;

  /**
   * The JSONP transport creates an persistent connection by dynamically
   * inserting a script tag in the page. This script tag will receive the
   * information of the Socket.IO server. When new information is received
   * it creates a new script tag for the new data stream.
   *
   * @constructor
   * @extends {io.Transport.xhr-polling}
   * @api public
   */

  function JSONPPolling (socket) {
    io.Transport['xhr-polling'].apply(this, arguments);

    this.index = io.j.length;

    var self = this;

    io.j.push(function (msg) {
      self._(msg);
    });
  };

  /**
   * Inherits from XHR polling transport.
   */

  io.util.inherit(JSONPPolling, io.Transport['xhr-polling']);

  /**
   * Transport name
   *
   * @api public
   */

  JSONPPolling.prototype.name = 'jsonp-polling';

  /**
   * Posts a encoded message to the Socket.IO server using an iframe.
   * The iframe is used because script tags can create POST based requests.
   * The iframe is positioned outside of the view so the user does not
   * notice it's existence.
   *
   * @param {String} data A encoded message.
   * @api private
   */

  JSONPPolling.prototype.post = function (data) {
    var self = this
      , query = io.util.query(
             this.socket.options.query
          , 't='+ (+new Date) + '&i=' + this.index
        );

    if (!this.form) {
      var form = document.createElement('form')
        , area = document.createElement('textarea')
        , id = this.iframeId = 'socketio_iframe_' + this.index
        , iframe;

      form.className = 'socketio';
      form.style.position = 'absolute';
      form.style.top = '0px';
      form.style.left = '0px';
      form.style.display = 'none';
      form.target = id;
      form.method = 'POST';
      form.setAttribute('accept-charset', 'utf-8');
      area.name = 'd';
      form.appendChild(area);
      document.body.appendChild(form);

      this.form = form;
      this.area = area;
    }

    this.form.action = this.prepareUrl() + query;

    function complete () {
      initIframe();
      self.socket.setBuffer(false);
    };

    function initIframe () {
      if (self.iframe) {
        self.form.removeChild(self.iframe);
      }

      try {
        // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
        iframe = document.createElement('<iframe name="'+ self.iframeId +'">');
      } catch (e) {
        iframe = document.createElement('iframe');
        iframe.name = self.iframeId;
      }

      iframe.id = self.iframeId;

      self.form.appendChild(iframe);
      self.iframe = iframe;
    };

    initIframe();

    // we temporarily stringify until we figure out how to prevent
    // browsers from turning `\n` into `\r\n` in form inputs
    this.area.value = io.JSON.stringify(data);

    try {
      this.form.submit();
    } catch(e) {}

    if (this.iframe.attachEvent) {
      iframe.onreadystatechange = function () {
        if (self.iframe.readyState == 'complete') {
          complete();
        }
      };
    } else {
      this.iframe.onload = complete;
    }

    this.socket.setBuffer(true);
  };

  /**
   * Creates a new JSONP poll that can be used to listen
   * for messages from the Socket.IO server.
   *
   * @api private
   */

  JSONPPolling.prototype.get = function () {
    var self = this
      , script = document.createElement('script')
      , query = io.util.query(
             this.socket.options.query
          , 't='+ (+new Date) + '&i=' + this.index
        );

    if (this.script) {
      this.script.parentNode.removeChild(this.script);
      this.script = null;
    }

    script.async = true;
    script.src = this.prepareUrl() + query;
    script.onerror = function () {
      self.onClose();
    };

    var insertAt = document.getElementsByTagName('script')[0];
    insertAt.parentNode.insertBefore(script, insertAt);
    this.script = script;

    if (indicator) {
      setTimeout(function () {
        var iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        document.body.removeChild(iframe);
      }, 100);
    }
  };

  /**
   * Callback function for the incoming message stream from the Socket.IO server.
   *
   * @param {String} data The message
   * @api private
   */

  JSONPPolling.prototype._ = function (msg) {
    this.onData(msg);
    if (this.isOpen) {
      this.get();
    }
    return this;
  };

  /**
   * The indicator hack only works after onload
   *
   * @param {Socket} socket The socket instance that needs a transport
   * @param {Function} fn The callback
   * @api private
   */

  JSONPPolling.prototype.ready = function (socket, fn) {
    var self = this;
    if (!indicator) return fn.call(this);

    io.util.load(function () {
      fn.call(self);
    });
  };

  /**
   * Checks if browser supports this transport.
   *
   * @return {Boolean}
   * @api public
   */

  JSONPPolling.check = function () {
    return 'document' in global;
  };

  /**
   * Check if cross domain requests are supported
   *
   * @returns {Boolean}
   * @api public
   */

  JSONPPolling.xdomainCheck = function () {
    return true;
  };

  /**
   * Add the transport to your public io.transports array.
   *
   * @api private
   */

  io.transports.push('jsonp-polling');

})(
    'undefined' != typeof io ? io.Transport : module.exports
  , 'undefined' != typeof io ? io : module.parent.exports
  , this
);

if (typeof define === "function" && define.amd) {
  define([], function () { return io; });
}
})();
},{}],43:[function(require,module,exports){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

},{}],44:[function(require,module,exports){
var _ = require('underscore'),
    utility = require('./utility/utility.js'),
    ConnectionEvents = require('./connection/ConnectionEvents.js'),
    ConnectionStreams = require('./connection/ConnectionStreams.js'),
    ConnectionProfile = require('./connection/ConnectionProfile.js'),
    ConnectionBookmarks = require('./connection/ConnectionBookmarks.js'),
    ConnectionAccesses = require('./connection/ConnectionAccesses.js'),
    ConnectionMonitors = require('./connection/ConnectionMonitors.js'),
    ConnectionAccount = require('./connection/ConnectionAccount.js'),
    CC = require('./connection/ConnectionConstants.js'),
    Datastore = require('./Datastore.js');

/**
 * @class Connection
 * Create an instance of Connection to Pryv API.
 * The connection will be opened on
 * http[s]://&lt;username>.&lt;domain>:&lt;port>/&lt;extraPath>?auth=&lt;auth>
 *
 * @example
 * // create a connection for the user 'perkikiki' with the token 'TTZycvBTiq'
 * var conn = new pryv.Connection({username: 'perkikiki', auth: 'TTZycvBTiq'});
 *
 * @constructor
 * @this {Connection}
 * @param {Object} [settings]
 * @param {string} settings.username
 * @param {string} settings.auth - the authorization token for this username
 * @param {boolean} [settings.staging = false] use Pryv's staging servers
 * @param {number} [settings.port = 443]
 * @param {string} [settings.domain = 'pryv.io'] change the domain. use "settings.staging = true" to
 * activate 'pryv.in' staging domain.
 * @param {boolean} [settings.ssl = true] Use ssl (https) or no
 * @param {string} [settings.extraPath = ''] append to the connections. Must start with a '/'
 */
var Connection = module.exports = function Connection() {
  var settings;
  if (!arguments[0] || typeof arguments[0] === 'string') {
    console.warn('new Connection(username, auth, settings) is deprecated.',
      'Please use new Connection(settings)', arguments);
    this.username = arguments[0];
    this.auth = arguments[1];
    settings = arguments[2];
  } else {
    settings = arguments[0];
    this.username = settings.username;
    this.auth = settings.auth;
    if (settings.url) {
      var urlInfo = utility.urls.parseServerURL(settings.url);
      this.username = urlInfo.username;
      settings.hostname = urlInfo.hostname;
      settings.domain = urlInfo.domain;
      settings.port = urlInfo.port;
      settings.extraPath = urlInfo.path === '/' ? '' : urlInfo.path;
      settings.ssl = urlInfo.isSSL();
      settings.staging = urlInfo.environment !== 'production';
    }
  }
  this._serialId = Connection._serialCounter++;

  this.settings = _.extend({
    port: 443,
    ssl: true,
    extraPath: '',
    staging: false
  }, settings);
  this.settings.domain = settings.domain ?
      settings.domain : utility.urls.domains.server[settings.staging ? 'staging' : 'production'];

  this.serverInfos = {
    // nowLocalTime - nowServerTime
    deltaTime: null,
    apiVersion: null,
    lastSeenLT: null
  };

  this._accessInfo = null;
  this._privateProfile = null;

  this._streamSerialCounter = 0;
  this._eventSerialCounter = 0;

  /**
   * Manipulate events for this connection
   * @type {ConnectionEvents}
   */
  this.events = new ConnectionEvents(this);
  /**
   * Manipulate streams for this connection
   * @type {ConnectionStreams}
   */
  this.streams = new ConnectionStreams(this);
  /**
  * Manipulate app profile for this connection
  * @type {ConnectionProfile}
  */
  this.profile = new ConnectionProfile(this);
  /**
  * Manipulate bookmarks for this connection
  * @type {ConnectionProfile}
  */
  this.bookmarks = new ConnectionBookmarks(this, Connection);
  /**
  * Manipulate accesses for this connection
  * @type {ConnectionProfile}
  */
  this.accesses = new ConnectionAccesses(this);
  /**
   * Manipulate this connection monitors
   */
  this.monitors = new ConnectionMonitors(this);

  this.account = new ConnectionAccount(this);
  this.datastore = null;

};

Connection._serialCounter = 0;


/**
 * In order to access some properties such as event.stream and get a {Stream} object, you
 * need to fetch the structure at least once. For now, there is now way to be sure that the
 * structure is up to date. Soon we will implement an optional parameter "keepItUpToDate", that
 * will do that for you.
 *
 * TODO implements "keepItUpToDate" logic.
 * @param {Streams~getCallback} callback - array of "root" Streams
 * @returns {Connection} this
 */
Connection.prototype.fetchStructure = function (callback /*, keepItUpToDate*/) {
  if (this.datastore) { return this.datastore.init(callback); }
  this.datastore = new Datastore(this);
  this.accessInfo(function (error) {
    if (error) { return callback(error); }
    this.datastore.init(callback);
  }.bind(this));
  return this;
};

/**
 * Get access information related this connection. This is also the best way to test
 * that the combination username/token is valid.
 * @param {Connection~accessInfoCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.accessInfo = function (callback) {
  if (this._accessInfo) { return this._accessInfo; }
  var url = '/access-info';
  this.request('GET', url, function (error, result) {
    if (! error) {
      this._accessInfo = result;
    }
    if (typeof(callback) === 'function') {
      return callback(error, result);
    }
  }.bind(this));
  return this;
};

/**
 * Get the private profile related this connection.
 * @param {Connection~privateProfileCallback} callback
 * @returns {Connection} this
 */
Connection.prototype.privateProfile = function (callback) {
  if (this._privateProfile) { return this._privateProfile; }
  this.profile.getPrivate(null, function (error, result) {
    if (result && result.message) {
      error = result;
    }
    if (! error) {
      this._privateProfile = result;
    }
    if (typeof(callback) === 'function') {
      return callback(error, result);
    }
  }.bind(this));
  return this;
};

/**
 * Translate this timestamp (server dimension) to local system dimension
 * This could have been named to "translate2LocalTime"
 * @param {number} serverTime timestamp  (server dimension)
 * @returns {number} timestamp (local dimension) same time space as (new Date()).getTime();
 */
Connection.prototype.getLocalTime = function (serverTime) {
  return (serverTime + this.serverInfos.deltaTime) * 1000;
};

/**
 * Translate this timestamp (local system dimension) to server dimension
 * This could have been named to "translate2ServerTime"
 * @param {number} localTime timestamp  (local dimension) same time space as (new Date()).getTime();
 * @returns {number} timestamp (server dimension)
 */
Connection.prototype.getServerTime = function (localTime) {
  if (typeof localTime === 'undefined') { localTime = new Date().getTime(); }
  return (localTime / 1000) - this.serverInfos.deltaTime;
};


// ------------- monitor this connection --------//

/**
 * Start monitoring this Connection. Any change that occurs on the connection (add, delete, change)
 * will trigger an event. Changes to the filter will also trigger events if they have an impact on
 * the monitored data.
 * @param {Filter} filter - changes to this filter will be monitored.
 * @returns {Monitor}
 */
Connection.prototype.monitor = function (filter) {
  return this.monitors.create(filter);
};

// ------------- start / stop Monitoring is called by Monitor constructor / destructor -----//



/**
 * Do a direct request to Pryv's API.
 * Even if exposed there must be an abstraction for every API call in this library.
 * @param {string} method - GET | POST | PUT | DELETE
 * @param {string} path - to resource, starting with '/' like '/events'
 * @param {Connection~requestCallback} callback
 * @param {Object} jsonData - data to POST or PUT
 */
Connection.prototype.request = function (method, path, callback, jsonData, isFile,
                                         progressCallback) {


  if (! callback || ! _.isFunction(callback)) {
    throw new Error('request\'s callback must be a function');
  }
  var headers =  { 'authorization': this.auth };
  var withoutCredentials = false;
  var payload = JSON.stringify({});
  if (jsonData && !isFile) {
    payload = JSON.stringify(jsonData);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  if (isFile) {
    payload = jsonData;
    headers['Content-Type'] = 'multipart/form-data';
    headers['X-Requested-With'] = 'XMLHttpRequest';
    withoutCredentials = true;
  }

  var request = utility.request({
    method : method,
    host : getHostname(this),
    port : this.settings.port,
    ssl : this.settings.ssl,
    path : this.settings.extraPath + path,
    headers : headers,
    payload : payload,
    progressCallback: progressCallback,
    //TODO: decide what callback convention to use (Node or jQuery)
    success : onSuccess.bind(this),
    error : onError.bind(this),
    withoutCredentials: withoutCredentials
  });

  /**
   * @this {Connection}
   */
  function onSuccess(result, resultInfo) {
    var error = null;

    var apiVersion = resultInfo.headers['API-Version'] || 
      resultInfo.headers[CC.Api.Headers.ApiVersion];

    // test if API is reached or if we headed into something else
    if (! apiVersion) {
      error = {
        id : CC.Errors.API_UNREACHEABLE,
        message: 'Cannot find API-Version',
        details: 'Response code: ' + resultInfo.code +
          ' Headers: ' + JSON.stringify(resultInfo.headers)
      };
    } else if (result.message) {  // API < 0.6
      error = result.message;
    } else
    if (result.error) { // API 0.7
      error = result.error;
    } else {
      this.serverInfos.lastSeenLT = (new Date()).getTime();
      this.serverInfos.apiVersion = apiVersion || this.serverInfos.apiVersion;
      if (_.has(resultInfo.headers, CC.Api.Headers.ServerTime)) {
        this.serverInfos.deltaTime = (this.serverInfos.lastSeenLT / 1000) -
          resultInfo.headers[CC.Api.Headers.ServerTime];
      }
    }
    callback(error, result, resultInfo);
  }

  function onError(error, resultInfo) {
    var errorTemp = {
      id : CC.Errors.API_UNREACHEABLE,
      message: 'Error on request ',
      details: 'ERROR: ' + error
    };
    callback(errorTemp, null, resultInfo);
  }
  return request;
};



/**
 * @property {string} Connection.id an unique id that contains all needed information to access
 * this Pryv data source. http[s]://<username>.<domain>:<port>[/extraPath]/?auth=<auth token>
 */
Object.defineProperty(Connection.prototype, 'id', {
  get: function () {
    var id = this.settings.ssl ? 'https://' : 'http://';
    id += getHostname(this) + ':' +
        this.settings.port + this.settings.extraPath + '/?auth=' + this.auth;
    return id;
  },
  set: function () { throw new Error('ConnectionNode.id property is read only'); }
});

/**
 * @property {string} Connection.displayId an id easily readable <username>:<access name>
 */
Object.defineProperty(Connection.prototype, 'displayId', {
  get: function () {
    if (! this._accessInfo) {
      throw new Error('connection must have been initialized to use displayId. ' +
        ' You can call accessInfo() for this');
    }
    var id = this.username + ':' + this._accessInfo.name;
    return id;
  },
  set: function () { throw new Error('Connection.displayId property is read only'); }
});

/**
 * @property {String} Connection.serialId A locally-unique id for the connection; can also be
 *                                        used as a client-side id
 */
Object.defineProperty(Connection.prototype, 'serialId', {
  get: function () { return 'C' + this._serialId; }
});
/**
 * Called with the desired Streams as result.
 * @callback Connection~accessInfoCallback
 * @param {Object} error - eventual error
 * @param {AccessInfo} result
 */

/**
 * @typedef AccessInfo
 * @see http://api.pryv.com/reference.html#data-structure-access
 */

/**
 * Called with the result of the request
 * @callback Connection~requestCallback
 * @param {Object} error - eventual error
 * @param {Object} result - jSonEncoded result
 * @param {Object} resultInfo
 * @param {Number} resultInfo.code - HTTP result code
 * @param {Object} resultInfo.headers - HTTP result headers by key
 */


// --------- private utils

function getHostname(connection) {
  return connection.settings.hostname ||
      connection.username ?
      connection.username + '.' + connection.settings.domain : connection.settings.domain;
}

},{"./Datastore.js":45,"./connection/ConnectionAccesses.js":53,"./connection/ConnectionAccount.js":54,"./connection/ConnectionBookmarks.js":55,"./connection/ConnectionConstants.js":56,"./connection/ConnectionEvents.js":57,"./connection/ConnectionMonitors.js":58,"./connection/ConnectionProfile.js":59,"./connection/ConnectionStreams.js":60,"./utility/utility.js":73,"underscore":43}],45:[function(require,module,exports){
/**
 * DataStore handles in memory caching of objects.
 * @private
 */

var _ = require('underscore');
var Event = require('./Event');
var Stream = require('./Stream');

function Datastore(connection) {
  this.connection = connection;
  this.streamsIndex = {}; // streams are linked to their object representation
  this.eventIndex = {}; // events are store by their id
  this.rootStreams = [];
  this.rootStreamsAll = []; // including trashed streams
}

module.exports = Datastore;

Datastore.prototype.init = function (callback) {
  this.connection.streams._getObjects({state: 'all'}, function (error, result) {
    if (error) { return callback('Datastore faild to init - '  + error); }
    if (result) {
      this._rebuildStreamIndex(result); // maybe done transparently
    }
    callback(null, result);
  }.bind(this));

  // TODO activate monitoring
};

Datastore.prototype._rebuildStreamIndex = function (streamArray) {
  this.streamsIndex = {};
  this.rootStreams = [];
  this.rootStreamsAll = [];
  this._indexStreamArray(streamArray);
};

Datastore.prototype._indexStreamArray = function (streamArray) {
  _.each(streamArray, function (stream) {
    this.indexStream(stream);
  }.bind(this));
};

Datastore.prototype.indexStream = function (stream) {
  this.streamsIndex[stream.id] = stream;
  if (! stream.parentId) {
    this.rootStreamsAll.push(stream);
    if (! stream.trashed) {
      this.rootStreams.push(stream);
    }
  }
  this._indexStreamArray(stream._children);
  delete stream._children; // cleanup when in datastore mode
  delete stream._parent;
};

/**
 *
 * @param all True to get all root streams including trashed one
 * @returns Stream or null if not found
 */
Datastore.prototype.getStreams = function (all) {
  if (all) { return this.rootStreamsAll; }
  return this.rootStreams;
};


/**
 *
 * @param streamId
 * @param test (do no throw error if Stream is not found
 * @returns Stream or null if not found
 */
Datastore.prototype.getStreamById = function (streamId) {
  var result = this.streamsIndex[streamId];
  return result;
};

//-------------------------

/**
 * @param serialId
 * @returns Event or null if not found
 */
Datastore.prototype.getEventBySerialId = function (serialId) {
  var result = null;
  _.each(this.eventIndex, function (event /*,eventId*/) {
    if (event.serialId === serialId) { result = event; }
    // TODO optimize and break
  }.bind(this));
  return result;
};

/**
 * @param eventID
 * @returns Event or null if not found
 */
Datastore.prototype.getEventById = function (eventId) {
  return this.eventIndex[eventId];

};

/**
 * @returns allEvents
 */
Datastore.prototype.getEventsMatchingFilter = function (filter) {
  var result = [];
  _.each(this.eventIndex, function (event /*,eventId*/) {
    if (filter.matchEvent(event)) { result.push(event); }
  }.bind(this));
  return result;
};


/**
 * @returns allEvents
 */
Datastore.prototype.getAllEvents = function () {
  return _.value(this.eventIndex);
};

/**
 * @param event
 */
Datastore.prototype.addEvent = function (event) {
  if (! event.id) {
    throw new Error('Datastore.addEvent cannot add event with unkown id', event);
  }
  this.eventIndex[event.id] = event;
};



/**
 * @param {Object} data to map
 * @return {Event} event
 */
Datastore.prototype.createOrReuseEvent = function (data) {
  if (! data.id) {
    throw new Error('Datastore.createOrReuseEvent cannot create event with ' +
      ' unkown id' + require('util').inspect(data));
  }

  var result = this.getEventById(data.id);
  if (result) {  // found event
    _.extend(result, data);
    return result;
  }
  // create an event and register it
  result = new Event(this.connection, data);
  this.addEvent(result);

  return result;
};


/**
 * @param {Object} data to map
 * @return {Event} event
 */
Datastore.prototype.createOrReuseStream = function (data) {
    if (! data.id) {
        throw new Error('Datastore.createOrReuseStream cannot create stream with ' +
            ' unkown id' + require('util').inspect(data));
    }

    var result = this.getStreamById(data.id);
    if (result) {  // found event
        _.extend(result, data);
        return result;
    }
    // create an stream and register it
    result = new Stream(this.connection, data);
    this.indexStream(result);

    return result;
};



},{"./Event":46,"./Stream":49,"underscore":43,"util":41}],46:[function(require,module,exports){

var _ = require('underscore');

var RW_PROPERTIES =
  ['streamId', 'time', 'duration', 'type', 'content', 'tags', 'description',
    'clientData', 'state', 'modified', 'trashed'];


var escapeHtml = function (obj) {
  _.each(obj, function (value, key) {
    if (_.isString(value)) {
      obj[key] = _.escape(value);
    } else if ((key === 'content' && _.isObject(value)) || (key === 'tags' && _.isArray(value))) {
      escapeHtml(value);
    }
  });
};
/**
 *
 * @type {Function}
 * @constructor
 */
var Event = module.exports = function Event(connection, data) {
  if (! connection) {
    throw new Error('Cannot create connection less events');
  }
  this.connection = connection;
  this.trashed = false;
  this.serialId = this.connection.serialId + '>E' + this.connection._eventSerialCounter++;
  escapeHtml(data);
  _.extend(this, data);
};

/**
 * get Json object ready to be posted on the API
 */
Event.prototype.getData = function () {
  var data = {};
  _.each(RW_PROPERTIES, function (key) { // only set non null values
    if (_.has(this, key)) { data[key] = this[key]; }
  }.bind(this));
  return data;
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.update = function (callback) {
  this.connection.events.update(this, callback);
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.addAttachment = function (file, callback) {
  this.connection.events.addAttachment(this.id, file, callback);
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.removeAttachment = function (fileName, callback) {
  this.connection.events.removeAttachment(this.id, fileName, callback);
};
/**
 * TODO create an attachment Class that contains such logic
 * @param {attachment} attachment
 */
Event.prototype.attachmentUrl = function (attachment) {
  var url =  this.connection.settings.ssl ? 'https://' : 'http://';
  url += this.connection.username + '.' + this.connection.settings.domain + '/events/' +
    this.id + '/' + attachment.id + '?readToken=' + attachment.readToken;
  return url;
};
/**
 *
 * @param {Connection~requestCallback} callback
 */
Event.prototype.delete = Event.prototype.trash = function (callback) {
  this.connection.events.trash(this, callback);
};
/**
 * TODO document and rename to getPicturePreviewUrl
 * @param width
 * @param height
 * @returns {string}
 */
Event.prototype.getPicturePreview = function (width, height) {
  width = width ? '&w=' + width : '';
  height = height ? '&h=' + height : '';
  var url = this.connection.settings.ssl ? 'https://' : 'http://';
  url += this.connection.username + '.' + this.connection.settings.domain + ':3443/events/' +
    this.id + '?auth=' + this.connection.auth + width + height;
  return url;
};

Event.prototype.isRunning = function () {
  return !!('duration' in this && !this.duration && this.duration !== 0);
};
/**
 * TODO document
 */
Object.defineProperty(Event.prototype, 'timeLT', {
  get: function () {
    return this.connection.getLocalTime(this.time);
  },
  set: function (newValue) {
    this.time = this.connection.getServerTime(newValue);
  }
});



/**
 * TODO document
 */
Object.defineProperty(Event.prototype, 'stream', {
  get: function () {
    if (! this.connection.datastore) {
      throw new Error('call connection.fetchStructure before to get automatic stream mapping.' +
        ' Or use StreamId');
    }
    return this.connection.datastore.getStreamById(this.streamId);
  },
  set: function () { throw new Error('Event.stream property is read only'); }
});

/**
 * TODO document
 */
Object.defineProperty(Event.prototype, 'url', {
  get: function () {
    var url = this.connection.settings.ssl ? 'https://' : 'http://';
    url += this.connection.username + '.' + this.connection.settings.domain + '/events/' + this.id;
    return url;
  },
  set: function () { throw new Error('Event.url property is read only'); }
});


/**
 * An newly created Event (no id, not synched with API)
 * or an object with sufficient properties to be considered as an Event.
 * @typedef {(Event|Object)} NewEventLike
 * @property {String} streamId
 * @property {String} type
 * @property {number} [time]
 */

},{"underscore":43}],47:[function(require,module,exports){
var _ = require('underscore'),
    SignalEmitter = require('./utility/SignalEmitter.js');

/**
 * TODO Filter is badly missing a correct documentation
 * @constructor
 */
var Filter = module.exports = function Filter(settings) {
  SignalEmitter.extend(this, Messages, 'Filter');

  this._settings = _.extend({
    //TODO: set default values
    streams: null, //ids
    tags: null,
    fromTime: null,  // serverTime
    toTime: null,  // serverTime
    limit: null,
    skip: null,
    types: null,
    modifiedSince: null,
    state: null
  }, settings);
};

var Messages = Filter.Messages = {
  /**
   * generic change event called on any change
   * content: {filter, signal, content}
   **/
  ON_CHANGE : 'changed',
  /**
   * called on streams changes
   * content: streams
   */
  STREAMS_CHANGE : 'streamsChanged',

  /**
   * called on streams structure changes
   * content: changes
   */
  STRUCTURE_CHANGE : 'structureChange',

  /*
   * called on date changes
   * content: streams
   */
  DATE_CHANGE : 'timeFrameChanged',

  /*
   * called on state changes
   * content: {state: value}
   */
  STATE_CHANGE : 'stateChanged'
};

// TODO
// redundant with get
function _normalizeTimeFrameST(filterData) {
  var result = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
  if (filterData.fromTime || filterData.fromTime === 0) {
    result[0] = filterData.fromTime;
  }
  if (filterData.toTime || filterData.toTime === 0) {
    result[1] = filterData.toTime;
  }
  return result;
}



/**
 * TODO write doc
 * TODO complete with tags and state and modified and..
 * check if this event is in this filter
 */
Filter.prototype.matchEvent = function (event) {
  if (event.time > this.toTimeSTNormalized) { return false; }
  if (event.time < this.fromTimeSTNormalized) { return false; }


  if (this._settings.state !== 'all') {
    if (event.trashed) { return false; }
  }

  if (this._settings.streams) {

    if (this._settings.streams.length === 0) { return false; }

    if (this._settings.streams.indexOf(event.streamId) < 0) {
      var found = false;
      if (!event.stream) {
        return false;
      }
      event.stream.ancestors.forEach(function (ancestor) {
        if (this._settings.streams.indexOf(ancestor.id) >= 0) {
          if (this._settings.state !== 'all') {
            if (ancestor.trashed) { return false; }
          }
          found = true;
        }
      }.bind(this));
      if (!found) {
        return false;
      }
    }
  }



  // TODO complete test
  return true;
};

/**
 * Compare this filter with data form another filter
 * @param {Object} filterDataTest data got with filter.getData
 * @returns keymap \{ timeFrame : -1, 0 , 1 \}
 * (1 = more than test, -1 = less data than test, 0 == no changes)
 */
Filter.prototype.compareToFilterData = function (filterDataTest) {
  var result = { timeFrame : 0, streams : 0 };


  // timeFrame
  var myTimeFrameST = [this.fromTimeSTNormalized, this.toTimeSTNormalized];
  var testTimeFrameST = _normalizeTimeFrameST(filterDataTest);
  console.log(myTimeFrameST);
  console.log(testTimeFrameST);

  if (myTimeFrameST[0] < testTimeFrameST[0]) {
    result.timeFrame = 1;
  } else if (myTimeFrameST[0] > testTimeFrameST[0]) {
    result.timeFrame = -1;
  }
  if (result.timeFrame <= 0) {
    if (myTimeFrameST[1] > testTimeFrameST[1]) {
      result.timeFrame = 1;
    } else  if (myTimeFrameST[1] < testTimeFrameST[1]) {
      result.timeFrame = -1;
    }
  }

  // streams
  //TODO look if this processing can be optimized

  var nullStream = 0;
  if (! this._settings.streams) {
    if (filterDataTest.streams) {
      result.streams = 1;
    }
    nullStream = 1;
  }
  if (! filterDataTest.streams) {
    if (this._settings.streams) {
      result.streams = -1;
    }
    nullStream = 1;
  }

  if (! nullStream) {
    var notinTest = _.difference(this._settings.streams, filterDataTest.streams);
    if (notinTest.length > 0) {
      result.streams = 1;
    } else {
      var notinLocal = _.difference(filterDataTest.streams, this._settings.streams);
      if (notinLocal.length > 0) {
        result.streams = -1;
      }
    }
  }

  return result;
};

/**
 * Create a clone of this filter and changes some properties
 * @param properties
 * @returns pryv.Filter
 */
Filter.prototype.cloneWithDelta = function (properties) {
  var newProps = _.clone(this._settings);
  _.extend(newProps, properties);
  return new Filter(newProps);
};

/**
 *
 * @param ignoreNulls (optional) boolean
 * @param withDelta (optional) apply this differences on the data
 * @returns {*}
 */
Filter.prototype.getData = function (ignoreNulls, withDelta) {
  ignoreNulls = ignoreNulls || false;
  var result = _.clone(this._settings);
  if (withDelta)  {
    _.extend(result, withDelta);
  }
  _.each(_.keys(result), function (key) {
    if ((result[key] === null)) { delete result[key]; }
  });
  return result;
};

/**
 * @private
 */
Filter.prototype._fireFilterChange = function (signal, content, batch) {
  // generic
  this._fireEvent(Messages.ON_CHANGE, {filter: this, signal: signal, content: content}, batch);
  // specific
  this._fireEvent(signal, content, batch);
};

/**
 * TODO review documentation and add example
 * Change several values of the filter in batch.. this wil group all events behind a batch id
 * @param keyValueMap {Object}
 * @param batch {SignalEmitter~Batch}
 */
Filter.prototype.set = function (keyValueMap, batch) {
  batch = this.startBatch('set', batch);

  _.each(keyValueMap, function (value, key) {
    this._setValue(key, value, batch);
  }.bind(this));

  batch.done('set');
};

/**
 * Internal that take in charge of changing values
 * @param keyValueMap
 * @param batch
 * @private
 */
Filter.prototype._setValue = function (key, newValue, batch) {
  batch = this.startBatch('setValue:' + key, batch);

  if (key === 'limit') {
    this._settings.limit = newValue;

    // TODO handle changes
    return;
  }


  if (key === 'state') {
    if (this._settings.state !== newValue) {
      this._settings.state = newValue;
      this._fireFilterChange(Messages.STATE_CHANGE, {state: newValue}, batch);
    }
    batch.done('setValue:' + key);
    return;
  }

  if (key === 'timeFrameST') {
    if (! _.isArray(newValue) || newValue.length !== 2) {
      throw new Error('Filter.timeFrameST is an Array of two timestamps [fromTime, toTime]');
    }
    if (this._settings.fromTime !== newValue[0] || this._settings.toTime !== newValue[1]) {
      this._settings.fromTime = newValue[0];
      this._settings.toTime = newValue[1];
      this._fireFilterChange(Messages.DATE_CHANGE, this.timeFrameST, batch);
    }
    batch.done('setValue:' + key);
    return;
  }

  if (key === 'streamsIds') {

    if (newValue === null || typeof newValue === 'undefined') {
      if (this._settings.streams === null) {

        return;
      }
      newValue = null;
    } else if (! _.isArray(newValue)) {
      newValue = [newValue];
    }

    // TODO check that this stream is valid
    this._settings.streams = newValue;
    this._fireFilterChange(Messages.STREAMS_CHANGE, this.streams, batch);
    batch.done('setValue:' + key);
    return;
  }

  batch.done('setValue:' + key);
  throw new Error('Filter has no property : ' + key);
};

/**
 * get toTime, return Number.POSITIVE_INFINITY if null
 */
Object.defineProperty(Filter.prototype, 'toTimeSTNormalized', {
  get: function () {
    if (this._settings.toTime || this._settings.toTime === 0) {
      return this._settings.toTime;
    }
    return Number.POSITIVE_INFINITY;
  }
});

/**
 * get fromTime, return Number.POSITIVE_INFINITY if null
 */
Object.defineProperty(Filter.prototype, 'fromTimeSTNormalized', {
  get: function () {
    if (this._settings.fromTime || this._settings.fromTime === 0) {
      return this._settings.fromTime;
    }
    return Number.NEGATIVE_INFINITY;
  }
});



/**
 * timeFrameChange ..  [fromTime, toTime]
 * setting them to "null" => ALL
 */
Object.defineProperty(Filter.prototype, 'timeFrameST', {
  get: function () {
    return [this._settings.toTime, this._settings.fromTime];
  },
  set: function (newValue) {
    this._setValue('timeFrameST', newValue);
    return this.timeFrameST;
  }
});


/**
 * StreamIds ..
 * setting them to "null" => ALL and to "[]" => NONE
 */
Object.defineProperty(Filter.prototype, 'streamsIds', {
  get: function () {
    return this._settings.streams;
  },
  set: function (newValue) {
    this._setValue('streamsIds', newValue);
    return this._settings.streams;
  }
});


/**
 * return true if context (stream is on a single stream)
 * This is usefull to check when creating and event in a context.
 * This way, no need to ask the user for a stream specification.
 * TODO determine if this should stay in the lib.. or handle by apps
 */
Filter.prototype.focusedOnSingleStream = function () {
  if (_.isArray(this._settings.streams) && this._settings.streams.length === 1) {
    return this._settings.streams[0];
  }
  return null;
};

/**
 * An pryv Filter or an object corresponding at what we can get with Filter.getData().
 * @typedef {(Filter|Object)} FilterLike
 * @property {String[]} [streams]
 * @property {String[]} [tags]
 * @property {number} [fromTime] -- serverTime
 * @property {number} [toTime] -- serverTime
 * @property {number} [modifiedSince] -- serverTime
 * @property {number} [limit] -- response to 'n' events
 * @property {number} [skip] -- skip the first 'n' events of he response
 */


},{"./utility/SignalEmitter.js":65,"underscore":43}],48:[function(require,module,exports){
var _ = require('underscore'),
  SignalEmitter = require('./utility/SignalEmitter.js'),
  Filter = require('./Filter.js');

var EXTRA_ALL_EVENTS = {state : 'all', modifiedSince : -100000000 };
var REALLY_ALL_EVENTS =  EXTRA_ALL_EVENTS;
REALLY_ALL_EVENTS.fromTime = -1000000000;
REALLY_ALL_EVENTS.toTime = 10000000000;

var GETEVENT_MIN_REFRESH_RATE = 2000;

/**
 * Monitoring
 * @type {Function}
 * @constructor
 */
function Monitor(connection, filter) {
  SignalEmitter.extend(this, Messages, 'Monitor');
  this.connection = connection;
  this.id = 'M' + Monitor.serial++;

  this.filter = filter;

  this._lastUsedFilterData = filter.getData();

  if (this.filter.state) {
    throw new Error('Monitors only work for default state, not trashed or all');
  }

  this.filter.addEventListener(Filter.Messages.ON_CHANGE, this._onFilterChange.bind(this));
  this._events = null;


  // -- optimization & caching
  this.useCacheForEventsGetAllAndCompare = true;  // will look into cache before online
  this.ensureFullCache = true; // will fill the cache with ALL pryv content
  this.initWithPrefetch = 100; // prefetch some events before ensuringFullCache
}

Monitor.serial = 0;

var Messages = Monitor.Messages = {
  /** content: events **/
  ON_LOAD : 'started',
  /** content: error **/
  ON_ERROR : 'error',
  /** content: { enter: [], leave: [], change } **/
  ON_EVENT_CHANGE : 'eventsChanged',
  /** content: streams **/
  ON_STRUCTURE_CHANGE : 'streamsChanged',
  /** content: ? **/
  ON_FILTER_CHANGE : 'filterChanged'
};

// ----------- prototype  public ------------//

Monitor.prototype.start = function (done) {
  done = done || function () {};
  var batch = this.startBatch('Monitor:start');
  batch.addOnDoneListener('Monitor:startCompletion', function () {
    //TODO move this logic to ConnectionMonitors ??
    this.connection.monitors._monitors[this.id] = this;
    this.connection.monitors._startMonitoring(done);
  }.bind(this));


  this.lastSynchedST = -1000000000000;
  this._initEvents(batch);
  batch.done('Monitor:start');


};


Monitor.prototype.destroy = function () {
  //TODO move this logic to ConnectionMonitors ??
  delete this.connection.monitors._monitors[this.id];
  if (_.keys(this.connection.monitors._monitors).length === 0) {
    this.connection.monitors._stopMonitoring();
  }
};

Monitor.prototype.getEvents = function () {
  if (! this._events || ! this._events.active) {return []; }
  return _.toArray(this._events.active);
};

// ------------ private ----------//

// ----------- iOSocket ------//
Monitor.prototype._onIoConnect = function () {
  console.log('Monitor onConnect');
};
Monitor.prototype._onIoError = function (error) {
  console.log('Monitor _onIoError' + error);
};
Monitor.prototype._onIoEventsChanged = function () {
  var batch = this.startBatch('IoEventChanged');
  this._connectionEventsGetChanges(batch);
  batch.done('IoEventChanged');
};
Monitor.prototype._onIoStreamsChanged = function () {
  console.log('SOCKETIO', '_onIoStreamsChanged');
  var batch = this.startBatch('IoStreamsChanged');
  this._connectionStreamsGetChanges(batch);
  batch.done('IoStreamsChanged');
};



// -----------  filter changes ----------- //


Monitor.prototype._saveLastUsedFilter = function () {
  this._lastUsedFilterData = this.filter.getData();
};


Monitor.prototype._onFilterChange = function (signal, batch) {


  var changes = this.filter.compareToFilterData(this._lastUsedFilterData);

  var processLocalyOnly = 0;
  var foundsignal = 0;
  if (signal.signal === Filter.Messages.DATE_CHANGE) {  // only load events if date is wider
    foundsignal = 1;
    console.log('** DATE CHANGE ', changes.timeFrame);
    if (changes.timeFrame === 0) {
      return;
    }
    if (changes.timeFrame < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }

  }

  if (signal.signal === Filter.Messages.STREAMS_CHANGE) {
    foundsignal = 1;
    console.log('** STREAMS_CHANGE', changes.streams);
    if (changes.streams === 0) {
      return;
    }
    if (changes.streams < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }
  }

  if (signal.signal === Filter.Messages.STREAMS_CHANGE) {
    foundsignal = 1;
    console.log('** STREAMS_CHANGE', changes.streams);
    if (changes.streams === 0) {
      return;
    }
    if (changes.streams < 0) {  // new timeFrame contains more data
      processLocalyOnly = 1;
    }
  }

  if (signal.signal === Filter.Messages.STRUCTURE_CHANGE) {
    foundsignal = 1;
    // force full refresh
  }


  if (! foundsignal) {
    throw new Error('Signal not found :' + signal.signal);
  }

  this._saveLastUsedFilter();



  if (processLocalyOnly) {
    this._refilterLocaly(Messages.ON_FILTER_CHANGE, {filterInfos: signal}, batch);
  } else {
    this._connectionEventsGetAllAndCompare(Messages.ON_FILTER_CHANGE, {filterInfos: signal}, batch);
  }
};

// ----------- internal ----------------- //

/**
 * Process events locally
 */
Monitor.prototype._refilterLocaly = function (signal, extracontent, batch) {

  var result = { enter : [], leave : [] };
  _.extend(result, extracontent); // pass extracontent to receivers
  _.each(_.clone(this._events.active), function (event) {
    if (! this.filter.matchEvent(event)) {
      result.leave.push(event);
      delete this._events.active[event.id];
    }
  }.bind(this));
  this._fireEvent(signal, result, batch);
};


Monitor.prototype._initEvents = function (batch) {
  batch = this.startBatch('Monitor:initEvents', batch);
  this._events = { active : {}};


  var filterWith = this.filter.getData(true, EXTRA_ALL_EVENTS);

  if (this.initWithPrefetch) {
    filterWith.limit = this.initWithPrefetch;
  } else {
    if (this.ensureFullCache) {  filterWith = REALLY_ALL_EVENTS; }
  }


  this.connection.events.get(filterWith,
    function (error, events) {
      if (error) {
        this._fireEvent(Messages.ON_ERROR, error, batch);
        batch.done('Monitor:initEvents error');
        return;
      }

      if (! this.initWithPrefetch) { this.lastSynchedST = this.connection.getServerTime(); }

      var result = [];

      _.each(events, function (event) {
        if (! this.ensureFullCache || this.filter.matchEvent(event)) {
          this._events.active[event.id] = event;
          result.push(event);
        }
      }.bind(this));


      this._fireEvent(Messages.ON_LOAD, result, batch);

      if (this.initWithPrefetch) {
        batch.waitForMeToFinish('delay');
        setTimeout(function () {
          this._connectionEventsGetChanges(batch);
          batch.done('delay');
        }.bind(this), 100);
      }
      batch.done('Monitor:initEvents finished');


    }.bind(this));
};





/**
 * @private
 */
Monitor.prototype._connectionEventsGetChanges = function (batch) {
  batch = this.startBatch('connectionEventsGetChanges', batch);
  if (this.eventsGetChangesInProgress) {
    this.eventsGetChangesNeeded = true;
    console.log('[WARNING] Skipping _connectionEventsGetChanges because one is in Progress');
    batch.done('connectionEventsGetChanges in Progress');
    return;
  }
  this.eventsGetChangesInProgress = true;
  this.eventsGetChangesNeeded = false;


  // var options = { modifiedSince : this.lastSynchedST};
  var options = { modifiedSince : this.lastSynchedST, state : 'all'};


  var filterWith = this.filter.getData(true, options);
  if (this.ensureFullCache) {
    filterWith = REALLY_ALL_EVENTS;
    filterWith = _.extend(filterWith, options);
  }
  this.lastSynchedST = this.connection.getServerTime();

  var result = { created : [], trashed : [], modified: []};

  this.connection.events.get(filterWith,
    function (error, events) {
      if (error) {
        this._fireEvent(Messages.ON_ERROR, error, batch);
        batch.done('connectionEventsGetChanges error');
        return;
      }

      _.each(events, function (event) {
        if (! this.ensureFullCache || this.filter.matchEvent(event)) {
          if (this._events.active[event.id]) {
            if (event.trashed && !this._events.active[event.id].trashed) { // trashed
              result.trashed.push(event);
              delete this._events.active[event.id];
            } else {
              result.modified.push(event);
              this._events.active[event.id] = event;
            }
          } else {
            if (this.ensureFullCache) { // can test streams  state (trashed)
              if (!event.trashed && event.stream && !event.stream.trashed) {
                result.created.push(event);
                this._events.active[event.id] = event;
              }
            } else {  // cannot test stream state
              if (!event.trashed) {
                result.created.push(event);
                this._events.active[event.id] = event;
              }
            }
          }
        }
      }.bind(this));

      this._fireEvent(Messages.ON_EVENT_CHANGE, result, batch);
      batch.done('connectionEventsGetChanges');

      // ---
      setTimeout(function () {
        this.eventsGetChangesInProgress = false;
        if (this.eventsGetChangesNeeded) {
          this._connectionEventsGetChanges();
        }
      }.bind(this), GETEVENT_MIN_REFRESH_RATE);

    }.bind(this));
};

/**
 * @private
 */
Monitor.prototype._connectionStreamsGetChanges = function (batch) {
  batch = this.startBatch('connectionStreamsGetChanges', batch);
  var previousStreamsData = {};
  var previousStreamsMap = {}; // !! only used to get back deleted streams..
  var created = [], modified = [], modifiedPreviousProperties = {}, trashed = [], deleted = [];

  var isStreamChanged = function (streamA, streamB) {
    return !_.isEqual(streamA, streamB);
  };


  // check if the stream has changed it.. and save it in the right message box
  var checkChangedStatus = function (stream) {


    if (! previousStreamsData[stream.id]) { // new stream
      created.push(stream);
    } else if (isStreamChanged(previousStreamsData[stream.id], stream.getData())) {

      if (previousStreamsData[stream.id].trashed !== stream.trashed) {
        if (!stream.trashed) {
          created.push(stream);
        } else {
          trashed.push(stream);
        }
      } else {
        modified.push(stream);
        modifiedPreviousProperties[stream.id] = previousStreamsData[stream.id];
      }
    }

    _.each(stream.children, function (child) {
      checkChangedStatus(child);
    });
    delete previousStreamsData[stream.id];
  };

  //-- get all current streams before matching with new ones --//
  var getFlatTree = function (stream) {
    previousStreamsData[stream.id] = stream.getData();
    previousStreamsMap[stream.id] = stream;

    _.each(stream.children, function (child) {
      getFlatTree(child);
    });
  };
  _.each(this.connection.datastore.getStreams(true), function (rootStream) {
    getFlatTree(rootStream);
  });

  this.connection.fetchStructure(function (error, result) {
    if (error) {
      batch.done('connectionStreamsGetChanges fetchStructure error');
      return;
    }
    _.each(result, function (rootStream) {
      checkChangedStatus(rootStream);
    });
    // each stream remaining in streams[] are deleted streams;
    _.each(previousStreamsData, function (streamData, streamId) {
      deleted.push(previousStreamsMap[streamId]);
    });

    this._fireEvent(Messages.ON_STRUCTURE_CHANGE,
      { created : created, trashed : trashed, modified: modified, deleted: deleted,
        modifiedPreviousProperties: modifiedPreviousProperties}, batch);

    this._onFilterChange({signal : Filter.Messages.STRUCTURE_CHANGE}, batch);
    batch.done('connectionStreamsGetChanges');
  }.bind(this));
};

/**
 * @private
 */
Monitor.prototype._connectionEventsGetAllAndCompare = function (signal, extracontent, batch) {
  this.lastSynchedST = this.connection.getServerTime();


  if (this.useCacheForEventsGetAllAndCompare) {



    // POC code to look into in-memory events for matching events..
    // do not activate until cache handles DELETE
    var result1 = { enter : [], leave : []};
    _.extend(result1, extracontent);


    // first cleanup same as : this._refilterLocaly(signal, extracontent, batch);
    if (! this._events) {
      throw new Error('Not yet started!!!');
    }
    _.each(_.clone(this._events.active), function (event) {
      if (! this.filter.matchEvent(event)) {
        result1.leave.push(event);
        delete this._events.active[event.id];
      }
    }.bind(this));



    var cachedEvents = this.connection.datastore.getEventsMatchingFilter(this.filter);
    _.each(cachedEvents, function (event) {
      if (! this._events.active[event.id]) {  // we don't care for already known event
        this._events.active[event.id] = event; // store it
        result1.enter.push(event);
      }
    }.bind(this));



    this._fireEvent(signal, result1, batch);

    // remove all events not matching filter


  }

  // look online
  if (! this.ensureFullCache)  { // not needed when full cache is enabled
    var result = { enter : [] };
    _.extend(result, extracontent); // pass extracontent to receivers

    var toremove = _.clone(this._events.active);

    batch = this.startBatch('connectionEventsGetAllAndCompare:online', batch);
    this.connection.events.get(this.filter.getData(true, EXTRA_ALL_EVENTS),
      function (error, events) {
        if (error) {
          this._fireEvent(Messages.ON_ERROR, error, batch);
          batch.done('connectionEventsGetAllAndCompare:online error');
          return;
        }
        _.each(events, function (event) {
          if (this._events.active[event.id]) {  // already known event we don't care
            delete toremove[event.id];
          } else {
            this._events.active[event.id] = event;
            result.enter.push(event);
          }
        }.bind(this));
        _.each(_.keys(toremove), function (streamid) {
          delete this._events.active[streamid]; // cleanup not found streams
        }.bind(this));
        result.leave = _.values(toremove); // unmatched events are to be removed
        this._fireEvent(signal, result, batch);
        batch.done('connectionEventsGetAllAndCompare:online');
      }.bind(this));
  }
};


/**
 * TODO write doc
 * return informations on events
 */
Monitor.prototype.stats = function (force, callback) {
  this.connection.profile.getTimeLimits(force, callback);
};

module.exports = Monitor;



},{"./Filter.js":47,"./utility/SignalEmitter.js":65,"underscore":43}],49:[function(require,module,exports){
var _ = require('underscore');



/**
 * TODO write documentation  with use cases.. !!
 * @type {Function}
 */
var Stream = module.exports = function Stream(connection, data) {
  this.connection = connection;

  this.serialId = this.connection.serialId + '>S' + this.connection._streamSerialCounter++;
  /** those are only used when no datastore **/
  this._parent = null;
  this.parentId = null;
  this.trashed = false;
  this._children = [];
  data.name = _.escape(data.name);
  _.extend(this, data);
};

Stream.RW_PROPERTIES =
  ['name', 'parentId', 'singleActivity', 'clientData', 'trashed'];

/**
 * get Json object ready to be posted on the API
 */
Stream.prototype.getData = function () {
  var data = {};
  _.each(Stream.RW_PROPERTIES, function (key) { // only set non null values
    if (_.has(this, key)) { data[key] = this[key]; }
  }.bind(this));
  return data;
};


/**
 * Set or erase clientData properties
 * @example // set x=25 and delete y
 * stream.setClientData({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValueMap
 * @param {Connection~requestCallback} callback
 */
Stream.prototype.setClientData = function (keyValueMap, callback) {
  return this.connection.streams.setClientData(this, keyValueMap, callback);
};

Object.defineProperty(Stream.prototype, 'parent', {
  get: function () {

    if (!this.parentId) {
      return null;
    }
    if (!this.connection.datastore) { // we use this._parent and this._children
      return this._parent;
    }

    return this.connection.datastore.getStreamById(this.parentId);
  },
  set: function (p) {
    if (p instanceof Stream) {
      p = p.id;
    }

    this.parentId = p;

    if (!this.connection.datastore) { // we use this._parent and this._children
      this._parent = p;
    }
    throw new Error('Stream.parent property is read only');
  }
});

/**
 * TODO write documentation
 * Does not return trashed childrens
 */
Object.defineProperty(Stream.prototype, 'children', {
  get: function () {
    if (!this.connection.datastore) { // we use this._parent and this._children
      return this._children;
    }
    var children = [];
    _.each(this.childrenIds, function (childrenId) {
      try {
        var child = this.connection.datastore.getStreamById(childrenId);
        if (child.parentId === this.id && ! child.trashed) { // exclude trashed childs
          children.push(child);
        }
      } catch (e) {
        console.warn('cannot find child', e);
      }
    }.bind(this));
    return children;
  },
  set: function () {
    throw new Error('Stream.children property is read only');
  }
});

// TODO write test
Object.defineProperty(Stream.prototype, 'ancestors', {
  get: function () {
    if (!this.parentId || this.parent === null) {
      return [];
    }
    var result = this.parent.ancestors;
    result.push(this.parent);
    return result;
  },
  set: function () {
    throw new Error('Stream.ancestors property is read only');
  }
});







},{"underscore":43}],50:[function(require,module,exports){
/* global confirm, document, navigator, location, window */

var utility = require('../utility/utility.js');
var Connection = require('../Connection.js');
var _ = require('underscore');


//--------------------- access ----------//
/**
 * @class Auth
 * */
var Auth = function () {
};


_.extend(Auth.prototype, {
  connection: null, // actual connection managed by Auth
  config: {
    // TODO: clean up this hard-coded mess and rely on the one and only Pryv URL domains reference
    registerURL: {ssl: true, host: 'reg.pryv.io'},
    registerStagingURL: {ssl: true, host: 'reg.pryv.in'},
    localDevel : false,
    sdkFullPath: 'https://dlw0lofo79is5.cloudfront.net/lib-javascript/latest'
  },
  state: null,  // actual state
  window: null,  // popup window reference (if any)
  spanButton: null, // an element on the app web page that can be controlled
  buttonHTML: '',
  onClick: {}, // functions called when button is clicked
  settings: null,
  pollingID: false,
  pollingIsOn: true, //may be turned off if we can communicate between windows
  cookieEnabled: false,
  ignoreStateFromURL: false // turned to true in case of loggout
});

/**
 * Method to initialize the data required for authorization.
 * @method _init
 * @access private
 */
Auth._init = function (i) {
  // start only if utility is loaded
  if (typeof utility === 'undefined') {
    if (i > 100) {
      throw new Error('Cannot find utility');
    }
    i++;
    return setTimeout('Auth._init(' + i + ')', 10 * i);
  }

  utility.loadExternalFiles(
    Auth.prototype.config.sdkFullPath + '/assets/buttonSigninPryv.css', 'css');

  var urlInfo = utility.urls.parseClientURL();
  console.log('detected environment: ' + urlInfo.environment);
  if (urlInfo.environment === 'staging') {
    Auth.prototype.config.registerURL = Auth.prototype.config.registerStagingURL;
  }

  console.log('init done');
};


Auth._init(1);

//--------------------- UI Content -----------//


Auth.prototype.uiSupportedLanguages = ['en', 'fr'];

Auth.prototype.uiButton = function (onClick, buttonText) {
  if (utility.supportCSS3()) {
    return '<div id="pryv-access-btn" class="pryv-access-btn-signin" data-onclick-action="' +
      onClick + '">' +
      '<a class="pryv-access-btn pryv-access-btn-pryv-access-color" href="#">' +
      '<span class="logoSignin">Y</span></a>' +
      '<a class="pryv-access-btn pryv-access-btn-pryv-access-color"  href="#"><span>' +
      buttonText + '</span></a></div>';
  } else   {
    return '<a href="#" id ="pryv-access-btn" data-onclick-action="' + onClick +
      '" class="pryv-access-btn-signinImage" ' +
      'src="' + this.config.sdkFullPath + '/assets/btnSignIn.png" >' + buttonText + '</a>';
  }
};

Auth.prototype.uiErrorButton = function () {
  var strs = {
    'en': { 'msg': 'Error :(' },
    'fr': { 'msg': 'Erreur :('}
  }[this.settings.languageCode];
  this.onClick.Error = function () {
    this.logout();
    return false;
  }.bind(this);
  return this.uiButton('Error', strs.msg);
};

Auth.prototype.uiLoadingButton = function () {
  var strs = {
    'en': { 'msg': 'Loading...' },
    'fr': { 'msg': 'Chargement...'}
  }[this.settings.languageCode];
  this.onClick.Loading = function () {
    return false;
  };
  return this.uiButton('Loading', strs.msg);

};

Auth.prototype.uiSigninButton = function () {
  var strs = {
    'en': { 'msg': 'Sign in' },
    'fr': { 'msg': 'S\'identifier' }
  }[this.settings.languageCode];
  this.onClick.Signin = function () {
    this.popupLogin();
    return false;
  }.bind(this);
  return this.uiButton('Signin', strs.msg);

};

Auth.prototype.uiConfirmLogout = function () {
  var strs = {
    'en': { 'logout': 'Sign out?'},
    'fr': { 'logout': 'Se déconnecter?'}
  }[this.settings.languageCode];

  if (confirm(strs.logout)) {
    this.logout();
  }
};

Auth.prototype.uiInButton = function (username) {
  this.onClick.In = function () {
    this.uiConfirmLogout();
    return false;
  }.bind(this);
  return this.uiButton('In', username);
};

Auth.prototype.uiRefusedButton = function (message) {
  console.log('Pryv access [REFUSED]' + message);
  var strs = {
    'en': { 'msg': 'access refused'},
    'fr': { 'msg': 'Accès refusé'}
  }[this.settings.languageCode];
  this.onClick.Refused = function () {
    this.retry();
    return false;
  }.bind(this);
  return this.uiButton('Refused', strs.msg);

};

//--------------- end of UI ------------------//


Auth.prototype.updateButton = function (html) {
  this.buttonHTML = html;
  if (! this.settings.spanButtonID) { return; }

  utility.domReady(function () {
    if (! this.spanButton) {
      var element = document.getElementById(this.settings.spanButtonID);
      if (typeof(element) === 'undefined' || element === null) {
        throw new Error('access-SDK cannot find span ID: "' +
          this.settings.spanButtonID + '"');
      } else {
        this.spanButton = element;
      }
    }
    this.spanButton.innerHTML = this.buttonHTML;
    this.spanButton.onclick = function (e) {
      e.preventDefault();
      var element = document.getElementById('pryv-access-btn');
      console.log('onClick', this.spanButton,
        element.getAttribute('data-onclick-action'));
      this.onClick[element.getAttribute('data-onclick-action')]();
    }.bind(this);
  }.bind(this));
};

Auth.prototype.internalError = function (message, jsonData) {
  this.stateChanged({id: 'INTERNAL_ERROR', message: message, data: jsonData});
};

//STATE HUB
Auth.prototype.stateChanged  = function (data) {


  if (data.id) { // error
    if (this.settings.callbacks.error) {
      this.settings.callbacks.error(data.id, data.message);
    }
    this.updateButton(this.uiErrorButton());
    console.log('Error: ' + JSON.stringify(data));
    // this.logout();   Why should I retry if it failed already once?
  }

  if (data.status === this.state.status) {
    return;
  }
  if (data.status === 'LOADED') { // skip
    return;
  }
  if (data.status === 'POPUPINIT') { // skip
    return;
  }

  this.state = data;
  if (this.state.status === 'NEED_SIGNIN') {
    this.stateNeedSignin();
  }
  if (this.state.status === 'REFUSED') {
    this.stateRefused();
  }

  if (this.state.status === 'ACCEPTED') {
    this.stateAccepted();
  }

};

//STATE 0 Init
Auth.prototype.stateInitialization = function () {
  this.state = {status : 'initialization'};
  this.updateButton(this.uiLoadingButton());
  if (this.settings.callbacks.initialization) {
    this.settings.callbacks.initialization();
  }
};

//STATE 1 Need Signin
Auth.prototype.stateNeedSignin = function () {
  this.updateButton(this.uiSigninButton());
  if (this.settings.callbacks.needSignin) {
    this.settings.callbacks.needSignin(this.state.url, this.state.poll,
      this.state.poll_rate_ms);
  }
};


//STATE 2 User logged in and authorized
Auth.prototype.stateAccepted = function () {
  if (this.cookieEnabled) {
    utility.docCookies.setItem('access_username', this.state.username, 3600);
    utility.docCookies.setItem('access_token', this.state.token, 3600);
  }
  this.updateButton(this.uiInButton(this.state.username));

  this.connection.username = this.state.username;
  this.connection.auth = this.state.token;
  if (this.settings.callbacks.accepted) {
    this.settings.callbacks.accepted(this.state.username, this.state.token, this.state.lang);
  }
  if (this.settings.callbacks.signedIn) {
    this.settings.callbacks.signedIn(this.connection, this.state.lang);
  }
};

//STATE 3 User refused
Auth.prototype.stateRefused = function () {
  this.updateButton(this.uiRefusedButton(this.state.message));
  if (this.settings.callbacks.refused) {
    this.settings.callbacks.refused('refused:' + this.state.message);
  }
};


/**
 * clear all references
 */
Auth.prototype.logout = function () {
  this.ignoreStateFromURL = true;
  if (this.cookieEnabled) {
    utility.docCookies.removeItem('access_username');
    utility.docCookies.removeItem('access_token');
  }
  this.state = null;
  if (this.settings.callbacks.accepted) {
    this.settings.callbacks.accepted(false, false, false);
  }
  if (this.settings.callbacks.signedOut) {
    this.settings.callbacks.signedOut(this.connection);
  }
  this.connection = null;
  this.setup(this.settings);
};

/**
 * clear references and try again
 */
Auth.prototype.retry = Auth.prototype.logout;




/* jshint -W101 */
// TODO: the 4 methods below belong elsewhere (e.g. static methods of Connection); original author please check with @sgoumaz

/**
 * TODO: discuss whether signature should be `(settings, callback)`
 * @param settings
 */
Auth.prototype.login = function (settings) {
  // cookies
  this.cookieEnabled = (navigator.cookieEnabled) ? true : false;
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1) ? true : false;
  }

  var urlInfo = utility.urls.parseClientURL();
  var defaultDomain = utility.urls.domains.server[urlInfo.environment];
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  var pack = {
    ssl: settings.ssl,
    host: settings.username + '.' + settings.domain,
    path: '/auth/login',
    params: {
      appId : settings.appId,
      username : settings.username,
      password : settings.password
    },
    success: function (data)  {
      if (data.token) {
        if (this.cookieEnabled && settings.rememberMe) {
          utility.docCookies.setItem('access_username', settings.username, 3600);
          utility.docCookies.setItem('access_token', data.token, 3600);
          utility.docCookies.setItem('access_preferredLanguage', data.preferredLanguage, 3600);
        }
        console.log('set cookie', this.cookieEnabled, settings.rememberMe,
          utility.docCookies.getItem('access_username'),
          utility.docCookies.getItem('access_token'));
        this.connection.username = settings.username;
        this.connection.auth = data.token;
        if (typeof(this.settings.callbacks.signedIn)  === 'function') {
          this.settings.callbacks.signedIn(this.connection);
        }
      } else {
        if (typeof(this.settings.callbacks.error) === 'function') {
          this.settings.callbacks.error(data);
        }
      }
    }.bind(this),
    error: function (jsonError) {
      if (typeof(this.settings.callbacks.error) === 'function') {
        this.settings.callbacks.error(jsonError);
      }
    }.bind(this)
  };

  utility.request(pack);
};

// TODO: must be an instance member of Connection instead
Auth.prototype.trustedLogout = function () {
  var path = '/auth/logout';
  if (this.connection) {
    this.connection.request('POST', path, function (error) {
      if (error && typeof(this.settings.callbacks.error) === 'function') {
        return this.settings.callbacks.error(error);
      }
      if (!error && typeof(this.settings.callbacks.signedOut) === 'function') {
        return this.settings.callbacks.signedOut(this.connection);
      }
    }.bind(this));
  }
};

Auth.prototype.whoAmI = function (settings) {
  var urlInfo = utility.urls.parseClientURL();
  var defaultDomain = utility.urls.domains.server[urlInfo.environment];
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  var pack = {
    ssl: settings.ssl,
    host: settings.username + '.' + settings.domain,
    path :  '/auth/who-am-i',
    method: 'GET',
    success : function (data)  {
      if (data.token) {
        this.connection.username = data.username;
        this.connection.auth = data.token;
        var conn = new Connection(data.username, data.token, {
          ssl: settings.ssl,
          domain: settings.domain
        });
        console.log('before access info', this.connection);
        conn.accessInfo(function (error) {
          console.log('after access info', this.connection);
          if (!error) {
            if (typeof(this.settings.callbacks.signedIn)  === 'function') {
              this.settings.callbacks.signedIn(this.connection);
            }
          } else {
            if (typeof(this.settings.callbacks.error) === 'function') {
              this.settings.callbacks.error(error);
            }
          }
        }.bind(this));

      } else {
        if (typeof(this.settings.callbacks.error) === 'function') {
          this.settings.callbacks.error(data);
        }
      }
    }.bind(this),
    error : function (jsonError) {
      if (typeof(this.settings.callbacks.error) === 'function') {
        this.settings.callbacks.error(jsonError);
      }
    }.bind(this)
  };

  utility.request(pack);
};

Auth.prototype.loginWithCookie = function (settings) {
  var urlInfo = utility.urls.parseClientURL();
  var defaultDomain = utility.urls.domains.server[urlInfo.environment];
  this.settings = settings = _.defaults(settings, {
    ssl: true,
    domain: defaultDomain
  });

  this.connection = new Connection({
    ssl: settings.ssl,
    domain: settings.domain
  });

  this.cookieEnabled = (navigator.cookieEnabled) ? true : false;
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1) ? true : false;
  }
  var cookieUserName = this.cookieEnabled ? utility.docCookies.getItem('access_username') : false;
  var cookieToken = this.cookieEnabled ? utility.docCookies.getItem('access_token') : false;
  console.log('get cookie', cookieUserName, cookieToken);
  if (cookieUserName && cookieToken) {
    this.connection.username = cookieUserName;
    this.connection.auth = cookieToken;
    if (typeof(this.settings.callbacks.signedIn) === 'function') {
      this.settings.callbacks.signedIn(this.connection);
    }
    return this.connection;
  }
  return false;
};





/**
 *
 * @param settings
 * @returns {Connection} the connection managed by Auth.. A new one is created each time setup is
 * called.
 */
Auth.prototype.setup = function (settings) {
  this.state = null;

  //--- check the browser capabilities


  // cookies
  this.cookieEnabled = (navigator.cookieEnabled) ? true : false;
  if (typeof navigator.cookieEnabled === 'undefined' && !this.cookieEnabled) {  //if not IE4+ NS6+
    document.cookie = 'testcookie';
    this.cookieEnabled = (document.cookie.indexOf('testcookie') !== -1) ? true : false;
  }

  //TODO check settings..

  settings.languageCode =
    utility.getPreferredLanguage(this.uiSupportedLanguages, settings.languageCode);

  //-- returnURL
  settings.returnURL = settings.returnURL || 'auto#';
  if (settings.returnURL) {
    // check the trailer
    var trailer = settings.returnURL.charAt(settings.returnURL.length - 1);
    if ('#&?'.indexOf(trailer) < 0) {
      throw new Error('Pryv access: Last character of --returnURL setting-- is not ' +
        '"?", "&" or "#": ' + settings.returnURL);
    }

    // set self as return url?
    var returnself = (settings.returnURL.indexOf('self') === 0);
    if (settings.returnURL.indexOf('auto') === 0) {
      returnself = utility.browserIsMobileOrTablet();
      if (!returnself) { settings.returnURL = false; }
    }

    if (returnself) {
      var myParams = settings.returnURL.substring(4);
      // eventually clean-up current url from previous pryv returnURL
      settings.returnURL = this._cleanStatusFromURL() + myParams;
    }

    if (settings.returnURL) {
      if (settings.returnURL.indexOf('http') < 0) {
        throw new Error('Pryv access: --returnURL setting-- does not start with http: ' +
          settings.returnURL);
      }
    }
  }

  //  spanButtonID is checked only when possible
  this.settings = settings;

  var params = {
    requestingAppId : settings.requestingAppId,
    requestedPermissions : settings.requestedPermissions,
    languageCode : settings.languageCode,
    returnURL : settings.returnURL
  };

  if (this.config.localDevel) {
    // return url will be forced to https://l.pryv.in:4443/Auth.html
    params.localDevel = this.config.localDevel;
  }

  this.stateInitialization();
  // TODO: clean up this hard-coded mess and rely on the one and only Pryv URL domains reference
  var domain = (this.config.registerURL.host === 'reg.pryv.io') ? 'pryv.io' : 'pryv.in';

  this.connection = new Connection(null, null, {ssl: this.config.registerURL.ssl, domain: domain});
  // look if we have a returning user (document.cookie)
  var cookieUserName = this.cookieEnabled ? utility.docCookies.getItem('access_username') : false;
  var cookieToken = this.cookieEnabled ? utility.docCookies.getItem('access_token') : false;

  // look in the URL if we are returning from a login process
  var stateFromURL =  this._getStatusFromURL();

  if (stateFromURL && (! this.ignoreStateFromURL)) {
    this.stateChanged(stateFromURL);
  } else if (cookieToken && cookieUserName) {
    this.stateChanged({status: 'ACCEPTED', username: cookieUserName, token: cookieToken});
  } else { // launch process $

    var pack = {
      path :  '/access',
      params : params,
      success : function (data)  {
        if (data.status && data.status !== 'ERROR') {
          this.stateChanged(data);
        } else {
          // TODO call shouldn't failed
          this.internalError('/access Invalid data: ', data);
        }
      }.bind(this),
      error : function (jsonError) {
        this.internalError('/access ajax call failed: ', jsonError);
      }.bind(this)
    };

    utility.request(_.extend(pack, this.config.registerURL));


  }


  return this.connection;
};

//logout the user if

//read the polling
Auth.prototype.poll = function poll() {
  if (this.pollingIsOn && this.state.poll_rate_ms) {
    // remove eventually waiting poll..
    if (this.pollingID) { clearTimeout(this.pollingID); }


    var pack = {
      path :  '/access/' + this.state.key,
      method : 'GET',
      success : function (data)  {
        this.stateChanged(data);
      }.bind(this),
      error : function (jsonError) {
        this.internalError('poll failed: ', jsonError);
      }.bind(this)
    };

    utility.request(_.extend(pack, this.config.registerURL));


    this.pollingID = setTimeout(this.poll.bind(this), this.state.poll_rate_ms);
  } else {
    console.log('stopped polling: on=' + this.pollingIsOn + ' rate:' + this.state.poll_rate_ms);
  }
};


//messaging between browser window and window.opener
Auth.prototype.popupCallBack = function (event) {
  // Do not use 'this' here !
  if (this.settings.forcePolling) { return; }
  if (event.source !== this.window) {
    console.log('popupCallBack event.source does not match Auth.window');
    return false;
  }
  console.log('from popup >>> ' + JSON.stringify(event.data));
  this.pollingIsOn = false; // if we can receive messages we stop polling
  this.stateChanged(event.data);
};



Auth.prototype.popupLogin = function popupLogin() {
  if ((! this.state) || (! this.state.url)) {
    throw new Error('Pryv Sign-In Error: NO SETUP. Please call Auth.setup() first.');
  }

  if (this.settings.returnURL) {
    location.href = this.state.url;
    return;
  }

  // start polling
  setTimeout(this.poll(), 1000);

  var screenX = typeof window.screenX !== 'undefined' ? window.screenX : window.screenLeft,
    screenY = typeof window.screenY !== 'undefined' ? window.screenY : window.screenTop,
    outerWidth = typeof window.outerWidth !== 'undefined' ?
      window.outerWidth : document.body.clientWidth,
    outerHeight = typeof window.outerHeight !== 'undefined' ?
      window.outerHeight : (document.body.clientHeight - 22),
    width    = 270,
    height   = 420,
    left     = parseInt(screenX + ((outerWidth - width) / 2), 10),
    top      = parseInt(screenY + ((outerHeight - height) / 2.5), 10),
    features = (
      'width=' + width +
        ',height=' + height +
        ',left=' + left +
        ',top=' + top +
        ',scrollbars=yes'
      );


  window.addEventListener('message', this.popupCallBack.bind(this), false);

  this.window = window.open(this.state.url, 'prYv Sign-in', features);

  if (! this.window) {
    // TODO try to fall back on access
    console.log('FAILED_TO_OPEN_WINDOW');
  } else {
    if (window.focus) {
      this.window.focus();
    }
  }

  return false;
};




//util to grab parameters from url query string
Auth.prototype._getStatusFromURL = function () {
  var vars = {};
  window.location.href.replace(/[?#&]+prYv([^=&]+)=([^&]*)/gi,
    function (m, key, value) {
      vars[key] = value;
    });

  //TODO check validity of status

  return (vars.key) ? vars : false;
};

//util to grab parameters from url query string
Auth.prototype._cleanStatusFromURL = function () {
  return window.location.href.replace(/[?#&]+prYv([^=&]+)=([^&]*)/gi, '');
};

//-------------------- UTILS ---------------------//

module.exports = new Auth();

},{"../Connection.js":44,"../utility/utility.js":73,"underscore":43}],51:[function(require,module,exports){

module.exports = {};
},{}],52:[function(require,module,exports){
var utility = require('../utility/utility.js');

module.exports =  utility.isBrowser() ?
    require('./Auth-browser.js') : require('./Auth-node.js');

},{"../utility/utility.js":73,"./Auth-browser.js":50,"./Auth-node.js":51}],53:[function(require,module,exports){
var apiPathAccesses = '/accesses';
var _ = require('underscore');

/**
 * @class Accesses
 * @link http://api.pryv.com/reference.html#methods-accesses
 * @link http://api.pryv.com/reference.html#data-structure-access
 * @param {Connection} connection
 * @constructor
 */
function Accesses(connection) {
  this.connection = connection;
}
/**
 * @param {Connection~requestCallback} callback
 */
Accesses.prototype.get = function (callback) {
  this.connection.request('GET', apiPathAccesses, function (err, res) {
    var accesses = res.accesses || res.access;
    if (typeof(callback) === 'function') {
      callback(err, accesses);
    }
  });
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.create = function (access, callback) {
  this.connection.request('POST', apiPathAccesses, function (err, res) {
    var access = res.access;
    if (typeof(callback) === 'function') {
      callback(err, access);
    }
  }, access);
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.update = function (access, callback) {
  if (access.id) {
    this.connection.request('PUT', apiPathAccesses + '/' + access.id, callback,
      _.pick(access, 'name', 'deviceName', 'permissions'));
  } else {
    if (callback && _.isFunction(callback)) {
      return callback('No access id found');
    }

  }
};

/**
 * TODO complete documentation
 * @param access
 * @param callback
 */
Accesses.prototype.delete = function (sharingId, callback) {
  this.connection.request('DELETE', apiPathAccesses + '/' + sharingId, function (err, result) {
    var error = err;
    if (result && result.message) {
      error = result;
    }
    callback(error, result);
  });
};
module.exports = Accesses;
},{"underscore":43}],54:[function(require,module,exports){
var apiPathAccount = '/account';

function Account(connection) {
  this.connection = connection;
}

Account.prototype.changePassword = function (oldPassword, newPassword, callback) {
  this.connection.request('POST', apiPathAccount + '/change-password', function (err) {
    if (typeof(callback) === 'function') {
      callback(err);
    }
  }, {'oldPassword': oldPassword, 'newPassword': newPassword});
};
Account.prototype.getInfo = function (callback) {
  this.connection.request('GET', apiPathAccount, function (error, result) {
    if (typeof(callback) === 'function') {
      if (result && result.account) {
        result = result.account;
      }
      callback(error, result);
    }
  });
};

module.exports = Account;
},{}],55:[function(require,module,exports){
var apiPathBookmarks = '/followed-slices',
  Connection = require('../Connection.js'),
  _ = require('underscore');

/**
 * @class Bookmarks
 * @link http://api.pryv.com/reference.html#data-structure-subscriptions-aka-bookmarks
 * @param {Connection} connection
 * @constructor
 */
function Bookmarks(connection, Conn) {
  this.connection = connection;
  Connection = Conn;
}
/**
 * @param {Connection~requestCallback} callback
 */
Bookmarks.prototype.get = function (callback) {
  this.connection.request('GET', apiPathBookmarks, function (error, res) {
    var result = [],
      bookmarks = res.followedSlices || res.followedSlice;
    _.each(bookmarks, function (bookmark) {
      bookmark.url = bookmark.url.replace(/\.li/, '.in');
      bookmark.url = bookmark.url.replace(/\.me/, '.io');
      var conn =  new Connection({
        auth: bookmark.accessToken,
        url: bookmark.url,
        name: bookmark.name,
        bookmarkId: bookmark.id
      });
      result.push(conn);
    });
    callback(error, result);
  });
};

/**
 * TODO complete documentation
 * @param bookmark
 * @param callback
 * @returns {*}
 */
Bookmarks.prototype.create = function (bookmark, callback) {
  if (bookmark.name && bookmark.url && bookmark.accessToken) {
    this.connection.request('POST', apiPathBookmarks, function (err, result) {
      var error = err;
      if (!error) {
        var conn =  new Connection({
          auth: bookmark.accessToken,
          url: bookmark.url,
          name: bookmark.name,
          bookmarkId: result.followedSlice.id
        });
        bookmark = conn;
      }
      callback(error, bookmark);
    }, bookmark);
    return bookmark;
  }
};

/**
 * TODO complete documentation
 * @param bookmarkId
 * @param callback
 */
Bookmarks.prototype.delete = function (bookmarkId, callback) {
  this.connection.request('DELETE', apiPathBookmarks + '/' + bookmarkId, function (err, result) {
    var error = err;
    if (result && result.message) {
      error = result;
    }
    callback(error, result);
  });
};

module.exports = Bookmarks;
},{"../Connection.js":44,"underscore":43}],56:[function(require,module,exports){
exports.Errors = {
  API_UNREACHEABLE : 'API_UNREACHEABLE',
  INVALID_RESULT_CODE : 'INVALID_RESULT_CODE'
};

exports.Api = {
  Headers : {
    ServerTime : 'server-time',
    ApiVersion : 'api-version'
  }
};
},{}],57:[function(require,module,exports){
var utility = require('../utility/utility.js'),
  _ = require('underscore'),
  Filter = require('../Filter'),
  Event = require('../Event'),
  CC = require('./ConnectionConstants.js');

/**
 * @class ConnectionEvents
 *
 * Coverage of the API
 *  GET /events -- 100%
 *  POST /events -- only data (no object)
 *  POST /events/start -- 0%
 *  POST /events/stop -- 0%
 *  PUT /events/{event-id} -- 100%
 *  DELETE /events/{event-id} -- only data (no object)
 *  POST /events/batch -- only data (no object)
 *
 *  attached files manipulations are covered by Event
 *
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionEvents(connection) {
  this.connection = connection;
}


/**
 * @example
 * // get events from the Diary stream
 * conn.events.get({streamId : 'diary'},
 *  function(events) {
 *    console.log('got ' + events.length + ' events)
 *  }
 * );
 * @param {FilterLike} filter
 * @param {ConnectionEvents~getCallback} doneCallback
 * @param {ConnectionEvents~partialResultCallback} partialResultCallback
 */
ConnectionEvents.prototype.get = function (filter, doneCallback, partialResultCallback) {
  //TODO handle caching
  var result = [];
  filter = filter || {};
  this._get(filter, function (error, res) {
    if (error) {
      result = null;
    } else {
      var eventList = res.events || res.event;
      _.each(eventList, function (eventData) {

        var event = null;
        if (!this.connection.datastore) { // no datastore   break
          event = new Event(this.connection, eventData);
        } else {
          event = this.connection.datastore.createOrReuseEvent(eventData);
        }

        result.push(event);

      }.bind(this));
    }
    doneCallback(error, result);

    if (partialResultCallback) { partialResultCallback(result); }
  }.bind(this));

};

/**
 * @param {Event} event
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.update = function (event, callback) {
  this._updateWithIdAndData(event.id, event.getData(), callback);
};

/**
 * @param {Event | eventId} event
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.delete = ConnectionEvents.prototype.trash = function (event, callback) {
  this.trashWithId(event.id, callback);
};

/**
 * @param {String} eventId
 * @param {Connection~requestCallback} callback
 */
ConnectionEvents.prototype.trashWithId = function (eventId, callback) {
  var url = '/events/' + eventId;
  this.connection.request('DELETE', url, function (error, result) {
    // assume there is only one event (no batch for now)
    if (result && result.event) {
      if (! this.connection.datastore) { // no datastore   break
        result = new Event(this.connection, result.event);
      } else {
        result = this.connection.datastore.createOrReuseEvent(result.event);
      }
    }  else {
      result = null;
    }
    if (callback && typeof(callback) === 'function') {
      callback(error, result);
    }
  }.bind(this), null);
};

/**
 * This is the preferred method to create an event, or to create it on the API.
 * The function return the newly created object.. It will be updated when posted on the API.
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {Boolean} [start = false] if set to true will POST the event to /events/start
 * @return {Event} event
 */
ConnectionEvents.prototype.create = function (newEventlike, callback) {
  _create.call(this, newEventlike, callback, false);
};


/**
 * This is the preferred method to create and start an event, Starts a new period event.
 * This is equivalent to starting an event with a null duration. In singleActivity streams,
 * also stops the previously running period event if any.
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.start = function (newEventlike, callback) {
  _create.call(this, newEventlike, callback, true);
};


// common call for create and start
function _create(newEventlike, callback, start) {
  var event = null;
  if (newEventlike instanceof Event) {
    if (newEventlike.connection !== this.connection) {
      return callback(new Error('event.connection does not match current connection'));
    }
    if (newEventlike.id) {
      return callback(new Error('cannot create an event already existing on the API'));
    }
    event = newEventlike;
  } else {
    event = new Event(this.connection, newEventlike);
  }

  var url = '/events';
  if (start) { url = '/events/start'; }


  this.connection.request('POST', url, function (err, result, resultInfo) {
    if (! err && resultInfo.code !== 201) {
      err = {id : CC.Errors.INVALID_RESULT_CODE};
    }
    /**
     * Change will happend with offline caching...
     *
     * An error may hapend 400.. or other if app is behind an non-opened gateway. Thus making
     * difficult to detect if the error is a real bad request.
     * The first step would be to consider only bad request if the response can be identified
     * as coming from a valid api-server. If not, we should cache the event for later synch
     * then remove the error and send the cached version of the event.
     *
     */
    // TODO if err === API_UNREACHABLE then save event in cache
    if (result && ! err) {
      _.extend(event, result.event);
      if (this.connection.datastore) {  // if datastore is activated register new event
        this.connection.datastore.addEvent(event);
      }
    }
    if (_.isFunction(callback)) {

      callback(err, err ? null : event);
    }
  }.bind(this), event.getData());
  return event;
}




/**
 * Stop an event by it's Id
 * @param {EventLike} event -- minimum {id} -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {Date} [date = now] the date to set to stop the event
 * @param {ConnectionEvents~eventStoppedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.stopEvent = function (eventlike, date, callback) {
  var url = '/events/stop';

  var data = {id : eventlike.id };
  if (date) { data.time = date.getTime() / 1000; }


  this.connection.request('POST', url, function (err, result, resultInfo) {
    if (! err && resultInfo.code !== 200) {
      err = {id : CC.Errors.INVALID_RESULT_CODE};
    }


    // TODO if err === API_UNREACHABLE then save event in cache
    /*
    if (result && ! err) {
      if (this.connection.datastore) {  // if datastore is activated register new event

      }
    } */
    if (_.isFunction(callback)) {
      callback(err, err ? null : result.stoppedId);
    }
  }.bind(this), data);
};



/**
 * Stop any event in this stream
 * @param {StreamLike} stream -- minimum {id} -- if typeof Stream, must belong to
 * the same connection and not exists on the API.
 * @param {Date} [date = now] the date to set to stop the event
 * @param {String} [type = null] stop any matching eventType is this stream.
 * @param {ConnectionEvents~eventStoppedOnTheAPI} callback
 * @return {Event} event
 */
ConnectionEvents.prototype.stopStream = function (streamLike, date, type, callback) {
  var url = '/events/stop';

  var data = {streamId : streamLike.id };
  if (date) { data.time = date.getTime() / 1000; }
  if (type) { data.type = type; }


  this.connection.request('POST', url, function (err, result, resultInfo) {
    if (! err && resultInfo.code !== 200) {
      err = {id : CC.Errors.INVALID_RESULT_CODE};
    }

    // TODO if err === API_UNREACHABLE then cache the stop instruction for later synch

    if (_.isFunction(callback)) {
      callback(err, err ? null : result.stoppedId);
    }
  }.bind(this), data);
};


/**
 * @param {NewEventLike} event -- minimum {streamId, type } -- if typeof Event, must belong to
 * the same connection and not exists on the API.
 * @param {ConnectionEvents~eventCreatedOnTheAPI} callback
 * @param {FormData} the formData to post for fileUpload. On node.js
 * refers to pryv.utility.forgeFormData
 * @return {Event} event
 */
ConnectionEvents.prototype.createWithAttachment =
  function (newEventLike, formData, callback, progressCallback) {
    var event = null;
    if (newEventLike instanceof Event) {
      if (newEventLike.connection !== this.connection) {
        return callback(new Error('event.connection does not match current connection'));
      }
      if (newEventLike.id) {
        return callback(new Error('cannot create an event already existing on the API'));
      }
      event = newEventLike;
    } else {
      event = new Event(this.connection, newEventLike);
    }
    formData.append('event', JSON.stringify(event.getData()));
    var url = '/events';
    this.connection.request('POST', url, function (err, result) {
      if (result) {
        _.extend(event, result.event);

        if (this.connection.datastore) {  // if datastore is activated register new event
          this.connection.datastore.addEvent(event);
        }

      }
      callback(err, event);
    }.bind(this), formData, true, progressCallback);
  };
ConnectionEvents.prototype.addAttachment = function (eventId, file, callback, progressCallback) {
  var url = '/events/' + eventId;
  this.connection.request('POST', url, callback, file, true, progressCallback);
};
ConnectionEvents.prototype.removeAttachment = function (eventId, fileName, callback) {
  var url = '/events/' + eventId + '/' + fileName;
  this.connection.request('DELETE', url, callback);
};
/**
 * //TODO rename to batch
 * //TODO make it NewEventLike compatible
 * //TODO once it support an array of mixed values Event and EventLike, the, no need for
 *  callBackWithEventsBeforeRequest at it will. A dev who want Event object just have to create
 *  them before
 * This is the prefered method to create events in batch
 * @param {Object[]} eventsData -- minimum {streamId, type }
 * @param {ConnectionEvents~eventBatchCreatedOnTheAPI}
 * @param {function} [callBackWithEventsBeforeRequest] mostly for testing purposes
 * @return {Event[]} events
 */
ConnectionEvents.prototype.batchWithData =
  function (eventsData, callback, callBackWithEventsBeforeRequest) {
    if (!_.isArray(eventsData)) { eventsData = [eventsData]; }

    var createdEvents = [];
    var eventMap = {};

    var url = '/';
    // use the serialId as a temporary Id for the batch
    _.each(eventsData, function (eventData, i) {

      var event =  new Event(this.connection, eventData);

      createdEvents.push(event);
      eventMap[i] = event;
    }.bind(this));

    if (callBackWithEventsBeforeRequest) {
      callBackWithEventsBeforeRequest(createdEvents);
    }

    var mapBeforePush = function (evs) {
      return _.map(evs, function (e) {
        return {
          method: 'events.create',
          params: e
        };
      });
    };

    this.connection.request('POST', url, function (err, result) {
      if (!err && result) {
        _.each(result.results, function (eventData, i) {
          _.extend(eventMap[i], eventData.event); // add the data to the event

          if (this.connection.datastore) {  // if datastore is activated register new event
            this.connection.datastore.addEvent(eventMap[i]);
          }


        }.bind(this));
      }
      callback(err, createdEvents);
    }.bind(this), mapBeforePush(eventsData));

    return createdEvents;
  };

// --- raw access to the API

/**
 * TODO anonymise by renaming to function _get(..
 * @param {FilterLike} filter
 * @param {Connection~requestCallback} callback
 * @private
 */
ConnectionEvents.prototype._get = function (filter, callback) {
  var tParams = filter;
  if (filter instanceof Filter) { tParams = filter.getData(true); }
  if (_.has(tParams, 'streams') && tParams.streams.length === 0) { // dead end filter..
    return callback(null, []);
  }
  var url = '/events?' + utility.getQueryParametersString(tParams);
  this.connection.request('GET', url, callback, null);
};


/**
 * TODO anonymise by renaming to function _xx(..
 * @param {String} eventId
 * @param {Object} data
 * @param  {Connection~requestCallback} callback
 * @private
 */
ConnectionEvents.prototype._updateWithIdAndData = function (eventId, data, callback) {
  var url = '/events/' + eventId;
  this.connection.request('PUT', url, function (error, result) {
    if (!error && result && result.event) {
      if (!this.connection.datastore) {
        result = new Event(this.connection, result.event);
      } else {
        result = this.connection.datastore.createOrReuseEvent(result.event);
      }
    } else {
      result = null;
    }
    if (callback && typeof(callback) === 'function') {
      callback(error, result);
    }
  }.bind(this), data);
};


/**
 * @private
 * @param {Event} event
 * @param {Object} the data to map
 */
ConnectionEvents.prototype._registerNewEvent = function (event, data) {


  if (! event.connection.datastore) { // no datastore   break
    _.extend(event, data);
    return event;
  }

  return event.connection.datastore.createOrReuseEvent(this, data);
};

module.exports = ConnectionEvents;

/**
 * Called with the desired Events as result.
 * @callback ConnectionEvents~getCallback
 * @param {Object} error - eventual error
 * @param {Event[]} result
 */


/**
 * Called each time a "part" of the result is received
 * @callback ConnectionEvents~partialResultCallback
 * @param {Event[]} result
 */


/**
 * Called when an event is created on the API
 * @callback ConnectionEvents~eventCreatedOnTheAPI
 * @param {Object} error - eventual error
 * @param {Event} event
 */

/**
 * Called when an event is created on the API
 * @callback ConnectionEvents~eventStoppedOnTheAPI
 * @param {Object} error - eventual error
 * @param {String} stoppedEventId or null if event not found
 */

/**
 * Called when batch create an array of events on the API
 * @callback ConnectionEvents~eventBatchCreatedOnTheAPI
 * @param {Object} error - eventual error
 * @param {Event[]} events
 */

},{"../Event":46,"../Filter":47,"../utility/utility.js":73,"./ConnectionConstants.js":56,"underscore":43}],58:[function(require,module,exports){
var _ = require('underscore'),
    utility = require('../utility/utility'),
    Monitor = require('../Monitor');

/**
 * @class ConnectionMonitors
 * @private
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionMonitors(connection) {
  this.connection = connection;
  this._monitors = {};
  this.ioSocket = null;
}

/**
 * Start monitoring this Connection. Any change that occurs on the connection (add, delete, change)
 * will trigger an event. Changes to the filter will also trigger events if they have an impact on
 * the monitored data.
 * @param {Filter} filter - changes to this filter will be monitored.
 * @returns {Monitor}
 */
ConnectionMonitors.prototype.create = function (filter) {
  if (!this.connection.username) {
    console.error('Cannot create a monitor for a connection without username:', this.connection);
    return null;
  }
  return new Monitor(this.connection, filter);
};



/**
 * TODO
 * @private
 */
ConnectionMonitors.prototype._stopMonitoring = function (/*callback*/) {

};

/**
 * Internal for Connection.Monitor
 * Maybe moved in Monitor by the way
 * @param callback
 * @private
 * @return {Object} XHR or Node http request
 */
ConnectionMonitors.prototype._startMonitoring = function (callback) {
  if (!this.connection.username) {
    console.error('Cannot start monitoring for a connection without username:', this.connection);
    return callback(true);
  }
  if (this.ioSocket) { return callback(null/*, ioSocket*/); }

  var settings = {
    host : this.connection.username + '.' + this.connection.settings.domain,
    port : this.connection.settings.port,
    ssl : this.connection.settings.ssl,
    path : this.connection.settings.extraPath + '/' + this.connection.username,
    namespace : '/' + this.connection.username,
    auth : this.connection.auth
  };

  this.ioSocket = utility.ioConnect(settings);

  this.ioSocket.on('connect', function () {
    _.each(this._monitors, function (monitor) { monitor._onIoConnect(); });
  }.bind(this));
  this.ioSocket.on('error', function (error) {
    _.each(this._monitors, function (monitor) { monitor._onIoError(error); });
  }.bind(this));
  this.ioSocket.on('eventsChanged', function () {
    _.each(this._monitors, function (monitor) { monitor._onIoEventsChanged(); });
  }.bind(this));
  this.ioSocket.on('streamsChanged', function () {
    _.each(this._monitors, function (monitor) { monitor._onIoStreamsChanged(); });
  }.bind(this));
  callback(null);
};

module.exports = ConnectionMonitors;



},{"../Monitor":48,"../utility/utility":73,"underscore":43}],59:[function(require,module,exports){
var apiPathPrivateProfile = '/profile/private';
var apiPathPublicProfile = '/profile/app';


/**
 * @class Profile
 * @link http://api.pryv.com/reference.html#methods-app-profile
 */

/**
 * Accessible by connection.profile.xxx`
 * @param {Connection} connection
 * @constructor
 */
function Profile(connection) {
  this.connection = connection;
  this.timeLimits = null;
}




/**
 * @param {String | null} key
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.getPrivate = function (key, callback) {
  this._get(apiPathPrivateProfile, key, callback);
};
/**
 * @param {String | null} key
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.getPublic = function (key, callback) {
  this._get(apiPathPublicProfile, key, callback);
};


/**
 * @example
 * // set x=25 and delete y
 * conn.profile.setPrivate({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValuePairs
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.setPrivate = function (keyValuePairs, callback) {
  this._set(apiPathPrivateProfile, keyValuePairs, callback);
};
/**
 * @example
 * // set x=25 and delete y
 * conn.profile.setPublic({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValuePairs
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype.setPublic = function (keyValuePairs, callback) {
  this._set(apiPathPublicProfile, keyValuePairs, callback);
};

/**
 * TODO write documentation
 */
Profile.prototype.getTimeLimits = function (force, callback) {
  if (!force && this.timeLimits) {
    if (callback && typeof(callback) === 'function') {
      callback(this.timeLimits);
    }
  } else {
    var i = 2;
    this.timeLimits = {
      timeFrameST : [],
      timeFrameLT : []
    };
    this.connection.events.get({
      toTime: 9900000000,
      fromTime: 0,
      limit: 1,
      sortAscending: false,
      state: 'all'
    }, function (error, events) {
      if (!error && events) {
        this.timeLimits.timeFrameST[1] = events[0].time;
        this.timeLimits.timeFrameLT[1] = events[0].timeLT;
      }
      i--;
      if (i === 0) {
        if (callback && typeof(callback) === 'function') {
          callback(this.timeLimits);
        }
      }
    }.bind(this));
    this.connection.events.get({
      toTime: 9900000000, // TODO add a constant UNDEFINED_TO_TIME in constant
      fromTime: -9900000000, // TODO add a constant UNDEFINED_FROM_TIME in constant
      limit: 1,
      sortAscending: true,
      state: 'all'
    }, function (error, events) {
      if (!error && events) {
        this.timeLimits.timeFrameST[0] = events[0].time;
        this.timeLimits.timeFrameLT[0] = events[0].timeLT;
      }
      i--;
      if (i === 0) {
        if (callback && typeof(callback) === 'function') {
          callback(this.timeLimits);
        }
      }
    }.bind(this));
  }
};


// --------- private stuff to be hidden

/**
 * @private
 * @param {String | null} key
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype._get = function (path, key, callback) {

  function myCallBack(error, result) {
    console.warn(result);
    result = result.profile || null;
    if (key !== null && result) {
      result = result[key];
    }
    callback(error, result);
  }
  this.connection.request('GET', path, myCallBack);
};

/**
 * @private
 * @example
 * // set x=25 and delete y
 * conn.profile.set({x : 25, y : null}, function(error) { console.log('done'); });
 *
 * @param {Object} keyValuePairs
 * @param {Connection~requestCallback} callback - handles the response
 */
Profile.prototype._set = function (path, keyValuePairs, callback) {
  this.connection.request('PUT', path, callback, keyValuePairs);
};

module.exports = Profile;
},{}],60:[function(require,module,exports){
var _ = require('underscore'),
  utility = require('../utility/utility.js'),
  Stream = require('../Stream.js');

/**
 * @class ConnectionStreams
 * @description
 * ##Coverage of the API
 *
 *  * GET /streams -- 100%
 *  * POST /streams -- only data (no object)
 *  * PUT /streams -- 0%
 *  * DELETE /streams/{stream-id} -- 0%
 *
 *
 *
 * @param {Connection} connection
 * @constructor
 */
function ConnectionStreams(connection) {
  this.connection = connection;
  this._streamsIndex = {};
}


/**
 * @typedef ConnectionStreamsOptions parameters than can be passed along a Stream request
 * @property {string} parentId  if parentId is null you will get all the "root" streams.
 * @property {string} [state] 'all' || null  - if null you get only "active" streams
 **/


/**
 * @param {ConnectionStreamsOptions} options
 * @param {ConnectionStreams~getCallback} callback - handles the response
 */
ConnectionStreams.prototype.get = function (options, callback) {
  if (this.connection.datastore) {
    var resultTree = [];
    if (options && _.has(options, 'parentId')) {
      resultTree = this.connection.datastore.getStreamById(options.parentId).children;
    } else {
      resultTree = this.connection.datastore.getStreams();
    }
    if (resultTree.length > 0) {
      callback(null, resultTree);
    } else {
      this._getObjects(options, callback);
    }
  } else {
    this._getObjects(options, callback);
  }
};

/**
 * TODO make it object-aware like for Events
 * TODO why to we need a _create ?
 * TODO could return Stream object synchronously before calling the API
 * @param streamData
 * @param callback
 */
ConnectionStreams.prototype.create = function (streamData, callback) {
  streamData = _.pick(streamData, 'id', 'name', 'parentId', 'singleActivity',
    'clientData', 'trashed');
  return this._createWithData(streamData, callback);
};


ConnectionStreams.prototype.update = function (streamData, callback) {

  if (typeof streamData === 'object') {
    streamData = [ streamData ];
  }

  _.each(streamData, function (e) {
    var s = _.pick(e, 'id', 'name', 'parentId', 'singleActivity',
      'clientData', 'trashed');
    var url = '/streams/' + s.id;
    this.connection.request('PUT', url, function (error, result) {
      if (!error && result && result.stream) {

        this._getObjects(null, function (err, res) {
          if (!err && res) {
            if (!this.connection.datastore) {
              result = new Stream(this.connection, result.stream);
            } else {
              result = this.connection.datastore.createOrReuseStream(result.stream);
              if (result.parent &&
                _.indexOf(result.parent.childrenIds, result.id) === -1) {
                result.parent.childrenIds.push(result.id);
              }
            }
          } else {
            result = null;
          }

          if (callback && typeof(callback) === 'function') {
            callback(err, result);
          }
        }.bind(this));

      } else {
        result = null;
      }
      if (error && callback && typeof(callback) === 'function') {
        callback(error, null);
      }
    }.bind(this), s);
  }.bind(this));
};


/**
 * @param streamData
 * @param callback
 * @param mergeEventsWithParent
 */
ConnectionStreams.prototype.delete = ConnectionStreams.prototype.trash =
    function (streamData, callback, mergeEventsWithParent) {
  var id;
  if (streamData && streamData.id) {
    id = streamData.id;
  } else {
    id = streamData;
  }

  mergeEventsWithParent = mergeEventsWithParent ? true : false;
  var url = '/streams/' + id + '?mergeEventsWithParent=' + mergeEventsWithParent;
  this.connection.request('DELETE', url, function (error, resultData) {
    var stream = null;
    if (!error && resultData && resultData.stream) {
      streamData.id = resultData.stream.id;
      stream = new Stream(this.connection, resultData.stream);
      if (this.connection.datastore) {
        this.connection.datastore.indexStream(stream);
      }
    }
    if (_.isFunction(callback)) {
      return callback(error, error ? null : resultData.stream);
    }
  }.bind(this));
};


/**
 * TODO remove it's unused
 * @param {ConnectionStreamsOptions} options
 * @param {ConnectionStreams~getCallback} callback - handles the response
 */
ConnectionStreams.prototype.updateProperties = function (stream, properties, options, callback) {
  if (this.connection.datastore) {
    var resultTree = [];
    if (options && _.has(options, 'parentId')) {
      resultTree = this.connection.datastore.getStreamById(options.parentId).children;
    } else {
      resultTree = this.connection.datastore.getStreams();
    }
    callback(null, resultTree);
  } else {
    this._getObjects(options, callback);
  }
};


/**
 * TODO remove it's unused and could lead to miscomprehension
 * Get a Stream by it's Id.
 * Works only if fetchStructure has been done once.
 * @param {string} streamId
 * @throws {Error} Connection.fetchStructure must have been called before.
 */
ConnectionStreams.prototype.getById = function (streamId) {
  if (!this.connection.datastore) {
    throw new Error('Call connection.fetchStructure before, to get automatic stream mapping');
  }
  return this.connection.datastore.getStreamById(streamId);
};


// ------------- Raw calls to the API ----------- //

/**
 * get streams on the API
 * @private
 * @param {ConnectionStreams~options} opts
 * @param callback
 */
ConnectionStreams.prototype._getData = function (opts, callback) {
  var url = opts ? '/streams?' + utility.getQueryParametersString(opts) : '/streams';
  this.connection.request('GET', url, callback, null);
};


/**
 * TODO makes it return the Stream object before doing the online request
 * TODO create a streamLike Object
 * Create a stream on the API with a jsonObject
 * @private
 * @param {Object} streamData an object array.. typically one that can be obtained with
 * stream.getData()
 * @param callback
 */
ConnectionStreams.prototype._createWithData = function (streamData, callback) {
  var url = '/streams';
  this.connection.request('POST', url, function (err, resultData) {
    var stream = null;
    if (!err && resultData) {
      streamData.id = resultData.stream.id;
      stream = new Stream(this.connection, resultData.stream);
      if (this.connection.datastore) {
        this.connection.datastore.indexStream(stream);
      }
    }
    if (_.isFunction(callback)) {
      return callback(err, err ? null : stream);
    }
  }.bind(this), streamData);
};

/**
 * Update a stream on the API with a jsonObject
 * @private
 * @param {Object} streamData an object array.. typically one that can be obtained with
 * stream.getData()
 * @param callback
 */
ConnectionStreams.prototype._updateWithData = function (streamData, callback) {
  var url = '/streams/' + streamData.id;
  this.connection.request('PUT', url, callback, streamData);
};

// -- helper for get --- //

/**
 * @private
 * @param {ConnectionStreams~options} options
 */
ConnectionStreams.prototype._getObjects = function (options, callback) {
  options = options || {};
  options.parentId = options.parentId || null;
  var streamsIndex = {};
  var resultTree = [];
  this._getData(options, function (error, result) {
    if (error) {
      return callback('Stream.get failed: ' + JSON.stringify(error));
    }
    var treeData = result.streams || result.stream;
    ConnectionStreams.Utils.walkDataTree(treeData, function (streamData) {
      var stream = new Stream(this.connection, streamData);
      streamsIndex[streamData.id] = stream;
      if (stream.parentId === options.parentId) { // attached to the rootNode or filter
        resultTree.push(stream);
        stream._parent = null;
        stream._children = [];
      } else {
        // localStorage will cleanup  parent / children link if needed
        stream._parent = streamsIndex[stream.parentId];
        stream._parent._children.push(stream);
      }
    }.bind(this));
    callback(null, resultTree);
  }.bind(this));
};


/**
 * Called once per streams
 * @callback ConnectionStreams~walkTreeEachStreams
 * @param {Stream} stream
 */

/**
 * Called when walk is done
 * @callback ConnectionStreams~walkTreeDone
 */

/**
 * Walk the tree structure.. parents are always announced before childrens
 * @param {ConnectionStreams~options} options
 * @param {ConnectionStreams~walkTreeEachStreams} eachStream
 * @param {ConnectionStreams~walkTreeDone} done
 */
ConnectionStreams.prototype.walkTree = function (options, eachStream, done) {
  this.get(options, function (error, result) {
    if (error) {
      return done('Stream.walkTree failed: ' + error);
    }
    ConnectionStreams.Utils.walkObjectTree(result, eachStream);
    if (done) {
      done(null);
    }
  });
};


/**
 * Get the all the streams of the Tree in a list.. parents firsts
 * @param {ConnectionStreams~options} options
 * @param {ConnectionStreams~getFlatenedObjectsDone} done
 */
ConnectionStreams.prototype.getFlatenedObjects = function (options, callback) {
  var result = [];
  this.walkTree(options,
    function (stream) { // each stream
      result.push(stream);
    }, function (error) {  // done
      if (error) {
        return callback(error);
      }
      callback(null, result);
    }.bind(this));
};


/**
 * Utility to debug a tree structure
 * @param {ConnectionStreams[]} arrayOfStreams
 */
ConnectionStreams.prototype.getDisplayTree = function (arrayOfStreams) {
  return ConnectionStreams.Utils._debugTree(arrayOfStreams);
};

/**
 * Utility to get a Stream Tree as if was sent by the API
 * @param {ConnectionStreams[]} arrayOfStreams
 */
ConnectionStreams.prototype.toJSON = function (arrayOfStreams) {
  return ConnectionStreams.Utils.toJSON(arrayOfStreams);
};


// TODO Validate that it's the good place for them .. Could have been in Stream or utility
ConnectionStreams.Utils = {

  /**
   * Make a pure JSON object from an array of Stream.. shoudl be the same than what we
   * get from the API
   * @param streamArray
   * @param eachStream
   */
  toJSON: function (arrayOfStreams) {

    var result = [];
    if (!arrayOfStreams || !arrayOfStreams instanceof Array) {
      throw new Error('expected an array for argument :' + arrayOfStreams);
    }

    _.each(arrayOfStreams, function (stream) {
      if (!stream || !stream instanceof Stream) {
        throw new Error('expected a Streams array ' + stream);
      }
      result.push({
        name: stream.name,
        id: stream.id,
        parentId: stream.parentId,
        singleActivity: stream.singleActivity,
        clientData: stream.clientData,
        trashed: stream.trashed,
        created: stream.created,
        createdBy: stream.createdBy,
        modified: stream.modified,
        modifiedBy: stream.modifiedBy,
        children: ConnectionStreams.Utils.toJSON(stream.children)
      });
    });
    return result;
  },

  /**
   * Walk thru a streamArray of objects
   * @param streamTree
   * @param callback function(stream)
   */
  walkObjectTree: function (streamArray, eachStream) {
    _.each(streamArray, function (stream) {
      eachStream(stream);
      ConnectionStreams.Utils.walkObjectTree(stream.children, eachStream);
    });
  },

  /**
   * Walk thru a streamTree obtained from the API. Replaces the children[] by childrenIds[].
   * This is used to Flaten the Tree
   * @param streamTree
   * @param callback function(streamData, subTree)  subTree is the descendance tree
   */
  walkDataTree: function (streamTree, callback) {
    _.each(streamTree, function (streamStruct) {
      var stream = _.omit(streamStruct, 'children');
      stream.childrenIds = [];
      var subTree = {};
      callback(stream, subTree);
      if (_.has(streamStruct, 'children')) {
        subTree = streamStruct.children;

        _.each(streamStruct.children, function (childTree) {
          stream.childrenIds.push(childTree.id);
        });
        this.walkDataTree(streamStruct.children, callback);
      }
    }.bind(this));
  },


  /**
   * ShowTree
   */
  _debugTree: function (arrayOfStreams) {
    var result = [];
    if (!arrayOfStreams || !arrayOfStreams instanceof Array) {
      throw new Error('expected an array for argument :' + arrayOfStreams);
    }
    _.each(arrayOfStreams, function (stream) {
      if (!stream || !stream instanceof Stream) {
        throw new Error('expected a Streams array ' + stream);
      }
      result.push({
        name: stream.name,
        id: stream.id,
        parentId: stream.parentId,
        children: ConnectionStreams.Utils._debugTree(stream.children)
      });
    });
    return result;
  }

};

module.exports = ConnectionStreams;

/**
 * Called with the desired streams as result.
 * @callback ConnectionStreams~getCallback
 * @param {Object} error - eventual error
 * @param {Stream[]} result
 */


},{"../Stream.js":49,"../utility/utility.js":73,"underscore":43}],61:[function(require,module,exports){
module.exports={
  "version": "0.2.9",
  "sets": {
    "basic-measurements-metric": {
      "name": {
        "en": "Metric measures (basics)",
        "fr": "Mesures métriques de base"
      },
      "description": {
        "en": "Kg, m, Km, ... "
      },
      "types": {
        "count": [
          "generic"
        ],
        "length": [
          "cm",
          "km",
          "m",
          "mm"
        ],
        "mass": [
          "kg",
          "g",
          "t"
        ],
        "temperature": [
          "c"
        ],
        "ratio": [
          "percent"
        ],
        "speed": [
          "km-h",
          "m-s"
        ],
        "volume": [
          "l",
          "m3",
          "ml"
        ]
      }
    },
    "generic-measurements-metric": {
      "name": {
        "en": "Metric measures",
        "fr": "Mesures métriques"
      },
      "description": {
        "en": "Kg, m, Km, ... "
      },
      "types": {
        "area": [
          "ha",
          "km2",
          "m2"
        ],
        "electric-current": [
          "a"
        ],
        "electromotive-force": [
          "v"
        ],
        "energy": [
          "cal",
          "j",
          "kcal"
        ],
        "frequency": [
          "hz",
          "bpm",
          "rpm"
        ],
        "length": [
          "cm",
          "km",
          "m",
          "mm"
        ],
        "mass": [
          "kg",
          "g",
          "t"
        ],
        "power": [
          "hp",
          "kw",
          "w"
        ],
        "pressure": [
          "bar",
          "kg-m2",
          "pa",
          "kpa"
        ],
        "temperature": [
          "c"
        ],
        "speed": [
          "km-h",
          "m-s"
        ],
        "volume": [
          "l",
          "m3",
          "ml"
        ]
      }
    },
    "basic-measurements-imperial": {
      "name": {
        "en": "Imperial measures (basics)",
        "fr": "Mesures, système impérial (de base)"
      },
      "description": {
        "en": "lb, in, ft, ..."
      },
      "types": {
        "count": [
          "generic"
        ],
        "length": [
          "ch",
          "lea",
          "ft",
          "in",
          "mi",
          "fur",
          "yd"
        ],
        "mass": [
          "lb",
          "oz",
          "s-t",
          "st"
        ],
        "temperature": [
          "f"
        ],
        "ratio": [
          "percent"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "galgb",
          "pt",
          "qt",
          "tbs",
          "tsp"
        ]
      }
    },
    "generic-measurements-imperial": {
      "name": {
        "en": "Imperial measures",
        "fr": "Mesures, système impérial"
      },
      "description": {
        "en": "lb, in, ft, ..."
      },
      "types": {
        "area": [
          "ac",
          "ft2",
          "in2",
          "yd2",
          "mi2"
        ],
        "electric-current": [
          "a"
        ],
        "electromotive-force": [
          "v"
        ],
        "energy": [
          "btu",
          "erg",
          "ftlb",
          "kcal"
        ],
        "force": [
          "pdl"
        ],
        "length": [
          "ch",
          "lea",
          "ft",
          "in",
          "mi",
          "fur",
          "yd"
        ],
        "mass": [
          "lb",
          "oz",
          "s-t",
          "st"
        ],
        "power": [
          "hp"
        ],
        "pressure": [
          "inhg",
          "psi"
        ],
        "temperature": [
          "f"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "galgb",
          "pt",
          "qt",
          "tbs",
          "tsp"
        ]
      }
    },
    "basic-measurements-us": {
      "name": {
        "en": "US measures (basics)",
        "fr": "Mesures USA (de base)"
      },
      "description": {
        "en": "yd, mil, oz, ..."
      },
      "types": {
        "count": [
          "generic"
        ],
        "length": [
          "ch",
          "ft",
          "in",
          "mil",
          "mi",
          "fur",
          "p",
          "pica",
          "yd"
        ],
        "mass": [
          "gr",
          "dr",
          "l-t",
          "lb",
          "oz"
        ],
        "temperature": [
          "f"
        ],
        "ratio": [
          "percent"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "ft3",
          "galus",
          "in3",
          "yd3",
          "pt",
          "qt",
          "bbloil",
          "tbs",
          "tsp"
        ]
      }
    },
    "generic-measurements-us": {
      "name": {
        "en": "US measures",
        "fr": "Mesures USA"
      },
      "description": {
        "en": "yd, mil, oz, ..."
      },
      "types": {
        "area": [
          "ac",
          "ft2",
          "in2",
          "yd2"
        ],
        "electric-current": [
          "a"
        ],
        "electromotive-force": [
          "v"
        ],
        "length": [
          "ch",
          "ft",
          "in",
          "mil",
          "mi",
          "fur",
          "p",
          "pica",
          "yd"
        ],
        "mass": [
          "gr",
          "dr",
          "l-t",
          "lb",
          "oz"
        ],
        "power": [
          "hp"
        ],
        "pressure": [
          "inhg",
          "psi"
        ],
        "temperature": [
          "f"
        ],
        "speed": [
          "ft-s",
          "m-min",
          "mph"
        ],
        "volume": [
          "c",
          "floz",
          "ft3",
          "galus",
          "in3",
          "yd3",
          "pt",
          "qt",
          "bbloil",
          "tbs",
          "tsp"
        ]
      }
    },
    "money-most-used": {
      "name": {
        "en": "Most used currencies",
        "fr": "Devises les plus utilisées"
      },
      "description": {
        "en": "$, €, ¥, ..."
      },
      "types": {
        "money": [
          "eur",
          "usd",
          "cny",
          "gbp",
          "jpy",
          "chf",
          "cad"
        ]
      }
    },
    "money-europe": {
      "name": {
        "en": "Currencies Europe",
        "fr": "Devises Europe"
      },
      "description": {
        "en": "€, £, CHF, ..."
      },
      "types": {
        "money": [
          "all",
          "byr",
          "bam",
          "bgn",
          "hrk",
          "czk",
          "dkk",
          "eek",
          "eur",
          "fkp",
          "gip",
          "ggp",
          "huf",
          "isk",
          "irr",
          "jep",
          "lvl",
          "ltl",
          "mkd",
          "ang",
          "nok",
          "pln",
          "ron",
          "rub",
          "shp",
          "rsd",
          "sek",
          "chf",
          "try",
          "trl",
          "uah",
          "gbp"
        ]
      }
    },
    "money-america": {
      "name": {
        "en": "Currencies Americas",
        "fr": "Devises Amériques"
      },
      "description": {
        "en": "$US, $CAD,  BRL, ..."
      },
      "types": {
        "money": [
          "ars",
          "bsd",
          "bbd",
          "bzd",
          "bmd",
          "bob",
          "brl",
          "cad",
          "kyd",
          "clp",
          "cop",
          "crc",
          "cup",
          "dop",
          "xcd",
          "svc",
          "fjd",
          "gtq",
          "gyd",
          "jmd",
          "mxn",
          "nio",
          "pab",
          "pyg",
          "pen",
          "shp",
          "srd",
          "ttd",
          "usd",
          "uyu",
          "vef"
        ]
      }
    },
    "money-asia": {
      "name": {
        "en": "Currencies Asia",
        "fr": "Devises Asie"
      },
      "description": {
        "en": "¥, 元, INR, ..."
      },
      "types": {
        "money": [
          "azn",
          "khr",
          "cny",
          "hnl",
          "inr",
          "idr",
          "jpy",
          "kzt",
          "kpw",
          "krw",
          "kgs",
          "lak",
          "myr",
          "mur",
          "mnt",
          "npr",
          "pkr",
          "rub",
          "scr",
          "sgd",
          "lkr",
          "syp",
          "twd",
          "thb",
          "try",
          "trl",
          "uzs",
          "vnd"
        ]
      }
    },
    "money-africa": {
      "name": {
        "en": "Currencies Africa",
        "fr": "Devises Afrique"
      },
      "description": {
        "en": "BWP, EGP, GHC, ..."
      },
      "types": {
        "money": [
          "bwp",
          "egp",
          "ghc",
          "mzn",
          "nad",
          "ngn",
          "sos",
          "zar",
          "zwd"
        ]
      }
    },
    "money-indonesia-australia": {
      "name": {
        "en": "Currencies Oceania & Indonesia",
        "fr": "Devises Océanie & Indonésie"
      },
      "description": {
        "en": "$AU, $NZ, PHP, ... "
      },
      "types": {
        "money": [
          "aud",
          "nzd",
          "php",
          "sbd",
          "tvd"
        ]
      }
    },
    "money-middleeast": {
      "name": {
        "en": "Currencies Middle East",
        "fr": "Devises Moyen-Orient"
      },
      "description": {
        "en": "AFN, BND, OMR, ...."
      },
      "types": {
        "money": [
          "afn",
          "bnd",
          "egp",
          "imp",
          "lbp",
          "omr",
          "qar",
          "sar",
          "syp",
          "yer"
        ]
      }
    },
    "generic-medical": {
      "name": {
        "en": "Common health mesures",
        "fr": "Mesures de santé courantes"
      },
      "description": {
        "en": "mmhg, bpm, ..."
      },
      "types": {
        "count": [
          "steps"
        ],
        "density": [
          "mg-dl",
          "mmol-l"
        ],
        "pressure": [
          "mmhg"
        ],
        "frequency": [
          "bpm"
        ]
      }
    },
    "navigation": {
      "name": {
        "en": "Navigation",
        "fr": "Navigation"
      },
      "description": {
        "en": "nmi, °, kt, ..."
      },
      "types": {
        "angle": [
          "deg",
          "grad",
          "rad"
        ],
        "length": [
          "nmi",
          "ftm",
          "cb"
        ],
        "speed": [
          "kt"
        ]
      }
    },
    "all-measures": {
      "name": {
        "en": "All measures",
        "fr": "Toutes les mesures"
      },
      "types": {
        "absorbed-dose": [
          "gy"
        ],
        "absorbed-dose-equivalent": [
          "sv"
        ],
        "absorbed-dose-rate": [
          "gy-s"
        ],
        "mol": [
          "mol"
        ],
        "angle": [
          "deg",
          "grad",
          "rad"
        ],
        "angular-acceleration": [
          "rad-s2"
        ],
        "area": [
          "ac",
          "ft2",
          "ha",
          "in2",
          "km2",
          "m2",
          "mm2",
          "yd2",
          "mi2"
        ],
        "capacitance": [
          "f"
        ],
        "catalytic-activity": [
          "kat"
        ],
        "data-quantity": [
          "b",
          "bits",
          "gb",
          "gbits",
          "kb",
          "kbits",
          "mb",
          "mbits",
          "tb"
        ],
        "density": [
          "g-dl",
          "kg-m3",
          "mg-dl",
          "mmol-l"
        ],
        "time": [
          "d",
          "h",
          "min",
          "ms",
          "s",
          "y"
        ],
        "dynamic-viscosity": [
          "pa-s"
        ],
        "electric-charge": [
          "c"
        ],
        "electric-charge-line-density": [
          "c-m"
        ],
        "electric-current": [
          "a"
        ],
        "electrical-conductivity": [
          "s"
        ],
        "electromotive-force": [
          "v"
        ],
        "energy": [
          "btu",
          "cal",
          "ev",
          "erg",
          "ftlb",
          "j",
          "kcal",
          "ws",
          "kwh",
          "nm",
          "wh"
        ],
        "force": [
          "dyn",
          "n",
          "pdl"
        ],
        "length": [
          "a",
          "au",
          "cm",
          "ch",
          "lea",
          "ft",
          "in",
          "km",
          "ly",
          "m",
          "mil",
          "mi",
          "fur",
          "mm",
          "nmi",
          "p",
          "pica",
          "ftm",
          "cb",
          "um",
          "yd"
        ],
        "luminous-intensity": [
          "cd"
        ],
        "mass": [
          "gr",
          "dr",
          "kg",
          "g",
          "l-t",
          "lb",
          "t",
          "oz",
          "s-t",
          "st"
        ],
        "power": [
          "btu-min",
          "ftlb-s",
          "hp",
          "kw",
          "w"
        ],
        "pressure": [
          "at",
          "bar",
          "cmhg",
          "inhg",
          "kg-m2",
          "pa",
          "kpa",
          "psf",
          "psi"
        ],
        "temperature": [
          "c",
          "f",
          "k"
        ],
        "speed": [
          "ft-m",
          "ft-s",
          "km-h",
          "kt",
          "m-min",
          "m-s",
          "mph"
        ],
        "volume": [
          "c",
          "cm3",
          "floz",
          "ft3",
          "galgb",
          "galus",
          "in3",
          "yd3",
          "l",
          "m3",
          "ml",
          "pt",
          "qt",
          "bbloil",
          "tbs",
          "tsp"
        ]
      }
    }
  },
  "extras": {
    "count": {
      "name": {
        "en": "Count",
        "fr": "Compte"
      },
      "formats": {
        "steps": {
          "name": {
            "en": "Steps",
            "fr": "Pas"
          }
        },
        "generic": {
          "name": {
            "en": "Units",
            "fr": "Unités"
          }
        }
      }
    },
    "money": {
      "name": {
        "en": "Money",
        "fr": "Argent"
      },
      "formats": {
        "chf": {
          "name": {
            "en": "Switzerland Franc",
            "fr": "Franc Suisse"
          },
          "symbol": "CHF"
        },
        "cny": {
          "name": {
            "en": "China Yuan Renminbi",
            "fr": "Yuan Ren-Min-Bi"
          },
          "symbol": "¥"
        },
        "eur": {
          "symbol": "€",
          "name": {
            "en": "Euro",
            "fr": "Euro"
          }
        },
        "gbp": {
          "name": {
            "en": "United Kingdom Pound",
            "fr": "Livre"
          },
          "symbol": "£"
        },
        "jpy": {
          "name": {
            "en": "Japan Yen",
            "fr": "Yen japonais"
          },
          "symbol": "¥"
        },
        "usd": {
          "name": {
            "en": "United States Dollar",
            "fr": "Dollar des États-Unis"
          },
          "symbol": "$"
        },
        "btc": {
          "name": {
            "en": "Bitcoin"
          },
          "symbol": "฿"
        },
        "all": {
          "name": {
            "en": "Albania Lek",
            "fr": "Lek Albanai"
          },
          "symbol": "Lek"
        },
        "afn": {
          "name": {
            "en": "Afghanistan Afghani",
            "fr": "Afghani"
          },
          "symbol": "؋"
        },
        "ars": {
          "name": {
            "en": "Argentina Peso",
            "fr": "Peso argentin"
          },
          "symbol": "$"
        },
        "awg": {
          "name": {
            "en": "Aruba Guilder",
            "fr": "Florin d'Aruba"
          },
          "symbol": "ƒ"
        },
        "aud": {
          "name": {
            "en": "Australia Dollar",
            "fr": "Dollar australien"
          },
          "symbol": "$"
        },
        "azn": {
          "name": {
            "en": "Azerbaijan New Manat",
            "fr": "Manat"
          },
          "symbol": "ман"
        },
        "bsd": {
          "name": {
            "en": "Bahamas Dollar",
            "fr": "Dollar des Bahamas"
          },
          "symbol": "$"
        },
        "bbd": {
          "name": {
            "en": "Barbados Dollar",
            "fr": "Dollar de Barbade"
          },
          "symbol": "$"
        },
        "byr": {
          "name": {
            "en": "Belarus Ruble",
            "fr": "Rouble bélorusse"
          },
          "symbol": "p."
        },
        "bzd": {
          "name": {
            "en": "Belize Dollar",
            "fr": "Dollar de Belize"
          },
          "symbol": "BZ$"
        },
        "bmd": {
          "name": {
            "en": "Bermuda Dollar",
            "fr": "Dollar des Bermudes"
          },
          "symbol": "$"
        },
        "bob": {
          "name": {
            "en": "Bolivia Boliviano",
            "fr": "Boliviano"
          },
          "symbol": "$b"
        },
        "bam": {
          "name": {
            "en": "Bosnia and Herzegovina Convertible Marka"
          },
          "symbol": "KM"
        },
        "bwp": {
          "name": {
            "en": "Botswana Pula"
          },
          "symbol": "P"
        },
        "bgn": {
          "name": {
            "en": "Bulgaria Lev",
            "fr": "Bulgarian Lev"
          },
          "symbol": "лв"
        },
        "brl": {
          "name": {
            "en": "Brazil Real",
            "fr": "Real"
          },
          "symbol": "R$"
        },
        "bnd": {
          "name": {
            "en": "Brunei Darussalam Dollar",
            "fr": "Dollar de Brunei"
          },
          "symbol": "$"
        },
        "khr": {
          "name": {
            "en": "Cambodia Riel",
            "fr": "Riel"
          },
          "symbol": "៛"
        },
        "cad": {
          "name": {
            "en": "Canada Dollar",
            "fr": "Dollar canadien"
          },
          "symbol": "$"
        },
        "kyd": {
          "name": {
            "en": "Cayman Islands Dollar",
            "fr": "Dollar des Iles Caïmans"
          },
          "symbol": "$"
        },
        "clp": {
          "name": {
            "en": "Chile Peso",
            "fr": "Peso chilien"
          },
          "symbol": "$"
        },
        "cop": {
          "name": {
            "en": "Colombia Peso",
            "fr": "Peso colombien"
          },
          "symbol": "$"
        },
        "crc": {
          "name": {
            "en": "Costa Rica Colon",
            "fr": "Colon de Costa Rica"
          },
          "symbol": "₡"
        },
        "hrk": {
          "name": {
            "en": "Croatia Kuna",
            "fr": "Kuna"
          },
          "symbol": "kn"
        },
        "cup": {
          "name": {
            "en": "Cuba Peso",
            "fr": "Peso cubain"
          },
          "symbol": "₱"
        },
        "czk": {
          "name": {
            "en": "Czech Republic Koruna"
          },
          "symbol": "Kč"
        },
        "dkk": {
          "name": {
            "en": "Denmark Krone",
            "fr": "Couronne danoise"
          },
          "symbol": "kr"
        },
        "dop": {
          "name": {
            "en": "Dominican Republic Peso",
            "fr": "Peso dominicain"
          },
          "symbol": "RD$"
        },
        "xcd": {
          "name": {
            "en": "East Caribbean Dollar",
            "fr": "Dollar des Caraïbes orientales"
          },
          "symbol": "$"
        },
        "egp": {
          "name": {
            "en": "Egypt Pound",
            "fr": "Livre égyptienne"
          },
          "symbol": "£"
        },
        "svc": {
          "name": {
            "en": "El Salvador Colon",
            "fr": "Colon du El Salvador"
          },
          "symbol": "$"
        },
        "eek": {
          "name": {
            "en": "Estonia Kroon",
            "fr": "Couronne estonienne"
          },
          "symbol": "kr"
        },
        "fkp": {
          "name": {
            "en": "Falkland Islands (Malvinas) Pound"
          },
          "symbol": "£"
        },
        "fjd": {
          "name": {
            "en": "Fiji Dollar"
          },
          "symbol": "$"
        },
        "ghc": {
          "name": {
            "en": "Ghana Cedis"
          },
          "symbol": "¢"
        },
        "gip": {
          "name": {
            "en": "Gibraltar Pound"
          },
          "symbol": "£"
        },
        "gtq": {
          "name": {
            "en": "Guatemala Quetzal"
          },
          "symbol": "Q"
        },
        "ggp": {
          "name": {
            "en": "Guernsey Pound"
          },
          "symbol": "£"
        },
        "gyd": {
          "name": {
            "en": "Guyana Dollar"
          },
          "symbol": "$"
        },
        "hnl": {
          "name": {
            "en": "Honduras Lempira"
          },
          "symbol": "L"
        },
        "hkd": {
          "name": {
            "en": "Hong Kong Dollar"
          },
          "symbol": "$"
        },
        "huf": {
          "name": {
            "en": "Hungary Forint"
          },
          "symbol": "Ft"
        },
        "isk": {
          "name": {
            "en": "Iceland Krona"
          },
          "symbol": "kr"
        },
        "inr": {
          "name": {
            "en": "India Rupee",
            "fr": "Rhoupie indienne"
          }
        },
        "idr": {
          "name": {
            "en": "Indonesia Rupiah"
          },
          "symbol": "Rp"
        },
        "irr": {
          "name": {
            "en": "Iran Rial"
          },
          "symbol": "﷼"
        },
        "imp": {
          "name": {
            "en": "Isle of Man Pound"
          },
          "symbol": "£"
        },
        "ils": {
          "name": {
            "en": "Israel Shekel"
          },
          "symbol": "₪"
        },
        "jmd": {
          "name": {
            "en": "Jamaica Dollar"
          },
          "symbol": "J$"
        },
        "jep": {
          "name": {
            "en": "Jersey Pound"
          },
          "symbol": "£"
        },
        "kzt": {
          "name": {
            "en": "Kazakhstan Tenge"
          },
          "symbol": "лв"
        },
        "kpw": {
          "name": {
            "en": "Korea (North) Won",
            "fr": "Won de la Corée du Nord"
          },
          "symbol": "₩"
        },
        "krw": {
          "name": {
            "en": "Korea (South) Won",
            "fr": "Won"
          },
          "symbol": "₩"
        },
        "kgs": {
          "name": {
            "en": "Kyrgyzstan Som"
          },
          "symbol": "лв"
        },
        "lak": {
          "name": {
            "en": "Laos Kip"
          },
          "symbol": "₭"
        },
        "lvl": {
          "name": {
            "en": "Latvia Lat",
            "fr": "Lat letton"
          },
          "symbol": "Ls"
        },
        "lbp": {
          "name": {
            "en": "Lebanon Pound"
          },
          "symbol": "£"
        },
        "lrd": {
          "name": {
            "en": "Liberia Dollar"
          },
          "symbol": "$"
        },
        "ltl": {
          "name": {
            "en": "Lithuania Litas"
          },
          "symbol": "Lt"
        },
        "mkd": {
          "name": {
            "en": "Macedonia Denar"
          },
          "symbol": "ден"
        },
        "myr": {
          "name": {
            "en": "Malaysia Ringgit"
          },
          "symbol": "RM"
        },
        "mur": {
          "name": {
            "en": "Mauritius Rupee"
          },
          "symbol": "₨"
        },
        "mxn": {
          "name": {
            "en": "Mexico Peso"
          },
          "symbol": "$"
        },
        "mnt": {
          "name": {
            "en": "Mongolia Tughrik"
          },
          "symbol": "₮"
        },
        "mzn": {
          "name": {
            "en": "Mozambique Metical"
          },
          "symbol": "MT"
        },
        "nad": {
          "name": {
            "en": "Namibia Dollar"
          },
          "symbol": "$"
        },
        "npr": {
          "name": {
            "en": "Nepal Rupee"
          },
          "symbol": "₨"
        },
        "ang": {
          "name": {
            "en": "Netherlands Antilles Guilder",
            "fr": "Florin des Antilles"
          },
          "symbol": "ƒ"
        },
        "nzd": {
          "name": {
            "en": "New Zealand Dollar",
            "fr": "Dollar néo-zélandais"
          },
          "symbol": "$"
        },
        "nio": {
          "name": {
            "en": "Nicaragua Cordoba"
          },
          "symbol": "C$"
        },
        "ngn": {
          "name": {
            "en": "Nigeria Naira"
          },
          "symbol": "₦"
        },
        "nok": {
          "name": {
            "en": "Norway Krone",
            "fr": "Couronne norvégienne"
          },
          "symbol": "kr"
        },
        "omr": {
          "name": {
            "en": "Oman Rial"
          },
          "symbol": "﷼"
        },
        "pkr": {
          "name": {
            "en": "Pakistan Rupee"
          },
          "symbol": "₨"
        },
        "pab": {
          "name": {
            "en": "Panama Balboa"
          },
          "symbol": "B/."
        },
        "pyg": {
          "name": {
            "en": "Paraguay Guarani"
          },
          "symbol": "Gs"
        },
        "pen": {
          "name": {
            "en": "Peru Nuevo Sol"
          },
          "symbol": "S/."
        },
        "php": {
          "name": {
            "en": "Philippines Peso"
          },
          "symbol": "₱"
        },
        "pln": {
          "name": {
            "en": "Poland Zloty"
          },
          "symbol": "zł"
        },
        "qar": {
          "name": {
            "en": "Qatar Riyal"
          },
          "symbol": "﷼"
        },
        "ron": {
          "name": {
            "en": "Romania New Leu"
          },
          "symbol": "lei"
        },
        "rub": {
          "name": {
            "en": "Russia Ruble"
          },
          "symbol": "руб"
        },
        "shp": {
          "name": {
            "en": "Saint Helena Pound"
          },
          "symbol": "£"
        },
        "sar": {
          "name": {
            "en": "Saudi Arabia Riyal",
            "fr": "Riyal saoudien"
          },
          "symbol": "﷼"
        },
        "rsd": {
          "name": {
            "en": "Serbia Dinar"
          },
          "symbol": "Дин."
        },
        "scr": {
          "name": {
            "en": "Seychelles Rupee"
          },
          "symbol": "₨"
        },
        "sgd": {
          "name": {
            "en": "Singapore Dollar"
          },
          "symbol": "$"
        },
        "sbd": {
          "name": {
            "en": "Solomon Islands Dollar"
          },
          "symbol": "$"
        },
        "sos": {
          "name": {
            "en": "Somalia Shilling"
          },
          "symbol": "S"
        },
        "zar": {
          "name": {
            "en": "South Africa Rand",
            "fr": "Rand"
          },
          "symbol": "R"
        },
        "lkr": {
          "name": {
            "en": "Sri Lanka Rupee"
          },
          "symbol": "₨"
        },
        "sek": {
          "name": {
            "en": "Sweden Krona"
          },
          "symbol": "kr"
        },
        "srd": {
          "name": {
            "en": "Suriname Dollar"
          },
          "symbol": "$"
        },
        "syp": {
          "name": {
            "en": "Syria Pound"
          },
          "symbol": "£"
        },
        "twd": {
          "name": {
            "en": "Taiwan New Dollar"
          },
          "symbol": "NT$"
        },
        "thb": {
          "name": {
            "en": "Thailand Baht"
          },
          "symbol": "฿"
        },
        "ttd": {
          "name": {
            "en": "Trinidad and Tobago Dollar"
          },
          "symbol": "TT$"
        },
        "try": {
          "name": {
            "en": "Turkey Lira"
          }
        },
        "trl": {
          "name": {
            "en": "Turkey Lira"
          },
          "symbol": "₤"
        },
        "tvd": {
          "name": {
            "en": "Tuvalu Dollar"
          },
          "symbol": "$"
        },
        "uah": {
          "name": {
            "en": "Ukraine Hryvna"
          },
          "symbol": "₴"
        },
        "uyu": {
          "name": {
            "en": "Uruguay Peso"
          },
          "symbol": "$U"
        },
        "uzs": {
          "name": {
            "en": "Uzbekistan Som"
          },
          "symbol": "лв"
        },
        "vef": {
          "name": {
            "en": "Venezuela Bolivar"
          },
          "symbol": "Bs"
        },
        "vnd": {
          "name": {
            "en": "Viet Nam Dong"
          },
          "symbol": "₫"
        },
        "yer": {
          "name": {
            "en": "Yemen Rial"
          },
          "symbol": "﷼"
        },
        "zwd": {
          "name": {
            "en": "Zimbabwe Dollar"
          },
          "symbol": "Z$"
        }
      }
    },
    "temperature": {
      "name": {
        "en": "Temperature",
        "fr": "Température"
      },
      "formats": {
        "c": {
          "name": {
            "en": "Degrees Celsius",
            "fr": "Degrés Celsius"
          },
          "symbol": "°C"
        },
        "f": {
          "name": {
            "en": "Degrees Fahrenheit",
            "fr": "Degrés Fahrenheit"
          },
          "symbol": "°F"
        },
        "k": {
          "name": {
            "en": "Degrees Kelvin",
            "fr": "Degrés Kelvin"
          },
          "symbol": "°K"
        }
      }
    },
    "length": {
      "name": {
        "fr": "Longueur",
        "en": "Length"
      },
      "formats": {
        "cm": {
          "name": {
            "en": "Centimeters",
            "fr": "Centimètres"
          },
          "symbol": "cm"
        },
        "km": {
          "name": {
            "en": "Kilometers",
            "fr": "Kilomètres"
          },
          "symbol": "km"
        },
        "m": {
          "name": {
            "en": "Meters",
            "fr": "Mètres"
          },
          "symbol": "m"
        },
        "mm": {
          "name": {
            "en": "Millimeters",
            "fr": "Millimètres"
          },
          "symbol": "mm"
        },
        "a": {
          "name": {
            "en": "Ångströms",
            "fr": "Ångströms"
          },
          "symbol": "Å"
        },
        "au": {
          "name": {
            "en": "Astronomical units",
            "fr": "Unités astronomiques"
          },
          "symbol": "AU"
        },
        "ch": {
          "name": {
            "en": "Chains",
            "fr": "Chaînes"
          },
          "symbol": "ch"
        },
        "lea": {
          "name": {
            "en": "Leagues",
            "fr": "Lieues"
          },
          "symbol": "lea"
        },
        "ft": {
          "name": {
            "en": "Feet",
            "fr": "Pieds"
          },
          "symbol": "ft"
        },
        "in": {
          "name": {
            "en": "Inches",
            "fr": "Pouces"
          },
          "symbol": "In"
        },
        "ly": {
          "name": {
            "en": "Light-years",
            "fr": "Années-lumière"
          },
          "symbol": "ly"
        },
        "mil": {
          "name": {
            "en": "Mils",
            "fr": "Mils"
          },
          "symbol": "mil"
        },
        "mi": {
          "name": {
            "en": "Miles",
            "fr": "Miles"
          },
          "symbol": "mi"
        },
        "fur": {
          "name": {
            "en": "Furlongs",
            "fr": "Furlongs"
          },
          "symbol": "fur"
        },
        "nmi": {
          "name": {
            "en": "Miles (nautical)",
            "fr": "Miles nautiques"
          },
          "symbol": "nmi"
        },
        "p": {
          "name": {
            "en": "Points",
            "fr": "Points"
          },
          "symbol": "p"
        },
        "pica": {
          "name": {
            "en": "Picas",
            "fr": "Picas"
          },
          "symbol": "P̸"
        },
        "ftm": {
          "name": {
            "en": "Fathoms",
            "fr": "Fathoms"
          },
          "symbol": "ftm"
        },
        "cb": {
          "name": {
            "en": "Cables",
            "fr": "Cables"
          },
          "symbol": "cb"
        },
        "um": {
          "name": {
            "en": "Microns",
            "fr": "Microns"
          },
          "symbol": "µm"
        },
        "yd": {
          "name": {
            "en": "Yards",
            "fr": "Verges"
          },
          "symbol": "yd"
        }
      }
    },
    "mass": {
      "formats": {
        "g": {
          "name": {
            "en": "Grams",
            "fr": "Grammes"
          },
          "symbol": "g"
        },
        "kg": {
          "name": {
            "en": "Kilograms",
            "fr": "Kilogrammes"
          },
          "symbol": "Kg"
        },
        "gr": {
          "name": {
            "en": "Grains",
            "fr": "Grains"
          },
          "symbol": "gr"
        },
        "dr": {
          "name": {
            "en": "Drams",
            "fr": "Drams"
          },
          "symbol": "dr"
        },
        "l-t": {
          "name": {
            "en": "Long tons",
            "fr": "Tonnes longues"
          },
          "symbol": "L/T"
        },
        "lb": {
          "name": {
            "en": "Pounds",
            "fr": "Livres"
          },
          "symbol": "lb"
        },
        "t": {
          "name": {
            "en": "Metric tons",
            "fr": "Tonnes métriques"
          },
          "symbol": "Mg"
        },
        "oz": {
          "name": {
            "en": "Ounces",
            "fr": "Onces"
          },
          "symbol": "oz"
        },
        "s-t": {
          "name": {
            "en": "Short tons",
            "fr": "Tonnes courtes"
          },
          "symbol": "S/T"
        },
        "st": {
          "name": {
            "en": "Stones",
            "fr": "Stones"
          },
          "symbol": "st"
        }
      },
      "name": {
        "en": "Mass",
        "fr": "Masse"
      }
    },
    "absorbed-dose": {
      "formats": {
        "gy": {
          "name": {
            "en": "Grays",
            "fr": "Grays"
          },
          "symbol": "Gy"
        }
      },
      "name": {
        "en": "Absorbed dose",
        "fr": "Dose absorbée"
      }
    },
    "absorbed-dose-equivalent": {
      "formats": {
        "sv": {
          "name": {
            "en": "Sieverts",
            "fr": "Sieverts"
          },
          "symbol": "Sv"
        }
      },
      "name": {
        "en": "Dose equivalent",
        "fr": "Dose équivalente"
      }
    },
    "absorbed-dose-rate": {
      "formats": {
        "gy-s": {
          "name": {
            "en": "Grays/second",
            "fr": "Grays/seconde"
          },
          "symbol": "Gy/s"
        }
      },
      "name": {
        "en": "Absorbed dose rate",
        "fr": "Débit de dose absorbée"
      }
    },
    "angle": {
      "formats": {
        "deg": {
          "name": {
            "en": "Degrees",
            "fr": "Degrés"
          },
          "symbol": "°"
        },
        "grad": {
          "name": {
            "en": "Gradians",
            "fr": "Grades"
          },
          "symbol": "grad"
        },
        "rad": {
          "name": {
            "en": "Radians",
            "fr": "Radians"
          },
          "symbol": "rad"
        }
      },
      "name": {
        "en": "Angle",
        "fr": "Angle"
      }
    },
    "angular-acceleration": {
      "formats": {
        "rad-s2": {
          "name": {
            "en": "Radians/second squared",
            "fr": "Radians/seconde carrée"
          },
          "symbol": "rad/s²"
        }
      },
      "name": {
        "en": "Angular acceleration",
        "fr": "Accélération angulaire"
      }
    },
    "area": {
      "formats": {
        "ac": {
          "name": {
            "en": "Acres (imperial)",
            "fr": "Acres (anglo-saxon)"
          },
          "symbol": "ac"
        },
        "ft2": {
          "name": {
            "en": "Square feet",
            "fr": "Pieds carrés"
          },
          "symbol": "ft²"
        },
        "ha": {
          "name": {
            "en": "Hectares",
            "fr": "Hectares"
          },
          "symbol": "ha"
        },
        "in2": {
          "name": {
            "en": "Square inches",
            "fr": "Pouces carrés"
          },
          "symbol": "in²"
        },
        "km2": {
          "name": {
            "en": "Square kilometers",
            "fr": "Kilomètres carrés"
          },
          "symbol": "km²"
        },
        "m2": {
          "name": {
            "en": "Square meters",
            "fr": "Mètres carrés"
          },
          "symbol": "m²"
        },
        "mm2": {
          "name": {
            "en": "Square millimeters",
            "fr": "Millimètres carrés"
          },
          "symbol": "mm²"
        },
        "yd2": {
          "name": {
            "en": "Square yards",
            "fr": "Verges carrées"
          },
          "symbol": "yd²"
        },
        "mi2": {
          "name": {
            "en": "Square miles",
            "fr": "Milles carrés"
          },
          "symbol": "mi²"
        }
      },
      "name": {
        "en": "Area",
        "fr": "Aire"
      }
    },
    "capacitance": {
      "formats": {
        "f": {
          "name": {
            "en": "Farads",
            "fr": "Farads"
          },
          "symbol": "F"
        }
      },
      "name": {
        "en": "Capacitance",
        "fr": "Capacitance"
      }
    },
    "catalytic-activity": {
      "formats": {
        "kat": {
          "name": {
            "en": "Katals",
            "fr": "Katals"
          },
          "symbol": "kat"
        }
      },
      "name": {
        "en": "Catalytic activity",
        "fr": "Activité catalytique"
      }
    },
    "data-quantity": {
      "formats": {
        "b": {
          "name": {
            "en": "Bytes",
            "fr": "Octets"
          },
          "symbol": "B"
        },
        "bits": {
          "name": {
            "en": "Bits",
            "fr": "Bits"
          },
          "symbol": "bit"
        },
        "gb": {
          "name": {
            "en": "Gigabytes",
            "fr": "Gigaoctets"
          },
          "symbol": "Gb"
        },
        "gbits": {
          "name": {
            "en": "Gigabits",
            "fr": "Gigabits"
          },
          "symbol": "Gbit"
        },
        "kb": {
          "name": {
            "en": "Kilobytes",
            "fr": "Kilooctets"
          },
          "symbol": "Kb"
        },
        "kbits": {
          "name": {
            "en": "Kilobits",
            "fr": "Kilobits"
          },
          "symbol": "Kbit"
        },
        "mb": {
          "name": {
            "en": "Megabytes",
            "fr": "Megaoctets"
          },
          "symbol": "Mb"
        },
        "mbits": {
          "name": {
            "en": "Megabits",
            "fr": "Megabits"
          },
          "symbol": "Mbit"
        },
        "tb": {
          "name": {
            "en": "Terabytes",
            "fr": "Teraoctets"
          },
          "symbol": "Tb"
        }
      },
      "name": {
        "en": "Data quantity",
        "fr": "Quantité de données"
      }
    },
    "density": {
      "formats": {
        "g-dl": {
          "name": {
            "en": "Grams/deciliter",
            "fr": "Grammes/décilitre"
          },
          "symbol": "g/dL"
        },
        "kg-m3": {
          "name": {
            "en": "Kilograms/cubic meter",
            "fr": "Kilogrammes/mètre cube"
          },
          "symbol": "kg/m³"
        },
        "mg-dl": {
          "name": {
            "en": "Milligrams/deciliter",
            "fr": "Milligrammes/décilitre"
          },
          "symbol": "mg/dL"
        },
        "mmol-l": {
          "name": {
            "en": "Millimoles/liter",
            "fr": "Millimoles/litre"
          },
          "symbol": "mmol/L"
        }
      },
      "name": {
        "en": "Density",
        "fr": "Densité"
      }
    },
    "dynamic-viscosity": {
      "formats": {
        "pa-s": {
          "name": {
            "en": "Pascals/second",
            "fr": "Pascals/seconde"
          },
          "symbol": "Pa/s"
        }
      },
      "name": {
        "en": "Dynamic viscosity",
        "fr": "Viscosité dynamique"
      }
    },
    "electric-charge": {
      "formats": {
        "c": {
          "name": {
            "en": "Coulombs",
            "fr": "Coulombs"
          },
          "symbol": "C"
        }
      },
      "name": {
        "en": "Electric charge",
        "fr": "Charge électrique"
      }
    },
    "electric-charge-line-density": {
      "formats": {
        "c-m": {
          "name": {
            "en": "Coulombs/meter",
            "fr": "Coulombs/mètre"
          },
          "symbol": "C/m"
        }
      },
      "name": {
        "en": "Electric charge line density",
        "fr": "Densité linéique de charge électrique"
      }
    },
    "electric-current": {
      "formats": {
        "a": {
          "name": {
            "en": "Amperes",
            "fr": "Ampères"
          },
          "symbol": "A"
        }
      },
      "name": {
        "en": "Electric current",
        "fr": "Courant électrique"
      }
    },
    "electrical-conductivity": {
      "formats": {
        "s": {
          "name": {
            "en": "Siemens",
            "fr": "Siemens"
          },
          "symbol": "S"
        }
      },
      "name": {
        "en": "Electrical conductivity",
        "fr": "Conductivité électrique"
      }
    },
    "electromotive-force": {
      "formats": {
        "v": {
          "name": {
            "en": "Volts",
            "fr": "Volts"
          },
          "symbol": "V"
        }
      },
      "name": {
        "en": "Electromotive force",
        "fr": "Force électromotrice"
      }
    },
    "energy": {
      "formats": {
        "btu": {
          "name": {
            "en": "British thermal units",
            "fr": "British thermal units"
          },
          "symbol": "BTU"
        },
        "cal": {
          "name": {
            "en": "Calories",
            "fr": "Calories"
          },
          "symbol": "cal"
        },
        "ev": {
          "name": {
            "en": "Electron-volts",
            "fr": "Électron-volts"
          },
          "symbol": "eV"
        },
        "erg": {
          "name": {
            "en": "Ergs",
            "fr": "Ergs"
          },
          "symbol": "Erg"
        },
        "ftlb": {
          "name": {
            "en": "Foot-pounds",
            "fr": "Pied-livres"
          },
          "symbol": "ft·lb"
        },
        "j": {
          "name": {
            "en": "Joules",
            "fr": "Joules"
          },
          "symbol": "J"
        },
        "kcal": {
          "name": {
            "en": "Kilogram-calories",
            "fr": "Kilocalories"
          },
          "symbol": "kg·cal"
        },
        "ws": {
          "name": {
            "en": "Watt-seconds",
            "fr": "Watt-secondes"
          },
          "symbol": "Ws"
        },
        "kwh": {
          "name": {
            "en": "Kilowatt-hours",
            "fr": "Kilowatt-heures"
          },
          "symbol": "kW·h"
        },
        "nm": {
          "name": {
            "en": "Newton-meters",
            "fr": "Newton-mètres"
          },
          "symbol": "N·m"
        },
        "wh": {
          "name": {
            "en": "Watt-hours",
            "fr": "Watt-heures"
          },
          "symbol": "W·h"
        }
      },
      "name": {
        "en": "Energy",
        "fr": "Energie"
      }
    },
    "force": {
      "formats": {
        "dyn": {
          "name": {
            "en": "Dynes",
            "fr": "Dynes"
          },
          "symbol": "dyn"
        },
        "n": {
          "name": {
            "en": "Newtons",
            "fr": "Newtons"
          },
          "symbol": "N"
        },
        "pdl": {
          "name": {
            "en": "Poundals",
            "fr": "Poundals"
          },
          "symbol": "Pdl"
        }
      },
      "name": {
        "en": "Force",
        "fr": "Force"
      }
    },
    "frequency": {
      "formats": {
        "rpm": {
          "name": {
            "en": "Revolutions per minute",
            "fr": "Rotations par minute"
          },
          "symbol": "rpm"
        },
        "hz": {
          "name": {
            "en": "Hertz",
            "fr": "Hertz"
          },
          "symbol": "Hz"
        },
        "bpm": {
          "name": {
            "en": "Beats per minute",
            "fr": "Battements par minute"
          },
          "symbol": "bpm"
        }
      },
      "name": {
        "en": "Frequency",
        "fr": "Fréquence"
      }
    },
    "luminous-intensity": {
      "formats": {
        "cd": {
          "name": {
            "en": "Candelas",
            "fr": "Candelas"
          },
          "symbol": "Cd"
        }
      },
      "name": {
        "en": "Luminous intensity",
        "fr": "Intensité lumineuse"
      }
    },
    "mol": {
      "formats": {
        "mol": {
          "name": {
            "en": "Moles",
            "fr": "Moles"
          },
          "symbol": "Mol"
        }
      },
      "name": {
        "en": "Amount of substance",
        "fr": "Quantité de matière"
      }
    },
    "power": {
      "formats": {
        "btu-min": {
          "name": {
            "en": "BTUs/minute",
            "fr": "BTUs/minute"
          },
          "symbol": "BTU/min"
        },
        "ftlb-s": {
          "name": {
            "en": "Foot-pounds/second",
            "fr": "Pied-livres/seconde"
          },
          "symbol": "ft·lb/s"
        },
        "hp": {
          "name": {
            "en": "Horsepower",
            "fr": "Chevaux"
          },
          "symbol": "hp"
        },
        "kw": {
          "name": {
            "en": "Kilowatts",
            "fr": "Kilowatts"
          },
          "symbol": "kW"
        },
        "w": {
          "name": {
            "en": "Watts",
            "fr": "Watts"
          },
          "symbol": "W"
        }
      },
      "name": {
        "en": "Power",
        "fr": "Puissance"
      }
    },
    "pressure": {
      "formats": {
        "at": {
          "name": {
            "en": "Atmospheres",
            "fr": "Atmosphères"
          },
          "symbol": "at"
        },
        "bar": {
          "name": {
            "en": "Bars",
            "fr": "Bars"
          },
          "symbol": "bar"
        },
        "cmhg": {
          "name": {
            "en": "Centimeters of mercury",
            "fr": "Centimètres de mercure"
          },
          "symbol": "cmHg"
        },
        "inhg": {
          "name": {
            "en": "Inches of mercury",
            "fr": "Pouces de mercure"
          },
          "symbol": "inHg"
        },
        "kg-m2": {
          "name": {
            "en": "Kilograms/square meter",
            "fr": "Kilogrammes/mètre cube"
          },
          "symbol": "kg/m²"
        },
        "mmhg": {
          "name": {
            "en": "Millimeters of mercury",
            "fr": "Millimètres de mercure"
          },
          "symbol": "mmHg"
        },
        "pa": {
          "name": {
            "en": "Pascals",
            "fr": "Pascals"
          },
          "symbol": "Pa"
        },
        "kpa": {
          "name": {
            "en": "Kilo Pascals",
            "fr": "Kilo Pascals"
          },
          "symbol": "kPa"
        },
        "psf": {
          "name": {
            "en": "Pounds/square foot",
            "fr": "Livres/pied carré"
          },
          "symbol": "psf"
        },
        "psi": {
          "name": {
            "en": "Pounds/square inch",
            "fr": "Livres/pouce carré"
          },
          "symbol": "psi"
        }
      },
      "name": {
        "en": "Pressure",
        "fr": "Pression"
      }
    },
    "ratio": {
      "formats": {
        "percent": {
          "name": {
            "en": "Percentage",
            "fr": "Pourcentage"
          }
        }
      },
      "name": {
        "en": "Ratio",
        "fr": "Ratio"
      }
    },
    "speed": {
      "formats": {
        "ft-m": {
          "name": {
            "en": "Feet/minute",
            "fr": "Pieds/minute"
          },
          "symbol": "ft/m"
        },
        "ft-s": {
          "name": {
            "en": "Feet/second",
            "fr": "Pieds/seconde"
          },
          "symbol": "ft/s"
        },
        "km-h": {
          "name": {
            "en": "Kilometers/hour",
            "fr": "Kilomètres/heure"
          },
          "symbol": "km/h"
        },
        "kt": {
          "name": {
            "en": "Knots",
            "fr": "Noeuds"
          },
          "symbol": "kt"
        },
        "m-min": {
          "name": {
            "en": "Miles/minute",
            "fr": "Miles/minute"
          },
          "symbol": "m/min"
        },
        "m-s": {
          "name": {
            "en": "Meters/second",
            "fr": "Mètres/seconde"
          },
          "symbol": "m/s"
        },
        "mph": {
          "name": {
            "en": "Miles/hour",
            "fr": "Miles/heure"
          },
          "symbol": "mph"
        }
      },
      "name": {
        "en": "Speed",
        "fr": "Vitesse"
      }
    },
    "volume": {
      "formats": {
        "c": {
          "name": {
            "en": "Cups",
            "fr": "Tasses"
          },
          "symbol": "c"
        },
        "cm3": {
          "name": {
            "en": "Cubic centimeters",
            "fr": "Centimètres cube"
          },
          "symbol": "cm³"
        },
        "floz": {
          "name": {
            "en": "Fluid ounces",
            "fr": "Onces liquides"
          },
          "symbol": "fl oz"
        },
        "ft3": {
          "name": {
            "en": "Cubic feet",
            "fr": "Pieds cube"
          },
          "symbol": "cu ft"
        },
        "galgb": {
          "name": {
            "en": "Gallons imperial",
            "fr": "Gallons impériaux"
          },
          "symbol": "gal GB"
        },
        "galus": {
          "name": {
            "en": "Gallons US",
            "fr": "Gallons US"
          },
          "symbol": "gal US"
        },
        "in3": {
          "name": {
            "en": "Cubic inches",
            "fr": "Pouce cube"
          },
          "symbol": "cu in"
        },
        "yd3": {
          "name": {
            "en": "Cubic yards",
            "fr": "Verges cube"
          },
          "symbol": "cu yd"
        },
        "l": {
          "name": {
            "en": "Liters",
            "fr": "Litres"
          },
          "symbol": "L"
        },
        "m3": {
          "name": {
            "en": "Cubic meters",
            "fr": "Mètres cube"
          },
          "symbol": "m³"
        },
        "ml": {
          "name": {
            "en": "Milliliters",
            "fr": "Millilitres"
          },
          "symbol": "mL"
        },
        "pt": {
          "name": {
            "en": "Pints",
            "fr": "Pintes"
          },
          "symbol": "pt"
        },
        "qt": {
          "name": {
            "en": "Quarts",
            "fr": "Quarts"
          },
          "symbol": "qt"
        },
        "bbloil": {
          "name": {
            "en": "Barrels (oil)",
            "fr": "Barils (pétrole)"
          },
          "symbol": "bbl (oil)"
        },
        "tbs": {
          "name": {
            "en": "Tablespoons",
            "fr": "Cuillères à soupe"
          },
          "symbol": "tbs"
        },
        "tsp": {
          "name": {
            "en": "Teaspoons",
            "fr": "Cuillères à café"
          },
          "symbol": "tsp"
        }
      },
      "name": {
        "en": "Volume",
        "fr": "Volume"
      }
    },
    "time": {
      "formats": {
        "d": {
          "name": {
            "en": "Days",
            "fr": "Jours"
          },
          "symbol": "d"
        },
        "h": {
          "name": {
            "en": "Hours",
            "fr": "Heures"
          },
          "symbol": "h"
        },
        "min": {
          "name": {
            "en": "Minutes",
            "fr": "Minutes"
          },
          "symbol": "min"
        },
        "ms": {
          "name": {
            "en": "Milliseconds",
            "fr": "Millisecondes"
          },
          "symbol": "ms"
        },
        "s": {
          "name": {
            "en": "Seconds",
            "fr": "Secondes"
          },
          "symbol": "s"
        },
        "y": {
          "name": {
            "en": "Years (Julian)",
            "fr": "Années (juliennes)"
          },
          "symbol": "yr"
        }
      },
      "name": {
        "en": "Time",
        "fr": "Temps"
      }
    }
  }
}
},{}],62:[function(require,module,exports){
module.exports={
  "version": "0.2.9",
  "types": {
    "activity/plain": {
      "description": "Plain activity event with no specific content; the activity is defined by the event's stream, time and duration, and possibly description and tags.",
      "type": "null"
    },
    "audio/attached": {
      "description": "The audio source is the file attached to the event (no explicit content defined).\nYou can use the event's duration to mirror the recording's duration.",
      "type": "null",
      "attachmentRequired": true
    },
    "audio/url": {
      "description": "A reference to an audio file online.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "call/name": {
      "description": "The contact's name (or a free-form identifier)",
      "type": "string"
    },
    "call/skype": {
      "description": "The Skype id",
      "type": "string"
    },
    "call/telephone": {
      "description": "The phone number",
      "type": "string"
    },
    "contact/facebook": {
      "type": "object",
      "description": "A Facebook user as specified in the Graph API: https://developers.facebook.com/docs/reference/api/user/",
      "additionalProperties": "true",
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "required": [
        "id"
      ]
    },
    "contact/vcard": {
      "description": "A business card in vCard 2.0-3.x format. See: rfc2425, rfc2426.",
      "type": "string"
    },
    "encrypted/aes-text-base64": {
      "description": "AES encrypted payload, with a <em>text</em> key and a <em>Base64</em> payload.",
      "type": "object",
      "properties": {
        "payload": {
          "description": "The encrypted data.",
          "type": "string"
        },
        "keyRef": {
          "description": "A reference (e.g. id, name in keychain) to the key to use for decryption.",
          "type": "string"
        },
        "hint": {
          "description": "Alternative to <code>keyRef</code>. A textual hint about which key to use for decryption.",
          "type": "string"
        }
      },
      "required": [
        "payload"
      ]
    },
    "file/attached": {
      "description": "The file is attached to the event",
      "type": "null",
      "attachmentRequired": true
    },
    "file/attached-multiple": {
      "description": "A set of file attached. Structure can be declared in the filenames.",
      "attachmentRequired": true,
      "type": "null"
    },
    "file/url": {
      "description": "A reference to a file hosted elsewhere",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "message/email": {
      "description": "An e-mail message.",
      "type": "object",
      "properties": {
        "from": {
          "type": "string"
        },
        "to": {
          "type": "string"
        },
        "cc": {
          "type": "string"
        },
        "bcc": {
          "type": "string"
        },
        "subject": {
          "type": "string"
        },
        "message-id": {
          "type": "string"
        },
        "reply-to": {
          "type": "string"
        },
        "x-headers": {
          "description": "Key/value map of `X-*` headers",
          "type": "object",
          "additionalProperties": true
        },
        "body": {
          "type": "string"
        }
      },
      "required": [
        "from",
        "to",
        "body"
      ]
    },
    "message/facebook": {
      "description": "A Facebook post. See [Facebook's API docs](https://developers.facebook.com/docs/reference/api/post/) for reference. Facebook properties `message` and `created_time` map to event `description` and `time` respectively. Facebook attached pictures can be directly mapped to attachments. Other Facebook properties such as `link`, `source`, `privacy` are allowed.",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "string"
        },
        "from": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "id": {
              "type": "string"
            }
          },
          "required": [
            "name",
            "id"
          ]
        },
        "to": {
          "type": "object",
          "properties": {
            "data": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "id": {
                    "type": "string"
                  }
                },
                "required": [
                  "name",
                  "id"
                ]
              }
            }
          }
        },
        "message": {
          "type": "string"
        },
        "source": {
          "type": "string",
          "description": "Either a fully qualified \"URL\" for an external source or a \"filename\" for a Flash Movie or Video attached to this event."
        },
        "properties": {
          "type": "string",
          "description": "Relative to `source`: a list of properties for an uploaded video, for example, the length of the video.",
          "additionalProperties": true
        },
        "picture": {
          "description": "Either a fully qualified \"URL\" for an external picture or a \"filename\" for a picture attached to this event.",
          "type": "string"
        },
        "status-type": {
          "description": "One of mobile_status_update, created_note, added_photos, added_video, shared_story, created_group, created_event, wall_post, app_created_story, published_story, tagged_in_photo, approved_friend",
          "type": "string"
        }
      },
      "required": [
        "id",
        "message"
      ]
    },
    "message/twitter": {
      "description": "A Twitter post. Twitter property `created_at` maps to event `time`. Other Twitter properties (see [Twitter's API docs](https://dev.twitter.com/docs/api/1.1/get/statuses/show/%3Aid)) are allowed.",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "string"
        },
        "screen-name": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      },
      "required": [
        "id",
        "screen-name",
        "text"
      ]
    },
    "money/aed": {
      "type": "number"
    },
    "money/ang": {
      "type": "number",
      "description": "Netherlands Antilles Guilder"
    },
    "money/ars": {
      "type": "number",
      "description": "Argentina Peso"
    },
    "money/aud": {
      "type": "number",
      "description": "Australia Dollar"
    },
    "money/bgn": {
      "type": "number",
      "description": "Bulgaria Lev"
    },
    "money/bhd": {
      "type": "number"
    },
    "money/bnd": {
      "type": "number",
      "description": "Brunei Darussalam Dollar"
    },
    "money/bob": {
      "type": "number",
      "description": "Bolivia Boliviano"
    },
    "money/brl": {
      "type": "number",
      "description": "Brazil Real"
    },
    "money/bwp": {
      "type": "number",
      "description": "Botswana Pula"
    },
    "money/cad": {
      "type": "number",
      "description": "Canada Dollar"
    },
    "money/chf": {
      "type": "number",
      "description": "Switzerland Franc"
    },
    "money/clp": {
      "type": "number",
      "description": "Chile Peso"
    },
    "money/cny": {
      "type": "number",
      "description": "China Yuan Renminbi"
    },
    "money/cop": {
      "type": "number",
      "description": "Colombia Peso"
    },
    "money/crc": {
      "type": "number",
      "description": "Costa Rica Colon"
    },
    "money/czk": {
      "type": "number",
      "description": "Czech Republic Koruna"
    },
    "money/dkk": {
      "type": "number",
      "description": "Denmark Krone"
    },
    "money/dop": {
      "type": "number",
      "description": "Dominican Republic Peso"
    },
    "money/dzd": {
      "type": "number"
    },
    "money/eek": {
      "type": "number",
      "description": "Estonia Kroon"
    },
    "money/egp": {
      "type": "number",
      "description": "Egypt Pound"
    },
    "money/eur": {
      "type": "number",
      "description": "Euro"
    },
    "money/fjd": {
      "type": "number",
      "description": "Fiji Dollar"
    },
    "money/gbp": {
      "type": "number",
      "description": "United Kingdom Pound"
    },
    "money/hkd": {
      "type": "number",
      "description": "Hong Kong Dollar"
    },
    "money/hnl": {
      "type": "number",
      "description": "Honduras Lempira"
    },
    "money/hrk": {
      "type": "number",
      "description": "Croatia Kuna"
    },
    "money/huf": {
      "type": "number",
      "description": "Hungary Forint"
    },
    "money/idr": {
      "type": "number",
      "description": "Indonesia Rupiah"
    },
    "money/ils": {
      "type": "number",
      "description": "Israel Shekel"
    },
    "money/inr": {
      "type": "number",
      "description": "India Rupee"
    },
    "money/jmd": {
      "type": "number",
      "description": "Jamaica Dollar"
    },
    "money/jod": {
      "type": "number"
    },
    "money/jpy": {
      "type": "number",
      "description": "Japan Yen"
    },
    "money/kes": {
      "type": "number"
    },
    "money/krw": {
      "type": "number",
      "description": "Korea (South) Won"
    },
    "money/kwd": {
      "type": "number"
    },
    "money/kyd": {
      "type": "number",
      "description": "Cayman Islands Dollar"
    },
    "money/kzt": {
      "type": "number",
      "description": "Kazakhstan Tenge"
    },
    "money/lbp": {
      "type": "number",
      "description": "Lebanon Pound"
    },
    "money/lkr": {
      "type": "number",
      "description": "Sri Lanka Rupee"
    },
    "money/ltl": {
      "type": "number",
      "description": "Lithuania Litas"
    },
    "money/lvl": {
      "type": "number",
      "description": "Latvia Lat"
    },
    "money/mad": {
      "type": "number"
    },
    "money/mdl": {
      "type": "number"
    },
    "money/mkd": {
      "type": "number",
      "description": "Macedonia Denar"
    },
    "money/mur": {
      "type": "number",
      "description": "Mauritius Rupee"
    },
    "money/mxn": {
      "type": "number",
      "description": "Mexico Peso"
    },
    "money/myr": {
      "type": "number",
      "description": "Malaysia Ringgit"
    },
    "money/nad": {
      "type": "number",
      "description": "Namibia Dollar"
    },
    "money/ngn": {
      "type": "number",
      "description": "Nigeria Naira"
    },
    "money/nio": {
      "type": "number",
      "description": "Nicaragua Cordoba"
    },
    "money/nok": {
      "type": "number",
      "description": "Norway Krone"
    },
    "money/npr": {
      "type": "number",
      "description": "Nepal Rupee"
    },
    "money/nzd": {
      "type": "number",
      "description": "New Zealand Dollar"
    },
    "money/omr": {
      "type": "number",
      "description": "Oman Rial"
    },
    "money/pen": {
      "type": "number",
      "description": "Peru Nuevo Sol"
    },
    "money/pgk": {
      "type": "number"
    },
    "money/php": {
      "type": "number",
      "description": "Philippines Peso"
    },
    "money/pkr": {
      "type": "number",
      "description": "Pakistan Rupee"
    },
    "money/pln": {
      "type": "number",
      "description": "Poland Zloty"
    },
    "money/pyg": {
      "type": "number",
      "description": "Paraguay Guarani"
    },
    "money/qar": {
      "type": "number",
      "description": "Qatar Riyal"
    },
    "money/ron": {
      "type": "number",
      "description": "Romania New Leu"
    },
    "money/rsd": {
      "type": "number",
      "description": "Serbia Dinar"
    },
    "money/rub": {
      "type": "number",
      "description": "Russia Ruble"
    },
    "money/sar": {
      "type": "number",
      "description": "Saudi Arabia Riyal"
    },
    "money/scr": {
      "type": "number",
      "description": "Seychelles Rupee"
    },
    "money/sek": {
      "type": "number",
      "description": "Sweden Krona"
    },
    "money/sgd": {
      "type": "number",
      "description": "Singapore Dollar"
    },
    "money/skk": {
      "type": "number"
    },
    "money/sll": {
      "type": "number"
    },
    "money/svc": {
      "type": "number",
      "description": "El Salvador Colon"
    },
    "money/thb": {
      "type": "number",
      "description": "Thailand Baht"
    },
    "money/tnd": {
      "type": "number"
    },
    "money/try": {
      "type": "number",
      "description": "Turkey Lira"
    },
    "money/ttd": {
      "type": "number",
      "description": "Trinidad and Tobago Dollar"
    },
    "money/twd": {
      "type": "number",
      "description": "Taiwan New Dollar"
    },
    "money/tzs": {
      "type": "number"
    },
    "money/uah": {
      "type": "number",
      "description": "Ukraine Hryvna"
    },
    "money/ugx": {
      "type": "number"
    },
    "money/usd": {
      "type": "number",
      "description": "United States Dollar"
    },
    "money/uyu": {
      "type": "number",
      "description": "Uruguay Peso"
    },
    "money/uzs": {
      "type": "number",
      "description": "Uzbekistan Som"
    },
    "money/vnd": {
      "type": "number",
      "description": "Viet Nam Dong"
    },
    "money/yer": {
      "type": "number",
      "description": "Yemen Rial"
    },
    "money/zar": {
      "type": "number",
      "description": "South Africa Rand"
    },
    "money/zmk": {
      "type": "number"
    },
    "money/btc": {
      "description": "Bitcoin",
      "type": "number"
    },
    "money/all": {
      "description": "Albania Lek",
      "type": "number"
    },
    "money/afn": {
      "description": "Afghanistan Afghani",
      "type": "number"
    },
    "money/awg": {
      "description": "Aruba Guilder",
      "type": "number"
    },
    "money/azn": {
      "description": "Azerbaijan New Manat",
      "type": "number"
    },
    "money/bsd": {
      "description": "Bahamas Dollar",
      "type": "number"
    },
    "money/bbd": {
      "description": "Barbados Dollar",
      "type": "number"
    },
    "money/byr": {
      "description": "Belarus Ruble",
      "type": "number"
    },
    "money/bzd": {
      "description": "Belize Dollar",
      "type": "number"
    },
    "money/bmd": {
      "description": "Bermuda Dollar",
      "type": "number"
    },
    "money/bam": {
      "description": "Bosnia and Herzegovina Convertible Marka",
      "type": "number"
    },
    "money/khr": {
      "description": "Cambodia Riel",
      "type": "number"
    },
    "money/cup": {
      "description": "Cuba Peso",
      "type": "number"
    },
    "money/xcd": {
      "description": "East Caribbean Dollar",
      "type": "number"
    },
    "money/fkp": {
      "description": "Falkland Islands (Malvinas) Pound",
      "type": "number"
    },
    "money/ghc": {
      "description": "Ghana Cedis",
      "type": "number"
    },
    "money/gip": {
      "description": "Gibraltar Pound",
      "type": "number"
    },
    "money/gtq": {
      "description": "Guatemala Quetzal",
      "type": "number"
    },
    "money/ggp": {
      "description": "Guernsey Pound",
      "type": "number"
    },
    "money/gyd": {
      "description": "Guyana Dollar",
      "type": "number"
    },
    "money/isk": {
      "description": "Iceland Krona",
      "type": "number"
    },
    "money/irr": {
      "description": "Iran Rial",
      "type": "number"
    },
    "money/imp": {
      "description": "Isle of Man Pound",
      "type": "number"
    },
    "money/jep": {
      "description": "Jersey Pound",
      "type": "number"
    },
    "money/kpw": {
      "description": "Korea (North) Won",
      "type": "number"
    },
    "money/kgs": {
      "description": "Kyrgyzstan Som",
      "type": "number"
    },
    "money/lak": {
      "description": "Laos Kip",
      "type": "number"
    },
    "money/lrd": {
      "description": "Liberia Dollar",
      "type": "number"
    },
    "money/mnt": {
      "description": "Mongolia Tughrik",
      "type": "number"
    },
    "money/mzn": {
      "description": "Mozambique Metical",
      "type": "number"
    },
    "money/pab": {
      "description": "Panama Balboa",
      "type": "number"
    },
    "money/shp": {
      "description": "Saint Helena Pound",
      "type": "number"
    },
    "money/sbd": {
      "description": "Solomon Islands Dollar",
      "type": "number"
    },
    "money/sos": {
      "description": "Somalia Shilling",
      "type": "number"
    },
    "money/srd": {
      "description": "Suriname Dollar",
      "type": "number"
    },
    "money/syp": {
      "description": "Syria Pound",
      "type": "number"
    },
    "money/trl": {
      "description": "Turkey Lira",
      "type": "number"
    },
    "money/tvd": {
      "description": "Tuvalu Dollar",
      "type": "number"
    },
    "money/vef": {
      "description": "Venezuela Bolivar",
      "type": "number"
    },
    "money/zwd": {
      "description": "Zimbabwe Dollar",
      "type": "number"
    },
    "mood/rating": {
      "description": "Rating of mood (float value) 0:worst -> 1:best",
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "mood/emoticon": {
      "description": "ASCII Art emoticon",
      "type": "string"
    },
    "music/basic": {
      "description": "Inspired from id3 key/pair",
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "artist": {
          "type": "string"
        },
        "album": {
          "type": "string"
        },
        "track": {
          "type": "integer"
        },
        "year": {
          "type": "integer"
        },
        "genre": {
          "type": "string"
        }
      }
    },
    "music/soundcloud": {
      "description": "See [Soundcloud track properties](http://developers.soundcloud.com/docs/api/reference#tracks).",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "id": {
          "type": "integer"
        }
      },
      "required": [
        "id"
      ]
    },
    "note/html": {
      "description": "An HTML-formatted note.",
      "type": "string",
      "maxLength": 4194304
    },
    "note/txt": {
      "description": "A plain-text note.",
      "type": "string",
      "maxLength": 4194304
    },
    "note/webclip": {
      "description": "An HTML-formatted note associated to its source URL.",
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "pattern": "^(https?)://.+$"
        },
        "content": {
          "description": "An HTML-formatted string.",
          "type": "string",
          "maxLength": 4194304
        }
      },
      "required": [
        "url"
      ]
    },
    "numset/*": {
      "description": "The format key is freely defined.\n\nFor example, a heart measurement with type `numset/heart` and content:\n```\n{ \n  \"systolic\": { \"pressure/mmhg\": 105 },\n  \"diastolic\": { \"pressure/mmhg\": 64 },\n  \"rate\": { \"frequency/bpm\": 88 }\n}\n```\n\n ",
      "type": "object",
      "patternProperties": {
        "^(/[^/]+)+$": {
          "type": "number"
        }
      },
      "additionalProperties": "false",
      "required": []
    },
    "picture/base64": {
      "description": "The picture is caried in base64 (utf-8) encoded in string",
      "type": "string",
      "properties": {
        "payload": {
          "type": "string",
          "description": "base64 encoded content"
        },
        "format": {
          "type": "string",
          "description": "The data format \"gif\", \"jpeg\", \"png\", \"tiff\", \"vnd.microsoft.com\", \"svg+xml\""
        },
        "filename": {
          "description": "A filename",
          "type": "string"
        }
      },
      "required": [
        "payload",
        "format"
      ]
    },
    "picture/attached": {
      "description": "The picture is the image file attached to the event (no explicit content defined). TODO: list accepted formats.",
      "type": "null",
      "attachmentRequired": true
    },
    "picture/url": {
      "description": "A reference to a picture file online.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "position/wgs84": {
      "description": "The latest revision of the World Geodetic System (used by GPS).",
      "type": "object",
      "properties": {
        "latitude": {
          "type": "number",
          "description": "Unit: degrees north from the equator."
        },
        "longitude": {
          "type": "number",
          "description": "Unit: degrees east from the zero meridian."
        },
        "altitude": {
          "type": "number",
          "description": "Unit: meters above sea level."
        },
        "horizontalAccuracy": {
          "type": "number",
          "description": "The radius of uncertainty for latitude and longitude. Unit: meters. Negative if latitude and longitude are invalid."
        },
        "verticalAccuracy": {
          "type": "number",
          "description": "The radius of uncertainty for altitude. Unit: meters. Negative if altitude is invalid."
        },
        "speed": {
          "type": "number",
          "description": "For informational purposes only. Unit: meters / second. Negative if invalid."
        },
        "bearing": {
          "type": "number",
          "description": "Unit: degrees clockwise from north. Negative if invalid."
        }
      },
      "required": [
        "latitude",
        "longitude"
      ]
    },
    "ratio/generic": {
      "description": "Generic ratio.",
      "type": "object",
      "properties": {
        "value": {
          "type": "number"
        },
        "relativeTo": {
          "type": "number"
        }
      },
      "required": [
        "value",
        "relativeTo"
      ]
    },
    "ratio/percent": {
      "description": "A percentage value.",
      "type": "number"
    },
    "url/http": {
      "description": "An HTTP or HTTPS resource.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "video/attached": {
      "description": "The video is the file attached to the event (no explicit content defined). TODO: list accepted formats.",
      "type": "null",
      "attachmentRequired": true
    },
    "video/url": {
      "description": "A reference to an video file online.",
      "type": "string",
      "pattern": "^(https?)://.+$"
    },
    "video/vimeo": {
      "description": "A Vimeo video ID.",
      "type": "string"
    },
    "video/youtube": {
      "description": "A YouTube video ID.",
      "type": "string"
    },
    "absorbed-dose/gy": {
      "description": "Gray",
      "type": "number"
    },
    "absorbed-dose-equivalent/sv": {
      "description": "Sievert",
      "type": "number"
    },
    "absorbed-dose-rate/gy-s": {
      "description": "Gray per second",
      "type": "number"
    },
    "angle/deg": {
      "description": "Degrees",
      "type": "number"
    },
    "angle/grad": {
      "description": "Grade",
      "type": "number"
    },
    "angle/rad": {
      "description": "Radians",
      "type": "number"
    },
    "angular-acceleration/rad-s2": {
      "description": "Radians per second squared",
      "type": "number"
    },
    "angular-speed/rad-s": {
      "description": "Radians per second",
      "type": "number"
    },
    "area/ac": {
      "description": "Acres (imperial)",
      "type": "number"
    },
    "area/ft2": {
      "description": "Square feet",
      "type": "number"
    },
    "area/ha": {
      "description": "Hectares",
      "type": "number"
    },
    "area/in2": {
      "description": "Square inches",
      "type": "number"
    },
    "area/km2": {
      "description": "Square kilometers",
      "type": "number"
    },
    "area/m2": {
      "description": "Square meter",
      "type": "number"
    },
    "area/mm2": {
      "description": "Square millimeters",
      "type": "number"
    },
    "area/yd2": {
      "description": "Square yards",
      "type": "number"
    },
    "area/mi2": {
      "description": "Square miles",
      "type": "number"
    },
    "capacitance/f": {
      "description": "Farad",
      "type": "number"
    },
    "catalytic-activity/kat": {
      "description": "Katal",
      "type": "number"
    },
    "count/steps": {
      "description": "Number of steps",
      "type": "number"
    },
    "count/generic": {
      "description": "For general items that demand no particular handling.",
      "type": "number"
    },
    "data-quantity/b": {
      "description": "Bytes",
      "type": "number"
    },
    "data-quantity/bits": {
      "description": "Bits",
      "type": "number"
    },
    "data-quantity/gb": {
      "description": "Gigabytes",
      "type": "number"
    },
    "data-quantity/gbits": {
      "description": "Gigabits",
      "type": "number"
    },
    "data-quantity/kb": {
      "description": "Kilobytes",
      "type": "number"
    },
    "data-quantity/kbits": {
      "description": "Kilobits",
      "type": "number"
    },
    "data-quantity/mb": {
      "description": "Megabytes",
      "type": "number"
    },
    "data-quantity/mbits": {
      "description": "Megabits",
      "type": "number"
    },
    "data-quantity/tb": {
      "description": "Terabytes",
      "type": "number"
    },
    "density/g-dl": {
      "description": "Grams per deciliter",
      "type": "number"
    },
    "density/kg-m3": {
      "description": "Kilograms per cubic meter",
      "type": "number"
    },
    "density/mmol-l": {
      "description": "Millimoles per liter",
      "type": "number"
    },
    "density/mg-dl": {
      "description": "Milligrams per deciliter",
      "type": "number"
    },
    "dynamic-viscosity/pa-s": {
      "description": "Pascal second",
      "type": "number"
    },
    "electric-charge/c": {
      "description": "Coulomb ",
      "type": "number"
    },
    "electric-charge-line-density/c-m": {
      "description": "Coulomb per meter",
      "type": "number"
    },
    "electric-current/a": {
      "description": "Ampere",
      "type": "number"
    },
    "electrical-conductivity/s": {
      "description": "Siemens",
      "type": "number"
    },
    "electromotive-force/v": {
      "description": "Volt",
      "type": "number"
    },
    "energy/btu": {
      "description": "British Thermal Units",
      "type": "number"
    },
    "energy/cal": {
      "description": "Calories",
      "type": "number"
    },
    "energy/ev": {
      "description": "Electron-Volts",
      "type": "number"
    },
    "energy/erg": {
      "description": "Ergs",
      "type": "number"
    },
    "energy/ftlb": {
      "description": "Foot-Pounds",
      "type": "number"
    },
    "energy/j": {
      "description": "Joules",
      "type": "number"
    },
    "energy/kcal": {
      "description": "Kilo-calories",
      "type": "number"
    },
    "energy/ws": {
      "description": "Watt-seconds",
      "type": "number"
    },
    "energy/kwh": {
      "description": "Kilowatt-hours",
      "type": "number"
    },
    "energy/nm": {
      "description": "Newton-meters",
      "type": "number"
    },
    "energy/wh": {
      "description": "Watt-hours",
      "type": "number"
    },
    "force/dyn": {
      "description": "Dynes",
      "type": "number"
    },
    "force/n": {
      "description": "Newtons",
      "type": "number"
    },
    "force/pdl": {
      "description": "Poundals",
      "type": "number"
    },
    "frequency/bpm": {
      "description": "Beats per minute",
      "type": "number"
    },
    "frequency/ghz": {
      "description": "Gigahertz",
      "type": "number"
    },
    "frequency/hz": {
      "description": "Hertz (also known as cycles per second) ",
      "type": "number"
    },
    "frequency/khz": {
      "description": "Kilohertz",
      "type": "number"
    },
    "frequency/megahz": {
      "description": "Megahertz",
      "type": "number"
    },
    "frequency/millihz": {
      "description": "Millihertz",
      "type": "number"
    },
    "frequency/nhz": {
      "description": "Nanohertz",
      "type": "number"
    },
    "frequency/rpm": {
      "description": "Revolutions per minute",
      "type": "number"
    },
    "frequency/thz": {
      "description": "Terahertz",
      "type": "number"
    },
    "frequency/uhz": {
      "description": "Microhertz",
      "type": "number"
    },
    "length/cm": {
      "description": "Centimeters",
      "type": "number"
    },
    "length/m": {
      "description": "Meters",
      "type": "number"
    },
    "length/mm": {
      "description": "Millimeters",
      "type": "number"
    },
    "length/km": {
      "description": "Kilometers",
      "type": "number"
    },
    "length/a": {
      "description": "Ångströms",
      "type": "number"
    },
    "length/au": {
      "description": "Astronomical units",
      "type": "number"
    },
    "length/ch": {
      "description": "Chains",
      "type": "number"
    },
    "length/lea": {
      "description": "Leagues",
      "type": "number"
    },
    "length/ft": {
      "description": "Feet",
      "type": "number"
    },
    "length/in": {
      "description": "Inches",
      "type": "number"
    },
    "length/ly": {
      "description": "Light-years",
      "type": "number"
    },
    "length/mil": {
      "description": "Mil",
      "type": "number"
    },
    "length/mi": {
      "description": "Miles",
      "type": "number"
    },
    "length/fur": {
      "description": "Furlongs",
      "type": "number"
    },
    "length/nmi": {
      "description": "Miles (nautical)",
      "type": "number"
    },
    "length/p": {
      "description": "Points",
      "type": "number"
    },
    "length/pica": {
      "description": "Picas",
      "type": "number"
    },
    "length/ftm": {
      "description": "Fathoms",
      "type": "number"
    },
    "length/cb": {
      "description": "Cables",
      "type": "number"
    },
    "length/um": {
      "description": "Microns",
      "type": "number"
    },
    "length/yd": {
      "description": "Yards",
      "type": "number"
    },
    "luminous-intensity/cd": {
      "description": "Candela",
      "type": "number"
    },
    "mass/kg": {
      "description": "Kilograms",
      "type": "number"
    },
    "mass/gr": {
      "description": "Grains",
      "type": "number"
    },
    "mass/dr": {
      "description": "Drams",
      "type": "number"
    },
    "mass/g": {
      "description": "Grams",
      "type": "number"
    },
    "mass/l-t": {
      "description": "Long tons",
      "type": "number"
    },
    "mass/lb": {
      "description": "Pounds",
      "type": "number"
    },
    "mass/t": {
      "description": "Metric tons",
      "type": "number"
    },
    "mass/oz": {
      "description": "Ounces",
      "type": "number"
    },
    "mass/s-t": {
      "description": "Short tons",
      "type": "number"
    },
    "mass/st": {
      "description": "Stone",
      "type": "number"
    },
    "mol/mol": {
      "description": "Mole ",
      "type": "number"
    },
    "mol/lb-mol": {
      "description": "Pound-mole.",
      "type": "number"
    },
    "power/btu-min": {
      "description": "BTUs/minute",
      "type": "number"
    },
    "power/ftlb-s": {
      "description": "Foot-pounds/second",
      "type": "number"
    },
    "power/hp": {
      "description": "Horsepower",
      "type": "number"
    },
    "power/kw": {
      "description": "Kilowatts",
      "type": "number"
    },
    "power/w": {
      "description": "Watts",
      "type": "number"
    },
    "pressure/at": {
      "description": "Atmospheres",
      "type": "number"
    },
    "pressure/bar": {
      "description": "Bars",
      "type": "number"
    },
    "pressure/mmhg": {
      "description": "Millimeters of mercury",
      "type": "number"
    },
    "pressure/cmhg": {
      "description": "Centimeters of mercury",
      "type": "number"
    },
    "pressure/inhg": {
      "description": "Inches of mercury",
      "type": "number"
    },
    "pressure/kg-m2": {
      "description": "Kilograms/square meter",
      "type": "number"
    },
    "pressure/pa": {
      "description": "Pascals",
      "type": "number"
    },
    "pressure/kpa": {
      "description": "Kilo pascals",
      "type": "number"
    },
    "pressure/psf": {
      "description": "Pounds/square foot",
      "type": "number"
    },
    "pressure/psi": {
      "description": "Pounds/square inch",
      "type": "number"
    },
    "speed/ft-m": {
      "description": "Feet/minute",
      "type": "number"
    },
    "speed/ft-s": {
      "description": "Feet/second",
      "type": "number"
    },
    "speed/km-h": {
      "description": "Kilometers/hour",
      "type": "number"
    },
    "speed/kt": {
      "description": "Knots",
      "type": "number"
    },
    "speed/m-min": {
      "description": "Miles/minute",
      "type": "number"
    },
    "speed/m-s": {
      "description": "Meters/second",
      "type": "number"
    },
    "speed/mph": {
      "description": "Miles/hour",
      "type": "number"
    },
    "temperature/c": {
      "description": "Celsius",
      "type": "number"
    },
    "temperature/k": {
      "description": "Kelvin",
      "type": "number"
    },
    "temperature/f": {
      "description": "Fahrenheit",
      "type": "number"
    },
    "time/d": {
      "description": "Days",
      "type": "number"
    },
    "time/h": {
      "description": "Hours",
      "type": "number"
    },
    "time/min": {
      "description": "Minutes",
      "type": "number"
    },
    "time/ms": {
      "description": "Milliseconds",
      "type": "number"
    },
    "time/s": {
      "description": "Seconds",
      "type": "number"
    },
    "time/y": {
      "description": "Years",
      "type": "number"
    },
    "volume/l": {
      "description": "Liters",
      "type": "number"
    },
    "volume/m3": {
      "description": "Cubic meters",
      "type": "number"
    },
    "volume/c": {
      "description": "Cups",
      "type": "number"
    },
    "volume/cm3": {
      "description": "Cubic centimeters",
      "type": "number"
    },
    "volume/floz": {
      "description": "Fluid ounces",
      "type": "number"
    },
    "volume/ft3": {
      "description": "Cubic feet",
      "type": "number"
    },
    "volume/galgb": {
      "description": "Gallons imperial",
      "type": "number"
    },
    "volume/galus": {
      "description": "Gallons US",
      "type": "number"
    },
    "volume/in3": {
      "description": "Cubic inches",
      "type": "number"
    },
    "volume/yd3": {
      "description": "Cubic yard",
      "type": "number"
    },
    "volume/ml": {
      "description": "Milliliters",
      "type": "number"
    },
    "volume/pt": {
      "description": "Pints",
      "type": "number"
    },
    "volume/qt": {
      "description": "Quarts",
      "type": "number"
    },
    "volume/bbloil": {
      "description": "Barrels (oil)",
      "type": "number"
    },
    "volume/tbs": {
      "description": "Tablespoons",
      "type": "number"
    },
    "volume/tsp": {
      "description": "Teaspoons",
      "type": "number"
    }
  }
}
},{}],63:[function(require,module,exports){
var utility = require('./utility/utility'),
    _ = require('underscore');

/**
 * Event types directory data.
 * @link http://api.pryv.com/event-types/
 */
var eventTypes = module.exports = {};

// staging cloudfront: https://d1kp76srklnnah.cloudfront.net/dist/data-types/event-extras.json
// staging direct: https://sw.pryv.li/dist/data-types/event-extras.json
var HOSTNAME = 'd1kp76srklnnah.cloudfront.net',
    PATH = '/dist/data-types/',
    FLATFILE = 'flat.json',
    EXTRASFILE = 'extras.json',
    // TODO: discuss if hierarchical data is really needed (apparently not); remove all that if not
    HIERARCHICALFILE = 'hierarchical.json';

// load default data (fallback)
var types = require('./event-types.default.json'),
    extras = require('./event-extras.default.json'),
    hierarchical = null;
types.isDefault = true;
extras.isDefault = true;

/**
 * @link http://api.pryv.com/event-types/#json-file
 * @param {Function} callback
 */
eventTypes.loadFlat = function (callback) {
  if (! callback || typeof(callback) !== 'function') {
    callback = function () {};
  }
  requestFile(FLATFILE, function (err, result) {
    if (err) { return callback(err); }
    if (! isValidTypesFile(result)) {
      return callback(new Error('Missing or corrupt types file: "' +
                                HOSTNAME + PATH + FLATFILE + '"'));
    }
    _.extend_.extend(types, result);
    types.isDefault = false;
    callback(null, types);
  });
};

/**
 * Performs a basic check to avoid corrupt data (more smoke test than actual validation).
 * @param {Object} data
 */
function isValidTypesFile(data) {
  return data && data.version && data.types && data.types['activity/plain'];
}

eventTypes.flat = function (eventType) {
  return types.types[eventType];
};

/**
 * @link http://api.pryv.com/event-types/#json-file
 * @param {Function} callback
 */
eventTypes.loadExtras = function (callback) {
  if (! callback || typeof(callback) !== 'function') {
    callback = function () {};
  }
  requestFile(EXTRASFILE, function (err, result) {
    if (err) { return callback(err); }
    if (! isValidExtrasFile(result)) {
      return callback(new Error('Missing or corrupt extras file: "' +
                                HOSTNAME + PATH + EXTRASFILE + '"'));
    }
    _.extend_.extend(extras, result);
    extras.isDefault = false;
    callback(null, extras);
  });
};

/**
 * Performs a basic check to avoid corrupt data (more smoke test than actual validation).
 * @param {Object} data
 */
function isValidExtrasFile(data) {
  return data && data.version && data.extras && data.extras.count && data.extras.count.formats;
}

eventTypes.extras = function (eventType) {
  var parts = eventType.split('/');
  return extras.extras[parts[0]] && extras.extras[parts[0]].formats[parts[1]] ?
      extras.extras[parts[0]].formats[parts[1]] : null;
};

eventTypes.isNumerical = function (eventOrEventType) {
  if (! eventOrEventType) { return false; }
  var type;
  if (eventOrEventType.type) {
    type = eventOrEventType.type;
  } else {
    type = eventOrEventType;
  }
  var def = eventTypes.flat(type);
  return def ? def.type === 'number' : false;
};

/**
 * @link http://api.pryv.com/event-types/#json-file
 * @param {Function} callback
 */
eventTypes.loadHierarchical = function (callback) {
  if (! callback || typeof(callback) !== 'function') {
    callback = function () {};
  }
  requestFile(HIERARCHICALFILE, function (err, result) {
    if (err) { return callback(err); }
    hierarchical = result;
    hierarchical.isDefault = false;
    callback(null, hierarchical);
  });
};

eventTypes.hierarchical = function () {
  if (! hierarchical) {
    throw new Error('Load data via loadHierarchical() first');
  }
  return hierarchical;
};

/**
 * @private
 * @param fileName
 * @param callback
 */
function requestFile(fileName, callback) {
  utility.request({
    method : 'GET',
    host : HOSTNAME,
    path : PATH + fileName,
    port : 443,
    ssl : true,
    withoutCredentials: true,
    success : function (result) { callback(null, result); },
    error : function (error) { callback(error, null); }
  });
}

},{"./event-extras.default.json":61,"./event-types.default.json":62,"./utility/utility":73,"underscore":43}],64:[function(require,module,exports){
module.exports = {
  // TODO: fix singleton (see with me [sgoumaz] if needed)
  Auth: require('./auth/Auth.js'),
  Connection: require('./Connection.js'),
  Event: require('./Event.js'),
  Stream: require('./Stream.js'),
  Filter: require('./Filter.js'),

  eventTypes: require('./eventTypes.js'),
  utility: require('./utility/utility.js'),
  MESSAGES: {
    MONITOR: require('./Monitor.js').Messages
  }
};

},{"./Connection.js":44,"./Event.js":46,"./Filter.js":47,"./Monitor.js":48,"./Stream.js":49,"./auth/Auth.js":52,"./eventTypes.js":63,"./utility/utility.js":73}],65:[function(require,module,exports){
/**
 * (event)Emitter renamed to avoid confusion with prvy's events
 */


var _ = require('underscore');

var SignalEmitter = module.exports = function (messagesMap) {
  SignalEmitter.extend(this, messagesMap);
};


SignalEmitter.extend = function (object, messagesMap, name) {
  if (! name) {
    throw new Error('"name" parameter must be set');
  }
  object._signalEmitterEvents = {};
  _.each(_.values(messagesMap), function (value) {
    object._signalEmitterEvents[value] = [];
  });
  _.extend(object, SignalEmitter.prototype);
  object._signalEmitterName = name;
};


SignalEmitter.Messages = {
  /** called when a batch of changes is expected, content: <batchId> unique**/
  BATCH_BEGIN : 'beginBatch',
  /** called when a batch of changes is done, content: <batchId> unique**/
  BATCH_DONE : 'doneBatch',
  /** if an eventListener return this string, it will be removed automatically **/
  UNREGISTER_LISTENER : 'unregisterMePlease'
};

/**
 * Add an event listener
 * @param signal one of  Messages.SIGNAL.*.*
 * @param callback function(content) .. content vary on each signal.
 * If the callback returns SignalEmitter.Messages.UNREGISTER_LISTENER it will be removed
 * @return the callback function for further reference
 */
SignalEmitter.prototype.addEventListener = function (signal, callback) {
  this._signalEmitterEvents[signal].push(callback);
  return callback;
};


/**
 * remove the callback matching this signal
 */
SignalEmitter.prototype.removeEventListener = function (signal, callback) {
  for (var i = 0; i < this._signalEmitterEvents[signal].length; i++) {
    if (this._signalEmitterEvents[signal][i] === callback) {
      this._signalEmitterEvents[signal][i] = null;
    }
  }
};


/**
 * A changes occurred on the filter
 * @param signal
 * @param content
 * @param batch
 * @private
 */
SignalEmitter.prototype._fireEvent = function (signal, content, batch) {
  var batchId = batch ? batch.id : null;
  if (! signal) { throw new Error(); }

  var batchStr = batchId ? ' batch: ' + batchId + ', ' + batch.batchName : '';
  console.log('FireEvent-' + this._signalEmitterName  + ' : ' + signal + batchStr);

  _.each(this._signalEmitterEvents[signal], function (callback) {
    if (callback !== null &&
      SignalEmitter.Messages.UNREGISTER_LISTENER === callback(content, batch)) {
      this.removeEventListener(signal, callback);
    }
  }, this);
};


SignalEmitter.batchSerial = 0;
/**
 * Start a batch process
 *
 * @param batchName Name of the new batch
 * @param orHookOnBatch Existing batch to hook on ("superbatch")
 * @return A batch object (call `done()` when done)
 * @private
 */
SignalEmitter.prototype.startBatch = function (name, orHookOnBatch) {

  if (! orHookOnBatch) {
    return new Batch(name, this);
  }
  name = orHookOnBatch.name + '/' + name;
  var batch = new Batch(name, this);
  orHookOnBatch.waitForMeToFinish(name + ':hook');
  batch.addOnDoneListener(name, function () {
    orHookOnBatch.done(name + ':hook');
  });
  return batch;
};

var Batch = function (name, owner) {
  this.owner = owner;
  this.name = name || 'x';
  this.id = owner._signalEmitterName + SignalEmitter.batchSerial++;
  this.waitFor = 0;
  this.history = [];
  this.doneCallbacks = {};
  this.waitForMeToFinish(this.name);
  this.owner._fireEvent(SignalEmitter.Messages.BATCH_BEGIN, this.id, this);

};



/**
 * listener are stored in key/map fashion, so addOnDoneListener('bob',..)
 * may be called several time, callback 'bob', will be done just once
 * @param key a unique key per callback
 * @param callback
 */
Batch.prototype.addOnDoneListener = function (key, callback) {
  this.checkAlreadyDone('addOnDoneListener(' + key + ')');
  this.doneCallbacks[key] = callback;
};

Batch.prototype.waitForMeToFinish = function (key) {
  this.checkAlreadyDone('waitForMeToFinish(' + key + ')');
  this.waitFor++;
  this.history.push({wait: key, waitFor: this.waitFor});
  return this;
};

Batch.prototype.done = function (key) {
  this.checkAlreadyDone('done(' + key + ')');
  key = key || '--';
  this.waitFor--;
  this.history.push({done: key, waitFor: this.waitFor});
  if (this.waitFor === 0) {

    this.doneTriggered = true;
    _.each(this.doneCallbacks, function (callback) {
      callback();
    });
    delete this.doneCallbacks; // prevents memory leaks
    this.owner._fireEvent(SignalEmitter.Messages.BATCH_DONE, this.id, this);
  }
};

Batch.prototype.checkAlreadyDone = function (addon) {
  if (this.doneTriggered) {
    var msg = 'Batch ' + this.name + ', ' + this.id + ' called ' + addon + '  when already done';
    throw new Error(msg + '     ' + JSON.stringify(this.history));
  }
};

},{"underscore":43}],66:[function(require,module,exports){
/* jshint ignore:start */

/*\
 |*|
 |*|  :: cookies.js ::
 |*|
 |*|  A complete cookies reader/writer framework with full unicode support.
 |*|
 |*|  https://developer.mozilla.org/en-US/docs/DOM/document.cookie
 |*|
 |*|  Syntaxes:
 |*|
 |*|  * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
 |*|  * docCookies.getItem(name)
 |*|  * docCookies.removeItem(name[, path])
 |*|  * docCookies.hasItem(name)
 |*|  * docCookies.keys()
 |*|
 \*/
module.exports = {
  getItem: function (sKey) {
    if (!sKey || !this.hasItem(sKey)) { return null; }
    return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" +
        escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
  },
  setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return; }
    var sExpires = "";
    if (vEnd) {
      switch (vEnd.constructor) {
        case Number:
          sExpires = vEnd === Infinity ?
              "; expires=Tue, 19 Jan 2038 03:14:07 GMT" : "; max-age=" + vEnd;
          break;
        case String:
          sExpires = "; expires=" + vEnd;
          break;
        case Date:
          sExpires = "; expires=" + vEnd.toGMTString();
          break;
      }
    }
    document.cookie = escape(sKey) + "=" + escape(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
  },
  removeItem: function (sKey, sPath) {
    if (!sKey || !this.hasItem(sKey)) { return; }
    document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sPath ? "; path=" + sPath : "");
  },
  hasItem: function (sKey) {
    return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
  },
  keys: /* optional method: you can safely remove it! */ function () {
    var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
    for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { aKeys[nIdx] = unescape(aKeys[nIdx]); }
    return aKeys;
  }
};

},{}],67:[function(require,module,exports){
/* jshint ignore:start */

/*!
 * domready (c) Dustin Diaz 2012 - License MIT
 */
module.exports = function (ready) {


  var fns = [], fn, f = false,
      doc = document,
      testEl = doc.documentElement,
      hack = testEl.doScroll,
      domContentLoaded = 'DOMContentLoaded',
      addEventListener = 'addEventListener',
      onreadystatechange = 'onreadystatechange',
      readyState = 'readyState',
      loaded = /^loade|c/.test(doc[readyState]);

  function flush(f) {
    loaded = 1;
    while (f = fns.shift()) {
      f()
    }
  }

  doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
    doc.removeEventListener(domContentLoaded, fn, f);
    flush();
  }, f);


  hack && doc.attachEvent(onreadystatechange, fn = function () {
    if (/^c/.test(doc[readyState])) {
      doc.detachEvent(onreadystatechange, fn);
      flush();
    }
  });

  return (ready = hack ?
      function (fn) {
        self != top ?
            loaded ? fn() : fns.push(fn) :
            function () {
              console.log("on dom ready 2");
              try {
                testEl.doScroll('left')
              } catch (e) {
                return setTimeout(function() { ready(fn) }, 50)
              }
              fn()
            }()
      } :
      function (fn) {
        loaded ? fn() : fns.push(fn)
      })
}();

},{}],68:[function(require,module,exports){
/**
 * Common regexps
 * TODO: fix naming to "commonRegexps", "Username" and "Email" (they are constants)
 */
module.exports = {
  username :  /^([a-zA-Z0-9])(([a-zA-Z0-9\-]){3,21})([a-zA-Z0-9])$/,
  email : /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/
};

},{}],69:[function(require,module,exports){
/**
 *
 * @param {Object} pack json with
 * @param {Object} [pack.type = 'POST'] : 'GET/DELETE/POST/PUT'
 * @param {String} pack.host : fully qualified host name
 * @param {Number} pack.port : port to use
 * @param {String} pack.path : the request PATH
 * @param {Object} [pack.headers] : key / value map of headers
 * @param {Object} [pack.params] : the payload -- only with POST/PUT
 * @param {String} [pack.parseResult = 'json'] : 'text' for no parsing
 * @param {Function} pack.success : function (result, resultInfo)
 * @param {Function} pack.error : function (error, resultInfo)
 * @param {String} [pack.info] : a text
 * @param {Boolean} [pack.async = true]
 * @param {Number} [pack.expectedStatus] : http result code
 * @param {Boolean} [pack.ssl = true]
 * @param {Boolean} [pack.withoutCredentials = false]
 */
module.exports = function (pack)  {
  pack.info = pack.info || '';
  var parseResult = pack.parseResult || 'json';

  if (!pack.hasOwnProperty('async')) {
    pack.async = true;
  }

  // ------------ request TYPE
  pack.method = pack.method || 'POST';
  // method override test
  if (false && pack.method === 'DELETE') {
    pack.method = 'POST';
    pack.params =  pack.params || {};
    pack.params._method = 'DELETE';
  }

  // ------------- request HEADERS


  pack.headers = pack.headers || {};

  if (pack.method === 'POST' || pack.method === 'PUT') {// add json headers is POST or PUT

    if (pack.headers['Content-Type'] === 'multipart/form-data') {
      delete pack.headers['Content-Type'];
    } else {
      pack.headers['Content-Type'] =
          pack.headers['Content-Type'] || 'application/json; charset=utf-8';
    }

    //if (pack.method === 'POST') {
    if (pack.params) {
      pack.params = JSON.stringify(pack.params);
    } else {
      pack.params = pack.payload || {};
    }
  }



  // -------------- error
  pack.error = pack.error || function (error) {
    throw new Error(JSON.stringify(error, function (key, value) {
      if (value === null) { return; }
      if (value === '') { return; }
      return value;
    }, 2));
  };

  var detail = pack.info + ', req: ' + pack.method + ' ' + pack.url;

  // --------------- request
  var xhr = _initXHR(),
      httpMode = pack.ssl ? 'https://' : 'http://',
      url = httpMode + pack.host + pack.path;
  xhr.open(pack.method, url, pack.async);
  xhr.withCredentials = pack.withoutCredentials ? false : true;


  xhr.onreadystatechange = function () {
    detail += ' xhrstatus:' + xhr.statusText;
    if (xhr.readyState === 0) {
      pack.callBackSent = 'error in request';
      pack.error({
        message: 'pryvXHRCall unsent',
        detail: detail,
        id: 'INTERNAL_ERROR',
        xhr: xhr
      });
    } else if (xhr.readyState === 4) {
      var result = null;

      if (parseResult === 'json') {
        var response = xhr.responseText;
        response = response.trim() === '' ? '{}' : response;
        try { result = JSON.parse(response); } catch (e) {
          return pack.error({
            message: 'Data is not JSON',
            detail: xhr.responseText + '\n' + detail,
            id: 'RESULT_NOT_JSON',
            xhr: xhr
          });
        }
      }
      var resultInfo = {
        xhr : xhr,
        code : xhr.status,
        headers : parseResponseHeaders(xhr.getAllResponseHeaders())
      };

      if (pack.callBackSent) {
        console.error('xhr.onreadystatechange called with status==4 even if callback is done:' +
          pack.callBackSent);
        return;
      }
      pack.callBackSent = 'success';
      pack.success(result, resultInfo);
    }
  };
  if (pack.progressCallback && typeof(pack.progressCallback) === 'function') {
    xhr.upload.addEventListener('progress', function (e) {
      return pack.progressCallback(e);
    }, false);
  }
  for (var key in pack.headers) {
    if (pack.headers.hasOwnProperty(key)) {
      xhr.setRequestHeader(key, pack.headers[key]);
    }
  }

  //--- sending the request
  try {
    xhr.send(pack.params);
  } catch (e) {
    pack.callBackSent = 'error sending request';
    return pack.error({
      message: 'pryvXHRCall unsent',
      detail: detail,
      id: 'INTERNAL_ERROR',
      error: e,
      xhr: xhr
    });
  }
  return xhr;
};

/**
 * Method to initialize XMLHttpRequest.
 * @method _initXHR
 * @access private
 * @return object
 */
/* jshint -W117 */
var _initXHR = function () {
  var XHR = null;

  try { XHR = new XMLHttpRequest(); }
  catch (e) {
    try { XHR = new ActiveXObject('Msxml2.XMLHTTP'); }
    catch (e2) {
      try { XHR = new ActiveXObject('Microsoft.XMLHTTP'); }
      catch (e3) {
        console.log('XMLHttpRequest implementation not found.');
      }
      console.log('XMLHttpRequest implementation not found.');
    }
    console.log('XMLHttpRequest implementation not found.');
  }
  return XHR;
};


/**
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
  var headers = {};
  if (!headerStr) {
    return headers;
  }
  var headerPairs = headerStr.split('\u000d\u000a');
  for (var i = 0; i < headerPairs.length; i++) {
    var headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    var index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      var key = headerPair.substring(0, index).toLowerCase();
      var val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}

},{}],70:[function(require,module,exports){
/* global document */

var urls = module.exports = {};

/**
 * The one and only reference for Pryv domain names.
 * TODO: client and server will merge
 */
urls.domains = {
  client: {
    production: 'pryv.me',
    staging: 'pryv.li',
    test: 'rec.la'
  },
  server: {
    production: 'pryv.io',
    staging: 'pryv.in',
    test: 'pryv.in'
  }
};

/**
 * Detects the Pryv environment from the given domain and client/server indication.
 *
 * @param {string} domain
 * @param {string} type "client" or "server"
 * @returns {string} "production", "staging" or "other"
 */
urls.getEnvironment = function (domain, type) {
  var domains = this.domains[type];
  if (! type || ! domains) {
    throw new Error('Invalid type "' + type + '"; expected "client" or "server"');
  }

  switch (domain) {
  case domains.production:
    return 'production';
  case domains.staging:
    return 'staging';
  case domains.test:
    return 'test';
  default:
    return 'other';
  }
};

/* jshint -W101 */
/**
 * Extracts base components from a browser URL string
 * (e.g. today: "https://username.pryv.me:443/some/path").
 *
 * @param url Defaults to `document.location` if available
 * @returns {URLInfo}
 */
urls.parseClientURL = function (url) {
  return new URLInfo(url, 'client');
};

/**
 * Extracts base components from a standard Pryv API URL string
 * (e.g. "https://username.pryv.io:443/some/path").
 *
 * @param url
 * @returns {URLInfo}
 */
urls.parseServerURL = function (url) {
  return new URLInfo(url, 'server');
};

/**
 * @param {String} url
 * @param {String} type "client" or "server"
 * @constructor
 */
function URLInfo(url, type) {
  var loc;
  if (document) {
    // browser
    if (url) {
      loc = document.createElement('a');
      loc.href = url;
    } else {
      loc = document.location;
    }
  } else {
    // node
    if (! url) {
      throw new Error('`url` is required');
    }
    loc = require('url').parse(url);
  }
  if (! (type === 'client' || type === 'server')) {
    throw new Error('`type` must be either "client" or "server"');
  }
  this.type = type;

  this.protocol = loc.protocol;
  this.hostname = loc.hostname;
  this.port = loc.port || (this.protocol === 'https:' ? 443 : 80);
  this.path = loc.pathname;
  this.hash = loc.hash;
  this.search = loc.search;

  var splitHostname = loc.hostname.split('.');
  if (splitHostname.length >= 3 /* TODO: check & remove, shouldn't be necessary && splitHostname[0].match(this.regex.username)*/) {
    this.subdomain = splitHostname[0];
  }
  this.domain = loc.hostname.substr(loc.hostname.indexOf('.') + 1);

  this.environment = urls.getEnvironment(this.domain, this.type);

  // if known environment, extract username
  // (we currently assume username === subdomain; this will change for client URLs)
  if (this.subdomain && this.environment !== 'other') {
    this.username = this.subdomain;
  }
}

URLInfo.prototype.isSSL = function () {
  return this.protocol === 'https:';
};

URLInfo.prototype.parseQuery = function () {
  var objURL = {};
  this.search.replace(new RegExp('([^?=&]+)(=([^&]*))?', 'g'), function ($0, $1, $2, $3) {
    objURL[$1] = $3;
  });
  return objURL;
};

URLInfo.prototype.parseSharingTokens = function () {
  if (this.type !== 'client') {
    throw new Error('Can only parse on client URLs');
  }
  var splitPath = this.hash.split('/');
  var sharingsIndex = splitPath.indexOf('sharings');
  if (sharingsIndex !== -1) {
    return splitPath.splice(sharingsIndex + 1).filter(function (s) { return s.length > 0; });
  } else {
    return [];
  }
};

},{"url":39}],71:[function(require,module,exports){
/* global document, navigator */

/**
 * Browser-only utils
 */
var utility = module.exports = {};

utility.getHostFromUrl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.hostname;
};

utility.getPortFromUrl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.port === '' ? null : location.port;
};

utility.isUrlSsl = function (url) {
  var location;
  if (url) {
    location = document.createElement('a');
    location.href = url;
  } else {
    location = document.location;
  }
  return location.protocol === 'https:';
};

/**
 *  List grabbed from
 *  https://github.com/codefuze/js-mobile-tablet-redirect/blob/master/mobile-redirect.js
 *
 *  @return {Boolean} `true` if browser is seen as a mobile or tablet
 */
utility.browserIsMobileOrTablet = function () {
  /* jshint -W101*/
  return (/iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec|ipad|android 3|sch-i800|playbook|tablet|kindle|gt-p1000|sgh-t849|shw-m180s|a510|a511|a100|dell streak|silk/i.test(navigator.userAgent.toLowerCase()));
};

/**
 * Method to get the preferred language, either from desiredLanguage or from the browser settings
 * @method getPreferredLanguage
 * @param {Array} supportedLanguages an array of supported languages encoded on 2characters
 * @param {String} desiredLanguage (optional) get this language if supported
 */
utility.getPreferredLanguage = function (supportedLanguages, desiredLanguage) {
  if (desiredLanguage) {
    if (supportedLanguages.indexOf(desiredLanguage) >= 0) { return desiredLanguage; }
  }
  var lct = null;
  if (navigator.language) {
    lct = navigator.language.toLowerCase().substring(0, 2);
  } else if (navigator.userLanguage) {
    lct = navigator.userLanguage.toLowerCase().substring(0, 2);
  } else if (navigator.userAgent.indexOf('[') !== -1) {
    var start = navigator.userAgent.indexOf('[');
    var end = navigator.userAgent.indexOf(']');
    lct = navigator.userAgent.substring(start + 1, end).toLowerCase();
  }
  if (desiredLanguage) {
    if (lct.indexOf(desiredLanguage) >= 0) { return lct; }
  }

  return supportedLanguages[0];
};


/**
 * //TODO check if it's robust
 * Method to check the browser supports CSS3.
 * @method supportCSS3
 * @return boolean
 */
utility.supportCSS3 = function ()  {
  var stub = document.createElement('div'),
    testProperty = 'textShadow';

  if (testProperty in stub.style) { return true; }

  testProperty = testProperty.replace(/^[a-z]/, function (val) {
    return val.toUpperCase();
  });

  return false;
};

/**
 * Method to load external files like javascript and stylesheet. this version
 * of method only support to file types - js|javascript and css|stylesheet.
 *
 * @method loadExternalFiles
 * @param {String} filename
 * @param {String} type 'js' or 'css'
 */
utility.loadExternalFiles = function (filename, type)  {
  var tag = null;

  type = type.toLowerCase();

  if (type === 'js' || type === 'javascript') {
    tag = document.createElement('script');
    tag.setAttribute('type', 'text/javascript');
    tag.setAttribute('src', filename);
  } else if (type === 'css' || type === 'stylesheet')  {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'stylesheet');
    tag.setAttribute('type', 'text/css');
    tag.setAttribute('href', filename);
  }

  if (tag !== null || tag !== undefined) {
    document.getElementsByTagName('head')[0].appendChild(tag);
  }
};

utility.docCookies = require('./docCookies');

utility.domReady = require('./domReady');

utility.request = require('./request-browser');

},{"./docCookies":66,"./domReady":67,"./request-browser":69}],72:[function(require,module,exports){
/**
 * Node-only utils
 */
var FormData = require('form-data');

var utility = module.exports = {};

utility.request = require('./request-node');


/**
 * Create or complete FormData object for attachements
 * @param id {String} id of the element to add (may be 'attachment0')
 * @param data {Data} the data to send
 * @param options {Object}
 * @param options.filename {String}
 * @param options.type {String}
 */
utility.forgeFormData = function (id, data, options, appendTo) {
  var formData = appendTo || new FormData();
  formData.append(id, data, options);
  return formData;
};
},{"./request-node":6,"form-data":2}],73:[function(require,module,exports){
var socketIO = require('socket.io-client'),
    _ = require('underscore');

var utility = module.exports = {};

/**
 * @returns {Boolean} `true` if we're in a web browser environment
 */
utility.isBrowser = function () {
  return typeof(window) !== 'undefined';
};

utility.SignalEmitter = require('./SignalEmitter.js');

/**
 * Merges two object (key/value map) and remove "null" properties
 *
 * @param {Object} sourceA
 * @param {Object} sourceB
 * @returns {*|Block|Node|Tag}
 */
utility.mergeAndClean = function (sourceA, sourceB) {
  sourceA = sourceA || {};
  sourceB = sourceB || {};
  var result = _.clone(sourceA);
  _.extend(result, sourceB);
  _.each(_.keys(result), function (key) {
    if (result[key] === null) { delete result[key]; }
  });
  return result;
};

/**
 * Creates a query string from an object (key/value map)
 *
 * @param {Object} data
 * @returns {String} key1=value1&key2=value2....
 */
utility.getQueryParametersString = function (data) {
  data = this.mergeAndClean(data);
  return Object.keys(data).map(function (key) {
    if (data[key] !== null) {
      if (_.isArray(data[key])) {
        data[key] = this.mergeAndClean(data[key]);
        var keyE = encodeURIComponent(key + '[]');
        return data[key].map(function (subData) {
          return keyE + '=' + encodeURIComponent(subData);
        }).join('&');
      } else {
        return encodeURIComponent(key) + '=' + encodeURIComponent(data[key]);
      }
    }
  }, this).join('&');
};

utility.regex = require('./regex');

/**
 * Cross-platform string endsWith
 *
 * @param {String} string
 * @param {String} suffix
 * @returns {Boolean}
 */
utility.endsWith = function (string, suffix) {
  return string.indexOf(suffix, string.length - suffix.length) !== -1;
};

utility.ioConnect = function (settings) {
  var httpMode = settings.ssl ? 'https' : 'http';
  var url = httpMode + '://' + settings.host + ':' + settings.port + '' +
      settings.path + '?auth=' + settings.auth + '&resource=' + settings.namespace;

  return socketIO.connect(url, {'force new connection': true});
};

utility.urls = require('./urls');

// platform-specific members
_.extend(utility, utility.isBrowser() ?
    require('./utility-browser.js') : require('./utility-node.js'));

},{"./SignalEmitter.js":65,"./regex":68,"./urls":70,"./utility-browser.js":71,"./utility-node.js":72,"socket.io-client":42,"underscore":43}]},{},[64])(64)
});