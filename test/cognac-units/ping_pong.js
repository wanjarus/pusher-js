;(function() {
  var withConnectedConnection = function(test, options, fn) {
    var connection = new Pusher.Connection('n', options);

    SteppedObserver(connection._machine, 'state_change', [
      function(e) {
        test.equal(e.newState, 'waiting', 'state should intially be "waiting"');
      },
      function(e) {
        test.equal(e.newState, 'connecting', 'state should progress to "connecting"');
        connection.socket.trigger('open');
      },
      function(e) {
        test.equal(e.newState, 'open', 'state should progress to "open"');
        connection.socket.trigger('message', JSON.stringify({
          event: 'pusher:connection_established',
          data: '{\"socket_id\":\"804.1456320\"}'
        }));
      },
      function(e) {
        test.equal(e.newState, 'connected', 'state should progress to "connected"');
        fn(connection);
      },
    ]);

    connection.connect();
  }

  var near = function(test, a, b, tolerance) {
    if (Math.abs(a - b) > tolerance) {
      test.ok(false, "expected " + a + ", got " + b + " (with a tolerance of " + tolerance + ")")
    }
  }

  runner.addSuite('Ping Pong', {
    'Ping Pong': {
      'should respond to pings' : function(test) {
        Pusher.Transport = TestSocket;
        withConnectedConnection(test, {}, function(connection) {
          connection.socket._onsend = function(msg) {
            test.deepEqual(JSON.parse(msg), {'event': 'pusher:pong', 'data': {}}, 'should be a pong');
            test.finish();
          }

          connection.socket.trigger('message', JSON.stringify({
            'event': 'pusher:ping',
            'data': '{}'
          }))
        })
      },
      'should send pings': function(test) {
        Pusher.Transport = TestSocket;

        withConnectedConnection(test, {'activity_timeout': 100}, function(connection) {
          connectedTime = (+new Date())
          connection.socket._onsend = function(msg) {
            pingTime = (+new Date())
            test.deepEqual(JSON.parse(msg), {'event': 'pusher:ping', 'data': {}}, 'should be a ping');
            near(test, 100, pingTime - connectedTime, 90)

            test.finish();
          }
        })
      },
      'should close the connection if a ping is not received': function(test) {
        Pusher.Transport = TestSocket;

        withConnectedConnection(test, {'activity_timeout': 20, 'pong_timeout':20}, function(connection) {
          connection.socket._onsend = function(msg) {
            test.deepEqual(JSON.parse(msg), {'event': 'pusher:ping', 'data': {}}, 'should be a ping');
            var finished = false;
            connection.socket._onclose = function() {
              finished = true;
              test.finish();
            }
            setTimeout(function() {
              if (!finished) {
                test.ok(false, "the connection was not closed");
              }
            }, 50)
          }
        })
      },
      'should keep the connection open if a pong is received': function(test) {
        Pusher.Transport = TestSocket;

        withConnectedConnection(test, {'activity_timeout': 20, 'pong_timeout': 20}, function(connection) {
          connection.socket._onsend = function(msg) {
            test.deepEqual(JSON.parse(msg), {'event': 'pusher:ping', 'data': {}}, 'should be a ping');

            connection.socket._onsend = function(msg) {
              test.deepEqual(JSON.parse(msg), {'event': 'pusher:ping', 'data': {}}, 'should be a ping');
              test.finish();
            }

            connection.socket.trigger('message', JSON.stringify({
              'event': 'pusher:pong',
              'data': '{}'
            }))
          }
        })
      }
    }
  })
}.call(this))
