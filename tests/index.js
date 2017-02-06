'use strict'

const test = require('ava')
const {
  sagaTestEngine,
  isPut,
  isNestedArray,
  getNextVal,
  isNestedPut,
} = require('../src')
const {
  favSagaWorker,
  getGlobalState,
  favItem,
  sucessfulFavItemAction,
  receivedFavItemErrorAction
} = require('../sagas')
const { select, call, put } = require('redux-saga/effects')


test('isPut correctly identifies a PUT Saga Effect', t => {
  t.false(isPut())
  t.false(isPut({}))
  t.false(isPut(put))
  t.false(isPut(call))
  t.false(isPut(select))
  t.false(isPut(call(() => 'call')))
  t.false(isPut(select(() => 'select')))
  t.false(isPut({CALL: 'someting'}))

  t.true(isPut(put({})))
  t.true(isPut({PUT: 'someting'}))
})


test('isNestedPut correctly identifies an array of PUT Saga Effects', t => {
  t.false(isNestedPut())
  t.false(isNestedPut({}))
  t.false(isNestedPut([]))
  t.false(isNestedPut(put))
  t.false(isNestedPut(call))
  t.false(isNestedPut(select))
  t.false(isNestedPut(call(() => 'call')))
  t.false(isNestedPut(select(() => 'select')))
  t.false(isNestedPut({CALL: 'someting'}))
  t.false(isNestedPut(put({})))
  t.false(isNestedPut({PUT: 'someting'}))

  t.true(isNestedPut([{PUT: 'someting'}]))
  t.true(isNestedPut([put({})]))
  t.true(isNestedPut([put({}), put({}), put({})]))

  t.false(isNestedPut([call(() => 1)]))
  t.false(isNestedPut([put({}), select(() => 1), put({})]))
})


test('isNestedArray correctly identifies a nested array', t => {
  t.false(isNestedArray())
  t.false(isNestedArray(1))
  t.false(isNestedArray({}))
  t.false(isNestedArray([1]))
  t.false(isNestedArray([1, 2]))
  t.false(isNestedArray([[1], [2]]))
  t.false(isNestedArray([[1, 2], [3]]))
  t.false(isNestedArray(new Map([[1, 2], [3]])))

  t.true(isNestedArray([]), 'Empty array is allowed.')
  t.true(isNestedArray([['key', 'val']]))
  t.true(isNestedArray([['key', 'val']]))
  t.true(isNestedArray([[undefined, undefined]]))
})


test('getNextVal', t => {
  // Nested Array
  t.is(2, getNextVal(1, [[1, 2]]))
  t.is(2, getNextVal(1, [[1, 2], [1, 3]]))
  t.is(4, getNextVal(3, [[1, 2], [3, 4]]))
  t.is(
    'val',
    getNextVal(
      {a: {b: {c: 1}}},
      [
        [{a: {b: {c: 1}}}, 'val']
      ]
    ),
    'Handled deeply-nested objects in arrays'
  )
  t.is(
    undefined,
    getNextVal(
      {a: {b: {c: 2}}},
      [
        [{a: {b: {c: 1}}}, 'val']
      ]
    ),
    'Handled deeply-nested objects in arrays part 2'
  )

  // Map
  t.is(2, getNextVal(1, new Map([[1, 2]])))
  t.is(4, getNextVal(3, new Map([[1, 2], [3, 4]])))
  t.is(
    'val',
    getNextVal(
      {a: {b: {c: 1}}},
      new Map([
        [{a: {b: {c: 1}}}, 'val']
      ])
    ),
    'Handled deeply-nested objects in Map'
  )
  t.is(
    undefined,
    getNextVal(
      {a: {b: {c: 2}}},
      new Map([
        [{a: {b: {c: 1}}}, 'val']
      ])
    ),
    'Handled deeply-nested objects in Map part 2'
  )

  // Handles value not found.
  t.is(undefined, getNextVal(100, []))
  t.is(undefined, getNextVal(100, new Map([])))
  t.is(undefined, getNextVal(100, [[1, 2]]))
  t.is(undefined, getNextVal(100, new Map([[1, 2]])))
  t.is(undefined, getNextVal(undefined, []))
  t.is(undefined, getNextVal(undefined, new Map([])))
})


