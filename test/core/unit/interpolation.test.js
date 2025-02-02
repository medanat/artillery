/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { test } = require('tap');
const sinon = require('sinon');

const HttpEngine = require('../../../core/lib/engine_http');
const EventEmitter = require('events');
const nock = require('nock');

test('url and uri parameters', function (t) {
  const target = nock('http://localhost:8888').get('/hello').reply(200, 'ok');

  const target2 = nock('http://localhost:8888')
    .get('/goodbye')
    .reply(200, 'ok');

  const script = {
    config: {
      target: 'http://localhost:8888',
      processor: {
        printHello: function (req, context, ee, next) {
          console.log('# output from printHello hook!');
          context.vars.name = 'whatever';
          context.vars.uriList = [{ dev: 'hello', test: 'goodbye' }];
          return next();
        },
        logDetails: function (res, req, ctx, ee, done) {
          console.log('# output from logDetails hook!');
          console.log(`# ${res.name}`);
          return done();
        },
        logDetailsAgain: function (res, req, ctx, ee, done) {
          console.log('# output from logDetailsAgain hook!');
          console.log(`# ${res.name}`);
          return done();
        }
      }
    },
    scenarios: [
      {
        flow: [
          {
            loop: [
              {
                get: {
                  name: '{{ $loopElement.data[0].uri }} {{ name }} {{ $loopElement.data[0].person }}',
                  uri: '/{{ $loopElement.data[0].uri }}',
                  beforeRequest: '{{ $loopElement.data[1].before }}',
                  afterResponse: '{{ $loopElement.data[1].after }}'
                }
              }
            ],
            over: [
              {
                data: [
                  { uri: '{{ uriList[0]["dev"] }}', person: 'Hassy' },
                  { before: 'printHello', after: 'logDetails' }
                ]
              },
              {
                data: [
                  { uri: '{{ uriList[0]["test"] }}', person: 'Has' },
                  { before: 'printHello', after: 'logDetailsAgain' }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const engine = new HttpEngine(script);
  const ee = new EventEmitter();
  const spy = sinon.spy(console, 'log');
  const runScenario = engine.createScenario(script.scenarios[0], ee);

  const initialContext = {
    vars: {}
  };

  runScenario(initialContext, function userDone(err, finalContext) {
    if (err) {
      t.fail();
    }

    t.ok(target.isDone(), 'Should have made a request to /hello');
    t.ok(target2.isDone(), 'Should have made a request to /goodbye');

    [
      '# output from printHello hook!',
      '# hello whatever Hassy',
      '# output from logDetails hook!',
      '# goodbye whatever Has',
      '# output from logDetailsAgain hook!'
    ].forEach((expectedOutput) => {
      let seen = false;
      spy.args.forEach((args) => {
        if (args[0] === expectedOutput) {
          t.comment(`string: "${args[0]}" found`);
          seen = true;
        }
      });
      t.ok(seen);
    });
    console.log.restore(); // unwrap the spy

    t.end();
  });
});
