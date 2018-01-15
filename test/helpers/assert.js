"use strict";

async function assertEvmThrows(promise) {
  try {
    await promise;
  } catch (error) {
    const invalidOpcode = error.message.search('revert') >= 0;
    assert(invalidOpcode, "Expected EVM throw, got '" + error + "' instead");
    return;
  }

  assert.fail(new Error('EVM did not throw an exception, as expected!'));
}

function assertEventValues(event, expectedEventName, expectedEventArgs) {
  assert.equal(event.event, expectedEventName);
  assert.deepEqual(event.args, expectedEventArgs);
}

async function assertEvent(contract, expectedEvent, expectedArgs, index = 0) {
  try {
    const event = await getEvent(contract, expectedEvent, index);
    assert.equal(event.event, expectedEvent);
    assert.deepEqual(event.args, expectedArgs);

  } catch (error) {
    assert.fail(error);
  }
}

function getEvent(contract, expectedEvent, index) {
  return new Promise((resolve, reject) => {
      const event = contract[expectedEvent]();
      event.get((error, eventLog) => {
          if (error) {
            reject(error);
          } else if (eventLog.length <= index) {
            reject(new Error("Event not found at index " + index));
          } else {
            resolve(eventLog[index]);
          }
      });
  });
}

module.exports = {
    evmThrows: assertEvmThrows,
    eventValuesEqual : assertEventValues,
    eventEqual : assertEvent
};