test('sagaTestEngine throws under bad conditions', t => {
  const genericGenFunc = function*() {}
  const generator = genericGenFunc()

  // First assert.
  t.throws(
    () => sagaTestEngine(),
    'The first parameter must be a generator function.')
  t.throws(
    () => sagaTestEngine(1),
    'The first parameter must be a generator function.')
  t.throws(
    () => sagaTestEngine(() => 1),
    'The first parameter must be a generator function.',
    'Handled non-generator functions')
  t.throws(
    () => sagaTestEngine(generator),
    'The first parameter must be a generator function.',
    'Cannot be a generator itself')

  // Second assert.
  t.throws(
    () => sagaTestEngine(genericGenFunc, 1),
    'The second parameter must be a nested array or Map.')
  t.throws(
    () => sagaTestEngine(genericGenFunc, [1]),
    'The second parameter must be a nested array or Map.')

  // Third assert.
  const f = function*() {
    yield 'key'
  }
  const badMapping = [['incorrect key', 'value']]
  t.throws(
    () => sagaTestEngine(f, badMapping),
    'Env Mapping is missing a value for "key"')

  // No errors thrown
  const goodMapping = [['key', 'value']]
  t.notThrows(() => sagaTestEngine(f, goodMapping))

  const f2 = function*() {
    yield 'key1'
    yield 'key2'
  }
  const goodMapping2 = [['key1', 'value1'], ['key2', 'value2']]
  t.notThrows(() => sagaTestEngine(f2, goodMapping2))

  const f3 = function*() {
    yield undefined
  }
  const goodMapping3 = [[undefined, undefined]]
  t.notThrows(() => sagaTestEngine(f3, goodMapping3))

  const f4 = function*() {
    yield [put({a: 1})]
  }
  t.notThrows(
    () => sagaTestEngine(f4, goodMapping3),
    'Correctly handles nested array of puts'
  )

  const f5 = function*() {
    yield [select(() => 1)]
  }
  t.throws(() => sagaTestEngine(f5, goodMapping3))
})


test('sagaTestEngine correctly handles array of PUTS', t => {
  const selectorFunc = () => 2
  function* sagaWithNestedPuts() {
    const someString = yield select(selectorFunc)
    yield [
      put({a: 1}),
      put({b: 2}),
      put({c: someString}),
    ]
    yield put('another put')
  }

  const envMapping = [
    [select(selectorFunc), 'someString']
  ]

  t.deepEqual(
    sagaTestEngine(sagaWithNestedPuts, envMapping),
    [
      [
        put({a: 1}),
        put({b: 2}),
        put({c: 'someString'}),
      ],
      put('another put'),
    ],
    'Result is a nested array of puts.'
  )
})


test('Example favSagaWorker with happy path works', t => {
  const itemId = '123'
  const token = '456'
  const user = {id: '321'}

  const favItemResp = 'The favItem JSON response'
  const favItemRespOBj = { json: () => favItemResp }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = [
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBj],
    [favItemResp, favItemResp]
  ]

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(sucessfulFavItemAction(favItemResp, itemId, user))],
    'Happy path'
  )
})


test('Example favSagaWorker with sad path works', t => {
  const itemId = '123'
  const token = '456'
  const user = {id: '321'}

  const favItemRespFail = new TypeError('TypeError: response.json is not a function')
  const favItemRespOBjFail = { json: () => {throw favItemRespFail} }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = [
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBjFail],
    [favItemRespFail, favItemRespFail]
  ]

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(receivedFavItemErrorAction(favItemRespFail, itemId))],
    'Not happy path'
  )
})


test('favSagaWorker works when given a Map', t => {
  const itemId = '123'
  const token = '456'
  const user = {id: '321'}

  const favItemResp = 'The favItem JSON response'
  const favItemRespOBj = { json: () => favItemResp }

  const FAV_ACTION = {
    type: 'FAV_ITEM_REQUESTED',
    payload: { itemId },
  }

  const ENV = new Map([
    [select(getGlobalState), { user, token }],
    [call(favItem, itemId, token), favItemRespOBj],
    [favItemResp, favItemResp]
  ])

  t.deepEqual(
    sagaTestEngine(favSagaWorker, ENV, FAV_ACTION),
    [put(sucessfulFavItemAction(favItemResp, itemId, user))],
    'Maps work'
  )
})
